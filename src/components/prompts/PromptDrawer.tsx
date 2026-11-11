"use client";
import { useEffect, useState } from "react";
import { Archive, CaretDown, ClipboardText, PencilSimple, Play, Trash, X } from "@phosphor-icons/react";
import { sameBatch } from "@/lib/metrics";
import { MODEL_LABELS, ALL_MODELS, type ModelId, type PromptDetail, type RunDetail } from "@/types";
import { cn, dateTime, timeAgo } from "@/lib/utils";
import { api, useData } from "@/lib/client";
import { DOMAIN_TYPE_LABEL, SENTIMENT_LABEL } from "@/lib/labels";
import { Button, ConfirmButton, Drawer, IconButton, Input, Notice, Spinner, Tag } from "@/components/ui";
import { useApp } from "@/components/app/AppContext";
import { Answer } from "./Answer";

export function PromptDrawer() {
  const { openPromptId, openPrompt } = useApp();
  return (
    <Drawer open={!!openPromptId} onClose={() => openPrompt(null)} label="Soru ayrıntısı">
      {openPromptId && <PromptDetailView id={openPromptId} />}
    </Drawer>
  );
}

function PromptDetailView({ id }: { id: string }) {
  const { version, refresh, openPrompt, openPaste, brand, competitors, autoModels, run, runTests } = useApp();
  const { data, error, reload } = useData<PromptDetail>(`/api/prompts/${id}`, [version]);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setText(data.prompt.text);
  }, [data]);

  const close = () => openPrompt(null);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      refresh();
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <Header onClose={close} />
        <Notice tone="bad" title="Soru açılamadı" action={<Button size="sm" onClick={reload}>Tekrar dene</Button>}>
          {error}
        </Notice>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={22} />
      </div>
    );
  }

  const { prompt, runs, branded } = data;
  const models: ModelId[] = ALL_MODELS.filter((m) => brand.selected_models.includes(m) || runs.some((r) => r.model === m));
  const latest = new Map<ModelId, RunDetail>();
  for (const r of runs) if (!latest.has(r.model)) latest.set(r.model, r);
  const history = runs.filter((r) => latest.get(r.model)?.id !== r.id);
  // Son deneme grubu (tekrarlı ölçümde aynı çalıştırmanın tüm denemeleri)
  const batchOf = (m: ModelId) => {
    const l = latest.get(m);
    if (!l) return null;
    const b = sameBatch(l, runs);
    return { samples: b.length, hits: b.filter((r) => r.mentioned).length };
  };
  const rivals = competitors.map((c) => ({ name: c.name, domain: c.domain }));

  return (
    <>
      <div className="border-b border-line px-6 pt-5 pb-4">
        <Header onClose={close} />
        {editing ? (
          <form
            className="mt-1 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(() => api("/api/prompts", { method: "PATCH", body: { id: prompt.id, text } }))) setEditing(false);
            }}
          >
            <label htmlFor="edit-prompt" className="sr-only">
              Soru
            </label>
            <Input id="edit-prompt" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <Button type="submit" variant="primary" loading={busy}>
              Kaydet
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
          </form>
        ) : (
          <h2 className="mt-1 font-serif text-[24px] leading-snug font-medium text-ink">{prompt.text}</h2>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <span>{prompt.topic}</span>
          {!prompt.is_active && <Tag>arşivde</Tag>}
          {branded && <Tag tone="warn">adınız geçiyor</Tag>}
          <span>· {runs.length} test</span>
        </div>
        {branded && (
          <p className="mt-2 max-w-[62ch] text-[13px] text-ink-3">
            Soruda markanızın adı geçtiği için bu sorunun sonuçları görünürlüğe sayılmaz; tonu ve rakip karşılaştırmasını
            görmek için kullanışlıdır.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {prompt.is_active && autoModels.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              icon={<Play size={13} weight="fill" />}
              disabled={!!run?.running}
              onClick={() => runTests([prompt])}
            >
              {run?.running ? "Test sürüyor" : "Şimdi test et"}
            </Button>
          )}
          <Button size="sm" icon={<ClipboardText size={15} />} onClick={() => openPaste({ promptId: prompt.id })}>
            Cevap yapıştır
          </Button>
          {!editing && (
            <Button size="sm" variant="ghost" icon={<PencilSimple size={15} />} onClick={() => setEditing(true)}>
              Düzenle
            </Button>
          )}
          {prompt.is_active ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Archive size={15} />}
              loading={busy}
              onClick={async () => {
                if (await act(() => api("/api/prompts", { method: "DELETE", body: { id: prompt.id } }))) close();
              }}
            >
              Arşivle
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              loading={busy}
              onClick={() => act(() => api("/api/prompts", { method: "PATCH", body: { id: prompt.id, is_active: true } }))}
            >
              Arşivden çıkar
            </Button>
          )}
        </div>
        {actionError && (
          <p className="mt-2 text-[13px] text-bad" role="alert">
            {actionError}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <h3 className="mb-3 text-[13px] font-medium text-ink-3">Her asistandaki son cevap</h3>
        <div className="space-y-3">
          {models.map((m) => (
            <ModelResult
              key={m}
              model={m}
              run={latest.get(m)}
              batch={batchOf(m)}
              brand={brand}
              rivals={rivals}
              onPaste={() => openPaste({ promptId: prompt.id, model: m })}
              onDelete={(runId) => act(() => api(`/api/runs/${runId}`, { method: "DELETE" }))}
            />
          ))}
        </div>

        {history.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-2 text-[13px] font-medium text-ink-3">Önceki testler</h3>
            <ul className="divide-y divide-line border-y border-line">
              {history.map((r) => (
                <HistoryRow
                  key={r.id}
                  run={r}
                  brand={brand}
                  rivals={rivals}
                  onDelete={() => act(() => api(`/api/runs/${r.id}`, { method: "DELETE" }))}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-ink-3">Soru</span>
      <IconButton label="Kapat" onClick={onClose}>
        <X size={18} />
      </IconButton>
    </div>
  );
}

function sourceText(source: string) {
  return source === "manual" ? "elle yapıştırıldı" : source.replace(/^api:/, "");
}

function Verdict({ run }: { run: RunDetail }) {
  const rivalsIn = Object.entries(run.competitor_mentions ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (run.mentioned) {
    return (
      <p className="text-[14px]">
        <span className="font-medium text-good">Önerildi</span>
        {run.position_score && <span className="text-ink-2"> · {run.position_score}. sırada</span>}
        <span className="text-ink-2"> · {SENTIMENT_LABEL[run.sentiment]} ton</span>
        {run.mention_count > 1 && <span className="text-ink-3"> · {run.mention_count} kez geçti</span>}
        {rivalsIn.length > 0 && <span className="text-ink-3"> · rakipler: {rivalsIn.join(", ")}</span>}
      </p>
    );
  }
  return (
    <p className="text-[14px]">
      <span className="font-medium text-bad">Önerilmedi</span>
      {rivalsIn.length > 0 ? (
        <span className="text-ink-2"> · önerilen rakipler: {rivalsIn.join(", ")}</span>
      ) : (
        <span className="text-ink-3"> · izlediğiniz rakipler de geçmiyor</span>
      )}
    </p>
  );
}

function ModelResult({
  model,
  run,
  batch,
  brand,
  rivals,
  onPaste,
  onDelete,
}: {
  model: ModelId;
  run?: RunDetail;
  batch?: { samples: number; hits: number } | null;
  brand: { name: string; domain: string };
  rivals: { name: string; domain: string }[];
  onPaste: () => void;
  onDelete: (runId: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);

  if (!run) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3">
        <div>
          <p className="text-[15px] font-medium">{MODEL_LABELS[model]}</p>
          <p className="text-[13px] text-ink-3">Bu asistanda henüz test yok.</p>
        </div>
        <Button size="sm" variant="ghost" icon={<ClipboardText size={15} />} onClick={onPaste}>
          Cevap yapıştır
        </Button>
      </div>
    );
  }

  return (
    <article className={cn("rounded-lg border bg-surface", run.mentioned ? "border-good/30" : "border-line")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-medium">
            {MODEL_LABELS[model]}
            <span className="text-[12px] font-normal text-ink-3" title={dateTime(run.created_at)}>
              {sourceText(run.source)} · {timeAgo(run.created_at)}
            </span>
          </p>
          {batch && batch.samples > 1 && (
            <p className="mt-0.5 text-[14px] font-medium">
              {batch.samples} denemenin {batch.hits} tanesinde önerildi
              <span className="font-normal text-ink-3"> · en sonuncusu:</span>
            </p>
          )}
          <div className="mt-0.5">
            <Verdict run={run} />
          </div>
        </div>
        <CaretDown size={16} className={cn("mt-1.5 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-line px-4 pt-3 pb-4">
          {run.query_text && run.query_text !== "" && (
            <p className="mb-3 text-[13px] text-ink-3">
              Sorulan: <span className="text-ink-2">“{run.query_text}”</span>
            </p>
          )}
          <Answer text={run.response ?? ""} brand={brand} rivals={rivals} />
          <Citations run={run} />
          <div className="mt-4 flex justify-end">
            <ConfirmButton icon={<Trash size={15} />} question="Bu test kaydı silinsin mi?" onConfirm={() => onDelete(run.id)}>
              Bu testi sil
            </ConfirmButton>
          </div>
        </div>
      )}
    </article>
  );
}

function Citations({ run }: { run: RunDetail }) {
  if (run.citations.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[13px] text-ink-3">Kaynaklar ({run.citations.length})</p>
      <ul className="space-y-1 text-[13px]">
        {run.citations.map((c, i) => (
          <li key={`${c.url}-${i}`} className="flex items-baseline gap-2">
            <a
              href={c.url ?? `https://${c.domain}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="min-w-0 truncate text-ink underline decoration-ink-4 underline-offset-2"
            >
              {c.domain}
            </a>
            <span className="shrink-0 text-ink-3">{DOMAIN_TYPE_LABEL[c.domain_type]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryRow({
  run,
  brand,
  rivals,
  onDelete,
}: {
  run: RunDetail;
  brand: { name: string; domain: string };
  rivals: { name: string; domain: string }[];
  onDelete: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-2.5 text-left text-[14px]"
      >
        <span className="w-[120px] shrink-0 text-ink-3 tnum">{dateTime(run.created_at)}</span>
        <span className="w-[96px] shrink-0">{MODEL_LABELS[run.model]}</span>
        <span className={cn("flex-1", run.mentioned ? "text-good" : "text-bad")}>
          {run.mentioned ? `önerildi${run.position_score ? ` · ${run.position_score}.` : ""}` : "önerilmedi"}
        </span>
        <CaretDown size={14} className={cn("text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="pb-4">
          <p className="mb-2 text-[12px] text-ink-3">{sourceText(run.source)}</p>
          <Answer text={run.response ?? ""} brand={brand} rivals={rivals} />
          <Citations run={run} />
          <div className="mt-3 flex justify-end">
            <ConfirmButton icon={<Trash size={15} />} question="Bu test kaydı silinsin mi?" onConfirm={onDelete}>
              Sil
            </ConfirmButton>
          </div>
        </div>
      )}
    </li>
  );
}
