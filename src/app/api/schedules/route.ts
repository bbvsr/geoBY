import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readJson, requireBrand, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ schedule: null });
  return NextResponse.json({ schedule: await db().getSchedule(brand.id) });
});

export const PUT = route(async (req) => {
  const brand = await requireBrand();
  const { frequency, isActive } = await readJson(req);
  const schedule = await db().saveSchedule(
    brand.id,
    frequency === "monthly" ? "monthly" : "weekly",
    isActive !== false
  );
  return NextResponse.json({ schedule });
});
