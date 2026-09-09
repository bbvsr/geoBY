import { NextRequest, NextResponse } from "next/server";
import {
  getPrimaryBrand,
  getPrompts,
  getRuns,
} from "@/lib/supabase-admin";
import { visibility, avgSentiment, avgPosition } from "@/lib/metrics";
import type { ModelId, PromptWithMetrics, Run } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const brand = await getPrimaryBrand();
  if (!brand) return NextResponse.json({ prompts: [] });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "90", 10);
  const model = (searchParams.get("model") as ModelId) || undefined;

  const prompts = await getPrompts(brand.id, false);
  const runs = await getRuns({ brandId: brand.id, days, model });

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
}
