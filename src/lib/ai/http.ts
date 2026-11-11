/**
 * Yapay zeka sağlayıcılarına yapılan HTTP istekleri: zaman aşımı, hız sınırında
 * bekleyip yeniden deneme ve anlaşılır hata mesajları.
 */

export type ErrorKind =
  | "auth" // anahtar geçersiz / yetkisiz
  | "rate" // kısa süreli hız sınırı (beklenip denendi, yine olmadı)
  | "quota" // günlük/aylık kota doldu — beklemek anlamsız
  | "model" // model bulunamadı / bu anahtarla kullanılamıyor
  | "server" // sağlayıcı tarafında geçici sorun
  | "network"
  | "timeout"
  | "response" // anlaşılmayan / boş cevap
  | "config" // sağlayıcı ayarlı değil
  | "other";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: ErrorKind = "other",
    readonly status?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Bir isteğin en fazla ne kadar bekleyip yeniden deneyeceği (sn). Daha uzunu "kota doldu" sayılır. */
const MAX_WAIT_SEC = 60;
const BACKOFF_SEC = [2, 6];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorMessage(body: string): string {
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.message ?? (typeof j?.error === "string" ? j.error : "");
    return typeof m === "string" ? m.slice(0, 300) : "";
  } catch {
    return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  }
}

/** Sağlayıcının "şu kadar sonra tekrar dene" bilgisini saniye olarak okur. */
export function retryAfterSeconds(headers: Headers, body: string): number | null {
  const h = headers.get("retry-after");
  if (h) {
    const n = Number(h);
    if (Number.isFinite(n) && n >= 0) return n;
    const date = Date.parse(h);
    if (Number.isFinite(date)) return Math.max(0, (date - Date.now()) / 1000);
  }
  // Gemini: {"error":{"details":[{"@type":"...RetryInfo","retryDelay":"32s"}]}}
  const g = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (g) return Number(g[1]);
  // Groq: "Please try again in 7.66s" / "in 2m30s"
  const t = body.match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (t && (t[1] || t[2] || t[3])) {
    return Number(t[1] ?? 0) * 3600 + Number(t[2] ?? 0) * 60 + Number(t[3] ?? 0);
  }
  return null;
}

function humanWait(sec: number): string {
  if (sec < 90) return `${Math.ceil(sec)} sn`;
  if (sec < 5400) return `${Math.round(sec / 60)} dk`;
  return `${Math.round(sec / 3600)} saat`;
}

/** Model bulunamadı / bu anahtarla kullanılamıyor mu? (Başka modele geçmek gerekir.) */
function isModelProblem(status: number, msg: string): boolean {
  if (status === 404) return true;
  const m = msg.toLowerCase();
  if (status === 400 && m.includes("model")) {
    return /not found|does not exist|decommission|deprecat|not supported|unknown|invalid model|no longer/.test(m);
  }
  // Gemini ücretsiz katmanda kapalı model: kota "limit: 0"
  if (status === 429 && /limit:\s*0\b/.test(m)) return true;
  return false;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** Hız sınırı / geçici hata durumunda kaç kez yeniden denensin (varsayılan 2). */
  retries?: number;
}

export async function requestJSON<T = unknown>(o: RequestOptions): Promise<T> {
  const timeoutMs = o.timeoutMs ?? 60000;
  const retries = o.retries ?? 2;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(o.url, {
        method: o.method ?? (o.body === undefined ? "GET" : "POST"),
        headers: {
          ...(o.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...o.headers,
        },
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const err = e as Error;
      const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
      if (attempt < retries && !timedOut) {
        await sleep(1500);
        continue;
      }
      throw timedOut
        ? new ProviderError(`Zaman aşımı (${Math.round(timeoutMs / 1000)} sn içinde cevap gelmedi)`, "timeout")
        : new ProviderError("Bağlantı kurulamadı. İnternet bağlantısını veya adresi kontrol edin.", "network");
    }

    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ProviderError("Sağlayıcıdan anlaşılmayan bir cevap geldi", "response", res.status);
      }
    }

    const msg = errorMessage(text);
    const detail = msg ? `: ${msg}` : "";
    const wait = retryAfterSeconds(res.headers, text);

    if (isModelProblem(res.status, msg)) {
      throw new ProviderError(`Model kullanılamıyor (HTTP ${res.status})${detail}`, "model", res.status);
    }
    // Gemini geçersiz anahtarı 400 ile bildirir ("API key not valid")
    if (res.status === 401 || res.status === 403 || (res.status === 400 && /api[ _-]?key/i.test(msg))) {
      throw new ProviderError(`API anahtarı geçersiz veya yetkisiz (HTTP ${res.status})${detail}`, "auth", res.status);
    }

    // Hız sınırı: 429, ayrıca Retry-After ile gelen 402 (Pollinations ücretsiz sınırı)
    const rateLimited = res.status === 429 || (res.status === 402 && wait !== null);
    const transient = res.status >= 500;
    if (rateLimited || transient) {
      if (wait !== null && wait > MAX_WAIT_SEC) {
        throw new ProviderError(
          `Ücretsiz kota doldu; yaklaşık ${humanWait(wait)} sonra tekrar deneyin${detail}`,
          "quota",
          res.status
        );
      }
      if (attempt < retries) {
        await sleep(((wait ?? BACKOFF_SEC[Math.min(attempt, BACKOFF_SEC.length - 1)]) + 0.5) * 1000);
        continue;
      }
      throw rateLimited
        ? new ProviderError(`Hız sınırı aşıldı, biraz sonra tekrar deneyin (HTTP ${res.status})${detail}`, "rate", res.status)
        : new ProviderError(`Sağlayıcı şu an cevap veremiyor (HTTP ${res.status})${detail}`, "server", res.status);
    }

    if (res.status === 402) {
      throw new ProviderError(`Hesapta kredi yok veya ücretsiz sınır doldu (HTTP 402)${detail}`, "quota", 402);
    }
    throw new ProviderError(`İstek reddedildi (HTTP ${res.status})${detail}`, "other", res.status);
  }
}
