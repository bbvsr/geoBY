"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ClipboardPaste, Play, X } from "lucide-react";
import { MODEL_COLORS, MODEL_LABELS, type ModelBreakdown, type ModelId, type Prompt } from "@/types";
import { cn, sentimentColor, timeAgo } from "@/lib/utils";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui/Spinner";

const SENTIMENT_LABEL = { positive: "Olumlu", neutral: "Nötr", negative: "Olumsuz" } as const;
const SENTIMENT_SCORE = { positive: 80, neutral: 55, negative: 30 } as const;

function sourceLabel(source: string | null): string {
  if (!source || source === "manual") return "Manuel";
  return source.replace(/^api:/, "");
}

export function PromptDetailModal({
  promptId,
  refreshKey,
  canAuto,
  running,
  onClose,
  onManualTest,
  onAutoTest,
}: {
  promptId: string;
  refreshKey: number;
  canAuto: boolean;
  running: boolean;
  onClose: () => void;
  onManualTest: (id: string, model?: ModelId) => void;
  onAutoTest: (p: { id: string; text: string }) => void;
}) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [breakdown, setBreakdown] = useState<ModelBreakdown[] | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ prompt: Prompt; modelBreakdown: ModelBreakdown[] }>(`/api/prompts/${promptId}`)
      .then((d) => {
        if (!alive) return;
        setPrompt(d.prompt);
        setBreakdown(d.modelBreakdown);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [promptId, refreshKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="mt-6 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/40 px-5 py-3.5">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Soru Detayı</span>
            <p className="mt-1 text-[14px] font-medium">{prompt?.text ?? "…"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {prompt && canAuto && (
              <button
                disabled={running}
                onClick={() => onAutoTest({ id: prompt.id, text: prompt.text })}
                className="flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1.5 text-[12px] text-primary hover:bg-primary/25 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" /> {running ? "Test sürüyor…" : "Şimdi test et"}
              </button>
            )}
            <button onClick={onClose} aria-label="Kapat" className="text-muted-foreground/60 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground/50">
            Model bazında son test
          </div>
          {error ? (
            <p className="text-[13px] text-destructive">{error}</p>
          ) : !breakdown ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2">
              {breakdown.map((b) => {
                const open = expanded === b.model;
                return (
                  <div
                    key={b.model}
                    className={cn(
                      "rounded-lg border px-4 py-3",
                      b.mentioned ? "border-success/20 bg-success/[0.03]" : "border-border/40"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: MODEL_COLORS[b.model] }}
                        />
                        <span className="text-[13px] font-medium">{MODEL_LABELS[b.model]}</span>
                        {!b.hasRun ? (
                          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            test yok
                          </span>
                        ) : b.mentioned ? (
                          <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
                            Geçiyor ×{b.mentionCount}
                          </span>
                        ) : (
                          <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                            Geçmiyor
                          </span>
                        )}
                      </div>
                      {b.hasRun ? (
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span>Sıra: {b.position ? `#${b.position}` : "—"}</span>
                          {b.mentioned && (
                            <span className="flex items-center gap-1">
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: sentimentColor(SENTIMENT_SCORE[b.sentiment]) }}
                              />
                              {SENTIMENT_LABEL[b.sentiment]}
                            </span>
                          )}
                          <span>{b.citationCount} kaynak</span>
                          <button
                            onClick={() => setExpanded(open ? null : b.model)}
                            className="flex items-center gap-0.5 hover:text-foreground"
                          >
                            Cevap
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onManualTest(promptId, b.model)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <ClipboardPaste className="h-3 w-3" /> Cevap yapıştır
                        </button>
                      )}
                    </div>
                    {open && b.response && (
                      <div className="mt-2.5 border-t border-border/30 pt-2.5">
                        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
                          <span>Kaynak: {sourceLabel(b.source)}</span>
                          {b.date && <span>{timeAgo(b.date)}</span>}
                          {b.competitorsMentioned.length > 0 && (
                            <span>Geçen rakipler: {b.competitorsMentioned.join(", ")}</span>
                          )}
                        </div>
                        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-muted-foreground">
                          {b.response}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
