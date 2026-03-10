const { createClient } = require('@supabase/supabase-js')

let supabase = null
let ready = false

function init() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    console.log('[supabase] missing SUPABASE_URL or SUPABASE_SERVICE_KEY, running without supabase')
    return
  }

  try {
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    ready = true
    console.log('[supabase] connected to:', url)
  } catch (e) {
    console.log('[supabase] init error:', e.message)
  }
}

function getClient() {
  return ready ? supabase : null
}

function isReady() { return ready }

module.exports = { init, getClient, isReady }
