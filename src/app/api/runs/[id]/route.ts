import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, requireBrand, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Hatalı veya yanlış yapıştırılmış bir test kaydını siler. */
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const brand = await requireBrand();
  const { id } = await params;
  const runs = await db().getRuns({ brandId: brand.id });
  if (!runs.some((r) => r.id === id)) throw new HttpError(404, "Test kaydı bulunamadı.");
  await db().deleteRun(id);
  return NextResponse.json({ ok: true });
});
