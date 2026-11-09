// ---- Model kimlikleri ----
export type ModelId =
  | "openai"
  | "claude"
  | "gemini"
  | "perplexity"
  | "google_aio";

export const ALL_MODELS: ModelId[] = [
  "openai",
  "claude",
  "gemini",
  "perplexity",
  "google_aio",
];

export const MODEL_LABELS: Record<ModelId, string> = {
  openai: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
  google_aio: "AI Overview",
};

export const MODEL_SHORT: Record<ModelId, string> = {
  openai: "GPT",
  claude: "CL",
  gemini: "GM",
  perplexity: "PX",
  google_aio: "AIO",
};

export const MODEL_COLORS: Record<ModelId, string> = {
  openai: "#10a37f",
  claude: "#d97640",
  gemini: "#4285f4",
  perplexity: "#20b2aa",
  google_aio: "#ea4335",
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

export interface BrandDocument {
  id: string;
  brand_id: string;
  name: string;
  storage_path: string;
  mime: string | null;
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

export interface RankingRow {
  name: string;
  domain: string;
  isYou: boolean;
  visibility: number;
  sov: number;
  sentiment: number;
  position: number | null;
  change?: number;
}

export interface TrendPoint {
  date: string;
  [brandName: string]: number | string;
}

export interface SourceRow {
  key: string; // domain veya url
  domainType: DomainType;
  retrievalRate: number;
  citationRate: number;
  count: number;
}

export interface DomainTypeBreakdown {
  type: DomainType;
  count: number;
  percent: number;
}

export interface OverviewMetrics {
  visibility: number;
  visibilityChange: number;
  mentionedRuns: number;
  totalRuns: number;
  avgSentiment: number;
  avgPosition: number | null;
  totalCitations: number;
  competitiveRank: number;
}

export interface RecentChat {
  promptId: string;
  mentioned: boolean;
  promptText: string;
  models: ModelId[];
  citationCount: number;
  sentiment: number;
  position: number | null;
  date: string;
}

export interface ActionItem {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  kind: "earned" | "owned";
}

export interface PromptWithMetrics extends Prompt {
  visibility: number;
  sentiment: number;
  position: number | null;
  models: ModelId[];
  totalRuns: number;
}

export interface ModelBreakdown {
  model: ModelId;
  mentioned: boolean;
  mentionCount: number;
  position: number | null;
  sentiment: Sentiment;
  citationCount: number;
  response: string | null;
  queryText: string | null;
  source: string | null;
  date: string | null;
  competitorsMentioned: string[];
  hasRun: boolean;
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
export interface AiModelStatus {
  model: ModelId;
  auto: boolean;
  engine: { label: string; free: boolean; exact: boolean } | null;
  unlockWith: string[];
}

export interface AiProviderStatus {
  id: string;
  label: string;
  free: boolean;
  envKey: string | null;
  signupUrl: string;
  note: string;
  configured: boolean;
}

export interface AiStatus {
  models: AiModelStatus[];
  providers: AiProviderStatus[];
  assistant: string | null;
  storage: "supabase" | "local";
}
