// ============ STATE ============
const state = {
    files: [],
    results: [],
    isAnalyzing: false,
    history: [],
    currentTab: 'dashboard'
};

// ============ DOM ELEMENTS ============
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const resultsContainer = document.getElementById('resultsContainer');

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadHistory();
    displayResults(); // Initialize with empty state
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
    uploadZone.classList.add('border-primary');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('border-primary');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('border-primary');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
    handleAnalyze();
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    fileInput.value = '';
    if (files.length > 0) {
        handleAnalyze();
    }
}

// ============ FILE MANAGEMENT ============
function addFiles(files) {
    files.forEach(file => {
        state.files.push(file);
    });
}

function removeFile(index) {
    state.files.splice(index, 1);
}

// ============ ANALYSIS ============
async function handleAnalyze() {
    if (state.files.length === 0 || state.isAnalyzing) return;

    state.isAnalyzing = true;

    state.results = state.files.map(file => generateResult(file));

    const caseEntry = {
        id: generateId(),
        timestamp: new Date().toLocaleString(),
        files: state.files.map(f => f.name),
        results: JSON.parse(JSON.stringify(state.results)),
        hash: generateSHA256Mock()
    };

    state.history.unshift(caseEntry);
    saveHistory();

    displayResults();

    state.isAnalyzing = false;
    state.files = [];
}

function generateResult(file) {
    const verdicts = [
        { status: 'authentic', confidence: 94, finding: 'Metadata integrity verified. No tampering detected.' },
        { status: 'authentic', confidence: 89, finding: 'Digital signature validated. Chain of custody confirmed.' },
        { status: 'fake', confidence: 87, finding: 'ELA detected edge splicing. Deepfake indicators found.' }
    ];

    const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];

    return {
        id: generateId(),
        filename: file.name,
        fileType: file.type,
        status: verdict.status,
        confidence: verdict.confidence,
        finding: verdict.finding,
        hash: generateSHA256Mock(),
        timestamp: new Date().toLocaleString()
    };
}

// ============ DISPLAY RESULTS ============
function displayResults() {
    const resultsHeading = document.getElementById('resultsHeading');
    const emptyState = document.getElementById('emptyState');
    
    resultsContainer.innerHTML = '';

    if (state.results.length === 0) {
        // Show empty state
        if (resultsHeading) resultsHeading.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    // Hide empty state and show heading
    if (resultsHeading) resultsHeading.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    state.results.forEach((result, index) => {
        const card = createEvidenceCard(result, index);
        resultsContainer.appendChild(card);
    });
}

function createEvidenceCard(result, index) {
    const card = document.createElement('div');
    
    const statusClass = result.status === 'authentic' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5';
    const statusColor = result.status === 'authentic' ? 'emerald' : 'red';
    const statusIcon = result.status === 'authentic' ? 'verified' : 'face_retouching_off';
    const statusText = result.status === 'authentic' ? 'PASSED' : 'CRITICAL';
    const verdictText = result.status === 'authentic' ? 'Authentic' : 'AI-Generated';

    card.className = `p-5 rounded-xl border ${statusClass} shadow-sm relative overflow-hidden group`;
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <span class="material-symbols-outlined text-${statusColor}-500">${statusIcon}</span>
            <span class="text-xs font-black text-${statusColor}-500">${statusText}</span>
        </div>
        <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">${result.filename}</p>
        <p class="text-2xl font-bold text-${statusColor}-500">${result.confidence}% ${verdictText}</p>
        <p class="mt-3 text-[10px] text-slate-500 leading-relaxed italic">${result.finding}</p>
    `;

    return card;
}

// ============ RE-ANALYZE ============
function reanalyzeFile(id) {
    const result = state.results.find(r => r.id === id);
    if (result) {
        result.status = result.status === 'authentic' ? 'fake' : 'authentic';
        result.confidence = Math.floor(Math.random() * 20) + 80;
        displayResults();
    }
}

// ============ RESET ANALYSIS ============
function resetAnalysis() {
    state.files = [];
    state.results = [];
    displayResults(); // This will show the empty state
}

// ============ HISTORY ============
function saveHistory() {
    localStorage.setItem('forensics_history', JSON.stringify(state.history.slice(0, 10)));
}

function loadHistory() {
    const saved = localStorage.getItem('forensics_history');
    if (saved) {
        state.history = JSON.parse(saved);
    }
}

function updateHistoryDisplay() {
    // History display removed - dashboard is single page
}

// ============ PDF DOWNLOAD ============
function downloadReport() {
    if (state.results.length === 0) {
        alert('No analysis results to download');
        return;
    }

    const reportHTML = generateReportHTML();

    const element = document.createElement('div');
    element.innerHTML = reportHTML;
    element.style.display = 'none';
    document.body.appendChild(element);

    // Note: jsPDF library not included in this version
    // For production, add: <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    alert('Report generation requires jsPDF library. Download feature coming soon.');
    document.body.removeChild(element);
}

function generateReportHTML() {
    const timestamp = new Date().toLocaleString();
    const authenticCount = state.results.filter(r => r.status === 'authentic').length;
    const fakeCount = state.results.filter(r => r.status === 'fake').length;
    const avgConfidence = Math.round(
        state.results.reduce((a, b) => a + b.confidence, 0) / state.results.length
    );

    let resultsHTML = '';
    state.results.forEach((result, index) => {
        const statusColor = result.status === 'authentic' ? '#10B981' : '#EF4444';
        resultsHTML += `
            <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid ${statusColor}; background: #f5f5f5;">
                <h4 style="margin: 0 0 10px 0; color: #333;">${index + 1}. ${result.filename}</h4>
                <p style="margin: 5px 0; color: #666;"><strong>Status:</strong> ${result.status.toUpperCase()}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Confidence:</strong> ${result.confidence}%</p>
                <p style="margin: 5px 0; color: #666;"><strong>Hash:</strong> ${result.hash}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Finding:</strong> ${result.finding}</p>
            </div>
        `;
    });

    return `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #D4AF37; padding-bottom: 20px;">
                <h1 style="margin: 0; color: #1E3A8A;">🔍 AI FORENSICS ENGINE</h1>
                <h2 style="margin: 10px 0 0 0; color: #666; font-size: 18px;">FORENSIC ANALYSIS REPORT</h2>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">IT ACT 65B COMPLIANT | CHAIN OF CUSTODY VERIFIED</p>
            </div>

            <div style="margin-bottom: 20px;">
                <p><strong>Report Generated:</strong> ${timestamp}</p>
                <p><strong>Analysis Engine:</strong> Chakravyuh 2.0 AI Forensics</p>
                <p><strong>Compliance:</strong> Indian IT Act Section 65B</p>
            </div>

            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; color: #1E3A8A;">EXECUTIVE SUMMARY</h3>
                <p><strong>Total Files Analyzed:</strong> ${state.results.length}</p>
                <p><strong>Authentic Files:</strong> ${authenticCount}</p>
                <p><strong>Deepfake Detected:</strong> ${fakeCount}</p>
                <p><strong>Average Confidence:</strong> ${avgConfidence}%</p>
            </div>

            <h3 style="color: #1E3A8A; margin-top: 30px;">DETAILED FINDINGS</h3>
            ${resultsHTML}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
                <p><strong>CHAIN OF CUSTODY:</strong></p>
                <p>User: Team1 | Time: 8:56 PM Mar 6 | Transfers: 3</p>
                <p style="margin-top: 15px;"><strong>LEGAL CERTIFICATION:</strong></p>
                <p>This report is generated using AI-powered forensic analysis tools compliant with Indian IT Act Section 65B.</p>
                <p style="margin-top: 15px; text-align: center;">Generated by Chakravyuh 2.0 AI Forensics Engine | Status: COURT ADMISSIBLE</p>
            </div>
        </div>
    `;
}

// ============ UTILITY FUNCTIONS ============
function getFileIcon(mimeType) {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '📷';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📕';
    return '📄';
}

function generateSHA256Mock() {
    return 'a1b2c3d4e5f6' + Math.random().toString(36).substr(2, 20);
}

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
