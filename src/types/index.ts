// ---- Model kimlikleri ----
export type ModelId =
  | "openai"
  | "claude"
  | "gemini"
  | "perplexity"
  | "google_aio"
  | "local";

/** Herkesin kullandığı beş asistan — yeni markada varsayılan olarak izlenir. */
export const STANDARD_MODELS: ModelId[] = [
  "openai",
  "gemini",
  "claude",
  "perplexity",
  "google_aio",
];

/** Standart asistanlar + kullanıcının kendi bilgisayarındaki model (ayarlıysa). */
export const ALL_MODELS: ModelId[] = [...STANDARD_MODELS, "local"];

export const MODEL_LABELS: Record<ModelId, string> = {
  openai: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  google_aio: "AI Overview",
  local: "Yerel model",
};

export const MODEL_SHORT: Record<ModelId, string> = {
  openai: "GPT",
  claude: "CL",
  gemini: "GM",
  perplexity: "PX",
  google_aio: "AIO",
  local: "YRL",
};

export const MODEL_COLORS: Record<ModelId, string> = {
  openai: "#10a37f",
  claude: "#d97640",
  gemini: "#4285f4",
  perplexity: "#20b2aa",
  google_aio: "#ea4335",
  local: "#6b7280",
};

export type Sentiment = "positive" | "neutral" | "negative";

export type DomainType =
  | "Corporate"
  | "UGC"
  | "You"
  | "Competitor"
  | "Reference"
  | "Other"
  | "Editorial"
  | "Institutional";

export const DOMAIN_TYPE_COLORS: Record<DomainType, string> = {
  Corporate: "#f5a623",
  UGC: "#3b82f6",
  You: "#2eb88a",
  Competitor: "#e5484d",
  Reference: "#8b5cf6",
  Other: "#525259",
  Editorial: "#6366f1",
  Institutional: "#14b8a6",
};

// Rakip grafik renkleri (sıralı)
export const COMPETITOR_COLORS = [
  "#e5484d",
  "#3b82f6",
  "#f5a623",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

// ---- DB kayıtları ----
export interface Brand {
  id: string;
  name: string;
  domain: string;
  is_primary: boolean;
  category: string | null;
  description: string | null;
  selected_models: ModelId[];
  /** Otomatik testte her sorunun asistan başına kaç kez sorulacağı (1, 3 veya 5) */
  samples?: number;
  created_at: string;
}

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  brand_id: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  text: string;
  topic: string;
  tags: string[];
  is_active: boolean;
  brand_id: string;
  created_at: string;
}

export interface Run {
  id: string;
  prompt_id: string;
  model: ModelId;
  response: string | null;
  query_text: string | null;
  mentioned: boolean;
  mention_count: number;
  position_score: number | null;
  sentiment: Sentiment;
  competitor_mentions: Record<string, boolean>;
  source: string;
  /** Aynı otomatik test çalıştırmasındaki tekrarlar aynı kimliği taşır */
  batch_id?: string | null;
  created_at: string;
}

export interface Citation {
  id: string;
  run_id: string;
  domain: string;
  url: string | null;
  domain_type: DomainType;
  created_at: string;
}

export interface Schedule {
  id: string;
  brand_id: string;
  frequency: "weekly" | "monthly";
  last_run_at: string | null;
  next_due_at: string | null;
  is_active: boolean;
  created_at: string;
}

// ---- Türetilmiş / API tipleri ----
export interface CrawlResult {
  title: string;
  description: string;
  category: string;
  targetAudience: string;
  coreUseCase: string;
  keywords: string[];
  competitorHints: string[];
  brandName: string;
  /** Yapay zeka ile analiz edildiyse önerilen sorular/rakipler */
  suggestedPrompts?: { text: string; topic: string }[];
  suggestedCompetitors?: { name: string; domain: string }[];
  /** Analizi yapan sağlayıcı (yoksa kural tabanlı) */
  analyzedBy?: string | null;
  /** Site çekilebildi mi */
  fetched?: boolean;
}

export interface TrendPoint {
  /** Haftanın başlangıcı (Pazartesi), YYYY-AA-GG */
  week: string;
  /** Marka/rakip adı → görünürlük yüzdesi; o hafta test yoksa alan hiç yoktur */
  [brandName: string]: number | string;
}

export interface SourceRow {
  key: string; // alan adı veya URL
  domainType: DomainType;
  /** Cevapların yüzde kaçında kaynak olarak geçti (0-1) */
  share: number;
  count: number;
}

export interface DomainTypeBreakdown {
  type: DomainType;
  count: number;
  /** 0-1 */
  share: number;
}

export interface ActionItem {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  kind: "earned" | "owned";
}

export interface BrandRow {
  name: string;
  domain: string;
  isYou: boolean;
  /** Genel (marka adı geçmeyen) sorularda cevapların yüzde kaçında geçti (0-1) */
  visibility: number;
  /** Tüm marka geçişleri içindeki payı (0-1) */
  sov: number;
  mentions: number;
}

export interface SentimentSummary {
  /** 0-100, marka hiç geçmediyse null */
  score: number | null;
  positive: number;
  neutral: number;
  negative: number;
}

export interface ModelSummary {
  model: ModelId;
  runs: number;
  /** null: bu modelde genel soru testi yok */
  visibility: number | null;
}

/** Markanın geçmediği ama rakiplerin geçtiği soru — en somut fırsat. */
export interface GapItem {
  promptId: string;
  text: string;
  competitors: string[];
  models: ModelId[];
}

export interface OverviewReport {
  days: number;
  totals: {
    runs: number;
    /** Görünürlük hesabına giren (marka adı geçmeyen sorulardaki) cevaplar */
    genericRuns: number;
    activePrompts: number;
    testedPrompts: number;
    lastTestAt: string | null;
  };
  visibility: { value: number; mentioned: number; total: number; change: number | null };
  rank: { position: number; of: number };
  avgPosition: number | null;
  sentiment: SentimentSummary;
  brands: BrandRow[];
  byModel: ModelSummary[];
  trend: TrendPoint[];
  gaps: GapItem[];
  sources: SourceRow[];
  domainTypes: DomainTypeBreakdown[];
  actions: ActionItem[];
  summary: string;
  schedule: Schedule | null;
}

/** Soru × model tablosundaki bir hücre: o modeldeki en son test. */
export interface PromptCell {
  runId: string;
  /** Son deneme grubunda çoğunlukla önerildi mi */
  mentioned: boolean;
  /** Son deneme grubundaki test sayısı ve markanın geçtiği test sayısı */
  samples: number;
  hits: number;
  position: number | null;
  sentiment: Sentiment;
  date: string;
}

export interface PromptRow extends Prompt {
  /** Soru metninde markanın adı geçiyor (görünürlük hesabına girmez) */
  branded: boolean;
  cells: Partial<Record<ModelId, PromptCell>>;
  /** Dönemdeki tüm testlerde geçme oranı (0-1); test yoksa null */
  visibility: number | null;
  totalRuns: number;
  lastRunAt: string | null;
}

export interface RunDetail extends Run {
  citations: { domain: string; url: string | null; domain_type: DomainType }[];
}

export interface PromptDetail {
  prompt: Prompt;
  branded: boolean;
  /** En yeni önce */
  runs: RunDetail[];
}

// Parser çıktısı
export interface ParsedResponse {
  mentioned: boolean;
  mentionCount: number;
  positionScore: number | null;
  sentiment: Sentiment;
  competitorMentions: Record<string, boolean>;
  citations: { domain: string; url: string; domainType: DomainType }[];
}

// ---- Yapay zeka bağlantı durumu (/api/ai/status) ----
export interface AiEngine {
  provider: string;
  providerLabel: string;
  model: string | null;
  free: boolean;
  /** exact: ürünün kendi modeli · close: yakın açık model · rough: kaba deneme */
  fidelity: "exact" | "close" | "rough";
  note: string;
}

export interface AiModelStatus {
  model: ModelId;
  auto: boolean;
  engine: AiEngine | null;
  /** Otomatik testi açan ortam değişkenleri */
  unlockWith: string[];
}

export interface AiProviderStatus {
  id: string;
  label: string;
  free: boolean;
  envKey: string;
  envExample: string;
  signupUrl: string | null;
  note: string;
  configured: boolean;
}

export interface AiStatus {
  models: AiModelStatus[];
  providers: AiProviderStatus[];
  /** Site analizi ve önerileri yapan sağlayıcı (yoksa kural tabanlı) */
  assistant: string | null;
  storage: "supabase" | "local";
}
