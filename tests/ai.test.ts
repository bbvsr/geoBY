import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modelStatuses, runModel } from "@/lib/ai/engines";
import { askJSON, extractJSON } from "@/lib/ai/assistant";
import { clearModelCache } from "@/lib/ai/models";

const ENV = [
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "PERPLEXITY_API_KEY",
  "LOCAL_AI_URL",
  "LOCAL_AI_MODEL",
  "GEMINI_MODEL",
  "GROQ_MODEL",
];

const GROQ_MODELS = "https://api.groq.com/openai/v1/models";
const GROQ_CHAT = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_MODELS = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
const POLLINATIONS = "https://text.pollinations.ai/openai";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

type Handler = (init: RequestInit & { parsed?: Record<string, unknown> }) => Response | Promise<Response>;

/** URL'ye göre cevap veren sahte fetch. Her URL için sıradaki cevabı kullanır; son cevap tekrar eder. */
function mockFetch(routes: Record<string, (Response | Handler)[]>) {
  const calls: { url: string; init: RequestInit; body?: Record<string, unknown> }[] = [];
  const counters: Record<string, number> = {};
  const fn = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    calls.push({ url, init, body });
    const list = routes[url];
    if (!list) throw new TypeError(`fetch failed (beklenmeyen adres: ${url})`);
    const i = Math.min(counters[url] ?? 0, list.length - 1);
    counters[url] = (counters[url] ?? 0) + 1;
    const r = list[i];
    return typeof r === "function" ? r({ ...init, parsed: body }) : r.clone();
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn, to: (url: string) => calls.filter((c) => c.url === url) };
}

const groqList = () => json({ data: [{ id: "openai/gpt-oss-20b" }, { id: "openai/gpt-oss-120b" }, { id: "whisper-large-v3" }] });
const chatOk = (content: string, model?: string) => json({ model, choices: [{ message: { content }, finish_reason: "stop" }] });

beforeEach(() => {
  for (const k of ENV) vi.stubEnv(k, "");
  vi.stubEnv("POLLINATIONS_ENABLED", "false");
  clearModelCache();
  (globalThis as Record<string, unknown>).__geobySearchOffUntil = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("bağlantı durumu", () => {
  it("anahtar yoksa hiçbir asistan otomatik değildir", () => {
    expect(modelStatuses().every((m) => !m.auto)).toBe(true);
  });

  it("her anahtar kendi asistanını açar ve ölçümün doğruluk düzeyini bildirir", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("GEMINI_API_KEY", "AIza_test");
    const st = Object.fromEntries(modelStatuses().map((m) => [m.model, m]));
    expect(st.openai.engine?.fidelity).toBe("close");
    expect(st.gemini.engine?.fidelity).toBe("exact");
    expect(st.claude.auto).toBe(false);
    expect(st.google_aio.auto).toBe(false);
    expect(st.local.auto).toBe(false);
  });

  it("anahtarsız deneme modu 'kaba' olarak işaretlenir", () => {
    vi.stubEnv("POLLINATIONS_ENABLED", "true");
    const openai = modelStatuses().find((m) => m.model === "openai")!;
    expect(openai.auto).toBe(true);
    expect(openai.engine?.fidelity).toBe("rough");
  });
});

describe("Groq üzerinden ChatGPT ölçümü", () => {
  beforeEach(() => vi.stubEnv("GROQ_API_KEY", "gsk_test"));

  it("modeli listeden seçer ve soruyu olduğu gibi sorar", async () => {
    const f = mockFetch({ [GROQ_MODELS]: [groqList()], [GROQ_CHAT]: [chatOk("1. Trendyol", "openai/gpt-oss-120b")] });
    const res = await runModel("openai", "en iyi site?");
    expect(res.text).toBe("1. Trendyol");
    expect(res.via).toBe("Groq · openai/gpt-oss-120b");
    expect(res.fidelity).toBe("close");

    const call = f.to(GROQ_CHAT)[0];
    expect((call.init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_test");
    expect(call.body).toEqual({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: "en iyi site?" }],
      max_completion_tokens: 4096,
    });
  });

  it("model listesi alınamazsa bilinen modele düşer", async () => {
    const f = mockFetch({ [GROQ_MODELS]: [json({ error: { message: "oops" } }, 500)], [GROQ_CHAT]: [chatOk("cevap")] });
    await runModel("openai", "soru");
    expect(f.to(GROQ_CHAT)[0].body?.model).toBe("openai/gpt-oss-120b");
  });

  it("model kaldırılmışsa sıradaki modele geçer ve bunu hatırlar", async () => {
    const f = mockFetch({
      [GROQ_MODELS]: [groqList()],
      [GROQ_CHAT]: [
        json({ error: { message: "The model `openai/gpt-oss-120b` has been decommissioned." } }, 400),
        chatOk("cevap", "openai/gpt-oss-20b"),
      ],
    });
    const res = await runModel("openai", "soru");
    expect(res.via).toBe("Groq · openai/gpt-oss-20b");
    await runModel("openai", "soru 2");
    expect(f.to(GROQ_CHAT).map((c) => c.body?.model)).toEqual([
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "openai/gpt-oss-20b",
    ]);
  });

  it("hız sınırında sağlayıcının istediği kadar bekleyip yeniden dener", async () => {
    vi.useFakeTimers();
    const f = mockFetch({
      [GROQ_MODELS]: [groqList()],
      [GROQ_CHAT]: [json({ error: { message: "Rate limit reached. Please try again in 7.66s." } }, 429), chatOk("cevap")],
    });
    const p = runModel("openai", "soru");
    await vi.advanceTimersByTimeAsync(7000);
    expect(f.to(GROQ_CHAT)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await p).text).toBe("cevap");
    expect(f.to(GROQ_CHAT)).toHaveLength(2);
  });

  it("günlük kota dolduysa beklemez, ne zaman deneneceğini söyler", async () => {
    const f = mockFetch({
      [GROQ_MODELS]: [groqList()],
      [GROQ_CHAT]: [json({ error: { message: "Daily limit reached" } }, 429, { "retry-after": "7200" })],
    });
    await expect(runModel("openai", "soru")).rejects.toThrow(/kota doldu.*2 saat/);
    expect(f.to(GROQ_CHAT)).toHaveLength(1);
  });

  it("anahtar geçersizse bunu açıkça söyler ve yeniden denemez", async () => {
    const f = mockFetch({
      [GROQ_MODELS]: [json({ error: { message: "Invalid API Key" } }, 401)],
      [GROQ_CHAT]: [json({ error: { message: "Invalid API Key" } }, 401)],
    });
    await expect(runModel("openai", "soru")).rejects.toThrow(/Groq: API anahtarı geçersiz.*Invalid API Key/);
    expect(f.to(GROQ_CHAT)).toHaveLength(1);
  });
});

describe("anahtarsız deneme modu (Pollinations)", () => {
  beforeEach(() => vi.stubEnv("POLLINATIONS_ENABLED", "true"));

  it("402 + Retry-After ile gelen ücretsiz sınırı bekler", async () => {
    vi.useFakeTimers();
    const limit = json(
      { status: 402, success: false, error: { code: "FREE_LIMIT", message: "Free limit reached: 1 reply every 45 seconds per IP." } },
      402,
      { "retry-after": "40" }
    );
    const f = mockFetch({ [POLLINATIONS]: [limit, chatOk("Evet", "gpt-oss-20b")] });
    const p = runModel("openai", "soru");
    await vi.advanceTimersByTimeAsync(39000);
    expect(f.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    const res = await p;
    expect(res.via).toBe("Pollinations · gpt-oss-20b");
    expect(res.fidelity).toBe("rough");
  });

  it("Groq başarısız olursa yedek olarak devreye girer", async () => {
    vi.stubEnv("GROQ_API_KEY", "bad");
    mockFetch({
      [GROQ_MODELS]: [json({ error: { message: "Invalid API Key" } }, 401)],
      [GROQ_CHAT]: [json({ error: { message: "Invalid API Key" } }, 401)],
      [POLLINATIONS]: [chatOk("cevap", "gpt-oss-20b")],
    });
    expect((await runModel("openai", "soru")).via).toBe("Pollinations · gpt-oss-20b");
  });
});

describe("Gemini", () => {
  const list = () =>
    json({
      models: [
        { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
      ],
    });
  const gen = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const answer = (text: string, extra: Record<string, unknown> = {}) =>
    json({ candidates: [{ content: { parts: [{ text }] }, ...extra }], modelVersion: "gemini-3.8-flash" });

  beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "AIza_test"));

  it("güncel Flash modelini keşfeder; arama kaynaklarını alan adı olarak döndürür", async () => {
    const f = mockFetch({
      [GEMINI_MODELS]: [list()],
      [gen("gemini-3.8-flash")]: [
        answer("Trendyol öne çıkıyor.", {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "trendyol.com" } },
              { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def", title: "webrazzi.com" } },
            ],
          },
        }),
      ],
    });
    const res = await runModel("gemini", "soru");
    expect(res.via).toBe("Google Gemini · gemini-3.8-flash");
    expect(res.citations).toEqual(["https://trendyol.com", "https://webrazzi.com"]);
    const call = f.to(gen("gemini-3.8-flash"))[0];
    expect((call.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("AIza_test");
    expect(call.body?.tools).toEqual([{ google_search: {} }]);
    expect((call.body?.generationConfig as Record<string, unknown>).temperature).toBeUndefined();
  });

  it("arama desteği reddedilirse aramasız dener ve sonraki testlerde boşa istek harcamaz", async () => {
    const f = mockFetch({
      [GEMINI_MODELS]: [list()],
      [gen("gemini-3.8-flash")]: [
        json({ error: { message: "Search grounding is not available on the free tier." } }, 400),
        answer("ok"),
      ],
    });
    expect((await runModel("gemini", "soru")).text).toBe("ok");
    await runModel("gemini", "soru 2");
    const bodies = f.to(gen("gemini-3.8-flash")).map((c) => !!c.body?.tools);
    expect(bodies).toEqual([true, false, false]);
  });

  it("ücretsiz katmanda kapalı modelde (limit: 0) sıradaki modele geçer", async () => {
    const f = mockFetch({
      [GEMINI_MODELS]: [list()],
      [gen("gemini-3.8-flash")]: [
        json({ error: { message: "Quota exceeded for metric generate_content_free_tier_requests, limit: 0" } }, 429),
      ],
      [gen("gemini-2.5-flash")]: [answer("eski model")],
    });
    expect((await runModel("gemini", "soru")).text).toBe("eski model");
    expect(f.to(gen("gemini-2.5-flash"))).toHaveLength(1);
  });

  it("GEMINI_MODEL verilmişse keşif yapmaz", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-ozel");
    const f = mockFetch({ [gen("gemini-ozel")]: [answer("ok")] });
    await runModel("gemini", "soru");
    expect(f.to(GEMINI_MODELS)).toHaveLength(0);
  });
});

describe("yerel model", () => {
  it("OpenAI uyumlu yerel sunucuyu kullanır ve düşünme metnini ayıklar", async () => {
    vi.stubEnv("LOCAL_AI_URL", "http://localhost:11434/");
    const f = mockFetch({
      "http://localhost:11434/v1/models": [json({ data: [{ id: "qwen2.5-coder:7b" }] })],
      "http://localhost:11434/v1/chat/completions": [chatOk("<think>hmm</think>Cevap burada", "qwen2.5-coder:7b")],
    });
    const res = await runModel("local", "soru");
    expect(res.text).toBe("Cevap burada");
    expect(res.via).toBe("Yerel model · qwen2.5-coder:7b");
    expect(f.to("http://localhost:11434/v1/chat/completions")[0].body?.model).toBe("qwen2.5-coder:7b");
  });

  it("sunucu kapalıysa anlaşılır hata verir", async () => {
    vi.stubEnv("LOCAL_AI_URL", "http://localhost:8080/v1");
    mockFetch({});
    await expect(runModel("local", "soru")).rejects.toThrow(/Yerel model: Bağlantı kurulamadı/);
  });
});

describe("diğer", () => {
  it("anahtarı olmayan asistan için cevap yapıştırmaya yönlendirir", async () => {
    const f = mockFetch({});
    await expect(runModel("claude", "soru")).rejects.toThrow(/yapıştırarak/);
    expect(f.calls).toHaveLength(0);
  });

  it("Perplexity kaynak listesini alır", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "pplx");
    mockFetch({
      "https://api.perplexity.ai/chat/completions": [
        json({
          model: "sonar",
          choices: [{ message: { content: "cevap [1]" } }],
          citations: ["https://a.com/x"],
          search_results: [{ url: "https://b.com" }, { url: "https://a.com/x" }],
        }),
      ],
    });
    expect((await runModel("perplexity", "soru")).citations).toEqual(["https://a.com/x", "https://b.com"]);
  });
});

describe("yardımcı AI", () => {
  it("kod bloğu içindeki JSON'u ayıklar", () => {
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJSON('Tabii: {"a":2} umarım işe yarar')).toEqual({ a: 2 });
    expect(extractJSON("json yok")).toBeNull();
  });

  it("anahtarsız deneme modunu kullanmaz (uydurma marka riski); sağlayıcı yoksa null döner", async () => {
    vi.stubEnv("POLLINATIONS_ENABLED", "true");
    const f = mockFetch({});
    expect(await askJSON("s", "p")).toBeNull();
    expect(f.calls).toHaveLength(0);
  });

  it("ilk sağlayıcı bozuk JSON verirse sonrakine geçer", async () => {
    vi.stubEnv("GROQ_API_KEY", "q");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GEMINI_MODEL", "gemini-x");
    const f = mockFetch({
      [GROQ_MODELS]: [groqList()],
      [GROQ_CHAT]: [chatOk("bozuk cevap")],
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent": [
        json({ candidates: [{ content: { parts: [{ text: '{"brandName":"X"}' }] } }] }),
      ],
    });
    const r = await askJSON<{ brandName: string }>("s", "p");
    expect(r).toEqual({ data: { brandName: "X" }, provider: "Google Gemini" });
    // Yardımcı işlerde JSON modu ve düşük sıcaklık istenir
    const groq = f.to(GROQ_CHAT)[0].body!;
    expect(groq.response_format).toEqual({ type: "json_object" });
    expect(groq.temperature).toBe(0.2);
  });
});
