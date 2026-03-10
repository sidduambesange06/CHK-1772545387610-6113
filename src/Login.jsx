import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const threeRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const particlesRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  // Three.js Background Animation
  useEffect(() => {
    if (!threeRef.current) return

    const container = threeRef.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 50

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x0f172a, 1)
    container.appendChild(renderer.domElement)

    // Create particles
    const particleCount = 150
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities = []

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 150
      positions[i + 1] = (Math.random() - 0.5) * 150
      positions[i + 2] = (Math.random() - 0.5) * 100

      velocities.push({
        x: (Math.random() - 0.5) * 0.05,
        y: (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.05
      })
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      color: 0x2563EB,
      size: 2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    })

    const particles = new THREE.Points(geometry, material)
    particles.userData.velocities = velocities
    scene.add(particles)

    sceneRef.current = scene
    rendererRef.current = renderer
    particlesRef.current = particles

    // Mouse interaction
    const handleMouseMove = (event) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    document.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)

      // Update particles
      const positions = particles.geometry.attributes.position.array
      const velocities = particles.userData.velocities

      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += velocities[i / 3].x
        positions[i + 1] += velocities[i / 3].y
        positions[i + 2] += velocities[i / 3].z

        if (Math.abs(positions[i]) > 75) velocities[i / 3].x *= -1
        if (Math.abs(positions[i + 1]) > 75) velocities[i / 3].y *= -1
        if (Math.abs(positions[i + 2]) > 50) velocities[i / 3].z *= -1
      }

      particles.geometry.attributes.position.needsUpdate = true

      // Rotate based on mouse
      particles.rotation.y += (mouseRef.current.x * 0.5 - particles.rotation.y) * 0.05
      particles.rotation.x += (mouseRef.current.y * 0.5 - particles.rotation.x) * 0.05

      // Auto rotation
      particles.rotation.y += 0.001

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    // Store login state in localStorage
    localStorage.setItem('isLoggedIn', 'true')
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true')
      localStorage.setItem('email', email)
    }

    // Simulate API call
    setTimeout(() => {
      navigate('/')
    }, 1500)
  }

  const togglePassword = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div className="min-h-screen bg-background-dark font-display text-slate-100 overflow-hidden">
      {/* Three.js Background */}
      <div ref={threeRef} className="fixed inset-0 z-0"></div>

      {/* Login Container */}
      <div className="login-container min-h-screen flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:block fade-in">
            <div className="float-animation">
              <div className="flex items-center gap-3 mb-8">
                <span className="material-symbols-outlined text-5xl text-primary">fingerprint</span>
                <h1 className="text-4xl font-black text-white">Deepfake AI</h1>
              </div>
              <h2 className="text-5xl font-black text-white mb-6 leading-tight">
                Secure Evidence<br/>
                <span className="text-primary">Verification</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                Advanced AI-powered forensic analysis platform trusted by experts worldwide. 
                Detect deepfakes, verify authenticity, and ensure evidence integrity.
              </p>

              {/* Features */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-xl">verified</span>
                  </div>
                  <div>
                    <p className="text-white font-bold">85% Accuracy</p>
                    <p className="text-slate-400 text-sm">Industry-leading detection rates</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-500 text-xl">speed</span>
                  </div>
                  <div>
                    <p className="text-white font-bold">Lightning Fast</p>
                    <p className="text-slate-400 text-sm">Results in under 30 seconds</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-500 text-xl">security</span>
                  </div>
                  <div>
                    <p className="text-white font-bold">Bank-Grade Security</p>
                    <p className="text-slate-400 text-sm">AES-256 encryption standard</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full max-w-md mx-auto fade-in fade-in-delay-1">
            <div className="glass-card rounded-3xl p-8 lg:p-10 shadow-2xl">
              {/* Mobile Logo */}
              <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
                <span className="material-symbols-outlined text-3xl text-primary">fingerprint</span>
                <h1 className="text-2xl font-black text-white">Deepfake AI</h1>
              </div>

              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Welcome Back</h2>
                <p className="text-slate-400">Sign in to access your forensic dashboard</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div className="fade-in fade-in-delay-2">
                  <label htmlFor="email" className="block text-sm font-bold text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      mail
                    </span>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary input-glow transition-all"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="fade-in fade-in-delay-2">
                  <label htmlFor="password" className="block text-sm font-bold text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      lock
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-12 pr-12 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-primary input-glow transition-all"
                    />
                    <button
                      type="button"
                      onClick={togglePassword}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between fade-in fade-in-delay-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900/50 text-primary focus:ring-primary focus:ring-offset-0"
                    />
                    <span className="text-sm text-slate-400">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors">
                    Forgot password?
                  </a>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/25 fade-in fade-in-delay-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                {/* Divider */}
                <div className="relative fade-in fade-in-delay-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-slate-900/50 text-slate-400">Or continue with</span>
                  </div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-4 fade-in fade-in-delay-3">
                  <button
                    type="button"
                    onClick={() => alert('Google login - Coming soon')}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => alert('Microsoft login - Coming soon')}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#f25022" d="M1 1h10v10H1z"/>
                      <path fill="#00a4ef" d="M13 1h10v10H13z"/>
                      <path fill="#7fba00" d="M1 13h10v10H1z"/>
                      <path fill="#ffb900" d="M13 13h10v10H13z"/>
                    </svg>
                    Microsoft
                  </button>
                </div>
              </form>

              {/* Sign Up Link */}
              <div className="mt-8 text-center text-sm text-slate-400 fade-in fade-in-delay-3">
                Don't have an account?{' '}
                <a href="#" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  Sign up for free
                </a>
              </div>
            </div>

            {/* Back to Home */}
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span className="text-sm font-semibold">Back to Home</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
