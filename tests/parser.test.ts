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

import { isPublicIp } from "@/lib/net";

describe("site tarama güvenliği", () => {
  it("iç ağ ve özel adresleri reddeder", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });
  it("herkese açık adreslere izin verir", () => {
    for (const ip of ["8.8.8.8", "104.16.0.1", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPublicIp(ip), ip).toBe(true);
    }
  });
});

import { segmentAnswer, plainMarkdown } from "@/lib/highlight";

describe("cevap vurgulama", () => {
  it("markayı, rakibi ve bağlantıyı işaretler", () => {
    const segs = segmentAnswer(
      "1. Trendyol (https://trendyol.com) ve Hepsiburada'da indirim.",
      { name: "Trendyol", domain: "trendyol.com" },
      [{ name: "Hepsiburada", domain: "hepsiburada.com" }]
    );
    expect(segs.filter((s) => s.kind !== "plain").map((s) => [s.kind, s.text])).toEqual([
      ["brand", "Trendyol"],
      ["link", "https://trendyol.com"],
      ["rival", "Hepsiburada"],
    ]);
    expect(segs.map((s) => s.text).join("")).toBe("1. Trendyol (https://trendyol.com) ve Hepsiburada'da indirim.");
  });

  it("markdown işaretlerini temizler", () => {
    expect(plainMarkdown("## Başlık\n**1. Trendyol** – iyi\n- madde")).toBe("Başlık\n1. Trendyol – iyi\n• madde");
  });
});

import { generatePrompts } from "@/lib/generators";

describe("kural tabanlı soru önerisi", () => {
  const base = { title: "", description: "", targetAudience: "", coreUseCase: "", keywords: [], competitorHints: [], brandName: "OpenRouter" };
  it("kategori yoksa soru uydurmaz", () => {
    expect(generatePrompts({ ...base, category: "" }, "openrouter.ai")).toEqual([]);
  });
  it("kısaltmaları bozmaz (API → apı olmaz)", () => {
    const qs = generatePrompts({ ...base, category: "yapay zeka API platformu" }, "openrouter.ai").map((q) => q.text);
    expect(qs[0]).toBe("en iyi yapay zeka API platformu hangisi, önerilerin neler");
    expect(qs.join(" ")).not.toMatch(/apı/);
  });
});

describe("gerçek cevaplardaki yazım farkları", () => {
  const comps = [{ name: "Hugging Face", domain: "huggingface.co" }, { name: "Coca-Cola", domain: "" }];

  it("dar bölünmez boşluk ve bölünmez tire ile yazılan adları bulur", () => {
    const r = parseResponse({
      response: "| 2 | Hugging Face Hub API | geniş |\nAyrıca Coca‑Cola örneği.",
      brandName: "X",
      brandDomain: "x.com",
      competitors: comps,
    });
    expect(r.competitorMentions).toEqual({ "Hugging Face": true, "Coca-Cola": true });
  });

  it("Türkçe İ/ı farkında da eşleşir", () => {
    const r = parseResponse({ response: "istanbul kitapçısı ve İSTANBUL KİTAPÇISI", brandName: "İstanbul Kitapçısı", brandDomain: "", competitors: [] });
    expect(r.mentionCount).toBe(2);
  });

  it("tablo satırındaki sıra numarasını okur", () => {
    const r = parseResponse({
      response: "| Sıra | Servis |\n|---|---|\n| 1 | OpenAI |\n| 2 | Hugging Face |",
      brandName: "Hugging Face",
      brandDomain: "huggingface.co",
      competitors: [],
    });
    expect(r.positionScore).toBe(2);
  });
});

describe("tablo ve alıntı içeren cevapları okunur hale getirme", () => {
  it("tabloyu satır satır düz metne çevirir", () => {
    expect(plainMarkdown("| Sıra | Servis |\n|---|---|\n| 1 | OpenAI |\n> not")).toBe("Sıra · Servis\n1 · OpenAI\nnot");
  });
});
