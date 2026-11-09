import type { ActionItem, Brand, DomainTypeBreakdown, RankingRow, SourceRow } from "@/types";

/** Veriye göre dinamik GEO aksiyon önerileri (Site dışı / Site içi). */
export function buildActions(
  brand: Brand,
  rankings: RankingRow[],
  sources: SourceRow[],
  domainTypes: DomainTypeBreakdown[],
  totalRuns: number
): ActionItem[] {
  if (totalRuns === 0) {
    return [
      {
        title: "İlk görünürlük testini yapın",
        description:
          "Öneriler test sonuçlarına göre oluşur. \"Tüm Soruları Test Et\" ile otomatik ya da Manuel Test ile cevap yapıştırarak başlayın.",
        priority: "high",
        kind: "owned",
      },
    ];
  }

  const actions: ActionItem[] = [];
  const you = rankings.find((r) => r.isYou);
  const vis = you?.visibility ?? 0;
  const top = rankings.find((r) => !r.isYou && r.visibility > vis);

  if (top) {
    actions.push({
      title: `${top.name} ile aradaki farkı kapatın`,
      description: `${top.name} cevapların %${Math.round(top.visibility * 100)}'inde geçiyor, siz %${Math.round(vis * 100)}. "${brand.name} vs ${top.name}" karşılaştırma sayfası ve "${top.name} alternatifleri" içeriği hazırlayın.`,
      priority: "high",
      kind: "owned",
    });
  }

  if (vis < 0.3) {
    actions.push({
      title: "\"En iyi ...\" listelerine girin",
      description:
        "Modeller genelde liste formatında öneri yapar. Kategorinizdeki \"en iyi\" ve \"önerilen\" listelerini yayınlayan sitelerle iletişime geçin; kendi sitenizde de net, karşılaştırmalı bir kategori sayfası yayınlayın.",
      priority: vis < 0.1 ? "high" : "medium",
      kind: "earned",
    });
  }

  const ugc = domainTypes.find((d) => d.type === "UGC");
  if (ugc && ugc.count > 0) {
    actions.push({
      title: "Kullanıcı içeriği platformlarında görünür olun",
      description: `Kaynakların %${Math.round(ugc.percent)}'i Reddit, YouTube, Ekşi Sözlük, Şikayetvar gibi platformlardan. Bu platformlarda gerçek kullanıcı yorumlarını ve marka yanıtlarını artırın.`,
      priority: "medium",
      kind: "earned",
    });
  }

  const own = sources.find((s) => s.domainType === "You");
  if (!own || own.retrievalRate < 20) {
    actions.push({
      title: "Sitenizi yapay zekanın kaynak göstereceği hale getirin",
      description:
        "Kendi siteniz nadiren kaynak gösteriliyor. Sık sorulan sorular (SSS) sayfası, açık fiyat/özellik tabloları, schema.org işaretlemesi ve llms.txt dosyası ekleyin.",
      priority: "medium",
      kind: "owned",
    });
  }

  const topCorporate = sources.filter((s) => s.domainType === "Corporate" || s.domainType === "Editorial").slice(0, 3);
  if (topCorporate.length) {
    actions.push({
      title: "En çok alıntılanan sitelerde yer alın",
      description: `Modeller en sık şu kaynaklara dayanıyor: ${topCorporate.map((s) => s.key).join(", ")}. Bu sitelerde listelenmek, inceleme veya haber almak görünürlüğü doğrudan artırır.`,
      priority: "medium",
      kind: "earned",
    });
  }

  if (you && you.sentiment > 0 && you.sentiment < 50) {
    actions.push({
      title: "Olumsuz algıyı düzeltin",
      description:
        "Markanızdan bahsedilen cümlelerde olumsuz ifadeler ağır basıyor. Şikayet platformlarında yanıt verin, güncel ve olumlu müşteri yorumlarını öne çıkarın.",
      priority: "high",
      kind: "earned",
    });
  }

  actions.push({
    title: "Rehber içerik merkezi oluşturun",
    description:
      "Kategorinizle ilgili soru-cevap formatında rehberleri tek bir bölümde toplayın. Net başlıklar ve kısa, alıntılanabilir cevaplar modellerin sizi kaynak göstermesini kolaylaştırır.",
    priority: "low",
    kind: "owned",
  });

  return actions;
}

/** Görünürlük seviyesine göre tek cümlelik özet. */
export function keyInsight(
  brand: Brand,
  visibility: number,
  competitorAvg: number,
  totalRuns: number
): string {
  if (totalRuns === 0) {
    return "Henüz test yok. İlk testten sonra burada markanızın durumu özetlenecek.";
  }
  const v = Math.round(visibility * 100);
  const c = Math.round(competitorAvg * 100);
  if (visibility >= 0.3) {
    return `${brand.name} güçlü görünürlükte: cevapların %${v}'inde öneriliyor. Odak: konumu korumak ve olumlu tonu artırmak.`;
  }
  if (visibility >= 0.1) {
    return `${brand.name} cevapların %${v}'inde geçiyor; rakipler ortalama %${c}. Odak: karşılaştırma içerikleriyle farkı kapatmak.`;
  }
  return `${brand.name} cevapların yalnızca %${v}'inde geçiyor. Öncelik: "en iyi" listelerine girmek ve karşılaştırma içeriği üretmek.`;
}
