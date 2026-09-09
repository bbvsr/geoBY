import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Brand,
  Competitor,
  Prompt,
  Run,
  Citation,
  Schedule,
  BrandDocument,
  ModelId,
} from "@/types";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

let _admin: SupabaseClient | null = null;

/** Server-side Supabase client (secret key). Asla client'a gönderilmez. */
export function admin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Supabase ortam değişkenleri eksik (SUPABASE_URL / SUPABASE_SECRET_KEY). .env.local kontrol edin."
    );
  }
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false },
    });
  }
  return _admin;
}

export const TABLES = [
  "brands",
  "competitors",
  "prompts",
  "runs",
  "citations",
  "schedules",
  "documents",
] as const;

export type TableName = (typeof TABLES)[number];

/** Tüm tabloların varlığını kontrol eder. */
export async function checkTables(): Promise<{
  allTablesExist: boolean;
  results: { table: string; exists: boolean }[];
}> {
  const results: { table: string; exists: boolean }[] = [];
  for (const table of TABLES) {
    try {
      const { error } = await admin().from(table).select("id").limit(1);
      results.push({ table, exists: !error });
    } catch {
      results.push({ table, exists: false });
    }
  }
  return {
    allTablesExist: results.every((r) => r.exists),
    results,
  };
}

// ---- Brand ----
export async function getPrimaryBrand(): Promise<Brand | null> {
  const { data } = await admin()
    .from("brands")
    .select("*")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Brand) ?? null;
}

export async function getCompetitors(brandId: string): Promise<Competitor[]> {
  const { data } = await admin()
    .from("competitors")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });
  return (data as Competitor[]) ?? [];
}

// ---- Prompts ----
export async function getPrompts(
  brandId: string,
  activeOnly = true
): Promise<Prompt[]> {
  let q = admin().from("prompts").select("*").eq("brand_id", brandId);
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q.order("created_at", { ascending: true });
  return (data as Prompt[]) ?? [];
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const { data } = await admin()
    .from("prompts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Prompt) ?? null;
}

export async function createPrompt(
  brandId: string,
  text: string,
  topic: string,
  tags: string[] = []
): Promise<Prompt | null> {
  const { data } = await admin()
    .from("prompts")
    .insert({ brand_id: brandId, text, topic, tags })
    .select()
    .single();
  return (data as Prompt) ?? null;
}

export async function archivePrompt(id: string): Promise<void> {
  await admin().from("prompts").update({ is_active: false }).eq("id", id);
}

export async function updatePromptText(
  id: string,
  text: string,
  topic?: string
): Promise<void> {
  const patch: Record<string, unknown> = { text };
  if (topic) patch.topic = topic;
  await admin().from("prompts").update(patch).eq("id", id);
}

// ---- Runs ----
export interface RunFilter {
  brandId: string;
  days?: number;
  model?: ModelId;
}

/** Bir markaya ait tüm run'ları (prompt üzerinden) çeker. */
export async function getRuns(filter: RunFilter): Promise<Run[]> {
  const prompts = await getPrompts(filter.brandId, false);
  const promptIds = prompts.map((p) => p.id);
  if (promptIds.length === 0) return [];

  let q = admin().from("runs").select("*").in("prompt_id", promptIds);
  if (filter.model) q = q.eq("model", filter.model);
  if (filter.days) {
    const since = new Date();
    since.setDate(since.getDate() - filter.days);
    q = q.gte("created_at", since.toISOString());
  }
  const { data } = await q.order("created_at", { ascending: false });
  return (data as Run[]) ?? [];
}

export async function getRunsForPrompt(
  promptId: string,
  model?: ModelId
): Promise<Run[]> {
  let q = admin().from("runs").select("*").eq("prompt_id", promptId);
  if (model) q = q.eq("model", model);
  const { data } = await q.order("created_at", { ascending: false });
  return (data as Run[]) ?? [];
}

export interface NewRun {
  prompt_id: string;
  model: ModelId;
  response: string;
  query_text: string;
  mentioned: boolean;
  mention_count: number;
  position_score: number | null;
  sentiment: string;
  competitor_mentions: Record<string, boolean>;
  source?: string;
}

export async function createRun(run: NewRun): Promise<Run | null> {
  const { data } = await admin()
    .from("runs")
    .insert({ source: "manual", ...run })
    .select()
    .single();
  return (data as Run) ?? null;
}

// ---- Citations ----
export async function getCitationsForRuns(
  runIds: string[]
): Promise<Citation[]> {
  if (runIds.length === 0) return [];
  const { data } = await admin()
    .from("citations")
    .select("*")
    .in("run_id", runIds);
  return (data as Citation[]) ?? [];
}

export async function createCitations(
  runId: string,
  citations: { domain: string; url: string; domain_type: string }[]
): Promise<void> {
  if (citations.length === 0) return;
  await admin()
    .from("citations")
    .insert(citations.map((c) => ({ run_id: runId, ...c })));
}

// ---- Schedules ----
export async function getSchedule(brandId: string): Promise<Schedule | null> {
  const { data } = await admin()
    .from("schedules")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Schedule) ?? null;
}

export async function upsertSchedule(
  brandId: string,
  frequency: "weekly" | "monthly",
  isActive: boolean
): Promise<Schedule | null> {
  const existing = await getSchedule(brandId);
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + (frequency === "weekly" ? 7 : 30));
  const patch = {
    brand_id: brandId,
    frequency,
    is_active: isActive,
    next_due_at: nextDue.toISOString(),
    last_run_at: new Date().toISOString(),
  };
  if (existing) {
    const { data } = await admin()
      .from("schedules")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();
    return (data as Schedule) ?? null;
  }
  const { data } = await admin()
    .from("schedules")
    .insert(patch)
    .select()
    .single();
  return (data as Schedule) ?? null;
}

// ---- Documents ----
export async function getDocuments(brandId: string): Promise<BrandDocument[]> {
  const { data } = await admin()
    .from("documents")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  return (data as BrandDocument[]) ?? [];
}

export async function createDocument(
  brandId: string,
  name: string,
  storagePath: string,
  mime: string
): Promise<BrandDocument | null> {
  const { data } = await admin()
    .from("documents")
    .insert({ brand_id: brandId, name, storage_path: storagePath, mime })
    .select()
    .single();
  return (data as BrandDocument) ?? null;
}

// ---- Onboarding: hepsini kaydet ----
export interface CompletePayload {
  brandName: string;
  domain: string;
  category: string;
  description: string;
  selectedModels: ModelId[];
  prompts: { text: string; topic: string }[];
  competitors: { name: string; domain: string }[];
}

export async function completeOnboarding(
  payload: CompletePayload
): Promise<Brand | null> {
  const { data: brand } = await admin()
    .from("brands")
    .insert({
      name: payload.brandName,
      domain: payload.domain,
      is_primary: true,
      category: payload.category,
      description: payload.description,
      selected_models: payload.selectedModels,
    })
    .select()
    .single();

  if (!brand) return null;
  const brandId = (brand as Brand).id;

  if (payload.competitors.length) {
    await admin()
      .from("competitors")
      .insert(
        payload.competitors.map((c) => ({
          name: c.name,
          domain: c.domain,
          brand_id: brandId,
        }))
      );
  }

  if (payload.prompts.length) {
    await admin()
      .from("prompts")
      .insert(
        payload.prompts.map((p) => ({
          text: p.text,
          topic: p.topic || "Genel",
          brand_id: brandId,
        }))
      );
  }

  return brand as Brand;
}

export async function updateSelectedModels(
  brandId: string,
  models: ModelId[]
): Promise<void> {
  await admin()
    .from("brands")
    .update({ selected_models: models })
    .eq("id", brandId);
}
