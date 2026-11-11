import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[560px] px-5 pt-24">
      <p className="font-serif text-[22px] font-semibold tracking-[-0.02em]">GeoBY</p>
      <h1 className="mt-10 font-serif text-[34px] leading-tight font-medium">Bu sayfa yok</h1>
      <p className="mt-3 text-[16px] text-ink-2">Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir.</p>
      <p className="mt-6 flex gap-5 text-[15px]">
        <Link href="/" className="underline underline-offset-[3px]">Özet</Link>
        <Link href="/sorular" className="underline underline-offset-[3px]">Sorular</Link>
        <Link href="/ayarlar" className="underline underline-offset-[3px]">Ayarlar</Link>
      </p>
    </main>
  );
}
