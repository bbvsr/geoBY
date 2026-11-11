import { ALL_MODELS, MODEL_LABELS, type ModelId } from "@/types";
import { ProviderError } from "./http";
import {
  PROVIDERS,
  chat,
  isProviderConfigured,
  knownModelFor,
  type ChatResult,
  type ProviderId,
} from "./providers";

/**
 * Hangi izlenen asistan hangi sağlayıcı üzerinden otomatik test edilebilir?
 * Liste öncelik sırasıdır; ilk çalışan kullanılır.
 *
 * Claude, Perplexity ve AI Overview'un ücretsiz API'si yoktur; anahtar yoksa
 * bu asistanlar cevap yapıştırılarak ölçülür.
 */
const ENGINE_CHAIN: Record<ModelId, ProviderId[]> = {
  openai: ["openai", "groq", "pollinations"],
  gemini: ["gemini"],
  claude: ["anthropic"],
  perplexity: ["perplexity"],
  google_aio: [],
  local: ["local"],
};

/** Ölçümün asıl ürünü ne kadar temsil ettiği. */
export type Fidelity = "exact" | "close" | "rough";

function fidelityOf(model: ModelId, provider: ProviderId): Fidelity {
  if (model !== "openai") return "exact";
  if (provider === "openai") return "exact";
  return provider === "groq" ? "close" : "rough";
}

const FIDELITY_NOTE: Record<Fidelity, string> = {
  exact: "",
  close: "OpenAI'nin açık modeli. ChatGPT'ye yakın sonuç verir, aynısı değildir.",
  rough: "Anahtarsız deneme modu: küçük bir açık model, soru başına yaklaşık 45 sn. Sonuçlar kabadır.",
};

export interface Engine {
  provider: ProviderId;
  providerLabel: string;
  /** Biliniyorsa model adı (ilk çağrıdan önce bilinmeyebilir). */
  model: string | null;
  free: boolean;
  fidelity: Fidelity;
  note: string;
}

function toEngine(model: ModelId, provider: ProviderId): Engine {
  const fidelity = fidelityOf(model, provider);
  return {
    provider,
    providerLabel: PROVIDERS[provider].label,
    model: knownModelFor(provider),
    free: PROVIDERS[provider].free,
    fidelity,
    note: FIDELITY_NOTE[fidelity],
  };
}

export function enginesFor(model: ModelId): Engine[] {
  return ENGINE_CHAIN[model].filter(isProviderConfigured).map((p) => toEngine(model, p));
}

export function canAutoTest(model: ModelId): boolean {
  return enginesFor(model).length > 0;
}

export interface ModelRunResult extends ChatResult {
  /** Kayıtlarda gösterilen kaynak, ör. "Groq · openai/gpt-oss-120b" */
  via: string;
  fidelity: Fidelity;
}

/**
 * Bir soruyu izlenen asistana sorar. Sağlayıcılardan biri hata verirse
 * sıradakine geçer; hepsi başarısızsa nedenleriyle birlikte hata fırlatır.
 */
export async function runModel(model: ModelId, prompt: string): Promise<ModelRunResult> {
  const engines = enginesFor(model);
  if (engines.length === 0) {
    throw new ProviderError(
      `${MODEL_LABELS[model]} için otomatik bağlantı yok. Cevabı yapıştırarak ölçebilirsiniz.`,
      "config"
    );
  }
  const errors: string[] = [];
  for (const engine of engines) {
    try {
      const res = await chat(engine.provider, { prompt, purpose: "test" });
      return { ...res, via: `${engine.providerLabel} · ${res.model}`, fidelity: engine.fidelity };
    } catch (e) {
      errors.push(`${engine.providerLabel}: ${(e as Error).message}`);
    }
  }
  throw new ProviderError(errors.join(" · "), "other");
}

export interface ModelStatus {
  model: ModelId;
  auto: boolean;
  engine: Engine | null;
  /** Bu asistan için otomatik testi açan ortam değişkenleri (öncelik sırasıyla). */
  unlockWith: string[];
}

export function modelStatuses(): ModelStatus[] {
  return ALL_MODELS.map((model) => {
    const engines = enginesFor(model);
    return {
      model,
      auto: engines.length > 0,
      engine: engines[0] ?? null,
      unlockWith: ENGINE_CHAIN[model]
        .filter((p) => p !== "pollinations")
        .map((p) => PROVIDERS[p].envKey),
    };
  });
}
