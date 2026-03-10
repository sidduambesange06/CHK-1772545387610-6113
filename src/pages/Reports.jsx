import Layout from '../components/Layout'

export default function Reports() {
  const cases = [
    { id: 'CASE-8821', date: 'Oct 24, 2023 14:22', type: 'Digital Storage', hash: '7a82...f912', progress: 100, status: 'COMPLETED' },
    { id: 'CASE-8819', date: 'Oct 22, 2023 09:15', type: 'Network Logs', hash: '3b12...a011', progress: 45, status: 'IN PROGRESS' },
    { id: 'CASE-8815', date: 'Oct 20, 2023 18:40', type: 'Volatile Memory', hash: '9c21...e452', progress: 10, status: 'ERROR' },
    { id: 'CASE-8812', date: 'Oct 18, 2023 11:05', type: 'Encrypted Disk', hash: '1d44...b299', progress: 100, status: 'COMPLETED' }
  ]

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mb-16 lg:mb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black truncate">Case History & System Settings</h2>
            <p className="text-slate-400 text-sm sm:text-base mt-1">Audit logs, chain of custody records, and global analysis parameters</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-slate-300 rounded-lg font-bold text-sm border border-slate-800 min-h-[44px] flex-shrink-0">
              <span className="material-symbols-outlined text-base sm:text-lg flex-shrink-0">download</span>
              <span className="whitespace-nowrap">Export All</span>
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow-lg shadow-primary/20 min-h-[44px] flex-shrink-0">
              <span className="material-symbols-outlined text-base sm:text-lg flex-shrink-0">add</span>
              <span className="whitespace-nowrap">New Case</span>
            </button>
          </div>
        </div>

        <section className="bg-slate-900 rounded-lg sm:rounded-xl border border-slate-800 overflow-hidden mb-6 sm:mb-8">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900/50">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary flex-shrink-0">timeline</span>
              <span className="truncate">Chain of Custody: Recent Cases</span>
            </h3>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="flex w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
              <span>System Sync Active</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-xs uppercase text-slate-400 border-b border-slate-800">
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-left">Case ID</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-left">Acquisition Date</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-left">Evidence Type</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-left">Analysis Progress</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cases.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <div className="font-bold text-sm">{c.id}</div>
                      <div className="text-xs text-slate-500">Hash: {c.hash}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-400">{c.date}</td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 whitespace-nowrap">{c.type}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden max-w-[120px]">
                          <div 
                            className={`h-full ${c.status === 'ERROR' ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${c.progress}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap ${c.status === 'ERROR' ? 'text-red-500' : c.progress === 100 ? 'text-primary' : 'text-slate-500'}`}>{c.status}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                      <button className="text-primary hover:text-primary/80 font-bold text-xs sm:text-sm min-h-[44px]">Re-analyze</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  )
}
