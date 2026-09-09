"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Eye,
  ExternalLink,
  FileText,
  Gauge,
  Link2,
  MessageSquare,
  Smile,
  Target,
} from "lucide-react";
import {
  DOMAIN_TYPE_COLORS,
  MODEL_COLORS,
  MODEL_SHORT,
  type ActionItem,
  type Brand,
  type Competitor,
  type DomainTypeBreakdown,
  type ModelId,
  type OverviewMetrics,
  type RankingRow,
  type RecentChat,
  type Schedule,
  type SourceRow,
  type TrendPoint,
} from "@/types";
import { cn, formatPercent, initials, sentimentColor, timeAgo } from "@/lib/utils";
import { MetricCard } from "@/components/ui/MetricCard";
import { VisibilityChart } from "@/components/charts/VisibilityChart";
import { Spinner } from "@/components/ui/Spinner";

interface OverviewData {
  metrics: OverviewMetrics;
  rankings: RankingRow[];
  trend: TrendPoint[];
  sources: SourceRow[];
  domainTypes: DomainTypeBreakdown[];
  actions: ActionItem[];
  insight: string;
  recentChats: RecentChat[];
  schedule: Schedule | null;
  promptCount: number;
}

export function OverviewTab({
  days,
  model,
  brand,
  competitors,
  onOpenPrompt,
}: {
  days: number;
  model?: ModelId;
  brand: Brand;
  competitors: Competitor[];
  onOpenPrompt: (id?: string) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (model) params.set("model", model);
    fetch(`/api/overview?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData(d);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days, model]);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const m = data.metrics;
  const dueAlarm =
    data.schedule?.is_active &&
    data.schedule.next_due_at &&
    new Date(data.schedule.next_due_at).getTime() <= Date.now();

  const isEmpty = m.totalRuns === 0;

  return (
    <div className="space-y-6">
      {/* Alarm bandı */}
      {dueAlarm && (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/[0.08] px-4 py-2.5">
          <AlertCircle className="h-4 w-4 text-warning" />
          <span className="text-[13px] text-foreground">
            Yeniden test zamanı geldi ({data.schedule?.frequency === "weekly" ? "haftalık" : "aylık"} alarm). Soru
            setinizi tekrar test edip görünürlüğü güncelleyin.
          </span>
          <button
            onClick={() => onOpenPrompt()}
            className="ml-auto text-[12px] font-medium text-warning hover:underline"
          >
            Manuel Test →
          </button>
        </div>
      )}

      {isEmpty && (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-[13px] text-foreground">
            Henüz test verisi yok. Bir sorunun LLM cevabını{" "}
            <button
              onClick={() => onOpenPrompt()}
              className="font-medium text-primary hover:underline"
            >
              Manuel Test
            </button>{" "}
            ekranından yapıştırarak görünürlük ölçmeye başlayın.
          </span>
        </div>
      )}

      {/* Metrikler + Chart */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex w-full flex-col gap-3 lg:w-[280px]">
          <MetricCard
            label="Görünürlük"
            value={formatPercent(m.visibility)}
            icon={Eye}
            change={m.visibilityChange}
          />
          <MetricCard
            label="Geçtiği Testler"
            value={`${m.mentionedRuns} / ${m.totalRuns}`}
            icon={Target}
          />
          <MetricCard
            label="Ort. Sentiment"
            value={String(m.avgSentiment)}
            icon={Smile}
          />
          <MetricCard
            label="Ort. Konum"
            value={m.avgPosition ? `#${m.avgPosition.toFixed(1)}` : "—"}
            icon={Gauge}
          />
        </div>

        <div className="flex-1 rounded-lg border border-border/40 bg-card/60 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Görünürlük Trendi</h3>
            <span className="text-[11px] text-muted-foreground">
              Haftalık · %
            </span>
          </div>
          <VisibilityChart
            data={data.trend}
            brand={brand}
            competitors={competitors}
          />
        </div>
      </div>

      {/* Sıralama + AI Etki */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RankingsTable rankings={data.rankings} />
        </div>
        <AiImpact metrics={m} insight={data.insight} />
      </div>

      {/* Aksiyonlar */}
      <ActionsSection actions={data.actions} />

      {/* Kaynak özeti + Domain tipleri */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SourcesSummary sources={data.sources} />
        </div>
        <DomainTypes types={data.domainTypes} />
      </div>

      {/* Son testler */}
      {data.recentChats.length > 0 && (
        <RecentChats chats={data.recentChats} onOpen={onOpenPrompt} />
      )}
    </div>
  );
}

function RankingsTable({ rankings }: { rankings: RankingRow[] }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/60">
      <div className="border-b border-border/30 px-5 py-3">
        <h3 className="text-[13px] font-semibold">Sıralama</h3>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
            <th className="px-5 py-2 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Marka</th>
            <th className="px-2 py-2 text-left font-medium">Görünürlük</th>
            <th className="px-2 py-2 text-left font-medium">SOV</th>
            <th className="px-2 py-2 text-left font-medium">Sentiment</th>
            <th className="px-5 py-2 text-right font-medium">Konum</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((r, i) => (
            <tr
              key={r.name}
              className={cn(
                "border-t border-border/20 hover:bg-white/[0.015]",
                r.isYou && "bg-primary/[0.03]"
              )}
            >
              <td className="px-5 py-2.5 text-muted-foreground tabular-nums">
                {i + 1}
              </td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded text-[9px] font-semibold",
                      r.isYou
                        ? "bg-primary/20 text-primary"
                        : "bg-white/[0.06] text-muted-foreground"
                    )}
                  >
                    {initials(r.name)}
                  </span>
                  <span className={r.isYou ? "font-medium text-primary" : ""}>
                    {r.name}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-1 w-14 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(100, r.visibility * 100)}%`,
                        backgroundColor: r.isYou ? "#2eb88a" : "#525259",
                      }}
                    />
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatPercent(r.visibility)}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2.5 tabular-nums text-muted-foreground">
                {r.isYou ? formatPercent(r.sov) : "—"}
              </td>
              <td className="px-2 py-2.5">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: sentimentColor(r.sentiment) }}
                  />
                  <span className="tabular-nums text-muted-foreground">
                    {r.sentiment}
                  </span>
                </span>
              </td>
              <td
                className={cn(
                  "px-5 py-2.5 text-right tabular-nums",
                  r.isYou ? "text-primary" : "text-muted-foreground"
                )}
              >
                {r.position ? `#${r.position.toFixed(1)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiImpact({
  metrics,
  insight,
}: {
  metrics: OverviewMetrics;
  insight: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-5">
      <h3 className="mb-4 text-[13px] font-semibold">AI Arama Etkisi</h3>
      <div className="flex items-center justify-around">
        <Circle
          value={`#${metrics.competitiveRank}`}
          label="Rekabet Sırası"
          className="bg-primary/10 text-primary ring-1 ring-primary/20"
        />
        <Circle
          value={formatPercent(metrics.visibility)}
          label="AI Görünürlük"
          className="bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
        />
        <Circle
          value={String(metrics.totalCitations)}
          label="Toplam Alıntı"
          className="bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
        />
      </div>
      <div className="mt-4 rounded-md bg-white/[0.02] p-3 text-[12px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Anahtar İçgörü: </span>
        {insight}
      </div>
    </div>
  );
}

function Circle({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full text-[16px] font-bold tabular-nums",
          className
        )}
      >
        {value}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
    </div>
  );
}

const PRIORITY_BORDER = {
  high: "border-l-destructive",
  medium: "border-l-warning",
  low: "border-l-blue-500",
};
const PRIORITY_LABEL = { high: "Yüksek", medium: "Orta", low: "Düşük" };

function ActionsSection({ actions }: { actions: ActionItem[] }) {
  const earned = actions.filter((a) => a.kind === "earned");
  const owned = actions.filter((a) => a.kind === "owned");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ActionColumn
        title="Kazanılmış · Site Dışı"
        icon={<ExternalLink className="h-4 w-4 text-blue-400" />}
        actions={earned}
      />
      <ActionColumn
        title="Sahip Olunan · Site İçi"
        icon={<FileText className="h-4 w-4 text-primary" />}
        actions={owned}
      />
    </div>
  );
}

function ActionColumn({
  title,
  icon,
  actions,
}: {
  title: string;
  icon: React.ReactNode;
  actions: ActionItem[];
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-[13px] font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">
        {actions.length === 0 && (
          <p className="text-[12px] text-muted-foreground/60">
            Şu an öneri yok.
          </p>
        )}
        {actions.map((a, i) => (
          <div
            key={i}
            className={cn(
              "rounded-md border-l-2 bg-white/[0.02] px-3 py-2.5",
              PRIORITY_BORDER[a.priority]
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium">{a.title}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                {PRIORITY_LABEL[a.priority]}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {a.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesSummary({ sources }: { sources: SourceRow[] }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/60">
      <div className="border-b border-border/30 px-5 py-3">
        <h3 className="text-[13px] font-semibold">En Çok Alıntılanan Domainler</h3>
      </div>
      {sources.length === 0 ? (
        <p className="px-5 py-6 text-[12px] text-muted-foreground/60">
          Henüz alıntı kaynağı yok.
        </p>
      ) : (
        <table className="w-full text-[12px]">
          <tbody>
            {sources.map((s, i) => (
              <tr
                key={s.key}
                className="border-t border-border/20 hover:bg-white/[0.015]"
              >
                <td className="px-5 py-2 text-muted-foreground/50 tabular-nums">
                  {i + 1}
                </td>
                <td className="px-2 py-2 text-foreground">{s.key}</td>
                <td className="px-2 py-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      color: DOMAIN_TYPE_COLORS[s.domainType],
                      backgroundColor: `${DOMAIN_TYPE_COLORS[s.domainType]}1f`,
                    }}
                  >
                    {s.domainType}
                  </span>
                </td>
                <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">
                  {s.retrievalRate.toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DomainTypes({ types }: { types: DomainTypeBreakdown[] }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-5">
      <h3 className="mb-3 text-[13px] font-semibold">Domain Tipleri</h3>
      {types.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/60">Veri yok.</p>
      ) : (
        <div className="space-y-2.5">
          {types.map((t) => (
            <div key={t.type} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: DOMAIN_TYPE_COLORS[t.type] }}
              />
              <span className="w-24 text-[12px] text-foreground">{t.type}</span>
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${t.percent}%`,
                    backgroundColor: DOMAIN_TYPE_COLORS[t.type],
                  }}
                />
              </span>
              <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                {t.percent.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentChats({
  chats,
  onOpen,
}: {
  chats: RecentChat[];
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[13px] font-semibold">Son Testler</h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {chats.map((c) => (
          <button
            key={c.promptId}
            onClick={() => onOpen(c.promptId)}
            className="rounded-lg border border-border/40 bg-card/60 p-4 text-left transition-colors hover:bg-white/[0.02]"
          >
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <span className="line-clamp-2 text-[13px] leading-snug">
                {c.promptText}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {c.models.map((mm) => (
                <span
                  key={mm}
                  className="rounded px-1 py-0.5 text-[9px] font-semibold"
                  style={{
                    color: MODEL_COLORS[mm],
                    backgroundColor: `${MODEL_COLORS[mm]}1f`,
                  }}
                >
                  {MODEL_SHORT[mm]}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Link2 className="h-3 w-3" /> {c.citationCount}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: sentimentColor(c.sentiment) }}
                />
                {c.sentiment}
              </span>
              <span>{c.position ? `#${c.position.toFixed(1)}` : "—"}</span>
              <span className="ml-auto">{timeAgo(c.date)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
