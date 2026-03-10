const express = require('express')
const firebase = require('../config/firebase')
const db = require('../config/database')

const router = express.Router()

// Firebase Auth: verify token + store/update user in Supabase
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

    const userData = {
      uid: decoded.uid,
      name: decoded.name || decoded.email?.split('@')[0] || 'User',
      email: decoded.email,
      picture: decoded.picture || null,
      provider: decoded.firebase?.sign_in_provider || 'unknown'
    }

    // store/update user in Supabase (persistent profile)
    await db.upsertUser(userData)

    res.json({ ...userData, verified: true })
  } catch (e) {
    console.log('[auth] token verify failed:', e.message)
    res.status(401).json({ error: 'invalid or expired token' })
  }
})

// get user's past cases from Supabase
router.get('/cases', async (req, res) => {
  const { uid, limit = 20 } = req.query

  if (!uid) return res.json({ cases: [], total: 0 })

  try {
    const cases = await db.getCases(uid, parseInt(limit))
    // if no cases for this uid, try fetching anonymous cases too
    if ((!cases || cases.length === 0) && uid !== 'anonymous') {
      const anonCases = await db.getCases('anonymous', parseInt(limit))
      return res.json({ cases: anonCases || [], total: (anonCases || []).length })
    }
    res.json({ cases: cases || [], total: (cases || []).length })
  } catch (e) {
    console.log('[cases] query error:', e.message)
    res.json({ cases: [], total: 0 })
  }
})

// save user settings
router.post('/settings', async (req, res) => {
  const { uid, settings } = req.body
  if (!uid || !settings) return res.status(400).json({ error: 'uid and settings required' })

  try {
    await db.saveSettings(uid, settings)
    res.json({ success: true })
  } catch (e) {
    console.log('[settings] save error:', e.message)
    res.json({ success: false, error: e.message })
  }
})

// get single case with full details
router.get('/cases/:caseId', async (req, res) => {
  const { caseId } = req.params

  try {
    const caseData = await db.getCase(caseId)
    if (!caseData) return res.status(404).json({ error: 'case not found' })
    res.json(caseData)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// get evidence chain for a case (tamper-proof audit trail)
router.get('/cases/:caseId/evidence', async (req, res) => {
  const { caseId } = req.params

  try {
    const chain = await db.getEvidenceChain(caseId)
    res.json({ chain, total: chain.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
