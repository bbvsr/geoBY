"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Database, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

const SCHEMA_SQL = `-- GeoBY şema
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
CREATE TABLE IF NOT EXISTS competitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  topic TEXT DEFAULT 'Genel',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
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
CREATE TABLE IF NOT EXISTS citations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  url TEXT,
  domain_type TEXT DEFAULT 'Other',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  last_run_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runs_prompt_id ON runs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_model ON runs(model);
CREATE INDEX IF NOT EXISTS idx_citations_run_id ON citations(run_id);
CREATE INDEX IF NOT EXISTS idx_citations_domain ON citations(domain);
CREATE INDEX IF NOT EXISTS idx_prompts_brand_id ON prompts(brand_id);
CREATE INDEX IF NOT EXISTS idx_competitors_brand_id ON competitors(brand_id);
CREATE INDEX IF NOT EXISTS idx_schedules_brand_id ON schedules(brand_id);
CREATE INDEX IF NOT EXISTS idx_documents_brand_id ON documents(brand_id);`;

interface TableStatus {
  table: string;
  exists: boolean;
}

export default function SetupPage() {
  const [results, setResults] = useState<TableStatus[]>([]);
  const [allExist, setAllExist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function check() {
    setLoading(true);
    try {
      const res = await fetch("/api/setup-db", { method: "POST" });
      const data = await res.json();
      setResults(data.results ?? []);
      setAllExist(data.allTablesExist ?? false);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    check();
  }, []);

  function copySql() {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">GeoBY — Veritabanı Kurulumu</h1>
          <p className="text-[13px] text-muted-foreground">
            Aşağıdaki SQL&apos;i Supabase SQL Editor&apos;e yapıştırıp çalıştırın.
          </p>
        </div>
      </div>

      {/* Tablo durumları */}
      <div className="mb-6 rounded-lg border border-border/40 bg-card/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold">Tablo Durumu</span>
          <Button size="sm" variant="outline" onClick={check} disabled={loading}>
            {loading ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Tabloları Kontrol Et
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            "brands",
            "competitors",
            "prompts",
            "runs",
            "citations",
            "schedules",
            "documents",
          ].map((t) => {
            const r = results.find((x) => x.table === t);
            const ok = r?.exists;
            return (
              <div
                key={t}
                className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-3 py-2 text-[12px]"
              >
                {ok ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <X className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                  {t}
                </span>
              </div>
            );
          })}
        </div>
        {allExist && (
          <div className="mt-4 flex items-center justify-between rounded-md border border-success/20 bg-success/[0.06] px-3 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-success">
              <Check className="h-4 w-4" /> Tüm tablolar hazır.
            </span>
            <a href="/">
              <Button size="sm">Panele Git</Button>
            </a>
          </div>
        )}
      </div>

      {/* SQL bloğu */}
      <div className="rounded-lg border border-border/40 bg-card/60">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            sql/schema.sql
          </span>
          <Button size="sm" variant="ghost" onClick={copySql}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Kopyalandı" : "Kopyala"}
          </Button>
        </div>
        <pre className="max-h-[360px] overflow-auto p-4 text-[11px] leading-relaxed text-muted-foreground">
          {SCHEMA_SQL}
        </pre>
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground/70">
        Supabase panelinizde{" "}
        <span className="text-foreground">SQL Editor</span> bölümünü açın, bu
        SQL&apos;i yapıştırın ve çalıştırın. Ardından &quot;Tabloları Kontrol
        Et&quot;e tıklayın.
      </p>
    </div>
  );
}
