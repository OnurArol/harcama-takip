# Harcama Takip

Günlük harcama, gelir, bütçe ve ödeme hatırlatmaları için GitHub Pages uygulaması.

Fişler bölümü orijinal fotoğrafı özel Supabase alanına yükler. Tesseract.js ile cihazda ücretsiz okur; kullanıcı kontrolünden sonra harcama toplamlarına ekler. Ücretli yapay zekâ API'si veya Edge Function gerekmez. Supabase Free depolama/trafik kotaları geçerlidir. Mevcut elle girişler cihazda saklanmaya devam eder.

**Fiş özelliği önce kurulmalıdır:** [Ücretsiz fiş kurulumu](FIS_KURULUM.md).

## Testler

Node 22.6+ gerekir. Testler kişisel veriler veya ücretli API kullanmaz.

```sh
npm install
npx playwright install chromium
npm test
```

PostgreSQL/PGlite testleri SQL/RLS/özel dosya erişimini kontrol eder. Parser testleri Türkçe tutar/tarih, çelişkili toplam, KDV, para üstü, ürün ve kategorileri doğrular. Playwright testleri eski ekranları ve fiş akışını simüle bulut yanıtlarıyla ve üretimde kullanılan metin ayrıştırıcıyla kontrol eder. OCR motorundan dönen metin arayüz testinde simüle edilir. Gerçek Supabase uçtan uca kontrolü kurulumdan sonra yapılmalıdır.
