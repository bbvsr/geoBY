# GeoBY

Müşteriler artık "en iyi online kırtasiye sitesi hangisi?" sorusunu Google yerine ChatGPT, Gemini, Claude ve Perplexity'ye soruyor. **GeoBY bu soruları düzenli olarak asistanlara sorar ve cevaplarda markanızın önerilip önerilmediğini ölçer.** Buna GEO (Generative Engine Optimization) deniyor.

Her cevap için şunları gösterir:

- Markanız geçiyor mu? Geçiyorsa kaçıncı sırada ve hangi tonla?
- Hangi rakipleriniz önerilmiş?
- Asistan hangi sitelere dayanmış?

Bunlardan da somut bir yapılacaklar listesi çıkarır.

## Kimin için, ne işe yarar?

| Senaryo | GeoBY'de |
|---|---|
| "Asistanlar bizi öneriyor mu?" | **Özet** sayfası, durumu tek cümleyle verir: "KalemKutu, genel soruların %33 kadarında öneriliyor; 4 marka arasında 2. sırada." |
| "Rakibimiz nerede, biz neden yokuz?" | **Adınızın geçmediği sorular**: rakiplerin önerildiği ama sizin önerilmediğiniz sorular. En hızlı kazanım buradadır. |
| "Ne yapmalıyız?" | **Yapılacaklar**: verilere göre öncelikli adımlar. Örneğin bir karşılaştırma sayfası açmak ya da şu sitelerde listelenmek. |
| "Asistan neye dayanarak öneriyor?" | **Kaynaklar**: cevaplarda gösterilen siteler, türlerine göre (haber, forum, rakip sitesi…). |
| "Çalışmalarımız işe yaradı mı?" | Haftalık trend grafiği ve önceki döneme göre değişim. Hatırlatıcı, testleri düzenli tekrarlatır. |
| "Asistan tam olarak ne dedi?" | Soruya tıklayınca her asistanın cevabı açılır. Markanız fosforlu kalemle, rakipler altı çizili gösterilir. |
| Ajans veya rapor | Tüm testler CSV olarak indirilir (Excel ile açılır). |

**Ölçüm kuralı:** Görünürlük, sorusunda markanızın adı **geçmeyen** genel sorulardan hesaplanır. "KalemKutu alternatifleri" gibi bir soruda adınızın cevapta geçmesi doğaldır; bu sorular görünürlüğe sayılmaz, yalnızca tonu ölçmek için kullanılır.

## Çalıştırma

```bash
npm install
npm run dev
```

`http://localhost:3000` adresini açın, web sitenizi girin, önerilen soruları ve rakipleri kontrol edin. Hiçbir ayar gerekmez:

- **Veriler** proje klasöründeki `.data/geoby.json` dosyasında saklanır.
- **Cevaplar**, sağ üstteki "Cevap yapıştır" ile elle eklenebilir. Soruyu asistana siz sorarsınız; GeoBY cevabı analiz eder.
- **Anahtarsız deneme modu**: ChatGPT sorusunu Pollinations üzerinden küçük bir açık modelle sorar. Yaklaşık 45 saniyede bir cevap verir ve sonuçları kabadır.

## Otomatik test için ücretsiz anahtarlar

`.env.example` dosyasını `.env.local` olarak kopyalayın, anahtarı ekleyin ve uygulamayı yeniden başlatın.

| Değişken | Nereden | Ne açar |
|---|---|---|
| `GROQ_API_KEY` | https://console.groq.com/keys | ChatGPT'yi, OpenAI'nin açık modeli **gpt-oss** ile *yaklaşık* ölçer; kurulumdaki site analizini de yapar |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Gemini'yi ölçer (ücretsiz katmanın günlük sınırı var) |
| `LOCAL_AI_URL` | Ollama, LM Studio veya llama.cpp | Kendi bilgisayarınızdaki model; sınırsız ve ücretsiz |

Ücretli ve isteğe bağlı olanlar: `OPENAI_API_KEY` (gerçek ChatGPT modeli), `ANTHROPIC_API_KEY` (Claude), `PERPLEXITY_API_KEY` (Perplexity, kaynak listesiyle birlikte).

Model adlarını yazmanıza gerek yok. GeoBY sağlayıcının güncel model listesinden uygun olanı seçer; bir model kaldırılırsa sıradakine geçer. Hız sınırına takılınca sağlayıcının bildirdiği süre kadar bekleyip yeniden dener.

### Kendi bilgisayarınızdaki modeli kullanmak

Elinizde bir GGUF dosyası varsa (ör. `qwen2.5-coder-7b-instruct-q8_0.gguf`):

```bash
# llama.cpp
llama-server -m ~/ai-models/qwen2.5-coder-7b-instruct-q8_0.gguf --port 8080
# .env.local
LOCAL_AI_URL=http://localhost:8080/v1
```

Ollama veya LM Studio'da modeli açıp `LOCAL_AI_URL=http://localhost:11434/v1` (Ollama) ya da `http://localhost:1234/v1` (LM Studio) yazmanız yeterli. Yerel model iki yerde kullanılır:

- **Site analizi ve öneriler:** Groq ya da Gemini anahtarı yoksa bu işi yerel model yapar.
- **Ayrı bir asistan olarak:** Ayarlar'da "Yerel model" adıyla ölçülebilir.

> 7B boyutundaki modeller kurulum önerilerinde marka adı uydurabilir. Önerilen rakipleri her zaman kontrol edin.

## Tekrarlı ölçüm

Asistanlar aynı soruya her seferinde biraz farklı cevap verir. Bu yüzden tek bir test şanslı ya da şanssız çıkabilir. Ayarlar → Asistanlar bölümünden her sorunun asistan başına **3 veya 5 kez** sorulmasını seçebilirsiniz. Tabloda sonuç "3 denemenin 2'sinde önerildi" (**2/3**) biçiminde görünür. Bir sorunun önerildi sayılması için denemelerin en az yarısında önerilmesi gerekir. Seçim, kotayı o oranda hızlı tüketir.

## Rapor

Özet sayfasındaki **Yazdır / PDF** düğmesi, menü ve düğmeler olmadan, tarihli bir rapor çıkarır. Tarayıcının yazdırma penceresinde "PDF olarak kaydet"i seçin.

## Düzenli test

Ayarlar → **Düzenli test** açıkken (haftalık veya aylık), zamanı gelen testler otomatik bağlantısı olan asistanlarda **kendiliğinden** çalışır. Uygulama yarım saatte bir kontrol eder. Bunun için uygulamanın çalışıyor olması gerekir (`npm run dev` veya `npm start`). Kapatmak için `GEOBY_AUTORUN=false` yazın. Elle ölçülen asistanlar için Özet sayfasında "test zamanı" uyarısı görünür.

Sunucusuz kurulumlarda (Vercel vb.) uygulama sürekli açık kalmaz. Bu durumda `.env.local` dosyasına `CRON_SECRET` girin ve bir zamanlanmış görevin şu adresi çağırmasını sağlayın:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://adresiniz/api/cron        # zamanı geldiyse çalıştırır
curl -H "Authorization: Bearer $CRON_SECRET" "https://adresiniz/api/cron?force=1"  # hemen çalıştırır
```

Bütün testler başarısız olursa (ör. günlük kota dolduysa) sıradaki test tarihi ileri alınmaz; bir sonraki kontrolde yeniden denenir.

## Bilinen sınırlar (dürüstçe)

- **ChatGPT ölçümü:** OpenAI anahtarı yoksa ChatGPT, OpenAI'nin açık modeliyle ölçülür. Gerçek ChatGPT'ye *yakındır* ama aynısı değildir; arayüz bunu her zaman belirtir.
- **Google AI Overview:** Herkese açık bir API'si yok, her zaman elle ölçülür.
- **Claude ve Perplexity:** Ücretsiz API'leri yok. Anahtar yoksa cevapları elle yapıştırılır.
- **Kaynaklar:** Kaynak bağlantıları çoğunlukla Gemini (Google aramasıyla) ve Perplexity testlerinden gelir. Elle yapıştırırken "Kaynak bağlantıları" alanını doldurun.
- **Ton analizi:** Kelime tabanlıdır. Yön göstericidir, kesin bir değerlendirme değildir.
- **Kullanıcı yapısı:** Tek marka, tek kullanıcı vardır; ekip ve rol yönetimi yoktur.

## Sunucuya kurulum

- **Veritabanı:** `.env.local` dosyasına `SUPABASE_URL` ve `SUPABASE_SECRET_KEY` değerlerini girin. Tablolar yoksa uygulama `/setup` sayfasına yönlendirir; oradaki SQL'i Supabase SQL Editor'de bir kez çalıştırın. Vercel gibi dosya sistemi kalıcı olmayan ortamlarda Supabase şarttır.
- **Erişim:** İnternete açacaksanız `GEOBY_PASSWORD` mutlaka girin. Girilmezse uygulamaya herkes erişebilir.
- **Site tarama:** Yalnızca herkese açık adresleri çeker; iç ağ ve bulut meta veri adresleri engellenir.

## Geliştirme

```bash
npm run typecheck                       # TypeScript
npm test                                # birim testleri
GEOBY_LIVE=1 GROQ_API_KEY=… npm test -- live   # gerçek servislere karşı deneme (kota kullanır)
npm run build
```

```
src/
├── app/(app)/          # Özet (/), /sorular, /kaynaklar, /ayarlar
├── app/api/            # brand, competitors, prompts, prompts/run, runs, overview, sources, export, ai/*, login
├── components/         # app (kabuk, filtreler), overview, prompts (tablo, yan panel, yapıştırma), sources, settings, onboarding, ui
└── lib/
    ├── ai/             # sağlayıcılar, model keşfi, hız sınırı (http.ts), asistan eşlemesi (engines.ts)
    ├── db/             # DataStore: yerel JSON veya Supabase
    ├── parser.ts       # cevap analizi (yapay zekâ kullanmaz, deterministik)
    ├── match.ts        # ad eşleştirme (bölünmez boşluk, Türkçe İ/ı)
    ├── metrics.ts      # görünürlük, ses payı, trend, fırsatlar, kaynaklar
    ├── report.ts       # sayfaların veri modeli
    └── net.ts          # güvenli site çekme
```
