"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowSquareOut, Check, Copy, X } from "@phosphor-icons/react";
import { ALL_MODELS, MODEL_LABELS, type ModelId, type ParsedResponse, type PromptRow } from "@/types";
import { cn } from "@/lib/utils";
import { api, useData } from "@/lib/client";
import { DOMAIN_TYPE_LABEL, SENTIMENT_LABEL } from "@/lib/labels";
import { Button, Drawer, Field, IconButton, Notice, Select, Textarea } from "@/components/ui";
import { useApp } from "@/components/app/AppContext";

/** Soruyu doğrudan ilgili asistanda açan bağlantılar (destekleyenler için). */
const ASK_URL: Partial<Record<ModelId, (q: string) => string>> = {
  openai: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
  claude: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  perplexity: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
  google_aio: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=tr`,
  gemini: () => "https://gemini.google.com/app",
};

export function PasteDrawer() {
  const { paste, openPaste } = useApp();
  return (
    <Drawer open={!!paste} onClose={() => openPaste(null)} label="Cevap yapıştır">
      {paste && <PasteForm initialPromptId={paste.promptId} initialModel={paste.model} onClose={() => openPaste(null)} />}
    </Drawer>
  );
}

function PasteForm({
  initialPromptId,
  initialModel,
  onClose,
}: {
  initialPromptId?: string;
  initialModel?: ModelId;
  onClose: () => void;
}) {
  const { brand, refresh, ai } = useApp();
  const { data } = useData<{ prompts: PromptRow[] }>("/api/prompts?days=3650");
  const prompts = useMemo(() => (data?.prompts ?? []).filter((p) => p.is_active), [data]);

  // Yerel model ayarlı değilse listede gösterme
  const localOn = ai?.models.find((m) => m.model === "local")?.auto ?? false;
  const models = ALL_MODELS.filter((m) => m !== "local" || localOn || brand.selected_models.includes("local"));
  const ordered = [...models.filter((m) => brand.selected_models.includes(m)), ...models.filter((m) => !brand.selected_models.includes(m))];

  const [promptId, setPromptId] = useState(initialPromptId ?? "");
  const [model, setModel] = useState<ModelId>(initialModel ?? brand.selected_models[0] ?? "openai");
  const [response, setResponse] = useState("");
  const [sources, setSources] = useState("");
  const [parsed, setParsed] = useState<ParsedResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!promptId && prompts.length) setPromptId(prompts[0].id);
  }, [prompts, promptId]);

  const prompt = prompts.find((p) => p.id === promptId);
  const sourceList = useMemo(
    () =>
      sources
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s)),
    [sources]
  );

  // Yazdıkça analiz önizlemesi (kaydetmeden)
  useEffect(() => {
    if (response.trim().length < 20) {
      setParsed(null);
      return;
    }
    const t = setTimeout(() => {
      api<{ parsed: ParsedResponse }>("/api/runs/manual", {
        method: "POST",
        body: { analyzeOnly: true, response, sources: sourceList },
      })
        .then((d) => setParsed(d.parsed))
        .catch(() => setParsed(null));
    }, 450);
    return () => clearTimeout(t);
  }, [response, sourceList]);

  async function copyQuestion() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* pano izni yok */
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!promptId) return setError("Bir soru seçin.");
    if (response.trim().length < 20) return setError("Cevabın tamamını yapıştırın (en az 20 karakter).");
    setSaving(true);
    setError(null);
    try {
      await api("/api/runs/manual", {
        method: "POST",
        body: { promptId, model, queryText: prompt?.text ?? "", response, sources: sourceList },
      });
      refresh();
      setSaved(`${MODEL_LABELS[model]} cevabı kaydedildi.`);
      setResponse("");
      setSources("");
      setParsed(null);
      // Aynı soru için sıradaki asistana geç
      const i = ordered.indexOf(model);
      if (i >= 0 && i < ordered.length - 1) setModel(ordered[i + 1]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const askUrl = prompt ? ASK_URL[model]?.(prompt.text) : undefined;

  return (
    <form onSubmit={save} className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-line px-6 pt-5 pb-4">
        <div>
          <h2 className="font-serif text-[24px] font-medium">Cevap yapıştır</h2>
          <p className="mt-1 max-w-[56ch] text-[14px] text-ink-2">
            Soruyu asistana kendiniz sorun, cevabın tamamını buraya yapıştırın. API anahtarı gerekmez.
          </p>
        </div>
        <IconButton label="Kapat" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {saved && (
          <Notice tone="good" onClose={() => setSaved(null)}>
            {saved} Aynı soru için sıradaki asistanın cevabını yapıştırabilirsiniz.
          </Notice>
        )}

        {data && prompts.length === 0 ? (
          <Notice>Aktif soru yok. Önce Sorular sayfasından soru ekleyin.</Notice>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Soru" htmlFor="paste-prompt">
              <Select id="paste-prompt" value={promptId} onChange={(e) => setPromptId(e.target.value)}>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.text}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Asistan" htmlFor="paste-model">
              <Select id="paste-model" value={model} onChange={(e) => setModel(e.target.value as ModelId)}>
                {ordered.map((m) => (
                  <option key={m} value={m}>
                    {MODEL_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {prompt && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-sunken px-3 py-2.5 text-[14px]">
            <span className="min-w-0 flex-1 text-ink-2">“{prompt.text}”</span>
            <Button size="sm" variant="ghost" icon={copied ? <Check size={15} /> : <Copy size={15} />} onClick={copyQuestion}>
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
            {askUrl && (
              <a
                href={askUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-2 hover:bg-line hover:text-ink"
              >
                <ArrowSquareOut size={15} /> {MODEL_LABELS[model]}&apos;de aç
              </a>
            )}
          </div>
        )}

        <Field
          label="Asistanın cevabı"
          htmlFor="paste-response"
          hint="Cevabın tamamını yapıştırın; kısaltmayın. Sıralama ve rakipler metinden okunur."
        >
          <Textarea
            id="paste-response"
            value={response}
            onChange={(e) => {
              setResponse(e.target.value);
              setSaved(null);
            }}
            rows={10}
            placeholder="Cevabı buraya yapıştırın…"
          />
        </Field>

        <Field
          label="Kaynak bağlantıları (isteğe bağlı)"
          htmlFor="paste-sources"
          hint="Asistan cevabın altında kaynak listesi gösterdiyse bağlantıları buraya yapıştırın; her satıra bir tane."
        >
          <Textarea
            id="paste-sources"
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            rows={3}
            placeholder={"https://…\nhttps://…"}
          />
        </Field>

        {parsed && <Preview parsed={parsed} brandName={brand.name} />}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        {error ? (
          <p className="text-[13px] text-bad" role="alert">
            {error}
          </p>
        ) : (
          <span className="text-[13px] text-ink-3">{parsed ? "Önizleme hazır." : ""}</span>
        )}
        <Button type="submit" variant="primary" loading={saving} disabled={!promptId || response.trim().length < 20}>
          Kaydet
        </Button>
      </div>
    </form>
  );
}

function Preview({ parsed, brandName }: { parsed: ParsedResponse; brandName: string }) {
  const rivals = Object.entries(parsed.competitorMentions)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return (
    <section className="rounded-lg border border-line bg-surface p-4" aria-live="polite">
      <h3 className="text-[13px] font-medium text-ink-3">Kaydedilecek sonuç</h3>
      <p className="mt-1.5 text-[15px]">
        {parsed.mentioned ? (
          <>
            <span className="font-medium text-good">{brandName} önerilmiş</span>
            {parsed.positionScore && <> · {parsed.positionScore}. sırada</>} · {SENTIMENT_LABEL[parsed.sentiment]} ton ·{" "}
            {parsed.mentionCount} kez geçiyor
          </>
        ) : (
          <span className="font-medium text-bad">{brandName} bu cevapta geçmiyor</span>
        )}
      </p>
      <p className={cn("mt-1 text-[14px]", rivals.length ? "text-ink-2" : "text-ink-3")}>
        {rivals.length ? `Geçen rakipler: ${rivals.join(", ")}` : "İzlediğiniz rakiplerden hiçbiri geçmiyor."}
      </p>
      {parsed.citations.length > 0 && (
        <p className="mt-1 text-[14px] text-ink-2">
          Kaynaklar: {parsed.citations.map((c) => `${c.domain} (${DOMAIN_TYPE_LABEL[c.domainType].toLocaleLowerCase("tr")})`).join(", ")}
        </p>
      )}
    </section>
  );
}
