"use client";
import { useEffect, useState } from "react";
import { ChevronDown, Play, X } from "lucide-react";
import {
  MODEL_COLORS,
  MODEL_LABELS,
  type ModelBreakdown,
  type Prompt,
} from "@/types";
import { cn, sentimentColor } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

const ORDER = ["openai", "claude", "gemini", "perplexity", "google_aio"];

export function PromptDetailModal({
  promptId,
  onClose,
  onManualTest,
}: {
  promptId: string;
  onClose: () => void;
  onManualTest: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [breakdown, setBreakdown] = useState<ModelBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/prompts/${promptId}`)
      .then((r) => r.json())
      .then((d) => {
        setPrompt(d.prompt);
        const sorted = (d.modelBreakdown ?? []).sort(
          (a: ModelBreakdown, b: ModelBreakdown) =>
            ORDER.indexOf(a.model) - ORDER.indexOf(b.model)
        );
        setBreakdown(sorted);
      })
      .finally(() => setLoading(false));
  }, [promptId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-8 max-h-[70vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b border-border/40 bg-card px-5 py-3.5">
          <div className="pr-4">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
              Soru Detayı
            </span>
            <p className="mt-1 text-[14px] font-medium">{prompt?.text}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onManualTest(promptId)}
              className="flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1.5 text-[12px] text-primary hover:bg-primary/25"
            >
              <Play className="h-3.5 w-3.5" /> Manuel Test
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground/50">
            Model Bazında Kırılım
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2">
              {breakdown.map((b) => (
                <div
                  key={b.model}
                  className={cn(
                    "rounded-lg border px-4 py-3",
                    b.mentioned
                      ? "border-success/20 bg-success/[0.03]"
                      : "border-border/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-6 w-8 items-center justify-center rounded text-[10px] font-semibold"
                        style={{
                          color: MODEL_COLORS[b.model],
                          backgroundColor: `${MODEL_COLORS[b.model]}1f`,
                        }}
                      >
                        {MODEL_LABELS[b.model].slice(0, 3)}
                      </span>
                      <span className="text-[13px] font-medium">
                        {MODEL_LABELS[b.model]}
                      </span>
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
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>
                        Konum: {b.position ? `#${b.position}` : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: sentimentColor(
                              b.sentiment === "positive"
                                ? 80
                                : b.sentiment === "negative"
                                  ? 30
                                  : 55
                            ),
                          }}
                        />
                        {b.sentiment}
                      </span>
                      <span>{b.citationCount} kaynak</span>
                      {b.hasRun && b.response && (
                        <button
                          onClick={() =>
                            setExpanded(expanded === b.model ? null : b.model)
                          }
                          className="hover:text-foreground"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              expanded === b.model && "rotate-180"
                            )}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded === b.model && b.response && (
                    <p className="mt-2.5 border-t border-border/30 pt-2.5 text-[12px] leading-relaxed text-muted-foreground">
                      {b.response.slice(0, 300)}
                      {b.response.length > 300 ? "…" : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
