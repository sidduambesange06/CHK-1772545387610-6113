const express = require('express')
const axios = require('axios')
const db = require('../config/database')

const router = express.Router()

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

    // upload PDF to Supabase storage
    if (data.reportBase64) {
      pdfUrl = await db.storeReport(data.caseReference, data.reportBase64)

      // add evidence chain entry for report generation
      if (req.body.fileId) {
        await db.addEvidenceEntry({
          caseId: req.body.fileId,
          action: 'report_generated',
          actor: 'system',
          metadata: {
            caseReference: data.caseReference,
            pdfUrl
          }
        })
      }
    }

    res.json({ ...data, pdfUrl })
  } catch (e) {
    console.log('[report] error:', e.message)
    res.status(500).json({ error: e.response?.data?.detail || e.message })
  }
})

module.exports = router
