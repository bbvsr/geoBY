import { extractDomain } from "@/lib/utils";
import { findTerm } from "@/lib/match";

export interface Segment {
  text: string;
  kind: "plain" | "brand" | "rival" | "link";
}


/**
 * Cevap metnini parçalara ayırır: marka adı, rakip adları ve bağlantılar
 * işaretlenir. Eşleştirme kuralları analizdeki (parser) ile aynıdır.
 */
export function segmentAnswer(
  text: string,
  brand: { name: string; domain: string },
  rivals: { name: string; domain: string }[]
): Segment[] {
  type Hit = { start: number; end: number; kind: Segment["kind"] };
  const hits: Hit[] = [];

  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`)\]}]+/gi)) {
    const url = m[0].replace(/[.,;:!?*]+$/, "");
    hits.push({ start: m.index!, end: m.index! + url.length, kind: "link" });
  }

  const addTerm = (term: string, kind: Hit["kind"]) => {
    for (const [start, end] of findTerm(text, term)) hits.push({ start, end, kind });
  };
  addTerm(brand.name.trim(), "brand");
  addTerm(extractDomain(brand.domain), "brand");
  for (const r of rivals) {
    addTerm(r.name.trim(), "rival");
    addTerm(extractDomain(r.domain), "rival");
  }

  // Çakışmalarda önce gelen ve uzun olan kazanır; bağlantılar en öncelikli
  const priority = { link: 0, brand: 1, rival: 2, plain: 3 };
  hits.sort((a, b) => a.start - b.start || priority[a.kind] - priority[b.kind] || b.end - a.end);
  const chosen: Hit[] = [];
  for (const h of hits) {
    const last = chosen[chosen.length - 1];
    if (last && h.start < last.end) continue;
    chosen.push(h);
  }

  const out: Segment[] = [];
  let pos = 0;
  for (const h of chosen) {
    if (h.start > pos) out.push({ text: text.slice(pos, h.start), kind: "plain" });
    out.push({ text: text.slice(h.start, h.end), kind: h.kind });
    pos = h.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), kind: "plain" });
  return out;
}

/** Markdown işaretlerini okunur düz metne indirger (kalın, başlık, tablo çizgileri). */
export function plainMarkdown(text: string): string {
  return text
    // Tablo satırları: "| 1 | Ad | Açıklama |" → "1 · Ad · Açıklama"; ayırıcı satırlar atılır
    .replace(/^[ \t]*\|?([ \t]*:?-{2,}:?[ \t]*\|)+[ \t]*:?-*:?[ \t]*(\n|$)/gm, "")
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_, row: string) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .join(" · ")
    )
    .replace(/^>\s?/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
