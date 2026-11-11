/**
 * Model seçimi. Sağlayıcılar model adlarını sık sık değiştirir veya kaldırır;
 * sabit bir ad yazmak yerine sağlayıcının kendi model listesinden uygun olanı
 * seçeriz. Liste alınamazsa bilinen adlara düşeriz. Ortam değişkeniyle
 * (ör. GEMINI_MODEL) sabitlemek her zaman mümkündür.
 */
import { requestJSON } from "./http";

// ---------------------------------------------------------------------------
// Sıralama kuralları (saf fonksiyonlar — testleri tests/ai-models.test.ts)
// ---------------------------------------------------------------------------

const GEMINI_SPECIALTY =
  /image|tts|audio|live|embed|robotics|computer-use|vision|veo|imagen|lyria|learnlm|gemma|aqa|dialog|customtools/;

function geminiVersion(id: string): number {
  const m = id.match(/^gemini-(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/**
 * Gemini: ücretsiz katman Flash ailesindedir. En yeni kararlı Flash'ı öne alır;
 * ardından "-latest" takma adı, Flash-Lite ve eski sürümler gelir.
 */
export function rankGeminiModels(ids: string[]): string[] {
  const usable = ids
    .map((id) => id.replace(/^models\//, ""))
    .filter((id) => id.startsWith("gemini-") && !GEMINI_SPECIALTY.test(id));

  const score = (id: string): number => {
    const lite = id.includes("flash-lite");
    const flash = id.includes("flash");
    let s = flash && !lite ? 3000 : lite ? 2000 : 0;
    if (id.endsWith("-latest")) {
      s += 500;
    } else {
      s += 600 + geminiVersion(id) * 10;
    }
    if (/preview|exp/.test(id)) s -= 550;
    if (/-\d{3}$|-\d{2}-\d{2,4}$/.test(id)) s -= 2; // tarihli/numaralı sürüm yerine yalın ad
    return s;
  };

  const sorted = [...new Set(usable)].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  // "-latest" takma adı, en iyi sürümlü modelin hemen arkasına
  const alias = "gemini-flash-latest";
  if (sorted.includes(alias) && sorted[0] !== alias) {
    const rest = sorted.filter((id) => id !== alias);
    rest.splice(1, 0, alias);
    return rest.slice(0, 5);
  }
  return sorted.slice(0, 5);
}

/** Kalıp sırasına göre eşleşen model kimliklerini döndürür (her kalıp için en yeni görünen önce). */
export function pickByPatterns(ids: string[], patterns: RegExp[]): string[] {
  const out: string[] = [];
  for (const p of patterns) {
    const hits = ids.filter((id) => p.test(id)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const h of hits) if (!out.includes(h)) out.push(h);
  }
  return out;
}

const GROQ_NON_CHAT = /whisper|tts|guard|safeguard|embed|playai|orpheus|compound/;

/** Groq: "ChatGPT" ölçümü için OpenAI'nin açık modelleri (gpt-oss). Yardımcı işler için herhangi bir güçlü sohbet modeli. */
export function rankGroqModels(ids: string[], purpose: "test" | "assistant"): string[] {
  const chat = ids.filter((id) => !GROQ_NON_CHAT.test(id));
  const gptOss = pickByPatterns(chat, [/gpt-oss-120b/, /gpt-oss/]);
  if (purpose === "test") return gptOss;
  return [...new Set([...gptOss, ...pickByPatterns(chat, [/llama-3\.3-70b/, /qwen|kimi|llama/])])].slice(0, 4);
}

/** OpenAI (ücretli): maliyeti düşük tutmak için en yeni "mini" model; yoksa gpt-4o-mini. */
export function rankOpenAIModels(ids: string[]): string[] {
  const minis = ids
    .filter((id) => /^gpt-\d+(?:\.\d+)?-mini$/.test(id))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return [...minis.slice(0, 2), ...ids.filter((id) => id === "gpt-4o-mini")];
}

// ---------------------------------------------------------------------------
// Keşif + önbellek
// ---------------------------------------------------------------------------

export type DiscoverableProvider = "gemini" | "groq" | "openai" | "local";

const FALLBACKS: Record<DiscoverableProvider, string[]> = {
  gemini: ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"],
  groq: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  openai: ["gpt-4o-mini"],
  local: [],
};

const TTL_OK_MS = 6 * 60 * 60 * 1000;
const TTL_FAIL_MS = 5 * 60 * 1000;

interface Entry {
  candidates: string[];
  discovered: boolean;
  expires: number;
}

const g = globalThis as unknown as { __geobyModelCache?: Map<string, Entry> };
const cache = (g.__geobyModelCache ??= new Map<string, Entry>());

export function clearModelCache(): void {
  cache.clear();
}

async function listModelIds(provider: DiscoverableProvider, apiKey: string | undefined, baseUrl?: string): Promise<string[]> {
  if (provider === "gemini") {
    const d = await requestJSON<{ models?: { name?: string; supportedGenerationMethods?: string[] }[] }>({
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      headers: { "x-goog-api-key": apiKey ?? "" },
      timeoutMs: 8000,
      retries: 0,
    });
    return (d.models ?? [])
      .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => m.name ?? "")
      .filter(Boolean);
  }
  const url =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/models"
      : provider === "openai"
        ? "https://api.openai.com/v1/models"
        : `${baseUrl}/models`;
  const d = await requestJSON<{ data?: { id?: string; active?: boolean }[] }>({
    url,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    timeoutMs: 8000,
    retries: 0,
  });
  return (d.data ?? []).filter((m) => m.active !== false).map((m) => m.id ?? "").filter(Boolean);
}

/**
 * Bir sağlayıcı için denenecek modeller (öncelik sırasıyla).
 * Hata fırlatmaz: liste alınamazsa bilinen adları döndürür.
 */
export async function candidateModels(
  provider: DiscoverableProvider,
  purpose: "test" | "assistant",
  opts: { apiKey?: string; baseUrl?: string; override?: string }
): Promise<string[]> {
  if (opts.override) return [opts.override];

  const key = `${provider}:${purpose}:${opts.baseUrl ?? ""}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.candidates;

  try {
    const ids = await listModelIds(provider, opts.apiKey, opts.baseUrl);
    const ranked =
      provider === "gemini"
        ? rankGeminiModels(ids)
        : provider === "groq"
          ? rankGroqModels(ids, purpose)
          : provider === "openai"
            ? rankOpenAIModels(ids)
            : ids.slice(0, 3);
    if (ranked.length > 0) {
      cache.set(key, { candidates: ranked, discovered: true, expires: Date.now() + TTL_OK_MS });
      return ranked;
    }
  } catch {
    /* liste alınamadı — bilinen adlarla devam */
  }
  const fallback = FALLBACKS[provider];
  cache.set(key, { candidates: fallback, discovered: false, expires: Date.now() + TTL_FAIL_MS });
  return fallback;
}

/** Daha önce çözülmüş model adı (ağ çağrısı yapmaz; durum ekranı için). */
export function knownModel(provider: DiscoverableProvider, purpose: "test" | "assistant", baseUrl?: string): string | null {
  const hit = cache.get(`${provider}:${purpose}:${baseUrl ?? ""}`);
  return hit && hit.discovered ? (hit.candidates[0] ?? null) : null;
}

/** Çalışmayan modeli önbellekten düşürür ki bir sonraki istek sıradakini denesin. */
export function demoteModel(provider: DiscoverableProvider, purpose: "test" | "assistant", model: string, baseUrl?: string): void {
  const key = `${provider}:${purpose}:${baseUrl ?? ""}`;
  const hit = cache.get(key);
  if (!hit) return;
  const rest = hit.candidates.filter((m) => m !== model);
  if (rest.length) cache.set(key, { ...hit, candidates: rest });
  else cache.delete(key);
}
