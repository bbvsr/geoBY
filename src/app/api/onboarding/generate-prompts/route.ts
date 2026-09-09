import { NextRequest, NextResponse } from "next/server";
import { generatePrompts } from "@/lib/generators";
import type { CrawlResult } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { crawlData, domain } = (await req.json()) as {
      crawlData: CrawlResult;
      domain: string;
    };
    const prompts = generatePrompts(crawlData, domain);
    return NextResponse.json({ prompts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "hata" },
      { status: 500 }
    );
  }
}
