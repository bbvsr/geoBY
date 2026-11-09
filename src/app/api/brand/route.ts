import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, readJson, requireBrand, route, str } from "@/lib/http";
import { extractDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ brand: null, competitors: [] });
  const competitors = await db().getCompetitors(brand.id);
  return NextResponse.json({ brand, competitors });
});

/** Marka bilgilerini günceller. */
export const PATCH = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const name = str(body.name, 80);
  const domain = extractDomain(str(body.domain, 200));
  if (!name) throw new HttpError(400, "Marka adı boş olamaz.");
  if (!domain || !domain.includes(".")) throw new HttpError(400, "Geçerli bir alan adı girin (ör. markaniz.com).");
  const updated = await db().updateBrand(brand.id, {
    name,
    domain,
    category: str(body.category, 80),
    description: str(body.description, 400),
  });
  return NextResponse.json({ brand: updated });
});
