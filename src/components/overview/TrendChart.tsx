"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/types";
import { shortDate } from "@/lib/utils";

// Rakipler: birbirinden ayırt edilebilen ama sakin tonlar; marka tek vurgu rengiyle
const RIVAL_COLORS = ["#5b6b7a", "#8a7d5c", "#6d8a6a", "#8c6b7d", "#4f7a86", "#a08a6e"];
const ACCENT = "#b5481d";

interface Series {
  name: string;
  isYou: boolean;
}

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const rows = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-[13px] shadow-[0_8px_24px_-12px_rgb(60_50_30/0.3)]">
      <p className="mb-1 text-ink-3">{shortDate(label)} haftası</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />
            {r.name}
          </span>
          <span className="tnum font-medium">%{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, series }: { data: TrendPoint[]; series: Series[] }) {
  const rivals = series.filter((s) => !s.isYou);
  const you = series.find((s) => s.isYou);
  const colorOf = (name: string) => (name === you?.name ? ACCENT : RIVAL_COLORS[rivals.findIndex((r) => r.name === name) % RIVAL_COLORS.length]);

  return (
    <div>
      <div className="h-[260px] w-full" role="img" aria-label="Haftalık görünürlük grafiği">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2ddd2" vertical={false} />
            <XAxis
              dataKey="week"
              tickFormatter={(w: string) => shortDate(w)}
              tick={{ fill: "#77736a", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#cfc8b9" }}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `%${v}`}
              tick={{ fill: "#77736a", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "#cfc8b9" }} />
            {rivals.map((r) => (
              <Line
                key={r.name}
                type="linear"
                dataKey={r.name}
                stroke={colorOf(r.name)}
                strokeWidth={1.5}
                dot={{ r: 2.5, strokeWidth: 0, fill: colorOf(r.name) }}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {you && (
              <Line
                type="linear"
                dataKey={you.name}
                stroke={ACCENT}
                strokeWidth={2.5}
                dot={{ r: 3.5, strokeWidth: 0, fill: ACCENT }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-2">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[3px] w-4 rounded-full"
              style={{ background: colorOf(s.name) }}
              aria-hidden
            />
            <span className={s.isYou ? "font-medium text-ink" : undefined}>{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
