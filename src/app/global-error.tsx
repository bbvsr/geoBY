"use client";

/** Kök düzende bile hata olursa (ör. veritabanına ulaşılamıyor) gösterilen yedek sayfa. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f4ef", color: "#1d1c19", margin: 0 }}>
        <main style={{ maxWidth: 560, margin: "96px auto", padding: "0 20px" }}>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 600 }}>GeoBY</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 500, marginTop: 32 }}>Uygulama açılamadı</h1>
          <p style={{ color: "#4a4740", lineHeight: 1.6 }}>
            Sunucu tarafında bir sorun var. Veritabanı ayarlarını (.env.local) ve uygulamanın çalıştığı terminaldeki
            hata mesajını kontrol edin.
          </p>
          {error.digest && <p style={{ color: "#69655c", fontSize: 13 }}>Hata kodu: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ marginTop: 16, height: 40, padding: "0 16px", borderRadius: 6, border: 0, background: "#1d1c19", color: "#f6f4ef", fontSize: 14, cursor: "pointer" }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
