import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, route } from "@/lib/http";
import {
  domainSources,
  domainTypeBreakdown,
  overviewMetrics,
  rankings,
  recentChats,
  visibility,
  visibilityTrend,
} from "@/lib/metrics";
import { buildActions, keyInsight } from "@/lib/actions";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const store = db();
  const brand = await store.getPrimaryBrand();
  if (!brand) return NextResponse.json({ brand: null });

  const { days, model } = parseFilters(req, 90);

  const [competitors, prompts, allRuns, schedule] = await Promise.all([
    store.getCompetitors(brand.id),
    store.getPrompts(brand.id, false),
    store.getRuns({ brandId: brand.id, model }),
    store.getSchedule(brand.id),
  ]);

  const now = Date.now();
  const inDays = (d: number) => allRuns.filter((r) => now - new Date(r.created_at).getTime() <= d * 86400000);
  const runs = inDays(days);
  const trendRuns = inDays(Math.max(days, 56));

  const citations = await store.getCitationsForRuns(runs.map((r) => r.id));

  const ranked = rankings(runs, brand, competitors);
  const metrics = overviewMetrics(runs, allRuns, citations, ranked, brand, days);
  const trend = visibilityTrend(trendRuns, brand, competitors, 8);
  const sources = domainSources(citations, runs.length);
  const domainTypes = domainTypeBreakdown(citations);
  const actions = buildActions(brand, ranked, sources, domainTypes, runs.length);

  const others = ranked.filter((r) => !r.isYou);
  const compVis = others.length ? others.reduce((s, r) => s + r.visibility, 0) / others.length : 0;

  return NextResponse.json({
    brand,
    competitors,
    metrics,
    rankings: ranked,
    trend,
    sources: sources.slice(0, 8),
    domainTypes,
    actions,
    insight: keyInsight(brand, visibility(runs), compVis, runs.length),
    recentChats: recentChats(runs, prompts, citations),
    schedule,
    promptCount: prompts.filter((p) => p.is_active).length,
  });
});
