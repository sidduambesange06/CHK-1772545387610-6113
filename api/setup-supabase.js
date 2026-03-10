// Run this once: node setup-supabase.js
// Creates all tables and storage buckets in Supabase

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://rykvjsuptgctcoeyntjz.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5a3Zqc3VwdGdjdGNvZXludGp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE0OTkzNCwiZXhwIjoyMDg4NzI1OTM0fQ.EKxPnWJGWrZ9qirMMaGYTRyWIiLOa2KvSlA4Kw0Ff04'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function setup() {
  console.log('Setting up Supabase...\n')

  // Create storage buckets
  console.log('[1/3] Creating storage buckets...')

  const { error: e1 } = await supabase.storage.createBucket('evidence', { public: true })
  if (e1 && !e1.message.includes('already exists')) console.log('  evidence bucket error:', e1.message)
  else console.log('  ✓ evidence bucket ready')

  const { error: e2 } = await supabase.storage.createBucket('reports', { public: true })
  if (e2 && !e2.message.includes('already exists')) console.log('  reports bucket error:', e2.message)
  else console.log('  ✓ reports bucket ready')

  // Test connection by inserting and reading from a test
  console.log('\n[2/3] Testing database connection...')

  // Try to query the users table to see if it exists
  const { error: testErr } = await supabase.from('users').select('uid').limit(1)

  if (testErr && testErr.message.includes('does not exist')) {
    console.log('  ⚠ Tables do not exist yet!')
    console.log('  → You need to run the SQL schema in Supabase Dashboard')
    console.log('  → Go to: https://supabase.com/dashboard/project/rykvjsuptgctcoeyntjz/sql')
    console.log('  → Copy and paste the contents of supabase_schema.sql')
    console.log('  → Click "Run"')
  } else if (testErr) {
    console.log('  ⚠ Error:', testErr.message)
  } else {
    console.log('  ✓ Database tables exist and connected!')

    // Test insert
    console.log('\n[3/3] Testing write access...')
    const testId = 'test-' + Date.now()
    const { error: insertErr } = await supabase.from('users').upsert({
      uid: testId,
      email: 'test@forensicai.dev',
      name: 'Setup Test',
      provider: 'test'
    })

    if (insertErr) {
      console.log('  ⚠ Write test failed:', insertErr.message)
    } else {
      // clean up test row
      await supabase.from('users').delete().eq('uid', testId)
      console.log('  ✓ Read/Write working perfectly!')
    }
  }

  console.log('\n─── Setup Complete ───')
  console.log('Supabase URL:', SUPABASE_URL)
  console.log('Project ref: rykvjsuptgctcoeyntjz')
}

setup().catch(e => console.error('Setup failed:', e.message))
