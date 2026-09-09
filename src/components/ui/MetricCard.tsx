import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  icon: Icon,
  change,
  changeLabel,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  change?: number;
  changeLabel?: string;
}) {
  const showChange = change !== undefined && change !== 0;
  const up = (change ?? 0) > 0;
  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-4">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/40" />}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-[28px] font-bold leading-none tabular-nums text-foreground">
          {value}
        </span>
      </div>
      {showChange && (
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[11px] tabular-nums",
            up ? "text-success" : "text-destructive"
          )}
        >
          {up ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          <span>{Math.abs(Math.round((change ?? 0) * 100))}%</span>
          <span className="text-muted-foreground/60">
            {changeLabel ?? "önceki döneme göre"}
          </span>
        </div>
      )}
    </div>
  );
}
