import type {
  Competitor,
  DomainType,
  ParsedResponse,
  Sentiment,
} from "@/types";
import { extractDomain, escapeRegExp } from "@/lib/utils";

// ---- Domain sınıflandırma sözlükleri ----
const UGC_DOMAINS = [
  "reddit.com", "youtube.com", "quora.com", "medium.com", "twitter.com",
  "x.com", "tiktok.com", "facebook.com", "instagram.com", "linkedin.com",
  "g2.com", "capterra.com", "trustpilot.com", "getapp.com", "producthunt.com",
  "ekşisözlük", "eksisozluk.com", "sikayetvar.com",
];
const EDITORIAL_DOMAINS = [
  "techcrunch.com", "wired.com", "forbes.com", "bloomberg.com", "theverge.com",
  "businessinsider.com", "cnbc.com", "webrazzi.com", "hurriyet.com.tr",
  "milliyet.com.tr", "ntv.com.tr",
];
const REFERENCE_DOMAINS = [
  "wikipedia.org", "developer.mozilla.org", "mdn.io", "vikipedi.org",
];

function classifyDomain(
  domain: string,
  brandDomain: string,
  competitorDomains: string[]
): DomainType {
  const d = extractDomain(domain);
  const bd = extractDomain(brandDomain);
  if (bd && d.includes(bd)) return "You";
  if (competitorDomains.some((cd) => cd && d.includes(extractDomain(cd))))
    return "Competitor";
  if (UGC_DOMAINS.some((u) => d.includes(u))) return "UGC";
  if (EDITORIAL_DOMAINS.some((e) => d.includes(e))) return "Editorial";
  if (REFERENCE_DOMAINS.some((r) => d.includes(r))) return "Reference";
  if (/\.(edu|gov|org)(\.[a-z]{2})?$/.test(d)) return "Institutional";
  return "Corporate";
}

// ---- Sentiment kelime listeleri (TR + EN) ----
const POSITIVE_WORDS = [
  "best", "top", "leading", "recommended", "popular", "excellent", "great",
  "powerful", "reliable", "trusted", "favorite", "premier", "strong",
  "en iyi", "lider", "önerilen", "popüler", "güçlü", "güvenilir", "kaliteli",
  "başarılı", "tercih", "üstün", "mükemmel", "avantajlı",
];
const NEGATIVE_WORDS = [
  "worst", "poor", "limited", "expensive", "weak", "lacking", "outdated",
  "complicated", "difficult", "unreliable", "buggy", "slow",
  "kötü", "zayıf", "pahalı", "sınırlı", "eksik", "yetersiz", "karmaşık",
  "zor", "güvenilmez", "yavaş", "dezavantaj",
];

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const re = new RegExp(escapeRegExp(needle), "gi");
  const m = haystack.match(re);
  return m ? m.length : 0;
}

/** Kelime sınırı ile marka geçiş sayısı (Türkçe ekleri toleranslı). */
function countMentions(text: string, term: string): number {
  if (!term) return 0;
  // \b Türkçe karakterlerle her zaman iyi çalışmaz; esnek sınır kullanıyoruz.
  const re = new RegExp(
    `(^|[^\\p{L}])${escapeRegExp(term)}([^\\p{L}]|$)`,
    "giu"
  );
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function detectSentiment(
  text: string,
  brandName: string,
  brandDomain: string
): Sentiment {
  const lower = text.toLowerCase();
  const nameL = brandName.toLowerCase();
  const domainL = extractDomain(brandDomain);

  // Marka adı geçen cümleleri topla
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const relevant = sentences.filter((s) => {
    const sl = s.toLowerCase();
    return (nameL && sl.includes(nameL)) || (domainL && sl.includes(domainL));
  });
  const scope = relevant.length ? relevant.join(" ").toLowerCase() : lower;

  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_WORDS) pos += countOccurrences(scope, w);
  for (const w of NEGATIVE_WORDS) neg += countOccurrences(scope, w);

  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

/**
 * Konum skoru (1-5, 1 = en iyi).
 * (a) Numaralı liste tespiti: markanın hemen önündeki "N." → skor.
 * (b) Aksi halde metindeki göreli ilk-geçiş konumu.
 */
function detectPosition(
  text: string,
  brandName: string,
  brandDomain: string
): number | null {
  const nameL = brandName.toLowerCase();
  const domainL = extractDomain(brandDomain);
  const lower = text.toLowerCase();

  const idxName = nameL ? lower.indexOf(nameL) : -1;
  const idxDomain = domainL ? lower.indexOf(domainL) : -1;
  let idx = -1;
  if (idxName >= 0 && idxDomain >= 0) idx = Math.min(idxName, idxDomain);
  else idx = Math.max(idxName, idxDomain);
  if (idx < 0) return null;

  // (a) Numaralı liste: markadan önceki en yakın "N." ara (aynı satır/yakın)
  const before = text.slice(Math.max(0, idx - 80), idx);
  const listMatch = [...before.matchAll(/(\d{1,2})[.)]\s/g)];
  if (listMatch.length) {
    const n = parseInt(listMatch[listMatch.length - 1][1], 10);
    if (n >= 1 && n <= 20) {
      // 1→1, 2→1.5, 3→2, ... kabaca 5'e sıkıştır
      return Math.min(5, Math.max(1, Math.round((n + 1) / 2)));
    }
  }

  // (b) Göreli konum: metnin başında → 1, sonunda → 5
  const ratio = idx / Math.max(1, text.length);
  return Math.min(5, Math.max(1, Math.round(1 + ratio * 4)));
}

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

function extractCitations(
  text: string,
  extra: string[],
  brandDomain: string,
  competitorDomains: string[]
): { domain: string; url: string; domainType: DomainType }[] {
  const urls = new Set<string>();
  const found = text.match(URL_REGEX) ?? [];
  for (const u of found) urls.add(u.replace(/[.,;]+$/, ""));
  for (const u of extra) if (u) urls.add(u.trim());

  const seen = new Set<string>();
  const result: { domain: string; url: string; domainType: DomainType }[] = [];
  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain || seen.has(url)) continue;
    seen.add(url);
    result.push({
      domain,
      url,
      domainType: classifyDomain(domain, brandDomain, competitorDomains),
    });
  }
  return result;
}

export interface ParseInput {
  response: string;
  brandName: string;
  brandDomain: string;
  competitors: Competitor[];
  /** API kaynaklı ekstra citation URL'leri (Perplexity/DataForSEO). */
  extraCitations?: string[];
}

export function parseResponse(input: ParseInput): ParsedResponse {
  const { response, brandName, brandDomain, competitors } = input;
  const text = response ?? "";

  const nameCount = countMentions(text, brandName);
  const domainCount = brandDomain
    ? countOccurrences(text.toLowerCase(), extractDomain(brandDomain))
    : 0;
  const mentionCount = nameCount + domainCount;
  const mentioned = mentionCount > 0;

  const competitorMentions: Record<string, boolean> = {};
  for (const c of competitors) {
    const byName = countMentions(text, c.name) > 0;
    const byDomain = c.domain
      ? text.toLowerCase().includes(extractDomain(c.domain))
      : false;
    competitorMentions[c.name] = byName || byDomain;
  }

  const positionScore = mentioned
    ? detectPosition(text, brandName, brandDomain)
    : null;
  const sentiment = mentioned
    ? detectSentiment(text, brandName, brandDomain)
    : "neutral";

  const citations = extractCitations(
    text,
    input.extraCitations ?? [],
    brandDomain,
    competitors.map((c) => c.domain)
  );

  return {
    mentioned,
    mentionCount,
    positionScore,
    sentiment,
    competitorMentions,
    citations,
  };
}
