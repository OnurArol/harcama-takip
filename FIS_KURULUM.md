# Harcamalarım: ücretsiz fiş okuma ve saklama

Bu sürüm ücretli yapay zekâ veya okuma API'si kullanmaz. Fişi Tesseract.js ile cihazın tarayıcısında okur; fotoğraf ve kayıt bilgilerini Supabase'in ücretsiz planında saklar. Elle giriş, gelir, bütçe, PIN ve ödeme hatırlatmaları korunur.

Kurulum yapılana kadar Fişler ekranında bağlantı uyarısı görünür. Özellik henüz canlıda etkin değildir.

## 1. Ücretsiz Supabase projesini aç

1. https://supabase.com/dashboard adresine GitHub hesabınla giriş yap.
2. Organizasyon oluşturman istenirse **Free ($0 / month)** planını seç. **Pro** seçmene gerek yok.
3. **New project** ile adı **Harcamalarım** olan bir proje oluştur. Güçlü bir veritabanı şifresi belirle ve Avrupa bölgesini seç.
4. Proje hazır olunca **Connect** ekranından veya **Settings → API / API Keys** bölümünden **Project URL** ve **Publishable key** değerlerini al.
5. Ücretli yükseltme ekranı çıkarsa işlemi tamamlamadan Free organizasyonunda proje açtığını kontrol et. Zaten iki aktif ücretsiz projen varsa kullanılmayan bir projeyi duraklatman veya kaldırman gerekebilir; mevcut projeleri içeriğini kontrol etmeden silme.

16 Ekim 2026 itibarıyla Free planı aylık $0; 1 GB dosya alanı, 500 MB veritabanı ve 5 GB dışa aktarım trafiği içerir. İki aktif ücretsiz proje sınırı vardır. Bir hafta kullanılmayan ücretsiz proje duraklatılabilir. Bu plan sınırsız depolama değildir. Kotalar için paneldeki Usage bölümünü takip et. [Resmi plan sınırları](https://supabase.com/pricing).

Project URL `https://xxxx.supabase.co`, herkese açık anahtar `sb_publishable_...` şeklindedir. Eski projelerde `anon` anahtarı kullanılabilir. Veritabanı şifresini veya secret / service_role anahtarını sohbete ya da GitHub'a koyma.

## 2. Fiş veritabanını oluştur

1. Supabase **SQL Editor → New query** aç.
2. `supabase/migrations/202610070001_receipts.sql` dosyasının tamamını yapıştırıp **Run** seç.
3. Hesaba özel `receipts` tablosu, özel fotoğraf alanı ve erişim kuralları oluşturulur.

Bu işlem mevcut yerel harcamaları değiştirmez. Önceki taslak sürümün SQL'ini zaten çalıştırdıysan aynı dosya tekrar uygulanabilir. O sürümün okuma kullanım tablosu/fonksiyonu kalabilir ancak yeni sürüm bunları kullanmaz.

## 3. Uygulamayı bağla

GitHub'daki `receipt-config.js` dosyasına yalnızca bu iki herkese açık değeri yaz:

```js
window.RECEIPT_CONFIG = {
  supabaseUrl: 'https://SENIN-PROJEN.supabase.co',
  supabasePublishableKey: 'sb_publishable_SENIN-ANAHTARIN'
};
```

Sunucu şifresi veya OpenAI anahtarı gerekmez. Edge Function veya ücretli okuma servisi kurulmaz. Eski `analyze-receipt` fonksiyonunu daha önce deploy ettiysen Supabase panelinden kaldırabilir, ona eklediğin OpenAI secret değerini silebilirsin; yeni sürüm onu çağırmaz.

## 4. Fiş hesabını aç

1. Supabase **Authentication → URL Configuration** bölümünde Site URL ve izin verilen Redirect URL olarak `https://onurarol.github.io/harcama-takip/` ekle.
2. Uygulamada **Fişler → Hesap Oluştur** ile kendi e-postanı ve en az 8 karakterlik şifreni gir.
3. E-postandaki doğrulama bağlantısını aç; sonra uygulamada giriş yap.
4. Kişisel hesabını oluşturunca Authentication ayarlarında **Allow new users to sign up** seçeneğini kapat. Mevcut hesabınla giriş yapmaya devam edersin.

PIN cihazdaki ekran kilididir; fiş hesabının şifresi ayrıdır. Başka telefonda aynı hesapla fişlerine ulaşabilirsin. Eski elle girilmiş kayıtlar eski cihazda kalır.

## 5. Kullan ve kontrol et

- Fişler ekranında **Fotoğraf Çek** veya **Galeriden Seç** düğmesine dokun.
- Önce orijinal fotoğraf hesabına yüklenir. Sonra tarayıcı ücretsiz Türkçe/İngilizce OCR aracını açıp görüntüyü cihazında okur.
- İlk kullanımda okuma motoru ve dil dosyaları internetten indirilir; bu işlem biraz sürebilir. Fotoğraf okuma için bir yapay zekâ servisine yüklenmez.
- Firma, tarih, ödenecek toplam, kategori ve ürünleri kontrol edip düzelt. Sonuç doğrulanamadığında alan boş bırakılır veya uyarı gösterilir. Silik/eğri fişlerde elle düzeltme gerekebilir.
- **Kontrol Ettim, Harcamaya Ekle** ile kaydet. Onaylanana kadar harcama toplamına eklenmez.
- **Fişi Büyüt** ile orijinal fotoğrafı açabilirsin. Farklı bir tarayıcıdan giriş yapıp fotoğrafın kayıtlı olduğunu kontrol ettikten sonra galerideki kopyayı silebilirsin.

## Sınırlar ve veri davranışı

- JPEG, PNG, WebP; fotoğraf başına en fazla 10 MB. HEIC için JPEG kopyası gerekir.
- Fotoğraflar ve fiş kayıtları Supabase'deki hesabında saklanır; GitHub'a veya tarayıcının localStorage alanına yazılmaz.
- OCR için fotoğraf yalnızca geçici bellekte işlenir. Dil dosyalarının önbelleği fotoğraflardan ayrıdır. Okuma işlemi sonunda worker ve geçici görüntü serbest bırakılır.
- Ücretsiz OCR yapay zekâ kadar esnek değildir: mağaza/kategori tahmini basit kurallarla yapılır; karmaşık ürün satırları ve indirimler eksik okunabilir. Fişi kontrol etmen gerekir.
- Ödenecek toplam, toplam etiketiyle bulunur. KDV, ara toplam, verilen nakit ve para üstü toplam yerine kullanılmaz. Çelişen toplamlar bulunursa alan boş bırakılır.
- Aynı dosya SHA-256 ile tanınır; ikinci harcama oluşturulmaz. Aynı fişin farklı açıdan çekilmiş fotoğrafı farklı dosya sayılır.
- Okuma başarısız olsa da yüklenmiş fotoğraf saklanır; yeniden okunabilir veya alanlar elle tamamlanabilir.
- TL dışındaki fişlerde tutarın TL karşılığını kullanıcı girmelidir; otomatik kur hesabı yoktur.
- Yerel JSON/CSV yedeği elle girilmiş kayıtlara aittir; bulut fişlerini ve fotoğraflarını içermez.
- Cihazdaki kayıtları silme düğmesi bulut fişlerini silmez. Fişler ayrı ayrı **Fişi Sil** ile fotoğraf ve bağlı harcamasıyla silinir.
- Tarayıcıda okuma için kullanım başına ücret ve günlük sunucu okuma kotası yoktur. İnternet/veri kullanımı ve Supabase Free kotaları geçerlidir.
- Gerçek Supabase projesi bağlanınca yükleme, hesap girişi ve farklı cihazdan geri açma son kez doğrulanmalıdır.

Kaynaklar: [Supabase Free planı](https://supabase.com/pricing), [API anahtarları](https://supabase.com/docs/guides/getting-started/api-keys), [özel dosya erişimi](https://supabase.com/docs/guides/storage/security/access-control), [Tesseract.js](https://github.com/naptha/tesseract.js).
