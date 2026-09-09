"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  COMPETITOR_COLORS,
  type Brand,
  type Competitor,
  type TrendPoint,
} from "@/types";

const PRIMARY = "#2eb88a";

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-lg border border-border/60 bg-[#161619] px-3 py-2 shadow-xl">
      <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1">
        {sorted.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between gap-4 text-[12px]"
          >
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-foreground">{p.name}</span>
            </span>
            <span className="tabular-nums font-medium" style={{ color: p.color }}>
              {p.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VisibilityChart({
  data,
  brand,
  competitors,
}: {
  data: TrendPoint[];
  brand: Brand;
  competitors: Competitor[];
}) {
  return (
    <div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e22" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#3a3a41"
              tick={{ fill: "#8b8b92", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1e1e22" }}
            />
            <YAxis
              stroke="#3a3a41"
              tick={{ fill: "#8b8b92", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={brand.name}
              stroke={PRIMARY}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: PRIMARY }}
            />
            {competitors.map((c, i) => (
              <Line
                key={c.id}
                type="monotone"
                dataKey={c.name}
                stroke={COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]}
                strokeWidth={1.5}
                strokeOpacity={0.6}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/30 pt-3">
        <Legend name={brand.name} color={PRIMARY} bold />
        {competitors.map((c, i) => (
          <Legend
            key={c.id}
            name={c.name}
            color={COMPETITOR_COLORS[i % COMPETITOR_COLORS.length]}
          />
        ))}
      </div>
    </div>
  );
}

function Legend({
  name,
  color,
  bold,
}: {
  name: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color, opacity: bold ? 1 : 0.6 }}
      />
      <span className={bold ? "text-foreground" : "text-muted-foreground"}>
        {name}
      </span>
    </span>
  );
}
