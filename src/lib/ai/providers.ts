import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, requestJSON } from "./http";
import { candidateModels, demoteModel, knownModel, type DiscoverableProvider } from "./models";

/**
 * Yapay zeka sağlayıcıları. Hepsi sunucu tarafında çağrılır; anahtarlar
 * yalnızca ortam değişkenlerinden (.env.local) okunur, tarayıcıya gitmez.
 */
export type ProviderId =
  | "gemini"
  | "groq"
  | "local"
  | "pollinations"
  | "openai"
  | "anthropic"
  | "perplexity";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  free: boolean;
  /** Ayarın okunduğu ortam değişkeni. */
  envKey: string;
  /** .env.local dosyasına yazılacak örnek değer. */
  envExample: string;
  signupUrl?: string;
  note: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    free: true,
    envKey: "GEMINI_API_KEY",
    envExample: "anahtarınız",
    signupUrl: "https://aistudio.google.com/apikey",
    note: "Gemini'yi ölçer. Ücretsiz katmanın günlük istek sınırı vardır.",
  },
  groq: {
    id: "groq",
    label: "Groq",
    free: true,
    envKey: "GROQ_API_KEY",
    envExample: "anahtarınız",
    signupUrl: "https://console.groq.com/keys",
    note: "ChatGPT'yi, OpenAI'nin açık modeli gpt-oss ile yaklaşık ölçer. Kurulumdaki site analizini de yapar.",
  },
  local: {
    id: "local",
    label: "Yerel model",
    free: true,
    envKey: "LOCAL_AI_URL",
    envExample: "http://localhost:11434/v1",
    note: "Bilgisayarınızdaki model (Ollama, LM Studio, llama.cpp). Anahtar ve sınır yok; site analizi ve önerilerde kullanılır.",
  },
  pollinations: {
    id: "pollinations",
    label: "Pollinations",
    free: true,
    envKey: "POLLINATIONS_ENABLED",
    envExample: "true",
    signupUrl: "https://pollinations.ai",
    note: "Anahtarsız deneme modu: küçük bir açık modelle, 45 saniyede bir cevap. Sonuçlar yaklaşıktır.",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    free: false,
    envKey: "OPENAI_API_KEY",
    envExample: "anahtarınız",
    signupUrl: "https://platform.openai.com/api-keys",
    note: "ChatGPT'yi OpenAI'nin kendi modeliyle ölçer.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    free: false,
    envKey: "ANTHROPIC_API_KEY",
    envExample: "anahtarınız",
    signupUrl: "https://console.anthropic.com/settings/keys",
    note: "Claude'u ölçer.",
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    free: false,
    envKey: "PERPLEXITY_API_KEY",
    envExample: "anahtarınız",
    signupUrl: "https://www.perplexity.ai/settings/api",
    note: "Perplexity'yi kaynak listesiyle birlikte ölçer.",
  },
};

const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/** LOCAL_AI_URL'i OpenAI uyumlu taban adrese çevirir (…/v1). */
export function localBaseUrl(): string | undefined {
  const raw = env("LOCAL_AI_URL");
  if (!raw) return undefined;
  const url = raw.replace(/\/+$/, "");
  return /\/v\d+$/.test(url) ? url : `${url}/v1`;
}

export function isProviderConfigured(id: ProviderId): boolean {
  if (id === "pollinations") return env("POLLINATIONS_ENABLED") !== "false";
  if (id === "local") return !!localBaseUrl();
  return !!env(PROVIDERS[id].envKey);
}

// ---------------------------------------------------------------------------

export interface ChatRequest {
  prompt: string;
  system?: string;
  /** "test": son kullanıcının göreceği cevaba en yakın ayarlar. "assistant": yapılandırılmış yardımcı işler. */
  purpose: "test" | "assistant";
  /** Cevabın JSON olması istendiğinde true. */
  json?: boolean;
  timeoutMs?: number;
}

export interface ChatResult {
  text: string;
  /** Sağlayıcının döndürdüğü kaynak URL'leri (Perplexity, Gemini arama). */
  citations: string[];
  /** Cevabı gerçekten veren model. */
  model: string;
}

/** Bazı açık modeller düşünme sürecini cevabın içine yazar; onu ayıklar. */
export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();
}

// ---- OpenAI uyumlu sağlayıcılar (Groq, Pollinations, yerel, OpenAI, Perplexity) ----

interface CompatOptions {
  url: string;
  apiKey?: string;
  model: string;
  jsonMode: boolean;
  tokenParam: "max_tokens" | "max_completion_tokens";
  maxTokens: number;
  /** Yalnızca yardımcı işlerde ve destekleyen sağlayıcılarda gönderilir. */
  assistantTemperature?: number;
  /** İstek gövdesine eklenecek sağlayıcıya özgü alanlar */
  extraBody?: () => Record<string, unknown>;
  timeoutMs: number;
}

interface CompatResponse {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  citations?: string[];
  search_results?: { url?: string }[];
}

async function chatCompat(o: CompatOptions, req: ChatRequest): Promise<ChatResult> {
  const messages: { role: string; content: string }[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.prompt });

  const body: Record<string, unknown> = { model: o.model, messages, [o.tokenParam]: o.maxTokens, ...o.extraBody?.() };
  // Test cevaplarında sıcaklığı sağlayıcının varsayılanında bırakırız: gerçek kullanıcının gördüğüne en yakın olan budur.
  if (req.purpose === "assistant" && o.assistantTemperature !== undefined) body.temperature = o.assistantTemperature;
  if (req.json && o.jsonMode) body.response_format = { type: "json_object" };

  const data = await requestJSON<CompatResponse>({
    url: o.url,
    headers: o.apiKey ? { Authorization: `Bearer ${o.apiKey}` } : {},
    body,
    timeoutMs: req.timeoutMs ?? o.timeoutMs,
  });

  const choice = data.choices?.[0];
  const text = stripReasoning(choice?.message?.content ?? "");
  if (!text) {
    throw new ProviderError(
      choice?.finish_reason === "length"
        ? "Model cevabı tamamlayamadan uzunluk sınırına ulaştı"
        : "Model boş cevap döndürdü",
      "response"
    );
  }

  const citations = [
    ...(Array.isArray(data.citations) ? data.citations : []),
    ...(Array.isArray(data.search_results) ? data.search_results.map((s) => s?.url ?? "") : []),
  ].filter((u): u is string => typeof u === "string" && u.length > 0);

  return { text, citations: [...new Set(citations)], model: data.model || o.model };
}

// ---- Gemini ----

interface GeminiResponse {
  modelVersion?: string;
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

// Google aramasıyla destekleme her katmanda açık değildir. Reddedilirse bir süre denemeyiz
// (her test için boşa bir istek harcamamak adına).
const gs = globalThis as unknown as { __geobySearchOffUntil?: number };

async function chatGemini(apiKey: string, model: string, req: ChatRequest): Promise<ChatResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig: Record<string, unknown> = { maxOutputTokens: 8192 };
  if (req.json) generationConfig.responseMimeType = "application/json";

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
    generationConfig,
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

  const send = (withSearch: boolean) =>
    requestJSON<GeminiResponse>({
      url,
      headers: { "x-goog-api-key": apiKey },
      body: withSearch ? { ...body, tools: [{ google_search: {} }] } : body,
      timeoutMs: req.timeoutMs ?? 90000,
      // Aramalı deneme başarısız olursa beklemeden aramasız deneriz
      retries: withSearch ? 0 : 2,
    });

  const wantSearch = req.purpose === "test" && !req.json && (gs.__geobySearchOffUntil ?? 0) < Date.now();
  let data: GeminiResponse;
  if (wantSearch) {
    try {
      data = await send(true);
    } catch (e) {
      const err = e as ProviderError;
      // Anahtar/model sorunu aramayla ilgili değildir; olduğu gibi bildir
      if (err.kind === "auth" || err.kind === "model" || err.kind === "network" || err.kind === "timeout") throw e;
      data = await send(false);
      gs.__geobySearchOffUntil = Date.now() + 30 * 60 * 1000;
    }
  } else {
    data = await send(false);
  }

  if (data.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini bu soruyu yanıtlamadı (${data.promptFeedback.blockReason})`, "response");
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new ProviderError(
      `Gemini boş cevap döndürdü${cand?.finishReason ? ` (${cand.finishReason})` : ""}`,
      "response"
    );
  }

  // Arama kaynakları: uri bir yönlendirme bağlantısıdır, title ise asıl alan adı (ör. "trendyol.com")
  const citations: string[] = [];
  for (const ch of cand?.groundingMetadata?.groundingChunks ?? []) {
    const title = ch.web?.title?.trim() ?? "";
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(title)) citations.push(`https://${title.toLowerCase()}`);
    else if (ch.web?.uri && !ch.web.uri.includes("grounding-api-redirect")) citations.push(ch.web.uri);
  }
  return { text, citations: [...new Set(citations)], model: data.modelVersion || model };
}

// ---- Anthropic (Claude) ----

async function chatAnthropic(apiKey: string, model: string, req: ChatRequest): Promise<ChatResult> {
  const client = new Anthropic({ apiKey, timeout: req.timeoutMs ?? 120000, maxRetries: 1 });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      ...(req.system ? { system: req.system } : {}),
      messages: [{ role: "user", content: req.prompt }],
    });
    if (response.stop_reason === "refusal") {
      throw new ProviderError("Claude bu soruyu yanıtlamayı reddetti", "response");
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) throw new ProviderError("Claude boş cevap döndürdü", "response");
    return { text, citations: [], model: response.model || model };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new ProviderError("Anthropic API anahtarı geçersiz veya yetkisiz", "auth", e.status);
    }
    if (e instanceof Anthropic.NotFoundError) {
      throw new ProviderError(`Claude modeli bulunamadı (${model}). ANTHROPIC_MODEL değerini kontrol edin.`, "model", 404);
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new ProviderError("Anthropic hız sınırı aşıldı, biraz sonra tekrar deneyin", "rate", 429);
    }
    if (e instanceof Anthropic.APIConnectionError) {
      throw new ProviderError("Anthropic'e bağlanılamadı", "network");
    }
    if (e instanceof Anthropic.APIError) {
      throw new ProviderError(`Anthropic hatası (HTTP ${e.status ?? "?"}): ${e.message.slice(0, 200)}`, "other", e.status);
    }
    throw new ProviderError(`Anthropic'e bağlanılamadı: ${(e as Error).message}`, "network");
  }
}

// ---------------------------------------------------------------------------

const DISCOVERABLE: Partial<Record<ProviderId, DiscoverableProvider>> = {
  gemini: "gemini",
  groq: "groq",
  openai: "openai",
  local: "local",
};

const MODEL_ENV: Record<ProviderId, string> = {
  gemini: "GEMINI_MODEL",
  groq: "GROQ_MODEL",
  local: "LOCAL_AI_MODEL",
  pollinations: "POLLINATIONS_MODEL",
  openai: "OPENAI_MODEL",
  anthropic: "ANTHROPIC_MODEL",
  perplexity: "PERPLEXITY_MODEL",
};

const FIXED_DEFAULT: Partial<Record<ProviderId, string>> = {
  pollinations: "openai",
  anthropic: "claude-opus-5-5",
  perplexity: "sonar",
};

function apiKeyFor(id: ProviderId): string | undefined {
  if (id === "local") return env("LOCAL_AI_KEY");
  if (id === "pollinations") return undefined;
  return env(PROVIDERS[id].envKey);
}

async function modelsFor(id: ProviderId, purpose: "test" | "assistant"): Promise<string[]> {
  const override = env(MODEL_ENV[id]);
  const disc = DISCOVERABLE[id];
  if (!disc) return [override ?? FIXED_DEFAULT[id]!];
  const list = await candidateModels(disc, purpose, {
    apiKey: apiKeyFor(id),
    baseUrl: id === "local" ? localBaseUrl() : undefined,
    override,
  });
  // Yerel sunucu model listesini vermiyorsa (llama.cpp tek model sunar) genel bir adla dene
  return list.length === 0 && id === "local" ? ["default"] : list;
}

/** Durum ekranı için: ağ çağrısı yapmadan bilinen model adı. */
export function knownModelFor(id: ProviderId): string | null {
  const override = env(MODEL_ENV[id]);
  if (override) return override;
  const disc = DISCOVERABLE[id];
  if (!disc) return FIXED_DEFAULT[id] ?? null;
  return knownModel(disc, "test", id === "local" ? localBaseUrl() : undefined);
}

function callProvider(id: ProviderId, model: string, req: ChatRequest): Promise<ChatResult> {
  const key = apiKeyFor(id);
  switch (id) {
    case "gemini":
      return chatGemini(key!, model, req);
    case "anthropic":
      return chatAnthropic(key!, model, req);
    case "groq":
      return chatCompat(
        {
          url: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: key,
          model,
          jsonMode: true,
          tokenParam: "max_completion_tokens",
          maxTokens: 4096,
          assistantTemperature: 0.2,
          timeoutMs: 60000,
        },
        req
      );
    case "pollinations":
      return chatCompat(
        {
          url: "https://text.pollinations.ai/openai",
          model,
          jsonMode: false,
          // Pollinations aynı istek gövdesini saatlerce önbellekten cevaplıyor (x-cache: HIT).
          // Rastgele seed olmadan her test eski cevabın aynısını kaydederdi.
          extraBody: () => ({ seed: Math.floor(Math.random() * 2_000_000_000) }),
          tokenParam: "max_tokens",
          maxTokens: 2000,
          timeoutMs: 90000,
        },
        req
      );
    case "local":
      return chatCompat(
        {
          url: `${localBaseUrl()}/chat/completions`,
          apiKey: key,
          model,
          jsonMode: false,
          tokenParam: "max_tokens",
          maxTokens: 2000,
          assistantTemperature: 0.2,
          // Yerel modeller, özellikle işlemcide, yavaş olabilir
          timeoutMs: 300000,
        },
        req
      );
    case "openai":
      return chatCompat(
        {
          url: "https://api.openai.com/v1/chat/completions",
          apiKey: key,
          model,
          jsonMode: true,
          tokenParam: "max_completion_tokens",
          maxTokens: 4096,
          timeoutMs: 90000,
        },
        req
      );
    case "perplexity":
      return chatCompat(
        {
          url: "https://api.perplexity.ai/chat/completions",
          apiKey: key,
          model,
          jsonMode: false,
          tokenParam: "max_tokens",
          maxTokens: 2000,
          timeoutMs: 90000,
        },
        req
      );
  }
}

/**
 * Bir sağlayıcıyı çağırır. Seçilen model kaldırılmışsa veya bu anahtarla
 * kullanılamıyorsa sıradaki uygun modele geçer.
 */
export async function chat(id: ProviderId, req: ChatRequest): Promise<ChatResult> {
  const info = PROVIDERS[id];
  if (!isProviderConfigured(id)) {
    throw new ProviderError(`${info.label} ayarlı değil (${info.envKey} eksik)`, "config");
  }
  const candidates = await modelsFor(id, req.purpose);
  if (candidates.length === 0) {
    throw new ProviderError(`${info.label} üzerinde bu iş için uygun model bulunamadı`, "model");
  }

  let last: unknown;
  for (const model of candidates.slice(0, 3)) {
    try {
      return await callProvider(id, model, req);
    } catch (e) {
      last = e;
      if (e instanceof ProviderError && e.kind === "model") {
        const disc = DISCOVERABLE[id];
        if (disc) demoteModel(disc, req.purpose, model, id === "local" ? localBaseUrl() : undefined);
        continue;
      }
      throw e;
    }
  }
  throw last;
}
