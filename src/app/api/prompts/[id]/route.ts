import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, route } from "@/lib/http";
import { ALL_MODELS, type ModelBreakdown } from "@/types";

export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  const prompt = await db().getPromptById(id);
  if (!prompt) throw new HttpError(404, "Soru bulunamadı.");

  const runs = await db().getRunsForPrompt(id); // en yeni önce
  const citations = await db().getCitationsForRuns(runs.map((r) => r.id));
  const citByRun = new Map<string, number>();
  for (const c of citations) citByRun.set(c.run_id, (citByRun.get(c.run_id) ?? 0) + 1);

  // Her model için en son test
  const modelBreakdown: ModelBreakdown[] = ALL_MODELS.map((model) => {
    const latest = runs.find((r) => r.model === model);
    if (!latest) {
      return {
        model,
        mentioned: false,
        mentionCount: 0,
        position: null,
        sentiment: "neutral",
        citationCount: 0,
        response: null,
        queryText: null,
        source: null,
        date: null,
        competitorsMentioned: [],
        hasRun: false,
      };
    }
    return {
      model,
      mentioned: latest.mentioned,
      mentionCount: latest.mention_count ?? 0,
      position: latest.position_score,
      sentiment: latest.sentiment,
      citationCount: citByRun.get(latest.id) ?? 0,
      response: latest.response,
      queryText: latest.query_text,
      source: latest.source,
      date: latest.created_at,
      competitorsMentioned: Object.entries(latest.competitor_mentions ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k),
      hasRun: true,
    };
  });

  return NextResponse.json({ prompt, modelBreakdown, totalRuns: runs.length });
});
