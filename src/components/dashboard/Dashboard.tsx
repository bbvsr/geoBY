"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardPaste,
  Globe,
  Layers,
  LayoutDashboard,
  MessageSquareText,
  Play,
  Settings,
} from "lucide-react";
import {
  ALL_MODELS,
  MODEL_COLORS,
  MODEL_LABELS,
  type AiStatus,
  type Brand,
  type Competitor,
  type ModelId,
  type Prompt,
} from "@/types";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client";
import { OverviewTab } from "./OverviewTab";
import { PromptsTab } from "./PromptsTab";
import { SourcesTab } from "./SourcesTab";
import { SettingsTab } from "./SettingsTab";
import { ManualTestModal } from "./ManualTestModal";
import { PromptDetailModal } from "./PromptDetailModal";
import { FilterBar } from "./FilterBar";
import { RunBanner, type RunState } from "./RunBanner";

type Tab = "overview" | "prompts" | "sources" | "settings";

const NAV: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Genel Bakış", icon: LayoutDashboard },
  { key: "prompts", label: "Sorular", icon: MessageSquareText },
  { key: "sources", label: "Kaynaklar", icon: Globe },
  { key: "settings", label: "Ayarlar", icon: Settings },
];

interface RunResponse {
  results: { model: ModelId; success: boolean; engine?: string; mentioned?: boolean; error?: string }[];
}

export function Dashboard({
  brand: initialBrand,
  competitors: initialCompetitors,
}: {
  brand: Brand;
  competitors: Competitor[];
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState(90);
  const [model, setModel] = useState<ModelId | "all">("all");
  const [manual, setManual] = useState<{ open: boolean; promptId?: string; model?: ModelId }>({
    open: false,
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const cancelRef = useRef(false);

  const modelParam = model === "all" ? undefined : model;
  const autoModels = (ai?.models ?? [])
    .filter((m) => m.auto && brand.selected_models.includes(m.model))
    .map((m) => m.model);

  const loadAi = useCallback(() => {
    api<AiStatus>("/api/ai/status").then(setAi).catch(() => setAi(null));
  }, []);

  const reloadBrand = useCallback(async () => {
    const d = await api<{ brand: Brand; competitors: Competitor[] }>("/api/brand");
    if (d.brand) {
      setBrand(d.brand);
      setCompetitors(d.competitors);
    }
  }, []);

  useEffect(() => {
    loadAi();
  }, [loadAi]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  function openManual(promptId?: string, m?: ModelId) {
    setDetailId(null);
    setManual({ open: true, promptId, model: m });
  }

  /** Verilen soruları seçili modellerde sırayla otomatik test eder. */
  async function runTests(prompts: Pick<Prompt, "id" | "text">[]) {
    if (run?.running || prompts.length === 0) return;
    cancelRef.current = false;
    const state: RunState = {
      running: true,
      done: 0,
      total: prompts.length,
      current: prompts[0].text,
      success: 0,
      mentioned: 0,
      errors: [],
    };
    setRun({ ...state });

    for (const p of prompts) {
      if (cancelRef.current) break;
      state.current = p.text;
      setRun({ ...state });
      try {
        const res = await api<RunResponse>("/api/prompts/run", {
          method: "POST",
          body: { promptId: p.id },
        });
        for (const r of res.results) {
          if (r.success) {
            state.success += 1;
            if (r.mentioned) state.mentioned += 1;
          } else {
            state.errors.push(`${MODEL_LABELS[r.model]}: ${r.error}`);
          }
        }
      } catch (e) {
        state.errors.push((e as Error).message);
      }
      state.done += 1;
      setRun({ ...state });
      refresh();
    }
    state.running = false;
    state.cancelled = cancelRef.current;
    setRun({ ...state });
    refresh();
  }

  async function runAll() {
    try {
      const d = await api<{ prompts: Prompt[] }>("/api/prompts");
      const active = d.prompts.filter((p) => p.is_active);
      if (active.length === 0) {
        setRun({
          running: false,
          done: 0,
          total: 0,
          current: "",
          success: 0,
          mentioned: 0,
          errors: ["Aktif soru yok. Sorular sekmesinden soru ekleyin."],
        });
        return;
      }
      runTests(active);
    } catch (e) {
      setRun({
        running: false,
        done: 0,
        total: 0,
        current: "",
        success: 0,
        mentioned: 0,
        errors: [(e as Error).message],
      });
    }
  }

  const canAuto = autoModels.length > 0;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (masaüstü) */}
      <aside className="fixed left-0 top-0 hidden h-screen w-[208px] flex-col border-r border-border/40 bg-[#0d0d10] px-3 py-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight">GeoBY</span>
            <span className="block text-[10px] text-muted-foreground">AI görünürlük takibi</span>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <NavButton key={n.key} item={n} active={tab === n.key} onClick={() => setTab(n.key)} />
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <button
            onClick={runAll}
            disabled={!canAuto || !!run?.running}
            title={
              canAuto
                ? `Otomatik: ${autoModels.map((m) => MODEL_LABELS[m]).join(", ")}`
                : "Otomatik test için Ayarlar'dan ücretsiz bir yapay zeka anahtarı ekleyin"
            }
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            Tüm Soruları Test Et
          </button>
          <button
            onClick={() => openManual()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border/60 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-white/[0.04]"
          >
            <ClipboardPaste className="h-4 w-4" />
            Manuel Test
          </button>
          {ai && !canAuto && (
            <button
              onClick={() => setTab("settings")}
              className="w-full px-1 text-left text-[11px] leading-snug text-muted-foreground hover:text-foreground"
            >
              Otomatik test kapalı. <span className="text-primary">Ücretsiz anahtar ekle →</span>
            </button>
          )}
        </div>
      </aside>

      {/* Ana alan */}
      <div className="min-w-0 flex-1 md:ml-[208px]">
        <header className="sticky top-0 z-20 border-b border-border/40 bg-background/85 backdrop-blur">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-success" />
                <span className="text-[13px] font-medium">{brand.name}</span>
                <span className="hidden text-[12px] text-muted-foreground sm:inline">{brand.domain}</span>
              </div>
              {tab !== "settings" && (
                <FilterBar days={days} setDays={setDays} model={model} setModel={setModel} />
              )}
            </div>
            <div className="hidden items-center gap-1.5 xl:flex">
              {ALL_MODELS.map((m) => {
                const st = ai?.models.find((x) => x.model === m);
                return (
                  <span
                    key={m}
                    title={st?.auto ? `Otomatik · ${st.engine?.providerLabel}` : "Manuel test"}
                    className={cn(
                      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-opacity",
                      model !== "all" && model !== m && "opacity-30"
                    )}
                    style={{ color: MODEL_COLORS[m], backgroundColor: `${MODEL_COLORS[m]}1f` }}
                  >
                    {MODEL_LABELS[m]}
                    <span className="opacity-60">{st?.auto ? "· oto" : "· manuel"}</span>
                  </span>
                );
              })}
            </div>
          </div>
          {/* Mobil menü */}
          <nav className="flex gap-1 overflow-x-auto border-t border-border/30 px-3 py-1.5 md:hidden">
            {NAV.map((n) => (
              <NavButton key={n.key} item={n} active={tab === n.key} onClick={() => setTab(n.key)} compact />
            ))}
            <button
              onClick={runAll}
              disabled={!canAuto || !!run?.running}
              className="ml-auto flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" /> Test Et
            </button>
            <button
              onClick={() => openManual()}
              className="flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-2.5 py-1.5 text-[12px]"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Manuel
            </button>
          </nav>
        </header>

        <main className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-8">
          {run && (
            <RunBanner
              state={run}
              onCancel={() => (cancelRef.current = true)}
              onClose={() => setRun(null)}
            />
          )}

          {tab === "overview" && (
            <OverviewTab
              days={days}
              model={modelParam}
              brand={brand}
              competitors={competitors}
              refreshKey={refreshKey}
              canAuto={canAuto}
              onRunAll={runAll}
              onManual={() => openManual()}
              onOpenPrompt={setDetailId}
              onGoSettings={() => setTab("settings")}
            />
          )}
          {tab === "prompts" && (
            <PromptsTab
              days={days}
              model={modelParam}
              refreshKey={refreshKey}
              canAuto={canAuto}
              running={!!run?.running}
              onAutoTest={(p) => runTests([p])}
              onManualTest={(id) => openManual(id)}
              onOpenPrompt={setDetailId}
            />
          )}
          {tab === "sources" && <SourcesTab days={days} model={modelParam} refreshKey={refreshKey} />}
          {tab === "settings" && (
            <SettingsTab
              brand={brand}
              competitors={competitors}
              ai={ai}
              onChange={async () => {
                await reloadBrand();
                loadAi();
                refresh();
              }}
            />
          )}
        </main>
      </div>

      {detailId && (
        <PromptDetailModal
          promptId={detailId}
          refreshKey={refreshKey}
          canAuto={canAuto}
          running={!!run?.running}
          onClose={() => setDetailId(null)}
          onManualTest={(id, m) => openManual(id, m)}
          onAutoTest={(p) => runTests([p])}
        />
      )}

      {manual.open && (
        <ManualTestModal
          brand={brand}
          initialPromptId={manual.promptId}
          initialModel={manual.model}
          onClose={() => setManual({ open: false })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
  compact,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-md text-[13px] transition-colors",
        compact ? "px-2 py-1.5 text-[12px]" : "px-2.5 py-2",
        active ? "bg-white/[0.06] text-foreground" : "text-muted-foreground hover:bg-white/[0.03]"
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
      {item.label}
    </button>
  );
}
