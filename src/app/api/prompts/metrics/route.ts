import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, route } from "@/lib/http";
import { avgPosition, avgSentiment, visibility } from "@/lib/metrics";
import type { ModelId, PromptWithMetrics, Run } from "@/types";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ prompts: [] });
  const { days, model } = parseFilters(req);

  const [prompts, runs] = await Promise.all([
    db().getPrompts(brand.id, false),
    db().getRuns({ brandId: brand.id, days, model }),
  ]);

  const byPrompt = new Map<string, Run[]>();
  for (const r of runs) {
    const arr = byPrompt.get(r.prompt_id) ?? [];
    arr.push(r);
    byPrompt.set(r.prompt_id, arr);
  }

  const result: PromptWithMetrics[] = prompts.map((p) => {
    const pr = byPrompt.get(p.id) ?? [];
    return {
      ...p,
      visibility: visibility(pr),
      sentiment: avgSentiment(pr),
      position: avgPosition(pr),
      models: [...new Set(pr.map((r) => r.model))] as ModelId[],
      totalRuns: pr.length,
    };
  });

  return NextResponse.json({ prompts: result });
});
