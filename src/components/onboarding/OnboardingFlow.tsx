"use client";
import { useState } from "react";
import { ArrowRight, Plus, Sparkle, Trash, WarningCircle } from "@phosphor-icons/react";
import { MODEL_LABELS, STANDARD_MODELS, type CrawlResult, type ModelId } from "@/types";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client";
import { Button, Field, IconButton, Input, Notice, Select, Spinner } from "@/components/ui";

const TOPICS = ["Genel", "Kategori", "Karşılaştırma", "Rakip", "Fiyat", "Marka"];

type Step = "site" | "analyzing" | "review";

interface PromptDraft {
  text: string;
  topic: string;
}
interface CompetitorDraft {
  name: string;
  domain: string;
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>("site");
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [crawl, setCrawl] = useState<CrawlResult | null>(null);
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [prompts, setPrompts] = useState<PromptDraft[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([]);
  const [models, setModels] = useState<ModelId[]>([...STANDARD_MODELS]);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setStep("analyzing");
    try {
      const d = await api<{ crawl: CrawlResult; domain: string }>("/api/onboarding/crawl", { method: "POST", body: { url } });
      const c = d.crawl;
      setCrawl(c);
      setDomain(d.domain);
      setBrandName(c.brandName);
      setCategory(c.category);
      setDescription(c.description);
      const [p, comp] = await Promise.all([
        api<{ prompts: PromptDraft[] }>("/api/onboarding/generate-prompts", { method: "POST", body: { crawlData: c, domain: d.domain } }),
        api<{ competitors: CompetitorDraft[] }>("/api/onboarding/generate-competitors", { method: "POST", body: { crawlData: c } }),
      ]);
      setPrompts(p.prompts);
      setCompetitors(comp.competitors.length ? comp.competitors : [{ name: "", domain: "" }]);
      setStep("review");
    } catch (err) {
      setError((err as Error).message);
      setStep("site");
    }
  }

  async function suggestPrompts() {
    if (!crawl || !category.trim()) return;
    setSuggesting(true);
    try {
      const p = await api<{ prompts: PromptDraft[] }>("/api/onboarding/generate-prompts", {
        method: "POST",
        body: {
          crawlData: { ...crawl, category, brandName, suggestedPrompts: undefined, competitorHints: competitors.map((c) => c.name).filter(Boolean) },
          domain,
        },
      });
      const existing = new Set(prompts.map((x) => x.text.toLocaleLowerCase("tr")));
      setPrompts([...prompts.filter((x) => x.text.trim()), ...p.prompts.filter((x) => !existing.has(x.text.toLocaleLowerCase("tr")))]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function launch() {
    setLaunching(true);
    setError(null);
    try {
      await api("/api/onboarding/complete", {
        method: "POST",
        body: {
          brandName: brandName.trim(),
          domain,
          category,
          description,
          prompts: prompts.filter((p) => p.text.trim()),
          competitors: competitors.filter((c) => c.name.trim()),
          selectedModels: models,
        },
      });
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setLaunching(false);
    }
  }

  const validPrompts = prompts.filter((p) => p.text.trim().length >= 3);
  const blockers = [
    !brandName.trim() && "marka adı",
    validPrompts.length === 0 && "en az bir soru",
    models.length === 0 && "en az bir asistan",
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[880px] items-center justify-between px-5">
          <span className="font-serif text-[22px] font-semibold tracking-[-0.02em]">GeoBY</span>
          <ol className="flex items-center gap-4 text-[13px]" aria-label="Kurulum adımları">
            {[
              ["site", "1. Site"],
              ["analyzing", "2. Analiz"],
              ["review", "3. Kontrol"],
            ].map(([key, label]) => (
              <li key={key} className={cn(step === key ? "font-medium text-ink" : "text-ink-3")} aria-current={step === key ? "step" : undefined}>
                {label}
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-5 pt-12 pb-24">
        {step === "site" && (
          <div className="max-w-[560px]">
            <h1 className="font-serif text-[38px] leading-[1.1] font-medium tracking-[-0.015em]">
              Yapay zekâ asistanları sizi öneriyor mu?
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
              Müşteriler artık “en iyi … hangisi?” sorusunu Google yerine ChatGPT, Gemini ve benzerlerine soruyor. GeoBY bu
              soruları düzenli olarak sorar ve cevaplarda markanızın geçip geçmediğini, rakiplerinizin nerede olduğunu
              gösterir.
            </p>
            <form onSubmit={analyze} className="mt-8">
              <Field label="Web siteniz" htmlFor="site-url" error={error} hint="Siteyi tarayıp marka, kategori ve rakip önerisi hazırlayacağım.">
                <div className="flex gap-2">
                  <Input
                    id="site-url"
                    autoFocus
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="markaniz.com"
                    inputMode="url"
                    autoComplete="url"
                    aria-invalid={!!error}
                  />
                  <Button type="submit" variant="primary" icon={<ArrowRight size={16} />} disabled={!url.trim()}>
                    Devam
                  </Button>
                </div>
              </Field>
            </form>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex max-w-[560px] items-start gap-4" role="status" aria-live="polite">
            <Spinner size={22} className="mt-1" />
            <div>
              <p className="font-serif text-[26px] leading-snug">{url} inceleniyor</p>
              <p className="mt-2 text-[15px] text-ink-2">
                Ana sayfa ve birkaç alt sayfa okunuyor, ardından soru ve rakip önerileri hazırlanıyor. Bu 10-40 saniye
                sürebilir.
              </p>
            </div>
          </div>
        )}

        {step === "review" && crawl && (
          <div className="space-y-10">
            <div>
              <h1 className="font-serif text-[32px] leading-tight font-medium">Kontrol edin, gerekirse düzeltin</h1>
              <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">
                {crawl.analyzedBy
                  ? `Öneriler ${crawl.analyzedBy} ile hazırlandı. Yapay zekâ rakipleri yanlış tahmin edebilir; listeyi kendiniz kontrol edin.`
                  : "Yardımcı yapay zekâ ayarlı olmadığı için öneriler basit kurallarla hazırlandı. Soruları ve rakipleri kendinize göre düzenleyin."}
              </p>
              {crawl.fetched === false && (
                <Notice tone="warn" className="mt-4">
                  Sitenizin içeriği okunamadı: adres yanlış yazılmış, site otomatik erişimi engelliyor ya da ağınız buna izin vermiyor olabilir. Bilgileri elle doldurun.
                </Notice>
              )}
            </div>

            <Group title="Marka" description="Asistanların cevaplarında bu ad ve alan adı aranır.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Marka adı" htmlFor="ob-name" hint="Asistanların yazacağı biçimde.">
                  <Input id="ob-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                </Field>
                <Field label="Alan adı" htmlFor="ob-domain">
                  <Input id="ob-domain" value={domain} disabled />
                </Field>
              </div>
              <Field label="Ne satıyorsunuz? (kategori)" htmlFor="ob-cat" hint="ör. online kırtasiye, diş kliniği, muhasebe yazılımı" className="mt-4">
                <Input id="ob-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
              </Field>
              <Field label="Kısa açıklama (isteğe bağlı)" htmlFor="ob-desc" className="mt-4">
                <Input id="ob-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </Group>

            <Group
              title="Rakipler"
              description="Karşılaştırılacak markalar. Alan adını biliyorsanız ekleyin; cevaplarda sitesi de aranır."
            >
              <ul className="space-y-2">
                {competitors.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <label className="sr-only" htmlFor={`ob-c-${i}`}>
                      Rakip adı
                    </label>
                    <Input
                      id={`ob-c-${i}`}
                      value={c.name}
                      placeholder="Rakip adı"
                      onChange={(e) => setCompetitors(competitors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <label className="sr-only" htmlFor={`ob-cd-${i}`}>
                      Rakip alan adı
                    </label>
                    <Input
                      id={`ob-cd-${i}`}
                      value={c.domain}
                      placeholder="rakip.com"
                      onChange={(e) => setCompetitors(competitors.map((x, j) => (j === i ? { ...x, domain: e.target.value } : x)))}
                    />
                    <IconButton label="Rakibi kaldır" onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))} className="h-10 w-10">
                      <Trash size={16} />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" icon={<Plus size={15} />} className="mt-2" onClick={() => setCompetitors([...competitors, { name: "", domain: "" }])}>
                Rakip ekle
              </Button>
            </Group>

            <Group
              title="Sorular"
              description="Müşterinin asistana yazacağı sorular. Görünürlüğü ölçmek için çoğunda markanızın adı geçmemeli."
            >
              {prompts.length === 0 && (
                <Notice className="mb-3">
                  {category.trim()
                    ? "Henüz soru yok. Kategorinize göre soru önerebilirim ya da kendiniz yazabilirsiniz."
                    : "Soru önerebilmem için yukarıya ne sattığınızı (kategori) yazın."}
                </Notice>
              )}
              <ul className="space-y-2">
                {prompts.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <label className="sr-only" htmlFor={`ob-p-${i}`}>
                      Soru
                    </label>
                    <Input
                      id={`ob-p-${i}`}
                      value={p.text}
                      placeholder="ör. en iyi online kırtasiye sitesi hangisi"
                      onChange={(e) => setPrompts(prompts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    />
                    <label className="sr-only" htmlFor={`ob-pt-${i}`}>
                      Konu
                    </label>
                    <Select
                      id={`ob-pt-${i}`}
                      value={TOPICS.includes(p.topic) ? p.topic : "Genel"}
                      onChange={(e) => setPrompts(prompts.map((x, j) => (j === i ? { ...x, topic: e.target.value } : x)))}
                      className="w-40 shrink-0"
                    >
                      {TOPICS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Select>
                    <IconButton label="Soruyu kaldır" onClick={() => setPrompts(prompts.filter((_, j) => j !== i))} className="h-10 w-10">
                      <Trash size={16} />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => setPrompts([...prompts, { text: "", topic: "Genel" }])}>
                  Soru ekle
                </Button>
                <Button size="sm" variant="ghost" icon={<Sparkle size={15} />} onClick={suggestPrompts} loading={suggesting} disabled={!category.trim()}>
                  Kategoriye göre soru öner
                </Button>
              </div>
            </Group>

            <Group title="Asistanlar" description="Hangi asistanlardaki görünürlüğünüzü izlemek istiyorsunuz? Sonradan değiştirebilirsiniz.">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {STANDARD_MODELS.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-2 text-[15px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-ink)]"
                      checked={models.includes(m)}
                      onChange={() => setModels(models.includes(m) ? models.filter((x) => x !== m) : [...models, m])}
                    />
                    {MODEL_LABELS[m]}
                  </label>
                ))}
              </div>
            </Group>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <Button variant="ghost" onClick={() => setStep("site")}>
                Başka bir site gir
              </Button>
              <div className="flex items-center gap-3">
                {(error || blockers.length > 0) && (
                  <p className="flex items-center gap-1.5 text-[13px] text-bad" role="alert">
                    <WarningCircle size={15} />
                    {error ?? `Eksik: ${blockers.join(", ")}`}
                  </p>
                )}
                <Button variant="primary" onClick={launch} loading={launching} disabled={blockers.length > 0}>
                  Kaydet ve panele geç
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Group({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-t border-line pt-6 md:grid-cols-[200px_1fr]">
      <div>
        <h2 className="font-serif text-[20px] font-medium">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-3">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
