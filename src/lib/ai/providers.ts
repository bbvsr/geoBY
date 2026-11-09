import Anthropic from "@anthropic-ai/sdk";

/**
 * Yapay zeka sağlayıcıları. Hepsi sunucu tarafında çağrılır; anahtarlar
 * yalnızca ortam değişkenlerinden (.env.local) okunur, tarayıcıya gitmez.
 */
export type ProviderId =
  | "gemini"
  | "groq"
  | "openrouter"
  | "pollinations"
  | "openai"
  | "anthropic"
  | "perplexity";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  free: boolean;
  /** Anahtarın okunduğu ortam değişkeni (anahtarsız sağlayıcıda yok). */
  envKey?: string;
  signupUrl: string;
  note: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    free: true,
    envKey: "GEMINI_API_KEY",
    signupUrl: "https://aistudio.google.com/apikey",
    note: "Ücretsiz anahtar. Gemini ölçümü + Google arama kaynakları + kurulum analizi.",
  },
  groq: {
    id: "groq",
    label: "Groq",
    free: true,
    envKey: "GROQ_API_KEY",
    signupUrl: "https://console.groq.com/keys",
    note: "Ücretsiz anahtar, çok hızlı. ChatGPT ölçümü OpenAI'nin açık modeli gpt-oss ile yapılır.",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    free: true,
    envKey: "OPENROUTER_API_KEY",
    signupUrl: "https://openrouter.ai/keys",
    note: "Ücretsiz (:free) modeller. Groq'a alternatif.",
  },
  pollinations: {
    id: "pollinations",
    label: "Pollinations",
    free: true,
    signupUrl: "https://pollinations.ai",
    note: "Anahtar gerektirmez; yavaş ve hız sınırlı. Hiç anahtar yoksa son çare olarak kullanılır.",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    free: false,
    envKey: "OPENAI_API_KEY",
    signupUrl: "https://platform.openai.com/api-keys",
    note: "Ücretli. Gerçek ChatGPT modeliyle ölçüm.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    free: false,
    envKey: "ANTHROPIC_API_KEY",
    signupUrl: "https://console.anthropic.com/settings/keys",
    note: "Ücretli. Claude ölçümü için gerekli; yoksa Claude manuel test edilir.",
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    free: false,
    envKey: "PERPLEXITY_API_KEY",
    signupUrl: "https://www.perplexity.ai/settings/api",
    note: "Ücretli. Perplexity ölçümü + gerçek kaynak listesi; yoksa manuel test edilir.",
  },
};

export function providerKey(id: ProviderId): string | undefined {
  const env = PROVIDERS[id].envKey;
  if (!env) return undefined;
  const v = process.env[env]?.trim();
  return v ? v : undefined;
}

export function isProviderConfigured(id: ProviderId): boolean {
  if (id === "pollinations") return process.env.POLLINATIONS_ENABLED !== "false";
  return !!providerKey(id);
}

// ---------------------------------------------------------------------------

export interface ChatRequest {
  prompt: string;
  system?: string;
  /** Cevabın JSON olması istendiğinde true. */
  json?: boolean;
  /** Gemini için Google arama ile kaynaklandırma. */
  webSearch?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatResult {
  text: string;
  /** Sağlayıcının döndürdüğü kaynak URL'leri (Perplexity, Gemini arama). */
  citations: string[];
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

function describeStatus(status: number, body: string): string {
  let detail = "";
  try {
    const j = JSON.parse(body);
    detail = j?.error?.message ?? j?.message ?? j?.error ?? "";
    if (typeof detail !== "string") detail = JSON.stringify(detail);
  } catch {
    detail = body.slice(0, 200);
  }
  const hint =
    status === 401 || status === 403
      ? "API anahtarı geçersiz veya yetkisiz"
      : status === 429
        ? "Hız/kota sınırı aşıldı, biraz sonra tekrar deneyin"
        : status >= 500
          ? "Sağlayıcı geçici olarak yanıt vermiyor"
          : "İstek reddedildi";
  return `${hint} (HTTP ${status})${detail ? `: ${detail}` : ""}`;
}

async function postJSON(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new ProviderError(`Zaman aşımı (${Math.round(timeoutMs / 1000)} sn)`);
    }
    throw new ProviderError(`Bağlantı kurulamadı: ${err.message}`);
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError(describeStatus(res.status, text), res.status);
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("Sağlayıcıdan geçersiz cevap geldi");
  }
}

// ---- OpenAI uyumlu sağlayıcılar (Groq, OpenRouter, Pollinations, OpenAI, Perplexity) ----

interface OpenAICompatOptions {
  url: string;
  apiKey?: string;
  model: string;
  /** response_format: json_object destekleniyorsa true */
  supportsJsonMode: boolean;
  extraHeaders?: Record<string, string>;
}

interface OpenAICompatResponse {
  choices?: { message?: { content?: string | null } }[];
  citations?: string[];
  search_results?: { url?: string }[];
}

async function chatOpenAICompatible(o: OpenAICompatOptions, req: ChatRequest): Promise<ChatResult> {
  const messages: { role: string; content: string }[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.prompt });

  const body: Record<string, unknown> = {
    model: o.model,
    messages,
    max_tokens: req.maxTokens ?? 2000,
    temperature: 0.3,
  };
  if (req.json && o.supportsJsonMode) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = { ...o.extraHeaders };
  if (o.apiKey) headers.Authorization = `Bearer ${o.apiKey}`;

  const data = (await postJSON(o.url, headers, body, req.timeoutMs ?? 60000)) as OpenAICompatResponse;
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new ProviderError("Model boş cevap döndürdü");

  const citations = [
    ...(Array.isArray(data.citations) ? data.citations : []),
    ...(Array.isArray(data.search_results)
      ? data.search_results.map((s) => s.url ?? "").filter(Boolean)
      : []),
  ];
  return { text, citations: [...new Set(citations)] };
}

// ---- Gemini ----

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

async function chatGemini(apiKey: string, model: string, req: ChatRequest): Promise<ChatResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: req.maxTokens ?? 4096,
  };
  if (req.json) generationConfig.responseMimeType = "application/json";

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: req.prompt }] }],
    generationConfig,
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

  const send = (withSearch: boolean) =>
    postJSON(
      url,
      { "x-goog-api-key": apiKey },
      withSearch ? { ...body, tools: [{ google_search: {} }] } : body,
      req.timeoutMs ?? 60000
    ) as Promise<GeminiResponse>;

  let data: GeminiResponse;
  if (req.webSearch && !req.json) {
    try {
      data = await send(true);
    } catch (e) {
      // Arama aracı kotası/izni yoksa aramasız tekrar dene
      if (e instanceof ProviderError && e.status && e.status < 500 && e.status !== 401) {
        data = await send(false);
      } else throw e;
    }
  } else {
    data = await send(false);
  }

  if (data.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini isteği engelledi: ${data.promptFeedback.blockReason}`);
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ProviderError(`Gemini boş cevap döndürdü${cand?.finishReason ? ` (${cand.finishReason})` : ""}`);

  // Arama kaynakları: uri bir yönlendirme linki, title ise asıl domain (örn. "trendyol.com")
  const citations: string[] = [];
  for (const ch of cand?.groundingMetadata?.groundingChunks ?? []) {
    const title = ch.web?.title?.trim() ?? "";
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(title)) citations.push(`https://${title.toLowerCase()}`);
    else if (ch.web?.uri && !ch.web.uri.includes("grounding-api-redirect")) citations.push(ch.web.uri);
  }
  return { text, citations: [...new Set(citations)] };
}

// ---- Anthropic (Claude) ----

async function chatAnthropic(apiKey: string, model: string, req: ChatRequest): Promise<ChatResult> {
  const client = new Anthropic({ apiKey, timeout: req.timeoutMs ?? 90000, maxRetries: 1 });
  try {
    const response = await client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 4000,
      ...(req.system ? { system: req.system } : {}),
      messages: [{ role: "user", content: req.prompt }],
    });
    if (response.stop_reason === "refusal") {
      throw new ProviderError("Claude bu soruyu yanıtlamayı reddetti");
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) throw new ProviderError("Claude boş cevap döndürdü");
    return { text, citations: [] };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new ProviderError("Anthropic API anahtarı geçersiz", 401);
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError("Anthropic hız sınırı aşıldı", 429);
    if (e instanceof Anthropic.APIError) throw new ProviderError(`Anthropic hatası: ${e.message}`, e.status);
    throw new ProviderError(`Anthropic'e bağlanılamadı: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------

/** Varsayılan model adları; ortam değişkeniyle değiştirilebilir. */
export function defaultModel(id: ProviderId, purpose: "test" | "assistant" = "test"): string {
  const env = (name: string, fallback: string) => process.env[name]?.trim() || fallback;
  switch (id) {
    case "gemini":
      return env("GEMINI_MODEL", "gemini-2.5-flash");
    case "groq":
      return purpose === "assistant"
        ? env("GROQ_ASSISTANT_MODEL", "llama-3.3-70b-versatile")
        : env("GROQ_MODEL", "openai/gpt-oss-120b");
    case "openrouter":
      return env("OPENROUTER_MODEL", "openai/gpt-oss-20b:free");
    case "pollinations":
      return env("POLLINATIONS_MODEL", "openai");
    case "openai":
      return env("OPENAI_MODEL", "gpt-4o-mini");
    case "anthropic":
      return env("ANTHROPIC_MODEL", "claude-opus-5-5");
    case "perplexity":
      return env("PERPLEXITY_MODEL", "sonar");
  }
}

/** Tek bir sağlayıcıyı çağırır. */
export async function chat(id: ProviderId, model: string, req: ChatRequest): Promise<ChatResult> {
  const key = providerKey(id);
  if (!isProviderConfigured(id)) {
    throw new ProviderError(`${PROVIDERS[id].label} ayarlı değil (${PROVIDERS[id].envKey} eksik)`);
  }
  switch (id) {
    case "gemini":
      return chatGemini(key!, model, req);
    case "anthropic":
      return chatAnthropic(key!, model, req);
    case "groq":
      return chatOpenAICompatible(
        { url: "https://api.groq.com/openai/v1/chat/completions", apiKey: key, model, supportsJsonMode: true },
        req
      );
    case "openrouter":
      return chatOpenAICompatible(
        {
          url: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: key,
          model,
          supportsJsonMode: false,
          extraHeaders: { "X-Title": "GeoBY" },
        },
        req
      );
    case "pollinations":
      return chatOpenAICompatible(
        {
          url: "https://text.pollinations.ai/openai",
          apiKey: process.env.POLLINATIONS_TOKEN?.trim() || undefined,
          model,
          supportsJsonMode: false,
        },
        { ...req, timeoutMs: req.timeoutMs ?? 90000 }
      );
    case "openai":
      return chatOpenAICompatible(
        { url: "https://api.openai.com/v1/chat/completions", apiKey: key, model, supportsJsonMode: true },
        req
      );
    case "perplexity":
      return chatOpenAICompatible(
        { url: "https://api.perplexity.ai/chat/completions", apiKey: key, model, supportsJsonMode: false },
        req
      );
  }
}
