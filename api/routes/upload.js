const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const db = require('../config/database')

const router = express.Router()

// On Vercel only /tmp is writable. Locally use api/uploads/
const uploadDir = process.env.VERCEL
  ? '/tmp/forensicai-uploads'
  : path.join(__dirname, '../uploads')
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
  // Use relative path so both analyze.js and frontend URL can use it
  // analyze.js resolvePath() converts relative → absolute when needed
  // Vercel: use absolute /tmp path; Local: use relative uploads/filename
  const filePath = process.env.VERCEL
    ? req.file.path
    : 'uploads/' + filename

  // compute SHA-256 hash of the file for evidence chain
  const fileBuffer = fs.readFileSync(req.file.path)
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

  // save case to Supabase (persistent storage)
  await db.createCase({
    fileId,
    uid: req.body.uid || 'anonymous',
    filename,
    originalName: req.file.originalname,
    filePath,
    size: req.file.size,
    mimetype: req.file.mimetype
  })

  // add evidence chain entry (tamper-proof audit trail)
  await db.addEvidenceEntry({
    caseId: fileId,
    action: 'file_uploaded',
    actor: req.body.uid || 'anonymous',
    fileHash,
    metadata: {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  })

  res.json({
    fileId,
    filename,
    path: filePath,
    originalName: req.file.originalname,
    size: req.file.size,
    fileHash,
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
