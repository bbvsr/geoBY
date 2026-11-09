import { MODEL_LABELS, type ModelId } from "@/types";
import {
  PROVIDERS,
  ProviderError,
  chat,
  defaultModel,
  isProviderConfigured,
  type ChatResult,
  type ProviderId,
} from "./providers";

/**
 * Hangi izlenen model (ChatGPT, Gemini, ...) hangi sağlayıcı üzerinden
 * otomatik test edilebilir? Liste öncelik sırasıdır; ilk çalışan kullanılır.
 *
 * Not: Claude, Perplexity ve AI Overview'un ücretsiz API'si yoktur.
 * Anahtar yoksa bu modeller "Manuel Test" ile ölçülür.
 */
const ENGINE_CHAIN: Record<ModelId, ProviderId[]> = {
  openai: ["openai", "groq", "openrouter", "pollinations"],
  gemini: ["gemini"],
  claude: ["anthropic"],
  perplexity: ["perplexity"],
  google_aio: [],
};

export interface Engine {
  provider: ProviderId;
  model: string;
  /** Kullanıcıya gösterilen ad, örn. "Groq · openai/gpt-oss-120b" */
  label: string;
  free: boolean;
  /** Gerçek ürünün kendisi mi, yoksa yakın bir vekil mi? */
  exact: boolean;
}

function toEngine(model: ModelId, provider: ProviderId): Engine {
  const m = defaultModel(provider, "test");
  return {
    provider,
    model: m,
    label: `${PROVIDERS[provider].label} · ${m}`,
    free: PROVIDERS[provider].free,
    exact: !(model === "openai" && provider !== "openai"),
  };
}

export function enginesFor(model: ModelId): Engine[] {
  return ENGINE_CHAIN[model].filter(isProviderConfigured).map((p) => toEngine(model, p));
}

export function canAutoTest(model: ModelId): boolean {
  return enginesFor(model).length > 0;
}

export interface ModelRunResult extends ChatResult {
  engine: Engine;
}

/**
 * Bir soruyu izlenen modele sorar. Sağlayıcılardan biri hata verirse
 * sıradakine geçer; hepsi başarısızsa son hatayı fırlatır.
 */
export async function runModel(model: ModelId, prompt: string): Promise<ModelRunResult> {
  const engines = enginesFor(model);
  if (engines.length === 0) {
    throw new ProviderError(
      `${MODEL_LABELS[model]} için otomatik bağlantı yok. Bu modeli Manuel Test ile ölçün.`
    );
  }
  const errors: string[] = [];
  for (const engine of engines) {
    try {
      const res = await chat(engine.provider, engine.model, {
        prompt,
        // Gemini cevabını Google aramasıyla destekle: gerçek kaynaklar gelir
        webSearch: engine.provider === "gemini",
        maxTokens: engine.provider === "gemini" ? 8192 : 2000,
      });
      return { ...res, engine };
    } catch (e) {
      errors.push(`${engine.label}: ${(e as Error).message}`);
    }
  }
  const onlyKeyless = engines.every((e) => e.provider === "pollinations");
  throw new ProviderError(
    errors.join(" | ") +
      (onlyKeyless ? " — Daha güvenilir sonuç için Ayarlar'dan ücretsiz bir Groq veya Gemini anahtarı ekleyin." : "")
  );
}

export interface ModelStatus {
  model: ModelId;
  auto: boolean;
  engine: Engine | null;
  /** Bu model için hangi anahtar(lar) otomatik testi açar */
  unlockWith: ProviderId[];
}

export function modelStatuses(): ModelStatus[] {
  return (Object.keys(ENGINE_CHAIN) as ModelId[]).map((model) => {
    const engines = enginesFor(model);
    return {
      model,
      auto: engines.length > 0,
      engine: engines[0] ?? null,
      unlockWith: ENGINE_CHAIN[model],
    };
  });
}
