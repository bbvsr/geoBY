import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Brand,
  BrandDocument,
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

const BUCKET = "geoby-docs";

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

  async function ensureBucket() {
    const { data } = await client.storage.getBucket(BUCKET);
    if (!data) await client.storage.createBucket(BUCKET, { public: false });
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
      let q = client.from("runs").select("*").in("prompt_id", ids);
      if (filter.model) q = q.eq("model", filter.model);
      if (filter.days) q = q.gte("created_at", sinceIso(filter.days));
      const res = await q.order("created_at", { ascending: false });
      return (check(res, "runs") ?? []) as Run[];
    },

    async getRunsForPrompt(promptId) {
      const res = await client
        .from("runs")
        .select("*")
        .eq("prompt_id", promptId)
        .order("created_at", { ascending: false });
      return (check(res, "runs") ?? []) as Run[];
    },

    async createRun(run) {
      const res = await client.from("runs").insert(run).select().single();
      return check(res, "runs") as Run;
    },

    async getCitationsForRuns(runIds) {
      if (runIds.length === 0) return [];
      const out: Citation[] = [];
      // Uzun ID listelerinde URL sınırına takılmamak için parça parça çek
      for (let i = 0; i < runIds.length; i += 200) {
        const res = await client
          .from("citations")
          .select("*")
          .in("run_id", runIds.slice(i, i + 200));
        out.push(...((check(res, "citations") ?? []) as Citation[]));
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

    async getDocuments(brandId) {
      const res = await client
        .from("documents")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });
      return (check(res, "documents") ?? []) as BrandDocument[];
    },

    async saveDocument(brandId, file) {
      await ensureBucket();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${brandId}/${Date.now()}-${safeName}`;
      const up = await client.storage.from(BUCKET).upload(path, file.data, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (up.error) throw new Error(`Dosya yüklenemedi: ${up.error.message}`);
      const res = await client
        .from("documents")
        .insert({ brand_id: brandId, name: file.name, storage_path: path, mime: file.type })
        .select()
        .single();
      return check(res, "documents") as BrandDocument;
    },
  };
}
