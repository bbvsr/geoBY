import { NextRequest, NextResponse } from "next/server";
import { completeOnboarding } from "@/lib/supabase-admin";
import { ALL_MODELS, type ModelId } from "@/types";
import { extractDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandName,
      domain,
      category,
      description,
      prompts = [],
      competitors = [],
      selectedModels,
    } = body;

    if (!brandName || !domain) {
      return NextResponse.json(
        { error: "brandName ve domain gerekli" },
        { status: 400 }
      );
    }

    const models: ModelId[] =
      Array.isArray(selectedModels) && selectedModels.length
        ? selectedModels
        : ALL_MODELS;

    const brand = await completeOnboarding({
      brandName,
      domain: extractDomain(domain),
      category: category || "",
      description: description || "",
      selectedModels: models,
      prompts: prompts.filter((p: { text: string }) => p.text?.trim()),
      competitors: competitors.filter(
        (c: { name: string }) => c.name?.trim()
      ),
    });

    return NextResponse.json({ brand });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "hata" },
      { status: 500 }
    );
  }
}
