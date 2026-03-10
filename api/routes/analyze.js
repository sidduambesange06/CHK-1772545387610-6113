const express = require('express')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const firebase = require('../config/firebase')

const router = express.Router()

const ML_URL = () => process.env.ML_SERVICE_URL || 'http://localhost:8000'

// resolve file path - handle both absolute and relative paths
function resolvePath(filePath) {
  if (path.isAbsolute(filePath)) return filePath
  // if relative, resolve from api/ folder
  return path.join(__dirname, '..', filePath)
}

async function saveResultToFirebase(fileId, data, extra = {}) {
  if (!firebase.isReady() || !fileId) return
  try {
    await firebase.getDb().collection('cases').doc(fileId).update({
      result: data,
      status: 'analyzed',
      analyzedAt: new Date().toISOString(),
      ...extra
    })
  } catch(e) {
    console.log('[firebase] update failed:', e.message)
  }
}

// forward to python for analysis
router.post('/analyze', async (req, res) => {
  const { filePath, fileId, filename } = req.body
  if (!filePath) return res.status(400).json({ error: 'filePath required' })

  const resolved = resolvePath(filePath)
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'file not found', path: filePath })
  }

  const form = new FormData()
  form.append('file', fs.createReadStream(resolved), filename || path.basename(filePath))
  form.append('fileId', fileId || '')

  try {
    const resp = await axios.post(`${ML_URL()}/analyze`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    await saveResultToFirebase(fileId, resp.data, { mediaType: 'image' })
    res.json(resp.data)
  } catch(e) {
    console.log('[analyze] error:', e.message)
    res.status(500).json({ error: e.response?.data?.detail || e.message })
  }
})

router.post('/analyze-video', async (req, res) => {
  const { filePath, fileId, filename } = req.body
  if (!filePath) return res.status(400).json({ error: 'filePath required' })

  const resolved = resolvePath(filePath)
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'file not found', path: filePath })
  }

  const form = new FormData()
  form.append('file', fs.createReadStream(resolved), filename || path.basename(filePath))
  form.append('fileId', fileId || '')

  try {
    console.log('[analyze-video] sending to python, this takes a while...')
    const resp = await axios.post(`${ML_URL()}/analyze-video`, form, {
      headers: form.getHeaders(),
      timeout: 300000, // 5 min for video
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    await saveResultToFirebase(fileId, resp.data, { mediaType: 'video' })
    res.json(resp.data)
  } catch(e) {
    console.log('[analyze-video] error:', e.message)
    res.status(500).json({ error: e.response?.data?.detail || e.message })
  }
})

router.post('/analyze-audio', async (req, res) => {
  const { filePath, fileId, filename } = req.body
  if (!filePath) return res.status(400).json({ error: 'filePath required' })

  const resolved = resolvePath(filePath)
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'file not found', path: filePath })
  }

  const form = new FormData()
  form.append('file', fs.createReadStream(resolved), filename || path.basename(filePath))
  form.append('fileId', fileId || '')

  try {
    const resp = await axios.post(`${ML_URL()}/analyze-audio`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    await saveResultToFirebase(fileId, resp.data, { mediaType: 'audio' })
    res.json(resp.data)
  } catch(e) {
    console.log('[analyze-audio] error:', e.message)
    res.status(500).json({ error: e.response?.data?.detail || e.message })
  }
})

module.exports = router
