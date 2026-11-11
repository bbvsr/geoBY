import { readFile } from "fs/promises";
import path from "path";
import type { Metadata } from "next";
import { storageMode } from "@/lib/db";
import { SetupCheck } from "./SetupCheck";

export const metadata: Metadata = { title: "Veritabanı kurulumu" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const sql = await readFile(path.join(process.cwd(), "sql", "schema.sql"), "utf8");
  return (
    <main className="mx-auto max-w-[760px] px-5 pt-14 pb-24">
      <p className="font-serif text-[22px] font-semibold tracking-[-0.02em]">GeoBY</p>
      <h1 className="mt-8 font-serif text-[34px] leading-tight font-medium">Veritabanı kurulumu</h1>
      {storageMode() === "local" ? (
        <p className="mt-3 text-[16px] text-ink-2">
          Uygulama yerel modda çalışıyor; kurulum gerekmez.{" "}
          <a href="/" className="underline underline-offset-[3px]">
            Uygulamaya dön
          </a>
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-[62ch] text-[16px] text-ink-2">
            Supabase bağlantısı var ama tablolar henüz oluşturulmamış. Bir kez yapmanız yeterli:
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[15px] text-ink-2">
            <li>Supabase panelinde projenizi açın, soldan <b className="font-medium text-ink">SQL Editor</b>&apos;e girin.</li>
            <li>Aşağıdaki SQL&apos;i kopyalayıp yapıştırın ve <b className="font-medium text-ink">Run</b>&apos;a basın.</li>
            <li>Buraya dönüp “Tabloları kontrol et”e tıklayın.</li>
          </ol>
          <SetupCheck sql={sql} />
          <p className="mt-6 text-[14px] text-ink-3">
            Supabase kullanmak istemiyor musunuz? <code className="font-mono text-[13px]">.env.local</code> dosyasından{" "}
            <code className="font-mono text-[13px]">SUPABASE_URL</code> ve{" "}
            <code className="font-mono text-[13px]">SUPABASE_SECRET_KEY</code> satırlarını silip uygulamayı yeniden
            başlatın; veriler bilgisayarınızda saklanır.
          </p>
        </>
      )}
    </main>
  );
}
