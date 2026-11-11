import { NextResponse } from "next/server";
import { HttpError, requireBrand, route } from "@/lib/http";
import { buildPromptDetail } from "@/lib/report";

export const dynamic = "force-dynamic";

/** Bir sorunun tüm testleri (en yeni önce), cevap metinleri ve kaynaklarıyla. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const brand = await requireBrand();
  const { id } = await params;
  const detail = await buildPromptDetail(brand, id);
  if (!detail) throw new HttpError(404, "Soru bulunamadı.");
  return NextResponse.json(detail);
});
