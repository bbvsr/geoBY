import type { Brand, ModelId, OverviewReport, PromptDetail, PromptRow, Run } from "@/types";
import { db } from "@/lib/db";
import {
  avgPosition,
  brandRows,
  byModel,
  domainTypeBreakdown,
  gaps,
  isBrandedPrompt,
  latestPerPromptModel,
  rankOf,
  sentimentSummary,
  sourceRows,
  visibility,
  visibilityChange,
  visibilityTrend,
} from "@/lib/metrics";
import { buildActions, summarySentence } from "@/lib/actions";

const DAY = 86400000;

function within(runs: Run[], days: number, now: number): Run[] {
  return runs.filter((r) => now - new Date(r.created_at).getTime() <= days * DAY);
}

export async function buildOverview(brand: Brand, days: number, model?: ModelId): Promise<OverviewReport> {
  const store = db();
  const now = Date.now();
  const [competitors, prompts, allRuns, schedule] = await Promise.all([
    store.getCompetitors(brand.id),
    store.getPrompts(brand.id, false),
    store.getRuns({ brandId: brand.id, model }),
    store.getSchedule(brand.id),
  ]);

  const branded = new Set(prompts.filter((p) => isBrandedPrompt(p.text, brand)).map((p) => p.id));
  const allGeneric = allRuns.filter((r) => !branded.has(r.prompt_id));
  const runs = within(allRuns, days, now);
  const generic = within(allGeneric, days, now);

  const brands = brandRows(generic, brand, competitors);
  const change = visibilityChange(allGeneric, days, now);
  const sentiment = sentimentSummary(runs);
  const gapItems = gaps(generic, prompts, competitors);

  const citations = await store.getCitationsForRuns(runs.map((r) => r.id));
  const sources = sourceRows(citations, runs.length, "domain");
  const domainTypes = domainTypeBreakdown(citations);

  return {
    days,
    totals: {
      runs: runs.length,
      genericRuns: generic.length,
      activePrompts: prompts.filter((p) => p.is_active).length,
      testedPrompts: new Set(runs.map((r) => r.prompt_id)).size,
      lastTestAt: allRuns[0]?.created_at ?? null,
    },
    visibility: {
      value: visibility(generic),
      mentioned: generic.filter((r) => r.mentioned).length,
      total: generic.length,
      change,
    },
    rank: { position: rankOf(brands), of: brands.length },
    avgPosition: avgPosition(generic),
    sentiment,
    brands,
    byModel: byModel(generic, brand.selected_models),
    trend: visibilityTrend(within(allGeneric, Math.max(days, 56), now), brand, competitors, Math.min(Math.max(Math.ceil(days / 7), 8), 26)),
    gaps: gapItems,
    sources: sources.slice(0, 8),
    domainTypes,
    actions: buildActions({ brand, brands, sources, domainTypes, gaps: gapItems, sentiment, genericRuns: generic.length }),
    summary: summarySentence({ brand, brands, genericRuns: generic.length, change }),
    schedule,
  };
}

export async function buildPromptRows(brand: Brand, days: number, model?: ModelId): Promise<PromptRow[]> {
  const store = db();
  const [prompts, allRuns] = await Promise.all([
    store.getPrompts(brand.id, false),
    store.getRuns({ brandId: brand.id, model }),
  ]);
  const runs = within(allRuns, days, Date.now());

  const byPrompt = new Map<string, Run[]>();
  for (const r of runs) {
    const list = byPrompt.get(r.prompt_id) ?? [];
    list.push(r);
    byPrompt.set(r.prompt_id, list);
  }
  const lastAny = new Map<string, string>();
  for (const r of allRuns) if (!lastAny.has(r.prompt_id)) lastAny.set(r.prompt_id, r.created_at);

  return prompts.map((p) => {
    const pr = byPrompt.get(p.id) ?? [];
    const cells: PromptRow["cells"] = {};
    for (const r of latestPerPromptModel(pr)) {
      cells[r.model] = {
        runId: r.id,
        mentioned: r.mentioned,
        position: r.position_score,
        sentiment: r.sentiment,
        date: r.created_at,
      };
    }
    return {
      ...p,
      branded: isBrandedPrompt(p.text, brand),
      cells,
      visibility: pr.length ? visibility(pr) : null,
      totalRuns: pr.length,
      lastRunAt: lastAny.get(p.id) ?? null,
    };
  });
}

export async function buildPromptDetail(brand: Brand, promptId: string): Promise<PromptDetail | null> {
  const store = db();
  const prompt = await store.getPromptById(promptId);
  if (!prompt || prompt.brand_id !== brand.id) return null;
  const runs = await store.getRunsForPrompt(promptId);
  const citations = await store.getCitationsForRuns(runs.map((r) => r.id));
  return {
    prompt,
    branded: isBrandedPrompt(prompt.text, brand),
    runs: runs.map((r) => ({
      ...r,
      citations: citations
        .filter((c) => c.run_id === r.id)
        .map((c) => ({ domain: c.domain, url: c.url, domain_type: c.domain_type })),
    })),
  };
}
