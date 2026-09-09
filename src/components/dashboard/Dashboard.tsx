"use client";
import { useState } from "react";
import {
  Globe,
  Layers,
  LayoutDashboard,
  MessageSquareText,
  PlusCircle,
  Settings,
} from "lucide-react";
import {
  ALL_MODELS,
  MODEL_COLORS,
  MODEL_LABELS,
  type Brand,
  type Competitor,
  type ModelId,
} from "@/types";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./OverviewTab";
import { PromptsTab } from "./PromptsTab";
import { SourcesTab } from "./SourcesTab";
import { SettingsTab } from "./SettingsTab";
import { ManualTestModal } from "./ManualTestModal";
import { FilterBar } from "./FilterBar";

type Tab = "overview" | "prompts" | "sources" | "settings";

const NAV: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Genel Bakış", icon: LayoutDashboard },
  { key: "prompts", label: "Sorular", icon: MessageSquareText },
  { key: "sources", label: "Kaynaklar", icon: Globe },
  { key: "settings", label: "Ayarlar", icon: Settings },
];

export function Dashboard({
  brand,
  competitors,
}: {
  brand: Brand;
  competitors: Competitor[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState(90);
  const [model, setModel] = useState<ModelId | "all">("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPromptId, setManualPromptId] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const modelParam = model === "all" ? undefined : model;

  function openManual(promptId?: string) {
    setManualPromptId(promptId);
    setManualOpen(true);
  }
  function onSaved() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 flex h-screen w-[200px] flex-col border-r border-border/40 bg-[#0d0d10] px-3 py-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">
            GeoBY
          </span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = tab === n.key;
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-white/[0.06] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.03]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <button
            onClick={() => openManual()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PlusCircle className="h-4 w-4" />
            Manuel Test
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-[200px] flex-1">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-8 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-success" />
              <span className="text-[13px] font-medium">{brand.name}</span>
              <span className="text-[12px] text-muted-foreground">
                {brand.domain}
              </span>
            </div>
            <FilterBar
              days={days}
              setDays={setDays}
              model={model}
              setModel={setModel}
            />
          </div>
          <div className="hidden items-center gap-1.5 lg:flex">
            {ALL_MODELS.map((m) => (
              <span
                key={m}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium transition-opacity",
                  model !== "all" && model !== m && "opacity-30"
                )}
                style={{
                  color: MODEL_COLORS[m],
                  backgroundColor: `${MODEL_COLORS[m]}1f`,
                }}
              >
                {MODEL_LABELS[m]}
              </span>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-[1400px] p-8">
          {tab === "overview" && (
            <OverviewTab
              key={`ov-${refreshKey}`}
              days={days}
              model={modelParam}
              brand={brand}
              competitors={competitors}
              onOpenPrompt={openManual}
            />
          )}
          {tab === "prompts" && (
            <PromptsTab
              key={`pr-${refreshKey}`}
              days={days}
              model={modelParam}
              onManualTest={openManual}
            />
          )}
          {tab === "sources" && (
            <SourcesTab
              key={`so-${refreshKey}`}
              days={days}
              model={modelParam}
            />
          )}
          {tab === "settings" && (
            <SettingsTab brand={brand} onChange={onSaved} />
          )}
        </main>
      </div>

      {manualOpen && (
        <ManualTestModal
          brand={brand}
          initialPromptId={manualPromptId}
          onClose={() => setManualOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
