import { rankOf } from "@/lib/metrics";
import type { ActionItem, Brand, BrandRow, DomainTypeBreakdown, GapItem, SentimentSummary, SourceRow } from "@/types";

const pct = (v: number) => `%${Math.round(v * 100)}`;

/** Verilere göre somut yapılacaklar listesi. */
export function buildActions(args: {
  brand: Brand;
  brands: BrandRow[];
  sources: SourceRow[];
  domainTypes: DomainTypeBreakdown[];
  gaps: GapItem[];
  sentiment: SentimentSummary;
  genericRuns: number;
}): ActionItem[] {
  const { brand, brands, sources, domainTypes, gaps, sentiment, genericRuns } = args;
  if (genericRuns === 0) return [];

  const actions: ActionItem[] = [];
  const you = brands.find((b) => b.isYou)!;
  const leader = brands.find((b) => !b.isYou && b.visibility > you.visibility);

  if (gaps.length > 0) {
    const g = gaps[0];
    actions.push({
      title: `"${g.text}" sorusunda yoksunuz`,
      description: `Bu soruda ${g.competitors.join(", ")} öneriliyor, siz önerilmiyorsunuz. Bu soruyu doğrudan cevaplayan bir sayfa yayınlayın ve rakiplerle karşılaştırma bölümü ekleyin.`,
      priority: "high",
      kind: "owned",
    });
  }

  if (leader) {
    actions.push({
      title: `${leader.name} ile aradaki farkı kapatın`,
      description: `${leader.name} genel soruların ${pct(leader.visibility)} kadarında geçiyor, siz ${pct(you.visibility)}. "${brand.name} mi ${leader.name} mı" karşılaştırma sayfası ve "${leader.name} alternatifleri" içeriği hazırlayın.`,
      priority: "high",
      kind: "owned",
    });
  }

  if (you.visibility < 0.3) {
    actions.push({
      title: "Kategori listelerinde yer alın",
      description:
        "Asistanlar öneri yaparken çoğunlukla \"en iyi ...\" listelerine ve karşılaştırma yazılarına dayanır. Kategorinizde bu listeleri yayınlayan sitelere ürününüzü tanıtın.",
      priority: you.visibility < 0.1 ? "high" : "medium",
      kind: "earned",
    });
  }

  const topThirdParty = sources.filter((s) => s.domainType === "Editorial" || s.domainType === "Corporate").slice(0, 3);
  if (topThirdParty.length > 0) {
    actions.push({
      title: "En çok kaynak gösterilen sitelerde görünün",
      description: `Asistanlar en sık şu sitelere dayanıyor: ${topThirdParty.map((s) => s.key).join(", ")}. Bu sitelerde listelenmek, inceleme veya haber almak doğrudan etki eder.`,
      priority: "medium",
      kind: "earned",
    });
  }

  const ugc = domainTypes.find((d) => d.type === "UGC");
  if (ugc && ugc.share >= 0.15) {
    actions.push({
      title: "Kullanıcı yorum platformlarında görünür olun",
      description: `Kaynakların ${pct(ugc.share)} kadarı forum, sosyal medya ve şikâyet siteleri. Bu platformlardaki sorulara ve yorumlara marka olarak cevap verin.`,
      priority: "medium",
      kind: "earned",
    });
  }

  const own = sources.find((s) => s.domainType === "You");
  if (!own || own.share < 0.2) {
    actions.push({
      title: "Sitenizi kaynak gösterilebilir hale getirin",
      description:
        "Kendi siteniz nadiren kaynak gösteriliyor. Sık sorulan sorular sayfası, açık fiyat ve özellik tabloları, schema.org işaretlemesi ve kısa, alıntılanabilir cümleler ekleyin.",
      priority: "medium",
      kind: "owned",
    });
  }

  if (sentiment.negative > sentiment.positive && sentiment.negative >= 2) {
    actions.push({
      title: "Olumsuz ifadelerin kaynağını bulun",
      description: `Markanızın geçtiği ${sentiment.negative} cevapta olumsuz ifadeler ağır basıyor. Bu cevapları Sorular sayfasında açıp hangi şikâyetlere dayandığına bakın.`,
      priority: "high",
      kind: "earned",
    });
  }

  return actions.slice(0, 6);
}

/** Raporun ilk cümlesi: durumu düz bir dille özetler. */
export function summarySentence(args: {
  brand: Brand;
  brands: BrandRow[];
  genericRuns: number;
  change: number | null;
}): string {
  const { brand, brands, genericRuns, change } = args;
  if (genericRuns === 0) return "";
  const you = brands.find((b) => b.isYou)!;
  const rank = rankOf(brands);
  const leader = brands.find((b) => !b.isYou && b.visibility > you.visibility) ?? brands.find((b) => !b.isYou);
  const tied = brands.filter((b) => !b.isYou && b.visibility === you.visibility && you.visibility > 0);

  let s = `${brand.name}, genel soruların ${pct(you.visibility)} kadarında öneriliyor`;
  if (brands.length === 1 || !leader) {
    s += ".";
  } else if (you.visibility === 0) {
    const top = brands.find((b) => !b.isYou && b.visibility > 0);
    s += top ? `. En çok önerilen rakip ${top.name} (${pct(top.visibility)}).` : `; izlediğiniz rakipler de önerilmiyor.`;
  } else if (rank === 1) {
    s += tied.length ? ` ve en önde; ${tied.map((t) => t.name).join(", ")} ile aynı düzeyde.` : ` ve izlediğiniz markalar arasında en önde.`;
  } else {
    s += `; ${brands.length} marka arasında ${rank}. sırada. En önde ${brands[0].name} (${pct(brands[0].visibility)}).`;
  }
  if (change !== null && Math.abs(change) >= 0.01) {
    s += ` Önceki döneme göre ${Math.round(Math.abs(change) * 100)} puan ${change > 0 ? "yükseldi" : "düştü"}.`;
  }
  return s;
}
