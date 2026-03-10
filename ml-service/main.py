import os
import hashlib
import time
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from forensics import analyze_image, analyze_video
from audio_forensics import analyze_audio
from llm_handler import generate_summary
from report_gen import generate_pdf
import requests as req_lib

app = FastAPI(title='ForensicAI ML Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*']
)

os.makedirs('temp', exist_ok=True)


def make_chain_hash(file_hash, score):
    raw = f'{file_hash}{score}{int(time.time())}'
    return hashlib.sha256(raw.encode()).hexdigest()


def save_temp(file: UploadFile, file_id: str):
    # sanitize filename
    safe_name = os.path.basename(file.filename or 'upload')
    path = f'temp/{file_id}_{safe_name}'
    return path


@app.get('/health')
def health():
    ollama = False
    try:
        r = req_lib.get('http://localhost:11434/api/tags', timeout=3)
        ollama = r.status_code == 200
    except:
        pass
    return {
        'status': 'ok',
        'ollama': ollama,
        'service': 'forensicai-ml'
    }


# save uploaded file then run all checks
@app.post('/analyze')
async def analyze(file: UploadFile = File(...), fileId: str = Form('')):
    if not file.filename:
        raise HTTPException(status_code=400, detail='no file provided')

    fid = fileId or hashlib.md5(file.filename.encode()).hexdigest()[:8]
    path = save_temp(file, fid)

    try:
        content = await file.read()
        with open(path, 'wb') as f:
            f.write(content)

        result = analyze_image(path)
        result['timestamp'] = time.time()
        result['chainHash'] = make_chain_hash(result['fileHash'], result['score'])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.post('/analyze-video')
async def analyze_vid(file: UploadFile = File(...), fileId: str = Form('')):
    if not file.filename:
        raise HTTPException(status_code=400, detail='no file provided')

    fid = fileId or hashlib.md5(file.filename.encode()).hexdigest()[:8]
    path = save_temp(file, fid)

    try:
        content = await file.read()
        with open(path, 'wb') as f:
            f.write(content)

        result = analyze_video(path)
        result['timestamp'] = time.time()
        result['chainHash'] = make_chain_hash(result['fileHash'], result['score'])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.post('/analyze-audio')
async def analyze_aud(file: UploadFile = File(...), fileId: str = Form('')):
    if not file.filename:
        raise HTTPException(status_code=400, detail='no file provided')

    fid = fileId or hashlib.md5(file.filename.encode()).hexdigest()[:8]
    path = save_temp(file, fid)

    try:
        content = await file.read()
        with open(path, 'wb') as f:
            f.write(content)

        result = analyze_audio(path)
        result['timestamp'] = time.time()
        if 'fileHash' in result and result.get('score') is not None:
            result['chainHash'] = make_chain_hash(result['fileHash'], result['score'])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(path):
            os.remove(path)


@app.post('/generate-report')
async def gen_report(request: Request):
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='invalid json body')

    if not data.get('label'):
        raise HTTPException(status_code=400, detail='analysis result required (must have label field)')

    summary = generate_summary(data)
    pdf_b64, case_ref = generate_pdf(data, summary)

    verdict = data.get('label', 'UNKNOWN')
    if verdict == 'MANIPULATED':
        rec = 'This media shows signs of manipulation. Do not use as evidence without expert verification.'
    else:
        rec = 'No significant manipulation detected. Media appears authentic.'

    return {
        'reportBase64': pdf_b64,
        'caseReference': case_ref,
        'recommendation': rec,
        'llmSummary': summary
    }


if __name__ == '__main__':
    import uvicorn
    print('[main] starting ForensicAI ML service on port 8000')
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
