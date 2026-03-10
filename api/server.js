require('dotenv').config()
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const path = require('path')
const firebase = require('./config/firebase')

const app = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

// serve uploaded files statically so frontend can preview them
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

firebase.init()

app.use('/api', require('./routes/upload'))
app.use('/api', require('./routes/analyze'))
app.use('/api', require('./routes/report'))
app.use('/api', require('./routes/auth'))

// check if python service is up
app.get('/api/health', async (req, res) => {
  let mlStatus = 'down'
  let mlDetails = {}

  try {
    const r = await axios.get(`${process.env.ML_SERVICE_URL}/health`, { timeout: 3000 })
    mlStatus = 'up'
    mlDetails = r.data
  } catch(e) {
    mlStatus = 'down'
  }

  res.json({
    status: 'running',
    ml: mlStatus === 'up',
    mlDetails,
    firebase: firebase.isReady(),
    time: new Date().toISOString(),
    version: '1.0.0'
  })
})

// catch unhandled errors so server doesnt crash
app.use((err, req, res, next) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: err.message || 'something went wrong' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`[server] running on port ${PORT}`)
  console.log(`[server] ml service -> ${process.env.ML_SERVICE_URL}`)
})
