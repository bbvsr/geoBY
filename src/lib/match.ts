import { escapeRegExp } from "@/lib/utils";

/**
 * Marka/rakip adlarını cevap metninde bulmak için ortak kurallar.
 *
 * Gerçek cevaplarda aynı ad farklı karakterlerle yazılabiliyor:
 * - Boşluk yerine bölünmez boşluk (U+00A0) veya dar bölünmez boşluk (U+202F)
 *   — özellikle GPT tabanlı modeller ("Hugging Face")
 * - Tire yerine bölünmez tire (U+2011) veya kısa çizgi
 * - Türkçe büyük/küçük harf: İ/i ve I/ı (JavaScript'in büyük-küçük harf
 *   duyarsız eşleştirmesi "İstanbul" ile "istanbul"u eşleştirmez)
 */

const L = "\\p{L}\\p{N}";
const SPACE = "[\\s\\u00a0\\u2007\\u2009\\u202f]+";
const DASH = "[-\\u2010\\u2011\\u2012\\u2013]";
const I_ANY = "[iİıI]";

/** Tek bir adın metinde aranacak düzenli ifade kalıbı (kelime sınırlı). */
export function termSource(term: string): string {
  const body = term
    .trim()
    .split(/\s+/)
    .map((word) =>
      [...word]
        .map((ch) => {
          if (/[iİıI]/.test(ch)) return I_ANY;
          if (/[-‐-–]/.test(ch)) return DASH;
          return escapeRegExp(ch);
        })
        .join("")
    )
    .join(SPACE);
  return `(?<![${L}])${body}(?![${L}])`;
}

/** Metinde adın geçtiği tüm aralıklar [başlangıç, bitiş). */
export function findTerm(text: string, term: string): [number, number][] {
  if (!term || term.trim().length < 2) return [];
  const re = new RegExp(termSource(term), "giu");
  const out: [number, number][] = [];
  for (const m of text.matchAll(re)) out.push([m.index!, m.index! + m[0].length]);
  return out;
}
