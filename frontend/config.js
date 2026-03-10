// ═══ DeepScan — Single Config ═══
// Change BACKEND_URL when deploying:
//   Local:    http://localhost:3000
//   Render:   https://your-app.onrender.com
//   Railway:  https://your-app.up.railway.app

// Auto-detect: on Vercel the API is the same origin as the frontend.
// Locally it's port 3000.
const BACKEND = (typeof window !== 'undefined' && window.location.hostname !== 'localhost')
  ? window.location.origin
  : 'http://localhost:3000'
const API = BACKEND + '/api'

// Firebase config (same across all pages)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC1MjFeBxRcEQc7C6hOSWMI9nXaXHyF36A",
  authDomain: "deepfake-pre.firebaseapp.com",
  projectId: "deepfake-pre",
  storageBucket: "deepfake-pre.firebasestorage.app",
  messagingSenderId: "708228223598",
  appId: "1:708228223598:web:8571f78161d2a56a5e0c7f",
  measurementId: "G-9K91ZJXGV6"
}
