"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { COMPETITOR_COLORS, type TrendPoint } from "@/types";

const COLORS = ["#2eb88a", ...COMPETITOR_COLORS];

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
              {p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SourceChart({
  data,
  domains,
}: {
  data: TrendPoint[];
  domains: string[];
}) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <defs>
            {domains.map((d, i) => (
              <linearGradient
                key={d}
                id={`grad-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={COLORS[i % COLORS.length]}
                  stopOpacity={0.14}
                />
                <stop
                  offset="100%"
                  stopColor={COLORS[i % COLORS.length]}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
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
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {domains.map((d, i) => (
            <Area
              key={d}
              type="monotone"
              dataKey={d}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              fill={`url(#grad-${i})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
