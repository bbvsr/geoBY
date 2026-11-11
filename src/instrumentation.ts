/**
 * Uygulama sunucusu başlarken çalışır. Node'a özgü kod ayrı dosyadadır; Next.js
 * bu dosyayı Edge ortamı için de derlediğinden içe aktarma yalnızca Node'da yapılır.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutorun } = await import("./instrumentation-node");
    startAutorun();
  }
}
