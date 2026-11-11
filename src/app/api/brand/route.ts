import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, readJson, requireBrand, route, str } from "@/lib/http";
import { extractDomain } from "@/lib/utils";
import { reanalyzeBrand } from "@/lib/testing";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ brand: null, competitors: [] });
  const competitors = await db().getCompetitors(brand.id);
  return NextResponse.json({ brand, competitors });
});

/** Marka bilgilerini günceller; ad/alan adı değiştiyse eski cevapları yeniden analiz eder. */
export const PATCH = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const name = str(body.name, 80);
  const domain = extractDomain(str(body.domain, 200));
  if (name.length < 2) throw new HttpError(400, "Marka adı en az 2 karakter olmalı.");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new HttpError(400, "Geçerli bir alan adı girin (ör. markaniz.com).");
  }
  const updated = await db().updateBrand(brand.id, {
    name,
    domain,
    category: str(body.category, 80),
    description: str(body.description, 400),
  });
  const reanalyzed =
    updated && (name !== brand.name || domain !== brand.domain) ? await reanalyzeBrand(updated) : 0;
  return NextResponse.json({ brand: updated, reanalyzed });
});

/** Markayı ve tüm verisini siler. Kazayla silmeyi önlemek için marka adı onay olarak istenir. */
export const DELETE = route(async (req) => {
  const brand = await requireBrand();
  const { confirm } = await readJson(req);
  if (typeof confirm !== "string" || confirm.trim().toLocaleLowerCase("tr") !== brand.name.toLocaleLowerCase("tr")) {
    throw new HttpError(400, `Onay için marka adını ("${brand.name}") aynen yazın.`);
  }
  await db().deleteBrand(brand.id);
  return NextResponse.json({ ok: true });
});
