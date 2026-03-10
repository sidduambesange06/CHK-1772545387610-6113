const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const firebase = require('../config/firebase')

const router = express.Router()

// make sure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, uuidv4() + ext)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50mb
  fileFilter: (req, file, cb) => {
    // allow images, video, audio
    const allowed = /jpeg|jpg|png|gif|webp|mp4|avi|mov|mkv|mp3|wav|ogg|flac/
    const ext = path.extname(file.originalname).toLowerCase().slice(1)
    if (allowed.test(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`file type .${ext} not supported`))
    }
  }
})

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })

  const fileId = uuidv4()
  const { filename } = req.file
  // return normalized path with forward slashes so it works cross platform
  const filePath = `uploads/${filename}`

  // save to firebase if its connected
  if (firebase.isReady()) {
    try {
      const db = firebase.getDb()
      await db.collection('cases').doc(fileId).set({
        uid: req.body.uid || 'anonymous',
        fileId,
        filename,
        filePath,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded',
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      })
      console.log('[firebase] case created:', fileId)
    } catch(e) {
      console.log('[firebase] save failed:', e.message)
      // dont crash - firebase is optional
    }
  }

  res.json({
    fileId,
    filename,
    path: filePath,
    originalName: req.file.originalname,
    size: req.file.size,
    status: 'uploaded'
  })
})

// multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'file too large (max 50mb)' })
  }
  res.status(400).json({ error: err.message })
})

module.exports = router
