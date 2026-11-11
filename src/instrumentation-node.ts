import { runDueTests } from "@/lib/autorun";

/**
 * Uzun süre açık kalan bir sunucuda (npm run dev / npm start) hatırlatıcının
 * zamanı gelen testlerini kendiliğinden çalıştırır. Kapatmak için GEOBY_AUTORUN=false.
 * Vercel gibi sunucusuz ortamlarda bunun yerine /api/cron kullanılır.
 */
export function startAutorun() {
  if (process.env.GEOBY_AUTORUN === "false" || process.env.VERCEL) return;

  const g = globalThis as unknown as { __geobyAutorunTimer?: ReturnType<typeof setInterval> };
  if (g.__geobyAutorunTimer) return;

  const check = async () => {
    try {
      const r = await runDueTests();
      if (r.ran) {
        console.log(
          `[GeoBY] Otomatik test: ${r.prompts} soru, ${r.answers} cevap, marka ${r.mentioned} cevapta geçti, ${r.errors} hata.`
        );
      }
    } catch (e) {
      console.warn("[GeoBY] Otomatik test kontrolü başarısız:", (e as Error).message);
    }
  };

  // Sunucu açıldıktan bir dakika sonra, ardından yarım saatte bir
  setTimeout(check, 60_000).unref?.();
  g.__geobyAutorunTimer = setInterval(check, 30 * 60_000);
  g.__geobyAutorunTimer.unref?.();
}
