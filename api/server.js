require('dotenv').config()
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const path = require('path')
const firebase = require('./config/firebase')
const supabase = require('./config/supabase')

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

// serve uploaded files statically so frontend can preview them
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// init both services
firebase.init()
supabase.init()

app.use('/api', require('./routes/upload'))
app.use('/api', require('./routes/analyze'))
app.use('/api', require('./routes/report'))
app.use('/api', require('./routes/auth'))

// health check - shows status of all services
app.get('/api/health', async (req, res) => {
  let mlStatus = 'down'
  let mlDetails = {}

  try {
    const r = await axios.get(`${process.env.ML_SERVICE_URL}/health`, { timeout: 6000 })
    mlStatus = 'up'
    mlDetails = r.data
  } catch (e) {
    mlStatus = 'down'
  }

  res.json({
    status: 'running',
    ml: mlStatus === 'up',
    mlDetails,
    firebase: firebase.isReady(),
    supabase: supabase.isReady(),
    time: new Date().toISOString(),
    version: '2.0.0'
  })
})

// real-time platform stats from Supabase
app.get('/api/stats', async (req, res) => {
  const sb = supabase.getClient()
  if (!sb) return res.json({ totalCases: 0, manipulated: 0, authentic: 0, suspicious: 0, avgConfidence: 0, avgProcessing: 0, totalSize: 0 })

  try {
    const { data: cases, error } = await sb
      .from('cases')
      .select('verdict, confidence, file_size, created_at, analyzed_at')

    if (error || !cases) return res.json({ totalCases: 0, manipulated: 0, authentic: 0, suspicious: 0, avgConfidence: 0, avgProcessing: 0, totalSize: 0 })

    const totalCases = cases.length
    const analyzed = cases.filter(c => c.verdict)
    const manipulated = analyzed.filter(c => c.verdict === 'MANIPULATED').length
    const authentic = analyzed.filter(c => c.verdict === 'AUTHENTIC').length
    const suspicious = analyzed.filter(c => c.verdict === 'SUSPICIOUS').length

    const avgConfidence = analyzed.length > 0
      ? Math.round(analyzed.reduce((s, c) => s + (c.confidence || 0), 0) / analyzed.length)
      : 0

    // avg processing time in seconds
    const withTimes = analyzed.filter(c => c.created_at && c.analyzed_at)
    const avgProcessing = withTimes.length > 0
      ? Math.round(withTimes.reduce((s, c) => s + (new Date(c.analyzed_at) - new Date(c.created_at)) / 1000, 0) / withTimes.length)
      : 0

    const totalSize = cases.reduce((s, c) => s + (c.file_size || 0), 0)

    res.json({ totalCases, manipulated, authentic, suspicious, avgConfidence, avgProcessing, totalSize, analyzedCount: analyzed.length })
  } catch (e) {
    res.json({ totalCases: 0, manipulated: 0, authentic: 0, suspicious: 0, avgConfidence: 0, avgProcessing: 0, totalSize: 0 })
  }
})

// serve frontend in production (single deploy — no separate static server needed)
const frontendPath = path.join(__dirname, '..', 'frontend')

// Root goes to index (landing page)
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'))
})

app.use(express.static(frontendPath))

// SPA fallback: unmatched routes go to index
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'))
})

// catch unhandled errors so server doesnt crash
app.use((err, req, res, next) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: err.message || 'something went wrong' })
})

// Local dev: start the server directly
// Vercel: exports app as a serverless function handler
if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`[server] running on port ${PORT}`)
    console.log(`[server] ml service -> ${process.env.ML_SERVICE_URL}`)
    console.log(`[server] firebase: ${firebase.isReady() ? 'connected' : 'offline'}`)
    console.log(`[server] supabase: ${supabase.isReady() ? 'connected' : 'offline'}`)
  })
}

module.exports = app
