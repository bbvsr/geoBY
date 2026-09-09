import type { CrawlResult } from "@/types";
import { extractDomain } from "@/lib/utils";

const PATHS = [
  "",
  "/hakkimizda",
  "/about",
  "/urunler",
  "/products",
  "/fiyatlandirma",
  "/pricing",
  "/ozellikler",
  "/features",
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1].trim() : "";
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : "";
}

function extractHeadings(html: string): string[] {
  const out: string[] = [];
  const re = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 15) {
    const t = stripHtml(m[1]);
    if (t.length > 2 && t.length < 120) out.push(t);
  }
  return out;
}

async function fetchPath(base: string, path: string): Promise<string> {
  try {
    const url = base.replace(/\/$/, "") + path;
    const res = await fetch(url, {
      headers: { "User-Agent": "GeoBY-Crawler/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function normalizeBase(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s;
}

/** Basit HTML crawl — LLM yok. Başlık, meta, başlıklardan yapı çıkarır. */
export async function crawlWebsite(rawUrl: string): Promise<CrawlResult> {
  const base = normalizeBase(rawUrl);
  const domain = extractDomain(base);

  // Ana sayfa + birkaç yol paralel çekilir
  const homeHtml = await fetchPath(base, "");
  const others = await Promise.all(
    PATHS.slice(1).map((p) => fetchPath(base, p))
  );
  const allHtml = [homeHtml, ...others].filter(Boolean).join(" ");

  const title = extractTitle(homeHtml) || domain;
  const description =
    extractMeta(homeHtml, "description") ||
    extractMeta(homeHtml, "og:description") ||
    stripHtml(homeHtml).slice(0, 200);
  const headings = extractHeadings(allHtml);
  const bodyText = stripHtml(homeHtml).slice(0, 2000);

  // Marka adı: og:site_name > title'ın ilk parçası > domain kökü
  const siteName =
    extractMeta(homeHtml, "og:site_name") ||
    title.split(/[|\-–—:]/)[0].trim() ||
    domain.split(".")[0];

  // Kategori tahmini (kaba anahtar kelime eşleşmesi)
  const category = guessCategory(
    `${title} ${description} ${headings.join(" ")} ${bodyText}`
  );

  const keywords = extractKeywords(headings, description);

  return {
    title,
    description,
    category,
    targetAudience: "",
    coreUseCase: headings[0] || description.slice(0, 80),
    keywords,
    competitorHints: [],
    brandName: siteName,
  };
}

const CATEGORY_HINTS: [string, string[]][] = [
  ["e-ticaret", ["e-ticaret", "ecommerce", "mağaza", "shop", "sepet", "ürün"]],
  ["pazarlama yazılımı", ["marketing", "pazarlama", "kampanya", "reklam"]],
  ["CRM", ["crm", "müşteri ilişkileri", "satış hunisi"]],
  ["SaaS platformu", ["saas", "bulut", "cloud", "platform", "abonelik"]],
  ["ajans", ["ajans", "agency", "danışmanlık", "hizmet"]],
  ["eğitim", ["eğitim", "kurs", "course", "öğren", "akademi"]],
  ["fintech", ["ödeme", "finans", "banka", "fintech", "cüzdan"]],
  ["yapay zeka aracı", ["yapay zeka", "ai", "makine öğren", "asistan"]],
];

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, hints] of CATEGORY_HINTS) {
    if (hints.some((h) => lower.includes(h))) return cat;
  }
  return "yazılım";
}

const STOP = new Set([
  "ve", "ile", "için", "bir", "the", "and", "for", "your", "with",
  "daha", "gibi", "olan", "en", "bu", "of", "to", "in", "a",
]);

function extractKeywords(headings: string[], description: string): string[] {
  const text = (headings.join(" ") + " " + description).toLowerCase();
  const words = text.match(/[\p{L}]{4,}/gu) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}
