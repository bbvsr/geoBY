"use client";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  Check,
  Database,
  ExternalLink,
  FileText,

  Loader2,
  Plus,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import {
  ALL_MODELS,
  STANDARD_MODELS,
  MODEL_COLORS,
  MODEL_LABELS,
  type AiStatus,
  type Brand,
  type BrandDocument,
  type Competitor,
  type ModelId,
  type Schedule,
} from "@/types";
import { cn, formatDateTime } from "@/lib/utils";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function SettingsTab({
  brand,
  competitors,
  ai,
  onChange,
}: {
  brand: Brand;
  competitors: Competitor[];
  ai: AiStatus | null;
  onChange: () => void | Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ayarlar</h1>
        <p className="text-[13px] text-muted-foreground">
          Yapay zeka bağlantıları, marka ve rakipler, test edilecek modeller, alarm ve belgeler.
        </p>
      </div>
      <AiConnections ai={ai} />
      <BrandSettings brand={brand} competitors={competitors} onChange={onChange} />
      <ModelSelection brand={brand} ai={ai} onChange={onChange} />
      <AlarmSettings />
      <Documents />
      {ai && <StorageInfo mode={ai.storage} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AiConnections({ ai }: { ai: AiStatus | null }) {
  const [tests, setTests] = useState<Record<string, { loading?: boolean; ok?: boolean; msg?: string }>>({});

  async function test(model: ModelId) {
    setTests((t) => ({ ...t, [model]: { loading: true } }));
    try {
      const r = await api<{ ok: boolean; engine?: string; ms?: number; error?: string }>("/api/ai/test", {
        method: "POST",
        body: { model },
      });
      setTests((t) => ({
        ...t,
        [model]: r.ok
          ? { ok: true, msg: `Çalışıyor · ${((r.ms ?? 0) / 1000).toFixed(1)} sn` }
          : { ok: false, msg: r.error },
      }));
    } catch (e) {
      setTests((t) => ({ ...t, [model]: { ok: false, msg: (e as Error).message } }));
    }
  }

  if (!ai) {
    return (
      <Card>
        <CardTitle>Yapay Zeka Bağlantıları</CardTitle>
        <p className="mt-2 text-[12px] text-muted-foreground">Durum yükleniyor…</p>
      </Card>
    );
  }

  const free = ai.providers.filter((p) => p.free);
  const paid = ai.providers.filter((p) => !p.free);

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <CardTitle>Yapay Zeka Bağlantıları</CardTitle>
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">
        Otomatik testte GeoBY sorularınızı yapay zekaya kendisi sorar. Anahtarlar sadece sunucuda,{" "}
        <code className="rounded bg-white/[0.06] px-1">.env.local</code> dosyasında durur. Anahtar
        ekledikten sonra uygulamayı yeniden başlatın.
      </p>

      {/* Model durumu */}
      <div className="mb-5 space-y-1.5">
        {ai.models.map((m) => {
          const t = tests[m.model];
          return (
            <div
              key={m.model}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/30 bg-background/40 px-3 py-2 text-[12px]"
            >
              <span className="flex w-28 items-center gap-2 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[m.model] }} />
                {MODEL_LABELS[m.model]}
              </span>
              {m.auto ? (
                <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">Otomatik</span>
              ) : (
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Manuel
                </span>
              )}
              <span className="min-w-0 flex-1 text-muted-foreground">
                {m.auto && m.engine
                  ? `${m.engine.providerLabel}${m.engine.model ? ` · ${m.engine.model}` : ""}${m.engine.note ? ` — ${m.engine.note}` : ""}`
                  : m.unlockWith.length
                    ? `Açmak için: ${m.unlockWith.join(" veya ")}`
                    : "Ücretsiz API yok — Manuel Test ile ölçülür"}
              </span>
              {t?.msg && (
                <span className={cn("text-[11px]", t.ok ? "text-success" : "text-destructive")}>{t.msg}</span>
              )}
              {m.auto && (
                <Button size="sm" variant="outline" onClick={() => test(m.model)} disabled={t?.loading}>
                  {t?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Test et
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <ProviderList title="Ücretsiz anahtarlar (önerilen)" providers={free} />
      <div className="h-3" />
      <ProviderList title="Ücretli (isteğe bağlı)" providers={paid} />

      <div className="mt-4 rounded-md bg-white/[0.02] p-3 text-[12px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Nasıl eklenir?</span> Proje klasöründeki{" "}
        <code className="rounded bg-white/[0.06] px-1">.env.local</code> dosyasına örneğin{" "}
        <code className="rounded bg-white/[0.06] px-1">GEMINI_API_KEY=anahtarınız</code> satırını ekleyin
        ve <code className="rounded bg-white/[0.06] px-1">npm run dev</code> komutunu yeniden çalıştırın.
        {ai.assistant ? (
          <> Kurulum analizi ve öneriler şu an <span className="text-foreground">{ai.assistant}</span> ile yapılıyor.</>
        ) : null}
      </div>
    </Card>
  );
}

function ProviderList({ title, providers }: { title: string; providers: AiStatus["providers"] }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50">{title}</div>
      <div className="grid gap-1.5 md:grid-cols-2">
        {providers.map((p) => (
          <div key={p.id} className="rounded-md border border-border/30 bg-background/40 px-3 py-2 text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{p.label}</span>
              {p.configured ? (
                <span className="flex items-center gap-1 text-[10px] text-success">
                  <Check className="h-3 w-3" /> {p.envKey ? "anahtar var" : "aktif"}
                </span>
              ) : (
                <a
                  href={p.signupUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  Anahtar al <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{p.note}</p>
            {p.envKey && (
              <code className="mt-1 inline-block rounded bg-white/[0.04] px-1 text-[10px] text-muted-foreground">
                {p.envKey}
              </code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BrandSettings({
  brand,
  competitors,
  onChange,
}: {
  brand: Brand;
  competitors: Competitor[];
  onChange: () => void | Promise<void>;
}) {
  const [name, setName] = useState(brand.name);
  const [domain, setDomain] = useState(brand.domain);
  const [category, setCategory] = useState(brand.category ?? "");
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMsg, setBrandMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newComp, setNewComp] = useState({ name: "", domain: "" });
  const [compError, setCompError] = useState("");
  const [busy, setBusy] = useState(false);

  const dirty = name !== brand.name || domain !== brand.domain || category !== (brand.category ?? "");

  async function saveBrand() {
    setSavingBrand(true);
    setBrandMsg(null);
    try {
      await api("/api/brand", {
        method: "PATCH",
        body: { name, domain, category, description: brand.description ?? "" },
      });
      setBrandMsg({ ok: true, text: "Kaydedildi. Yeni testler bu bilgilerle analiz edilir." });
      await onChange();
    } catch (e) {
      setBrandMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSavingBrand(false);
    }
  }

  async function addCompetitor() {
    if (!newComp.name.trim()) return;
    setBusy(true);
    setCompError("");
    try {
      await api("/api/competitors", { method: "POST", body: newComp });
      setNewComp({ name: "", domain: "" });
      await onChange();
    } catch (e) {
      setCompError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCompetitor(c: Competitor) {
    if (!window.confirm(`"${c.name}" rakip listesinden çıkarılsın mı?`)) return;
    setBusy(true);
    setCompError("");
    try {
      await api("/api/competitors", { method: "DELETE", body: { id: c.id } });
      await onChange();
    } catch (e) {
      setCompError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <CardTitle>Marka ve Rakipler</CardTitle>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <LabeledInput label="Marka adı (cevaplarda aranır)" value={name} onChange={setName} />
        <LabeledInput label="Alan adı" value={domain} onChange={setDomain} placeholder="markaniz.com" />
        <LabeledInput label="Kategori" value={category} onChange={setCategory} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={saveBrand} disabled={!dirty || savingBrand}>
          {savingBrand && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Kaydet
        </Button>
        {brandMsg && (
          <span className={cn("text-[12px]", brandMsg.ok ? "text-success" : "text-destructive")}>{brandMsg.text}</span>
        )}
      </div>

      <div className="mt-5 mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50">
        Rakipler ({competitors.length})
      </div>
      <div className="space-y-1.5">
        {competitors.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border border-border/30 bg-background/40 px-3 py-1.5 text-[12px]"
          >
            <span>
              {c.name}
              {c.domain && <span className="ml-2 text-muted-foreground">{c.domain}</span>}
            </span>
            <button
              onClick={() => removeCompetitor(c)}
              disabled={busy}
              aria-label={`${c.name} sil`}
              className="text-muted-foreground/50 hover:text-destructive disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Rakip adı"
            value={newComp.name}
            onChange={(e) => setNewComp({ ...newComp, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addCompetitor()}
          />
          <Input
            placeholder="rakip.com (isteğe bağlı)"
            value={newComp.domain}
            onChange={(e) => setNewComp({ ...newComp, domain: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addCompetitor()}
          />
          <Button variant="outline" onClick={addCompetitor} disabled={busy || !newComp.name.trim()}>
            <Plus className="h-4 w-4" /> Ekle
          </Button>
        </div>
        {compError && <p className="text-[12px] text-destructive">{compError}</p>}
        <p className="text-[11px] text-muted-foreground/60">
          Yeni eklenen rakip, eklendikten sonra yapılan testlerde ölçülür.
        </p>
      </div>
    </Card>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ---------------------------------------------------------------------------

function ModelSelection({
  brand,
  ai,
  onChange,
}: {
  brand: Brand;
  ai: AiStatus | null;
  onChange: () => void | Promise<void>;
}) {
  const [models, setModels] = useState<ModelId[]>(brand.selected_models ?? [...STANDARD_MODELS]);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  function toggle(m: ModelId) {
    setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    setState("idle");
  }

  async function save() {
    setState("saving");
    setError("");
    try {
      await api("/api/models", { method: "PUT", body: { models } });
      setState("saved");
      await onChange();
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>Test Edilecek Modeller</CardTitle>
        <Button size="sm" onClick={save} disabled={state === "saving" || models.length === 0}>
          {state === "saved" ? (
            <Check className="h-3.5 w-3.5" />
          ) : state === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {state === "saved" ? "Kaydedildi" : "Kaydet"}
        </Button>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        &quot;Tüm Soruları Test Et&quot; seçili ve otomatik bağlantısı olan modellerde çalışır.
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_MODELS.map((m) => {
          const active = models.includes(m);
          const auto = ai?.models.find((x) => x.model === m)?.auto;
          return (
            <button
              key={m}
              onClick={() => toggle(m)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/50 text-muted-foreground hover:bg-white/[0.03]"
              )}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: MODEL_COLORS[m], opacity: active ? 1 : 0.4 }}
              />
              {MODEL_LABELS[m]}
              <span className="text-[10px] text-muted-foreground">{auto ? "oto" : "manuel"}</span>
            </button>
          );
        })}
      </div>
      {models.length === 0 && <p className="mt-2 text-[12px] text-warning">En az bir model seçin.</p>}
      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function AlarmSettings() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ schedule: Schedule | null }>("/api/schedules")
      .then((d) => {
        if (d.schedule) {
          setSchedule(d.schedule);
          setFrequency(d.schedule.frequency);
          setActive(d.schedule.is_active);
        }
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function save(nextActive: boolean, nextFreq: "weekly" | "monthly") {
    setSaving(true);
    setError("");
    try {
      const d = await api<{ schedule: Schedule }>("/api/schedules", {
        method: "PUT",
        body: { frequency: nextFreq, isActive: nextActive },
      });
      setSchedule(d.schedule);
      setActive(d.schedule.is_active);
      setFrequency(d.schedule.frequency);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <CardTitle>Yeniden Test Hatırlatıcısı</CardTitle>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Yapay zeka cevapları zamanla değişir. Seçtiğiniz aralıkta Genel Bakış&apos;ta &quot;test
        zamanı&quot; uyarısı gösterilir; test yaptığınızda sayaç sıfırlanır.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md bg-white/[0.04] p-0.5">
          {(["weekly", "monthly"] as const).map((f) => (
            <button
              key={f}
              disabled={saving}
              onClick={() => {
                setFrequency(f);
                if (active) save(true, f);
              }}
              className={cn(
                "rounded px-3 py-1 text-[12px] transition-colors",
                frequency === f ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
              )}
            >
              {f === "weekly" ? "Haftalık" : "Aylık"}
            </button>
          ))}
        </div>
        <button
          onClick={() => save(!active, frequency)}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-colors",
            active ? "bg-success/15 text-success" : "bg-white/[0.04] text-muted-foreground"
          )}
        >
          <span className={cn("inline-block h-2 w-2 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />
          {active ? "Hatırlatıcı açık" : "Hatırlatıcı kapalı"}
        </button>
        {schedule?.next_due_at && active && (
          <span className="text-[12px] text-muted-foreground">Sonraki: {formatDateTime(schedule.next_due_at)}</span>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Documents() {
  const [docs, setDocs] = useState<BrandDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function load() {
    api<{ documents: BrandDocument[] }>("/api/documents")
      .then((d) => setDocs(d.documents))
      .catch((e: Error) => setError(e.message));
  }
  useEffect(load, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api("/api/documents", { method: "POST", body: form });
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle>Belgeler</CardTitle>
        </div>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-[12px] hover:bg-white/[0.04]",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Belge Yükle
          <input type="file" className="hidden" onChange={upload} disabled={uploading} />
        </label>
      </div>
      {error && <p className="mb-2 text-[12px] text-destructive">{error}</p>}
      {docs.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/60">
          Marka sunumu, ürün kataloğu gibi belgeleri arşivlemek için yükleyebilirsiniz (en fazla 10 MB).
        </p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md border border-border/30 bg-background/40 px-3 py-2 text-[12px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground/50">{formatDateTime(d.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StorageInfo({ mode }: { mode: "supabase" | "local" }) {
  return (
    <Card className="py-3.5">
      <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
        <Database className="mt-0.5 h-4 w-4 shrink-0" />
        {mode === "local" ? (
          <span>
            Veriler bu bilgisayarda <code className="rounded bg-white/[0.06] px-1">.data/geoby.json</code>{" "}
            dosyasında saklanıyor. Sunucuya kurmak veya ekiple paylaşmak için{" "}
            <code className="rounded bg-white/[0.06] px-1">.env.local</code> dosyasına Supabase bilgilerini
            ekleyin.
          </span>
        ) : (
          <span>Veriler Supabase veritabanınızda saklanıyor.</span>
        )}
      </div>
    </Card>
  );
}
