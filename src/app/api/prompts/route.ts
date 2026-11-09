import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, readJson, requireBrand, route, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ prompts: [] });
  return NextResponse.json({ prompts: await db().getPrompts(brand.id, false) });
});

export const POST = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const text = str(body.text, 300);
  if (text.length < 3) throw new HttpError(400, "Soru metni en az 3 karakter olmalı.");
  const prompt = await db().createPrompt(brand.id, text, str(body.topic, 40) || "Genel");
  return NextResponse.json({ prompt });
});

/** Soruyu düzenler veya arşivden geri alır. */
export const PATCH = route(async (req) => {
  await requireBrand();
  const body = await readJson(req);
  const id = str(body.id, 100);
  if (!id) throw new HttpError(400, "id gerekli.");
  const patch: { text?: string; topic?: string; is_active?: boolean } = {};
  if (body.text !== undefined) {
    const text = str(body.text, 300);
    if (text.length < 3) throw new HttpError(400, "Soru metni en az 3 karakter olmalı.");
    patch.text = text;
  }
  if (body.topic !== undefined) patch.topic = str(body.topic, 40) || "Genel";
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  await db().updatePrompt(id, patch);
  return NextResponse.json({ ok: true });
});

/** Soruyu arşivler (geçmiş test verisi korunur). */
export const DELETE = route(async (req) => {
  await requireBrand();
  const { id } = await readJson(req);
  if (typeof id !== "string" || !id) throw new HttpError(400, "id gerekli.");
  await db().updatePrompt(id, { is_active: false });
  return NextResponse.json({ ok: true });
});
