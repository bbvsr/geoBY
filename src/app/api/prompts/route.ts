import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, parseFilters, readJson, requireBrand, route, str } from "@/lib/http";
import { buildPromptRows } from "@/lib/report";

export const dynamic = "force-dynamic";

/** Sorular + her asistandaki son test durumu. ?days= ve ?model= ile süzülür. */
export const GET = route(async (req) => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ prompts: [] });
  const { days, model } = parseFilters(req, 30);
  return NextResponse.json({ prompts: await buildPromptRows(brand, days, model) });
});

async function ownPrompt(brandId: string, id: unknown) {
  if (typeof id !== "string" || !id) throw new HttpError(400, "Soru kimliği eksik.");
  const prompt = await db().getPromptById(id);
  if (!prompt || prompt.brand_id !== brandId) throw new HttpError(404, "Soru bulunamadı.");
  return prompt;
}

export const POST = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const text = str(body.text, 300);
  if (text.length < 3) throw new HttpError(400, "Soru en az 3 karakter olmalı.");
  const existing = await db().getPrompts(brand.id, false);
  const dup = existing.find((p) => p.text.toLocaleLowerCase("tr") === text.toLocaleLowerCase("tr"));
  if (dup) {
    throw new HttpError(400, dup.is_active ? "Bu soru zaten listede." : "Bu soru arşivde var; arşivden geri alabilirsiniz.");
  }
  const prompt = await db().createPrompt(brand.id, text, str(body.topic, 40) || "Genel");
  return NextResponse.json({ prompt });
});

/** Soruyu düzenler veya arşive alır / arşivden çıkarır. */
export const PATCH = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const prompt = await ownPrompt(brand.id, body.id);
  const patch: { text?: string; topic?: string; is_active?: boolean } = {};
  if (body.text !== undefined) {
    const text = str(body.text, 300);
    if (text.length < 3) throw new HttpError(400, "Soru en az 3 karakter olmalı.");
    patch.text = text;
  }
  if (body.topic !== undefined) patch.topic = str(body.topic, 40) || "Genel";
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  await db().updatePrompt(prompt.id, patch);
  return NextResponse.json({ ok: true });
});

/** Soruyu arşivler (geçmiş testler korunur). */
export const DELETE = route(async (req) => {
  const brand = await requireBrand();
  const { id } = await readJson(req);
  const prompt = await ownPrompt(brand.id, id);
  await db().updatePrompt(prompt.id, { is_active: false });
  return NextResponse.json({ ok: true });
});
