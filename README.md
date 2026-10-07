# Harcama Takip

Günlük harcama, gelir, bütçe ve ödeme hatırlatmaları için GitHub Pages uygulaması.

Fişler bölümü fotoğrafı özel Supabase alanına yükler, sunucuda otomatik okur ve kullanıcı kontrolünden sonra harcama toplamlarına ekler. Mevcut elle girişler cihazda saklanmaya devam eder.

**Fiş özelliği önce kurulmalıdır:** [Fiş kurulumu](FIS_KURULUM.md).

## Testler

Node 22.6+ gerekir. Testler kişisel veriler veya ücretli API kullanmaz.

```sh
npm install
npx playwright install chromium
npm test
```

PostgreSQL testleri PGlite üzerinde SQL/RLS/özel dosya erişimini, arayüz testleri Playwright üzerinde mevcut ekranları ve simüle bulut yanıtlarıyla fiş akışını kontrol eder. Gerçek Supabase ve OpenAI uçtan uca kontrolü kurulumdan sonra yapılmalıdır.
