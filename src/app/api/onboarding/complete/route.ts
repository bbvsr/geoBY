import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, isModelId, readJson, route, str } from "@/lib/http";
import { ALL_MODELS } from "@/types";
import { extractDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const body = await readJson(req);
  const brandName = str(body.brandName, 80);
  const domain = extractDomain(str(body.domain, 200));
  if (!brandName) throw new HttpError(400, "Marka adı gerekli.");
  if (!domain.includes(".")) throw new HttpError(400, "Geçerli bir alan adı gerekli.");

  if (await db().getPrimaryBrand()) {
    throw new HttpError(400, "Marka zaten oluşturulmuş. Sayfayı yenileyin.");
  }

  const models = Array.isArray(body.selectedModels) ? body.selectedModels.filter(isModelId) : [];

  const seenPrompts = new Set<string>();
  const prompts = (Array.isArray(body.prompts) ? body.prompts : [])
    .map((p: { text?: unknown; topic?: unknown }) => ({ text: str(p?.text, 300), topic: str(p?.topic, 40) || "Genel" }))
    .filter((p: { text: string }) => {
      const k = p.text.toLocaleLowerCase("tr");
      if (p.text.length < 3 || seenPrompts.has(k)) return false;
      seenPrompts.add(k);
      return true;
    });

  const seenComp = new Set<string>();
  const competitors = (Array.isArray(body.competitors) ? body.competitors : [])
    .map((c: { name?: unknown; domain?: unknown }) => ({ name: str(c?.name, 80), domain: extractDomain(str(c?.domain, 200)) }))
    .filter((c: { name: string }) => {
      const k = c.name.toLocaleLowerCase("tr");
      if (!c.name || seenComp.has(k)) return false;
      seenComp.add(k);
      return true;
    });

  const brand = await db().completeOnboarding({
    brandName,
    domain,
    category: str(body.category, 80),
    description: str(body.description, 400),
    selectedModels: models.length ? models : [...ALL_MODELS],
    prompts,
    competitors,
  });
  return NextResponse.json({ brand });
});
