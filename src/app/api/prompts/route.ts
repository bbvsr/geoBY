import { NextRequest, NextResponse } from "next/server";
import {
  getPrimaryBrand,
  getPrompts,
  createPrompt,
  archivePrompt,
  updatePromptText,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const brand = await getPrimaryBrand();
  if (!brand) return NextResponse.json({ prompts: [] });
  const prompts = await getPrompts(brand.id, false);
  return NextResponse.json({ prompts });
}

export async function POST(req: NextRequest) {
  const brand = await getPrimaryBrand();
  if (!brand)
    return NextResponse.json({ error: "marka yok" }, { status: 400 });
  const { text, topic } = await req.json();
  if (!text?.trim())
    return NextResponse.json({ error: "text gerekli" }, { status: 400 });
  const prompt = await createPrompt(brand.id, text.trim(), topic || "Genel");
  return NextResponse.json({ prompt });
}

export async function PATCH(req: NextRequest) {
  const { id, text, topic } = await req.json();
  if (!id || !text?.trim())
    return NextResponse.json({ error: "id ve text gerekli" }, { status: 400 });
  await updatePromptText(id, text.trim(), topic);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  await archivePrompt(id);
  return NextResponse.json({ ok: true });
}
