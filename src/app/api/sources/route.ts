import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, route } from "@/lib/http";
import { domainSources, domainTypeBreakdown, sourceTrend, urlSources } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ sources: [], domainTypes: [], trend: [], topDomains: [] });

  const { days, model } = parseFilters(req);
  const view = req.nextUrl.searchParams.get("view") === "urls" ? "urls" : "domains";

  const runs = await db().getRuns({ brandId: brand.id, days, model });
  const citations = await db().getCitationsForRuns(runs.map((r) => r.id));

  const byDomain = domainSources(citations, runs.length);
  const sources = view === "urls" ? urlSources(citations, runs.length) : byDomain;
  const topDomains = byDomain.slice(0, 5).map((s) => s.key);

  return NextResponse.json({
    sources,
    domainTypes: domainTypeBreakdown(citations),
    trend: sourceTrend(citations, runs, topDomains, 8),
    topDomains,
    view,
  });
});
