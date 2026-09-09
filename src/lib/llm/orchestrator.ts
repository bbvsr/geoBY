/**
 * LLM Orchestrator — İKİNCİ ETAP (şimdilik PASİF).
 *
 * İlk etapta yapay zeka modellerine API key ile bağlanılmaz; tüm görünürlük
 * ölçümü Manuel Test ekranından yapıştırılan cevaplarla yürür.
 *
 * Bu iskelet, ileride `LLM_API_ENABLED=true` yapıldığında otomatik çalıştırma
 * için hazır durur. Her model entegrasyonu buraya eklenecek.
 */
import type { ModelId } from "@/types";

export const LLM_API_ENABLED = process.env.LLM_API_ENABLED === "true";

export interface ModelCallResult {
  model: ModelId;
  success: boolean;
  disabled?: boolean;
  response: string;
  extraCitations: string[];
  error?: string;
}

/** Tek bir modeli çağırır. API kapalıysa disabled döner. */
export async function callModel(
  model: ModelId,
  _prompt: string
): Promise<ModelCallResult> {
  if (!LLM_API_ENABLED) {
    return {
      model,
      success: false,
      disabled: true,
      response: "",
      extraCitations: [],
      error:
        "LLM API entegrasyonu kapalı. Lütfen Manuel Test ekranından cevabı yapıştırın.",
    };
  }

  // İKİNCİ ETAP: burada gerçek entegrasyonlar çağrılacak
  // (openai / claude / gemini / perplexity / google_aio).
  return {
    model,
    success: false,
    disabled: true,
    response: "",
    extraCitations: [],
    error: "Model entegrasyonu henüz uygulanmadı.",
  };
}
