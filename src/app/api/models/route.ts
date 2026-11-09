import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isModelId, readJson, requireBrand, route } from "@/lib/http";
import { ALL_MODELS } from "@/types";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await db().getPrimaryBrand();
  return NextResponse.json({ selectedModels: brand?.selected_models ?? ALL_MODELS });
});

export const PUT = route(async (req) => {
  const brand = await requireBrand();
  const { models } = await readJson(req);
  const valid = Array.isArray(models) ? [...new Set(models.filter(isModelId))] : [];
  const selected = valid.length ? valid : [...ALL_MODELS];
  await db().updateSelectedModels(brand.id, selected);
  return NextResponse.json({ selectedModels: selected });
});
