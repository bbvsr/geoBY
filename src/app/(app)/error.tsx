"use client";
import { useEffect } from "react";
import { Button, Notice } from "@/components/ui";

/** Sayfa içinde beklenmeyen bir hata olursa menü yerinde kalır, yalnızca içerik bu mesajla değişir. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[GeoBY]", error);
  }, [error]);
  return (
    <Notice
      tone="bad"
      title="Bu sayfa gösterilemedi"
      action={
        <Button size="sm" onClick={reset}>
          Tekrar dene
        </Button>
      }
    >
      Beklenmeyen bir hata oluştu. Sorun sürerse sayfayı yenileyin; verileriniz etkilenmedi.
      {error.digest && <span className="mt-1 block text-[12px] text-ink-3">Hata kodu: {error.digest}</span>}
    </Notice>
  );
}
