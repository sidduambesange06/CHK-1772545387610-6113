import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei'
import { motion } from 'framer-motion'
import Layout from '../components/Layout'
import Container from '../components/Container'

// Import 3D Components
import AnimatedCube from '../components/3D/AnimatedCube'
import ParticleField from '../components/3D/ParticleField'
import FloatingText3D from '../components/3D/FloatingText3D'
import DNAHelix from '../components/3D/DNAHelix'
import DataVisualization from '../components/3D/DataVisualization'
import HolographicSphere from '../components/3D/HolographicSphere'

// Loading Component
function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-primary rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}

// Individual 3D Scene Components
function Scene1() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} color="#2563eb" intensity={0.5} />
      <AnimatedCube position={[0, 0, 0]} color="#2563eb" />
      <OrbitControls enablePan={false} />
    </>
  )
}

function Scene2() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <ParticleField count={3000} />
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </>
  )
}

function Scene3() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <FloatingText3D text="PIXIE" position={[0, 0, 0]} />
      <OrbitControls enablePan={false} />
    </>
  )
}

function Scene4() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[0, 5, 0]} color="#10b981" intensity={1} />
      <DNAHelix height={4} radius={0.5} segments={20} />
      <OrbitControls enablePan={false} />
    </>
  )
}

function Scene5() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <DataVisualization data={[0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6, 0.65, 0.85]} />
      <OrbitControls enablePan={false} />
    </>
  )
}

function Scene6() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <HolographicSphere position={[0, 0, 0]} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} />
    </>
  )
}

// Scene Card Component
function SceneCard({ title, description, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden hover:border-primary/50 transition-all"
    >
      <div className="h-64 relative">
        <Canvas dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </Canvas>
        <Suspense fallback={<LoadingSpinner />}>
          <div />
        </Suspense>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
    </motion.div>
  )
}

export default function ThreeDShowcase() {
  return (
    <Layout>
      <Container className="py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/50 rounded-full mb-6">
            <span className="material-symbols-outlined text-primary text-sm">view_in_ar</span>
            <span className="text-white text-xs sm:text-sm font-bold uppercase tracking-wider">3D Showcase</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Three.js <span className="text-primary">3D Components</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-3xl mx-auto">
            Interactive 3D visualizations powered by Three.js, React Three Fiber, and Drei. 
            Drag to rotate, scroll to zoom, and explore each component.
          </p>
        </motion.div>

        {/* 3D Components Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <SceneCard
            title="Animated Cube"
            description="Rotating metallic cube with emissive glow and floating animation"
            delay={0}
          >
            <Scene1 />
          </SceneCard>

          <SceneCard
            title="Particle Field"
            description="3000 particles with additive blending and auto-rotation"
            delay={0.1}
          >
            <Scene2 />
          </SceneCard>

          <SceneCard
            title="3D Text"
            description="Floating 3D text with metallic material and smooth animations"
            delay={0.2}
          >
            <Scene3 />
          </SceneCard>

          <SceneCard
            title="DNA Helix"
            description="Double helix structure with connecting bars and rotation"
            delay={0.3}
          >
            <Scene4 />
          </SceneCard>

          <SceneCard
            title="Data Visualization"
            description="3D bar chart with color-coded values and smooth transitions"
            delay={0.4}
          >
            <Scene5 />
          </SceneCard>

          <SceneCard
            title="Holographic Sphere"
            description="Distorted sphere with holographic material and transparency"
            delay={0.5}
          >
            <Scene6 />
          </SceneCard>
        </div>

        {/* Tech Stack Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">code</span>
            Tech Stack
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-bold text-primary mb-3">Core Libraries</h3>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Three.js 0.169.0
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  React Three Fiber 8.18.0
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  Drei 9.122.0
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold text-primary mb-3">Features</h3>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  OrbitControls
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Custom Materials
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Animations
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold text-primary mb-3">Capabilities</h3>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  3D Models (GLB/GLTF)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Particle Systems
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Custom Shaders
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </Container>
    </Layout>
  )
}
