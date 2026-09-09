# GeoBY

**Manuel AEO / LLM Görünürlük Monitörü** — Markanızın yapay zeka asistanlarındaki (ChatGPT, Claude, Gemini, Perplexity, Google AI Overview) görünürlüğünü ölçen ve artırmak için öneriler veren bir uygulama.

> İlk etapta **API key ile bağlantı kurmaz.** Görünürlük ölçümü, LLM cevaplarını **manuel** yapıştırdığınız "Manuel Test" ekranından yürür. API entegrasyonu kodda hazırdır ama `LLM_API_ENABLED=false` ile kapalıdır (ikinci etap için iskelet mevcut).

---

## Özellikler

- 🔍 **Manuel görünürlük testi** — Bir soru + model için arama promptunu ve LLM cevabını yapıştırın; sistem analiz eder: marka geçiyor mu, **kaç kez**, konum (1–5), sentiment, rakip geçişleri, alıntılanan kaynaklar.
- 🧠 **Kural-tabanlı soru üretimi** — Marka/kategori/rakip bilgisinden ticari-niyetli Türkçe sorular önerir (LLM gerektirmez).
- 🌐 **Site tarama** — Onboarding'de siteyi tarayıp başlık/açıklama/kategori çıkarır (LLM'siz).
- 📊 **Dashboard** — Görünürlük, Share of Voice, sentiment, konum, haftalık trend grafiği, rakip sıralaması ve dinamik aksiyon önerileri.
- 🔗 **Kaynak analizi** — Alıntılanan domain/URL'lerin sınıflandırması (You / Competitor / UGC / Editorial / Reference / Institutional / Corporate).
- ⏰ **Alarm** — Haftalık/aylık yeniden test hatırlatması.
- 🗂️ **Belge yükleme** — Marka belgeleri Supabase Storage'a.

## Nasıl çalışır (8 adım)

1. **Onboarding** — İlk açılışta marka oluşturulur (MVP: tek marka, auth yok).
2. **Site / belge yükleme** — Site taranır, belgeler yüklenir.
3. **Soru üretimi** — Kural-tabanlı Türkçe soru önerileri.
4. **Onay / düzenle / sil** — Sorular sekmesi.
5. **Model seçimi** — Ayarlar'dan hangi modeller test edilecek.
6. **Manuel görünürlük testi** — Cevabı yapıştır → analiz → kaydet.
7. **Alarm** — Haftalık/aylık hatırlatma.
8. **İzleme** — Genel Bakış'ta durum + önceki döneme göre değişim.

## Teknoloji

Next.js 15 (App Router, `src/`) · TypeScript · Tailwind CSS v4 · Recharts · Supabase (PostgreSQL) · lucide-react

## Kurulum

### 1) Bağımlılıklar

```bash
npm install
```

### 2) Ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayıp Supabase proje bilgilerinizi girin:

```bash
cp .env.example .env.local
```

| Değişken | Açıklama |
|---|---|
| `SUPABASE_URL` | Supabase proje URL'i |
| `SUPABASE_SECRET_KEY` | Server-side secret key (asla client'a gitmez) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client için publishable key |
| `LLM_API_ENABLED` | İkinci etap; `false` bırakın |

### 3) Veritabanı (tek seferlik)

Tablolar yoksa uygulama `/setup`'a yönlenir.

1. Supabase panelinde **SQL Editor**'ü açın.
2. [`sql/schema.sql`](sql/schema.sql) içeriğini yapıştırıp **Run** deyin.
3. `/setup` sayfasında **"Tabloları Kontrol Et"** — hepsi yeşil olmalı.

### 4) Çalıştır

```bash
npm run dev
```

`http://localhost:3000` açın → onboarding → **Manuel Test** → Genel Bakış.

## Proje yapısı

```
src/
├── app/
│   ├── page.tsx              # Kök: setup / onboarding / dashboard yönlendirmesi
│   ├── setup/                # DB kurulum sihirbazı
│   └── api/                  # brand, overview, sources, prompts, runs/manual, models, schedules, documents, onboarding/*
├── components/
│   ├── ui/ · charts/         # Tasarım sistemi + Recharts grafikleri
│   ├── dashboard/            # Overview / Prompts / Sources / Settings sekmeleri + Manuel Test modalı
│   └── onboarding/           # OnboardingFlow
├── lib/
│   ├── parser.ts             # Cevap analizi (mention, sayım, konum, sentiment, kaynak) — LLM YOK
│   ├── generators.ts         # Kural-tabanlı Türkçe soru/rakip önerisi
│   ├── scraper.ts            # Basit site tarama
│   ├── metrics.ts            # Görünürlük, SOV, trend, kaynak oranları
│   ├── supabase-admin.ts     # Server-side DB işlemleri
│   └── llm/                  # API entegrasyon iskeleti (pasif)
└── types/
sql/schema.sql                # Supabase şeması
```

## Güvenlik notları

- `.env.local` **git'e dahil edilmez** (`.gitignore`). Supabase secret key yalnızca server-side kullanılır.
- MVP'de kimlik doğrulama yoktur (tek marka). Çok kullanıcılı kullanım için Supabase Auth + RLS eklenmelidir.
