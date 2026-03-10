const express = require('express')
const firebase = require('../config/firebase')

const router = express.Router()

router.post('/verify-token', async (req, res) => {
  const { idToken } = req.body

  if (!idToken) return res.status(400).json({ error: 'idToken required' })

  // if firebase not set up return guest user so frontend still works
  if (!firebase.isReady()) {
    return res.json({ uid: 'anonymous', name: 'Guest', email: null, verified: false })
  }

  try {
    const auth = firebase.getAuth()
    const decoded = await auth.verifyIdToken(idToken)
    res.json({
      uid: decoded.uid,
      name: decoded.name || decoded.email?.split('@')[0] || 'User',
      email: decoded.email,
      picture: decoded.picture || null,
      verified: true
    })
  } catch(e) {
    console.log('[auth] token verify failed:', e.message)
    res.status(401).json({ error: 'invalid or expired token' })
  }
})

// get users past cases
router.get('/cases', async (req, res) => {
  const { uid, limit = 20 } = req.query

  if (!uid) return res.json({ cases: [], total: 0 })
  if (!firebase.isReady()) return res.json({ cases: [], total: 0 })

  try {
    const db = firebase.getDb()
    const snap = await db.collection('cases')
      .where('uid', '==', uid)
      .orderBy('uploadedAt', 'desc')
      .limit(parseInt(limit))
      .get()

    const cases = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      // dont send full heatmap base64 in list view, too heavy
      result: d.data().result ? {
        ...d.data().result,
        heatmapBase64: d.data().result.heatmapBase64 ? '[available]' : null
      } : null
    }))

    res.json({ cases, total: cases.length })
  } catch(e) {
    console.log('[cases] query error:', e.message)
    res.json({ cases: [], total: 0 })
  }
})

// get single case details with full data
router.get('/cases/:caseId', async (req, res) => {
  const { caseId } = req.params

  if (!firebase.isReady()) return res.status(503).json({ error: 'firebase not available' })

  try {
    const doc = await firebase.getDb().collection('cases').doc(caseId).get()
    if (!doc.exists) return res.status(404).json({ error: 'case not found' })
    res.json({ id: doc.id, ...doc.data() })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
