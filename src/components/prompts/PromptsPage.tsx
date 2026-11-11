"use client";
import { useMemo, useState } from "react";
import { ClipboardText, MagnifyingGlass, Play, Plus } from "@phosphor-icons/react";
import { MODEL_LABELS, type ModelId, type PromptCell, type PromptRow } from "@/types";
import { cn, pct, shortDate, timeAgo } from "@/lib/utils";
import { api, useData } from "@/lib/client";
import { Button, ErrorState, IconButton, Input, PageHeader, Select, Segmented, Skeleton, Tag } from "@/components/ui";
import { useApp } from "@/components/app/AppContext";
import { Filters, useFilterQuery } from "@/components/app/Filters";

export const TOPICS = ["Genel", "Kategori", "Karşılaştırma", "Rakip", "Fiyat", "Marka"];

export function PromptsPage() {
  const { version, refresh, brand, autoModels, run, runTests, openPrompt, openPaste, model } = useApp();
  const query = useFilterQuery();
  const { data, error, reload } = useData<{ prompts: PromptRow[] }>(`/api/prompts?${query}`, [version]);

  const [view, setView] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [adding, setAdding] = useState(false);

  const prompts = data?.prompts ?? null;
  const columns: ModelId[] = model ? [model] : brand.selected_models;

  const visible = useMemo(() => {
    if (!prompts) return [];
    const q = search.trim().toLocaleLowerCase("tr");
    return prompts.filter(
      (p) =>
        p.is_active === (view === "active") &&
        (!topic || p.topic === topic) &&
        (!q || p.text.toLocaleLowerCase("tr").includes(q))
    );
  }, [prompts, view, search, topic]);

  const topics = useMemo(() => [...new Set((prompts ?? []).map((p) => p.topic))].sort(), [prompts]);
  const archivedCount = prompts?.filter((p) => !p.is_active).length ?? 0;
  const activeRows = visible.filter((p) => p.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sorular"
        description="Müşterilerinizin asistanlara sorabileceği sorular ve her asistandaki son sonuç. Bir soruya tıklayarak cevapları okuyun."
        actions={<Filters />}
      />

      <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-4" aria-hidden />
          <label htmlFor="prompt-search" className="sr-only">
            Soru ara
          </label>
          <Input
            id="prompt-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Soru ara"
            className="h-9 pl-9"
          />
        </div>
        {topics.length > 1 && (
          <>
            <label htmlFor="prompt-topic" className="sr-only">
              Konu
            </label>
            <Select id="prompt-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="h-9 w-auto">
              <option value="">Tüm konular</option>
              {topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </>
        )}
        {(archivedCount > 0 || view === "archived") && (
          <Segmented
            label="Görünüm"
            value={view}
            onChange={setView}
            options={[
              { value: "active", label: "Aktif" },
              { value: "archived", label: `Arşiv (${archivedCount})` },
            ]}
          />
        )}
        <div className="ml-auto flex gap-2">
          {view === "active" && autoModels.length > 0 && activeRows.length > 0 && (
            <Button
              size="sm"
              icon={<Play size={13} weight="fill" />}
              disabled={!!run?.running}
              onClick={() => runTests(activeRows)}
              title="Listede görünen soruları test eder"
            >
              {activeRows.length === prompts?.filter((p) => p.is_active).length ? "Hepsini test et" : `${activeRows.length} soruyu test et`}
            </Button>
          )}
          <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            Soru ekle
          </Button>
        </div>
      </div>

      {adding && (
        <AddPrompt
          onDone={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {error && !prompts ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !prompts ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-ink-3">
          {search || topic
            ? "Aramanıza uyan soru yok."
            : view === "archived"
              ? "Arşivde soru yok."
              : "Henüz soru yok. “Soru ekle” ile başlayın."}
        </p>
      ) : (
        <>
          <Legend />
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-line-strong text-left text-[13px] text-ink-3">
                  <th className="py-2 pr-4 font-normal">Soru</th>
                  {columns.map((m) => (
                    <th key={m} className="w-[92px] px-2 py-2 text-center font-normal">
                      {MODEL_LABELS[m]}
                    </th>
                  ))}
                  <th className="w-[84px] px-2 py-2 text-right font-normal">Son test</th>
                  <th className="w-[76px] py-2 font-normal"><span className="sr-only">İşlemler</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="group border-b border-line hover:bg-surface">
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => openPrompt(p.id)}
                        className="text-left text-ink hover:underline hover:underline-offset-[3px]"
                      >
                        {p.text}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                        <span>{p.topic}</span>
                        {p.branded && (
                          <Tag className="text-[11px]" tone="warn">
                            adınız geçiyor
                          </Tag>
                        )}
                        {p.visibility !== null && <span>· {p.visibility === 0 ? "hiçbir cevapta geçmedi" : `${pct(p.visibility)} cevapta geçti`}</span>}
                      </div>
                    </td>
                    {columns.map((m) => (
                      <td key={m} className="px-2 py-3 text-center">
                        <Cell cell={p.cells[m]} />
                      </td>
                    ))}
                    <td className="px-2 py-3 text-right text-[13px] text-ink-3" title={p.lastRunAt ? new Date(p.lastRunAt).toLocaleString("tr-TR") : undefined}>
                      {p.lastRunAt ? timeAgo(p.lastRunAt) : "—"}
                    </td>
                    <td className="py-3 text-right">
                      {p.is_active ? (
                        <div className="flex justify-end opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          {autoModels.length > 0 && (
                            <IconButton
                              label="Bu soruyu test et"
                              disabled={!!run?.running}
                              onClick={() => runTests([p])}
                            >
                              <Play size={15} />
                            </IconButton>
                          )}
                          <IconButton label="Cevap yapıştır" onClick={() => openPaste({ promptId: p.id })}>
                            <ClipboardText size={16} />
                          </IconButton>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await api("/api/prompts", { method: "PATCH", body: { id: p.id, is_active: true } });
                            refresh();
                          }}
                        >
                          Geri al
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ cell }: { cell?: PromptCell }) {
  if (!cell) return <span className="text-ink-4" aria-label="test yok">·</span>;
  const when = `${shortDate(cell.date)} testi`;
  const ratio = cell.samples > 1 ? `${cell.hits}/${cell.samples}` : null;
  if (!cell.mentioned) {
    return (
      <span className="text-[13px] text-bad tnum" title={`${ratio ? `${cell.samples} denemenin ${cell.hits} tanesinde geçti` : "Geçmiyor"} · ${when}`}>
        {ratio ?? "yok"}
      </span>
    );
  }
  if (ratio) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[13px] font-medium text-good tnum"
        title={`${cell.samples} denemenin ${cell.hits} tanesinde önerildi${cell.position ? `, ortalama ${cell.position}. sırada` : ""} · ${when}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden />
        {ratio}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-good tnum" title={`Geçiyor, ${cell.position ?? "?"}. sırada · ${when}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden />
      {cell.position ? `${cell.position}.` : "var"}
    </span>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
      <span>
        <span className="font-medium text-good">● 2.</span> önerildi, 2. sırada
      </span>
      <span>
        <span className="text-bad">yok</span> önerilmedi
      </span>
      <span>
        <span className="text-ink-4">·</span> bu dönemde test yok
      </span>
      <span>
        <span className="font-medium text-good">● 2/3</span> tekrarlı testte 3 denemenin 2&apos;sinde önerildi
      </span>
      <span>
        <Tag tone="warn" className="text-[11px]">
          adınız geçiyor
        </Tag>{" "}
        soruda markanızın adı var, görünürlüğe sayılmaz
      </span>
    </p>
  );
}

function AddPrompt({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("Genel");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3) {
      setError("Soru en az 3 karakter olmalı.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api("/api/prompts", { method: "POST", body: { text, topic } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="new-prompt" className="sr-only">
          Yeni soru
        </label>
        <Input
          id="new-prompt"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ör. okul alışverişi için en uygun kırtasiye sitesi hangisi"
          aria-invalid={!!error}
        />
        <label htmlFor="new-topic" className="sr-only">
          Konu
        </label>
        <Select id="new-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className="sm:w-44">
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            Ekle
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Vazgeç
          </Button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-[13px] text-bad" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-ink-3">
          İpucu: Görünürlüğü ölçmek için markanızın adını sorunun içine yazmayın. Müşteri sizi henüz bilmiyormuş gibi sorun.
        </p>
      )}
    </form>
  );
}
