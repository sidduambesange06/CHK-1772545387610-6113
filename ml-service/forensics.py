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
try:
    _img_model_primary = pipeline(
        'image-classification',
        model='Organika/sdxl-detector',
        device=_device
    )
    print('[forensics] primary model (Organika/sdxl-detector) ready')
except Exception as e:
    print(f'[forensics] primary model failed: {e}')

try:
    _img_model_secondary = pipeline(
        'image-classification',
        model='dima806/deepfake_vs_real_image_detection',
        device=_device if _img_model_primary is None else -1
    )
    print('[forensics] secondary model (dima806) ready')
except Exception as e:
    print(f'[forensics] secondary model failed: {e}')


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


def img_to_base64(pil_img, max_dim=400):
    # resize to keep sessionStorage under quota (~5MB limit)
    if max(pil_img.size) > max_dim:
        ratio = max_dim / max(pil_img.size)
        pil_img = pil_img.resize((int(pil_img.width * ratio), int(pil_img.height * ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    # JPEG doesn't support RGBA — use PNG for transparent images
    if pil_img.mode == 'RGBA':
        pil_img.save(buf, 'PNG', optimize=True)
    else:
        pil_img = pil_img.convert('RGB')
        pil_img.save(buf, 'JPEG', quality=60)
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
#  CHROMATIC ABERRATION ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

def chromatic_aberration_analysis(image_path):
    """Detect chromatic aberration (color fringing) at edges.

    Real camera lenses produce different refraction per wavelength,
    causing R/G/B channels to misalign at high-contrast edges.
    AI-generated images have perfectly aligned color channels.

    This is a strong forensic signal:
    - Real photos: channels decorrelated at edges (CA present)
    - AI images: channels nearly identical at edges (no CA)
    """
    img = Image.open(image_path).convert('RGB')
    max_dim = 1024
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)

    arr = np.array(img, dtype=float)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Find strong edges using grayscale gradient
    gray = np.mean(arr, axis=2)
    gx = np.pad(np.diff(gray, axis=1), ((0, 0), (0, 1)), mode='edge')
    gy = np.pad(np.diff(gray, axis=0), ((0, 1), (0, 0)), mode='edge')
    edges = np.sqrt(gx ** 2 + gy ** 2)

    threshold = np.percentile(edges, 92)
    strong = edges > threshold

    if np.sum(strong) < 200:
        return 0, {}

    # Per-channel edge gradients at strong edge locations
    r_gx = np.pad(np.diff(r, axis=1), ((0, 0), (0, 1)), mode='edge')
    g_gx = np.pad(np.diff(g, axis=1), ((0, 0), (0, 1)), mode='edge')
    b_gx = np.pad(np.diff(b, axis=1), ((0, 0), (0, 1)), mode='edge')

    r_e = r_gx[strong]
    g_e = g_gx[strong]
    b_e = b_gx[strong]

    # Cross-channel correlation at edges
    rg = abs(float(np.corrcoef(r_e, g_e)[0, 1]))
    rb = abs(float(np.corrcoef(r_e, b_e)[0, 1]))
    gb = abs(float(np.corrcoef(g_e, b_e)[0, 1]))
    avg_corr = (rg + rb + gb) / 3

    # Per-channel edge magnitude variation
    mags = [float(np.std(r_e)), float(np.std(g_e)), float(np.std(b_e))]
    mag_cv = float(np.std(mags) / (np.mean(mags) + 1e-10))

    score = 0

    # Very high correlation = no chromatic aberration = likely AI
    if avg_corr > 0.997:
        score += 30
    elif avg_corr > 0.990:
        score += 18
    elif avg_corr > 0.980:
        score += 8
    elif avg_corr < 0.950:
        score -= 10  # strong CA = real camera

    # Channels too similar in magnitude = AI
    if mag_cv < 0.015:
        score += 20
    elif mag_cv < 0.04:
        score += 10
    elif mag_cv > 0.12:
        score -= 5  # different per channel = real lens

    details = {
        'avgEdgeCorrelation': round(avg_corr, 4),
        'channelMagCV': round(mag_cv, 4),
    }

    return max(0, min(100, score)), details


# ═══════════════════════════════════════════════════════════════════════════
#  JPEG QUANTIZATION TABLE FORENSICS (Engine 4: Source Identifier)
# ═══════════════════════════════════════════════════════════════════════════

def jpeg_quantization_forensics(image_path):
    """Analyze JPEG quantization tables to identify image source.

    Every JPEG has quantization tables (DQT) that fingerprint the encoder:
    - Camera manufacturers use PROPRIETARY tables (Canon, Samsung, Apple, etc.)
    - PIL/Pillow uses standard IJG tables
    - OpenCV uses its own standard tables
    - AI generators (DALL-E, Midjourney) save through PIL → standard tables

    This is a powerful forensic signal because AI-generated images are
    almost always saved through Python imaging libraries, not cameras.

    Returns: (score 0-100, origin_label, details_dict)
    """
    try:
        img = Image.open(image_path)

        # Only works for JPEG files
        if not hasattr(img, 'quantization') or not img.quantization:
            return 0, 'non_jpeg', {}

        qt = img.quantization
        luma_table = list(qt.get(0, []))
        chroma_table = list(qt.get(1, [])) if 1 in qt else []

        if len(luma_table) < 64:
            return 0, 'invalid_qt', {}

        # ── Known standard library quantization signatures ──
        # PIL/Pillow quality 75-95 luminance tables have specific fingerprints
        # We check: table uniformity, value distribution, and specific positions

        # Metric 1: Table entropy (camera tables have more variation)
        unique_vals = len(set(luma_table))
        total_range = max(luma_table) - min(luma_table) + 1

        # Metric 2: Low-frequency coefficients pattern
        # Standard tables: DC coefficient (position 0) is typically small (2-8)
        # Camera tables: DC coefficient varies more widely
        dc_val = luma_table[0]

        # Metric 3: High-frequency coefficient ratio
        # Standard tables increase smoothly; camera tables have irregular jumps
        low_freq = np.mean(luma_table[:16])
        high_freq = np.mean(luma_table[48:])
        freq_ratio = high_freq / (low_freq + 1e-10)

        # Metric 4: Adjacent coefficient smoothness
        diffs = [abs(luma_table[i+1] - luma_table[i]) for i in range(63)]
        smoothness = np.std(diffs)

        score = 0
        origin = 'unknown'

        # Standard library signatures (PIL/OpenCV)
        if unique_vals < 25 and dc_val <= 8:
            score += 30
            origin = 'library'
        elif unique_vals < 35 and dc_val <= 5:
            score += 20
            origin = 'library'

        # Smooth frequency ratio = standard table
        if freq_ratio > 8 and smoothness < 15:
            score += 25
            origin = 'library'
        elif freq_ratio > 5:
            score += 10

        # Camera-specific patterns (high variation, irregular jumps)
        if unique_vals > 40 and smoothness > 20:
            score = max(0, score - 30)  # reduce score — likely camera
            origin = 'camera'
        elif unique_vals > 50:
            score = 0
            origin = 'camera'

        # Cross-check with chroma table
        if chroma_table and len(chroma_table) >= 64:
            chroma_unique = len(set(chroma_table))
            if chroma_unique < 15:
                score += 15  # very uniform chroma = standard table
                origin = 'library'

        details = {
            'uniqueValues': unique_vals,
            'dcCoeff': dc_val,
            'freqRatio': round(freq_ratio, 2),
            'smoothness': round(smoothness, 2),
            'origin': origin,
        }

        return min(100, score), origin, details

    except Exception as e:
        return 0, 'error', {'error': str(e)}


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
            return {'exifScore': 0, 'exifFlags': flags, 'exifLabel': 'CLEAN', 'hasAnyExif': True}

        # edited by known editing software
        sw_raw = zeroth.get(piexif.ImageIFD.Software, b'')
        sw = sw_raw.decode('utf-8', errors='ignore').lower() if sw_raw else ''

        for ai_tool in ['dall-e', 'midjourney', 'stable diffusion', 'comfyui',
                         'automatic1111', 'novelai', 'firefly']:
            if ai_tool in sw:
                flags.append(f'AI tool: {ai_tool}')
                return {'exifScore': 90, 'exifFlags': flags, 'exifLabel': 'AI_TOOL', 'hasAnyExif': True}

        for tool in ['photoshop', 'gimp', 'snapseed', 'lightroom', 'facetune',
                      'meitu', 'canva', 'picsart', 'afterlight']:
            if tool in sw:
                flags.append(f'edited with {tool}')
                return {'exifScore': 50, 'exifFlags': flags, 'exifLabel': 'EDITED', 'hasAnyExif': True}

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
        return {'exifScore': min(score, 100), 'exifFlags': flags, 'exifLabel': label, 'hasAnyExif': True}

    except Exception:
        # no EXIF at all — AI-generated images never have EXIF headers
        return {'exifScore': 10, 'exifFlags': ['no metadata (common for web images)'], 'exifLabel': 'CLEAN', 'hasAnyExif': False}


# ═══════════════════════════════════════════════════════════════════════════
#  DEEPFAKE MODEL ENSEMBLE
# ═══════════════════════════════════════════════════════════════════════════

def run_deepfake_model(image_path):
    """Run ensemble of models. Returns (score, models_used, individual_scores)."""
    scores = []
    models_used = []
    individual = {}

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
                individual[name] = fake_score
            elif real_score is not None:
                scores.append(100 - real_score)
                models_used.append(name)
                individual[name] = 100 - real_score
            elif results:
                top_score = results[0]['score'] * 100
                s = top_score if top_score > 50 else 100 - top_score
                scores.append(s)
                models_used.append(name)
                individual[name] = s

        except Exception as e:
            print(f'[model:{name}] error: {e}')

    if not scores:
        return None, [], {}

    if len(scores) == 1:
        return round(scores[0], 2), models_used, individual

    # dima806 is trained on face deepfakes — reliable for face swaps
    # organika/sdxl-detector is trained on AI-generated images — reliable for
    # Stable Diffusion / DALL-E / Midjourney / Gemini but has high false-positive rate
    # Strategy: dima806 leads, but organika gets credit when dima806 agrees
    # The EXIF cross-reference in analyze_image handles the false-positive problem
    dima_score = scores[-1]   # dima806 loaded second
    orga_score = scores[0]    # organika loaded first

    if dima_score > 50:
        # dima806 thinks it's fake — boost with organika agreement
        result = round(dima_score * 0.7 + orga_score * 0.3, 2)
    elif dima_score > 30 and orga_score > 90:
        # dima806 uncertain but organika very confident → cautious boost
        result = round(dima_score * 0.6 + orga_score * 0.15 + 10, 2)
    else:
        # dima806 says real — base ensemble trusts dima806
        # BUT analyze_image will cross-check organika + EXIF metadata
        result = round(dima_score, 2)

    print(f'[model:ensemble] orga={orga_score:.1f} dima={dima_score:.1f} result={result}')
    return result, models_used, individual


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
    model_score, models_used, individual_scores = run_deepfake_model(image_path)

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

    # ── ENGINE 4: CHROMATIC ABERRATION (lens physics) ──────────────
    ca_score, ca_details = chromatic_aberration_analysis(image_path)

    # ── ENGINE 5: JPEG QUANTIZATION TABLE (source identifier) ────────
    qt_score, qt_origin, qt_details = jpeg_quantization_forensics(image_path)

    print(f'[analyze] raw signals: model={model_score} ela={ela_score} freq={freq_score} '
          f'noise={noise_score} pixel={pixel_score} ghost={ghost_score} '
          f'gradient={gradient_score} ca={ca_score} exif={exif_score} qt={qt_score}({qt_origin})')

    # ── NO NORMALIZATION — use raw scores directly ─────────────────

    # ── CROSS-EXAMINATION: 3-engine verdict ────────────────────────
    forensic_scores = [freq_score, noise_score, ela_score, ghost_score, gradient_score, ca_score]
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

    # ── AI GENERATION DETECTION (multi-signal cross-reference) ──
    orga_raw = individual_scores.get('organika', 0)

    # Binary-level EXIF check: read raw JPEG header bytes
    # Camera JPEGs: start with FFD8 FFE1 and contain "Exif" marker
    # AI/PIL-saved JPEGs: start with FFD8 FFE0 (JFIF only, no Exif marker)
    # This is MORE reliable than piexif.load() which can succeed for both
    has_exif_binary = False
    try:
        with open(image_path, 'rb') as _f:
            _hdr = _f.read(24)
        has_exif_binary = b'Exif' in _hdr
    except Exception:
        pass

    is_png = image_path.lower().endswith('.png')

    # Strategy 1: organika confident + JPEG with NO Exif binary marker
    # Camera photos ALWAYS embed "Exif" in the JPEG header
    # AI images saved by PIL/libraries use JFIF without Exif
    if orga_raw > 85 and not has_exif_binary and not is_png and exif_data['exifLabel'] != 'EDITED':
        ai_override = round(orga_raw * 0.72, 2)
        if ai_override > final:
            print(f'[analyze] AI generation detected: organika={orga_raw:.1f}% + no Exif binary marker '
                  f'→ boosting {final:.1f} → {ai_override}')
            final = ai_override
            engine1_verdict = 'fake'

    # Strategy 2: PNG format + no camera EXIF
    # Real cameras NEVER save as PNG — they always save JPEG/HEIF
    # AI generators (Gemini, DALL-E, Midjourney) typically output PNG
    if is_png and not has_valid_camera_exif and exif_data['exifLabel'] != 'EDITED':
        png_base = 50
        if forensic_avg > 15:
            png_base += min(forensic_avg * 0.8, 20)
        if orga_raw > 3:
            png_base += min(orga_raw * 0.3, 10)
        png_boost = round(min(png_base, 78), 2)
        if png_boost > final:
            print(f'[analyze] PNG provenance signal: PNG + no camera EXIF + forensic_avg={forensic_avg:.1f} '
                  f'→ boosting {final:.1f} → {png_boost}')
            final = png_boost
            engine3_verdict = 'suspicious'

    # Strategy 3: JPEG Quantization Table confirms library/AI origin
    # Camera JPEGs have proprietary quantization tables unique to each manufacturer
    # AI-generated images saved via PIL/OpenCV use standard IJG tables
    if qt_origin == 'library' and not has_exif_binary and exif_data['exifLabel'] != 'EDITED':
        qt_boost_base = 55
        if orga_raw > 50:
            qt_boost_base += min(orga_raw * 0.25, 20)
        if forensic_avg > 15:
            qt_boost_base += min(forensic_avg * 0.3, 10)
        qt_boost = round(min(qt_boost_base, 82), 2)
        if qt_boost > final:
            print(f'[analyze] Quantization table forensics: library origin + no Exif '
                  f'→ boosting {final:.1f} → {qt_boost}')
            final = qt_boost
            engine3_verdict = 'suspicious'

    # Strategy 4: Camera quantization table protects authentic images
    # If quantization tables match camera-proprietary patterns, dampen false positives
    if qt_origin == 'camera' and has_exif_binary and final > 30:
        old_final = final
        final = min(final, 30)
        if old_final != final:
            print(f'[analyze] Camera quantization table + Exif confirmed '
                  f'→ dampening {old_final:.1f} → {final}')
            engine3_verdict = 'authentic'

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
        'ca': ('Chromatic Aberration', ca_score),
        'exif': ('EXIF Metadata', exif_score),
        'quantization': ('Quantization Table', qt_score),
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
        'caScore': ca_score,
        'caDetails': ca_details,
        'exifScore': exif_data['exifScore'],
        'exifFlags': exif_data['exifFlags'],
        'exifLabel': exif_data['exifLabel'],
        'qtScore': qt_score,
        'qtOrigin': qt_origin,
        'qtDetails': qt_details,
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
            s, _, _ = run_deepfake_model(tmp)
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
