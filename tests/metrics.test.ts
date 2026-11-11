import { describe, expect, it } from "vitest";
import {
  avgPosition,
  brandRows,
  gaps,
  isBrandedPrompt,
  sentimentSummary,
  sourceRows,
  visibility,
  visibilityChange,
  visibilityTrend,
} from "@/lib/metrics";
import { buildActions, summarySentence } from "@/lib/actions";
import type { Brand, Citation, Competitor, Prompt, Run, Sentiment } from "@/types";

const brand = { id: "b", name: "KalemKutu", domain: "kalemkutu.com", selected_models: ["openai"] } as Brand;
const comps = [
  { id: "c1", name: "Ofis Market", domain: "ofismarket.com" },
  { id: "c2", name: "Kırtasiye Dünyası", domain: "kirtasiyedunyasi.com" },
] as Competitor[];

let seq = 0;
function run(
  mentioned: boolean,
  c: Record<string, boolean>,
  opts: { pos?: number | null; prompt?: string; model?: Run["model"]; daysAgo?: number; sentiment?: Sentiment } = {}
): Run {
  return {
    id: `r${++seq}`,
    prompt_id: opts.prompt ?? "p1",
    model: opts.model ?? "openai",
    response: "",
    query_text: "",
    mentioned,
    mention_count: mentioned ? 1 : 0,
    position_score: mentioned ? (opts.pos ?? 1) : null,
    sentiment: opts.sentiment ?? "neutral",
    competitor_mentions: c,
    source: "manual",
    created_at: new Date(Date.now() - (opts.daysAgo ?? 0) * 86400000).toISOString(),
  };
}

const prompt = (id: string, text: string, active = true) => ({ id, text, is_active: active }) as Prompt;

describe("markalı soru tespiti", () => {
  it("soruda marka adı veya alan adı geçiyorsa markalıdır", () => {
    expect(isBrandedPrompt("KalemKutu alternatifleri", brand)).toBe(true);
    expect(isBrandedPrompt("kalemkutu.com güvenilir mi", brand)).toBe(true);
    expect(isBrandedPrompt("en iyi online kırtasiye sitesi", brand)).toBe(false);
  });
});

describe("görünürlük ve sıralama", () => {
  const runs = [
    run(true, { "Ofis Market": true, "Kırtasiye Dünyası": false }, { pos: 2 }),
    run(false, { "Ofis Market": true, "Kırtasiye Dünyası": true }),
    run(true, { "Ofis Market": false, "Kırtasiye Dünyası": false }, { pos: 1 }),
    run(false, { "Ofis Market": true, "Kırtasiye Dünyası": false }),
  ];

  it("görünürlük ve ortalama sıra yalnızca geçtiği cevaplardan", () => {
    expect(visibility(runs)).toBe(0.5);
    expect(avgPosition(runs)).toBe(1.5);
  });

  it("rakipler görünürlüğe göre sıralanır; SOV toplamı 1'dir", () => {
    const rows = brandRows(runs, brand, comps);
    expect(rows.map((r) => r.name)).toEqual(["Ofis Market", "KalemKutu", "Kırtasiye Dünyası"]);
    expect(rows.reduce((s, r) => s + r.sov, 0)).toBeCloseTo(1);
    expect(rows[1].sov).toBeCloseTo(2 / 6);
  });

  it("silinmiş rakibin eski geçişleri SOV'u bozmaz", () => {
    const withGhost = runs.map((r) => ({ ...r, competitor_mentions: { ...r.competitor_mentions, "Eski Rakip": true } }));
    const rows = brandRows(withGhost, brand, comps);
    expect(rows.reduce((s, r) => s + r.sov, 0)).toBeCloseTo(1);
    expect(rows.find((r) => r.isYou)!.sov).toBeCloseTo(2 / 6);
  });

  it("eşitlikte marka rakibin önüne geçmez", () => {
    const rows = brandRows([run(true, { "Ofis Market": true, "Kırtasiye Dünyası": false })], brand, comps);
    expect(rows[0].name).toBe("Ofis Market");
    expect(rows[1].isYou).toBe(true);
  });

  it("boş veride sıfır döner", () => {
    expect(visibility([])).toBe(0);
    expect(avgPosition([])).toBeNull();
    expect(brandRows([], brand, comps).every((r) => r.visibility === 0 && r.sov === 0)).toBe(true);
  });
});

describe("ton", () => {
  it("yalnızca markanın geçtiği cevaplardan hesaplanır", () => {
    const s = sentimentSummary([
      run(true, {}, { sentiment: "positive" }),
      run(true, {}, { sentiment: "negative" }),
      run(false, {}, { sentiment: "negative" }),
    ]);
    expect(s).toEqual({ score: 55, positive: 1, neutral: 0, negative: 1 });
    expect(sentimentSummary([run(false, {})]).score).toBeNull();
  });
});

describe("dönem karşılaştırması", () => {
  it("önceki dönemde veri yoksa değişim bilinmez (null)", () => {
    expect(visibilityChange([run(true, {}, { daysAgo: 1 })], 7)).toBeNull();
  });
  it("yüzde puan farkını verir", () => {
    const r = [run(true, {}, { daysAgo: 1 }), run(false, {}, { daysAgo: 9 }), run(true, {}, { daysAgo: 10 })];
    expect(visibilityChange(r, 7)).toBeCloseTo(0.5);
  });
});

describe("haftalık trend", () => {
  it("test yapılmayan haftalarda değer yoktur (sıfır gösterilmez)", () => {
    const now = new Date("2026-11-11T12:00:00");
    const r = { ...run(true, { "Ofis Market": true }), created_at: "2026-11-10T09:00:00" };
    const t = visibilityTrend([r], brand, comps, 4, now);
    expect(t).toHaveLength(4);
    expect(t[3]).toEqual({ week: "2026-11-09", KalemKutu: 100, "Ofis Market": 100, "Kırtasiye Dünyası": 0 });
    expect(t[0]).toEqual({ week: "2026-10-19" });
  });
});

describe("fırsatlar", () => {
  it("markanın geçmediği, rakiplerin geçtiği soruları en son teste göre listeler", () => {
    const prompts = [prompt("p1", "en iyi kırtasiye sitesi"), prompt("p2", "toplu ofis siparişi"), prompt("p3", "arşivlenmiş", false)];
    const runs = [
      // p1: eski testte geçmiyordu, son testte geçiyor → fırsat değil
      run(false, { "Ofis Market": true }, { prompt: "p1", daysAgo: 3 }),
      run(true, { "Ofis Market": true }, { prompt: "p1", daysAgo: 1 }),
      // p2: iki asistanda da yok, rakipler var → fırsat
      run(false, { "Ofis Market": true }, { prompt: "p2" }),
      run(false, { "Kırtasiye Dünyası": true }, { prompt: "p2", model: "gemini" }),
      // p3: arşivde → gösterilmez
      run(false, { "Ofis Market": true }, { prompt: "p3" }),
    ];
    expect(gaps(runs, prompts, comps)).toEqual([
      { promptId: "p2", text: "toplu ofis siparişi", competitors: ["Ofis Market", "Kırtasiye Dünyası"], models: ["openai", "gemini"] },
    ]);
  });
});

describe("kaynaklar", () => {
  it("aynı cevapta birden çok geçen site bir kez sayılır", () => {
    const c = (run_id: string, domain: string): Citation =>
      ({ id: Math.random().toString(), run_id, domain, url: `https://${domain}/x`, domain_type: "Corporate", created_at: "" });
    const rows = sourceRows([c("r1", "a.com"), c("r1", "a.com"), c("r2", "a.com"), c("r2", "b.com")], 4, "domain");
    expect(rows[0]).toMatchObject({ key: "a.com", share: 0.5, count: 3 });
    expect(rows[1]).toMatchObject({ key: "b.com", share: 0.25 });
  });
});

describe("özet ve yapılacaklar", () => {
  it("özet cümlesi sırayı ve lideri söyler", () => {
    const brands = brandRows(
      [run(true, { "Ofis Market": true }), run(false, { "Ofis Market": true })],
      brand,
      comps
    );
    expect(summarySentence({ brand, brands, genericRuns: 2, change: -0.1 })).toBe(
      "KalemKutu, genel soruların %50 kadarında öneriliyor; 3 marka arasında 2. sırada. En önde Ofis Market (%100). Önceki döneme göre 10 puan düştü."
    );
  });

  it("test yoksa öneri üretmez", () => {
    expect(
      buildActions({ brand, brands: brandRows([], brand, comps), sources: [], domainTypes: [], gaps: [], sentiment: sentimentSummary([]), genericRuns: 0 })
    ).toEqual([]);
  });
});

describe("eşitlikte sıra", () => {
  it("öndeki rakiple aynı orandaysanız birinci sayılırsınız", () => {
    const runs = [run(true, { "Ofis Market": true }), run(false, {}), run(false, {})];
    const brands = brandRows(runs, brand, comps);
    expect(summarySentence({ brand, brands, genericRuns: 3, change: null })).toBe(
      "KalemKutu, genel soruların %33 kadarında öneriliyor ve en önde; Ofis Market ile aynı düzeyde."
    );
  });
  it("hiç önerilmiyorsanız en çok önerilen rakibi söyler", () => {
    const brands = brandRows([run(false, { "Ofis Market": true })], brand, comps);
    expect(summarySentence({ brand, brands, genericRuns: 1, change: null })).toBe(
      "KalemKutu, genel soruların %0 kadarında öneriliyor. En çok önerilen rakip Ofis Market (%100)."
    );
  });
});
