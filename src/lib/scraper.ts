import type { CrawlResult } from "@/types";
import { extractDomain } from "@/lib/utils";
import { fetchPublicPage } from "@/lib/net";

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

async function fetchPath(origin: string, path: string): Promise<string> {
  const page = await fetchPublicPage(origin + path, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GeoBY/1.0; +https://github.com/bbvsr/geoBY)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  return page?.html ?? "";
}

/** Kullanıcının yazdığı adresten site kökünü çıkarır (ör. "markam.com/urun" → "https://markam.com"). */
export function siteOrigin(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return new URL(s).origin;
}

export interface SiteSnapshot {
  result: CrawlResult;
  /** Yapay zeka analizine verilecek sade metin (başlıklar + gövde) */
  text: string;
}

/** Basit HTML crawl — başlık, meta ve başlıklardan yapı çıkarır. */
export async function crawlWebsite(rawUrl: string): Promise<SiteSnapshot> {
  const base = siteOrigin(rawUrl);
  const domain = extractDomain(base);

  // Ana sayfa + birkaç alt sayfa paralel çekilir
  const pages = await Promise.all(PATHS.map((p) => fetchPath(base, p)));
  const homeHtml = pages[0];
  const allHtml = pages.filter(Boolean).join(" ");

  const title = decodeEntities(extractTitle(homeHtml)) || domain;
  const description = decodeEntities(
    extractMeta(homeHtml, "description") ||
      extractMeta(homeHtml, "og:description") ||
      stripHtml(homeHtml).slice(0, 200)
  );
  const headings = extractHeadings(allHtml).map(decodeEntities);
  const bodyText = stripHtml(homeHtml).slice(0, 2000);

  // Marka adı: og:site_name > title'ın ilk parçası > domain kökü
  const siteName =
    decodeEntities(extractMeta(homeHtml, "og:site_name")) ||
    title.split(/[|\-–—:]/)[0].trim() ||
    domain.split(".")[0];

  const category = guessCategory(`${title} ${description} ${headings.join(" ")} ${bodyText}`);

  const text = [
    `Başlık: ${title}`,
    `Açıklama: ${description}`,
    `Sayfa başlıkları: ${headings.join(" · ")}`,
    `İçerik: ${pages.filter(Boolean).map((h) => stripHtml(h).slice(0, 1500)).join(" … ").slice(0, 6000)}`,
  ].join("\n");

  return {
    result: {
      title,
      description,
      category,
      targetAudience: "",
      coreUseCase: headings[0] || description.slice(0, 80),
      keywords: extractKeywords(headings, description),
      competitorHints: [],
      brandName: siteName,
      fetched: !!homeHtml,
      analyzedBy: null,
    },
    text,
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

const CATEGORY_HINTS: [string, string[]][] = [
  ["e-ticaret", ["e-ticaret", "ecommerce", "mağaza", "shop", "sepet", "ürün"]],
  ["pazarlama yazılımı", ["marketing", "pazarlama", "kampanya", "reklam"]],
  ["CRM", ["crm", "müşteri ilişkileri", "satış hunisi"]],
  ["SaaS platformu", ["saas", "bulut", "cloud", "platform", "abonelik"]],
  ["ajans", ["ajans", "agency", "danışmanlık", "hizmet"]],
  ["eğitim", ["eğitim", "kurs", "course", "öğren", "akademi"]],
  ["fintech", ["ödeme", "finans", "banka", "fintech", "cüzdan"]],
  ["yapay zeka aracı", ["yapay zeka", " ai ", "ai-powered", "makine öğren", "asistan"]],
];

function guessCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, hints] of CATEGORY_HINTS) {
    if (hints.some((h) => lower.includes(h))) return cat;
  }
  // Emin değilsek uydurmayalım: kullanıcı kurulumda kendisi yazar
  return "";
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
