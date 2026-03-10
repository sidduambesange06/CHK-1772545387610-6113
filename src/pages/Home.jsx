import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Container from '../components/Container'
import { StatCard } from '../components/Card'
import GlassCard from '../components/GlassCard'

export default function Home() {
  const [showSandbox, setShowSandbox] = useState(false)

  const stats = [
    { label: 'Analyses Run', value: '12.4k', trend: '+12%', icon: 'analytics' },
    { label: 'Detection Accuracy', value: '85%', trend: '+0.2%', icon: 'verified' },
    { label: 'Evidence Verified', value: '450GB', trend: '+5%', icon: 'folder_open' },
    { label: 'Avg Processing', value: '< 30s', trend: '+15%', icon: 'speed' }
  ]

  const insights = [
    {
      title: 'Advanced Deepfake Detection',
      description: 'Learn how AI-powered facial analysis identifies synthetic media with precision.',
      image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
      link: '/dashboard',
      gradient: 'from-primary/80 to-slate-900/90'
    },
    {
      title: 'Voice Clone Recognition',
      description: 'Explore cutting-edge audio analysis to detect AI-generated synthetic speech.',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
      link: '/dashboard',
      gradient: 'from-blue-600/80 to-slate-900/90'
    },
    {
      title: 'Real-time Media Verification',
      description: 'Discover how our AI instantly analyzes video authenticity and manipulation.',
      image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80',
      link: '/reports',
      gradient: 'from-indigo-600/80 to-slate-900/90'
    }
  ]

  const sandboxTools = [
    { icon: 'image', title: 'Image Analysis', description: 'Detect manipulations, deepfakes, and metadata tampering in images' },
    { icon: 'videocam', title: 'Video Forensics', description: 'Analyze video authenticity and detect frame-level manipulations' },
    { icon: 'graphic_eq', title: 'Audio Analysis', description: 'Verify audio authenticity and detect voice cloning' },
    { icon: 'description', title: 'Document Verification', description: 'Validate document integrity and detect forgeries' }
  ]

  return (
    <Layout>
      <Container className="py-6 sm:py-8 lg:py-12 mb-16 lg:mb-0">
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12 mb-12 lg:mb-16">
          {/* Left Content */}
          <div className="flex-1 w-full">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 border border-white/30 rounded-full mb-4 sm:mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="text-white text-xs sm:text-sm font-bold uppercase tracking-wider">AI Detection Active</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black mb-4 sm:mb-6 leading-tight">
              DEEPFAKE<br />
              <span className="text-primary">DETECTION</span>
            </h1>
            
            <p className="text-slate-300 text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 leading-relaxed">
              <span className="text-white font-bold">Real-time AI Analysis. </span>
              Detect manipulated media with 85% accuracy using advanced neural networks trained on millions of deepfake samples.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link 
                to="/dashboard" 
                className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-primary text-white rounded-lg sm:rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-primary/25 text-sm sm:text-base"
              >
                <span className="material-symbols-outlined">play_arrow</span>
                Analyze Media
              </Link>
              <button 
                onClick={() => setShowSandbox(true)}
                className="flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 border-2 border-slate-700 text-slate-200 rounded-lg sm:rounded-xl font-bold hover:bg-slate-800/50 hover:border-primary/50 hover:text-white transition-all text-sm sm:text-base"
              >
                Try Demo
              </button>
            </div>
          </div>

          {/* Right Visual */}
          <div className="flex-1 w-full max-w-xl relative">
            <div className="aspect-video bg-gradient-to-br from-primary/20 to-slate-900 rounded-xl sm:rounded-2xl border border-slate-800 relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl sm:text-7xl lg:text-8xl text-primary/40">android_fingerprint</span>
              </div>
              <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 p-3 sm:p-4 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
                <div className="flex justify-between items-center text-xs sm:text-sm font-mono text-slate-200 mb-2">
                  <span>ENCRYPTION: AES-256</span>
                  <span>LATENCY: 14ms</span>
                </div>
                <div className="w-full bg-slate-700/50 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-2/3 animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Floating Notification Cards */}
            <div className="hidden lg:block absolute -right-4 xl:-right-8 top-8 animate-float-slow z-10">
              <div className="bg-red-500/10 backdrop-blur-md border border-red-500/30 rounded-xl p-4 shadow-lg w-[200px]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-red-500 text-xl">warning</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-400 mb-2">False positives</p>
                    <div className="space-y-1.5">
                      <div className="h-1.5 bg-red-500/30 rounded-full w-full"></div>
                      <div className="h-1.5 bg-red-500/30 rounded-full w-3/4"></div>
                      <div className="h-1.5 bg-red-500/30 rounded-full w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block absolute -right-4 xl:-right-8 bottom-20 animate-float-delayed z-10">
              <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/30 rounded-xl p-4 shadow-lg w-[200px]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-400 mb-2">Legitimate matches</p>
                    <div className="space-y-1.5">
                      <div className="h-1.5 bg-emerald-500/30 rounded-full w-full"></div>
                      <div className="h-1.5 bg-emerald-500/30 rounded-full w-4/5"></div>
                      <div className="h-1.5 bg-emerald-500/30 rounded-full w-2/3"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 mb-12 lg:mb-16">
          {stats.map((stat, i) => (
            <StatCard
              key={i}
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
              trend={stat.trend}
              color="primary"
            />
          ))}
        </div>

        {/* Insights Section - Flagright Style Cards */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded-full mb-6">
            <span className="material-symbols-outlined text-white text-sm">psychology</span>
            <span className="text-white text-xs sm:text-sm font-bold uppercase tracking-wider">AI Detection Insights</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4 text-white">
            Advanced techniques in <span className="text-primary">deepfake detection</span>
          </h2>
        </div>

        {/* Glass Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {insights.map((insight, i) => (
            <GlassCard
              key={i}
              title={insight.title}
              description={insight.description}
              image={insight.image}
              link={insight.link}
              gradient={insight.gradient}
              delay={i * 150}
            />
          ))}
        </div>
      </Container>

      {/* Sandbox Modal */}
      {showSandbox && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowSandbox(false)}
        >
          <div 
            className="bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-800 shadow-2xl w-full max-w-4xl p-6 sm:p-8 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black mb-2 text-white">AI Forensics Sandbox</h2>
                <p className="text-slate-300 text-sm sm:text-base">Test and experiment with forensic analysis tools</p>
              </div>
              <button 
                onClick={() => setShowSandbox(false)} 
                className="flex-shrink-0 text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
              >
                <span className="material-symbols-outlined text-2xl sm:text-3xl">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
              {sandboxTools.map((tool, i) => (
                <div 
                  key={i}
                  className="p-4 sm:p-5 lg:p-6 rounded-lg sm:rounded-xl border border-slate-800 bg-slate-950 hover:border-primary hover:bg-slate-900 hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-3xl sm:text-4xl text-primary mb-3 block">{tool.icon}</span>
                  <h3 className="text-base sm:text-lg font-bold mb-2 text-white">{tool.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{tool.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 hover:scale-105 transition-all text-sm sm:text-base shadow-lg shadow-primary/25">
                Start Full Analysis
              </button>
              <button className="flex-1 px-6 py-3 bg-slate-800 text-slate-200 rounded-lg font-bold hover:bg-slate-700 hover:scale-105 transition-all text-sm sm:text-base">
                Load Sample Files
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
