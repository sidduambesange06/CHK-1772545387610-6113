import hashlib
from transformers import pipeline

# cache model globally - loading it every request would kill performance
print('[audio] loading deepfake audio model...')
try:
    _audio_model = pipeline(
        'audio-classification',
        model='motheecreator/Deepfake-audio-detection'
    )
    print('[audio] audio model ready')
except Exception as e:
    _audio_model = None
    print(f'[audio] model failed to load: {e}')


def hash_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def analyze_audio(audio_path):
    if _audio_model is None:
        return {
            'label': 'ERROR',
            'confidence': 0,
            'score': 0,
            'error': 'audio model not loaded',
            'mediaType': 'audio'
        }

    try:
        results = _audio_model(audio_path)

        fake_score = 0
        for r in results:
            lbl = r['label'].lower()
            if 'fake' in lbl or 'spoof' in lbl or 'synthetic' in lbl:
                fake_score = round(r['score'] * 100, 2)
                break

        label = 'MANIPULATED' if fake_score > 50 else 'AUTHENTIC'
        confidence = round(min(abs(fake_score - 50) + 50, 99), 2)
        file_hash = hash_file(audio_path)

        return {
            'label': label,
            'confidence': confidence,
            'score': fake_score,
            'fileHash': file_hash,
            'modelUsed': 'motheecreator/Deepfake-audio-detection',
            'allScores': results,
            'mediaType': 'audio'
        }
    except Exception as e:
        print(f'[audio] inference error: {e}')
        return {
            'label': 'ERROR',
            'confidence': 0,
            'score': 0,
            'error': str(e),
            'mediaType': 'audio'
        }
