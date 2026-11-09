import type { CrawlResult } from "@/types";
import { extractDomain } from "@/lib/utils";
import { askJSON } from "@/lib/ai/assistant";
import type { SiteSnapshot } from "@/lib/scraper";

export const TOPICS = ["Genel", "Kategori", "Core", "Affiliate", "Rakip", "Ücretsiz araç"] as const;

// ---------------------------------------------------------------------------
// Yapay zeka destekli site analizi (varsa). Yoksa kural tabanlı sonuç döner.
// ---------------------------------------------------------------------------

interface AiSiteAnalysis {
  brandName?: string;
  category?: string;
  description?: string;
  targetAudience?: string;
  prompts?: { text?: string; topic?: string }[];
  competitors?: { name?: string; domain?: string }[];
}

const ANALYSIS_SYSTEM = `Sen bir GEO (Generative Engine Optimization) uzmanısın. Görevin, bir markanın
yapay zeka asistanlarında (ChatGPT, Gemini, Claude, Perplexity) ne kadar önerildiğini ölçmek için
kurulum bilgisi hazırlamak. Yalnızca geçerli JSON döndür, açıklama yazma.`;

function analysisPrompt(domain: string, text: string, fetched: boolean): string {
  return `Alan adı: ${domain}
${fetched ? `Siteden toplanan içerik:\n${text}` : "Site içeriği çekilemedi; yalnızca alan adı ve genel bilgine dayan."}

Şu JSON'u üret:
{
  "brandName": "markanın kısa, yaygın kullanılan adı",
  "category": "1-3 kelimelik ürün/hizmet kategorisi (sitenin dilinde)",
  "description": "markayı anlatan tek cümle",
  "targetAudience": "hedef kitle, kısa",
  "competitors": [{"name": "Rakip adı", "domain": "rakip.com"}],
  "prompts": [{"text": "soru", "topic": "Kategori|Core|Affiliate|Rakip|Ücretsiz araç"}]
}

Kurallar:
- competitors: aynı pazarda, aynı ülkede bilinen 4-5 GERÇEK doğrudan rakip. Emin değilsen daha az yaz, uydurma.
- prompts: 6-8 adet. Gerçek bir alıcının ChatGPT'ye yazacağı ticari niyetli, uzun kuyruklu sorular.
  Sitenin dilinde yaz (site Türkçe ise Türkçe). Soruların çoğunda markanın ADI GEÇMESİN
  (ör. "en iyi online kırtasiye sitesi hangisi"), çünkü amaç markanın kendiliğinden önerilip önerilmediğini ölçmek.
  En fazla 2 soru marka veya rakip adı içerebilir (ör. "X alternatifleri").`;
}

function clean(s: unknown, max = 200): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Site taramasını yapay zekayla zenginleştirir. AI yoksa/başarısızsa taramayı aynen döner. */
export async function analyzeSite(snapshot: SiteSnapshot, domain: string): Promise<CrawlResult> {
  const base = snapshot.result;
  const ai = await askJSON<AiSiteAnalysis>(
    ANALYSIS_SYSTEM,
    analysisPrompt(domain, snapshot.text, !!base.fetched)
  );
  if (!ai) return base;

  const d = ai.data;
  const brandDomain = extractDomain(domain);
  const competitors = (Array.isArray(d.competitors) ? d.competitors : [])
    .map((c) => ({ name: clean(c?.name, 60), domain: extractDomain(clean(c?.domain, 100)) }))
    .filter((c) => c.name && c.domain !== brandDomain)
    .slice(0, 6);
  const prompts = (Array.isArray(d.prompts) ? d.prompts : [])
    .map((p) => {
      const topic = clean(p?.topic, 30);
      return {
        text: clean(p?.text, 200),
        topic: (TOPICS as readonly string[]).includes(topic) ? topic : "Genel",
      };
    })
    .filter((p) => p.text.length > 5)
    .slice(0, 10);

  return {
    ...base,
    brandName: clean(d.brandName, 60) || base.brandName,
    category: clean(d.category, 60) || base.category,
    description: clean(d.description, 300) || base.description,
    targetAudience: clean(d.targetAudience, 120) || base.targetAudience,
    competitorHints: competitors.map((c) => c.name),
    suggestedCompetitors: competitors,
    suggestedPrompts: prompts,
    analyzedBy: ai.provider,
  };
}

// ---------------------------------------------------------------------------
// Kural tabanlı yedek (yapay zeka yoksa)
// ---------------------------------------------------------------------------

/** Soru önerisi: AI önerisi varsa onu, yoksa kural tabanlı Türkçe sorular. */
export function generatePrompts(
  crawl: CrawlResult,
  domain: string
): { text: string; topic: string }[] {
  if (crawl.suggestedPrompts?.length) return crawl.suggestedPrompts;

  const brand = crawl.brandName || extractDomain(domain);
  const category = (crawl.category || "yazılım").toLocaleLowerCase("tr");
  const audience = crawl.targetAudience?.toLocaleLowerCase("tr") || "";
  const hints = (crawl.competitorHints || []).filter(Boolean);

  const out: { text: string; topic: string }[] = [];
  const push = (text: string, topic: string) => {
    if (!out.some((o) => o.text.toLowerCase() === text.toLowerCase())) out.push({ text, topic });
  };

  push(`en iyi ${category} hangisi, önerilerin neler`, "Kategori");
  push(`Türkiye'de en çok tercih edilen ${category} markaları`, "Kategori");
  if (audience) push(`${audience} için en iyi ${category}`, "Kategori");
  push(`${category} seçerken nelere dikkat etmeliyim, hangi markayı önerirsin`, "Core");
  push(`uygun fiyatlı ${category} önerisi`, "Ücretsiz araç");
  push(`${brand} güvenilir mi, kullananların yorumları`, "Core");
  push(`${brand} alternatifleri`, "Affiliate");
  for (const h of hints.slice(0, 2)) push(`${brand} mı ${h} mı, hangisi daha iyi`, "Rakip");

  return out.slice(0, 8);
}

/** Rakip önerisi: AI önerisi varsa onu, yoksa sitedeki ipuçları (kullanıcı düzenler). */
export function generateCompetitors(crawl: CrawlResult): { name: string; domain: string }[] {
  if (crawl.suggestedCompetitors?.length) return crawl.suggestedCompetitors;

  const seen = new Set<string>();
  const result: { name: string; domain: string }[] = [];
  for (const h of (crawl.competitorHints || []).filter(Boolean)) {
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
