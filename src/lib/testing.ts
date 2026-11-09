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

/** Soruyu seçili modellere sırayla sorar (hız sınırlarına takılmamak için paralel değil). */
export async function autoTestPrompt(
  brand: Brand,
  competitors: Competitor[],
  prompt: Prompt,
  models: ModelId[]
): Promise<AutoRunResult[]> {
  const results: AutoRunResult[] = [];
  for (const model of models) {
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
        source: `api:${res.engine.label}`,
      });
      results.push({
        model,
        success: true,
        engine: res.engine.label,
        mentioned: parsed.mentioned,
        position: parsed.positionScore,
      });
    } catch (e) {
      results.push({ model, success: false, error: (e as Error).message });
    }
  }
  return results;
}
