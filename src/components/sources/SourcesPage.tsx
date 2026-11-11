"use client";
import { useMemo, useState } from "react";
import type { DomainType, DomainTypeBreakdown, SourceRow } from "@/types";
import { cn, pct } from "@/lib/utils";
import { useData } from "@/lib/client";
import { DOMAIN_TYPE_COLOR, DOMAIN_TYPE_HINT, DOMAIN_TYPE_LABEL } from "@/lib/labels";
import { ErrorState, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { useApp } from "@/components/app/AppContext";
import { Filters, useFilterQuery } from "@/components/app/Filters";

interface SourcesData {
  sources: SourceRow[];
  domainTypes: DomainTypeBreakdown[];
  totalRuns: number;
}

export function SourcesPage() {
  const { version, brand } = useApp();
  const [view, setView] = useState<"domains" | "urls">("domains");
  const [type, setType] = useState<DomainType | null>(null);
  const query = useFilterQuery();
  const { data, error, reload } = useData<SourcesData>(`/api/sources?${query}&view=${view}`, [version]);

  const rows = useMemo(() => (data?.sources ?? []).filter((s) => !type || s.domainType === type), [data, type]);
  const totalLinks = data?.domainTypes.reduce((s, d) => s + d.count, 0) ?? 0;
  const own = data?.sources.find((s) => s.domainType === "You");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Kaynaklar"
        description="Asistanların cevaplarında dayandığı siteler. Önerilmek için bu sitelerde yer almanız gerekir."
        actions={<Filters />}
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : totalLinks === 0 ? (
        <div className="max-w-[62ch] space-y-3 text-[15px] text-ink-2">
          <p className="font-serif text-[22px] leading-snug text-ink">Bu dönemde kaynak bağlantısı yok.</p>
          <p>
            Kaynaklar, cevabın içinde geçen bağlantılardan ve asistanın ayrıca gösterdiği kaynak listesinden toplanır.
            Gemini (Google aramasıyla) ve Perplexity testleri kaynak getirir; ChatGPT ve Claude cevapları çoğunlukla
            bağlantısızdır. Cevap yapıştırırken kaynak bağlantılarını ayrı alana eklemeyi unutmayın.
          </p>
        </div>
      ) : (
        <>
          <p className="max-w-[64ch] font-serif text-[21px] leading-[1.45] text-ink">
            {data.totalRuns} cevapta {totalLinks} kaynak bağlantısı var.{" "}
            {own
              ? `Kendi siteniz (${brand.domain}) cevapların ${pct(own.share)} kadarında kaynak gösterildi.`
              : `Kendi siteniz (${brand.domain}) hiç kaynak gösterilmedi.`}
          </p>

          <div>
            <div className="flex h-3 overflow-hidden rounded-[2px]" aria-hidden>
              {data.domainTypes.map((d) => (
                <div key={d.type} style={{ width: `${d.share * 100}%`, background: DOMAIN_TYPE_COLOR[d.type] }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Kaynak türüne göre süz">
              <TypeChip active={type === null} onClick={() => setType(null)} label="Tümü" />
              {data.domainTypes.map((d) => (
                <TypeChip
                  key={d.type}
                  active={type === d.type}
                  onClick={() => setType(type === d.type ? null : d.type)}
                  label={`${DOMAIN_TYPE_LABEL[d.type]} ${pct(d.share)}`}
                  color={DOMAIN_TYPE_COLOR[d.type]}
                  title={DOMAIN_TYPE_HINT[d.type]}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] text-ink-3">
                {rows.length} {view === "domains" ? "site" : "sayfa"}
              </p>
              <Segmented
                label="Gruplama"
                value={view}
                onChange={setView}
                options={[
                  { value: "domains", label: "Sitelere göre" },
                  { value: "urls", label: "Sayfalara göre" },
                ]}
              />
            </div>
            <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
              <table className="w-full min-w-[560px] text-[14px]">
                <thead>
                  <tr className="border-b border-line-strong text-left text-[13px] text-ink-3">
                    <th className="w-10 py-2 font-normal">#</th>
                    <th className="py-2 font-normal">{view === "domains" ? "Site" : "Sayfa"}</th>
                    <th className="py-2 font-normal">Tür</th>
                    <th className="w-[180px] py-2 font-normal">Cevapların</th>
                    <th className="w-16 py-2 text-right font-normal">Bağlantı</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => (
                    <tr key={s.key} className="border-b border-line">
                      <td className="py-2.5 text-[13px] text-ink-4 tnum">{i + 1}</td>
                      <td className="max-w-[360px] py-2.5 pr-3">
                        <a
                          href={view === "domains" ? `https://${s.key}` : s.key}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className={cn("block truncate hover:underline hover:underline-offset-[3px]", s.domainType === "You" && "font-medium")}
                          title={s.key}
                        >
                          {s.key}
                        </a>
                      </td>
                      <td className="py-2.5 pr-3 text-[13px] text-ink-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-[2px]" style={{ background: DOMAIN_TYPE_COLOR[s.domainType] }} aria-hidden />
                          {DOMAIN_TYPE_LABEL[s.domainType]}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-[2px] bg-sunken">
                            <div className="h-full rounded-[2px] bg-ink-3" style={{ width: `${s.share * 100}%` }} />
                          </div>
                          <span className="w-10 text-right tnum">{pct(s.share)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-ink-3 tnum">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  label,
  color,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3"
      )}
    >
      {color && <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} aria-hidden />}
      {label}
    </button>
  );
}
