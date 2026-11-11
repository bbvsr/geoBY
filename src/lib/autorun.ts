import { db } from "@/lib/db";
import { canAutoTest } from "@/lib/ai/engines";
import { autoTestPrompt } from "@/lib/testing";

export interface AutorunResult {
  ran: boolean;
  reason?: string;
  prompts?: number;
  answers?: number;
  mentioned?: number;
  errors?: number;
}

// Aynı anda iki otomatik çalıştırma olmasın
const g = globalThis as unknown as { __geobyAutorun?: boolean };

/**
 * Hatırlatıcının zamanı geldiyse tüm aktif soruları otomatik bağlantısı olan
 * asistanlara sorar. `force` ile zamanı beklemeden çalışır.
 */
export async function runDueTests(opts: { force?: boolean } = {}): Promise<AutorunResult> {
  if (g.__geobyAutorun) return { ran: false, reason: "Zaten çalışan bir otomatik test var." };
  const store = db();
  const brand = await store.getPrimaryBrand();
  if (!brand) return { ran: false, reason: "Marka yok." };

  if (!opts.force) {
    const schedule = await store.getSchedule(brand.id);
    if (!schedule?.is_active) return { ran: false, reason: "Hatırlatıcı kapalı." };
    if (schedule.next_due_at && new Date(schedule.next_due_at).getTime() > Date.now()) {
      return { ran: false, reason: `Sıradaki test zamanı: ${schedule.next_due_at}` };
    }
  }

  const models = brand.selected_models.filter(canAutoTest);
  if (models.length === 0) return { ran: false, reason: "Otomatik bağlantısı olan asistan yok." };

  const prompts = await store.getPrompts(brand.id, true);
  if (prompts.length === 0) return { ran: false, reason: "Aktif soru yok." };

  g.__geobyAutorun = true;
  try {
    const competitors = await store.getCompetitors(brand.id);
    let answers = 0;
    let mentioned = 0;
    let errors = 0;
    for (const p of prompts) {
      const results = await autoTestPrompt(brand, competitors, p, models);
      for (const r of results) {
        if (r.success) {
          answers += 1;
          if (r.mentioned) mentioned += 1;
        } else errors += 1;
      }
    }
    // Hepsi başarısızsa (ör. kota) zamanı ilerletme; bir sonraki kontrolde yeniden denensin
    if (answers > 0) await store.markTested(brand.id);
    return { ran: true, prompts: prompts.length, answers, mentioned, errors };
  } finally {
    g.__geobyAutorun = false;
  }
}
