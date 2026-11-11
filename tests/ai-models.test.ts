import { describe, expect, it } from "vitest";
import { rankGeminiModels, rankGroqModels, rankOpenAIModels } from "@/lib/ai/models";
import { retryAfterSeconds } from "@/lib/ai/http";
import { stripReasoning } from "@/lib/ai/providers";

describe("Gemini model seçimi", () => {
  // Kasım 2026'daki gerçek listeye benzer bir örnek
  const live = [
    "models/gemini-2.5-flash",
    "models/gemini-2.5-flash-lite",
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.8-flash",
    "models/gemini-3.8-flash-preview-09-2026",
    "models/gemini-flash-latest",
    "models/gemini-flash-lite-latest",
    "models/gemini-pro-latest",
    "models/gemini-3.1-pro-preview",
    "models/gemini-4-argon",
    "models/gemini-3.8-flash-image",
    "models/gemini-2.5-flash-preview-tts",
    "models/gemini-live-2.5-flash",
    "models/gemini-embedding-001",
    "models/gemma-4-31b-it",
  ];

  it("en yeni kararlı Flash'ı seçer, takma adı ikinci sıraya koyar", () => {
    const ranked = rankGeminiModels(live);
    expect(ranked[0]).toBe("gemini-3.8-flash");
    expect(ranked[1]).toBe("gemini-flash-latest");
    expect(ranked).toContain("gemini-2.5-flash");
  });

  it("görsel, ses, gömme ve Gemma modellerini eler", () => {
    const ranked = rankGeminiModels(live);
    expect(ranked.some((id) => /image|tts|live|embedding|gemma/.test(id))).toBe(false);
  });

  it("Flash, Flash-Lite ve Pro'nun önündedir; önizleme kararlının arkasındadır", () => {
    expect(rankGeminiModels(["gemini-3.5-flash-lite", "gemini-4-argon", "gemini-2.5-flash"])[0]).toBe("gemini-2.5-flash");
    expect(rankGeminiModels(["gemini-4.1-flash-preview", "gemini-3.8-flash"])[0]).toBe("gemini-3.8-flash");
    expect(rankGeminiModels(["gemini-3.8-flash-001", "gemini-3.8-flash"])[0]).toBe("gemini-3.8-flash");
  });

  it("uygun model yoksa boş döner", () => {
    expect(rankGeminiModels(["models/gemini-embedding-001", "models/veo-3"])).toEqual([]);
  });
});

describe("Groq model seçimi", () => {
  const live = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-safeguard-20b",
    "qwen/qwen3.8-27b",
    "whisper-large-v3",
    "meta-llama/llama-prompt-guard-2-86m",
    "groq/compound",
  ];

  it("ChatGPT ölçümünde yalnızca OpenAI açık modellerini kullanır, büyüğü önce", () => {
    expect(rankGroqModels(live, "test")).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  });

  it("gpt-oss yoksa ChatGPT ölçümü için model önermez; yardımcı işlerde başka sohbet modeline düşer", () => {
    const noOss = ["qwen/qwen3.8-27b", "whisper-large-v3"];
    expect(rankGroqModels(noOss, "test")).toEqual([]);
    expect(rankGroqModels(noOss, "assistant")).toEqual(["qwen/qwen3.8-27b"]);
  });
});

describe("OpenAI model seçimi", () => {
  it("en yeni mini modeli seçer, gpt-4o-mini yedekte kalır", () => {
    const ids = ["gpt-4o-mini", "gpt-5.4-mini", "gpt-5-mini", "gpt-6.1-terra", "gpt-5.4-nano", "gpt-4o"];
    expect(rankOpenAIModels(ids)).toEqual(["gpt-5.4-mini", "gpt-5-mini", "gpt-4o-mini"]);
  });
});

describe("bekleme süresi okuma", () => {
  const h = (v?: string) => new Headers(v ? { "retry-after": v } : {});

  it("Retry-After başlığını okur", () => {
    expect(retryAfterSeconds(h("40"), "")).toBe(40);
  });
  it("Gemini retryDelay alanını okur", () => {
    expect(retryAfterSeconds(h(), '{"error":{"details":[{"retryDelay":"32s"}]}}')).toBe(32);
  });
  it("Groq 'try again in' mesajını okur", () => {
    expect(retryAfterSeconds(h(), "Rate limit reached. Please try again in 7.66s.")).toBeCloseTo(7.66);
    expect(retryAfterSeconds(h(), "Please try again in 2m30s")).toBe(150);
  });
  it("bilgi yoksa null döner", () => {
    expect(retryAfterSeconds(h(), "{}")).toBeNull();
  });
});

describe("düşünme metnini ayıklama", () => {
  it("<think> bloğunu atar", () => {
    expect(stripReasoning("<think>önce düşüneyim\n...</think>\nCevap: Tamam")).toBe("Cevap: Tamam");
    expect(stripReasoning("yarım düşünce</think>Cevap")).toBe("Cevap");
    expect(stripReasoning("Düz cevap")).toBe("Düz cevap");
  });
});
