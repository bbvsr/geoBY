import type {
  ActionItem,
  Brand,
  DomainTypeBreakdown,
  RankingRow,
  SourceRow,
} from "@/types";

/** Veriye göre dinamik aksiyon önerileri (Earned / Owned). */
export function buildActions(
  brand: Brand,
  rankings: RankingRow[],
  sources: SourceRow[],
  domainTypes: DomainTypeBreakdown[]
): ActionItem[] {
  const actions: ActionItem[] = [];
  const you = rankings.find((r) => r.isYou);
  const vis = you?.visibility ?? 0;
  const top = rankings.find((r) => !r.isYou);

  if (top && you && top.visibility > you.visibility) {
    actions.push({
      title: `${top.name} ile görünürlük farkını kapatın`,
      description: `${top.name} sizden daha sık öneriliyor. Karşılaştırma içeriği ve "${brand.name} vs ${top.name}" sayfaları oluşturun.`,
      priority: "high",
      kind: "earned",
    });
  }

  const ugc = domainTypes.find((d) => d.type === "UGC");
  if (ugc && ugc.count > 0) {
    actions.push({
      title: "UGC platformlarındaki varlığınızı artırın",
      description:
        "Reddit, YouTube, Ekşi Sözlük gibi kullanıcı içeriği kaynakları modeller tarafından sık alıntılanıyor. Bu platformlarda görünür olun.",
      priority: "medium",
      kind: "earned",
    });
  }

  if (vis < 0.3) {
    actions.push({
      title: "AI arama görünürlüğünü yükseltin",
      description:
        "Görünürlüğünüz düşük. Öncelik: karşılaştırma ve 'en iyi' listeleri içeriği üreterek modellerin sizi önermesini sağlayın.",
      priority: "high",
      kind: "owned",
    });
  }

  const you_domain = sources.find(
    (s) => s.domainType === "You"
  );
  const retrieval = you_domain?.retrievalRate ?? 0;
  if (retrieval < 20) {
    actions.push({
      title: "Alan adınızı LLM erişimi için optimize edin",
      description:
        "Kendi domaininiz nadiren alıntılanıyor. Yapılandırılmış içerik, SSS ve net başlıklarla LLM'lerin sitenizi kaynak göstermesini kolaylaştırın.",
      priority: "medium",
      kind: "owned",
    });
  }

  actions.push({
    title: "AI için optimize edilmiş içerik merkezi oluşturun",
    description:
      "Kategori, karşılaştırma ve rehber içeriklerini tek bir hub altında toplayarak model alıntılarını artırın.",
    priority: "low",
    kind: "owned",
  });

  const corporate = domainTypes.find((d) => d.type === "Corporate");
  if (corporate && corporate.count > 1) {
    actions.push({
      title: "En çok alıntılanan kurumsal kaynaklara girin",
      description:
        "Modellerin sık alıntıladığı kurumsal/dizin sitelerinde listelenerek görünürlüğünüzü genişletin.",
      priority: "low",
      kind: "earned",
    });
  }

  return actions;
}

/** Görünürlük seviyesine göre "Anahtar İçgörü" metni. */
export function keyInsight(
  brand: Brand,
  visibility: number,
  competitorAvg: number
): string {
  const v = Math.round(visibility * 100);
  const c = Math.round(competitorAvg * 100);
  if (visibility >= 0.3) {
    return `${brand.name} güçlü bir görünürlüğe sahip (%${v}). Odak: mevcut konumu koruyup sentiment'i yükseltmek.`;
  }
  if (visibility >= 0.1) {
    return `${brand.name} sorguların %${v}'inde görünüyor; rakipler ortalama %${c}. Odak: aradaki farkı kapatmak için karşılaştırma içeriği.`;
  }
  return `${brand.name} düşük görünürlükte (%${v}). Öncelik: karşılaştırma ve 'en iyi' listesi içerikleri üreterek AI önerilerinde yer almak.`;
}
