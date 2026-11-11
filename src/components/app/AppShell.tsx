"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Play, ClipboardText } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button, Notice } from "@/components/ui";
import { useApp } from "./AppContext";
import { PromptDrawer } from "@/components/prompts/PromptDrawer";
import { PasteDrawer } from "@/components/prompts/PasteDrawer";

const NAV = [
  { href: "/", label: "Özet" },
  { href: "/sorular", label: "Sorular" },
  { href: "/kaynaklar", label: "Kaynaklar" },
  { href: "/ayarlar", label: "Ayarlar" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { brand, autoModels, ai, run, runAll, openPaste } = useApp();
  const canAuto = autoModels.length > 0;

  return (
    <div className="min-h-dvh">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        İçeriğe geç
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur-[6px]">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-5 md:px-8">
          <Link href="/" className="flex items-baseline gap-2.5" aria-label="GeoBY ana sayfa">
            <span className="font-serif text-[22px] leading-none font-semibold tracking-[-0.02em]">GeoBY</span>
            <span className="hidden max-w-[220px] truncate text-[13px] text-ink-3 sm:inline">{brand.name}</span>
          </Link>

          <nav aria-label="Ana menü" className="hidden h-full items-stretch gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.href} href={n.href} active={isActive(pathname, n.href)}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<ClipboardText size={16} />}
              onClick={() => openPaste({})}
              className="hidden sm:inline-flex"
            >
              Cevap yapıştır
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Play size={14} weight="fill" />}
              onClick={runAll}
              disabled={!ai || !canAuto || !!run?.running}
              title={
                canAuto
                  ? "Aktif soruları otomatik bağlantısı olan asistanlara sorar"
                  : "Otomatik test için Ayarlar'dan ücretsiz bir anahtar ekleyin"
              }
            >
              Testleri çalıştır
            </Button>
          </div>
        </div>

        <nav aria-label="Ana menü" className="mx-auto flex max-w-[1180px] gap-1 overflow-x-auto px-3 pb-1 md:hidden">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} active={isActive(pathname, n.href)} compact>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="icerik" className="mx-auto max-w-[1180px] px-5 pt-8 pb-24 md:px-8 md:pt-10">
        {ai && !canAuto && <AutoOffHint />}
        {run && <RunStatus />}
        {children}
      </main>

      <PromptDrawer />
      <PasteDrawer />
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({ href, active, compact, children }: { href: string; active: boolean; compact?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center px-3 text-[14px] transition-colors",
        compact ? "h-9 shrink-0 rounded-md" : "h-full",
        active ? "text-ink" : "text-ink-3 hover:text-ink",
        active && !compact && "after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-ink",
        active && compact && "bg-sunken"
      )}
    >
      {children}
    </Link>
  );
}

function AutoOffHint() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <Notice
      className="mb-8"
      title="Otomatik test kapalı"
      onClose={() => setHidden(true)}
      action={
        <Link href="/ayarlar#baglantilar" className="text-[14px] font-medium text-ink underline underline-offset-[3px]">
          Nasıl açılır?
        </Link>
      }
    >
      Cevapları şimdilik elle yapıştırarak ölçebilirsiniz. Ücretsiz bir Groq veya Gemini anahtarı eklerseniz GeoBY
      soruları asistanlara kendisi sorar.
    </Notice>
  );
}

function RunStatus() {
  const { run, cancelRun, dismissRun } = useApp();
  const [showErrors, setShowErrors] = useState(false);
  if (!run) return null;

  if (run.running) {
    const pctDone = run.total ? (run.done / run.total) * 100 : 0;
    return (
      <div className="mb-8 rounded-lg border border-line bg-surface px-4 py-3" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-[14px]">
          <span className="font-medium tnum">
            Soru {Math.min(run.done + 1, run.total)} / {run.total}
          </span>
          <span className="min-w-0 flex-1 truncate text-ink-3">“{run.current}”</span>
          <Button size="sm" variant="ghost" onClick={cancelRun}>
            Durdur
          </Button>
        </div>
        <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-sunken">
          <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${pctDone}%` }} />
        </div>
      </div>
    );
  }

  const failedAll = run.answers === 0 && run.errors.length > 0;
  return (
    <Notice
      className="mb-8"
      tone={failedAll ? "bad" : run.errors.length ? "warn" : "good"}
      onClose={dismissRun}
      title={
        run.total === 0
          ? run.errors[0]
          : failedAll
            ? "Test yapılamadı"
            : `${run.cancelled ? "Durduruldu" : "Test bitti"}: ${run.answers} cevap alındı, markanız ${run.mentioned} cevapta geçiyor.`
      }
    >
      {run.total > 0 && run.errors.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowErrors((s) => !s)}
            className="underline underline-offset-[3px]"
            aria-expanded={showErrors}
          >
            {run.errors.length} hata {showErrors ? "gizle" : "göster"}
          </button>
          {showErrors && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[13px]">
              {[...new Set(run.errors)].map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </Notice>
  );
}
