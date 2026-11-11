import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Brand,
  Citation,
  Competitor,
  ModelId,
  Prompt,
  Run,
  Schedule,
} from "@/types";
import {
  TABLES,
  nextDueIso,
  sinceIso,
  type DataStore,
  type TableCheck,
} from "./types";

/** PostgREST varsayılan olarak tek seferde en fazla 1000 satır döndürür. */
const PAGE = 1000;

/** Supabase hatasını anlaşılır bir Error'a çevirir. */
function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Veritabanı hatası (${what}): ${res.error.message}`);
  return res.data;
}

export function createSupabaseStore(url: string, secretKey: string): DataStore {
  const client: SupabaseClient = createClient(url, secretKey, {
    auth: { persistSession: false },
  });

  async function getPrompts(brandId: string, activeOnly = true): Promise<Prompt[]> {
    let q = client.from("prompts").select("*").eq("brand_id", brandId);
    if (activeOnly) q = q.eq("is_active", true);
    return (check(await q.order("created_at", { ascending: true }), "prompts") ?? []) as Prompt[];
  }

  async function getSchedule(brandId: string): Promise<Schedule | null> {
    const res = await client
      .from("schedules")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (check(res, "schedules") as Schedule | null) ?? null;
  }

  /** Sorguyu sayfa sayfa çalıştırıp tüm satırları toplar (1000 satır sınırına takılmamak için). */
  async function all<T>(
    build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
    what: string
  ): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const res = await build().range(from, from + PAGE - 1);
      const rows = check(res, what) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  return {
    kind: "supabase",

    async checkTables(): Promise<TableCheck> {
      const results: { table: string; exists: boolean }[] = [];
      let firstError: string | undefined;
      for (const table of TABLES) {
        const { error } = await client.from(table).select("id").limit(1);
        if (error && !firstError) firstError = error.message;
        results.push({ table, exists: !error });
      }
      return {
        allTablesExist: results.every((r) => r.exists),
        results,
        error: firstError,
      };
    },

    async getPrimaryBrand() {
      const res = await client
        .from("brands")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return (check(res, "brands") as Brand | null) ?? null;
    },

    async updateBrand(id, patch) {
      const res = await client.from("brands").update(patch).eq("id", id).select().single();
      return check(res, "brands") as Brand;
    },

    async updateSelectedModels(brandId, models: ModelId[]) {
      check(await client.from("brands").update({ selected_models: models }).eq("id", brandId), "brands");
    },

    async updateSamples(brandId, samples) {
      const res = await client.from("brands").update({ samples }).eq("id", brandId);
      if (res.error && /samples/.test(res.error.message)) {
        throw new Error(
          "Veritabanınızda bu ayar için sütun yok. Supabase SQL Editor'de şunu çalıştırın: ALTER TABLE brands ADD COLUMN IF NOT EXISTS samples INT DEFAULT 1;"
        );
      }
      check(res, "brands");
    },

    async completeOnboarding(p) {
      const brand = check(
        await client
          .from("brands")
          .insert({
            name: p.brandName,
            domain: p.domain,
            is_primary: true,
            category: p.category,
            description: p.description,
            selected_models: p.selectedModels,
          })
          .select()
          .single(),
        "brands"
      ) as Brand;

      if (p.competitors.length) {
        check(
          await client
            .from("competitors")
            .insert(p.competitors.map((c) => ({ ...c, brand_id: brand.id }))),
          "competitors"
        );
      }
      if (p.prompts.length) {
        check(
          await client
            .from("prompts")
            .insert(p.prompts.map((x) => ({ text: x.text, topic: x.topic, brand_id: brand.id }))),
          "prompts"
        );
      }
      return brand;
    },

    async getCompetitors(brandId) {
      const res = await client
        .from("competitors")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: true });
      return (check(res, "competitors") ?? []) as Competitor[];
    },

    async addCompetitor(brandId, name, domain) {
      const res = await client
        .from("competitors")
        .insert({ brand_id: brandId, name, domain })
        .select()
        .single();
      return check(res, "competitors") as Competitor;
    },

    async deleteCompetitor(id) {
      check(await client.from("competitors").delete().eq("id", id), "competitors");
    },

    getPrompts,

    async getPromptById(id) {
      const res = await client.from("prompts").select("*").eq("id", id).maybeSingle();
      return (check(res, "prompts") as Prompt | null) ?? null;
    },

    async createPrompt(brandId, text, topic) {
      const res = await client
        .from("prompts")
        .insert({ brand_id: brandId, text, topic })
        .select()
        .single();
      return check(res, "prompts") as Prompt;
    },

    async updatePrompt(id, patch) {
      check(await client.from("prompts").update(patch).eq("id", id), "prompts");
    },

    async getRuns(filter) {
      const prompts = await getPrompts(filter.brandId, false);
      const ids = prompts.map((p) => p.id);
      if (ids.length === 0) return [];
      const out: Run[] = [];
      // Çok sayıda soruda URL sınırına takılmamak için soru kimliklerini parçala
      for (let i = 0; i < ids.length; i += 150) {
        const chunk = ids.slice(i, i + 150);
        const rows = await all<Run>(() => {
          let q = client.from("runs").select("*").in("prompt_id", chunk);
          if (filter.model) q = q.eq("model", filter.model);
          if (filter.days) q = q.gte("created_at", sinceIso(filter.days));
          return q.order("created_at", { ascending: false }).order("id");
        }, "runs");
        out.push(...rows);
      }
      return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getRunsForPrompt(promptId) {
      return all<Run>(
        () => client.from("runs").select("*").eq("prompt_id", promptId).order("created_at", { ascending: false }).order("id"),
        "runs"
      );
    },

    async createRun(run) {
      let res = await client.from("runs").insert(run).select().single();
      // Eski şemada batch_id sütunu yoksa onsuz kaydet (tekrar grupları tek tek sayılır)
      if (res.error && /batch_id/.test(res.error.message)) {
        const { batch_id: _omit, ...rest } = run;
        void _omit;
        res = await client.from("runs").insert(rest).select().single();
      }
      return check(res, "runs") as Run;
    },

    async getCitationsForRuns(runIds) {
      if (runIds.length === 0) return [];
      const out: Citation[] = [];
      // Uzun ID listelerinde URL sınırına takılmamak için parça parça çek
      for (let i = 0; i < runIds.length; i += 200) {
        const chunk = runIds.slice(i, i + 200);
        out.push(...(await all<Citation>(() => client.from("citations").select("*").in("run_id", chunk).order("id"), "citations")));
      }
      return out;
    },

    async createCitations(runId, citations) {
      if (citations.length === 0) return;
      check(
        await client.from("citations").insert(citations.map((c) => ({ run_id: runId, ...c }))),
        "citations"
      );
    },

    async updateRunAnalysis(id, patch) {
      check(await client.from("runs").update(patch).eq("id", id), "runs");
    },

    async deleteRun(id) {
      // citations tablosu ON DELETE CASCADE ile birlikte silinir
      check(await client.from("runs").delete().eq("id", id), "runs");
    },

    async replaceCitations(runId, citations) {
      check(await client.from("citations").delete().eq("run_id", runId), "citations");
      if (citations.length) {
        check(await client.from("citations").insert(citations.map((c) => ({ run_id: runId, ...c }))), "citations");
      }
    },

    getSchedule,

    async saveSchedule(brandId, frequency, isActive) {
      const existing = await getSchedule(brandId);
      const patch = {
        brand_id: brandId,
        frequency,
        is_active: isActive,
        next_due_at: nextDueIso(frequency, existing?.last_run_at ? new Date(existing.last_run_at) : new Date()),
      };
      const res = existing
        ? await client.from("schedules").update(patch).eq("id", existing.id).select().single()
        : await client.from("schedules").insert(patch).select().single();
      return check(res, "schedules") as Schedule;
    },

    async markTested(brandId) {
      const existing = await getSchedule(brandId);
      if (!existing) return;
      const now = new Date();
      check(
        await client
          .from("schedules")
          .update({ last_run_at: now.toISOString(), next_due_at: nextDueIso(existing.frequency, now) })
          .eq("id", existing.id),
        "schedules"
      );
    },

    async deleteBrand(brandId) {
      // Rakipler, sorular, testler, kaynaklar ve hatırlatıcı ON DELETE CASCADE ile silinir
      check(await client.from("brands").delete().eq("id", brandId), "brands");
    },
  };
}
