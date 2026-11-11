import { randomUUID } from "crypto";
import type { Brand, Competitor, ModelId, ParsedResponse, Prompt, Run } from "@/types";
import { db } from "@/lib/db";
import { parseResponse } from "@/lib/parser";
import { runModel } from "@/lib/ai/engines";

/** Bir cevabı analiz edip test kaydı (run + kaynaklar) olarak saklar. */
export async function saveTestResult(args: {
  brand: Brand;
  competitors: Competitor[];
  prompt: Prompt;
  model: ModelId;
  queryText: string;
  response: string;
  extraCitations?: string[];
  source: string;
  batchId?: string;
}): Promise<{ run: Run; parsed: ParsedResponse }> {
  const parsed = parseResponse({
    response: args.response,
    brandName: args.brand.name,
    brandDomain: args.brand.domain,
    competitors: args.competitors,
    extraCitations: args.extraCitations,
  });

  const store = db();
  const run = await store.createRun({
    prompt_id: args.prompt.id,
    model: args.model,
    response: args.response,
    query_text: args.queryText || args.prompt.text,
    mentioned: parsed.mentioned,
    mention_count: parsed.mentionCount,
    position_score: parsed.positionScore,
    sentiment: parsed.sentiment,
    competitor_mentions: parsed.competitorMentions,
    source: args.source,
    batch_id: args.batchId ?? null,
  });
  await store.createCitations(
    run.id,
    parsed.citations.map((c) => ({ domain: c.domain, url: c.url, domain_type: c.domainType }))
  );
  return { run, parsed };
}

export interface AutoRunResult {
  model: ModelId;
  success: boolean;
  engine?: string;
  mentioned?: boolean;
  position?: number | null;
  error?: string;
}

/** Markanın tekrar ayarı (1, 3 veya 5). */
export function samplesOf(brand: Brand): number {
  return [1, 3, 5].includes(brand.samples ?? 1) ? (brand.samples ?? 1) : 1;
}

/**
 * Soruyu seçili asistanlara sırayla sorar (hız sınırlarına takılmamak için paralel değil).
 * Tekrar ayarı 3 ise her asistana 3 kez sorulur; bir denemede hata alınırsa o asistanın
 * kalan denemeleri atlanır (kota dolmuşsa boşuna istek atılmaz).
 */
export async function autoTestPrompt(
  brand: Brand,
  competitors: Competitor[],
  prompt: Prompt,
  models: ModelId[],
  samples = samplesOf(brand)
): Promise<AutoRunResult[]> {
  const results: AutoRunResult[] = [];
  for (const model of models) {
    const batchId = randomUUID();
    for (let i = 0; i < samples; i++) {
      try {
        const res = await runModel(model, prompt.text);
        const { parsed } = await saveTestResult({
          brand,
          competitors,
          prompt,
          model,
          queryText: prompt.text,
          response: res.text,
          extraCitations: res.citations,
          source: `api:${res.via}`,
          batchId,
        });
        results.push({ model, success: true, engine: res.via, mentioned: parsed.mentioned, position: parsed.positionScore });
      } catch (e) {
        results.push({ model, success: false, error: (e as Error).message });
        break;
      }
    }
  }
  return results;
}

/**
 * Marka adı/alan adı veya rakip listesi değişince kayıtlı tüm cevapları yeniden
 * analiz eder. Cevap metinleri saklandığı için ağ çağrısı gerekmez. Asistanın
 * verdiği kaynak bağlantıları (metinde geçmeyenler dahil) korunur.
 */
export async function reanalyzeBrand(brand: Brand): Promise<number> {
  const store = db();
  const [competitors, runs] = await Promise.all([store.getCompetitors(brand.id), store.getRuns({ brandId: brand.id })]);
  if (runs.length === 0) return 0;
  const citations = await store.getCitationsForRuns(runs.map((r) => r.id));
  const urlsByRun = new Map<string, string[]>();
  for (const c of citations) {
    const list = urlsByRun.get(c.run_id) ?? [];
    list.push(c.url || `https://${c.domain}`);
    urlsByRun.set(c.run_id, list);
  }

  for (const run of runs) {
    const parsed = parseResponse({
      response: run.response ?? "",
      brandName: brand.name,
      brandDomain: brand.domain,
      competitors,
      extraCitations: urlsByRun.get(run.id) ?? [],
    });
    await store.updateRunAnalysis(run.id, {
      mentioned: parsed.mentioned,
      mention_count: parsed.mentionCount,
      position_score: parsed.positionScore,
      sentiment: parsed.sentiment,
      competitor_mentions: parsed.competitorMentions,
    });
    await store.replaceCitations(
      run.id,
      parsed.citations.map((c) => ({ domain: c.domain, url: c.url, domain_type: c.domainType }))
    );
  }
  return runs.length;
}
