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
  apiKey: "AIzaSyAC6cbdzYeHAGj23m3Qu_XEh_xBG4ttpKM",
  authDomain: "backend-final-49947.firebaseapp.com",
  projectId: "backend-final-49947",
  storageBucket: "backend-final-49947.firebasestorage.app",
  messagingSenderId: "812790025085",
  appId: "1:812790025085:web:cb6cb6b6b75ec66d319a14"
}
