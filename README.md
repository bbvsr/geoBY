# GeoBY

**Yapay zeka görünürlük takibi (GEO).** ChatGPT, Gemini, Claude, Perplexity ve Google AI Overview müşterilerinize sizi öneriyor mu? GeoBY, müşterilerinizin soracağı soruları bu asistanlara sorar ve cevaplarda markanızın **geçip geçmediğini, kaçıncı sırada, hangi tonla ve hangi kaynaklarla** önerildiğini ölçer; rakiplerle karşılaştırır ve ne yapmanız gerektiğini söyler.

## 1 dakikada çalıştır

```bash
npm install
npm run dev
```

`http://localhost:3000` → web sitenizi girin → soruları ve rakipleri onaylayın → **Tüm Soruları Test Et**.

Hiçbir ayar gerekmez: veriler `.data/geoby.json` dosyasında saklanır, ölçümler **Manuel Test** ile (soruyu asistana sorup cevabı yapıştırarak) yapılabilir.

## Otomatik test için ücretsiz yapay zeka anahtarları (önerilen)

```bash
cp .env.example .env.local
```

| Anahtar | Nereden (ücretsiz) | Ne açar |
|---|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Gemini ölçümü + Google arama kaynakları + kurulumda site analizi |
| `GROQ_API_KEY` | https://console.groq.com/keys | ChatGPT ölçümü (OpenAI'nin açık modeli `gpt-oss-120b`) |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys | Groq'a alternatif (`:free` modeller) |
| — | Pollinations (anahtarsız) | Hiç anahtar yoksa son çare; yavaş ve hız sınırlı |

Anahtarı ekledikten sonra `npm run dev`'i yeniden başlatın. **Ayarlar → Yapay Zeka Bağlantıları** ekranında hangi modelin otomatik/manuel olduğunu görüp "Test et" ile bağlantıyı deneyebilirsiniz.

Ücretli (isteğe bağlı): `OPENAI_API_KEY` (gerçek ChatGPT), `ANTHROPIC_API_KEY` (Claude), `PERPLEXITY_API_KEY` (Perplexity). Bunlar yoksa o modeller Manuel Test ile ölçülür. Google AI Overview'un ücretsiz API'si olmadığı için her zaman manueldir.

> **Dürüstlük notu:** OpenAI anahtarı yokken "ChatGPT" sonucu, OpenAI'nin açık modeli gpt-oss ile alınır — gerçek ChatGPT'ye yakın ama aynısı değildir. Arayüzde bu her zaman belirtilir.

## Ne ölçülür?

- **Görünürlük** — cevapların yüzde kaçında markanız geçiyor
- **Sıra** — numaralı listede kaçıncı madde; liste yoksa cevapta geçen markalar arasındaki sırası (1 = en iyi)
- **Ton** — markanın geçtiği cümlelerdeki olumlu/olumsuz ifadeler (0–100)
- **SOV** — tüm marka geçişleri içindeki payınız
- **Kaynaklar** — cevapta/aramada gösterilen siteler; Siz / Rakip / Kullanıcı içeriği / Editoryal / Referans / Kurumsal
- **Aksiyonlar** — verilere göre site içi ve site dışı somut öneriler

Cevap analizi yapay zeka kullanmaz (hızlı, tutarlı, ücretsiz). Yapay zeka; soruları asistanlara sormak ve kurulumda siteyi analiz edip soru/rakip önermek için kullanılır.

## Supabase ile kullanım (sunucu / ekip)

`.env.local` içine `SUPABASE_URL` ve `SUPABASE_SECRET_KEY` girin. Tablolar yoksa uygulama `/setup` sayfasına yönlendirir; [`sql/schema.sql`](sql/schema.sql) dosyasını Supabase SQL Editor'de çalıştırın. Vercel gibi dosya sistemi kalıcı olmayan ortamlarda Supabase gereklidir.

## Geliştirme

```bash
npm run typecheck   # TypeScript
npm test            # birim testleri (parser, metrikler, AI sağlayıcıları, yerel veritabanı)
npm run build
```

```
src/
├── app/            # sayfalar + API (brand, competitors, prompts, prompts/run, runs/manual, ai/status, ai/test, overview, sources, …)
├── components/     # dashboard sekmeleri, modallar, grafikler, UI
└── lib/
    ├── ai/         # providers (Gemini, Groq, OpenRouter, Pollinations, OpenAI, Anthropic, Perplexity), engines, assistant
    ├── db/         # DataStore arayüzü: local (JSON dosyası) ve supabase
    ├── parser.ts   # cevap analizi
    ├── metrics.ts  # görünürlük, SOV, trend, kaynaklar
    ├── testing.ts  # test çalıştırma ve kaydetme
    └── generators.ts / scraper.ts  # kurulum analizi
```

## Güvenlik

API anahtarları yalnızca sunucuda okunur, tarayıcıya gönderilmez. `.env.local` ve `.data/` git'e eklenmez. Uygulamada kullanıcı girişi yoktur (tek marka); internete açık kurulumda önüne bir kimlik doğrulama katmanı koyun.
