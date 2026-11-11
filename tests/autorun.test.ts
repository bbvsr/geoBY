import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const dir = mkdtempSync(path.join(tmpdir(), "geoby-auto-"));

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("düzenli otomatik test", () => {
  let mode: "ok" | "quota" = "ok";

  beforeAll(() => {
    vi.stubEnv("GEOBY_STORAGE", "local");
    vi.stubEnv("GEOBY_DATA_DIR", dir);
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    vi.stubEnv("POLLINATIONS_ENABLED", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mode === "ok"
          ? json({ model: "openai/gpt-oss-120b", choices: [{ message: { content: "1. KalemKutu\n2. Ofis Market" } }] })
          : json({ error: { message: "Daily limit" } }, 429, { "retry-after": "7200" })
      )
    );
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("zamanı gelmeden çalışmaz, gelince çalışır, kota dolunca tarihi ilerletmez", async () => {
    const { db } = await import("@/lib/db");
    const { runDueTests } = await import("@/lib/autorun");
    const store = db();
    const brand = await store.completeOnboarding({
      brandName: "KalemKutu",
      domain: "kalemkutu.com",
      category: "",
      description: "",
      selectedModels: ["openai", "claude"],
      prompts: [{ text: "en iyi kırtasiye sitesi", topic: "Genel" }],
      competitors: [{ name: "Ofis Market", domain: "" }],
    });

    expect(await runDueTests()).toMatchObject({ ran: false, reason: "Hatırlatıcı kapalı." });

    await store.saveSchedule(brand.id, "weekly", true);
    expect((await runDueTests()).ran).toBe(false); // 7 gün sonrası

    // Zamanı geçmiş gibi yap
    const file = path.join(dir, "geoby.json");
    const data = JSON.parse(readFileSync(file, "utf8"));
    data.schedules[0].next_due_at = new Date(Date.now() - 60_000).toISOString();
    writeFileSync(file, JSON.stringify(data));

    mode = "quota";
    const failed = await runDueTests();
    expect(failed).toMatchObject({ ran: true, answers: 0, errors: 1 });
    expect(new Date((await store.getSchedule(brand.id))!.next_due_at!).getTime()).toBeLessThan(Date.now());

    mode = "ok";
    // Claude'un otomatik bağlantısı yok; yalnızca ChatGPT test edilir
    const ok = await runDueTests();
    expect(ok).toMatchObject({ ran: true, prompts: 1, answers: 1, mentioned: 1, errors: 0 });
    expect(new Date((await store.getSchedule(brand.id))!.next_due_at!).getTime()).toBeGreaterThan(Date.now() + 6 * 86400000);
    // Tekrarlı ölçüm: 3 kez sorulur; kota dolarsa ilk hatada durur
    await store.updateSamples(brand.id, 3);
    const { autoTestPrompt } = await import("@/lib/testing");
    const b3 = (await store.getPrimaryBrand())!;
    const [prompt] = await store.getPrompts(brand.id);
    expect((await autoTestPrompt(b3, [], prompt, ["openai"])).filter((r) => r.success)).toHaveLength(3);
    mode = "quota";
    const calls = (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect(await autoTestPrompt(b3, [], prompt, ["openai"])).toHaveLength(1);
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length - calls).toBe(1);
    mode = "ok";

    const runs = await store.getRuns({ brandId: brand.id });
    expect(runs[0]).toMatchObject({ model: "openai", mentioned: true, position_score: 1, source: "api:Groq · openai/gpt-oss-120b" });
  }, 60_000);
});
