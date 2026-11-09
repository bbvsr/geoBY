import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, requireBrand, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

export const GET = route(async () => {
  const brand = await db().getPrimaryBrand();
  if (!brand) return NextResponse.json({ documents: [] });
  return NextResponse.json({ documents: await db().getDocuments(brand.id) });
});

export const POST = route(async (req) => {
  const brand = await requireBrand();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Dosya okunamadı.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Dosya seçin.");
  if (file.size === 0) throw new HttpError(400, "Dosya boş.");
  if (file.size > MAX_BYTES) throw new HttpError(400, "Dosya 10 MB'tan büyük olamaz.");

  const document = await db().saveDocument(brand.id, {
    name: file.name,
    type: file.type,
    data: Buffer.from(await file.arrayBuffer()),
  });
  return NextResponse.json({ document });
});
