import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, isModelId, readJson, requireBrand, route, str } from "@/lib/http";
import { parseResponse } from "@/lib/parser";
import { saveTestResult } from "@/lib/testing";

export const dynamic = "force-dynamic";

/**
 * Manuel görünürlük testi: kullanıcı LLM'e sorduğu metni ve aldığı cevabı yapıştırır.
 * Body: { promptId, model, queryText, response }  veya önizleme için { analyzeOnly: true, response }
 */
export const POST = route(async (req) => {
  const brand = await requireBrand();
  const body = await readJson(req);
  const response = typeof body.response === "string" ? body.response.slice(0, 100_000) : "";
  if (!response.trim()) throw new HttpError(400, "Cevap metni boş olamaz.");

  const competitors = await db().getCompetitors(brand.id);
  // Asistanın ayrıca gösterdiği kaynak bağlantıları (ör. Perplexity/ChatGPT'nin kaynak listesi)
  const extraCitations: string[] = Array.isArray(body.sources)
    ? body.sources.filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u.trim())).slice(0, 50)
    : [];

  if (body.analyzeOnly) {
    const parsed = parseResponse({
      response,
      brandName: brand.name,
      brandDomain: brand.domain,
      competitors,
      extraCitations,
    });
    return NextResponse.json({ parsed });
  }

  if (!isModelId(body.model)) throw new HttpError(400, "Geçerli bir model seçin.");
  const prompt = typeof body.promptId === "string" ? await db().getPromptById(body.promptId) : null;
  if (!prompt || prompt.brand_id !== brand.id) throw new HttpError(404, "Soru bulunamadı.");

  const result = await saveTestResult({
    brand,
    competitors,
    prompt,
    model: body.model,
    queryText: str(body.queryText, 1000),
    response,
    extraCitations,
    source: "manual",
  });
  await db().markTested(brand.id);
  return NextResponse.json(result);
});
