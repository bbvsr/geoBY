import { NextRequest, NextResponse } from "next/server";
import {
  getPrimaryBrand,
  getSchedule,
  upsertSchedule,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const brand = await getPrimaryBrand();
  if (!brand) return NextResponse.json({ schedule: null });
  const schedule = await getSchedule(brand.id);
  return NextResponse.json({ schedule });
}

export async function PUT(req: NextRequest) {
  const brand = await getPrimaryBrand();
  if (!brand)
    return NextResponse.json({ error: "marka yok" }, { status: 400 });
  const { frequency, isActive } = (await req.json()) as {
    frequency: "weekly" | "monthly";
    isActive: boolean;
  };
  const schedule = await upsertSchedule(
    brand.id,
    frequency === "monthly" ? "monthly" : "weekly",
    isActive !== false
  );
  return NextResponse.json({ schedule });
}
