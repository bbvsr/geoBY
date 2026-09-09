import type { CrawlResult } from "@/types";
import { extractDomain } from "@/lib/utils";

/**
 * Kural-tabanlı Türkçe soru üretimi (LLM YOK).
 * Marka, kategori, hedef kitle ve rakip ipuçlarından ticari-niyetli,
 * alıcı odaklı sorular türetir.
 */
export function generatePrompts(
  crawl: CrawlResult,
  domain: string
): { text: string; topic: string }[] {
  const brand = crawl.brandName || extractDomain(domain);
  const category = (crawl.category || "yazılım").toLowerCase();
  const audience = crawl.targetAudience?.toLowerCase() || "";
  const hints = (crawl.competitorHints || []).filter(Boolean);

  const out: { text: string; topic: string }[] = [];
  const push = (text: string, topic: string) => {
    if (!out.some((o) => o.text.toLowerCase() === text.toLowerCase()))
      out.push({ text, topic });
  };

  // Kategori odaklı (Core / Category)
  push(`en iyi ${category} araçları neler`, "Kategori");
  push(`${category} için en iyi çözümler`, "Kategori");
  if (audience) {
    push(`${audience} için en iyi ${category} yazılımı`, "Kategori");
  }
  push(`${category} nasıl seçilir, nelere dikkat edilmeli`, "Core");
  push(`ücretsiz ${category} araçları`, "Ücretsiz araç");

  // Marka odaklı (Core / Affiliate)
  push(`${brand} nedir, ne işe yarar`, "Core");
  push(`${brand} alternatifleri`, "Affiliate");
  push(`${brand} yorumları ve kullanıcı deneyimleri`, "Core");

  // Rakip karşılaştırma (Competitor)
  for (const h of hints.slice(0, 2)) {
    push(`${brand} vs ${h} karşılaştırması`, "Rakip");
    push(`${h} alternatifi olarak ${brand}`, "Rakip");
  }

  return out.slice(0, 8);
}

/**
 * Kural-tabanlı rakip önerisi (LLM YOK).
 * Yalnızca site içindeki ipuçlarını kullanır; kullanıcı düzenler/ekler.
 */
export function generateCompetitors(
  crawl: CrawlResult
): { name: string; domain: string }[] {
  const hints = (crawl.competitorHints || []).filter(Boolean);
  const seen = new Set<string>();
  const result: { name: string; domain: string }[] = [];
  for (const h of hints) {
    const name = h.replace(/https?:\/\//, "").split("/")[0];
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const looksDomain = /\.[a-z]{2,}$/i.test(name);
    result.push({
      name: looksDomain ? name.split(".")[0] : name,
      domain: looksDomain ? extractDomain(name) : "",
    });
    if (result.length >= 5) break;
  }
  return result;
}
