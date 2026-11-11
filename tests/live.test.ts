/**
 * Gerçek servislere karşı deneme. Varsayılan olarak ATLANIR (ağ ve kota kullanır).
 * Çalıştırmak için:   GEOBY_LIVE=1 npm test -- live
 * .env.local içindeki anahtarlar otomatik okunmaz; komutun başına ekleyin, ör.
 *   GEOBY_LIVE=1 GROQ_API_KEY=... GEMINI_API_KEY=... npm test -- live
 */
import { describe, expect, it } from "vitest";
import { runModel } from "@/lib/ai/engines";
import { askJSON } from "@/lib/ai/assistant";

const live = process.env.GEOBY_LIVE === "1";
const QUESTION = "Türkiye'de en çok bilinen üç e-ticaret sitesi hangileri? Kısa cevap ver.";

describe.runIf(live)("canlı servisler", () => {
  it.runIf(!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY)(
    "Pollinations (anahtarsız) gerçek bir cevap döndürür",
    async () => {
      const res = await runModel("openai", QUESTION);
      console.log(`[${res.via}] ${res.text.slice(0, 200)}`);
      expect(res.text.length).toBeGreaterThan(10);
      expect(res.via).toMatch(/^Pollinations · /);
    },
    150_000
  );

  it.runIf(!!process.env.GROQ_API_KEY)(
    "Groq: ChatGPT ölçümü ve JSON yardımcı",
    async () => {
      const res = await runModel("openai", QUESTION);
      console.log(`[${res.via}] ${res.text.slice(0, 200)}`);
      expect(res.via).toMatch(/^Groq · /);
      const j = await askJSON<{ sites: string[] }>("Yalnızca JSON döndür.", 'Şu JSON\'u doldur: {"sites": ["..."]} — üç Türk e-ticaret sitesi.');
      expect(Array.isArray(j?.data.sites)).toBe(true);
    },
    120_000
  );

  it.runIf(!!process.env.GEMINI_API_KEY)(
    "Gemini: güncel model keşfi ve cevap",
    async () => {
      const res = await runModel("gemini", QUESTION);
      console.log(`[${res.via}] kaynak=${res.citations.length} ${res.text.slice(0, 200)}`);
      expect(res.text.length).toBeGreaterThan(10);
    },
    150_000
  );

  it.runIf(!!process.env.LOCAL_AI_URL)(
    "Yerel model cevap verir",
    async () => {
      const res = await runModel("local", QUESTION);
      console.log(`[${res.via}] ${res.text.slice(0, 200)}`);
      expect(res.text.length).toBeGreaterThan(5);
    },
    320_000
  );
});
