import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  STANDARD_MODELS,
  type Brand,
  type Citation,
  type Competitor,
  type Prompt,
  type Run,
  type Schedule,
} from "@/types";
import { TABLES, nextDueIso, sinceIso, type DataStore } from "./types";

/**
 * Yerel dosya veritabanı — Supabase ayarlanmadığında kullanılır.
 * Tüm veri tek bir JSON dosyasında tutulur (.data/geoby.json).
 * Tek kullanıcılı, yerel kullanım içindir.
 */
interface LocalData {
  brands: Brand[];
  competitors: Competitor[];
  prompts: Prompt[];
  runs: Run[];
  citations: Citation[];
  schedules: Schedule[];
}

const EMPTY: LocalData = {
  brands: [],
  competitors: [],
  prompts: [],
  runs: [],
  citations: [],
  schedules: [],
};

// Eşzamanlı istekler dosyayı bozmasın diye tüm işlemler sıraya alınır.
const g = globalThis as unknown as { __geobyLock?: Promise<unknown> };

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__geobyLock ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  g.__geobyLock = next;
  return next;
}

export function createLocalStore(dataDir: string): DataStore {
  const file = path.join(dataDir, "geoby.json");

  async function load(): Promise<LocalData> {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as Partial<LocalData>;
      return {
        brands: parsed.brands ?? [],
        competitors: parsed.competitors ?? [],
        prompts: parsed.prompts ?? [],
        runs: parsed.runs ?? [],
        citations: parsed.citations ?? [],
        schedules: parsed.schedules ?? [],
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
      throw new Error(`Yerel veri dosyası okunamadı (${file}): ${(e as Error).message}`);
    }
  }

  async function save(data: LocalData): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, file);
  }

  const read = <T>(fn: (d: LocalData) => T) => serialize(async () => fn(await load()));
  const write = <T>(fn: (d: LocalData) => T) =>
    serialize(async () => {
      const d = await load();
      const result = fn(d);
      await save(d);
      return result;
    });

  const now = () => new Date().toISOString();
  const byCreatedAsc = (a: { created_at: string }, b: { created_at: string }) =>
    a.created_at.localeCompare(b.created_at);
  const byCreatedDesc = (a: { created_at: string }, b: { created_at: string }) =>
    b.created_at.localeCompare(a.created_at);

  function scheduleOf(d: LocalData, brandId: string): Schedule | null {
    return d.schedules.filter((s) => s.brand_id === brandId).sort(byCreatedDesc)[0] ?? null;
  }

  return {
    kind: "local",

    async checkTables() {
      return {
        allTablesExist: true,
        results: TABLES.map((table) => ({ table, exists: true })),
      };
    },

    getPrimaryBrand: () =>
      read(
        (d) =>
          [...d.brands].sort(
            (a, b) => Number(b.is_primary) - Number(a.is_primary) || byCreatedAsc(a, b)
          )[0] ?? null
      ),

    updateBrand: (id, patch) =>
      write((d) => {
        const b = d.brands.find((x) => x.id === id);
        if (!b) return null;
        Object.assign(b, patch);
        return { ...b };
      }),

    updateSelectedModels: (brandId, models) =>
      write((d) => {
        const b = d.brands.find((x) => x.id === brandId);
        if (b) b.selected_models = models;
      }),

    updateSamples: (brandId, samples) =>
      write((d) => {
        const b = d.brands.find((x) => x.id === brandId);
        if (b) b.samples = samples;
      }),

    completeOnboarding: (p) =>
      write((d) => {
        const brand: Brand = {
          id: randomUUID(),
          name: p.brandName,
          domain: p.domain,
          is_primary: true,
          category: p.category,
          description: p.description,
          selected_models: p.selectedModels.length ? p.selectedModels : [...STANDARD_MODELS],
          created_at: now(),
        };
        d.brands.push(brand);
        for (const c of p.competitors) {
          d.competitors.push({
            id: randomUUID(),
            name: c.name,
            domain: c.domain,
            brand_id: brand.id,
            created_at: now(),
          });
        }
        p.prompts.forEach((x, i) => {
          d.prompts.push({
            id: randomUUID(),
            text: x.text,
            topic: x.topic,
            tags: [],
            is_active: true,
            brand_id: brand.id,
            // Sıra korunsun diye milisaniye farkı
            created_at: new Date(Date.now() + i).toISOString(),
          });
        });
        return brand;
      }),

    getCompetitors: (brandId) =>
      read((d) => d.competitors.filter((c) => c.brand_id === brandId).sort(byCreatedAsc)),

    addCompetitor: (brandId, name, domain) =>
      write((d) => {
        const c: Competitor = { id: randomUUID(), name, domain, brand_id: brandId, created_at: now() };
        d.competitors.push(c);
        return c;
      }),

    deleteCompetitor: (id) =>
      write((d) => {
        d.competitors = d.competitors.filter((c) => c.id !== id);
      }),

    getPrompts: (brandId, activeOnly = true) =>
      read((d) =>
        d.prompts
          .filter((p) => p.brand_id === brandId && (!activeOnly || p.is_active))
          .sort(byCreatedAsc)
      ),

    getPromptById: (id) => read((d) => d.prompts.find((p) => p.id === id) ?? null),

    createPrompt: (brandId, text, topic) =>
      write((d) => {
        const p: Prompt = {
          id: randomUUID(),
          text,
          topic,
          tags: [],
          is_active: true,
          brand_id: brandId,
          created_at: now(),
        };
        d.prompts.push(p);
        return p;
      }),

    updatePrompt: (id, patch) =>
      write((d) => {
        const p = d.prompts.find((x) => x.id === id);
        if (p) Object.assign(p, patch);
      }),

    getRuns: (filter) =>
      read((d) => {
        const ids = new Set(d.prompts.filter((p) => p.brand_id === filter.brandId).map((p) => p.id));
        const since = filter.days ? sinceIso(filter.days) : null;
        return d.runs
          .filter(
            (r) =>
              ids.has(r.prompt_id) &&
              (!filter.model || r.model === filter.model) &&
              (!since || r.created_at >= since)
          )
          .sort(byCreatedDesc);
      }),

    getRunsForPrompt: (promptId) =>
      read((d) => d.runs.filter((r) => r.prompt_id === promptId).sort(byCreatedDesc)),

    createRun: (run) =>
      write((d) => {
        const r = { id: randomUUID(), created_at: now(), ...run } as Run;
        d.runs.push(r);
        return r;
      }),

    updateRunAnalysis: (id, patch) =>
      write((d) => {
        const r = d.runs.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),

    deleteRun: (id) =>
      write((d) => {
        d.runs = d.runs.filter((r) => r.id !== id);
        d.citations = d.citations.filter((c) => c.run_id !== id);
      }),

    getCitationsForRuns: (runIds) =>
      read((d) => {
        const set = new Set(runIds);
        return d.citations.filter((c) => set.has(c.run_id));
      }),

    createCitations: (runId, citations) =>
      write((d) => {
        for (const c of citations) {
          d.citations.push({
            id: randomUUID(),
            run_id: runId,
            domain: c.domain,
            url: c.url,
            domain_type: c.domain_type as Citation["domain_type"],
            created_at: now(),
          });
        }
      }),

    replaceCitations: (runId, citations) =>
      write((d) => {
        d.citations = d.citations.filter((c) => c.run_id !== runId);
        for (const c of citations) {
          d.citations.push({
            id: randomUUID(),
            run_id: runId,
            domain: c.domain,
            url: c.url,
            domain_type: c.domain_type as Citation["domain_type"],
            created_at: now(),
          });
        }
      }),

    getSchedule: (brandId) => read((d) => scheduleOf(d, brandId)),

    saveSchedule: (brandId, frequency, isActive) =>
      write((d) => {
        let s = scheduleOf(d, brandId);
        const base = s?.last_run_at ? new Date(s.last_run_at) : new Date();
        if (!s) {
          s = {
            id: randomUUID(),
            brand_id: brandId,
            frequency,
            last_run_at: null,
            next_due_at: null,
            is_active: isActive,
            created_at: now(),
          };
          d.schedules.push(s);
        }
        s.frequency = frequency;
        s.is_active = isActive;
        s.next_due_at = nextDueIso(frequency, base);
        return { ...s };
      }),

    markTested: (brandId) =>
      write((d) => {
        const s = scheduleOf(d, brandId);
        if (!s) return;
        const t = new Date();
        s.last_run_at = t.toISOString();
        s.next_due_at = nextDueIso(s.frequency, t);
      }),

    deleteBrand: (brandId) =>
      write((d) => {
        const promptIds = new Set(d.prompts.filter((p) => p.brand_id === brandId).map((p) => p.id));
        const runIds = new Set(d.runs.filter((r) => promptIds.has(r.prompt_id)).map((r) => r.id));
        d.citations = d.citations.filter((c) => !runIds.has(c.run_id));
        d.runs = d.runs.filter((r) => !runIds.has(r.id));
        d.prompts = d.prompts.filter((p) => p.brand_id !== brandId);
        d.competitors = d.competitors.filter((c) => c.brand_id !== brandId);
        d.schedules = d.schedules.filter((x) => x.brand_id !== brandId);
        d.brands = d.brands.filter((b) => b.id !== brandId);
      }),
  };
}
