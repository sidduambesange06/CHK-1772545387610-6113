import os
import io
import hashlib
import base64
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
import piexif
from transformers import pipeline

# load model once at module level - avoids slow first request
print('[forensics] loading deepfake image model...')
try:
    _img_model = pipeline(
        'image-classification',
        model='dima806/deepfake_vs_real_image_detection'
    )
    print('[forensics] image model ready')
except Exception as e:
    _img_model = None
    print(f'[forensics] image model failed to load: {e}')


def perform_ela(image_path):
    img = Image.open(image_path).convert('RGB')
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=90)
    buf.seek(0)
    compressed = Image.open(buf).convert('RGB')
    ela = ImageChops.difference(img, compressed)
    # scale up so differences are visible
    ela = ImageEnhance.Brightness(ela).enhance(10)
    return ela


def get_ela_score(ela_img):
    arr = np.array(ela_img).astype(float)
    return float(np.mean(arr))


def ela_to_base64(ela_img):
    buf = io.BytesIO()
    ela_img.save(buf, 'PNG')
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode()


def check_exif(image_path):
    try:
        exif = piexif.load(image_path)
        flags = []
        score = 0

        # check if edited by known tools
        sw_raw = exif.get('0th', {}).get(piexif.ImageIFD.Software, b'')
        sw = sw_raw.decode('utf-8', errors='ignore').lower() if sw_raw else ''

        for tool in ['photoshop', 'gimp', 'snapseed', 'lightroom', 'facetune', 'meitu']:
            if tool in sw:
                flags.append(f'edited with {tool}')
                score += 40

        # timestamp mismatch = suspicious
        dt_orig = exif.get('Exif', {}).get(piexif.ExifIFD.DateTimeOriginal)
        dt_mod = exif.get('0th', {}).get(piexif.ImageIFD.DateTime)
        if dt_orig and dt_mod and dt_orig != dt_mod:
            flags.append('timestamp mismatch')
            score += 20

        if not exif.get('0th'):
            flags.append('missing exif data')
            score += 15

        label = 'SUSPICIOUS' if score > 20 else 'CLEAN'
        return { 'exifScore': min(score, 100), 'exifFlags': flags, 'exifLabel': label }
    except Exception:
        # cant read exif, not necessarily bad
        return { 'exifScore': 0, 'exifFlags': ['exif unreadable'], 'exifLabel': 'UNKNOWN' }


def run_deepfake_model(image_path):
    if _img_model is None:
        return None
    try:
        results = _img_model(image_path)
        for r in results:
            if 'fake' in r['label'].lower():
                return round(r['score'] * 100, 2)
        # if only real label returned, fake score is low
        return round((1 - results[0]['score']) * 100, 2) if results else None
    except Exception as e:
        print(f'[model] inference error on {image_path}: {e}')
        return None


def hash_file(fpath):
    h = hashlib.sha256()
    with open(fpath, 'rb') as f:
        # read in chunks so big files dont OOM
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def analyze_image(image_path):
    ela_img = perform_ela(image_path)
    ela_raw = get_ela_score(ela_img)
    heatmap = ela_to_base64(ela_img)
    exif_data = check_exif(image_path)
    model_score = run_deepfake_model(image_path)
    file_hash = hash_file(image_path)

    # normalize ELA: mean pixel 0-255 scaled to 0-100
    ela_norm = round(min(ela_raw / 2.55, 100), 2)
    exif_norm = exif_data['exifScore']

    # weighted combo of all signals
    if model_score is not None:
        final = model_score * 0.60 + ela_norm * 0.25 + exif_norm * 0.15
    else:
        # fallback if model unavailable
        final = ela_norm * 0.70 + exif_norm * 0.30

    final = round(final, 2)
    label = 'MANIPULATED' if final > 25 else 'AUTHENTIC'
    # confidence = how far from 50% decision boundary
    confidence = round(min(abs(final - 50) + 50, 99), 2)

    return {
        'label': label,
        'score': final,
        'confidence': confidence,
        'elaScore': ela_norm,
        'modelScore': model_score,
        'exifScore': exif_norm,
        'exifFlags': exif_data['exifFlags'],
        'exifLabel': exif_data['exifLabel'],
        'heatmapBase64': heatmap,
        'fileHash': file_hash,
        'mediaType': 'image'
    }


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

    print(f'[video] {total} frames at {fps:.0f}fps, sampling every {sample_rate} frames')

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % sample_rate == 0:
            tmp = f'temp/frame_{idx}.jpg'
            cv2.imwrite(tmp, frame)
            s = run_deepfake_model(tmp)
            if s is not None:
                scores.append(s)
            # cleanup temp frame
            if os.path.exists(tmp):
                os.remove(tmp)
        idx += 1

    cap.release()
    file_hash = hash_file(video_path)

    if not scores:
        return {
            'label': 'UNKNOWN',
            'score': 0,
            'confidence': 0,
            'framesChecked': 0,
            'framesFlagged': 0,
            'totalFrames': total,
            'fileHash': file_hash,
            'mediaType': 'video'
        }

    avg = round(sum(scores) / len(scores), 2)
    flagged = sum(1 for s in scores if s > 50)
    ratio = flagged / len(scores)
    label = 'MANIPULATED' if ratio > 0.4 else 'AUTHENTIC'
    confidence = round(min(abs(avg - 50) + 50, 99), 2)

    print(f'[video] done: {len(scores)} frames checked, {flagged} flagged, verdict: {label}')

    return {
        'label': label,
        'score': avg,
        'confidence': confidence,
        'framesChecked': len(scores),
        'framesFlagged': flagged,
        'totalFrames': total,
        'fileHash': file_hash,
        'mediaType': 'video'
    }
