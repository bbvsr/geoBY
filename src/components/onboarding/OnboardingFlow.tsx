"use client";
import { useState } from "react";
import {
  ArrowRight,
  Globe,
  Plus,
  Trash2,
  Zap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ALL_MODELS,
  MODEL_COLORS,
  MODEL_LABELS,
  type CrawlResult,
  type ModelId,
} from "@/types";
import { cn } from "@/lib/utils";

type Step = "url" | "analyzing" | "review";

interface PromptDraft {
  text: string;
  topic: string;
}
interface CompetitorDraft {
  name: string;
  domain: string;
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [crawl, setCrawl] = useState<CrawlResult | null>(null);
  const [prompts, setPrompts] = useState<PromptDraft[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([]);
  const [models, setModels] = useState<ModelId[]>([...ALL_MODELS]);
  const [brandName, setBrandName] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!url.trim()) return;
    setStep("analyzing");
    setError("");
    try {
      const crawlRes = await fetch("/api/onboarding/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const crawlData = await crawlRes.json();
      if (crawlData.error) throw new Error(crawlData.error);
      const c: CrawlResult = crawlData.crawl;
      setCrawl(c);
      setDomain(crawlData.domain);
      setBrandName(c.brandName);

      const [pRes, cRes] = await Promise.all([
        fetch("/api/onboarding/generate-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crawlData: c, domain: crawlData.domain }),
        }),
        fetch("/api/onboarding/generate-competitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crawlData: c, domain: crawlData.domain }),
        }),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      setPrompts(pData.prompts ?? []);
      setCompetitors(
        (cData.competitors ?? []).length
          ? cData.competitors
          : [{ name: "", domain: "" }]
      );
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz başarısız");
      setStep("url");
    }
  }

  async function launch() {
    setLaunching(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName || domain,
          domain,
          category: crawl?.category ?? "",
          description: crawl?.description ?? "",
          prompts: prompts.filter((p) => p.text.trim()),
          competitors: competitors.filter((c) => c.name.trim()),
          selectedModels: models,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Başlatma başarısız");
      setLaunching(false);
    }
  }

  function toggleModel(m: ModelId) {
    setModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  return (
    <div className="min-h-screen">
      <StepBar step={step} />
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-8">
        {step === "url" && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">GeoBY&apos;e hoş geldiniz</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Markanızın web sitesini girin; LLM görünürlüğünüzü izlemeye
              başlayalım.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Input
                autoFocus
                placeholder="https://markaniz.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
                className="h-11"
              />
              <Button size="lg" onClick={analyze} disabled={!url.trim()}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-[12px] text-destructive">{error}</p>
            )}
          </div>
        )}

        {step === "analyzing" && (
          <div className="mx-auto mt-28 flex max-w-md flex-col items-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h2 className="mt-4 text-[15px] font-medium">
              {domain || url} analiz ediliyor
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Site taranıyor, sorular ve rakipler oluşturuluyor…
            </p>
          </div>
        )}

        {step === "review" && crawl && (
          <div className="space-y-4">
            {/* Ürün özeti */}
            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <h3 className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground/50">
                Ürün Özeti
              </h3>
              <div className="space-y-2.5">
                <Field label="Marka adı">
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </Field>
                <Row label="Domain" value={domain} />
                <Row label="Kategori" value={crawl.category} />
                <Row label="Açıklama" value={crawl.description} />
              </div>
            </div>

            {/* Modeller */}
            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <h3 className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground/50">
                Test Edilecek Modeller
              </h3>
              <div className="flex flex-wrap gap-2">
                {ALL_MODELS.map((m) => {
                  const active = models.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleModel(m)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors",
                        active
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border/50 text-muted-foreground hover:bg-white/[0.03]"
                      )}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: MODEL_COLORS[m],
                          opacity: active ? 1 : 0.4,
                        }}
                      />
                      {MODEL_LABELS[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sorular */}
            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/50">
                  Oluşturulan Sorular
                </h3>
                <button
                  onClick={() =>
                    setPrompts([...prompts, { text: "", topic: "Genel" }])
                  }
                  className="flex items-center gap-1 text-[12px] text-primary hover:opacity-80"
                >
                  <Plus className="h-3.5 w-3.5" /> Ekle
                </button>
              </div>
              <div className="space-y-2">
                {prompts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={p.text}
                      placeholder="Soru metni…"
                      onChange={(e) => {
                        const next = [...prompts];
                        next[i] = { ...p, text: e.target.value };
                        setPrompts(next);
                      }}
                    />
                    <button
                      onClick={() =>
                        setPrompts(prompts.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground/50 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Rakipler */}
            <div className="rounded-lg border border-border/40 bg-card/60 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/50">
                  Rakipler
                </h3>
                <button
                  onClick={() =>
                    setCompetitors([...competitors, { name: "", domain: "" }])
                  }
                  className="flex items-center gap-1 text-[12px] text-primary hover:opacity-80"
                >
                  <Plus className="h-3.5 w-3.5" /> Ekle
                </button>
              </div>
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={c.name}
                      placeholder="Rakip adı"
                      onChange={(e) => {
                        const next = [...competitors];
                        next[i] = { ...c, name: e.target.value };
                        setCompetitors(next);
                      }}
                    />
                    <Input
                      value={c.domain}
                      placeholder="domain.com"
                      onChange={(e) => {
                        const next = [...competitors];
                        next[i] = { ...c, domain: e.target.value };
                        setCompetitors(next);
                      }}
                    />
                    <button
                      onClick={() =>
                        setCompetitors(competitors.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground/50 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-[12px] text-destructive">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <Button variant="outline" onClick={() => setStep("url")}>
                Baştan Başla
              </Button>
              <Button onClick={launch} disabled={launching}>
                {launching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Takibi Başlat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepBar({ step }: { step: Step }) {
  const steps = [
    { key: "url", label: "Web Sitesi" },
    { key: "analyzing", label: "Analiz" },
    { key: "review", label: "İncele & Başlat" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="border-b border-border/40">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-6 py-4">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                i <= activeIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/[0.06] text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-[12px]",
                i <= activeIdx ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-2 h-px w-8 bg-border/60" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}
