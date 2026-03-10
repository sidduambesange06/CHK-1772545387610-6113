import os
import io
import hashlib
import base64
import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageDraw
import piexif
from transformers import pipeline
import torch

# ── GPU detection ──────────────────────────────────────────────────────────
_device = 0 if torch.cuda.is_available() else -1
print(f'[forensics] device: {"cuda" if _device == 0 else "cpu"}')

# ── Load ensemble of AI-image detection models ────────────────────────────
_img_model_primary = None
_img_model_secondary = None

print('[forensics] loading AI image detection models...')
# NOTE: Organika/sdxl-detector disabled — it returns 99% "artificial" for ALL images
# including real camera photos, making it useless as a general detector.
# Using dima806 as the sole neural model (correctly distinguishes real vs fake).
_img_model_primary = None

try:
    _img_model_secondary = pipeline(
        'image-classification',
        model='dima806/deepfake_vs_real_image_detection',
        device=_device
    )
    print('[forensics] model (dima806/deepfake_vs_real_image_detection) ready')
except Exception as e:
    print(f'[forensics] model failed: {e}')


# ═══════════════════════════════════════════════════════════════════════════
#  ELA: MULTI-QUALITY ERROR LEVEL ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def perform_ela(image_path, quality=90):
    img = Image.open(image_path).convert('RGB')
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=quality)
    buf.seek(0)
    compressed = Image.open(buf).convert('RGB')
    ela = ImageChops.difference(img, compressed)
    ela = ImageEnhance.Brightness(ela).enhance(10)
    return ela


def ela_to_base64(ela_img):
    buf = io.BytesIO()
    ela_img.save(buf, 'PNG')
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode()


def img_to_base64(pil_img):
    buf = io.BytesIO()
    pil_img.save(buf, 'PNG')
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode()


# ═══════════════════════════════════════════════════════════════════════════
#  FORENSIC X-RAY: VISUAL MAP GENERATORS
# ═══════════════════════════════════════════════════════════════════════════

def generate_noise_map(image_path):
    """Generate a colorized noise inconsistency map.
    Red = unusually uniform noise (AI), Green = natural camera noise."""
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img, dtype=float)
    blurred = np.array(img.filter(ImageFilter.GaussianBlur(radius=2)), dtype=float)
    noise = arr - blurred

    h, w, _ = noise.shape
    ps = 16
    heat = np.zeros((h, w), dtype=float)

    for i in range(0, h - ps, ps):
        for j in range(0, w - ps, ps):
            var = float(np.var(noise[i:i+ps, j:j+ps]))
            heat[i:i+ps, j:j+ps] = var

    if heat.max() > 0:
        heat = heat / heat.max()

    # colorize: low variance (uniform=AI) → red, high variance (natural) → green
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    rgb[:, :, 0] = ((1 - heat) * 255).astype(np.uint8)  # red channel
    rgb[:, :, 1] = (heat * 255).astype(np.uint8)          # green channel
    rgb[:, :, 2] = 40  # slight blue tint

    return img_to_base64(Image.fromarray(rgb))


def generate_frequency_map(image_path):
    """Generate FFT magnitude spectrum visualization with colorized rings."""
    img = Image.open(image_path).convert('L')
    arr = np.array(img, dtype=float)

    f = np.fft.fft2(arr)
    fshift = np.fft.fftshift(f)
    mag = np.log1p(np.abs(fshift))

    # normalize to 0-255
    mag_norm = ((mag - mag.min()) / (mag.max() - mag.min() + 1e-10) * 255).astype(np.uint8)

    # apply a plasma-style colormap manually
    h, w = mag_norm.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    t = mag_norm.astype(float) / 255.0
    # plasma-ish: dark blue → purple → orange → yellow
    rgb[:, :, 0] = (np.clip(t * 3 - 1, 0, 1) * 255).astype(np.uint8)
    rgb[:, :, 1] = (np.clip(t * 3 - 2, 0, 1) * 255).astype(np.uint8)
    rgb[:, :, 2] = (np.clip(np.minimum(t * 2, 2 - t * 2), 0, 1) * 255).astype(np.uint8)

    return img_to_base64(Image.fromarray(rgb))


def generate_manipulation_probability_map(image_path):
    """Combine ELA + noise + gradient into a single manipulation probability overlay.
    This is the key visual: red hotspots = likely manipulated regions."""
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img, dtype=float)
    h, w = arr.shape[:2]

    # ELA signal
    ela = perform_ela(image_path, quality=90)
    ela_arr = np.mean(np.array(ela, dtype=float), axis=2)

    # noise signal
    blurred = np.array(img.filter(ImageFilter.GaussianBlur(radius=2)), dtype=float)
    noise_var = np.zeros((h, w), dtype=float)
    noise = arr - blurred
    ps = 16
    for i in range(0, h - ps, ps):
        for j in range(0, w - ps, ps):
            v = float(np.var(noise[i:i+ps, j:j+ps]))
            noise_var[i:i+ps, j:j+ps] = v

    # gradient signal
    gray = np.mean(arr, axis=2)
    gx = np.zeros_like(gray)
    gy = np.zeros_like(gray)
    gx[:, :-1] = np.abs(np.diff(gray, axis=1))
    gy[:-1, :] = np.abs(np.diff(gray, axis=0))
    grad_mag = gx + gy

    # normalize each to 0-1
    def norm(a):
        mn, mx = a.min(), a.max()
        if mx - mn < 1e-10:
            return np.zeros_like(a)
        return (a - mn) / (mx - mn)

    ela_n = norm(ela_arr)
    noise_n = 1 - norm(noise_var)  # invert: low variance = suspicious
    grad_n = 1 - norm(grad_mag)    # invert: smooth gradients = suspicious

    # weighted combination
    prob = ela_n * 0.45 + noise_n * 0.30 + grad_n * 0.25
    prob = norm(prob)

    # colorize: transparent-yellow-red heat
    rgb = np.zeros((h, w, 4), dtype=np.uint8)  # RGBA
    rgb[:, :, 0] = 255  # red always
    rgb[:, :, 1] = ((1 - prob) * 180).astype(np.uint8)  # less green = more red
    rgb[:, :, 2] = 0
    rgb[:, :, 3] = (prob * 200).astype(np.uint8)  # alpha = probability

    return img_to_base64(Image.fromarray(rgb, 'RGBA'))


def generate_region_grid(image_path, grid_size=8):
    """Split image into grid, score each region independently.
    Returns a grid of per-region manipulation scores for interactive hover."""
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img, dtype=float)
    h, w = arr.shape[:2]

    ela = perform_ela(image_path, quality=90)
    ela_arr = np.mean(np.array(ela, dtype=float), axis=2)

    blurred = np.array(img.filter(ImageFilter.GaussianBlur(radius=2)), dtype=float)
    noise = arr - blurred

    rh = h // grid_size
    rw = w // grid_size
    grid = []

    for r in range(grid_size):
        row = []
        for c in range(grid_size):
            y1, y2 = r * rh, (r + 1) * rh
            x1, x2 = c * rw, (c + 1) * rw

            region_ela = float(np.mean(ela_arr[y1:y2, x1:x2]))
            region_noise_var = float(np.var(noise[y1:y2, x1:x2]))

            # ela high + noise uniform = suspicious
            ela_s = min(region_ela / 30.0, 1.0) * 100
            noise_s = max(0, (1 - min(region_noise_var / 50.0, 1.0))) * 100

            region_score = round(ela_s * 0.6 + noise_s * 0.4, 1)
            row.append(region_score)
        grid.append(row)

    return grid


def get_ela_metrics(ela_img):
    arr = np.array(ela_img).astype(float)
    mean_val = float(np.mean(arr))
    std_val = float(np.std(arr))

    h, w = arr.shape[:2]
    ps = max(h, w) // 8
    if ps < 8:
        ps = 8

    patch_means = []
    for i in range(0, h - ps, ps):
        for j in range(0, w - ps, ps):
            patch_means.append(np.mean(arr[i:i+ps, j:j+ps]))

    patch_cv = float(np.std(patch_means) / (np.mean(patch_means) + 1e-10)) if patch_means else 1.0

    return {
        'mean': mean_val,
        'std': std_val,
        'cv': float(std_val / (mean_val + 1e-10)),
        'patch_cv': patch_cv,
    }


def multi_quality_ela(image_path):
    """Run ELA at multiple JPEG qualities.
    AI-generated images: very low + uniform ELA across all qualities."""
    metrics_list = []
    for q in [70, 80, 90, 95]:
        ela = perform_ela(image_path, quality=q)
        m = get_ela_metrics(ela)
        metrics_list.append(m)

    avg_mean = np.mean([m['mean'] for m in metrics_list])
    std_of_means = np.std([m['mean'] for m in metrics_list])
    avg_patch_cv = np.mean([m['patch_cv'] for m in metrics_list])

    score = 0

    # AI images: low ELA mean (too smooth/perfect)
    # But lossless or high-quality JPEGs also have low ELA
    if avg_mean < 2:
        score += 28
    elif avg_mean < 6:
        score += 18
    elif avg_mean < 12:
        score += 8
    elif avg_mean < 20:
        score += 3

    # spatially uniform ELA = no localized artifacts = AI
    if avg_patch_cv < 0.3:
        score += 25
    elif avg_patch_cv < 0.6:
        score += 14
    elif avg_patch_cv < 1.0:
        score += 5

    # consistent across quality levels = not from real JPEG pipeline
    if std_of_means < 0.5:
        score += 18
    elif std_of_means < 1.5:
        score += 8

    return min(100, score), metrics_list[2]  # return q=90 for display


# ═══════════════════════════════════════════════════════════════════════════
#  FREQUENCY DOMAIN ANALYSIS (FFT)
# ═══════════════════════════════════════════════════════════════════════════

def frequency_analysis(image_path):
    """AI images have weaker high-frequency energy and smoother spectral falloff."""
    img = Image.open(image_path).convert('L')
    arr = np.array(img, dtype=float)

    f = np.fft.fft2(arr)
    fshift = np.fft.fftshift(f)
    mag = np.log1p(np.abs(fshift))

    h, w = mag.shape
    cy, cx = h // 2, w // 2
    y, x = np.ogrid[:h, :w]
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    max_r = np.sqrt(cx**2 + cy**2)

    r_low = max_r * 0.1
    r_mid = max_r * 0.35
    r_high = max_r * 0.7

    low_e = mag[dist <= r_low].mean()
    high_e = mag[(dist > r_mid) & (dist <= r_high)].mean()
    vhigh_e = mag[dist > r_high].mean()

    h2l = high_e / (low_e + 1e-10)
    vh2l = vhigh_e / (low_e + 1e-10)

    score = 0

    # Only strong spectral anomalies should score high
    # Smartphone processing can reduce high-freq content
    if h2l < 0.40:
        score += 30
    elif h2l < 0.48:
        score += 18
    elif h2l < 0.55:
        score += 8
    elif h2l < 0.60:
        score += 3

    if vh2l < 0.20:
        score += 25
    elif vh2l < 0.28:
        score += 15
    elif vh2l < 0.35:
        score += 6

    # azimuthal ring uniformity (GAN/diffusion periodic artifacts)
    ring_stds = []
    for r in np.linspace(r_mid, r_high, 15):
        mask = (dist >= r - 3) & (dist <= r + 3)
        ring = mag[mask]
        if len(ring) > 10:
            ring_stds.append(np.std(ring))

    if ring_stds:
        ring_cv = np.std(ring_stds) / (np.mean(ring_stds) + 1e-10)
        if ring_cv < 0.15:
            score += 18
        elif ring_cv < 0.28:
            score += 8

    details = {'highToLow': round(h2l, 4), 'vhighToLow': round(vh2l, 4)}
    return min(100, score), details


# ═══════════════════════════════════════════════════════════════════════════
#  NOISE CONSISTENCY ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def noise_analysis(image_path):
    """Real cameras: noise varies with brightness (photon noise).
    AI images: synthetic uniform noise or none at all."""
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img, dtype=float)

    blurred = img.filter(ImageFilter.GaussianBlur(radius=2))
    blur_arr = np.array(blurred, dtype=float)
    noise = arr - blur_arr

    h, w, c = noise.shape
    ps = 32

    bright_vars = []
    dark_vars = []
    all_vars = []

    for i in range(0, h - ps, ps):
        for j in range(0, w - ps, ps):
            pn = noise[i:i+ps, j:j+ps]
            po = arr[i:i+ps, j:j+ps]
            var = float(np.var(pn))
            brightness = float(np.mean(po))
            all_vars.append(var)
            if brightness > 170:
                bright_vars.append(var)
            elif brightness < 85:
                dark_vars.append(var)

    if not all_vars:
        return 0

    all_vars = np.array(all_vars)
    noise_cv = float(np.std(all_vars) / (np.mean(all_vars) + 1e-10))

    score = 0

    # Very low noise CV = extremely uniform noise = strong AI signal
    # But real smartphone photos with noise reduction can have cv 0.5-0.8
    # So only flag when VERY uniform
    if noise_cv < 0.25:
        score += 40
    elif noise_cv < 0.45:
        score += 25
    elif noise_cv < 0.65:
        score += 12
    elif noise_cv < 0.9:
        score += 4

    # photon noise: bright areas should be noisier in real photos
    # This is a strong signal but some phones equalize noise
    if bright_vars and dark_vars:
        b_mean = np.mean(bright_vars)
        d_mean = np.mean(dark_vars)
        ratio = d_mean / (b_mean + 1e-10)
        if ratio > 0.85:
            score += 25
        elif ratio > 0.70:
            score += 10

    return min(100, score)


# ═══════════════════════════════════════════════════════════════════════════
#  JPEG GHOST DETECTION
# ═══════════════════════════════════════════════════════════════════════════

def jpeg_ghost_analysis(image_path):
    """Re-compress at multiple qualities and measure difference patterns.
    Real JPEGs show a minimum at their original quality.
    AI images show monotonic or flat curves (no native JPEG history)."""
    img = Image.open(image_path).convert('RGB')
    max_dim = 1024
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)

    arr = np.array(img, dtype=float)

    ghost_diffs = []
    for q in range(50, 100, 5):
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=q)
        buf.seek(0)
        recomp = np.array(Image.open(buf).convert('RGB'), dtype=float)
        diff = float(np.mean(np.abs(arr - recomp)))
        ghost_diffs.append(diff)

    ghost_arr = np.array(ghost_diffs)
    min_idx = int(np.argmin(ghost_arr))
    cv = float(np.std(ghost_arr) / (np.mean(ghost_arr) + 1e-10))

    score = 0

    # very low variation = never truly JPEG-compressed
    # But photos saved as PNG or lossless also show this
    if cv < 0.10:
        score += 30
    elif cv < 0.20:
        score += 15
    elif cv < 0.30:
        score += 5

    # minimum at very high quality = synthetic origin
    if min_idx >= len(ghost_diffs) - 2:
        score += 15
    elif min_idx >= len(ghost_diffs) - 3:
        score += 8

    return min(100, score)


# ═══════════════════════════════════════════════════════════════════════════
#  GRADIENT CONSISTENCY ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def gradient_analysis(image_path):
    """AI images have smoother gradients and fewer high-frequency edge artifacts."""
    img = Image.open(image_path).convert('L')
    arr = np.array(img, dtype=float)

    gx = np.diff(arr, axis=1)
    gy = np.diff(arr, axis=0)

    gx_flat = gx.flatten()
    gy_flat = gy.flatten()

    gx_mu, gx_sig = np.mean(gx_flat), np.std(gx_flat)
    gy_mu, gy_sig = np.mean(gy_flat), np.std(gy_flat)

    score = 0

    if gx_sig > 0 and gy_sig > 0:
        gx_kurt = float(np.mean(((gx_flat - gx_mu) / gx_sig) ** 4) - 3)
        gy_kurt = float(np.mean(((gy_flat - gy_mu) / gy_sig) ** 4) - 3)
        avg_kurt = (gx_kurt + gy_kurt) / 2

        # real photos: heavy tails (high kurtosis from edges + noise)
        # AI images: smoother, lower kurtosis
        # But smartphone beauty mode can also smooth gradients
        if avg_kurt < 3:
            score += 25
        elif avg_kurt < 7:
            score += 12
        elif avg_kurt < 12:
            score += 5

    # gradient histogram fill ratio
    gx_int = gx_flat.astype(int)
    unique_vals = len(np.unique(gx_int))
    total_range = int(np.max(gx_int) - np.min(gx_int)) + 1
    fill_ratio = unique_vals / (total_range + 1e-10)

    if fill_ratio > 0.90:
        score += 20
    elif fill_ratio > 0.80:
        score += 10
    elif fill_ratio > 0.65:
        score += 3

    return min(100, score)


# ═══════════════════════════════════════════════════════════════════════════
#  PIXEL STATISTICS
# ═══════════════════════════════════════════════════════════════════════════

def pixel_statistics(image_path):
    """Statistical analysis of pixel distributions."""
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img, dtype=float)
    score = 0

    # histogram smoothness: real JPEGs have quantization gaps
    for ch in range(3):
        hist, _ = np.histogram(arr[:, :, ch], bins=256, range=(0, 255))
        zero_bins = int(np.sum(hist == 0))
        if zero_bins < 3:
            score += 5

    # color channel correlation
    r = arr[:, :, 0].flatten()
    g = arr[:, :, 1].flatten()
    b = arr[:, :, 2].flatten()
    rg = abs(np.corrcoef(r, g)[0, 1])
    rb = abs(np.corrcoef(r, b)[0, 1])
    gb = abs(np.corrcoef(g, b)[0, 1])
    avg_corr = (rg + rb + gb) / 3
    if avg_corr > 0.97:
        score += 15
    elif avg_corr > 0.93:
        score += 8

    # kurtosis of pixel distributions
    for ch in range(3):
        channel = arr[:, :, ch].flatten()
        mu = np.mean(channel)
        sigma = np.std(channel)
        if sigma > 0:
            kurt = float(np.mean(((channel - mu) / sigma) ** 4) - 3)
            if abs(kurt) < 0.3:
                score += 4

    # Benford's law on pixel values
    gray = np.mean(arr, axis=2).flatten().astype(int)
    gray = gray[gray > 0]
    if len(gray) > 1000:
        first_digits = np.array([int(str(v)[0]) for v in gray])
        expected = np.array([np.log10(1 + 1/d) for d in range(1, 10)])
        observed = np.array([(first_digits == d).sum() for d in range(1, 10)], dtype=float)
        observed = observed / (observed.sum() + 1e-10)
        benford_dist = float(np.sum(np.abs(observed - expected)))
        if benford_dist > 0.15:
            score += 10
        elif benford_dist > 0.10:
            score += 5

    return min(100, score)


# ═══════════════════════════════════════════════════════════════════════════
#  EXIF ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def check_exif(image_path):
    try:
        exif = piexif.load(image_path)
        flags = []
        score = 0

        zeroth = exif.get('0th', {})
        exif_ifd = exif.get('Exif', {})

        # camera make/model check
        make = zeroth.get(piexif.ImageIFD.Make, b'')
        model_tag = zeroth.get(piexif.ImageIFD.Model, b'')
        has_camera = bool(make) or bool(model_tag)

        focal = exif_ifd.get(piexif.ExifIFD.FocalLength)
        exposure = exif_ifd.get(piexif.ExifIFD.ExposureTime)
        dt_orig = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal)

        # valid camera metadata → strong authentic signal
        if has_camera and (focal or exposure) and dt_orig:
            flags.append('valid camera metadata present')
            return {'exifScore': 0, 'exifFlags': flags, 'exifLabel': 'CLEAN'}

        # edited by known editing software
        sw_raw = zeroth.get(piexif.ImageIFD.Software, b'')
        sw = sw_raw.decode('utf-8', errors='ignore').lower() if sw_raw else ''

        for ai_tool in ['dall-e', 'midjourney', 'stable diffusion', 'comfyui',
                         'automatic1111', 'novelai', 'firefly']:
            if ai_tool in sw:
                flags.append(f'AI tool: {ai_tool}')
                return {'exifScore': 90, 'exifFlags': flags, 'exifLabel': 'AI_TOOL'}

        for tool in ['photoshop', 'gimp', 'snapseed', 'lightroom', 'facetune',
                      'meitu', 'canva', 'picsart', 'afterlight']:
            if tool in sw:
                flags.append(f'edited with {tool}')
                return {'exifScore': 50, 'exifFlags': flags, 'exifLabel': 'EDITED'}

        # timestamp mismatch
        dt_mod = zeroth.get(piexif.ImageIFD.DateTime)
        if dt_orig and dt_mod and dt_orig != dt_mod:
            flags.append('timestamp mismatch')
            score += 15

        # missing metadata — very common for web images, should NOT heavily penalize
        if not has_camera:
            flags.append('no camera info')
            score += 5

        if not dt_orig:
            flags.append('no original timestamp')
            score += 3

        if not focal and not exposure:
            flags.append('no lens/exposure data')
            score += 2

        # completely empty EXIF
        if not zeroth and not exif_ifd:
            flags = ['metadata stripped (common for web images)']
            score = 10

        label = 'SUSPICIOUS' if score > 40 else 'CLEAN'
        return {'exifScore': min(score, 100), 'exifFlags': flags, 'exifLabel': label}

    except Exception:
        # no EXIF at all — this is normal for web images, minimal penalty
        return {'exifScore': 10, 'exifFlags': ['no metadata (common for web images)'], 'exifLabel': 'CLEAN'}


# ═══════════════════════════════════════════════════════════════════════════
#  DEEPFAKE MODEL ENSEMBLE
# ═══════════════════════════════════════════════════════════════════════════

def run_deepfake_model(image_path):
    """Run ensemble of models. Returns score (0-100) where higher = more likely fake/AI."""
    scores = []
    models_used = []

    for model, name in [(_img_model_primary, 'organika'), (_img_model_secondary, 'dima806')]:
        if model is None:
            continue
        try:
            results = model(image_path)
            print(f'[model:{name}] raw: {results}')

            fake_score = None
            real_score = None
            for r in results:
                lbl = r['label'].lower()
                if any(kw in lbl for kw in ['artificial', 'fake', 'ai', 'generated', 'synthetic', 'deepfake']):
                    fake_score = r['score'] * 100
                elif any(kw in lbl for kw in ['real', 'human', 'authentic', 'genuine', 'original']):
                    real_score = r['score'] * 100

            if fake_score is not None:
                scores.append(fake_score)
                models_used.append(name)
            elif real_score is not None:
                scores.append(100 - real_score)
                models_used.append(name)
            elif results:
                # Unknown label: binary classifier — pick the label with highest score
                # and treat it as "fake" confidence only if it's > 50 (model leans fake)
                # otherwise lean real. This avoids the inverted-fallback bug.
                top_score = results[0]['score'] * 100
                scores.append(top_score if top_score > 50 else 100 - top_score)
                models_used.append(name)

        except Exception as e:
            print(f'[model:{name}] error: {e}')

    if not scores:
        return None, []

    if len(scores) == 1:
        return round(scores[0], 2), models_used

    max_s = max(scores)
    avg_s = sum(scores) / len(scores)
    disagreement = max(scores) - min(scores)

    # If models disagree strongly (>35 pts apart), trust the average —
    # one model may not be suited for this image type (e.g. face model on landscape)
    if disagreement > 35:
        result = round(avg_s, 2)
    # Both models confidently agree it's fake
    elif all(s > 65 for s in scores):
        result = round(max_s, 2)
    # Both models moderately agree
    elif all(s > 45 for s in scores):
        result = round(avg_s * 0.7 + max_s * 0.3, 2)
    else:
        # Models lean real or uncertain → use average (reduces false positives)
        result = round(avg_s, 2)

    print(f'[model:ensemble] scores={scores} max={max_s:.1f} avg={avg_s:.1f} disagree={disagreement:.1f} result={result}')
    return result, models_used


# ═══════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def hash_file(fpath):
    h = hashlib.sha256()
    with open(fpath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN IMAGE ANALYSIS — CROSS-EXAMINATION ENGINE
# ═══════════════════════════════════════════════════════════════════════════

def analyze_image(image_path):
    print(f'[analyze] starting: {image_path}')

    # visual ELA heatmap
    ela_img = perform_ela(image_path)
    heatmap = ela_to_base64(ela_img)

    # ── ENGINE 1: NEURAL FINGERPRINT (AI models) ──────────────────────
    model_score, models_used = run_deepfake_model(image_path)

    # ── ENGINE 2: PHYSICS VALIDATOR (forensic algorithms) ─────────────
    ela_score, ela_metrics = multi_quality_ela(image_path)
    freq_score, freq_details = frequency_analysis(image_path)
    noise_score = noise_analysis(image_path)
    ghost_score = jpeg_ghost_analysis(image_path)
    gradient_score = gradient_analysis(image_path)
    pixel_score = pixel_statistics(image_path)

    # ── ENGINE 3: PROVENANCE TRACKER (metadata) ──────────────────────
    exif_data = check_exif(image_path)
    file_hash = hash_file(image_path)
    exif_score = exif_data['exifScore']

    print(f'[analyze] raw signals: model={model_score} ela={ela_score} freq={freq_score} '
          f'noise={noise_score} pixel={pixel_score} ghost={ghost_score} '
          f'gradient={gradient_score} exif={exif_score}')

    # ── NO NORMALIZATION — use raw scores directly ─────────────────

    # ── CROSS-EXAMINATION: 3-engine verdict ────────────────────────
    forensic_scores = [freq_score, noise_score, ela_score, ghost_score, gradient_score]
    forensic_avg = np.mean(forensic_scores)
    strong_forensic = sum(1 for s in forensic_scores if s > 50)
    moderate_forensic = sum(1 for s in forensic_scores if s > 30)

    ai_score = model_score if model_score is not None else 0

    # Engine verdicts (each engine votes independently)
    engine1_verdict = 'unknown'  # neural
    engine2_verdict = 'unknown'  # physics
    engine3_verdict = 'unknown'  # provenance

    if model_score is not None:
        if model_score >= 70:
            engine1_verdict = 'fake'
        elif model_score >= 40:
            engine1_verdict = 'suspicious'
        else:
            engine1_verdict = 'authentic'

    if forensic_avg >= 45:
        engine2_verdict = 'fake'
    elif forensic_avg >= 25:
        engine2_verdict = 'suspicious'
    else:
        engine2_verdict = 'authentic'

    if exif_data['exifLabel'] == 'AI_TOOL':
        engine3_verdict = 'fake'
    elif exif_data['exifLabel'] == 'EDITED':
        engine3_verdict = 'suspicious'
    elif exif_score <= 5:
        engine3_verdict = 'authentic'
    else:
        engine3_verdict = 'neutral'  # missing metadata is NOT evidence

    print(f'[analyze] engine verdicts: neural={engine1_verdict} physics={engine2_verdict} provenance={engine3_verdict}')

    # ── SMART SCORING ─────────────────────────────────────────────
    # PRINCIPLE: Neural AI model is the PRIMARY detector.
    #
    # Modern AI-generated images (Stable Diffusion, Midjourney, DALL-E)
    # are designed to look photorealistic and leave MINIMAL forensic
    # artifacts. Low ELA/FFT/noise does NOT mean the image is real —
    # it means the AI was good. The neural model (trained specifically
    # to detect AI generation) must be the primary judge.
    #
    # Forensics are CORROBORATING evidence — they can boost confidence
    # upward (detecting Photoshop / splicing) or downward when camera
    # EXIF with full metadata is present.
    #
    # Weights: Neural model 65% | Forensics 30% | EXIF 5%

    has_valid_camera_exif = (exif_data['exifLabel'] == 'CLEAN' and exif_score == 0)

    if model_score is None:
        # No neural model — forensics only
        final = forensic_avg * 0.85 + exif_score * 0.15

    elif exif_data['exifLabel'] == 'AI_TOOL':
        # EXIF explicitly names an AI generation tool — definitive
        final = max(model_score * 0.65 + forensic_avg * 0.30 + exif_score * 0.05, 80)

    elif model_score < 35 and forensic_avg >= 45:
        # Neural says real but forensics say manipulated → Photoshop/splicing
        # Trust forensics here; this is a non-AI manipulation case
        final = model_score * 0.15 + forensic_avg * 0.80 + exif_score * 0.05

    elif model_score < 40 and forensic_avg < 25 and has_valid_camera_exif:
        # Both neural and forensics lean authentic + valid camera EXIF
        # High confidence authentic
        final = model_score * 0.65 + forensic_avg * 0.30 + exif_score * 0.05
        final = min(final, 25)

    elif model_score < 40 and forensic_avg < 25:
        # Both lean authentic (no camera EXIF, but signals agree)
        final = model_score * 0.65 + forensic_avg * 0.30 + exif_score * 0.05
        final = min(final, 35)

    elif model_score < 55 and forensic_avg < 35:
        # Model uncertain + mild forensics → lean authentic, cap at SUSPICIOUS range
        final = model_score * 0.65 + forensic_avg * 0.30 + exif_score * 0.05
        final = min(final, 50)

    else:
        # Default path: neural model leads (65% weight)
        # Requires model_score >= 55 OR forensic_avg >= 35 to reach MANIPULATED
        final = model_score * 0.65 + forensic_avg * 0.30 + exif_score * 0.05

        # Forensic boost: ONLY when model is already confident (reduces false positives)
        if model_score >= 78 and strong_forensic >= 3:
            final = min(final + 8, 100)

        # Camera EXIF protection: valid camera metadata dampens the verdict
        # (does NOT negate neural model — just prevents borderline false positives)
        if has_valid_camera_exif:
            if model_score < 60:
                final = min(final, 35)   # camera + weak neural → authentic
            elif model_score < 75:
                final = min(final, 48)   # camera + moderate neural → max low-suspicious

    # ── EXIF EDITED override: editing software found ────────────────
    if exif_data['exifLabel'] == 'EDITED':
        final = max(final, 42)

    final = round(min(100, max(0, final)), 2)

    # ── VERDICT ────────────────────────────────────────────────────
    if final >= 62:
        label = 'MANIPULATED'
    elif final >= 40:
        label = 'SUSPICIOUS'
    else:
        label = 'AUTHENTIC'

    confidence = round(min(abs(final - 50) + 50, 99), 2)
    ela_display = round(min(ela_metrics['mean'] / 2.55, 100), 2)

    # ── BUILD EXPLANATION (cross-examination style) ────────────────
    reason_lines = []
    signal_labels = {
        'model': ('AI Model', ai_score),
        'freq': ('Frequency Analysis', freq_score),
        'noise': ('Noise Consistency', noise_score),
        'ela': ('ELA Analysis', ela_score),
        'ghost': ('JPEG Ghost', ghost_score),
        'gradient': ('Gradient Analysis', gradient_score),
        'exif': ('EXIF Metadata', exif_score),
    }

    for key, (name, val) in signal_labels.items():
        if val > 70:
            reason_lines.append(f'{name}: strong indication of manipulation ({val}%)')
        elif val > 40:
            reason_lines.append(f'{name}: moderate anomaly detected ({val}%)')
        elif val > 20:
            reason_lines.append(f'{name}: weak artifacts ({val}%)')
        else:
            reason_lines.append(f'{name}: within normal range ({val}%)')

    if exif_data['exifFlags']:
        reason_lines.append(f'EXIF notes: {", ".join(exif_data["exifFlags"])}')

    # cross-examination summary
    engines_agree = sum(1 for v in [engine1_verdict, engine2_verdict, engine3_verdict] if v == 'fake')
    engines_disagree = (engine1_verdict != engine2_verdict) and engine1_verdict != 'unknown' and engine2_verdict != 'unknown'

    if engines_agree >= 2:
        conclusion = f'Multiple independent engines ({engines_agree}/3) confirm manipulation or AI generation.'
    elif engines_disagree:
        conclusion = (
            f'Engines disagree: Neural={engine1_verdict}, Physics={engine2_verdict}, Provenance={engine3_verdict}. '
            f'This may indicate a sophisticated manipulation that evades some detection methods.'
        )
    elif label == 'SUSPICIOUS':
        conclusion = 'Some indicators suggest possible manipulation, but engines do not strongly agree.'
    else:
        conclusion = 'Forensic analysis shows no significant evidence of manipulation.'

    explanation = {
        'signals': {name: val for _, (name, val) in signal_labels.items()},
        'reasons': reason_lines,
        'conclusion': conclusion,
        'agreementNote': f'{strong_forensic} strong and {moderate_forensic} moderate forensic signals detected',
        'engineVerdicts': {
            'neural': engine1_verdict,
            'physics': engine2_verdict,
            'provenance': engine3_verdict,
        },
    }

    print(f'[analyze] final={final} label={label} confidence={confidence} '
          f'strong={strong_forensic} moderate={moderate_forensic} '
          f'engines_agree={engines_agree}')

    # ── FORENSIC X-RAY: generate visual layers ──────────────────────
    print('[analyze] generating forensic x-ray visual layers...')
    try:
        noise_map = generate_noise_map(image_path)
    except Exception as e:
        print(f'[xray] noise map failed: {e}')
        noise_map = None

    try:
        freq_map = generate_frequency_map(image_path)
    except Exception as e:
        print(f'[xray] frequency map failed: {e}')
        freq_map = None

    try:
        prob_map = generate_manipulation_probability_map(image_path)
    except Exception as e:
        print(f'[xray] probability map failed: {e}')
        prob_map = None

    try:
        region_grid = generate_region_grid(image_path)
    except Exception as e:
        print(f'[xray] region grid failed: {e}')
        region_grid = None

    print('[analyze] forensic x-ray complete')

    return {
        'label': label,
        'score': final,
        'confidence': confidence,
        'elaScore': ela_display,
        'elaAdvanced': ela_score,
        'modelScore': model_score,
        'freqScore': freq_score,
        'noiseScore': noise_score,
        'pixelScore': pixel_score,
        'ghostScore': ghost_score,
        'gradientScore': gradient_score,
        'exifScore': exif_data['exifScore'],
        'exifFlags': exif_data['exifFlags'],
        'exifLabel': exif_data['exifLabel'],
        'freqDetails': freq_details,
        'modelsUsed': models_used,
        'heatmapBase64': heatmap,
        'fileHash': file_hash,
        'mediaType': 'image',
        'explanation': explanation,
        # Forensic X-Ray layers
        'xray': {
            'noiseMap': noise_map,
            'freqMap': freq_map,
            'probMap': prob_map,
            'regionGrid': region_grid,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
#  VIDEO ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def analyze_video(video_path, sample_rate=10):
    import cv2

    os.makedirs('temp', exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f'could not open video: {video_path}')

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    scores = []
    idx = 0

    print(f'[video] {total} frames at {fps:.0f}fps, sampling every {sample_rate}')

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % sample_rate == 0:
            tmp = f'temp/frame_{idx}.jpg'
            cv2.imwrite(tmp, frame)
            s, _ = run_deepfake_model(tmp)
            if s is not None:
                scores.append(s)
            if os.path.exists(tmp):
                os.remove(tmp)
        idx += 1

    cap.release()
    file_hash = hash_file(video_path)

    if not scores:
        return {
            'label': 'UNKNOWN', 'score': 0, 'confidence': 0,
            'framesChecked': 0, 'framesFlagged': 0,
            'totalFrames': total, 'fileHash': file_hash, 'mediaType': 'video'
        }

    avg = round(sum(scores) / len(scores), 2)
    flagged = sum(1 for s in scores if s > 50)
    ratio = flagged / len(scores)

    if ratio > 0.6 and avg >= 65:
        label = 'MANIPULATED'
        conclusion = 'Majority of sampled frames show strong deepfake indicators.'
    elif ratio > 0.3 or avg >= 40:
        label = 'SUSPICIOUS'
        conclusion = 'Some frames show potential manipulation but not consistently confirmed.'
    else:
        label = 'AUTHENTIC'
        conclusion = 'Sampled frames show no significant deepfake indicators.'

    confidence = round(min(abs(avg - 50) + 50, 99), 2)

    print(f'[video] {len(scores)} frames, {flagged} flagged -> {label}')

    return {
        'label': label, 'score': avg, 'confidence': confidence,
        'framesChecked': len(scores), 'framesFlagged': flagged,
        'totalFrames': total, 'fileHash': file_hash, 'mediaType': 'video',
        'explanation': {
            'conclusion': conclusion,
            'reasons': [
                f'Analyzed {len(scores)} frames, {flagged} flagged as suspicious',
                f'Average deepfake score: {avg}%',
                f'Flagged frame ratio: {ratio:.0%}',
            ],
        },
    }
