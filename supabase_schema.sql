-- ============================================
-- ForensicAI - Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- ============================================

-- 1. USERS TABLE
-- Synced from Firebase Auth on login
create table if not exists users (
  uid text primary key,
  email text,
  name text,
  picture text,
  provider text default 'google',
  last_login timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. CASES TABLE
-- Stores all analysis cases with results
create table if not exists cases (
  id text primary key,
  uid text references users(uid) on delete set null,
  filename text not null,
  original_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  media_type text, -- 'image', 'video', 'audio'
  status text default 'uploaded', -- 'uploaded', 'analyzing', 'analyzed', 'error'
  verdict text, -- 'AUTHENTIC', 'SUSPICIOUS', 'MANIPULATED'
  confidence real, -- 0-100 score
  result jsonb, -- full analysis result (without heatmap)
  report_url text,
  case_reference text,
  created_at timestamptz default now(),
  analyzed_at timestamptz
);

-- 3. EVIDENCE CHAIN TABLE
-- Tamper-proof audit trail for legal compliance (IT Act 65B)
create table if not exists evidence_chain (
  id bigint generated always as identity primary key,
  case_id text references cases(id) on delete cascade,
  action text not null, -- 'file_uploaded', 'image_analyzed', 'report_generated'
  actor text default 'system',
  file_hash text, -- SHA-256 of file
  chain_hash text, -- SHA-256 of result
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 4. INDEXES for fast queries
create index if not exists idx_cases_uid on cases(uid);
create index if not exists idx_cases_status on cases(status);
create index if not exists idx_cases_created on cases(created_at desc);
create index if not exists idx_evidence_case on evidence_chain(case_id);

-- 5. ROW LEVEL SECURITY (RLS)
-- Users can only see their own cases
alter table cases enable row level security;
alter table evidence_chain enable row level security;

-- Policy: service role (backend) can do everything
-- These policies allow the service key (used by backend) full access
create policy "Service role full access on cases"
  on cases for all
  using (true)
  with check (true);

create policy "Service role full access on evidence_chain"
  on evidence_chain for all
  using (true)
  with check (true);

create policy "Service role full access on users"
  on users for all
  using (true)
  with check (true);

alter table users enable row level security;

-- 6. STORAGE BUCKETS
-- Run these via Supabase Dashboard > Storage > Create Bucket
-- Bucket: "evidence" (for heatmaps) - Public
-- Bucket: "reports" (for PDFs) - Public
