import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runModel, modelStatuses } from "@/lib/ai/engines";
import { askJSON, extractJSON } from "@/lib/ai/assistant";

const KEYS = [
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "PERPLEXITY_API_KEY",
  "POLLINATIONS_ENABLED",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  for (const k of KEYS) vi.stubEnv(k, "");
  vi.stubEnv("POLLINATIONS_ENABLED", "false");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("model durumu", () => {
  it("anahtar yoksa hepsi manuel", () => {
    expect(modelStatuses().every((m) => !m.auto)).toBe(true);
  });

  it("Groq anahtarı ChatGPT'yi açar, Gemini anahtarı Gemini'yi", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("GEMINI_API_KEY", "AIza_test");
    const st = Object.fromEntries(modelStatuses().map((m) => [m.model, m]));
    expect(st.openai.auto).toBe(true);
    expect(st.openai.engine?.exact).toBe(false);
    expect(st.gemini.auto).toBe(true);
    expect(st.claude.auto).toBe(false);
    expect(st.google_aio.auto).toBe(false);
  });
});

describe("runModel", () => {
  it("Groq'u OpenAI uyumlu formatta çağırır", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "1. Trendyol" } }] }));
    const res = await runModel("openai", "en iyi site?");
    expect(res.text).toBe("1. Trendyol");
    expect(res.engine.provider).toBe("groq");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer gsk_test");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.messages).toEqual([{ role: "user", content: "en iyi site?" }]);
  });

  it("bir sağlayıcı hata verirse sıradakine geçer", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("OPENROUTER_API_KEY", "or_test");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: "rate limit" } }, 429))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "cevap" } }] }));
    const res = await runModel("openai", "soru");
    expect(res.engine.provider).toBe("openrouter");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hepsi başarısızsa anlaşılır hata verir", async () => {
    vi.stubEnv("GROQ_API_KEY", "bad");
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "Invalid API Key" } }, 401));
    await expect(runModel("openai", "soru")).rejects.toThrow(/anahtarı geçersiz.*Invalid API Key/);
  });

  it("anahtar yoksa manuel teste yönlendirir", async () => {
    await expect(runModel("claude", "soru")).rejects.toThrow(/Manuel Test/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Gemini arama kaynaklarını domain olarak döndürür", async () => {
    vi.stubEnv("GEMINI_API_KEY", "AIza_test");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          {
            content: { parts: [{ text: "Trendyol ve Hepsiburada öne çıkıyor." }] },
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "trendyol.com" } },
                { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def", title: "webrazzi.com" } },
              ],
            },
          },
        ],
      })
    );
    const res = await runModel("gemini", "soru");
    expect(res.citations).toEqual(["https://trendyol.com", "https://webrazzi.com"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("models/gemini-2.5-flash:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("AIza_test");
    expect(JSON.parse(init.body).tools).toEqual([{ google_search: {} }]);
  });

  it("Gemini arama aracı reddedilirse aramasız tekrar dener", async () => {
    vi.stubEnv("GEMINI_API_KEY", "AIza_test");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: "tool not allowed" } }, 400))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }));
    const res = await runModel("gemini", "soru");
    expect(res.text).toBe("ok");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tools).toBeUndefined();
  });

  it("Perplexity kaynak listesini alır", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "pplx");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: "cevap [1]" } }],
        citations: ["https://a.com/x"],
        search_results: [{ url: "https://b.com" }, { url: "https://a.com/x" }],
      })
    );
    const res = await runModel("perplexity", "soru");
    expect(res.citations).toEqual(["https://a.com/x", "https://b.com"]);
  });
});

describe("yardımcı AI", () => {
  it("kod bloğu içindeki JSON'u ayıklar", () => {
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJSON('Tabii: {"a":2} umarım işe yarar')).toEqual({ a: 2 });
    expect(extractJSON("json yok")).toBeNull();
  });

  it("sağlayıcı yoksa null döner (kural tabanlı yedek devreye girer)", async () => {
    expect(await askJSON("s", "p")).toBeNull();
  });

  it("ilk sağlayıcı bozuk JSON verirse sonrakine geçer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GROQ_API_KEY", "q");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "bozuk" }] } }] }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: '{"brandName":"X"}' } }] }));
    const r = await askJSON<{ brandName: string }>("s", "p");
    expect(r).toEqual({ data: { brandName: "X" }, provider: "Groq" });
  });
});
