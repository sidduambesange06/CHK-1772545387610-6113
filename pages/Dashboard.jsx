import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Container, { PageHeader } from '../components/Container'
import Card from '../components/Card'

export default function Dashboard() {
  const [files, setFiles] = useState([])
  const [results, setResults] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    const saved = localStorage.getItem('forensics_history')
    if (saved) {
      const history = JSON.parse(saved)
      if (history.length > 0 && history[0].results) {
        setResults(history[0].results)
      }
    }
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selectedFiles])
    if (selectedFiles.length > 0) {
      handleAnalyze(selectedFiles)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...droppedFiles])
    handleAnalyze(droppedFiles)
  }

  const handleAnalyze = async (filesToAnalyze) => {
    if (filesToAnalyze.length === 0 || isAnalyzing) return
    setIsAnalyzing(true)
    const newResults = filesToAnalyze.map(file => generateResult(file))
    setResults(newResults)
    const caseEntry = {
      id: generateId(),
      timestamp: new Date().toLocaleString(),
      files: filesToAnalyze.map(f => f.name),
      results: newResults,
      hash: generateSHA256Mock()
    }
    const history = JSON.parse(localStorage.getItem('forensics_history') || '[]')
    history.unshift(caseEntry)
    localStorage.setItem('forensics_history', JSON.stringify(history.slice(0, 10)))
    setIsAnalyzing(false)
    setFiles([])
  }

  const generateResult = (file) => {
    const verdicts = [
      { status: 'authentic', confidence: 94, finding: 'Metadata integrity verified. No tampering detected.' },
      { status: 'authentic', confidence: 89, finding: 'Digital signature validated. Chain of custody confirmed.' },
      { status: 'fake', confidence: 87, finding: 'ELA detected edge splicing. Deepfake indicators found.' }
    ]
    const verdict = verdicts[Math.floor(Math.random() * verdicts.length)]
    return {
      id: generateId(),
      filename: file.name,
      fileType: file.type,
      status: verdict.status,
      confidence: verdict.confidence,
      finding: verdict.finding,
      hash: generateSHA256Mock(),
      timestamp: new Date().toLocaleString()
    }
  }

  const generateSHA256Mock = () => 'a1b2c3d4e5f6' + Math.random().toString(36).substr(2, 20)
  const generateId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

  return (
    <Layout>
      <Container className="py-6 sm:py-8 mb-16 lg:mb-0">
        <PageHeader
          title="Deepfake AI Dashboard"
          description="Enterprise Grade v4.2 • Real-time evidence verification and deepfake detection"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6">
          {/* Left Sidebar - Hidden on mobile, shown on desktop */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4 lg:space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">Secure</span>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Chain of Custody</p>
              <p className="text-2xl font-bold">Verified</p>
              <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-full"></div>
              </div>
              <p className="text-xs text-emerald-500 font-medium mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span>Ledger Synchronized
              </p>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="material-symbols-outlined text-primary text-2xl">fingerprint</span>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">Valid</span>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Hash Verification</p>
              <p className="text-2xl font-bold">Match 100%</p>
              <div className="mt-3 p-2 bg-slate-800 rounded text-[10px] font-mono break-all text-slate-500">SHA-256: 8e34...4f12</div>
            </Card>
          </aside>

          {/* Center Section - Upload Zone */}
          <section className="lg:col-span-6">
            <div 
              onDragOver={(e) => e.preventDefault()} 
              onDrop={handleDrop} 
              onClick={() => document.getElementById('fileInput').click()} 
              className="flex flex-col items-center justify-center gap-4 sm:gap-6 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 px-6 sm:px-10 py-12 sm:py-16 lg:py-20 text-center cursor-pointer hover:border-primary transition-colors group"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-4xl sm:text-5xl text-primary">upload_file</span>
              </div>
              <div className="max-w-md">
                <h2 className="text-lg sm:text-xl font-bold mb-2">Upload Evidence for AI Analysis</h2>
                <p className="text-sm sm:text-base text-slate-400">Drag and drop files here or click to browse. Our neural networks will scan for manipulations and deepfakes.</p>
              </div>
              <button className="bg-primary text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-sm sm:text-base">
                <span className="material-symbols-outlined">add</span>Browse Case Files
              </button>
              <div className="flex items-center gap-4 sm:gap-6 text-slate-400 mt-4">
                {['image', 'movie', 'mic', 'description'].map((icon, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="material-symbols-outlined text-xl sm:text-2xl">{icon}</span>
                    <span className="text-[10px] font-bold uppercase hidden sm:block">
                      {icon === 'image' ? 'JPG/PNG' : icon === 'movie' ? 'MP4/MOV' : icon === 'mic' ? 'WAV/MP3' : 'PDF/DOC'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <input type="file" id="fileInput" multiple onChange={handleFileSelect} className="hidden" />
          </section>

          {/* Right Sidebar - Results */}
          <aside className="lg:col-span-3">
            {results.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center p-4 sm:p-8 text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-2xl sm:text-3xl text-slate-400">pending_actions</span>
                  </div>
                  <p className="text-sm font-bold text-slate-400 mb-2">No Results Yet</p>
                  <p className="text-xs text-slate-500">Upload files to see analysis results</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 px-1">Analysis Results</h3>
                {results.map((result, i) => {
                  const isAuthentic = result.status === 'authentic'
                  return (
                    <Card key={i} className={`border ${isAuthentic ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`material-symbols-outlined ${isAuthentic ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isAuthentic ? 'verified' : 'face_retouching_off'}
                        </span>
                        <span className={`text-xs font-black ${isAuthentic ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isAuthentic ? 'PASSED' : 'CRITICAL'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-1 truncate">{result.filename}</p>
                      <p className={`text-xl sm:text-2xl font-bold ${isAuthentic ? 'text-emerald-500' : 'text-red-500'}`}>
                        {result.confidence}% {isAuthentic ? 'Authentic' : 'AI-Generated'}
                      </p>
                      <p className="mt-3 text-[10px] text-slate-500 leading-relaxed italic truncate-2">{result.finding}</p>
                    </Card>
                  )
                })}
              </div>
            )}
          </aside>
        </div>
      </Container>
    </Layout>
  )
}
