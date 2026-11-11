"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MODEL_LABELS, type AiStatus, type Brand, type Competitor, type ModelId, type Prompt } from "@/types";
import { api } from "@/lib/client";

export interface RunState {
  running: boolean;
  done: number;
  total: number;
  current: string;
  /** Alınan cevap sayısı */
  answers: number;
  /** Markanın geçtiği cevap sayısı */
  mentioned: number;
  errors: string[];
  cancelled?: boolean;
}

interface RunResponse {
  results: { model: ModelId; success: boolean; mentioned?: boolean; error?: string }[];
}

export interface PasteTarget {
  promptId?: string;
  model?: ModelId;
}

interface AppState {
  brand: Brand;
  competitors: Competitor[];
  reloadBrand: () => Promise<void>;

  ai: AiStatus | null;
  reloadAi: () => void;
  /** Bu markada izlenen ve otomatik test edilebilen asistanlar */
  autoModels: ModelId[];

  days: number;
  setDays: (d: number) => void;
  model: ModelId | null;
  setModel: (m: ModelId | null) => void;

  /** Veri değiştiğinde artar; sayfalar yeniden yükler. */
  version: number;
  refresh: () => void;

  run: RunState | null;
  runTests: (prompts: Pick<Prompt, "id" | "text">[]) => Promise<void>;
  runAll: () => Promise<void>;
  cancelRun: () => void;
  dismissRun: () => void;

  openPromptId: string | null;
  openPrompt: (id: string | null) => void;
  paste: PasteTarget | null;
  openPaste: (t: PasteTarget | null) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp yalnızca AppProvider içinde kullanılabilir");
  return v;
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* gizli pencere vb. */
  }
}

export function AppProvider({
  initialBrand,
  initialCompetitors,
  children,
}: {
  initialBrand: Brand;
  initialCompetitors: Competitor[];
  children: ReactNode;
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [days, setDaysState] = useState(30);
  const [model, setModelState] = useState<ModelId | null>(null);
  const [version, setVersion] = useState(0);
  const [run, setRun] = useState<RunState | null>(null);
  const [openPromptId, openPrompt] = useState<string | null>(null);
  const [paste, openPaste] = useState<PasteTarget | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    setDaysState(readStored("geoby.days", 30));
    setModelState(readStored<ModelId | null>("geoby.model", null));
  }, []);

  const setDays = useCallback((d: number) => {
    setDaysState(d);
    store("geoby.days", d);
  }, []);
  const setModel = useCallback((m: ModelId | null) => {
    setModelState(m);
    store("geoby.model", m);
  }, []);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const reloadAi = useCallback(() => {
    api<AiStatus>("/api/ai/status").then(setAi).catch(() => setAi(null));
  }, []);
  useEffect(reloadAi, [reloadAi]);

  const reloadBrand = useCallback(async () => {
    const d = await api<{ brand: Brand | null; competitors: Competitor[] }>("/api/brand");
    if (d.brand) {
      setBrand(d.brand);
      setCompetitors(d.competitors);
    } else {
      // Marka silindi: kuruluma dön
      window.location.href = "/";
    }
  }, []);

  const autoModels = useMemo(
    () => (ai?.models ?? []).filter((m) => m.auto && brand.selected_models.includes(m.model)).map((m) => m.model),
    [ai, brand.selected_models]
  );

  const runTests = useCallback(
    async (prompts: Pick<Prompt, "id" | "text">[]) => {
      if (runningRef.current || prompts.length === 0) return;
      runningRef.current = true;
      cancelRef.current = false;
      const s: RunState = { running: true, done: 0, total: prompts.length, current: prompts[0].text, answers: 0, mentioned: 0, errors: [] };
      setRun({ ...s });
      try {
        for (const p of prompts) {
          if (cancelRef.current) break;
          s.current = p.text;
          setRun({ ...s });
          try {
            const res = await api<RunResponse>("/api/prompts/run", { method: "POST", body: { promptId: p.id } });
            for (const r of res.results) {
              if (r.success) {
                s.answers += 1;
                if (r.mentioned) s.mentioned += 1;
              } else if (r.error) {
                s.errors.push(`${MODEL_LABELS[r.model]} — “${p.text}”: ${r.error}`);
              }
            }
          } catch (e) {
            s.errors.push(`“${p.text}”: ${(e as Error).message}`);
          }
          s.done += 1;
          setRun({ ...s });
          refresh();
        }
      } finally {
        s.running = false;
        s.cancelled = cancelRef.current && s.done < s.total;
        setRun({ ...s });
        runningRef.current = false;
        refresh();
      }
    },
    [refresh]
  );

  const runAll = useCallback(async () => {
    try {
      const d = await api<{ prompts: Prompt[] }>("/api/prompts?days=1");
      const active = d.prompts.filter((p) => p.is_active);
      if (active.length === 0) {
        setRun({ running: false, done: 0, total: 0, current: "", answers: 0, mentioned: 0, errors: ["Aktif soru yok. Sorular sayfasından soru ekleyin."] });
        return;
      }
      await runTests(active);
    } catch (e) {
      setRun({ running: false, done: 0, total: 0, current: "", answers: 0, mentioned: 0, errors: [(e as Error).message] });
    }
  }, [runTests]);

  const value: AppState = {
    brand,
    competitors,
    reloadBrand,
    ai,
    reloadAi,
    autoModels,
    days,
    setDays,
    model,
    setModel,
    version,
    refresh,
    run,
    runTests,
    runAll,
    cancelRun: () => (cancelRef.current = true),
    dismissRun: () => setRun(null),
    openPromptId,
    openPrompt,
    paste,
    openPaste,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
