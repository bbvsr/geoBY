import { NextResponse } from "next/server";
import { HttpError, isModelId, readJson, route } from "@/lib/http";
import { runModel } from "@/lib/ai/engines";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Bir model bağlantısını kısa bir soruyla dener (kayıt oluşturmaz). */
export const POST = route(async (req) => {
  const { model } = await readJson(req);
  if (!isModelId(model)) throw new HttpError(400, "Geçerli bir model seçin.");
  const started = Date.now();
  try {
    const res = await runModel(model, "Bağlantı testi: yalnızca 'Tamam' yaz.");
    return NextResponse.json({
      ok: true,
      engine: res.engine.label,
      ms: Date.now() - started,
      sample: res.text.slice(0, 120),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
});
