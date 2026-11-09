import { NextResponse } from "next/server";
import { HttpError, readJson, route, str } from "@/lib/http";
import { crawlWebsite } from "@/lib/scraper";
import { analyzeSite } from "@/lib/generators";
import { extractDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Siteyi tarar; yapay zeka varsa marka/kategori/rakip/soru önerisi de üretir. */
export const POST = route(async (req) => {
  const body = await readJson(req);
  const url = str(body.url, 300);
  const domain = extractDomain(url);
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new HttpError(400, "Geçerli bir web sitesi adresi girin (ör. markaniz.com).");
  }
  const snapshot = await crawlWebsite(url);
  const crawl = await analyzeSite(snapshot, domain);
  return NextResponse.json({ crawl, domain });
});
