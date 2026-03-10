const admin = require('firebase-admin')
const path = require('path')

let initialized = false
let ready = false

function init() {
  // dont init twice
  if (initialized) return
  initialized = true

  try {
    const keyPath = path.join(__dirname, 'serviceAccountKey.json')
    const sa = require(keyPath)

    admin.initializeApp({
      credential: admin.credential.cert(sa),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    })

    ready = true
    console.log('[firebase] connected to project:', sa.project_id)
  } catch(e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log('[firebase] no serviceAccountKey.json found, running without firebase')
    } else {
      console.log('[firebase] init error:', e.message)
    }
  }
}

function getDb() {
  if (!ready) return null
  return admin.firestore()
}

function getBucket() {
  if (!ready) return null
  return admin.storage().bucket()
}

function getAuth() {
  if (!ready) return null
  return admin.auth()
}

function isReady() { return ready }

module.exports = { init, getDb, getBucket, getAuth, isReady }
