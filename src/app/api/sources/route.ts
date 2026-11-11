import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, route } from "@/lib/http";
import { domainTypeBreakdown, sourceRows } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ sources: [], domainTypes: [], totalRuns: 0, view: "domains" });

  const { days, model } = parseFilters(req, 30);
  const view = req.nextUrl.searchParams.get("view") === "urls" ? "urls" : "domains";
  const runs = await db().getRuns({ brandId: brand.id, days, model });
  const citations = await db().getCitationsForRuns(runs.map((r) => r.id));

  return NextResponse.json({
    sources: sourceRows(citations, runs.length, view === "urls" ? "url" : "domain"),
    domainTypes: domainTypeBreakdown(citations),
    totalRuns: runs.length,
    view,
  });
});
