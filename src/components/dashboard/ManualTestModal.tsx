"use client";
import { useEffect, useState } from "react";
import { Check, Link2, Loader2, Save, X } from "lucide-react";
import {
  DOMAIN_TYPE_COLORS,
  MODEL_COLORS,
  MODEL_LABELS,
  type Brand,
  type ModelId,
  type ParsedResponse,
  type Prompt,
} from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";

export function ManualTestModal({
  brand,
  initialPromptId,
  onClose,
  onSaved,
}: {
  brand: Brand;
  initialPromptId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptId, setPromptId] = useState(initialPromptId ?? "");
  const [queryText, setQueryText] = useState("");
  const [model, setModel] = useState<ModelId>(
    (brand.selected_models?.[0] as ModelId) ?? "openai"
  );
  const [response, setResponse] = useState("");
  const [parsed, setParsed] = useState<ParsedResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const models = brand.selected_models?.length
    ? brand.selected_models
    : (["openai", "claude", "gemini", "perplexity", "google_aio"] as ModelId[]);

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((d) => {
        const active = (d.prompts ?? []).filter((p: Prompt) => p.is_active);
        setPrompts(active);
        if (!promptId && active.length) setPromptId(active[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = prompts.find((x) => x.id === promptId);
    if (p) setQueryText(p.text);
  }, [promptId, prompts]);

  async function analyze() {
    if (!response.trim()) return;
    setAnalyzing(true);
    setError("");
    setParsed(null);
    try {
      const res = await fetch("/api/runs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyzeOnly: true, response }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setParsed(data.parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz hatası");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!promptId || !response.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/runs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId, model, queryText, response }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setParsed(data.parsed);
      setSaved(true);
      onSaved();
      setTimeout(() => {
        setResponse("");
        setParsed(null);
        setSaved(false);
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-8 w-full max-w-2xl rounded-xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold">Manuel Görünürlük Testi</h2>
            <p className="text-[11px] text-muted-foreground">
              LLM&apos;e sorduğunuz aramayı ve aldığınız cevabı yapıştırın. API
              gerekmez.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3.5 px-5 py-4">
          {prompts.length === 0 && (
            <p className="rounded-md border border-border/40 bg-white/[0.02] px-3 py-2 text-[12px] text-muted-foreground">
              Aktif soru yok. Önce &quot;Sorular&quot; sekmesinden soru ekleyin.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Soru (Prompt)
              </label>
              <Select
                value={promptId}
                onChange={(e) => setPromptId(e.target.value)}
                className="w-full"
              >
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.text.length > 50 ? p.text.slice(0, 50) + "…" : p.text}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Model
              </label>
              <Select
                value={model}
                onChange={(e) => setModel(e.target.value as ModelId)}
                className="w-full"
              >
                {models.map((mm) => (
                  <option key={mm} value={mm}>
                    {MODEL_LABELS[mm]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Arama Promptu (LLM&apos;e sorduğunuz metin)
            </label>
            <Input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="ör. en iyi e-ticaret araçları neler"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Response Promptu (LLM&apos;in verdiği cevap)
            </label>
            <Textarea
              value={response}
              onChange={(e) => {
                setResponse(e.target.value);
                setParsed(null);
              }}
              rows={7}
              placeholder="LLM'in cevabını buraya yapıştırın…"
              className="font-mono text-[12px]"
            />
          </div>

          {error && <p className="text-[12px] text-destructive">{error}</p>}

          {/* Analiz önizleme */}
          {parsed && <ParsePreview parsed={parsed} brandName={brand.name} />}

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              onClick={analyze}
              disabled={!response.trim() || analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Analiz Et (önizle)
            </Button>
            <Button
              onClick={save}
              disabled={!promptId || !response.trim() || saving}
            >
              {saved ? (
                <Check className="h-4 w-4" />
              ) : saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Kaydedildi" : "Analiz Et ve Kaydet"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParsePreview({
  parsed,
  brandName,
}: {
  parsed: ParsedResponse;
  brandName: string;
}) {
  const compHits = Object.entries(parsed.competitorMentions).filter(
    ([, v]) => v
  );
  return (
    <div className="rounded-lg border border-border/40 bg-white/[0.02] p-3.5">
      <div className="mb-2.5 text-[11px] uppercase tracking-wider text-muted-foreground/50">
        Analiz Sonucu
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Stat
          label={`${brandName} geçiyor mu`}
          value={parsed.mentioned ? "Evet" : "Hayır"}
          color={parsed.mentioned ? "#30a46c" : "#e5484d"}
        />
        <Stat label="Kaç kez" value={String(parsed.mentionCount)} />
        <Stat
          label="Konum"
          value={parsed.positionScore ? `#${parsed.positionScore}` : "—"}
        />
        <Stat
          label="Sentiment"
          value={
            parsed.sentiment === "positive"
              ? "Olumlu"
              : parsed.sentiment === "negative"
                ? "Olumsuz"
                : "Nötr"
          }
        />
      </div>

      {compHits.length > 0 && (
        <div className="mt-3 border-t border-border/30 pt-2.5">
          <span className="text-[11px] text-muted-foreground">
            Cevapta geçen rakipler:{" "}
          </span>
          <span className="text-[12px] text-foreground">
            {compHits.map(([n]) => n).join(", ")}
          </span>
        </div>
      )}

      {parsed.citations.length > 0 && (
        <div className="mt-3 border-t border-border/30 pt-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3" /> Bulunan kaynaklar (
            {parsed.citations.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {parsed.citations.map((c, i) => (
              <span
                key={i}
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{
                  color: DOMAIN_TYPE_COLORS[c.domainType],
                  backgroundColor: `${DOMAIN_TYPE_COLORS[c.domainType]}1f`,
                }}
                title={c.url}
              >
                {c.domain}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground/60">{label}</div>
      <div
        className="mt-0.5 text-[15px] font-semibold tabular-nums"
        style={{ color: color ?? undefined }}
      >
        {value}
      </div>
    </div>
  );
}
