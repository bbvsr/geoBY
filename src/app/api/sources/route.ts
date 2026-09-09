import { NextRequest, NextResponse } from "next/server";
import {
  getPrimaryBrand,
  getRuns,
  getCitationsForRuns,
} from "@/lib/supabase-admin";
import {
  domainSources,
  urlSources,
  domainTypeBreakdown,
  sourceTrend,
} from "@/lib/metrics";
import type { ModelId } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const brand = await getPrimaryBrand();
  if (!brand) return NextResponse.json({ sources: [], domainTypes: [] });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "90", 10);
  const model = (searchParams.get("model") as ModelId) || undefined;
  const view = (searchParams.get("view") as "domains" | "urls") || "domains";

  const runs = await getRuns({ brandId: brand.id, days, model });
  const citations = await getCitationsForRuns(runs.map((r) => r.id));

  const sources =
    view === "urls"
      ? urlSources(citations, runs.length)
      : domainSources(citations, runs.length);
  const domainTypes = domainTypeBreakdown(citations);

  const topDomains = domainSources(citations, runs.length)
    .slice(0, 5)
    .map((s) => s.key);
  const trend = sourceTrend(citations, runs, topDomains, 8);

  return NextResponse.json({ sources, domainTypes, trend, topDomains, view });
}
