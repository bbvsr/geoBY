"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Giriş yapılamadı.");
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <Field label="Parola" htmlFor="pw" error={error}>
        <Input id="pw" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
      </Field>
      <Button type="submit" variant="primary" loading={busy} disabled={!password}>
        Giriş yap
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-[400px] px-5 pt-24">
      <p className="font-serif text-[22px] font-semibold tracking-[-0.02em]">GeoBY</p>
      <h1 className="mt-8 font-serif text-[30px] leading-tight font-medium">Giriş</h1>
      <p className="mt-2 text-[15px] text-ink-2">Bu kurulum parola ile korunuyor.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
