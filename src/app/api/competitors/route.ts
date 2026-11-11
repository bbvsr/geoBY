import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, readJson, requireBrand, route, str } from "@/lib/http";
import { extractDomain } from "@/lib/utils";
import { reanalyzeBrand } from "@/lib/testing";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await requireBrand();
  return NextResponse.json({ competitors: await db().getCompetitors(brand.id) });
});

/** Rakip ekler ve kayıtlı cevapları yeniden analiz eder (yeni rakip geçmişte de ölçülür). */
export const POST = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const name = str(body.name, 80);
  if (name.length < 2) throw new HttpError(400, "Rakip adı en az 2 karakter olmalı.");
  if (name.toLocaleLowerCase("tr") === brand.name.toLocaleLowerCase("tr")) {
    throw new HttpError(400, "Kendi markanızı rakip olarak ekleyemezsiniz.");
  }
  const rawDomain = str(body.domain, 200);
  const domain = extractDomain(rawDomain);
  if (rawDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new HttpError(400, "Alan adı geçersiz (ör. rakip.com). Bilmiyorsanız boş bırakın.");
  }
  const existing = await db().getCompetitors(brand.id);
  if (existing.some((c) => c.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) {
    throw new HttpError(400, `"${name}" zaten rakip listesinde.`);
  }
  const competitor = await db().addCompetitor(brand.id, name, domain);
  const reanalyzed = await reanalyzeBrand(brand);
  return NextResponse.json({ competitor, reanalyzed });
});

export const DELETE = route(async (req) => {
  const brand = await requireBrand();
  const { id } = await readJson(req);
  if (typeof id !== "string" || !id) throw new HttpError(400, "Rakip kimliği eksik.");
  const existing = await db().getCompetitors(brand.id);
  if (!existing.some((c) => c.id === id)) throw new HttpError(404, "Rakip bulunamadı.");
  await db().deleteCompetitor(id);
  const reanalyzed = await reanalyzeBrand(brand);
  return NextResponse.json({ ok: true, reanalyzed });
});
