// ============ STATE ============
const state = {
    isAnalyzing: false
};

// ============ DOM ELEMENTS ============
const uploadZone   = document.getElementById('uploadZone');
const fileInput    = document.getElementById('fileInput');
const browseBtn    = document.getElementById('browseBtn');
const resultsContainer = document.getElementById('resultsContainer');

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    showIdle();
});

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
}

// ============ DRAG & DROP ============
function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('border-primary', 'bg-primary/5');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('border-primary', 'bg-primary/5');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('border-primary', 'bg-primary/5');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) analyzeFile(files[0]);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    fileInput.value = '';
    if (files.length > 0) analyzeFile(files[0]);
}

// ============ IDLE STATE ============
function showIdle() {
    const heading   = document.getElementById('resultsHeading');
    const emptyState = document.getElementById('emptyState');
    if (heading)    heading.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    if (resultsContainer) resultsContainer.innerHTML = '';
}

// ============ SHOW STATUS IN RIGHT PANEL ============
function showStatus(icon, title, message, color = 'primary') {
    const heading = document.getElementById('resultsHeading');
    if (heading) heading.style.display = 'none';
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';

    const colorMap = {
        primary: 'text-primary bg-primary/10',
        red:     'text-red-500 bg-red-500/10',
        green:   'text-emerald-500 bg-emerald-500/10',
        amber:   'text-amber-500 bg-amber-500/10'
    };
    resultsContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center gap-4">
            <div class="w-16 h-16 rounded-full ${colorMap[color]} flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">${icon}</span>
            </div>
            <div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300">${title}</p>
                <p class="text-xs text-slate-500 mt-1">${message}</p>
            </div>
        </div>`;
}

// ============ SHOW PROGRESS BAR ============
function showProgress(pct, label) {
    const heading = document.getElementById('resultsHeading');
    if (heading) heading.style.display = 'none';
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';

    resultsContainer.innerHTML = `
        <div class="p-6 flex flex-col gap-4">
            <div class="flex items-center gap-3">
                <div class="animate-spin"><span class="material-symbols-outlined text-primary text-2xl">autorenew</span></div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Analyzing...</p>
            </div>
            <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-500" style="width:${pct}%"></div>
            </div>
            <p class="text-xs text-slate-500">${label}</p>
        </div>`;
}

// ============ CORE ANALYZE FLOW ============
async function analyzeFile(file) {
    if (state.isAnalyzing) return;
    state.isAnalyzing = true;

    // detect type
    const name = file.name.toLowerCase();
    const imgExts = ['jpg','jpeg','png','gif','webp'];
    const vidExts = ['mp4','avi','mov','mkv'];
    const audExts = ['mp3','wav','ogg','flac'];
    const ext = name.split('.').pop();
    const isImage = imgExts.includes(ext);
    const isVideo = vidExts.includes(ext);
    const isAudio = audExts.includes(ext);

    if (!isImage && !isVideo && !isAudio) {
        showStatus('error', 'Unsupported File', 'Please upload an image, video, or audio file.', 'red');
        state.isAnalyzing = false;
        return;
    }

    try {
        // ── STEP 1: Upload ──
        showProgress(15, 'Uploading file to server...');

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const uid  = user.uid || window.currentUser?.uid || 'anonymous';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('uid', uid);

        const uploadRes = await fetch(API + '/upload', {
            method: 'POST',
            body: formData
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(err.error || 'Upload failed (' + uploadRes.status + ')');
        }

        const uploadData = await uploadRes.json();
        const { fileId, filename, path: filePath, originalName, fileHash } = uploadData;

        // ── STEP 2: Analyze ──
        showProgress(40, isImage ? 'Running neural fingerprint analysis...' : isVideo ? 'Extracting & scanning frames...' : 'Analyzing audio patterns...');

        const endpoint = isImage ? '/analyze' : isVideo ? '/analyze-video' : '/analyze-audio';

        const analyzeRes = await fetch(API + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, fileId, filename })
        });

        if (!analyzeRes.ok) {
            const err = await analyzeRes.json().catch(() => ({}));
            throw new Error(err.error || 'Analysis failed (' + analyzeRes.status + ')');
        }

        showProgress(85, 'Processing results...');

        const result = await analyzeRes.json();

        // attach metadata results.html needs
        result.originalName = originalName || file.name;
        result.fileId       = result.fileId || fileId;
        result.filePath     = filePath;
        result.mediaType    = isImage ? 'image' : isVideo ? 'video' : 'audio';
        if (!result.fileHash) result.fileHash = fileHash;

        showProgress(100, 'Done!');

        // ── STEP 3: Save + redirect to results.html ──
        try {
            sessionStorage.setItem('scanResult', JSON.stringify(result));
        } catch (e) {
            // Storage quota exceeded — strip large X-ray base64 data and retry
            const lite = Object.assign({}, result);
            if (lite.xray) {
                delete lite.xray.noiseMap;
                delete lite.xray.freqMap;
                delete lite.xray.probMap;
            }
            delete lite.heatmapBase64;
            try { sessionStorage.setItem('scanResult', JSON.stringify(lite)); } catch (e2) { /* proceed anyway */ }
        }

        // add to local history
        const history = JSON.parse(localStorage.getItem('forensics_history') || '[]');
        history.unshift({
            id: fileId,
            filename: originalName || file.name,
            timestamp: new Date().toLocaleString(),
            verdict: result.label,
            confidence: result.confidence || result.score || 0,
            type: result.mediaType
        });
        localStorage.setItem('forensics_history', JSON.stringify(history.slice(0, 20)));

        // brief pause so user sees 100%
        setTimeout(() => {
            window.location.href = 'results.html';
        }, 400);

    } catch (err) {
        console.error('[analyze] error:', err);
        showStatus('error', 'Analysis Failed', err.message || 'Something went wrong. Check that all services are running.', 'red');
        state.isAnalyzing = false;
    }
}

// ============ UTILITY ============
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
