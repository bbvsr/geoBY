import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFilters, route } from "@/lib/http";
import { buildOverview } from "@/lib/report";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ report: null });
  const { days, model } = parseFilters(req, 30);
  return NextResponse.json({ report: await buildOverview(brand, days, model) });
});
