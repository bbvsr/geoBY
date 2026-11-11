import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, isModelId, readJson, requireBrand, route } from "@/lib/http";
import { STANDARD_MODELS } from "@/types";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await db().getPrimaryBrand();
  return NextResponse.json({ selectedModels: brand?.selected_models ?? STANDARD_MODELS });
});

export const PUT = route(async (req) => {
  const brand = await requireBrand();
  const { models, samples } = await readJson(req);
  if (Array.isArray(models)) {
    const valid = [...new Set(models.filter(isModelId))];
    if (valid.length === 0) throw new HttpError(400, "En az bir asistan seçin.");
    await db().updateSelectedModels(brand.id, valid);
  }
  if (samples !== undefined) {
    if (typeof samples !== "number" || ![1, 3, 5].includes(samples)) throw new HttpError(400, "Tekrar sayısı 1, 3 veya 5 olabilir.");
    await db().updateSamples(brand.id, samples);
  }
  return NextResponse.json({ ok: true });
});
