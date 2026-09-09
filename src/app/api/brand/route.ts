import { NextResponse } from "next/server";
import { getPrimaryBrand, getCompetitors } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const brand = await getPrimaryBrand();
    if (!brand) return NextResponse.json({ brand: null });
    const competitors = await getCompetitors(brand.id);
    return NextResponse.json({ brand, competitors });
  } catch (e) {
    return NextResponse.json(
      { brand: null, error: e instanceof Error ? e.message : "hata" },
      { status: 200 }
    );
  }
}
