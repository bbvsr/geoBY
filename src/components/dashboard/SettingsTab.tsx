"use client";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  FileText,
  KeyRound,
  Lock,
  Upload,
  Loader2,
} from "lucide-react";
import {
  ALL_MODELS,
  MODEL_COLORS,
  MODEL_LABELS,
  type Brand,
  type BrandDocument,
  type ModelId,
  type Schedule,
} from "@/types";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

export function SettingsTab({
  brand,
  onChange,
}: {
  brand: Brand;
  onChange: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ayarlar</h1>
        <p className="text-[13px] text-muted-foreground">
          Modeller, alarmlar, belgeler ve entegrasyonlar.
        </p>
      </div>
      <ModelSelection brand={brand} onChange={onChange} />
      <AlarmSettings brand={brand} onChange={onChange} />
      <Documents />
      <ApiSection />
    </div>
  );
}

function ModelSelection({
  brand,
  onChange,
}: {
  brand: Brand;
  onChange: () => void;
}) {
  const [models, setModels] = useState<ModelId[]>(
    brand.selected_models ?? [...ALL_MODELS]
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggle(m: ModelId) {
    setModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch("/api/models", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ models }),
    });
    setSaving(false);
    setSaved(true);
    onChange();
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <CardTitle>Test Edilecek Modeller</CardTitle>
        <Button size="sm" onClick={save} disabled={saving}>
          {saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {saved ? "Kaydedildi" : "Kaydet"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_MODELS.map((m) => {
          const active = models.includes(m);
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
    </Card>
  );
}

function AlarmSettings({
  brand,
  onChange,
}: {
  brand: Brand;
  onChange: () => void;
}) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((d) => {
        if (d.schedule) {
          setSchedule(d.schedule);
          setFrequency(d.schedule.frequency);
          setActive(d.schedule.is_active);
        }
      });
  }, []);

  async function save(nextActive: boolean, nextFreq: "weekly" | "monthly") {
    setSaving(true);
    const res = await fetch("/api/schedules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency: nextFreq, isActive: nextActive }),
    });
    const d = await res.json();
    setSchedule(d.schedule);
    setSaving(false);
    onChange();
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <CardTitle>Yeniden Test Alarmı</CardTitle>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Belirlenen aralıkta soru setinizi tekrar test etmeniz için hatırlatma
        oluşturur. (Manuel modda otomatik sorgu yapılmaz; size hatırlatılır.)
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md bg-white/[0.04] p-0.5">
          {(["weekly", "monthly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFrequency(f);
                if (active) save(true, f);
              }}
              className={cn(
                "rounded px-3 py-1 text-[12px] transition-colors",
                frequency === f
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {f === "weekly" ? "Haftalık" : "Aylık"}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const next = !active;
            setActive(next);
            save(next, frequency);
          }}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-colors",
            active
              ? "bg-success/15 text-success"
              : "bg-white/[0.04] text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              active ? "bg-success" : "bg-muted-foreground"
            )}
          />
          {active ? "Alarm aktif" : "Alarm kapalı"}
        </button>
        {schedule?.next_due_at && active && (
          <span className="text-[12px] text-muted-foreground">
            Sonraki: {formatDateTime(schedule.next_due_at)}
          </span>
        )}
      </div>
    </Card>
  );
}

function Documents() {
  const [docs, setDocs] = useState<BrandDocument[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch("/api/documents");
    const d = await res.json();
    setDocs(d.documents ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/documents", { method: "POST", body: form });
    setUploading(false);
    load();
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle>Belgeler</CardTitle>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-[12px] hover:bg-white/[0.04]">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Belge Yükle
          <input type="file" className="hidden" onChange={upload} />
        </label>
      </div>
      {docs.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/60">
          Henüz belge yüklenmedi. Marka bilgisi içeren PDF/doküman
          yükleyebilirsiniz.
        </p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md border border-border/30 bg-background/40 px-3 py-2 text-[12px]"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground/50" />
                {d.name}
              </span>
              <span className="text-[11px] text-muted-foreground/50">
                {formatDateTime(d.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ApiSection() {
  return (
    <Card className="opacity-90">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <CardTitle>API Bağlantısı</CardTitle>
        <span className="flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
          <Lock className="h-3 w-3" /> Yakında
        </span>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        İkinci etapta yapay zeka modellerine API key ile bağlanarak testler
        otomatik çalıştırılabilecek. Şimdilik tüm ölçümler{" "}
        <span className="text-foreground">Manuel Test</span> ekranından yürür.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          "OpenAI",
          "Anthropic (Claude)",
          "Gemini",
          "Perplexity",
          "DataForSEO (AI Overview)",
        ].map((name) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-md border border-border/30 bg-background/40 px-3 py-2 text-[12px]"
          >
            <span className="text-muted-foreground">{name}</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <Lock className="h-3 w-3" /> pasif
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
