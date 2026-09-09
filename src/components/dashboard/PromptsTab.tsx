"use client";
import { useEffect, useState } from "react";
import { Archive, Play, Plus } from "lucide-react";
import {
  MODEL_COLORS,
  MODEL_SHORT,
  type ModelId,
  type PromptWithMetrics,
} from "@/types";
import { cn, formatPercent, sentimentColor } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PromptDetailModal } from "./PromptDetailModal";

export function PromptsTab({
  days,
  model,
  onManualTest,
}: {
  days: number;
  model?: ModelId;
  onManualTest: (id: string) => void;
}) {
  const [prompts, setPrompts] = useState<PromptWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("Tümü");
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTopic, setNewTopic] = useState("Genel");
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (model) params.set("model", model);
    const res = await fetch(`/api/prompts/metrics?${params}`);
    const data = await res.json();
    setPrompts(data.prompts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, model]);

  const active = prompts.filter((p) => p.is_active);
  const topics = ["Tümü", ...new Set(active.map((p) => p.topic))];
  const filtered =
    topic === "Tümü" ? active : active.filter((p) => p.topic === topic);

  async function addPrompt() {
    if (!newText.trim()) return;
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText, topic: newTopic }),
    });
    setNewText("");
    setAdding(false);
    load();
  }

  async function archive(id: string) {
    await fetch("/api/prompts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sorular</h1>
          <p className="text-[13px] text-muted-foreground">
            Markanızın LLM&apos;lerde görünebileceği sorgular ve görünürlük
            metrikleri.
          </p>
        </div>
        <Button onClick={() => setAdding((a) => !a)}>
          <Plus className="h-4 w-4" /> Soru Ekle
        </Button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/60 p-3">
          <Input
            autoFocus
            placeholder="Yeni soru metni…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPrompt()}
          />
          <Select value={newTopic} onChange={(e) => setNewTopic(e.target.value)}>
            {["Genel", "Kategori", "Core", "Affiliate", "Rakip", "Ücretsiz araç"].map(
              (t) => (
                <option key={t}>{t}</option>
              )
            )}
          </Select>
          <Button onClick={addPrompt}>Ekle</Button>
        </div>
      )}

      {/* Topic filtreleri */}
      <div className="flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] transition-colors",
              topic === t
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:bg-white/[0.03]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tablo */}
      <div className="rounded-lg border border-border/40 bg-card/60">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted-foreground/60">
            Soru bulunamadı.
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                <th className="px-5 py-2.5 text-left font-medium">Soru</th>
                <th className="px-2 py-2.5 text-left font-medium">Görünürlük</th>
                <th className="px-2 py-2.5 text-left font-medium">Sentiment</th>
                <th className="px-2 py-2.5 text-left font-medium">Konum</th>
                <th className="px-2 py-2.5 text-left font-medium">Modeller</th>
                <th className="px-5 py-2.5 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-border/20 hover:bg-white/[0.015]"
                >
                  <td className="max-w-[400px] px-5 py-3">
                    <button
                      onClick={() => setDetailId(p.id)}
                      className="line-clamp-1 text-left hover:text-primary"
                    >
                      {p.text}
                    </button>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/50">
                      {p.topic}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-12 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(100, p.visibility * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatPercent(p.visibility)}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {p.totalRuns ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: sentimentColor(p.sentiment) }}
                        />
                        <span className="tabular-nums text-muted-foreground">
                          {p.sentiment}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 tabular-nums text-muted-foreground">
                    {p.position ? `#${p.position.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1">
                      {p.models.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground/40">
                          test yok
                        </span>
                      ) : (
                        p.models.map((mm) => (
                          <span
                            key={mm}
                            className="rounded px-1 py-0.5 text-[9px] font-semibold"
                            style={{
                              color: MODEL_COLORS[mm],
                              backgroundColor: `${MODEL_COLORS[mm]}1f`,
                            }}
                          >
                            {MODEL_SHORT[mm]}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onManualTest(p.id)}
                        title="Manuel Test"
                        className="rounded p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-primary"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => archive(p.id)}
                        title="Arşivle"
                        className="rounded p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-destructive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <PromptDetailModal
          promptId={detailId}
          onClose={() => setDetailId(null)}
          onManualTest={(id) => {
            setDetailId(null);
            onManualTest(id);
          }}
        />
      )}
    </div>
  );
}
