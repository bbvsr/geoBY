import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, readJson, requireBrand, route, str } from "@/lib/http";
import { extractDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const brand = await requireBrand();
  return NextResponse.json({ competitors: await db().getCompetitors(brand.id) });
});

export const POST = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const name = str(body.name, 80);
  if (!name) throw new HttpError(400, "Rakip adı gerekli.");
  const existing = await db().getCompetitors(brand.id);
  if (existing.some((c) => c.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) {
    throw new HttpError(400, `"${name}" zaten rakip listesinde.`);
  }
  const competitor = await db().addCompetitor(brand.id, name, extractDomain(str(body.domain, 200)));
  return NextResponse.json({ competitor });
});

export const DELETE = route(async (req) => {
  await requireBrand();
  const { id } = await readJson(req);
  if (typeof id !== "string" || !id) throw new HttpError(400, "id gerekli.");
  await db().deleteCompetitor(id);
  return NextResponse.json({ ok: true });
});
