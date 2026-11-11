"use client";
import Link from "next/link";
import { ArrowRight, ClipboardText, Key, Play } from "@phosphor-icons/react";
import { MODEL_LABELS, type OverviewReport } from "@/types";
import { cn, decimal, pct, pointChange, timeAgo } from "@/lib/utils";
import { useData } from "@/lib/client";
import { DOMAIN_TYPE_COLOR, DOMAIN_TYPE_LABEL } from "@/lib/labels";
import { Button, ErrorState, Notice, PageHeader, PageSkeleton, Section, Tag } from "@/components/ui";
import { useApp } from "@/components/app/AppContext";
import { Filters, useFilterQuery } from "@/components/app/Filters";
import { TrendChart } from "./TrendChart";

export function OverviewPage() {
  const { version, brand } = useApp();
  const query = useFilterQuery();
  const { data, error, reload } = useData<{ report: OverviewReport | null }>(`/api/overview?${query}`, [version]);
  const report = data?.report;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Yapay zekâ görünürlüğü"
        description={
          report && report.totals.runs > 0 ? (
            <>
              {brand.name} · son {periodLabel(report.days)} · {report.totals.runs} cevap
              {report.totals.lastTestAt && <> · son test {timeAgo(report.totals.lastTestAt)}</>}
            </>
          ) : (
            <>Yapay zekâ asistanları müşterilerinize {brand.name} markasını öneriyor mu?</>
          )
        }
        actions={<Filters />}
      />

      {error && !report ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !report ? (
        <PageSkeleton />
      ) : report.totals.runs === 0 ? (
        <EmptyReport report={report} />
      ) : (
        <Report report={report} />
      )}
    </div>
  );
}

function periodLabel(days: number) {
  return days >= 365 ? "1 yıl" : `${days} gün`;
}

// ---------------------------------------------------------------------------

function EmptyReport({ report }: { report: OverviewReport }) {
  const { autoModels, runAll, openPaste, run } = useApp();
  const everTested = !!report.totals.lastTestAt;

  if (everTested) {
    return (
      <Notice title={`Son ${periodLabel(report.days)} içinde test yok`}>
        Son test {timeAgo(report.totals.lastTestAt!)} yapılmış. Daha uzun bir dönem seçin veya yeni bir test çalıştırın.
      </Notice>
    );
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="font-serif text-[24px] leading-snug text-ink">
          Henüz ölçüm yok. {report.totals.activePrompts} sorunuz hazır; ilk testten sonra burada markanızın kaç
          cevapta önerildiğini, rakiplerinizin nerede olduğunu ve neyi düzeltmeniz gerektiğini göreceksiniz.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {autoModels.length > 0 ? (
            <Button variant="primary" icon={<Play size={14} weight="fill" />} onClick={runAll} loading={!!run?.running}>
              İlk testi çalıştır
            </Button>
          ) : (
            <Link
              href="/ayarlar#baglantilar"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[14px] font-medium text-paper hover:bg-ink-2"
            >
              <Key size={16} /> Ücretsiz anahtar ekle
            </Link>
          )}
          <Button icon={<ClipboardText size={16} />} onClick={() => openPaste({})}>
            Cevabı elle yapıştır
          </Button>
        </div>
      </div>
      <ol className="space-y-5 border-l border-line pl-6 text-[14px] text-ink-2">
        <li>
          <p className="font-medium text-ink">1. Sorular asistanlara sorulur</p>
          <p>Müşterinin yazacağı gibi, markanızın adı geçmeden: “en iyi online kırtasiye sitesi hangisi?”</p>
        </li>
        <li>
          <p className="font-medium text-ink">2. Cevaplar okunur</p>
          <p>Markanız geçiyor mu, kaçıncı sırada, hangi rakipler önerilmiş, hangi sitelere dayanılmış.</p>
        </li>
        <li>
          <p className="font-medium text-ink">3. Ne yapacağınız çıkar</p>
          <p>Adınızın geçmediği sorular ve sizi en çok etkileyecek kaynaklar listelenir.</p>
        </li>
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Report({ report }: { report: OverviewReport }) {
  const { openPrompt, runAll, autoModels, run, openPaste } = useApp();
  const due = report.schedule?.is_active && report.schedule.next_due_at && new Date(report.schedule.next_due_at) <= new Date();

  return (
    <>
      {due && (
        <Notice
          tone="warn"
          title="Yeniden test zamanı"
          action={
            autoModels.length > 0 ? (
              <Button size="sm" variant="primary" onClick={runAll} disabled={!!run?.running}>
                Şimdi test et
              </Button>
            ) : (
              <Button size="sm" onClick={() => openPaste({})}>
                Cevap yapıştır
              </Button>
            )
          }
        >
          Asistanların cevapları zamanla değişir. Hatırlatıcınıza göre testleri tekrarlama zamanı geldi.
        </Notice>
      )}

      {report.totals.genericRuns === 0 ? (
        <Notice title="Görünürlük hesaplanamıyor">
          Bu dönemde yalnızca adınızın geçtiği sorular test edilmiş. Görünürlük, markanızın adı geçmeyen genel
          sorulardan hesaplanır. <Link href="/sorular" className="underline underline-offset-[3px]">Sorular</Link>{" "}
          sayfasına genel bir soru ekleyin.
        </Notice>
      ) : (
        <p className="max-w-[60ch] font-serif text-[23px] leading-[1.45] text-ink md:text-[26px]">{report.summary}</p>
      )}

      <KeyFigures report={report} />

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[1.25fr_1fr]">
        <Section
          id="karsilastirma"
          title="Rakiplerle karşılaştırma"
          description="Genel soruların yüzde kaçında önerildiği. Ses payı: tüm marka geçişleri içindeki pay."
        >
          <BrandBars report={report} />
        </Section>
        <Section id="asistanlar" title="Asistanlara göre" description="Her asistanda genel sorulardaki görünürlüğünüz.">
          <ModelTable report={report} />
        </Section>
      </div>

      <Section id="trend" title="Zaman içinde" description="Haftalık görünürlük. Test yapılmayan haftalar boş kalır.">
        {report.trend.filter((t) => Object.keys(t).length > 1).length >= 2 ? (
          <TrendChart data={report.trend} series={report.brands.map((b) => ({ name: b.name, isYou: b.isYou }))} />
        ) : (
          <p className="max-w-[66ch] text-[14px] text-ink-3">
            Değişimi görebilmek için en az iki farklı haftada test gerekir. Ayarlar&apos;dan haftalık hatırlatıcıyı açarsanız
            test zamanı geldiğinde burada uyarı görürsünüz.
          </p>
        )}
      </Section>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section
          id="firsatlar"
          title="Adınızın geçmediği sorular"
          description="Rakiplerinizin önerildiği ama sizin önerilmediğiniz sorular. En hızlı kazanım buradadır."
        >
          {report.gaps.length === 0 ? (
            <p className="text-[14px] text-ink-3">
              Şu an böyle bir soru yok: rakiplerinizin geçtiği her soruda siz de geçiyorsunuz.
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {report.gaps.map((g) => (
                <li key={g.promptId}>
                  <button
                    type="button"
                    onClick={() => openPrompt(g.promptId)}
                    className="group flex w-full items-start gap-3 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-ink group-hover:underline group-hover:underline-offset-[3px]">
                        {g.text}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-3">
                        Önerilen: {g.competitors.join(", ")} · {g.models.map((m) => MODEL_LABELS[m]).join(", ")}
                      </span>
                    </span>
                    <ArrowRight size={16} className="mt-1 shrink-0 text-ink-4 group-hover:text-ink" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="yapilacaklar" title="Yapılacaklar" description="Verilere göre, etkisi en yüksek olandan başlayarak.">
          {report.actions.length === 0 ? (
            <p className="text-[14px] text-ink-3">Öneri yok.</p>
          ) : (
            <ol className="space-y-4">
              {report.actions.map((a, i) => (
                <li key={a.title} className="grid grid-cols-[24px_1fr] gap-x-2">
                  <span className="font-serif text-[17px] leading-6 text-ink-4 tnum">{i + 1}.</span>
                  <div>
                    <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-medium text-ink">
                      {a.title}
                      {a.priority === "high" && <Tag tone="accent">öncelikli</Tag>}
                    </p>
                    <p className="mt-0.5 text-[14px] text-ink-2">{a.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <Section
        id="kaynaklar"
        title="Asistanların dayandığı siteler"
        description="Cevaplarda kaynak olarak gösterilen siteler. Bunlarda yer almak, önerilme şansınızı artırır."
        aside={
          <Link href="/kaynaklar" className="text-[14px] text-ink underline underline-offset-[3px] hover:decoration-ink">
            Tüm kaynaklar
          </Link>
        }
      >
        <SourcesBrief report={report} />
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------

function KeyFigures({ report }: { report: OverviewReport }) {
  const v = report.visibility;
  const s = report.sentiment;
  const items = [
    {
      label: "Görünürlük",
      value: v.total ? pct(v.value) : "—",
      note: v.total ? `${v.total} genel cevabın ${v.mentioned} tanesinde geçiyor` : "Genel soru testi yok",
      extra:
        v.change !== null ? (
          <span className={cn("tnum", v.change > 0 ? "text-good" : v.change < 0 ? "text-bad" : "text-ink-3")}>
            {pointChange(v.change)}
          </span>
        ) : null,
    },
    {
      label: "Rakipler arasında",
      value: report.rank.of > 1 && v.total ? `${report.rank.position}.` : "—",
      note: report.rank.of > 1 ? `${report.rank.of} marka içinde` : "Rakip eklenmemiş",
    },
    {
      label: "Ortalama sıra",
      value: report.avgPosition !== null ? decimal(report.avgPosition) : "—",
      note: report.avgPosition !== null ? "Önerildiğinde kaçıncı sırada (1 en iyisi)" : "Henüz önerilmedi",
    },
    {
      label: "Ton",
      value: s.score !== null ? `${s.score}` : "—",
      note:
        s.score !== null
          ? `${s.positive} olumlu · ${s.neutral} nötr · ${s.negative} olumsuz`
          : "Markanın geçtiği cevap yok",
    },
  ];

  return (
    <dl className="grid grid-cols-2 border-y border-line md:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            "py-5 pr-4",
            i % 2 === 1 && "border-l border-line pl-5",
            i >= 2 && "border-t border-line md:border-t-0",
            i === 2 && "md:border-l md:pl-5"
          )}
        >
          <dt className="text-[13px] text-ink-3">{it.label}</dt>
          <dd className="mt-1 flex items-baseline gap-2.5">
            <span className="font-serif text-[36px] leading-none font-medium tracking-[-0.02em] tnum">{it.value}</span>
            {it.extra && <span className="text-[13px]">{it.extra}</span>}
          </dd>
          <dd className="mt-1.5 text-[13px] text-ink-3">{it.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function BrandBars({ report }: { report: OverviewReport }) {
  if (report.brands.length <= 1) {
    return (
      <p className="text-[14px] text-ink-3">
        Karşılaştırma için rakip ekleyin.{" "}
        <Link href="/ayarlar#rakipler" className="text-ink underline underline-offset-[3px]">
          Rakip ekle
        </Link>
      </p>
    );
  }
  return (
    <table className="w-full text-[14px]">
      <thead className="sr-only">
        <tr>
          <th>Marka</th>
          <th>Görünürlük</th>
          <th>Ses payı</th>
        </tr>
      </thead>
      <tbody>
        {report.brands.map((b) => (
          <tr key={b.name} className="align-middle">
            <td className={cn("w-[34%] py-2 pr-3", b.isYou ? "font-medium text-ink" : "text-ink-2")}>
              <span className="line-clamp-1">{b.name}</span>
            </td>
            <td className="py-2 pr-3">
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 rounded-[2px] bg-sunken">
                  <div
                    className={cn("h-full rounded-[2px]", b.isYou ? "bg-accent" : "bg-ink-4")}
                    style={{ width: `${Math.max(b.visibility * 100, b.visibility > 0 ? 1.5 : 0)}%` }}
                  />
                </div>
                <span className={cn("w-11 text-right tnum", b.isYou ? "font-medium" : "text-ink-2")}>{pct(b.visibility)}</span>
              </div>
            </td>
            <td className="w-[72px] py-2 text-right text-[13px] text-ink-3 tnum" title="Ses payı">
              pay {pct(b.sov)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ModelTable({ report }: { report: OverviewReport }) {
  return (
    <table className="w-full text-[14px]">
      <thead>
        <tr className="text-left text-[13px] text-ink-3">
          <th className="pb-2 font-normal">Asistan</th>
          <th className="pb-2 text-right font-normal">Görünürlük</th>
          <th className="pb-2 text-right font-normal">Cevap</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line border-y border-line">
        {report.byModel.map((m) => (
          <tr key={m.model}>
            <td className="py-2.5">{MODEL_LABELS[m.model]}</td>
            <td className="py-2.5 text-right tnum">
              {m.visibility === null ? <span className="text-ink-4">test yok</span> : pct(m.visibility)}
            </td>
            <td className="py-2.5 text-right text-ink-3 tnum">{m.runs}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SourcesBrief({ report }: { report: OverviewReport }) {
  if (report.sources.length === 0) {
    return (
      <p className="max-w-[66ch] text-[14px] text-ink-3">
        Bu dönemdeki cevaplarda kaynak bağlantısı yok. Kaynaklar çoğunlukla Gemini ve Perplexity testlerinden ya da
        yapıştırırken eklediğiniz bağlantılardan gelir.
      </p>
    );
  }
  const total = report.domainTypes.reduce((s, d) => s + d.count, 0);
  return (
    <div className="grid gap-x-12 gap-y-6 md:grid-cols-[1.3fr_1fr]">
      <ol className="divide-y divide-line border-y border-line text-[14px]">
        {report.sources.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 py-2">
            <span className="w-5 text-right text-[13px] text-ink-4 tnum">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{s.key}</span>
            <span className="hidden text-[13px] text-ink-3 sm:inline">{DOMAIN_TYPE_LABEL[s.domainType]}</span>
            <span className="w-11 text-right tnum">{pct(s.share)}</span>
          </li>
        ))}
      </ol>
      <div>
        <p className="mb-2 text-[13px] text-ink-3">Kaynak türleri ({total} bağlantı)</p>
        <div className="flex h-3 overflow-hidden rounded-[2px]" aria-hidden>
          {report.domainTypes.map((d) => (
            <div key={d.type} style={{ width: `${d.share * 100}%`, background: DOMAIN_TYPE_COLOR[d.type] }} />
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 text-[14px]">
          {report.domainTypes.map((d) => (
            <li key={d.type} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: DOMAIN_TYPE_COLOR[d.type] }} aria-hidden />
              <span className="flex-1 text-ink-2">{DOMAIN_TYPE_LABEL[d.type]}</span>
              <span className="tnum">{pct(d.share)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
