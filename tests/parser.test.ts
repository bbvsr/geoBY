import { describe, expect, it } from "vitest";
import { classifyDomain, parseResponse } from "@/lib/parser";

const competitors = [
  { name: "Hepsiburada", domain: "hepsiburada.com" },
  { name: "Amazon", domain: "amazon.com.tr" },
];

const parse = (response: string, brandName = "Trendyol", brandDomain = "trendyol.com") =>
  parseResponse({ response, brandName, brandDomain, competitors });

describe("parseResponse", () => {
  it("ad ve domain iç içe geçtiğinde bir kez sayar", () => {
    const r = parse("En popüler site Trendyol (trendyol.com). Trendyol'da indirim çok.");
    expect(r.mentioned).toBe(true);
    // "Trendyol", "trendyol.com", "Trendyol'da" → 3 ayrı geçiş, iç içe olanlar birleşir
    expect(r.mentionCount).toBe(3);
  });

  it("kısa marka adını Türkçe fiillerle karıştırmaz", () => {
    const r = parse("Bu siparişi kapınıza getirir ve hızlı getirdi.", "Getir", "getir.com");
    expect(r.mentioned).toBe(false);
    const r2 = parse("Getir'den sipariş vermek kolay.", "Getir", "getir.com");
    expect(r2.mentioned).toBe(true);
  });

  it("numaralı listedeki madde numarasını sıra olarak alır", () => {
    const text = "En iyi siteler:\n1. **Hepsiburada** – geniş ürün\n2. Amazon – hızlı\n3. **Trendyol** – uygun fiyat";
    const r = parse(text);
    expect(r.positionScore).toBe(3);
    expect(r.competitorMentions).toEqual({ Hepsiburada: true, Amazon: true });
  });

  it("liste yoksa geçen markalar arasındaki sırayı kullanır", () => {
    const r = parse("Hepsiburada ve Trendyol en bilinenleri.");
    expect(r.positionScore).toBe(2);
  });

  it("geçmiyorsa sıra ve ton boş/nötr", () => {
    const r = parse("Hepsiburada önerilir.");
    expect(r.mentioned).toBe(false);
    expect(r.positionScore).toBeNull();
    expect(r.sentiment).toBe("neutral");
  });

  it("tonu sadece markanın geçtiği cümlelerden ölçer", () => {
    expect(parse("Trendyol en iyi ve güvenilir seçenek. Amazon pahalı.").sentiment).toBe("positive");
    expect(parse("Trendyol pahalıdır ve kargo yavaş.").sentiment).toBe("negative");
    // "topluluk" kelimesi İngilizce "top" sayılmamalı
    expect(parse("Trendyol topluluk sayfası var.").sentiment).toBe("neutral");
  });

  it("kaynakları ayıklar ve sınıflandırır", () => {
    const r = parseResponse({
      response: "Kaynak: https://www.trendyol.com/kampanya, https://reddit.com/r/turkey.",
      brandName: "Trendyol",
      brandDomain: "trendyol.com",
      competitors,
      extraCitations: ["https://tr.wikipedia.org/wiki/Trendyol", "https://hepsiburada.com"],
    });
    const types = Object.fromEntries(r.citations.map((c) => [c.domain, c.domainType]));
    expect(types).toEqual({
      "trendyol.com": "You",
      "reddit.com": "UGC",
      "tr.wikipedia.org": "Reference",
      "hepsiburada.com": "Competitor",
    });
  });
});

describe("classifyDomain", () => {
  it("benzer isimli alan adlarını karıştırmaz", () => {
    expect(classifyDomain("notreddit.com", "x.com", [])).toBe("Corporate");
    expect(classifyDomain("odtu.edu.tr", "x.com", [])).toBe("Institutional");
  });
});
