"use client";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { CircleNotch, Info, WarningCircle, X, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Düğmeler
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-2 active:translate-y-px disabled:bg-ink-4",
  secondary:
    "bg-surface text-ink border border-line-strong hover:border-ink-3 hover:bg-white active:translate-y-px disabled:text-ink-4 disabled:border-line",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-4",
  danger: "bg-surface text-bad border border-bad/40 hover:bg-bad-soft active:translate-y-px disabled:opacity-50",
  link: "text-ink underline decoration-ink-4 underline-offset-[3px] hover:decoration-ink disabled:text-ink-4 px-0! h-auto!",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    >
      {loading ? <CircleNotch className="spin" size={size === "sm" ? 14 : 16} aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form alanları
// ---------------------------------------------------------------------------

const FIELD =
  "w-full rounded-md border border-line-strong bg-surface text-ink placeholder:text-ink-3 transition-colors hover:border-ink-4 focus:border-ink focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-bad disabled:bg-sunken disabled:text-ink-3";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(FIELD, "h-10 px-3 text-[14px]", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD, "px-3 py-2.5 text-[14px] leading-relaxed", className)} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref
) {
  return <select ref={ref} className={cn(FIELD, "h-10 pr-8 pl-3 text-[14px]", className)} {...props} />;
});

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[13px] text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etiketler, bildirimler, durumlar
// ---------------------------------------------------------------------------

type Tone = "neutral" | "good" | "bad" | "warn" | "accent";

const TONE: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent",
};

export function Tag({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-px text-[12px] font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({
  tone = "neutral",
  title,
  children,
  action,
  onClose,
  className,
}: {
  tone?: "neutral" | "good" | "bad" | "warn";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  const Icon = tone === "bad" ? WarningCircle : tone === "good" ? CheckCircle : tone === "warn" ? WarningCircle : Info;
  const color = { neutral: "text-ink-3", good: "text-good", bad: "text-bad", warn: "text-warn" }[tone];
  const bg = { neutral: "bg-surface border-line", good: "bg-good-soft/60 border-good/25", bad: "bg-bad-soft/60 border-bad/25", warn: "bg-warn-soft/70 border-warn/25" }[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", bg, className)} role={tone === "bad" ? "alert" : "status"}>
      <Icon size={18} weight="fill" className={cn("mt-0.5 shrink-0", color)} aria-hidden />
      <div className="min-w-0 flex-1 text-[14px]">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className={cn("text-ink-2", title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
      {onClose && (
        <IconButton label="Kapat" onClick={onClose} className="-my-1 -mr-2 h-7 w-7">
          <X size={14} />
        </IconButton>
      )}
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <CircleNotch size={size} className={cn("spin text-ink-3", className)} aria-label="Yükleniyor" />;
}

/** İçeriğin şekline benzeyen yükleme iskeleti. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-sunken", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-9 w-2/3 max-w-xl" />
      <Skeleton className="h-5 w-full max-w-2xl" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice
      tone="bad"
      title="Veriler yüklenemedi"
      action={
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            Tekrar dene
          </Button>
        )
      }
    >
      {message}
    </Notice>
  );
}

// ---------------------------------------------------------------------------
// Sayfa düzeni yardımcıları
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[32px] leading-[1.15] font-medium tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  aside,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-line pt-6", className)} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id={id ? `${id}-h` : undefined} className="font-serif text-[21px] font-medium tracking-[-0.005em] text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 max-w-[66ch] text-[14px] text-ink-3">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Yan panel
// ---------------------------------------------------------------------------

/** Ekranın sağından açılan panel. Esc ve arka plana tıklama ile kapanır, odak içeride kalır. */
export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && <div className="flex h-full flex-col">{children}</div>}
    </dialog>
  );
}

/** Seçeneklerden birini seçtiren yatay düğme grubu. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-[4px] px-2.5 text-[13px] transition-colors",
              active ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Geri alınamaz işlemler için iki adımlı onay: önce düğme, sonra "Emin misiniz?" */
export function ConfirmButton({
  children,
  confirmLabel = "Evet, sil",
  question = "Emin misiniz?",
  onConfirm,
  icon,
  size = "sm",
}: {
  children: ReactNode;
  confirmLabel?: string;
  question?: string;
  onConfirm: () => void | Promise<unknown>;
  icon?: ReactNode;
  size?: Size;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <Button size={size} variant="ghost" icon={icon} onClick={() => setAsking(true)}>
        {children}
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-2" role="group">
      {question}
      <Button
        size={size}
        variant="danger"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button size={size} variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
        Vazgeç
      </Button>
    </span>
  );
}
