import type {
  Brand,
  Citation,
  Competitor,
  DomainType,
  DomainTypeBreakdown,
  ModelId,
  OverviewMetrics,
  Prompt,
  RankingRow,
  RecentChat,
  Run,
  SourceRow,
  TrendPoint,
  Sentiment,
} from "@/types";

const SENTIMENT_SCORE: Record<Sentiment, number> = {
  positive: 80,
  neutral: 55,
  negative: 30,
};

export function visibility(runs: Run[]): number {
  if (runs.length === 0) return 0;
  const mentioned = runs.filter((r) => r.mentioned).length;
  return mentioned / runs.length;
}

export function avgSentiment(runs: Run[]): number {
  const scoped = runs.filter((r) => r.mentioned);
  if (scoped.length === 0) return 0;
  const total = scoped.reduce(
    (s, r) => s + (SENTIMENT_SCORE[r.sentiment] ?? 55),
    0
  );
  return Math.round(total / scoped.length);
}

export function avgPosition(runs: Run[]): number | null {
  const scores = runs
    .filter((r) => r.position_score != null)
    .map((r) => r.position_score as number);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Share of Voice: markanın geçişleri / (marka + tüm rakip geçişleri) */
export function shareOfVoice(runs: Run[]): number {
  let brand = 0;
  let comp = 0;
  for (const r of runs) {
    if (r.mentioned) brand += 1;
    const mentions = r.competitor_mentions ?? {};
    for (const k of Object.keys(mentions)) if (mentions[k]) comp += 1;
  }
  const denom = brand + comp;
  return denom === 0 ? 0 : brand / denom;
}

function sundayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Haftalık (Pazar başlangıç) görünürlük trendi: marka + her rakip. */
export function visibilityTrend(
  runs: Run[],
  brand: Brand,
  competitors: Competitor[],
  weeks = 8
): TrendPoint[] {
  const now = new Date();
  const buckets: { start: Date; runs: Run[] }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = sundayOf(now);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ start, runs: [] });
  }

  for (const r of runs) {
    const wk = sundayOf(new Date(r.created_at)).getTime();
    const b = buckets.find((x) => x.start.getTime() === wk);
    if (b) b.runs.push(r);
  }

  return buckets.map(({ start, runs: wr }) => {
    const point: TrendPoint = {
      date: `${start.getDate()}/${start.getMonth() + 1}`,
    };
    // Test yapılmayan haftalar boş bırakılır (grafikte %0 gibi görünmesin)
    if (wr.length === 0) return point;
    point[brand.name] = Math.round(visibility(wr) * 100);
    for (const c of competitors) {
      const compRuns = wr.filter((r) => (r.competitor_mentions ?? {})[c.name]);
      point[c.name] = Math.round((compRuns.length / wr.length) * 100);
    }
    return point;
  });
}

export function rankings(
  runs: Run[],
  brand: Brand,
  competitors: Competitor[]
): RankingRow[] {
  const total = runs.length || 1;
  const rows: RankingRow[] = [];

  rows.push({
    name: brand.name,
    domain: brand.domain,
    isYou: true,
    visibility: visibility(runs),
    sov: shareOfVoice(runs),
    sentiment: avgSentiment(runs),
    position: avgPosition(runs),
  });

  // SOV paydası: tüm markaların (siz + rakipler) toplam geçiş sayısı
  let totalMentions = runs.filter((r) => r.mentioned).length;
  for (const r of runs) {
    for (const v of Object.values(r.competitor_mentions ?? {})) if (v) totalMentions += 1;
  }

  for (const c of competitors) {
    const compMentions = runs.filter(
      (r) => (r.competitor_mentions ?? {})[c.name]
    ).length;
    rows.push({
      name: c.name,
      domain: c.domain,
      isYou: false,
      visibility: compMentions / total,
      sov: totalMentions ? compMentions / totalMentions : 0,
      // Rakipler için ton/konum ölçülmez (yalnızca geçip geçmediği)
      sentiment: 0,
      position: null,
    });
  }

  return rows.sort((a, b) => b.visibility - a.visibility);
}

/** Şu anki dönem vs önceki eşit uzunlukta dönem görünürlük farkı (yüzde puan). */
export function visibilityChange(allRuns: Run[], days: number): number {
  const now = Date.now();
  const periodMs = days * 86400000;
  const current = allRuns.filter(
    (r) => now - new Date(r.created_at).getTime() <= periodMs
  );
  const previous = allRuns.filter((r) => {
    const age = now - new Date(r.created_at).getTime();
    return age > periodMs && age <= periodMs * 2;
  });
  if (previous.length === 0) return 0;
  return visibility(current) - visibility(previous);
}

// ---- Kaynaklar ----
export function domainSources(
  citations: Citation[],
  totalRuns: number
): SourceRow[] {
  return groupSources(citations, totalRuns, (c) => c.domain);
}

export function urlSources(
  citations: Citation[],
  totalRuns: number
): SourceRow[] {
  return groupSources(citations, totalRuns, (c) => c.url || c.domain);
}

function groupSources(
  citations: Citation[],
  totalRuns: number,
  keyFn: (c: Citation) => string
): SourceRow[] {
  const totalCitations = citations.length || 1;
  const map = new Map<string, { count: number; type: DomainType }>();
  for (const c of citations) {
    const key = keyFn(c);
    const cur = map.get(key) ?? { count: 0, type: c.domain_type };
    cur.count += 1;
    map.set(key, cur);
  }
  const rows: SourceRow[] = [];
  for (const [key, { count, type }] of map.entries()) {
    rows.push({
      key,
      domainType: type,
      retrievalRate: totalRuns ? (count / totalRuns) * 100 : 0,
      citationRate: count / totalCitations,
      count,
    });
  }
  return rows.sort((a, b) => b.count - a.count);
}

export function domainTypeBreakdown(
  citations: Citation[]
): DomainTypeBreakdown[] {
  const total = citations.length || 1;
  const map = new Map<DomainType, number>();
  for (const c of citations) {
    map.set(c.domain_type, (map.get(c.domain_type) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([type, count]) => ({
      type,
      count,
      percent: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Top domainlerin haftalık retrieval trendi (AreaChart). */
export function sourceTrend(
  citations: Citation[],
  runs: Run[],
  topDomains: string[],
  weeks = 8
): TrendPoint[] {
  const runDate = new Map(runs.map((r) => [r.id, r.created_at]));
  const now = new Date();
  const buckets: { start: Date; cites: Citation[] }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = sundayOf(now);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ start, cites: [] });
  }
  for (const c of citations) {
    const dateStr = runDate.get(c.run_id);
    if (!dateStr) continue;
    const wk = sundayOf(new Date(dateStr)).getTime();
    const b = buckets.find((x) => x.start.getTime() === wk);
    if (b) b.cites.push(c);
  }
  return buckets.map(({ start, cites }) => {
    const point: TrendPoint = {
      date: `${start.getDate()}/${start.getMonth() + 1}`,
    };
    for (const d of topDomains) {
      point[d] = cites.filter((c) => c.domain === d).length;
    }
    return point;
  });
}

// ---- Overview toplu metrik ----
export function overviewMetrics(
  runs: Run[],
  allRuns: Run[],
  citations: Citation[],
  ranked: RankingRow[],
  brand: Brand,
  days: number
): OverviewMetrics {
  const rank = ranked.findIndex((r) => r.isYou) + 1;
  return {
    visibility: visibility(runs),
    visibilityChange: visibilityChange(allRuns, days),
    mentionedRuns: runs.filter((r) => r.mentioned).length,
    totalRuns: runs.length,
    avgSentiment: avgSentiment(runs),
    avgPosition: avgPosition(runs),
    totalCitations: citations.length,
    competitiveRank: rank || 1,
  };
}

export function recentChats(
  runs: Run[],
  prompts: Prompt[],
  citations: Citation[],
  limit = 6
): RecentChat[] {
  const promptMap = new Map(prompts.map((p) => [p.id, p]));
  const citByRun = new Map<string, number>();
  for (const c of citations) {
    citByRun.set(c.run_id, (citByRun.get(c.run_id) ?? 0) + 1);
  }

  // Prompt bazında grupla, en yeni run zamanına göre sırala
  const byPrompt = new Map<string, Run[]>();
  for (const r of runs) {
    const arr = byPrompt.get(r.prompt_id) ?? [];
    arr.push(r);
    byPrompt.set(r.prompt_id, arr);
  }

  const chats: RecentChat[] = [];
  for (const [promptId, pr] of byPrompt.entries()) {
    const prompt = promptMap.get(promptId);
    if (!prompt) continue;
    const latest = pr.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b
    );
    const citationCount = pr.reduce(
      (s, r) => s + (citByRun.get(r.id) ?? 0),
      0
    );
    chats.push({
      promptId,
      mentioned: pr.some((r) => r.mentioned),
      promptText: prompt.text,
      models: [...new Set(pr.map((r) => r.model))] as ModelId[],
      citationCount,
      sentiment: avgSentiment(pr),
      position: avgPosition(pr),
      date: latest.created_at,
    });
  }
  return chats
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}
