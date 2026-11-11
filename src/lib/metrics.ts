/**
 * Görünürlük hesapları. Saf fonksiyonlar; veritabanına dokunmaz.
 *
 * Temel kural: "Görünürlük" yalnızca sorunun kendisinde marka adı GEÇMEYEN
 * (genel) sorulardan hesaplanır. "X alternatifleri" gibi markalı bir soruda
 * markanın cevapta geçmesi doğaldır ve görünürlüğü yapay olarak şişirir.
 * Markalı sorular tonu (sentiment) ölçmek için yine kullanılır.
 */
import type {
  Brand,
  BrandRow,
  Citation,
  Competitor,
  DomainType,
  DomainTypeBreakdown,
  GapItem,
  ModelId,
  ModelSummary,
  Prompt,
  Run,
  SentimentSummary,
  Sentiment,
  SourceRow,
  TrendPoint,
} from "@/types";
import { STANDARD_MODELS, ALL_MODELS } from "@/types";
import { textMentions } from "@/lib/parser";

const SENTIMENT_SCORE: Record<Sentiment, number> = { positive: 80, neutral: 55, negative: 30 };

export function isBrandedPrompt(text: string, brand: Pick<Brand, "name" | "domain">): boolean {
  return textMentions(text, brand.name, brand.domain);
}

export function visibility(runs: Run[]): number {
  if (runs.length === 0) return 0;
  return runs.filter((r) => r.mentioned).length / runs.length;
}

export function avgPosition(runs: Run[]): number | null {
  const scores = runs.filter((r) => r.mentioned && r.position_score != null).map((r) => r.position_score as number);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function sentimentSummary(runs: Run[]): SentimentSummary {
  const mentioned = runs.filter((r) => r.mentioned);
  const count = (s: Sentiment) => mentioned.filter((r) => r.sentiment === s).length;
  const score = mentioned.length
    ? Math.round(mentioned.reduce((s, r) => s + (SENTIMENT_SCORE[r.sentiment] ?? 55), 0) / mentioned.length)
    : null;
  return { score, positive: count("positive"), neutral: count("neutral"), negative: count("negative") };
}

/** Bir rakibin bir cevapta geçip geçmediği (yalnızca güncel rakipler sayılır). */
function competitorIn(run: Run, name: string): boolean {
  return !!(run.competitor_mentions ?? {})[name];
}

/** Marka ve güncel rakipler için görünürlük + ses payı (SOV). Görünürlüğe göre sıralı. */
export function brandRows(runs: Run[], brand: Brand, competitors: Competitor[]): BrandRow[] {
  const youMentions = runs.filter((r) => r.mentioned).length;
  const comp = competitors.map((c) => ({ c, mentions: runs.filter((r) => competitorIn(r, c.name)).length }));
  const totalMentions = youMentions + comp.reduce((s, x) => s + x.mentions, 0);
  const total = runs.length;

  const rows: BrandRow[] = [
    {
      name: brand.name,
      domain: brand.domain,
      isYou: true,
      visibility: total ? youMentions / total : 0,
      sov: totalMentions ? youMentions / totalMentions : 0,
      mentions: youMentions,
    },
    ...comp.map(({ c, mentions }) => ({
      name: c.name,
      domain: c.domain,
      isYou: false,
      visibility: total ? mentions / total : 0,
      sov: totalMentions ? mentions / totalMentions : 0,
      mentions,
    })),
  ];
  // Eşitlikte marka öne alınmaz: kullanıcıyı yanıltmamak için rakip önde kalır
  return rows.sort((a, b) => b.visibility - a.visibility || Number(a.isYou) - Number(b.isYou));
}

/** Sıra: sizden kesin olarak daha görünür marka sayısı + 1 (eşitlikte aynı sıra). */
export function rankOf(rows: BrandRow[]): number {
  const you = rows.find((r) => r.isYou);
  if (!you) return 0;
  return 1 + rows.filter((r) => !r.isYou && r.visibility > you.visibility).length;
}

/** Seçili dönemdeki görünürlüğün bir önceki eşit dönemle farkı (yüzde puan, 0-1). Önceki dönemde veri yoksa null. */
export function visibilityChange(genericRuns: Run[], days: number, now = Date.now()): number | null {
  const period = days * 86400000;
  const age = (r: Run) => now - new Date(r.created_at).getTime();
  const current = genericRuns.filter((r) => age(r) <= period);
  const previous = genericRuns.filter((r) => age(r) > period && age(r) <= 2 * period);
  if (previous.length === 0 || current.length === 0) return null;
  return visibility(current) - visibility(previous);
}

// ---- Haftalık trend ----

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - day);
  return d;
}

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Haftalık (Pazartesi başlangıçlı) görünürlük; test yapılmayan haftalarda değer yoktur. */
export function visibilityTrend(
  runs: Run[],
  brand: Brand,
  competitors: Competitor[],
  weeks: number,
  now = new Date()
): TrendPoint[] {
  const start = mondayOf(now);
  const buckets = new Map<string, Run[]>();
  const order: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i * 7);
    const k = isoDay(d);
    order.push(k);
    buckets.set(k, []);
  }
  for (const r of runs) {
    const k = isoDay(mondayOf(new Date(r.created_at)));
    buckets.get(k)?.push(r);
  }
  return order.map((week) => {
    const wr = buckets.get(week)!;
    const point: TrendPoint = { week };
    if (wr.length === 0) return point;
    point[brand.name] = Math.round(visibility(wr) * 100);
    for (const c of competitors) {
      point[c.name] = Math.round((wr.filter((r) => competitorIn(r, c.name)).length / wr.length) * 100);
    }
    return point;
  });
}

// ---- Asistan bazında ----

export function byModel(runs: Run[], selected: ModelId[]): ModelSummary[] {
  const models = ALL_MODELS.filter((m) => selected.includes(m) || runs.some((r) => r.model === m));
  return models
    .map((model) => {
      const mr = runs.filter((r) => r.model === model);
      return { model, runs: mr.length, visibility: mr.length ? visibility(mr) : null };
    })
    .sort((a, b) => STANDARD_MODELS.indexOf(a.model) - STANDARD_MODELS.indexOf(b.model));
}

// ---- Fırsatlar: markanın geçmediği, rakiplerin geçtiği sorular ----

export interface Batch {
  promptId: string;
  model: Run["model"];
  /** En yeni önce */
  runs: Run[];
  hits: number;
  /** Çoğunlukla (yarı veya daha fazla) önerildi mi */
  mentioned: boolean;
  /** Önerildiği testlerdeki ortalama sıra */
  position: number | null;
}

/** Bir testin deneme grubu: aynı batch_id'yi taşıyan testler; kimliği yoksa yalnızca kendisi. */
export function sameBatch<T extends Pick<Run, "id" | "batch_id">>(run: T, all: T[]): T[] {
  return run.batch_id ? all.filter((r) => r.batch_id === run.batch_id) : [run];
}

/**
 * Her (soru, asistan) ikilisinin son deneme grubu. Tekrarlı ölçümde (ör. 3 deneme)
 * tek bir şanslı/şanssız cevap yerine çoğunluk esas alınır.
 */
export function latestBatches(runs: Run[]): Batch[] {
  const groups = new Map<string, Run[]>();
  for (const r of runs) {
    const k = `${r.prompt_id}:${r.model}`;
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }
  const out: Batch[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const batch = sameBatch(list[0], list);
    const hits = batch.filter((r) => r.mentioned).length;
    out.push({
      promptId: list[0].prompt_id,
      model: list[0].model,
      runs: batch,
      hits,
      mentioned: hits * 2 >= batch.length && hits > 0,
      position: avgPosition(batch),
    });
  }
  return out;
}

export function gaps(genericRuns: Run[], prompts: Prompt[], competitors: Competitor[], limit = 6): GapItem[] {
  const byId = new Map(prompts.map((p) => [p.id, p]));
  const items = new Map<string, GapItem>();
  for (const b of latestBatches(genericRuns)) {
    if (b.mentioned) continue;
    const prompt = byId.get(b.promptId);
    if (!prompt || !prompt.is_active) continue;
    const hits = competitors.filter((c) => b.runs.some((r) => competitorIn(r, c.name))).map((c) => c.name);
    if (hits.length === 0) continue;
    const item = items.get(prompt.id) ?? { promptId: prompt.id, text: prompt.text, competitors: [], models: [] };
    for (const h of hits) if (!item.competitors.includes(h)) item.competitors.push(h);
    if (!item.models.includes(b.model)) item.models.push(b.model);
    items.set(prompt.id, item);
  }
  // En çok rakibin ve asistanın geçtiği sorular önce
  return [...items.values()]
    .sort((a, b) => b.competitors.length + b.models.length - (a.competitors.length + a.models.length))
    .slice(0, limit);
}

// ---- Kaynaklar ----

export function sourceRows(citations: Citation[], totalRuns: number, by: "domain" | "url"): SourceRow[] {
  const map = new Map<string, { runs: Set<string>; count: number; type: DomainType }>();
  for (const c of citations) {
    const key = by === "url" ? c.url || c.domain : c.domain;
    const cur = map.get(key) ?? { runs: new Set<string>(), count: 0, type: c.domain_type };
    cur.runs.add(c.run_id);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      domainType: v.type,
      // Bir cevapta aynı site birden çok kez geçse de bir kez sayılır
      share: totalRuns ? v.runs.size / totalRuns : 0,
      count: v.count,
    }))
    .sort((a, b) => b.share - a.share || b.count - a.count || a.key.localeCompare(b.key));
}

export function domainTypeBreakdown(citations: Citation[]): DomainTypeBreakdown[] {
  const total = citations.length;
  const map = new Map<DomainType, number>();
  for (const c of citations) map.set(c.domain_type, (map.get(c.domain_type) ?? 0) + 1);
  return [...map.entries()]
    .map(([type, count]) => ({ type, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}
