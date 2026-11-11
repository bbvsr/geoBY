import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, isModelId, readJson, requireBrand, route } from "@/lib/http";
import { canAutoTest } from "@/lib/ai/engines";
import { autoTestPrompt } from "@/lib/testing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Bir soruyu yapay zeka modellerine otomatik sorar ve sonucu kaydeder.
 * Body: { promptId, models?: ModelId[] }  — models verilmezse markanın seçili modelleri.
 * Tüm sorular için istemci her soruyu sırayla çağırır (ilerleme gösterilebilsin diye).
 */
export const POST = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const prompt = typeof body.promptId === "string" ? await db().getPromptById(body.promptId) : null;
  if (!prompt || prompt.brand_id !== brand.id) throw new HttpError(404, "Soru bulunamadı.");
  if (!prompt.is_active) throw new HttpError(400, "Arşivdeki sorular test edilmez. Önce arşivden çıkarın.");

  const requested = Array.isArray(body.models) ? body.models.filter(isModelId) : brand.selected_models;
  const models = requested.filter(canAutoTest);
  if (models.length === 0) {
    throw new HttpError(
      400,
      "İzlediğiniz asistanların hiçbiri için otomatik bağlantı yok. Ayarlar'dan ücretsiz bir anahtar ekleyin ya da cevapları elle yapıştırın."
    );
  }

  const competitors = await db().getCompetitors(brand.id);
  const results = await autoTestPrompt(brand, competitors, prompt, models);
  if (results.some((r) => r.success)) await db().markTested(brand.id);

  return NextResponse.json({ prompt: { id: prompt.id, text: prompt.text }, results });
});
