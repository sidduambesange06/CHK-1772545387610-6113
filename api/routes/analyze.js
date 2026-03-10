const express = require('express')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const FormData = require('form-data')
const db = require('../config/database')

const router = express.Router()

const ML_URL = () => process.env.ML_SERVICE_URL || 'http://localhost:8000'

function resolvePath(filePath) {
  if (path.isAbsolute(filePath)) return filePath
  return path.join(__dirname, '..', filePath)
}

// forward to python for image analysis
router.post('/analyze', async (req, res) => {
  const { filePath, fileId, filename } = req.body
  if (!filePath) return res.status(400).json({ error: 'filePath required' })

  const resolved = resolvePath(filePath)
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'file not found', path: filePath })
  }

  // push realtime: analysis started
  db.pushRealtimeStatus(fileId, { status: 'analyzing', progress: 10, engine: 'starting' })

  const form = new FormData()
  form.append('file', fs.createReadStream(resolved), filename || path.basename(filePath))
  form.append('fileId', fileId || '')

  try {
    // push realtime: ML processing
    db.pushRealtimeStatus(fileId, { status: 'analyzing', progress: 30, engine: 'neural_fingerprint' })

    const resp = await axios.post(`${ML_URL()}/analyze`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    // push realtime: saving results
    db.pushRealtimeStatus(fileId, { status: 'analyzing', progress: 90, engine: 'saving' })

    // save to Supabase
    await db.updateCaseResult(fileId, resp.data, 'image')

    // add evidence chain entry
    const resultHash = crypto.createHash('sha256').update(JSON.stringify(resp.data)).digest('hex')
    await db.addEvidenceEntry({
      caseId: fileId,
      action: 'image_analyzed',
      actor: 'system',
      chainHash: resultHash,
      metadata: {
        verdict: resp.data.label,
        score: resp.data.score,
        engines: resp.data.details ? Object.keys(resp.data.details) : []
      }
    })

    res.json(resp.data)
  } catch (e) {
    console.log('[analyze] error:', e.message)
    db.pushRealtimeStatus(fileId, { status: 'error', progress: 0, error: e.message })
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

  db.pushRealtimeStatus(fileId, { status: 'analyzing', progress: 10, engine: 'video_extraction' })

  const form = new FormData()
  form.append('file', fs.createReadStream(resolved), filename || path.basename(filePath))
  form.append('fileId', fileId || '')

  try {
    db.pushRealtimeStatus(fileId, { status: 'analyzing', progress: 20, engine: 'frame_analysis' })

    const resp = await axios.post(`${ML_URL()}/analyze-video`, form, {
      headers: form.getHeaders(),
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    await db.updateCaseResult(fileId, resp.data, 'video')

    const resultHash = crypto.createHash('sha256').update(JSON.stringify(resp.data)).digest('hex')
    await db.addEvidenceEntry({
      caseId: fileId,
      action: 'video_analyzed',
      actor: 'system',
      chainHash: resultHash,
      metadata: {
        verdict: resp.data.label,
        score: resp.data.score,
        framesChecked: resp.data.framesChecked
      }
    })

    res.json(resp.data)
  } catch (e) {
    console.log('[analyze-video] error:', e.message)
    db.pushRealtimeStatus(fileId, { status: 'error', progress: 0, error: e.message })
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

  db.pushRealtimeStatus(fileId, { status: 'analyzing', progress: 10, engine: 'audio_spectral' })

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

    await db.updateCaseResult(fileId, resp.data, 'audio')

    const resultHash = crypto.createHash('sha256').update(JSON.stringify(resp.data)).digest('hex')
    await db.addEvidenceEntry({
      caseId: fileId,
      action: 'audio_analyzed',
      actor: 'system',
      chainHash: resultHash,
      metadata: {
        verdict: resp.data.label,
        score: resp.data.score
      }
    })

    res.json(resp.data)
  } catch (e) {
    console.log('[analyze-audio] error:', e.message)
    db.pushRealtimeStatus(fileId, { status: 'error', progress: 0, error: e.message })
    res.status(500).json({ error: e.response?.data?.detail || e.message })
  }
})

module.exports = router
