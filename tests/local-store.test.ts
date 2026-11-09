import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createLocalStore } from "@/lib/db/local";

describe("yerel veritabanı", () => {
  it("kurulum, test kaydı, filtreler ve alarm uçtan uca çalışır", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "geoby-"));
    const db = createLocalStore(dir);

    expect(await db.getPrimaryBrand()).toBeNull();
    const brand = await db.completeOnboarding({
      brandName: "Marka",
      domain: "marka.com",
      category: "kırtasiye",
      description: "",
      selectedModels: ["openai", "gemini"],
      prompts: [
        { text: "soru 1", topic: "Genel" },
        { text: "soru 2", topic: "Rakip" },
      ],
      competitors: [{ name: "Rakip", domain: "rakip.com" }],
    });
    expect((await db.getPrimaryBrand())?.id).toBe(brand.id);

    const prompts = await db.getPrompts(brand.id);
    expect(prompts.map((p) => p.text)).toEqual(["soru 1", "soru 2"]);

    // Eşzamanlı yazmalar veri kaybetmemeli
    await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        db.createRun({
          prompt_id: prompts[i % 2].id,
          model: i % 2 ? "openai" : "gemini",
          response: `cevap ${i}`,
          query_text: "",
          mentioned: i > 2,
          mention_count: 1,
          position_score: 1,
          sentiment: "neutral",
          competitor_mentions: {},
          source: "manual",
        })
      )
    );
    expect(await db.getRuns({ brandId: brand.id })).toHaveLength(5);
    expect(await db.getRuns({ brandId: brand.id, model: "gemini" })).toHaveLength(2);
    expect(await db.getRunsForPrompt(prompts[0].id)).toHaveLength(2);

    await db.updatePrompt(prompts[0].id, { is_active: false });
    expect(await db.getPrompts(brand.id)).toHaveLength(1);
    expect(await db.getPrompts(brand.id, false)).toHaveLength(2);

    const s = await db.saveSchedule(brand.id, "weekly", true);
    expect(s.is_active).toBe(true);
    await db.markTested(brand.id);
    const after = await db.getSchedule(brand.id);
    expect(after?.last_run_at).toBeTruthy();
    expect(new Date(after!.next_due_at!).getTime()).toBeGreaterThan(Date.now() + 6 * 86400000);

    const c = await db.addCompetitor(brand.id, "Yeni", "yeni.com");
    await db.deleteCompetitor(c.id);
    expect((await db.getCompetitors(brand.id)).map((x) => x.name)).toEqual(["Rakip"]);

    // Dosya geçerli JSON olarak yazılmış olmalı
    JSON.parse(readFileSync(path.join(dir, "geoby.json"), "utf8"));
  });
});
