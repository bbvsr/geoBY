import { NextRequest, NextResponse } from "next/server";
import { crawlWebsite } from "@/lib/scraper";
import { extractDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url gerekli" }, { status: 400 });
    }
    const crawl = await crawlWebsite(url);
    return NextResponse.json({ crawl, domain: extractDomain(url) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "crawl hatası" },
      { status: 500 }
    );
  }
}
