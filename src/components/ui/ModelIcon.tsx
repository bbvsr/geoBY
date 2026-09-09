import { MODEL_COLORS, MODEL_SHORT, type ModelId } from "@/types";
import { cn } from "@/lib/utils";

export function ModelIcon({
  model,
  dim = false,
  className,
}: {
  model: ModelId;
  dim?: boolean;
  className?: string;
}) {
  const color = MODEL_COLORS[model];
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[26px] items-center justify-center rounded px-1 text-[9px] font-semibold tabular-nums transition-opacity",
        dim && "opacity-30",
        className
      )}
      style={{ color, backgroundColor: `${color}1f` }}
      title={model}
    >
      {MODEL_SHORT[model]}
    </span>
  );
}

export function ModelDot({ model }: { model: ModelId }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: MODEL_COLORS[model] }}
    />
  );
}
