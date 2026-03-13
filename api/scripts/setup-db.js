// Run once: node setup-db.js
// Creates all tables in Supabase PostgreSQL

const { Client } = require('pg')

// Supabase direct connection (pooler mode)
const client = new Client({
  connectionString: 'postgresql://postgres:Siddustar2004@db.rykvjsuptgctcoeyntjz.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

// Fallback: try the session mode connection
const client2 = new Client({
  host: 'aws-0-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.rykvjsuptgctcoeyntjz',
  password: process.env.SUPABASE_DB_PASSWORD || 'Siddustar2004',
  ssl: { rejectUnauthorized: false }
})

const schema = `
-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  picture TEXT,
  provider TEXT DEFAULT 'google',
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CASES TABLE
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  uid TEXT,
  filename TEXT NOT NULL,
  original_name TEXT,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  media_type TEXT,
  status TEXT DEFAULT 'uploaded',
  verdict TEXT,
  confidence REAL,
  result JSONB,
  report_url TEXT,
  case_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);

-- EVIDENCE CHAIN TABLE
CREATE TABLE IF NOT EXISTS evidence_chain (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT DEFAULT 'system',
  file_hash TEXT,
  chain_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_cases_uid ON cases(uid);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence_chain(case_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_chain ENABLE ROW LEVEL SECURITY;

-- Policies (service role bypasses RLS, but these allow it explicitly)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_all_users') THEN
    CREATE POLICY service_all_users ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_all_cases') THEN
    CREATE POLICY service_all_cases ON cases FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_all_evidence') THEN
    CREATE POLICY service_all_evidence ON evidence_chain FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`

async function run() {
  console.log('Connecting to Supabase PostgreSQL...')
  try {
    await client.connect()
    console.log('Connected! Running schema...\n')
    await client.query(schema)
    console.log('✓ All tables created successfully!')

    // verify
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
    console.log('\nTables in database:')
    res.rows.forEach(r => console.log('  -', r.tablename))

    await client.end()
    console.log('\nDone! Your Supabase database is ready.')
  } catch (e) {
    console.error('Connection failed:', e.message)
    console.log('\n⚠ You need to set the correct database password.')
    console.log('Go to: https://supabase.com/dashboard/project/rykvjsuptgctcoeyntjz/settings/database')
    console.log('Find "Database Password" and update this script, or run supabase_schema.sql manually in the SQL Editor.')
    console.log('\nSQL Editor: https://supabase.com/dashboard/project/rykvjsuptgctcoeyntjz/sql/new')
  }
}

run()
