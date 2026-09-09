"use client";
import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  ALL_MODELS,
  MODEL_COLORS,
  MODEL_LABELS,
  type ModelId,
} from "@/types";
import { cn } from "@/lib/utils";

const RANGES = [
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
  { days: 90, label: "90 gün" },
  { days: 365, label: "365 gün" },
];

export function FilterBar({
  days,
  setDays,
  model,
  setModel,
}: {
  days: number;
  setDays: (d: number) => void;
  model: ModelId | "all";
  setModel: (m: ModelId | "all") => void;
}) {
  const [openRange, setOpenRange] = useState(false);
  const [openModel, setOpenModel] = useState(false);

  const rangeLabel = RANGES.find((r) => r.days === days)?.label ?? `${days} gün`;
  const modelLabel = model === "all" ? "Tüm Modeller" : MODEL_LABELS[model];

  return (
    <div className="flex items-center gap-2">
      {/* Tarih aralığı */}
      <div className="relative">
        <button
          onClick={() => {
            setOpenRange((o) => !o);
            setOpenModel(false);
          }}
          className="flex items-center gap-1.5 rounded-md border border-border/50 bg-white/[0.02] px-2.5 py-1.5 text-[12px] hover:bg-white/[0.04]"
        >
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {rangeLabel}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {openRange && (
          <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border border-border/60 bg-[#161619] p-1 shadow-xl">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => {
                  setDays(r.days);
                  setOpenRange(false);
                }}
                className={cn(
                  "flex w-full items-center rounded px-2 py-1.5 text-[12px] hover:bg-white/[0.04]",
                  r.days === days ? "text-primary" : "text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model filtresi */}
      <div className="relative">
        <button
          onClick={() => {
            setOpenModel((o) => !o);
            setOpenRange(false);
          }}
          className="flex items-center gap-1.5 rounded-md border border-border/50 bg-white/[0.02] px-2.5 py-1.5 text-[12px] hover:bg-white/[0.04]"
        >
          {model !== "all" && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: MODEL_COLORS[model] }}
            />
          )}
          {modelLabel}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {openModel && (
          <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-border/60 bg-[#161619] p-1 shadow-xl">
            <button
              onClick={() => {
                setModel("all");
                setOpenModel(false);
              }}
              className={cn(
                "flex w-full items-center rounded px-2 py-1.5 text-[12px] hover:bg-white/[0.04]",
                model === "all" ? "text-primary" : "text-foreground"
              )}
            >
              Tüm Modeller
            </button>
            {ALL_MODELS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setModel(m);
                  setOpenModel(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-white/[0.04]",
                  model === m ? "text-primary" : "text-foreground"
                )}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: MODEL_COLORS[m] }}
                />
                {MODEL_LABELS[m]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
