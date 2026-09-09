import { NextRequest, NextResponse } from "next/server";
import {
  getPrimaryBrand,
  updateSelectedModels,
} from "@/lib/supabase-admin";
import { ALL_MODELS, type ModelId } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const brand = await getPrimaryBrand();
  return NextResponse.json({
    selectedModels: brand?.selected_models ?? ALL_MODELS,
  });
}

export async function PUT(req: NextRequest) {
  const brand = await getPrimaryBrand();
  if (!brand)
    return NextResponse.json({ error: "marka yok" }, { status: 400 });
  const { models } = (await req.json()) as { models: ModelId[] };
  const valid = (models || []).filter((m) => ALL_MODELS.includes(m));
  await updateSelectedModels(brand.id, valid.length ? valid : ALL_MODELS);
  return NextResponse.json({ selectedModels: valid });
}
