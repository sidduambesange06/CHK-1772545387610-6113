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

// serve frontend in production (single deploy — no separate static server needed)
const frontendPath = path.join(__dirname, '..', 'frontend')

// Root always redirects to login — auth guard on each page handles the rest
app.get('/', (req, res) => {
  res.redirect('/login.html')
})

app.use(express.static(frontendPath))

// SPA fallback: unmatched routes go to login (not index.html)
app.get(/^\/(?!api|uploads).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'))
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
