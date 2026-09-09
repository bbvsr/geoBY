import { NextRequest, NextResponse } from "next/server";
import {
  getPrimaryBrand,
  getCompetitors,
  getPrompts,
  getRuns,
  getCitationsForRuns,
  getSchedule,
} from "@/lib/supabase-admin";
import {
  rankings,
  visibilityTrend,
  domainSources,
  domainTypeBreakdown,
  overviewMetrics,
  recentChats,
  visibility,
} from "@/lib/metrics";
import { buildActions, keyInsight } from "@/lib/actions";
import type { ModelId } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const brand = await getPrimaryBrand();
  if (!brand) return NextResponse.json({ brand: null });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "7", 10);
  const model = (searchParams.get("model") as ModelId) || undefined;

  const competitors = await getCompetitors(brand.id);
  const prompts = await getPrompts(brand.id, false);

  const runs = await getRuns({ brandId: brand.id, days, model });
  const allRuns = await getRuns({ brandId: brand.id, model });
  const trendRuns = await getRuns({
    brandId: brand.id,
    days: Math.max(days, 56),
    model,
  });

  const citations = await getCitationsForRuns(runs.map((r) => r.id));

  const ranked = rankings(runs, brand, competitors);
  const metrics = overviewMetrics(
    runs,
    allRuns,
    citations,
    ranked,
    brand,
    days
  );
  const trend = visibilityTrend(trendRuns, brand, competitors, 8);
  const sources = domainSources(citations, runs.length);
  const domainTypes = domainTypeBreakdown(citations);
  const actions = buildActions(brand, ranked, sources, domainTypes);
  const chats = recentChats(runs, prompts, citations);

  const compVis = competitors.length
    ? ranked
        .filter((r) => !r.isYou)
        .reduce((s, r) => s + r.visibility, 0) / competitors.length
    : 0;
  const insight = keyInsight(brand, visibility(runs), compVis);

  const schedule = await getSchedule(brand.id);

  return NextResponse.json({
    brand,
    competitors,
    metrics,
    rankings: ranked,
    trend,
    sources: sources.slice(0, 8),
    domainTypes,
    actions,
    insight,
    recentChats: chats,
    schedule,
    promptCount: prompts.filter((p) => p.is_active).length,
  });
}
