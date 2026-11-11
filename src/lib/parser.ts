import type { Competitor, DomainType, ParsedResponse, Sentiment } from "@/types";
import { extractDomain, escapeRegExp } from "@/lib/utils";
import { findTerm } from "@/lib/match";

/**
 * LLM cevabını analiz eder (yapay zeka KULLANMAZ — deterministik ve hızlı):
 * marka geçiyor mu, kaç kez, kaçıncı sırada, ton (sentiment), rakipler, kaynaklar.
 */

// ---- Domain sınıflandırma sözlükleri ----
const UGC_DOMAINS = [
  "reddit.com", "youtube.com", "youtu.be", "quora.com", "medium.com", "twitter.com",
  "x.com", "tiktok.com", "facebook.com", "instagram.com", "linkedin.com",
  "g2.com", "capterra.com", "trustpilot.com", "getapp.com", "producthunt.com",
  "eksisozluk.com", "sikayetvar.com", "donanimhaber.com", "technopat.net",
];
const EDITORIAL_DOMAINS = [
  "techcrunch.com", "wired.com", "forbes.com", "bloomberg.com", "theverge.com",
  "businessinsider.com", "cnbc.com", "webrazzi.com", "hurriyet.com.tr",
  "milliyet.com.tr", "ntv.com.tr", "sozcu.com.tr", "haberturk.com", "shiftdelete.net",
];
const REFERENCE_DOMAINS = [
  "wikipedia.org", "developer.mozilla.org", "mdn.io", "vikipedi.org",
];

function domainMatches(domain: string, list: string[]): boolean {
  return list.some((u) => domain === u || domain.endsWith(`.${u}`));
}

export function classifyDomain(
  domain: string,
  brandDomain: string,
  competitorDomains: string[]
): DomainType {
  const d = extractDomain(domain);
  const bd = extractDomain(brandDomain);
  if (bd && (d === bd || d.endsWith(`.${bd}`))) return "You";
  if (
    competitorDomains.some((cd) => {
      const c = extractDomain(cd);
      return c && (d === c || d.endsWith(`.${c}`));
    })
  )
    return "Competitor";
  if (domainMatches(d, UGC_DOMAINS)) return "UGC";
  if (domainMatches(d, EDITORIAL_DOMAINS)) return "Editorial";
  if (domainMatches(d, REFERENCE_DOMAINS)) return "Reference";
  if (/\.(edu|gov|org|k12)(\.[a-z]{2})?$/.test(d)) return "Institutional";
  return "Corporate";
}

// ---- Sentiment kelime listeleri ----
// İngilizce kelimeler tam kelime olarak, Türkçe kelimeler ekleriyle birlikte eşleşir
// ("pahalı" → "pahalıdır" eşleşir; "top" → "topluluk" eşleşmez).
const POSITIVE_EN = [
  "best", "top", "leading", "recommended", "popular", "excellent", "great",
  "powerful", "reliable", "trusted", "favorite", "premier", "strong",
];
const POSITIVE_TR = [
  "en iyi", "lider", "önerilen", "öneririm", "popüler", "güçlü", "güvenilir", "kaliteli",
  "başarılı", "tercih edilen", "üstün", "mükemmel", "avantajlı", "uygun fiyat", "hızlı",
];
const NEGATIVE_EN = [
  "worst", "poor", "limited", "expensive", "weak", "lacking", "outdated",
  "complicated", "difficult", "unreliable", "buggy", "slow",
];
const NEGATIVE_TR = [
  "kötü", "zayıf", "pahalı", "sınırlı", "eksik", "yetersiz", "karmaşık",
  "güvenilmez", "yavaş", "dezavantaj", "şikayet", "sorunlu",
];

const L = "\\p{L}\\p{N}";

function countWord(text: string, word: string, allowSuffix: boolean): number {
  const tail = allowSuffix ? "" : `(?![${L}])`;
  const re = new RegExp(`(?<![${L}])${escapeRegExp(word)}${tail}`, "giu");
  return text.match(re)?.length ?? 0;
}

/**
 * Bir terimin metindeki tüm geçiş aralıkları. Tam kelime eşleşir; Türkçe ek
 * yalnızca kesme işaretiyle kabul edilir ("Getir'den" evet, "getirdi" hayır).
 */
function findRanges(text: string, term: string): [number, number][] {
  return findTerm(text, term);
}

/** Ad ve domain geçişlerini birleştirir; iç içe olanları ("Trendyol" ⊂ "trendyol.com") bir kez sayar. */
function mentionRanges(text: string, name: string, domain: string): [number, number][] {
  const all = [...findRanges(text, name.trim()), ...findRanges(text, extractDomain(domain))].sort(
    (a, b) => a[0] - b[0]
  );
  const merged: [number, number][] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

function detectSentiment(text: string, ranges: [number, number][]): Sentiment {
  // Markanın geçtiği cümleleri al
  const sentences: string[] = [];
  const re = /[^.!?\n]+[.!?\n]*/g;
  for (const m of text.matchAll(re)) {
    const s = m.index!;
    const e = s + m[0].length;
    if (ranges.some(([a, b]) => a < e && b > s)) sentences.push(m[0]);
  }
  const scope = sentences.join(" ").toLocaleLowerCase("tr");
  if (!scope) return "neutral";

  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_EN) pos += countWord(scope, w, false);
  for (const w of POSITIVE_TR) pos += countWord(scope, w, true);
  for (const w of NEGATIVE_EN) neg += countWord(scope, w, false);
  for (const w of NEGATIVE_TR) neg += countWord(scope, w, true);

  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

/**
 * Konum (1 = en iyi): cevapta kaçıncı sırada önerildiği.
 * 1) Marka numaralı bir listenin maddesindeyse o madde numarası,
 * 2) değilse cevapta adı geçen markalar (siz + rakipler) arasındaki sırası.
 */
function detectPosition(
  text: string,
  brandFirst: number,
  competitorFirsts: number[]
): number {
  const lineStart = text.lastIndexOf("\n", brandFirst - 1) + 1;
  const line = text.slice(lineStart, brandFirst);
  const item =
    line.match(/^\s*(?:[#>*_\-\s]*)(\d{1,2})[.)]\s/) ??
    // Markdown tablosu: "| 2 | Hugging Face | ..."
    line.match(/^\s*\|\s*\**(\d{1,2})\.?\**\s*\|/);
  if (item) {
    const n = parseInt(item[1], 10);
    if (n >= 1 && n <= 20) return n;
  }
  return 1 + competitorFirsts.filter((i) => i >= 0 && i < brandFirst).length;
}

const URL_REGEX = /https?:\/\/[^\s<>"'`)\]}]+/gi;

function extractCitations(
  text: string,
  extra: string[],
  brandDomain: string,
  competitorDomains: string[]
): { domain: string; url: string; domainType: DomainType }[] {
  const urls = new Set<string>();
  for (const u of text.match(URL_REGEX) ?? []) urls.add(u.replace(/[.,;:!?*]+$/, ""));
  for (const u of extra) if (u?.trim()) urls.add(u.trim());

  const result: { domain: string; url: string; domainType: DomainType }[] = [];
  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain || !domain.includes(".")) continue;
    result.push({
      domain,
      url,
      domainType: classifyDomain(domain, brandDomain, competitorDomains),
    });
  }
  return result;
}

/** Metinde markanın (adı veya alan adı) geçip geçmediği — ör. sorunun kendisi markalı mı? */
export function textMentions(text: string, name: string, domain: string): boolean {
  return mentionRanges(text ?? "", name, domain).length > 0;
}

export interface ParseInput {
  response: string;
  brandName: string;
  brandDomain: string;
  competitors: Pick<Competitor, "name" | "domain">[];
  /** API kaynaklı ekstra citation URL'leri (Perplexity, Gemini arama). */
  extraCitations?: string[];
}

export function parseResponse(input: ParseInput): ParsedResponse {
  const text = input.response ?? "";
  const ranges = mentionRanges(text, input.brandName, input.brandDomain);
  const mentioned = ranges.length > 0;

  const competitorMentions: Record<string, boolean> = {};
  const competitorFirsts: number[] = [];
  for (const c of input.competitors) {
    const r = mentionRanges(text, c.name, c.domain);
    competitorMentions[c.name] = r.length > 0;
    competitorFirsts.push(r.length ? r[0][0] : -1);
  }

  return {
    mentioned,
    mentionCount: ranges.length,
    positionScore: mentioned ? detectPosition(text, ranges[0][0], competitorFirsts) : null,
    sentiment: mentioned ? detectSentiment(text, ranges) : "neutral",
    competitorMentions,
    citations: extractCitations(
      text,
      input.extraCitations ?? [],
      input.brandDomain,
      input.competitors.map((c) => c.domain)
    ),
  };
}
