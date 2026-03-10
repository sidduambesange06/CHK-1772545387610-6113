const express = require('express')
const axios = require('axios')
const firebase = require('../config/firebase')

const router = express.Router()

// save pdf to firebase storage if available
router.post('/report', async (req, res) => {
  if (!req.body || !req.body.label) {
    return res.status(400).json({ error: 'analysis result required in body' })
  }

  try {
    const resp = await axios.post(
      `${process.env.ML_SERVICE_URL}/generate-report`,
      req.body,
      { timeout: 120000 }
    )

    const data = resp.data
    let pdfUrl = null

    // upload to firebase storage and get a public url
    if (firebase.isReady() && data.reportBase64) {
      try {
        const buf = Buffer.from(data.reportBase64, 'base64')
        const bucket = firebase.getBucket()
        const fname = `reports/${data.caseReference}.pdf`
        const fileRef = bucket.file(fname)

        await fileRef.save(buf, {
          contentType: 'application/pdf',
          metadata: { cacheControl: 'public, max-age=3600' }
        })

        // make it publicly readable
        await fileRef.makePublic()
        pdfUrl = `https://storage.googleapis.com/${bucket.name}/${fname}`
        console.log('[firebase] pdf saved:', pdfUrl)

        // also update the case doc if fileId was passed
        if (req.body.fileId && firebase.getDb()) {
          await firebase.getDb().collection('cases').doc(req.body.fileId).update({
            reportUrl: pdfUrl,
            caseReference: data.caseReference,
            status: 'report_generated'
          }).catch(() => {}) // best effort
        }
      } catch(e) {
        console.log('[firebase] pdf upload error:', e.message)
        // still return the report even if storage fails
      }
    }

    res.json({ ...data, pdfUrl })
  } catch(e) {
    console.log('[report] error:', e.message)
    res.status(500).json({ error: e.response?.data?.detail || e.message })
  }
})

module.exports = router
