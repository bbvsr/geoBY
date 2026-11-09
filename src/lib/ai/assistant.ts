import { chat, defaultModel, isProviderConfigured, PROVIDERS, type ProviderId } from "./providers";

/**
 * Yardımcı yapay zeka: kurulumda site analizi, soru ve rakip önerisi gibi
 * işler için. Ücretsiz sağlayıcıları sırayla dener.
 */
const ASSISTANT_ORDER: ProviderId[] = ["gemini", "groq", "openrouter", "openai", "anthropic", "pollinations"];

export function assistantProvider(): ProviderId | null {
  return ASSISTANT_ORDER.find(isProviderConfigured) ?? null;
}

/** Metin içinden ilk geçerli JSON nesnesini ayıklar (```json bloklarını da tolere eder). */
export function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* metnin içinde arayalım */
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* geçersiz */
    }
  }
  return null;
}

export interface AssistantResult<T> {
  data: T;
  provider: string;
}

/**
 * JSON cevap ister. Hiç sağlayıcı yoksa veya hepsi başarısızsa null döner —
 * çağıran taraf kural tabanlı yönteme düşer.
 */
export async function askJSON<T>(system: string, prompt: string): Promise<AssistantResult<T> | null> {
  for (const id of ASSISTANT_ORDER) {
    if (!isProviderConfigured(id)) continue;
    try {
      const res = await chat(id, defaultModel(id, "assistant"), {
        system,
        prompt,
        json: true,
        maxTokens: 3000,
        timeoutMs: 45000,
      });
      const parsed = extractJSON(res.text);
      if (parsed && typeof parsed === "object") {
        return { data: parsed as T, provider: PROVIDERS[id].label };
      }
    } catch (e) {
      console.warn(`[GeoBY] Yardımcı AI (${id}) başarısız:`, (e as Error).message);
    }
  }
  return null;
}
