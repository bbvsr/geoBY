"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowSquareOut, Check, Copy, DownloadSimple, Plus, Trash } from "@phosphor-icons/react";
import { ALL_MODELS, MODEL_LABELS, type ModelId, type Schedule } from "@/types";
import { cn, dateTime } from "@/lib/utils";
import { api } from "@/lib/client";
import { Button, ConfirmButton, Field, Input, PageHeader, Segmented, Tag, Textarea } from "@/components/ui";
import { useApp } from "@/components/app/AppContext";

export function SettingsPage() {
  return (
    <div className="space-y-12">
      <PageHeader title="Ayarlar" description="Marka bilgileri, izlenen rakipler ve asistanlar, otomatik test bağlantıları." />
      <Block id="marka" title="Marka" description="Cevaplarda aranan ad ve alan adı. Değiştirirseniz kayıtlı tüm cevaplar yeniden analiz edilir.">
        <BrandForm />
      </Block>
      <Block id="rakipler" title="Rakipler" description="Karşılaştırmak istediğiniz markalar. Ekleme ve silmede geçmiş cevaplar yeniden analiz edilir.">
        <Competitors />
      </Block>
      <Block
        id="baglantilar"
        title="Asistanlar"
        description="Hangi asistanları izlediğiniz ve hangilerinin otomatik test edilebildiği."
      >
        <Assistants />
      </Block>
      <Block id="hatirlatici" title="Düzenli test" description="Asistanların cevapları zamanla değişir; haftalık ölçüm eğilimi gösterir.">
        <Reminder />
      </Block>
      <Block id="veri" title="Veri">
        <DataSection />
      </Block>
    </div>
  );
}

function Block({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid scroll-mt-24 gap-x-12 gap-y-4 border-t border-line pt-6 md:grid-cols-[240px_1fr]">
      <div>
        <h2 id={`${id}-h`} className="font-serif text-[20px] font-medium">
          {title}
        </h2>
        {description && <p className="mt-1 text-[14px] text-ink-3">{description}</p>}
      </div>
      <div className="min-w-0 max-w-[720px]">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function BrandForm() {
  const { brand, reloadBrand, refresh } = useApp();
  const [form, setForm] = useState({
    name: brand.name,
    domain: brand.domain,
    category: brand.category ?? "",
    description: brand.description ?? "",
  });
  const [state, setState] = useState<{ saving?: boolean; ok?: string; error?: string }>({});
  const dirty =
    form.name !== brand.name ||
    form.domain !== brand.domain ||
    form.category !== (brand.category ?? "") ||
    form.description !== (brand.description ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ saving: true });
    try {
      const r = await api<{ reanalyzed: number }>("/api/brand", { method: "PATCH", body: form });
      await reloadBrand();
      refresh();
      setState({ ok: r.reanalyzed ? `Kaydedildi. ${r.reanalyzed} cevap yeni bilgilere göre yeniden analiz edildi.` : "Kaydedildi." });
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setState({});
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marka adı" htmlFor="b-name" hint="Asistanların yazdığı biçimde (ör. “Kalem Kutu” değil “KalemKutu”).">
          <Input id="b-name" value={form.name} onChange={set("name")} required />
        </Field>
        <Field label="Alan adı" htmlFor="b-domain">
          <Input id="b-domain" value={form.domain} onChange={set("domain")} placeholder="markaniz.com" required />
        </Field>
      </div>
      <Field label="Kategori" htmlFor="b-cat">
        <Input id="b-cat" value={form.category} onChange={set("category")} placeholder="ör. online kırtasiye" />
      </Field>
      <Field label="Kısa açıklama" htmlFor="b-desc">
        <Textarea id="b-desc" value={form.description} onChange={set("description")} rows={2} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" loading={state.saving} disabled={!dirty}>
          Kaydet
        </Button>
        {state.ok && <span className="text-[14px] text-good">{state.ok}</span>}
        {state.error && (
          <span className="text-[14px] text-bad" role="alert">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Competitors() {
  const { competitors, reloadBrand, refresh } = useApp();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/competitors", { method: "POST", body: { name, domain } });
      setName("");
      setDomain("");
      await reloadBrand();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api("/api/competitors", { method: "DELETE", body: { id } });
      await reloadBrand();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      {competitors.length === 0 ? (
        <p className="mb-4 text-[14px] text-ink-3">Henüz rakip yok. En az 2-3 rakip eklemek karşılaştırmayı anlamlı kılar.</p>
      ) : (
        <ul className="mb-4 divide-y divide-line border-y border-line">
          {competitors.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="text-[15px]">{c.name}</span>
                {c.domain && <span className="ml-2 text-[13px] text-ink-3">{c.domain}</span>}
              </span>
              <ConfirmButton icon={<Trash size={15} />} question={`${c.name} çıkarılsın mı?`} confirmLabel="Çıkar" onConfirm={() => remove(c.id)}>
                <span className="sr-only sm:not-sr-only">Çıkar</span>
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="c-name" className="sr-only">
          Rakip adı
        </label>
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rakip adı" />
        <label htmlFor="c-domain" className="sr-only">
          Rakip alan adı
        </label>
        <Input id="c-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="rakip.com (biliyorsanız)" />
        <Button type="submit" icon={<Plus size={15} />} loading={busy} disabled={!name.trim()}>
          Ekle
        </Button>
      </form>
      {error && (
        <p className="mt-2 text-[13px] text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Assistants() {
  const { brand, ai, reloadBrand, refresh } = useApp();
  const [selected, setSelected] = useState<ModelId[]>(brand.selected_models);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Partial<Record<ModelId, { loading?: boolean; ok?: boolean; msg?: string }>>>({});

  useEffect(() => setSelected(brand.selected_models), [brand.selected_models]);

  const localOn = ai?.models.find((m) => m.model === "local")?.auto ?? false;
  const rows = ALL_MODELS.filter((m) => m !== "local" || localOn || selected.includes("local"));
  const dirty = [...selected].sort().join() !== [...brand.selected_models].sort().join();

  async function save() {
    if (selected.length === 0) return setError("En az bir asistan seçin.");
    setSaving(true);
    setError(null);
    try {
      await api("/api/models", { method: "PUT", body: { models: selected } });
      await reloadBrand();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function test(model: ModelId) {
    setTests((t) => ({ ...t, [model]: { loading: true } }));
    try {
      const r = await api<{ ok: boolean; via?: string; ms?: number; error?: string }>("/api/ai/test", {
        method: "POST",
        body: { model },
      });
      setTests((t) => ({
        ...t,
        [model]: r.ok ? { ok: true, msg: `Çalışıyor: ${r.via} · ${((r.ms ?? 0) / 1000).toFixed(1).replace(".", ",")} sn` } : { ok: false, msg: r.error },
      }));
    } catch (err) {
      setTests((t) => ({ ...t, [model]: { ok: false, msg: (err as Error).message } }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="divide-y divide-line border-y border-line">
        {rows.map((m) => {
          const st = ai?.models.find((x) => x.model === m);
          const t = tests[m];
          const checked = selected.includes(m);
          return (
            <div key={m} className="py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="flex min-w-[150px] cursor-pointer items-center gap-2.5 text-[15px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelected(checked ? selected.filter((x) => x !== m) : [...selected, m])}
                    className="h-4 w-4 accent-[var(--color-ink)]"
                  />
                  {MODEL_LABELS[m]}
                </label>
                {!ai ? (
                  <span className="text-[13px] text-ink-4">…</span>
                ) : st?.auto ? (
                  <Tag tone="good">otomatik</Tag>
                ) : (
                  <Tag>elle yapıştırılır</Tag>
                )}
                {st?.auto && (
                  <Button size="sm" variant="ghost" className="ml-auto" loading={t?.loading} onClick={() => test(m)}>
                    Bağlantıyı dene
                  </Button>
                )}
              </div>
              <p className="mt-1 pl-[26px] text-[13px] text-ink-3">
                {st?.auto && st.engine
                  ? `${st.engine.providerLabel}${st.engine.model ? ` · ${st.engine.model}` : ""}${st.engine.note ? ` — ${st.engine.note}` : ""}`
                  : st && st.unlockWith.length
                    ? `Otomatik test için ${st.unlockWith.join(" veya ")} gerekir.`
                    : "Bu asistanın herkese açık bir API'si yok; cevabı Google'da arayıp yapıştırın."}
              </p>
              {t?.msg && (
                <p className={cn("mt-1 pl-[26px] text-[13px]", t.ok ? "text-good" : "text-bad")} role="status">
                  {t.msg}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
          İzlenen asistanları kaydet
        </Button>
        {error && (
          <span className="text-[13px] text-bad" role="alert">
            {error}
          </span>
        )}
      </div>

      <KeyHelp />
    </div>
  );
}

function KeyHelp() {
  const { ai } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  if (!ai) return null;
  const free = ai.providers.filter((p) => p.free && p.id !== "pollinations");
  const paid = ai.providers.filter((p) => !p.free);

  async function copy(line: string) {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(line);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* pano izni yok */
    }
  }

  const Row = ({ p }: { p: (typeof ai.providers)[number] }) => {
    const line = `${p.envKey}=${p.envExample}`;
    return (
      <li className="py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[15px] font-medium">{p.label}</span>
          {p.configured ? <Tag tone="good">ayarlı</Tag> : null}
          {p.signupUrl && !p.configured && (
            <a
              href={p.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-[14px] text-ink underline underline-offset-[3px]"
            >
              Anahtar al <ArrowSquareOut size={14} />
            </a>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-ink-3">{p.note}</p>
        {!p.configured && (
          <button
            type="button"
            onClick={() => copy(line)}
            className="mt-1.5 inline-flex items-center gap-2 rounded-sm bg-sunken px-2 py-1 font-mono text-[12.5px] text-ink-2 hover:bg-line"
            title="Kopyala"
          >
            {line}
            {copied === line ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h3 className="text-[16px] font-medium">Otomatik test nasıl açılır?</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] text-ink-2">
        <li>Aşağıdan ücretsiz bir anahtar alın (Groq ve Gemini birkaç dakika sürer, kart istemez).</li>
        <li>
          Proje klasöründeki <code className="font-mono text-[13px]">.env.local</code> dosyasına satırı ekleyin (dosya
          yoksa <code className="font-mono text-[13px]">.env.example</code> dosyasını kopyalayın).
        </li>
        <li>
          Uygulamayı yeniden başlatın (<code className="font-mono text-[13px]">npm run dev</code>).
        </li>
      </ol>
      <p className="mt-4 text-[13px] font-medium text-ink-3">Ücretsiz</p>
      <ul className="divide-y divide-line">
        {free.map((p) => (
          <Row key={p.id} p={p} />
        ))}
      </ul>
      <p className="mt-4 text-[13px] font-medium text-ink-3">Ücretli (isteğe bağlı)</p>
      <ul className="divide-y divide-line">
        {paid.map((p) => (
          <Row key={p.id} p={p} />
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-ink-3">
        {ai.assistant
          ? `Kurulumdaki site analizi ve öneriler şu an ${ai.assistant} ile yapılıyor.`
          : "Yardımcı yapay zekâ ayarlı değil; kurulumda öneriler basit kurallarla hazırlanır."}{" "}
        Anahtarlar yalnızca sunucuda okunur, tarayıcıya gönderilmez.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Reminder() {
  const { autoModels } = useApp();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ schedule: Schedule | null }>("/api/schedules")
      .then((d) => setSchedule(d.schedule))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  const active = !!schedule?.is_active;
  const frequency = schedule?.frequency ?? "weekly";

  async function save(nextActive: boolean, nextFreq: "weekly" | "monthly") {
    setSaving(true);
    setError(null);
    try {
      const d = await api<{ schedule: Schedule }>("/api/schedules", {
        method: "PUT",
        body: { frequency: nextFreq, isActive: nextActive },
      });
      setSchedule(d.schedule);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-[14px] text-ink-4">…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            checked={active}
            disabled={saving}
            onChange={() => save(!active, frequency)}
            className="h-4 w-4 accent-[var(--color-ink)]"
          />
          Düzenli test
        </label>
        <Segmented
          label="Sıklık"
          value={frequency}
          onChange={(f) => save(active, f)}
          options={[
            { value: "weekly", label: "Haftalık" },
            { value: "monthly", label: "Aylık" },
          ]}
        />
      </div>
      <p className="max-w-[62ch] text-[14px] text-ink-3">
        {autoModels.length > 0
          ? "Zamanı gelince otomatik bağlantısı olan asistanlarda testler kendiliğinden çalışır (uygulama açık olduğu sürece). Elle ölçülen asistanlar için Özet sayfasında uyarı görürsünüz."
          : "Zamanı gelince Özet sayfasında uyarı görürsünüz. Otomatik bağlantı eklerseniz testler kendiliğinden çalışır."}
      </p>
      {active && schedule?.next_due_at && (
        <p className="text-[14px] text-ink-2">
          Sıradaki test: {dateTime(schedule.next_due_at)}. Her test bu tarihi ileri alır.
        </p>
      )}
      {error && (
        <p className="text-[13px] text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function DataSection() {
  const { brand, ai } = useApp();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/brand", { method: "DELETE", body: { confirm } });
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <a
          href="/api/export"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-[14px] font-medium hover:border-ink-3"
        >
          <DownloadSimple size={16} /> Tüm testleri indir (CSV)
        </a>
        <p className="mt-2 text-[13px] text-ink-3">Excel ve Google E-Tablolar ile açılır. Her satır bir cevaptır; cevap metni dahildir.</p>
        {ai && (
          <p className="mt-2 text-[13px] text-ink-3">
            {ai.storage === "local"
              ? "Veriler bu bilgisayarda, proje klasöründeki .data/geoby.json dosyasında saklanıyor. Yedeklemek için bu dosyayı kopyalayın."
              : "Veriler Supabase veritabanınızda saklanıyor."}
          </p>
        )}
      </div>

      <form onSubmit={reset} className="rounded-lg border border-bad/30 p-5">
        <h3 className="text-[16px] font-medium text-bad">Markayı sil ve baştan başla</h3>
        <p className="mt-1 text-[14px] text-ink-2">
          Marka, rakipler, sorular ve tüm test sonuçları kalıcı olarak silinir. Önce CSV olarak indirmeniz önerilir.
        </p>
        <Field label={`Onaylamak için “${brand.name}” yazın`} htmlFor="reset-confirm" className="mt-4 max-w-sm" error={error}>
          <Input id="reset-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
        <Button
          type="submit"
          variant="danger"
          className="mt-3"
          loading={busy}
          disabled={confirm.trim().toLocaleLowerCase("tr") !== brand.name.toLocaleLowerCase("tr")}
        >
          Kalıcı olarak sil
        </Button>
      </form>
    </div>
  );
}
