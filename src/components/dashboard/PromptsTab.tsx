"use client";
import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Check, ClipboardPaste, Pencil, Play, Plus, X } from "lucide-react";
import { MODEL_COLORS, MODEL_SHORT, type ModelId, type PromptWithMetrics } from "@/types";
import { cn, formatPercent, sentimentColor } from "@/lib/utils";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBox } from "@/components/ui/ErrorBox";

const TOPICS = ["Genel", "Kategori", "Core", "Affiliate", "Rakip", "Ücretsiz araç"];

export function PromptsTab({
  days,
  model,
  refreshKey,
  canAuto,
  running,
  onAutoTest,
  onManualTest,
  onOpenPrompt,
}: {
  days: number;
  model?: ModelId;
  refreshKey: number;
  canAuto: boolean;
  running: boolean;
  onAutoTest: (p: { id: string; text: string }) => void;
  onManualTest: (id: string) => void;
  onOpenPrompt: (id: string) => void;
}) {
  const [prompts, setPrompts] = useState<PromptWithMetrics[] | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reload, setReload] = useState(0);
  const [topic, setTopic] = useState("Tümü");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTopic, setNewTopic] = useState("Genel");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setError("");
    const params = new URLSearchParams({ days: String(days) });
    if (model) params.set("model", model);
    api<{ prompts: PromptWithMetrics[] }>(`/api/prompts/metrics?${params}`)
      .then((d) => alive && setPrompts(d.prompts))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [days, model, refreshKey, reload]);

  async function act(fn: () => Promise<unknown>) {
    setActionError("");
    try {
      await fn();
      setReload((r) => r + 1);
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    }
  }

  async function addPrompt() {
    if (!newText.trim()) return;
    const ok = await act(() =>
      api("/api/prompts", { method: "POST", body: { text: newText, topic: newTopic } })
    );
    if (ok) {
      setNewText("");
      setAdding(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const ok = await act(() =>
      api("/api/prompts", { method: "PATCH", body: { id: editing.id, text: editing.text } })
    );
    if (ok) setEditing(null);
  }

  if (error && !prompts) return <ErrorBox message={error} onRetry={() => setReload((r) => r + 1)} />;

  const all = prompts ?? [];
  const pool = all.filter((p) => p.is_active !== showArchived);
  const topics = ["Tümü", ...new Set(pool.map((p) => p.topic))];
  const filtered = topic === "Tümü" ? pool : pool.filter((p) => p.topic === topic);
  const archivedCount = all.filter((p) => !p.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Sorular</h1>
          <p className="text-[13px] text-muted-foreground">
            Müşterilerinizin yapay zekaya sorabileceği sorular. Her soru seçili modellerde test edilir.
          </p>
        </div>
        <Button onClick={() => setAdding((a) => !a)}>
          <Plus className="h-4 w-4" /> Soru Ekle
        </Button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-card/60 p-3 sm:flex-row sm:items-center">
          <Input
            autoFocus
            placeholder="ör. en iyi online kırtasiye sitesi hangisi"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPrompt()}
          />
          <Select value={newTopic} onChange={(e) => setNewTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <Button onClick={addPrompt} disabled={newText.trim().length < 3}>
            Ekle
          </Button>
        </div>
      )}

      {actionError && <p className="text-[12px] text-destructive">{actionError}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {topics.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] transition-colors",
              topic === t ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:bg-white/[0.03]"
            )}
          >
            {t}
          </button>
        ))}
        {(archivedCount > 0 || showArchived) && (
          <button
            onClick={() => {
              setShowArchived((s) => !s);
              setTopic("Tümü");
            }}
            className="ml-auto flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-white/[0.03]"
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? "Aktif sorulara dön" : `Arşiv (${archivedCount})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/40 bg-card/60">
        {!prompts ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground/60">
            {showArchived ? "Arşivde soru yok." : "Henüz soru yok. \"Soru Ekle\" ile başlayın."}
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                <th className="px-5 py-2.5 text-left font-medium">Soru</th>
                <th className="px-2 py-2.5 text-left font-medium">Görünürlük</th>
                <th className="px-2 py-2.5 text-left font-medium">Ton</th>
                <th className="px-2 py-2.5 text-left font-medium">Sıra</th>
                <th className="px-2 py-2.5 text-left font-medium">Modeller</th>
                <th className="px-5 py-2.5 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border/20 hover:bg-white/[0.015]">
                  <td className="max-w-[420px] px-5 py-3">
                    {editing?.id === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          autoFocus
                          value={editing.text}
                          onChange={(e) => setEditing({ id: p.id, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="h-8"
                        />
                        <IconBtn title="Kaydet" onClick={saveEdit}>
                          <Check className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Vazgeç" onClick={() => setEditing(null)}>
                          <X className="h-3.5 w-3.5" />
                        </IconBtn>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onOpenPrompt(p.id)}
                          className="line-clamp-2 text-left hover:text-primary"
                          title="Detayları ve cevapları gör"
                        >
                          {p.text}
                        </button>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground/50">
                          {p.topic} · {p.totalRuns} test
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {p.totalRuns ? (
                      <div className="flex items-center gap-2">
                        <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, p.visibility * 100)}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-muted-foreground">{formatPercent(p.visibility)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {p.sentiment ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: sentimentColor(p.sentiment) }}
                        />
                        <span className="tabular-nums text-muted-foreground">{p.sentiment}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 tabular-nums text-muted-foreground">
                    {p.position ? `#${p.position.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {p.models.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground/40">test yok</span>
                      ) : (
                        p.models.map((mm) => (
                          <span
                            key={mm}
                            className="rounded px-1 py-0.5 text-[9px] font-semibold"
                            style={{ color: MODEL_COLORS[mm], backgroundColor: `${MODEL_COLORS[mm]}1f` }}
                          >
                            {MODEL_SHORT[mm]}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {showArchived ? (
                        <IconBtn
                          title="Arşivden çıkar"
                          onClick={() =>
                            act(() => api("/api/prompts", { method: "PATCH", body: { id: p.id, is_active: true } }))
                          }
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        </IconBtn>
                      ) : (
                        <>
                          <IconBtn
                            title={canAuto ? "Yapay zekaya sor (otomatik test)" : "Otomatik test için Ayarlar'dan anahtar ekleyin"}
                            disabled={!canAuto || running}
                            onClick={() => onAutoTest({ id: p.id, text: p.text })}
                            accent
                          >
                            <Play className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn title="Cevabı elle yapıştır (manuel test)" onClick={() => onManualTest(p.id)}>
                            <ClipboardPaste className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn title="Düzenle" onClick={() => setEditing({ id: p.id, text: p.text })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn
                            title="Arşivle (test geçmişi korunur)"
                            danger
                            onClick={() => act(() => api("/api/prompts", { method: "DELETE", body: { id: p.id } }))}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </IconBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  accent,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "rounded p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30",
        accent && "hover:text-primary",
        danger && "hover:text-destructive",
        !accent && !danger && "hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
