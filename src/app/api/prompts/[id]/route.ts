import { NextRequest, NextResponse } from "next/server";
import {
  getPromptById,
  getRunsForPrompt,
  getCitationsForRuns,
} from "@/lib/supabase-admin";
import { ALL_MODELS, type ModelBreakdown, type ModelId } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prompt = await getPromptById(id);
  if (!prompt)
    return NextResponse.json({ error: "prompt yok" }, { status: 404 });

  const runs = await getRunsForPrompt(id);
  const citations = await getCitationsForRuns(runs.map((r) => r.id));

  const citByRun = new Map<string, number>();
  for (const c of citations)
    citByRun.set(c.run_id, (citByRun.get(c.run_id) ?? 0) + 1);

  // Her model için en son run
  const modelBreakdown: ModelBreakdown[] = ALL_MODELS.map((model: ModelId) => {
    const modelRuns = runs
      .filter((r) => r.model === model)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    const latest = modelRuns[0];
    if (!latest) {
      return {
        model,
        mentioned: false,
        mentionCount: 0,
        position: null,
        sentiment: "neutral",
        citationCount: 0,
        response: null,
        hasRun: false,
      };
    }
    return {
      model,
      mentioned: latest.mentioned,
      mentionCount: latest.mention_count,
      position: latest.position_score,
      sentiment: latest.sentiment,
      citationCount: citByRun.get(latest.id) ?? 0,
      response: latest.response,
      hasRun: true,
    };
  });

  return NextResponse.json({ prompt, runs, citations, modelBreakdown });
}
