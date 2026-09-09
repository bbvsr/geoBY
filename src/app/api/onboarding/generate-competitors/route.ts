import { NextRequest, NextResponse } from "next/server";
import { generateCompetitors } from "@/lib/generators";
import type { CrawlResult } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { crawlData } = (await req.json()) as { crawlData: CrawlResult };
    const competitors = generateCompetitors(crawlData);
    return NextResponse.json({ competitors });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "hata" },
      { status: 500 }
    );
  }
}
