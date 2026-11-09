"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

export interface RunState {
  running: boolean;
  done: number;
  total: number;
  current: string;
  /** Başarılı model cevabı sayısı */
  success: number;
  /** Markanın geçtiği cevap sayısı */
  mentioned: number;
  errors: string[];
  cancelled?: boolean;
}

/** Otomatik test ilerlemesini ve sonucunu gösteren bant. */
export function RunBanner({
  state,
  onCancel,
  onClose,
}: {
  state: RunState;
  onCancel: () => void;
  onClose: () => void;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const pct = state.total ? Math.round((state.done / state.total) * 100) : 0;
  const failed = state.errors.length > 0 && state.success === 0;

  return (
    <div
      className={
        failed && !state.running
          ? "rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-3"
          : "rounded-lg border border-primary/25 bg-primary/[0.05] px-4 py-3"
      }
    >
      <div className="flex items-center gap-3">
        {state.running ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : failed ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        )}
        <div className="min-w-0 flex-1 text-[13px]">
          {state.running ? (
            <>
              <span className="font-medium">
                Test ediliyor {state.done + 1}/{state.total}
              </span>
              <span className="ml-2 truncate text-muted-foreground">“{state.current}”</span>
            </>
          ) : state.total === 0 ? (
            <span>{state.errors[0]}</span>
          ) : (
            <span>
              <span className="font-medium">
                {state.cancelled ? "Durduruldu" : "Test tamamlandı"}:
              </span>{" "}
              {state.success} cevap alındı, markanız{" "}
              <span className="font-medium text-primary">{state.mentioned}</span> cevapta geçti.
              {state.errors.length > 0 && (
                <button
                  onClick={() => setShowErrors((s) => !s)}
                  className="ml-2 text-destructive hover:underline"
                >
                  {state.errors.length} hata {showErrors ? "▲" : "▼"}
                </button>
              )}
            </span>
          )}
        </div>
        {state.running ? (
          <button onClick={onCancel} className="text-[12px] text-muted-foreground hover:text-foreground">
            Durdur
          </button>
        ) : (
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {state.running && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {showErrors && !state.running && (
        <ul className="mt-2.5 max-h-40 space-y-1 overflow-y-auto border-t border-border/30 pt-2 text-[12px] text-muted-foreground">
          {[...new Set(state.errors)].map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
