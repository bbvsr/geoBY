"use client";
import { useEffect, useState } from "react";
import {
  DOMAIN_TYPE_COLORS,
  type DomainTypeBreakdown,
  type ModelId,
  type SourceRow,
  type TrendPoint,
} from "@/types";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { SourceChart } from "@/components/charts/SourceChart";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { api } from "@/lib/client";

interface SourcesData {
  sources: SourceRow[];
  domainTypes: DomainTypeBreakdown[];
  trend: TrendPoint[];
  topDomains: string[];
}

export function SourcesTab({
  days,
  model,
  refreshKey,
}: {
  days: number;
  model?: ModelId;
  refreshKey: number;
}) {
  const [view, setView] = useState<"domains" | "urls">("domains");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [domainTypes, setDomainTypes] = useState<DomainTypeBreakdown[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topDomains, setTopDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ days: String(days), view });
    if (model) params.set("model", model);
    api<SourcesData>(`/api/sources?${params}`)
      .then((d) => {
        if (!alive) return;
        setSources(d.sources);
        setDomainTypes(d.domainTypes);
        setTrend(d.trend);
        setTopDomains(d.topDomains);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days, model, view, refreshKey, retry]);

  if (error) return <ErrorBox message={error} onRetry={() => setRetry((r) => r + 1)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Kaynaklar</h1>
          <p className="text-[13px] text-muted-foreground">
            Yapay zeka cevaplarında kaynak gösterilen siteler. Görünür olmak için bu sitelerde yer almak önemlidir.
          </p>
        </div>
        <div className="flex items-center rounded-md bg-white/[0.04] p-0.5">
          {(["domains", "urls"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded px-3 py-1 text-[12px] transition-colors",
                view === v
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {v === "domains" ? "Domainler" : "URL'ler"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          {trend.length > 0 && topDomains.length > 0 && (
            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <h3 className="mb-2 text-[13px] font-semibold">
                Kaynak Alıntı Trendi
              </h3>
              <SourceChart data={trend} domains={topDomains} />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="overflow-x-auto rounded-lg border border-border/40 bg-card/60 lg:col-span-2">
              <div className="border-b border-border/30 px-5 py-3">
                <h3 className="text-[13px] font-semibold">
                  {view === "domains" ? "Domainler" : "URL'ler"}
                </h3>
              </div>
              {sources.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-muted-foreground/60">
                  Henüz kaynak yok. Cevaplarda geçen bağlantılar (Gemini ve
                  Perplexity testlerinde arama kaynakları) burada toplanır.
                </p>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                      <th className="px-5 py-2 text-left font-medium">#</th>
                      <th className="px-2 py-2 text-left font-medium">
                        {view === "domains" ? "Domain" : "URL"}
                      </th>
                      <th className="px-2 py-2 text-left font-medium">Tip</th>
                      <th className="px-2 py-2 text-left font-medium">
                        Cevaplarda
                      </th>
                      <th className="px-5 py-2 text-right font-medium">
                        Kaynak Payı
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s, i) => (
                      <tr
                        key={s.key}
                        className="border-t border-border/20 hover:bg-white/[0.015]"
                      >
                        <td className="px-5 py-2 text-muted-foreground/50 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="max-w-[280px] truncate px-2 py-2 text-foreground">
                          {s.key}
                        </td>
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
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
                              <span
                                className="block h-full rounded-full bg-primary/70"
                                style={{
                                  width: `${Math.min(100, s.retrievalRate)}%`,
                                }}
                              />
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {s.retrievalRate.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">
                          {(s.citationRate * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <h3 className="mb-3 text-[13px] font-semibold">Domain Tipleri</h3>
              {domainTypes.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/60">Veri yok.</p>
              ) : (
                <div className="space-y-2.5">
                  {domainTypes.map((t) => (
                    <div key={t.type} className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: DOMAIN_TYPE_COLORS[t.type] }}
                      />
                      <span className="w-24 text-[12px]">{t.type}</span>
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
          </div>
        </>
      )}
    </div>
  );
}
