"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, X } from "@phosphor-icons/react";
import { Button, Notice } from "@/components/ui";

interface Result {
  allTablesExist: boolean;
  results: { table: string; exists: boolean }[];
  error?: string;
}

export function SetupCheck({ sql }: { sql: string }) {
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/setup-db", { method: "POST" });
      setRes(await r.json());
    } catch {
      setRes({ allTablesExist: false, results: [], error: "Sunucuya ulaşılamadı." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* elle kopyalanabilir */
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] text-ink-3">sql/schema.sql</span>
          <Button size="sm" variant="ghost" icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={copy}>
            {copied ? "Kopyalandı" : "Kopyala"}
          </Button>
        </div>
        <pre className="max-h-[320px] overflow-auto rounded-lg border border-line bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">
          {sql}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={check} loading={loading}>
          Tabloları kontrol et
        </Button>
        {res && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
            {res.results.map((r) => (
              <li key={r.table} className={r.exists ? "text-good" : "text-ink-3"}>
                {r.exists ? <Check size={14} className="mr-1 inline" /> : <X size={14} className="mr-1 inline" />}
                {r.table}
              </li>
            ))}
          </ul>
        )}
      </div>

      {res?.allTablesExist ? (
        <Notice tone="good" title="Tablolar hazır" action={<a href="/" className="font-medium underline underline-offset-[3px]">Uygulamaya geç</a>} />
      ) : (
        res?.error && (
          <Notice tone="warn" title="Supabase cevabı">
            {res.error}
          </Notice>
        )
      )}
    </div>
  );
}
