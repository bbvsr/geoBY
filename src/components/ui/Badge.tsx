import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
}

export function Badge({ className, color, style, ...props }: BadgeProps) {
  const colorStyle = color
    ? { color, backgroundColor: `${color}1f`, ...style }
    : style;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        !color && "bg-white/[0.04] text-muted-foreground",
        className
      )}
      style={colorStyle}
      {...props}
    />
  );
}
