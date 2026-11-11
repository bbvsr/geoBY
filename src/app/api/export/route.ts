import { db } from "@/lib/db";
import { requireBrand, route } from "@/lib/http";
import { isBrandedPrompt } from "@/lib/metrics";
import { MODEL_LABELS } from "@/types";

export const dynamic = "force-dynamic";

const SENTIMENT = { positive: "olumlu", neutral: "nötr", negative: "olumsuz" } as const;

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Excel'de formül olarak çalıştırılmasını önle
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Tüm test kayıtlarını Excel'de açılabilen CSV olarak indirir. */
export const GET = route(async () => {
  const brand = await requireBrand();
  const store = db();
  const [prompts, competitors, runs] = await Promise.all([
    store.getPrompts(brand.id, false),
    store.getCompetitors(brand.id),
    store.getRuns({ brandId: brand.id }),
  ]);
  const citations = await store.getCitationsForRuns(runs.map((r) => r.id));
  const byPrompt = new Map(prompts.map((p) => [p.id, p]));
  const citesByRun = new Map<string, string[]>();
  for (const c of citations) citesByRun.set(c.run_id, [...(citesByRun.get(c.run_id) ?? []), c.domain]);

  const header = [
    "tarih",
    "soru",
    "markalı soru",
    "asistan",
    "nasıl ölçüldü",
    `${brand.name} geçiyor`,
    "geçiş sayısı",
    "sıra",
    "ton",
    ...competitors.map((c) => `${c.name} geçiyor`),
    "kaynaklar",
    "cevap",
  ];
  const lines = [header.map(cell).join(";")];
  for (const r of runs) {
    const prompt = byPrompt.get(r.prompt_id);
    lines.push(
      [
        new Date(r.created_at).toLocaleString("tr-TR"),
        prompt?.text ?? r.query_text,
        prompt && isBrandedPrompt(prompt.text, brand) ? "evet" : "hayır",
        MODEL_LABELS[r.model] ?? r.model,
        r.source === "manual" ? "elle yapıştırıldı" : r.source.replace(/^api:/, ""),
        r.mentioned ? "evet" : "hayır",
        r.mention_count,
        r.position_score ?? "",
        r.mentioned ? SENTIMENT[r.sentiment] : "",
        ...competitors.map((c) => ((r.competitor_mentions ?? {})[c.name] ? "evet" : "hayır")),
        [...new Set(citesByRun.get(r.id) ?? [])].join(", "),
        r.response ?? "",
      ]
        .map(cell)
        .join(";")
    );
  }
  const filename = `geoby-${brand.domain.replace(/[^a-z0-9.-]/gi, "")}-${new Date().toISOString().slice(0, 10)}.csv`;
  // BOM: Excel Türkçe karakterleri doğru göstersin
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
