import { NextRequest, NextResponse } from "next/server";
import {
  getPrimaryBrand,
  getCompetitors,
  getPromptById,
  createRun,
  createCitations,
} from "@/lib/supabase-admin";
import { parseResponse } from "@/lib/parser";
import type { ModelId, ParsedResponse } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Manuel görünürlük testi:
 * Kullanıcı bir prompt+model için arama promptunu ve LLM cevabını yapıştırır.
 * Sistem cevabı analiz edip run + citation kayıtları oluşturur.
 * Body: { promptId, model, queryText, response }
 * Ya da sadece analiz önizlemesi için: { analyzeOnly: true, response }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brand = await getPrimaryBrand();
    if (!brand)
      return NextResponse.json({ error: "marka yok" }, { status: 400 });

    const competitors = await getCompetitors(brand.id);
    const responseText: string = body.response ?? "";

    const parsed: ParsedResponse = parseResponse({
      response: responseText,
      brandName: brand.name,
      brandDomain: brand.domain,
      competitors,
      extraCitations: Array.isArray(body.extraCitations)
        ? body.extraCitations
        : [],
    });

    // Sadece önizleme istendiyse kaydetmeden dön
    if (body.analyzeOnly) {
      return NextResponse.json({ parsed });
    }

    const { promptId, model, queryText } = body as {
      promptId: string;
      model: ModelId;
      queryText: string;
    };
    if (!promptId || !model) {
      return NextResponse.json(
        { error: "promptId ve model gerekli" },
        { status: 400 }
      );
    }
    const prompt = await getPromptById(promptId);
    if (!prompt)
      return NextResponse.json({ error: "prompt yok" }, { status: 404 });

    const run = await createRun({
      prompt_id: promptId,
      model,
      response: responseText,
      query_text: queryText || prompt.text,
      mentioned: parsed.mentioned,
      mention_count: parsed.mentionCount,
      position_score: parsed.positionScore,
      sentiment: parsed.sentiment,
      competitor_mentions: parsed.competitorMentions,
      source: "manual",
    });

    if (run) {
      await createCitations(
        run.id,
        parsed.citations.map((c) => ({
          domain: c.domain,
          url: c.url,
          domain_type: c.domainType,
        }))
      );
    }

    return NextResponse.json({ run, parsed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "hata" },
      { status: 500 }
    );
  }
}
