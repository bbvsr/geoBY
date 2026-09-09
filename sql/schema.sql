-- GeoBY — Supabase şema
-- Bu SQL'i Supabase panelinde SQL Editor'e yapıştırıp çalıştırın.

-- ---- brands ----
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  category TEXT,
  description TEXT,
  selected_models TEXT[] DEFAULT ARRAY['openai','claude','gemini','perplexity','google_aio']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- competitors ----
CREATE TABLE IF NOT EXISTS competitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- prompts ----
CREATE TABLE IF NOT EXISTS prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  topic TEXT DEFAULT 'Genel',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- runs ----
CREATE TABLE IF NOT EXISTS runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  response TEXT,
  query_text TEXT,
  mentioned BOOLEAN DEFAULT false,
  mention_count INT DEFAULT 0,
  position_score REAL,
  sentiment TEXT DEFAULT 'neutral',
  competitor_mentions JSONB DEFAULT '{}',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- citations ----
CREATE TABLE IF NOT EXISTS citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  url TEXT,
  domain_type TEXT DEFAULT 'Other',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- schedules (alarm) ----
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  last_run_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- documents (yüklenen belgeler) ----
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- indexler ----
CREATE INDEX IF NOT EXISTS idx_runs_prompt_id ON runs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_model ON runs(model);
CREATE INDEX IF NOT EXISTS idx_citations_run_id ON citations(run_id);
CREATE INDEX IF NOT EXISTS idx_citations_domain ON citations(domain);
CREATE INDEX IF NOT EXISTS idx_prompts_brand_id ON prompts(brand_id);
CREATE INDEX IF NOT EXISTS idx_competitors_brand_id ON competitors(brand_id);
CREATE INDEX IF NOT EXISTS idx_schedules_brand_id ON schedules(brand_id);
CREATE INDEX IF NOT EXISTS idx_documents_brand_id ON documents(brand_id);

-- NOT: MVP tek-marka olduğu için RLS kapalıdır; tüm erişim server-side
-- secret key ile yapılır. İleride auth eklenince RLS policy'leri tanımlanmalı.
