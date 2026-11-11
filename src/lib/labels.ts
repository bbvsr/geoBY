import type { DomainType, Sentiment } from "@/types";

export const DOMAIN_TYPE_LABEL: Record<DomainType, string> = {
  You: "Sizin siteniz",
  Competitor: "Rakip sitesi",
  UGC: "Kullanıcı içeriği",
  Editorial: "Haber / yayın",
  Reference: "Ansiklopedi",
  Institutional: "Kurum (.edu, .gov, .org)",
  Corporate: "Şirket sitesi",
  Other: "Diğer",
};

export const DOMAIN_TYPE_HINT: Record<DomainType, string> = {
  You: "Kendi alan adınız",
  Competitor: "Rakip olarak eklediğiniz markaların siteleri",
  UGC: "Forum, sosyal medya, yorum ve şikâyet siteleri",
  Editorial: "Haber siteleri, dergiler, bloglar",
  Reference: "Vikipedi gibi başvuru kaynakları",
  Institutional: "Üniversite, kamu ve dernek siteleri",
  Corporate: "Diğer şirketlerin siteleri, dizinler, karşılaştırma siteleri",
  Other: "Sınıflandırılamayan",
};

/** Kaynak türlerinin çubuk/etiket rengi — sakin, birbirinden ayırt edilebilir tonlar. */
export const DOMAIN_TYPE_COLOR: Record<DomainType, string> = {
  You: "#b5481d",
  Competitor: "#7c5c4a",
  UGC: "#4f7a86",
  Editorial: "#6d8a6a",
  Reference: "#8a7d5c",
  Institutional: "#5b6b7a",
  Corporate: "#a29d92",
  Other: "#cfc8b9",
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "olumlu",
  neutral: "nötr",
  negative: "olumsuz",
};
