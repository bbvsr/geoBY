import { NextRequest, NextResponse } from "next/server";
import {
  admin,
  getPrimaryBrand,
  getDocuments,
  createDocument,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const BUCKET = "geoby-docs";

async function ensureBucket() {
  try {
    const { data } = await admin().storage.getBucket(BUCKET);
    if (!data) {
      await admin().storage.createBucket(BUCKET, { public: false });
    }
  } catch {
    try {
      await admin().storage.createBucket(BUCKET, { public: false });
    } catch {
      /* bucket zaten var olabilir */
    }
  }
}

export async function GET() {
  const brand = await getPrimaryBrand();
  if (!brand) return NextResponse.json({ documents: [] });
  const documents = await getDocuments(brand.id);
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const brand = await getPrimaryBrand();
  if (!brand)
    return NextResponse.json({ error: "marka yok" }, { status: 400 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "dosya gerekli" }, { status: 400 });
    }

    await ensureBucket();
    const path = `${brand.id}/${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin()
      .storage.from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    // Yükleme başarısız olsa da kaydı metadata olarak tut
    const storagePath = upErr ? "" : path;
    const doc = await createDocument(
      brand.id,
      file.name,
      storagePath,
      file.type || ""
    );
    return NextResponse.json({ document: doc, warning: upErr?.message });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "yükleme hatası" },
      { status: 500 }
    );
  }
}
