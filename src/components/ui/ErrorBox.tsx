"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1 text-[13px]">
        <p className="font-medium text-foreground">Veri yüklenemedi</p>
        <p className="mt-0.5 break-words text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[12px] hover:bg-white/[0.04]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Tekrar dene
        </button>
      )}
    </div>
  );
}
