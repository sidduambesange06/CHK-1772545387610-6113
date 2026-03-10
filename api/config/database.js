// Hybrid database layer: Supabase for data, Firebase for realtime
const supabase = require('./supabase')
const firebase = require('./firebase')

// ─── USERS (Supabase) ───
async function upsertUser(userData) {
  const sb = supabase.getClient()
  if (!sb) return null

  const { data, error } = await sb
    .from('users')
    .upsert({
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
      picture: userData.picture || null,
      provider: userData.provider || 'google',
      last_login: new Date().toISOString()
    }, { onConflict: 'uid' })
    .select()
    .single()

  if (error) console.log('[db] upsert user error:', error.message)
  return data
}

// ─── CASES (Supabase for storage, Firebase for realtime status) ───
async function createCase(caseData) {
  const sb = supabase.getClient()
  if (!sb) return null

  const { data, error } = await sb
    .from('cases')
    .insert({
      id: caseData.fileId,
      uid: caseData.uid || 'anonymous',
      filename: caseData.filename,
      original_name: caseData.originalName,
      file_path: caseData.filePath,
      file_size: caseData.size,
      mime_type: caseData.mimetype,
      media_type: caseData.mediaType || null,
      status: 'uploaded',
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) console.log('[db] create case error:', error.message)

  // also push to firebase realtime for live status tracking
  pushRealtimeStatus(caseData.fileId, { status: 'uploaded', progress: 0 })

  return data
}

async function updateCaseResult(fileId, result, mediaType) {
  const sb = supabase.getClient()
  if (!sb) return null

  // strip large base64 data from DB storage (too large for PostgreSQL)
  const resultForDb = { ...result }
  const heatmap = resultForDb.heatmapBase64
  delete resultForDb.heatmapBase64
  delete resultForDb.xray  // forensic x-ray visual maps (sent to frontend only)

  const { data, error } = await sb
    .from('cases')
    .update({
      result: resultForDb,
      media_type: mediaType,
      status: 'analyzed',
      verdict: result.label,
      confidence: result.score,
      analyzed_at: new Date().toISOString()
    })
    .eq('id', fileId)
    .select()
    .single()

  if (error) console.log('[db] update case error:', error.message)

  // store heatmap in supabase storage if available
  if (heatmap) {
    await storeHeatmap(fileId, heatmap)
  }

  // push final status to firebase realtime
  pushRealtimeStatus(fileId, {
    status: 'analyzed',
    progress: 100,
    verdict: result.label,
    score: result.score
  })

  return data
}

async function getCases(uid, limit = 20) {
  const sb = supabase.getClient()
  if (!sb) return []

  const { data, error } = await sb
    .from('cases')
    .select('id, uid, filename, original_name, media_type, status, verdict, confidence, created_at, analyzed_at')
    .eq('uid', uid)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.log('[db] get cases error:', error.message)
    return []
  }
  return data || []
}

async function getCase(caseId) {
  const sb = supabase.getClient()
  if (!sb) return null

  const { data, error } = await sb
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (error) {
    console.log('[db] get case error:', error.message)
    return null
  }
  return data
}

// ─── EVIDENCE CHAIN (Supabase) - tamper-proof audit trail ───
async function addEvidenceEntry(entry) {
  const sb = supabase.getClient()
  if (!sb) return null

  const { data, error } = await sb
    .from('evidence_chain')
    .insert({
      case_id: entry.caseId,
      action: entry.action,
      actor: entry.actor || 'system',
      file_hash: entry.fileHash || null,
      chain_hash: entry.chainHash || null,
      metadata: entry.metadata || {},
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) console.log('[db] evidence chain error:', error.message)
  return data
}

async function getEvidenceChain(caseId) {
  const sb = supabase.getClient()
  if (!sb) return []

  const { data, error } = await sb
    .from('evidence_chain')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) return []
  return data || []
}

// ─── STORAGE (Supabase) ───
async function uploadFile(bucket, filePath, buffer, contentType) {
  const sb = supabase.getClient()
  if (!sb) return null

  const { data, error } = await sb.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      cacheControl: '3600',
      upsert: true
    })

  if (error) {
    console.log('[storage] upload error:', error.message)
    return null
  }

  // get public URL
  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(filePath)
  return urlData?.publicUrl || null
}

async function storeHeatmap(caseId, base64Data) {
  const buffer = Buffer.from(base64Data, 'base64')
  return uploadFile('evidence', `heatmaps/${caseId}.png`, buffer, 'image/png')
}

async function storeReport(caseRef, base64Data) {
  const buffer = Buffer.from(base64Data, 'base64')
  return uploadFile('reports', `${caseRef}.pdf`, buffer, 'application/pdf')
}

// ─── REALTIME (Firebase) - live analysis progress ───
function pushRealtimeStatus(caseId, statusData) {
  if (!firebase.isReady()) return

  try {
    // use firestore for realtime listeners (frontend subscribes to this)
    const db = firebase.getDb()
    db.collection('analysis_live').doc(caseId).set({
      ...statusData,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(e => {
      // realtime is best-effort, don't crash
      console.log('[realtime] firestore write failed:', e.message)
    })
  } catch (e) {
    // realtime is best-effort, don't crash
  }
}

function pushAnalysisProgress(caseId, engine, progress, partialResult = null) {
  if (!firebase.isReady()) return

  try {
    const db = firebase.getDb()
    db.collection('analysis_live').doc(caseId).set({
      [`engine_${engine}`]: {
        progress,
        status: progress >= 100 ? 'done' : 'running',
        result: partialResult
      },
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(e => {
      console.log('[realtime] firestore progress write failed:', e.message)
    })
  } catch (e) {
    // best-effort
  }
}

// ─── SETTINGS (Supabase users table) ───
async function saveSettings(uid, settings) {
  const sb = supabase.getClient()
  if (!sb) return null

  // store settings as JSON in the users table metadata
  const { data, error } = await sb
    .from('users')
    .upsert({
      uid: uid,
      settings: settings,
      last_login: new Date().toISOString()
    }, { onConflict: 'uid' })
    .select()
    .single()

  if (error) console.log('[db] save settings error:', error.message)
  return data
}

module.exports = {
  // users
  upsertUser,
  // cases
  createCase,
  updateCaseResult,
  getCases,
  getCase,
  // evidence
  addEvidenceEntry,
  getEvidenceChain,
  // storage
  uploadFile,
  storeHeatmap,
  storeReport,
  // realtime
  pushRealtimeStatus,
  pushAnalysisProgress,
  // settings
  saveSettings
}
