import hashlib
import numpy as np
from transformers import pipeline

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


def spectral_analysis(audio_path):
    """Spectral analysis for AI-generated audio detection.
    AI audio has unnaturally sharp cutoffs, uniform spectral flatness,
    and missing room acoustics."""
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=None, duration=30)

        if len(y) < sr:
            return 0

        score = 0

        # spectral rolloff consistency
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.95)
        rolloff_std = float(np.std(rolloff))
        rolloff_mean = float(np.mean(rolloff))
        rolloff_cv = rolloff_std / (rolloff_mean + 1e-10)

        if rolloff_cv < 0.05:
            score += 35
        elif rolloff_cv < 0.10:
            score += 20
        elif rolloff_cv < 0.15:
            score += 10

        # spectral flatness (AI audio = more uniform)
        flatness = librosa.feature.spectral_flatness(y=y)
        flatness_mean = float(np.mean(flatness))
        flatness_std = float(np.std(flatness))

        if flatness_mean > 0.3:
            score += 25
        elif flatness_mean > 0.15:
            score += 10

        # flatness consistency (AI = very consistent)
        if flatness_std < 0.05:
            score += 15

        # zero crossing rate consistency
        zcr = librosa.feature.zero_crossing_rate(y)
        zcr_cv = float(np.std(zcr) / (np.mean(zcr) + 1e-10))
        if zcr_cv < 0.2:
            score += 15
        elif zcr_cv < 0.3:
            score += 8

        return min(100, score)

    except Exception as e:
        print(f'[audio-spectral] error: {e}')
        return 0


def analyze_audio(audio_path):
    # run model
    model_score = None
    if _audio_model is not None:
        try:
            results = _audio_model(audio_path)
            for r in results:
                lbl = r['label'].lower()
                if 'fake' in lbl or 'spoof' in lbl or 'synthetic' in lbl:
                    model_score = round(r['score'] * 100, 2)
                    break
            if model_score is None and results:
                model_score = round((1 - results[0]['score']) * 100, 2)
        except Exception as e:
            print(f'[audio] inference error: {e}')

    # run spectral analysis
    spectral_score = spectral_analysis(audio_path)

    file_hash = hash_file(audio_path)

    # combine signals
    if model_score is not None:
        final = model_score * 0.65 + spectral_score * 0.35
        # boost only if both signals agree
        if model_score > 60 and spectral_score > 40:
            final = max(final, (model_score + spectral_score) / 2 * 0.9)
    else:
        final = spectral_score

    final = round(min(100, final), 2)

    # consistent thresholds: 0-40 AUTHENTIC, 40-65 SUSPICIOUS, 65+ MANIPULATED
    # require both signals to agree for MANIPULATED
    both_agree = (model_score is not None and model_score > 60 and spectral_score > 40)
    if final >= 65 and both_agree:
        label = 'MANIPULATED'
        conclusion = 'Both AI model and spectral analysis indicate synthetic audio.'
    elif final >= 40:
        label = 'SUSPICIOUS'
        conclusion = 'Some indicators of synthetic audio detected, but not strongly confirmed.'
    else:
        label = 'AUTHENTIC'
        conclusion = 'Audio analysis shows no significant evidence of manipulation.'

    confidence = round(min(abs(final - 50) + 50, 99), 2)

    reason_lines = []
    if model_score is not None:
        if model_score > 70:
            reason_lines.append(f'AI Model: strong deepfake signal ({model_score}%)')
        elif model_score > 40:
            reason_lines.append(f'AI Model: moderate anomaly ({model_score}%)')
        else:
            reason_lines.append(f'AI Model: within normal range ({model_score}%)')

    if spectral_score > 50:
        reason_lines.append(f'Spectral Analysis: unusual patterns detected ({spectral_score}%)')
    elif spectral_score > 25:
        reason_lines.append(f'Spectral Analysis: minor anomalies ({spectral_score}%)')
    else:
        reason_lines.append(f'Spectral Analysis: within normal range ({spectral_score}%)')

    return {
        'label': label,
        'confidence': confidence,
        'score': final,
        'modelScore': model_score,
        'spectralScore': spectral_score,
        'fileHash': file_hash,
        'modelUsed': 'motheecreator/Deepfake-audio-detection',
        'mediaType': 'audio',
        'explanation': {
            'conclusion': conclusion,
            'reasons': reason_lines,
        },
    }
