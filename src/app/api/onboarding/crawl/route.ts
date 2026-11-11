import { NextResponse } from "next/server";
import { HttpError, readJson, route, str } from "@/lib/http";
import { crawlWebsite, siteOrigin } from "@/lib/scraper";
import { analyzeSite } from "@/lib/generators";
import { assertPublicUrl, UnsafeUrlError } from "@/lib/net";
import { extractDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Siteyi tarar; yardımcı yapay zeka varsa marka/kategori/rakip/soru önerisi de üretir. */
export const POST = route(async (req) => {
  const body = await readJson(req);
  const url = str(body.url, 300);
  const domain = extractDomain(url);
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new HttpError(400, "Geçerli bir web sitesi adresi girin (ör. markaniz.com).");
  }
  try {
    await assertPublicUrl(siteOrigin(url));
  } catch (e) {
    // İç ağ adresi kesinse reddet. Alan adı çözülemiyorsa (yazım hatası veya DNS'siz ağ)
    // kurulumu engelleme: site taranmaz, kullanıcı bilgileri elle girer.
    if (e instanceof UnsafeUrlError) throw new HttpError(400, e.message);
  }
  const snapshot = await crawlWebsite(url);
  const crawl = await analyzeSite(snapshot, domain);
  return NextResponse.json({ crawl, domain });
});
