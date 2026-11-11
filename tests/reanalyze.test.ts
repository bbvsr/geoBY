import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("yeniden analiz ve silme (yerel veritabanı)", () => {
  beforeAll(() => {
    vi.stubEnv("GEOBY_STORAGE", "local");
    vi.stubEnv("GEOBY_DATA_DIR", mkdtempSync(path.join(tmpdir(), "geoby-re-")));
  });
  afterAll(() => vi.unstubAllEnvs());

  it("rakip eklenince ve marka adı değişince eski cevaplar güncellenir; test ve marka silinebilir", async () => {
    const { db } = await import("@/lib/db");
    const { saveTestResult, reanalyzeBrand } = await import("@/lib/testing");
    const store = db();

    const brand = await store.completeOnboarding({
      brandName: "KalemKutu",
      domain: "kalemkutu.com",
      category: "",
      description: "",
      selectedModels: ["openai"],
      prompts: [{ text: "en iyi kırtasiye sitesi", topic: "Genel" }],
      competitors: [],
    });
    const [prompt] = await store.getPrompts(brand.id);
    const { run } = await saveTestResult({
      brand,
      competitors: [],
      prompt,
      model: "openai",
      queryText: prompt.text,
      response: "1. Ofis Market\n2. Kalem Kutu Plus — https://kalemkutuplus.com",
      extraCitations: ["https://webrazzi.com"],
      source: "manual",
    });
    expect(run.mentioned).toBe(false);

    // Rakip eklenir → geçmiş cevapta rakip görünür
    await store.addCompetitor(brand.id, "Ofis Market", "ofismarket.com");
    await reanalyzeBrand(brand);
    let [r] = await store.getRuns({ brandId: brand.id });
    expect(r.competitor_mentions).toEqual({ "Ofis Market": true });

    // Marka adı düzeltilir → geçmiş cevapta marka bulunur, kaynak türü "You" olur
    const renamed = (await store.updateBrand(brand.id, { name: "Kalem Kutu Plus", domain: "kalemkutuplus.com" }))!;
    await reanalyzeBrand(renamed);
    [r] = await store.getRuns({ brandId: brand.id });
    expect(r.mentioned).toBe(true);
    expect(r.position_score).toBe(2);
    const cites = await store.getCitationsForRuns([r.id]);
    // Asistanın verdiği (metinde geçmeyen) kaynak korunur
    expect(cites.map((c) => [c.domain, c.domain_type]).sort()).toEqual([
      ["kalemkutuplus.com", "You"],
      ["webrazzi.com", "Editorial"],
    ]);

    await store.deleteRun(r.id);
    expect(await store.getRuns({ brandId: brand.id })).toHaveLength(0);
    expect(await store.getCitationsForRuns([r.id])).toHaveLength(0);

    await store.deleteBrand(brand.id);
    expect(await store.getPrimaryBrand()).toBeNull();
    expect(await store.getPrompts(brand.id, false)).toHaveLength(0);
  });
});
