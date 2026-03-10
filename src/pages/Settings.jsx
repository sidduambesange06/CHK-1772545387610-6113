import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

export default function Settings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({
    autoRedaction: true,
    hashCheck: false,
    verificationModel: 'DeepVerify v2.0 (High Precision)'
  })

  useEffect(() => {
    const saved = localStorage.getItem('forensics_settings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])

  const saveSettings = () => {
    localStorage.setItem('forensics_settings', JSON.stringify(settings))
    alert('Settings saved successfully!')
  }

  const exportPDF = () => {
    alert('Exporting Court-Ready PDF...')
    const history = JSON.parse(localStorage.getItem('forensics_history') || '[]')
    const content = `AI FORENSICS REPORT\n\nTotal Cases: ${history.length}\nGenerated: ${new Date().toLocaleString()}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AI_Forensics_Report_${Date.now()}.txt`
    a.click()
  }

  const exportCSV = () => {
    alert('Exporting CSV Metadata...')
    const history = JSON.parse(localStorage.getItem('forensics_history') || '[]')
    const csv = 'Case ID,Timestamp,Files\n' + history.map(h => `${h.id},${h.timestamp},${h.files?.length || 0}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AI_Forensics_Metadata_${Date.now()}.csv`
    a.click()
  }

  const exportPackage = () => {
    alert('Creating Evidence Package...')
  }

  const handleLogout = () => {
    // Clear login state from localStorage
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('rememberMe')
    localStorage.removeItem('username')
    
    // Redirect to login page
    navigate('/login')
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mb-16 lg:mb-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight truncate">System Settings & Configuration</h2>
          <p className="text-slate-400 text-sm sm:text-base mt-1">Global analysis parameters and security settings</p>
        </div>
        <button 
          onClick={saveSettings} 
          className="flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-primary text-white rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all min-h-[44px] flex-shrink-0"
        >
          <span className="material-symbols-outlined text-lg flex-shrink-0">save</span>
          <span className="whitespace-nowrap">Save Settings</span>
        </button>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Analysis Preferences */}
        <section className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 p-4 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-5 lg:gap-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="material-symbols-outlined text-primary text-xl sm:text-2xl flex-shrink-0">tune</span>
            <h3 className="text-base sm:text-lg font-bold truncate">Analysis Preferences</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-start sm:items-center justify-between gap-3 py-2 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Auto-Redaction</p>
                <p className="text-xs text-slate-500">Automatically blur sensitive PII</p>
              </div>
              <button 
                onClick={() => setSettings({...settings, autoRedaction: !settings.autoRedaction})} 
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors flex-shrink-0 ${settings.autoRedaction ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.autoRedaction ? 'translate-x-5' : 'translate-x-0'}`}></span>
              </button>
            </div>
            <div className="flex items-start sm:items-center justify-between gap-3 py-2 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Hash Consistency Check</p>
                <p className="text-xs text-slate-500">Verify checksums before export</p>
              </div>
              <button 
                onClick={() => setSettings({...settings, hashCheck: !settings.hashCheck})} 
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors flex-shrink-0 ${settings.hashCheck ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.hashCheck ? 'translate-x-5' : 'translate-x-0'}`}></span>
              </button>
            </div>
          </div>
        </section>

        {/* Export Data Options */}
        <section className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 p-4 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-5 lg:gap-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="material-symbols-outlined text-primary text-xl sm:text-2xl flex-shrink-0">data_thresholding</span>
            <h3 className="text-base sm:text-lg font-bold truncate">Export Data</h3>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={exportPDF} 
              className="w-full p-3 sm:p-4 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors flex items-start gap-3 text-left min-h-[60px]"
            >
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-primary flex-shrink-0">file_present</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Court-Ready PDF</p>
                <p className="text-xs text-slate-500 truncate">Full analysis logs with digital signatures</p>
              </div>
              <span className="material-symbols-outlined text-slate-400 flex-shrink-0">chevron_right</span>
            </button>
            <button 
              onClick={exportCSV} 
              className="w-full p-3 sm:p-4 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors flex items-start gap-3 text-left min-h-[60px]"
            >
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-primary flex-shrink-0">csv</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Raw CSV Metadata</p>
                <p className="text-xs text-slate-500 truncate">All evidence attributes for external tools</p>
              </div>
              <span className="material-symbols-outlined text-slate-400 flex-shrink-0">chevron_right</span>
            </button>
            <button 
              onClick={exportPackage} 
              className="w-full p-3 sm:p-4 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors flex items-start gap-3 text-left min-h-[60px]"
            >
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-primary flex-shrink-0">cloud_sync</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Evidence Package (L01)</p>
                <p className="text-xs text-slate-500 truncate">Compressed forensic container</p>
              </div>
              <span className="material-symbols-outlined text-slate-400 flex-shrink-0">chevron_right</span>
            </button>
          </div>
        </section>

        {/* Team Access */}
        <section className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 p-4 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-5 lg:gap-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="material-symbols-outlined text-primary text-xl sm:text-2xl flex-shrink-0">group</span>
              <h3 className="text-base sm:text-lg font-bold truncate">Team Access</h3>
            </div>
            <Link 
              to="/team-members" 
              className="text-primary hover:text-primary/80 font-bold text-xs whitespace-nowrap flex-shrink-0"
            >
              View All
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-2 hover:bg-slate-950 rounded-lg transition-colors min-h-[52px]">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">
                SJ
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Sarah Jenkins</p>
                <p className="text-xs text-slate-500 truncate">Senior Investigator</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 hover:bg-slate-950 rounded-lg transition-colors min-h-[52px]">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">
                MR
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Michael Ross</p>
                <p className="text-xs text-slate-500 truncate">Forensic Analyst</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 hover:bg-slate-950 rounded-lg transition-colors min-h-[52px]">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">
                EV
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">Elena Vasquez</p>
                <p className="text-xs text-slate-500 truncate">Audit Compliance</p>
              </div>
            </div>
          </div>
        </section>

        {/* Account & Security */}
        <section className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 p-4 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-5 lg:gap-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="material-symbols-outlined text-primary text-xl sm:text-2xl flex-shrink-0">security</span>
            <h3 className="text-base sm:text-lg font-bold truncate">Account & Security</h3>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleLogout}
              className="w-full p-3 sm:p-4 rounded-lg border border-red-500/30 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-colors flex items-center gap-3 text-left min-h-[60px]"
            >
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-red-500 flex-shrink-0">logout</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-500 truncate">Logout</p>
                <p className="text-xs text-slate-500 truncate">Sign out of your account</p>
              </div>
              <span className="material-symbols-outlined text-red-400 flex-shrink-0">chevron_right</span>
            </button>
          </div>
        </section>
      </div>
      </div>
    </Layout>
  )
}
