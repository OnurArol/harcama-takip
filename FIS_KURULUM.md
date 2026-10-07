# Harcamalarım: fiş saklama ve otomatik okuma kurulumu

Bu sürüm mevcut elle girişleri, gelirleri, PIN'i ve ödeme hatırlatmalarını korur. Fişler ayrı bir hesapta saklanır. Kurulum yapılana kadar fiş ekranı bağlantı uyarısı gösterir; fiş saklama ve otomatik okuma aktif değildir.

## 1. Supabase projesini aç

1. https://supabase.com/dashboard adresini aç, GitHub hesabınla giriş yap.
2. **New project** seç. Gerekirse önce bir organizasyon oluştur.
3. Proje adını **Harcamalarım** yap. Güçlü bir veritabanı şifresi belirle ve şifre yöneticine kaydet.
4. Avrupa bölgesini seç ve **Create new project** ile oluştur. Hazır olmasını bekle.
5. Projenin **Connect** ekranından veya **Settings → API / API Keys** bölümünden **Project URL** ve **Publishable key** değerlerini al.

Project URL genellikle `https://xxxx.supabase.co`, yeni herkese açık anahtar `sb_publishable_...` şeklindedir. Eski projelerde `anon` anahtarı da kullanılabilir. Veritabanı şifresini, **secret / service_role** anahtarını veya OpenAI anahtarını sohbete ya da GitHub'a koyma.

## 2. Fiş veritabanını oluştur

1. Supabase projesinde **SQL Editor → New query** aç.
2. Depodaki `supabase/migrations/202610070001_receipts.sql` dosyasının tamamını yapıştırıp **Run** seç.
3. Bu işlem `receipts` tablosunu, hesaba özel erişim kurallarını ve özel `receipts` fotoğraf alanını oluşturur. Eski yerel harcama verilerine dokunmaz.

## 3. Uygulamayı projeye bağla

GitHub'daki `receipt-config.js` dosyasını şu iki değerle düzenle:

```js
window.RECEIPT_CONFIG = {
  supabaseUrl: 'https://SENIN-PROJEN.supabase.co',
  supabasePublishableKey: 'sb_publishable_SENIN-ANAHTARIN'
};
```

Bu iki değer tarayıcı bağlantısı içindir. Hesaba özel erişimi SQL'deki kurallar korur. Sunucu anahtarları bu dosyaya yazılmaz.

## 4. Fiş hesabını aç

1. Supabase **Authentication → URL Configuration** bölümünde Site URL ve izin verilen Redirect URL olarak `https://onurarol.github.io/harcama-takip/` ekle.
2. Uygulamada **Fişler → Hesap Oluştur** ile kendi e-postanı ve en az 8 karakterlik şifreni gir.
3. E-postandaki doğrulama bağlantısını aç. Ardından uygulamada **Giriş Yap** seç.
4. Bu kişisel uygulama için hesabını oluşturduktan sonra Supabase **Authentication** ayarlarında **Allow new users to sign up** seçeneğini kapat. Böylece dışarıdan yeni hesaplar açılmaz. Mevcut hesabınla giriş yapmaya devam edersin.

PIN cihazdaki ekran kilididir. Fiş hesabının şifresi ayrıdır. Yeni telefonda aynı e-posta hesabıyla giriş yapınca fişlerin gelir; eski elle girilmiş kayıtlar eski cihazda kalır.

## 5. Otomatik okumayı etkinleştir

Supabase fotoğrafları saklar; fotoğraftan firma, tarih, toplam ve ürün çıkarma işlemini sunucuda çalışan OpenAI API bağlantısı yapar. Bunun için ayrıca bir OpenAI API anahtarı ve API kullanım bakiyesi gerekir; API kullanımı ücretlidir. Anahtarı yalnızca Supabase'in gizli değerler ekranına gir.

1. https://platform.openai.com/api-keys adresinden bir API anahtarı oluştur. API hesabında faturalandırmayı ve sana uygun bütçeyi ayarla.
2. Supabase **Edge Functions → Secrets** bölümüne şu değerleri ekle:

| Ad | Değer |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API anahtarın |
| `RECEIPT_OWNER_EMAIL` | Fiş hesabını oluşturduğun e-posta |
| `RECEIPT_SUPABASE_PUBLISHABLE_KEY` | Aynı Supabase Publishable key |
| `APP_ORIGIN` | `https://onurarol.github.io` |
| `OPENAI_RECEIPT_MODEL` | İsteğe bağlı; varsayılan `gpt-4.1-mini` |

3. **Edge Functions → Deploy a new function / Via Editor** ile `analyze-receipt` adında fonksiyon oluştur.
4. `supabase/functions/analyze-receipt/index.ts` ve aynı klasördeki `schema.ts` dosyalarını ekle. `schema.ts`, `index.ts` ile aynı klasörde olmalı.
5. Fonksiyon ayarlarında **Verify JWT with legacy secret** kontrolünü kapat. Kod kendi içinde `auth.getUser(token)` ile oturumu doğrular; anonim okumaya izin vermez. Yeni Supabase imzalama anahtarlarıyla bu yöntem çalışır.
6. Fonksiyonu deploy et.

CLI kullanılıyorsa alternatif komutlar:

```sh
supabase login
supabase link --project-ref SENIN_PROJE_REFERANSIN
supabase db push
supabase functions deploy analyze-receipt --no-verify-jwt
```

Secrets değerlerini panelden ekleyebilirsin. OpenAI anahtarını komut satırı geçmişine yazma.

## 6. Son kontrol

- Mevcut harcamaların görünmeye devam ettiğini kontrol et.
- Fişler ekranında küçük bir fiş fotoğrafı seç. **Fotoğraf buluta kaydedildi** mesajını bekle.
- Okunan firma, tarih, toplam ve ürünleri kontrol et; gerekirse düzeltip kaydet.
- Harcama kayıtlarında fiş bir kez görünmeli. **Fişi Gör / Düzenle** orijinal fotoğrafı açmalı.
- Aynı fotoğrafı tekrar seçince aynı kayıt açılmalı; ikinci harcama eklenmemeli.
- Başka bir tarayıcıda aynı fiş hesabına girip fotoğrafın ve kayıtların geldiğini doğrula. Bu kontrol geçmeden galerideki asıl kopyayı silme.
- Otomatik okuma çalışmıyorsa fotoğraf kayıtlı kalır; yeniden okunabilir veya alanlar elle tamamlanabilir.

## Kullanım ve sınırlar

- JPEG, PNG, WebP; dosya başına en fazla 10 MB. HEIC doğrudan kabul edilmez.
- Fiş fotoğrafları GitHub'a veya yerel `localStorage`'a yazılmaz; özel Supabase alanında saklanır. Görüntüleme bağlantıları 5 dakika geçerlidir.
- Okuma sırasında fiş fotoğrafı OpenAI API'ye gönderilir. `store:false` ile Responses kayıt saklama kapatılır; bu ayar sağlayıcının tüm veri işleme/abuse monitoring politikalarını sıfırladığı anlamına gelmez.
- Okuma sonucu kontrol bekleyen kayıt olur. Harcama toplamına yalnızca onaylanınca girer.
- TL dışındaki fişlerde toplamın TL karşılığını kullanıcı kontrol ederek girer; otomatik kur hesabı yoktur.
- Günlük kullanıcı başına 50 okuma denemesi sınırı vardır. Kesilen okuma 3 dakika sonra yeniden denenebilir.
- Aynı dosya SHA-256 ile tanınır. Aynı fişi farklı açıdan çekmek veya kırpmak farklı dosya oluşturur; bunlar otomatik aynı fiş sayılmaz.
- Fişten onaylanan harcamalar bulut kaydından gösterilir; yerel elle girişlere kopyalanmaz. Böylece yeniden yükleme/girişte toplam iki katına çıkmaz.
- JSON/CSV yedeği mevcut yerel gelir ve harcamalar içindir; fiş fotoğrafları bu yedeğe dahil değildir.
- Cihazdaki kayıtları silme düğmesi bulut fişlerini silmez. Fişler ayrı ayrı **Fişi Sil** ile fotoğraf ve bağlı harcamasıyla silinir.
- Supabase/AI bağlantısı ve gerçek fiş okuması proje kurulumu sonrası doğrulanmalıdır. Yerel testler sunucu yanıtlarını simüle eder.

Resmi kaynaklar: [Supabase API anahtarları](https://supabase.com/docs/guides/getting-started/api-keys), [özel dosya erişimi](https://supabase.com/docs/guides/storage/security/access-control), [Edge Function oturum kontrolü](https://supabase.com/docs/guides/functions/auth), [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
