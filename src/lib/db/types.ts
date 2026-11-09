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

export interface TableCheck {
  allTablesExist: boolean;
  results: { table: string; exists: boolean }[];
  error?: string;
}

export interface RunFilter {
  brandId: string;
  days?: number;
  model?: ModelId;
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
  source: string;
}

export interface NewCitation {
  domain: string;
  url: string;
  domain_type: string;
}

export interface CompletePayload {
  brandName: string;
  domain: string;
  category: string;
  description: string;
  selectedModels: ModelId[];
  prompts: { text: string; topic: string }[];
  competitors: { name: string; domain: string }[];
}

export interface BrandPatch {
  name?: string;
  domain?: string;
  category?: string;
  description?: string;
}

/** Uygulamanın ihtiyaç duyduğu tüm veri işlemleri. İki uygulaması var: Supabase ve yerel dosya. */
export interface DataStore {
  readonly kind: "supabase" | "local";
  checkTables(): Promise<TableCheck>;

  getPrimaryBrand(): Promise<Brand | null>;
  updateBrand(id: string, patch: BrandPatch): Promise<Brand | null>;
  updateSelectedModels(brandId: string, models: ModelId[]): Promise<void>;
  completeOnboarding(payload: CompletePayload): Promise<Brand>;

  getCompetitors(brandId: string): Promise<Competitor[]>;
  addCompetitor(brandId: string, name: string, domain: string): Promise<Competitor>;
  deleteCompetitor(id: string): Promise<void>;

  getPrompts(brandId: string, activeOnly?: boolean): Promise<Prompt[]>;
  getPromptById(id: string): Promise<Prompt | null>;
  createPrompt(brandId: string, text: string, topic: string): Promise<Prompt>;
  updatePrompt(id: string, patch: { text?: string; topic?: string; is_active?: boolean }): Promise<void>;

  getRuns(filter: RunFilter): Promise<Run[]>;
  getRunsForPrompt(promptId: string): Promise<Run[]>;
  createRun(run: NewRun): Promise<Run>;

  getCitationsForRuns(runIds: string[]): Promise<Citation[]>;
  createCitations(runId: string, citations: NewCitation[]): Promise<void>;

  getSchedule(brandId: string): Promise<Schedule | null>;
  saveSchedule(brandId: string, frequency: "weekly" | "monthly", isActive: boolean): Promise<Schedule>;
  /** Test yapıldığında alarmı bir sonraki döneme ilerletir. */
  markTested(brandId: string): Promise<void>;

  getDocuments(brandId: string): Promise<BrandDocument[]>;
  saveDocument(brandId: string, file: { name: string; type: string; data: Buffer }): Promise<BrandDocument>;
}

export function sinceIso(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString();
}

export function nextDueIso(frequency: "weekly" | "monthly", from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + (frequency === "weekly" ? 7 : 30));
  return d.toISOString();
}
