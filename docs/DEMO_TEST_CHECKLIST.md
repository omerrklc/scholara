# Scholara v0.1.0 Demo Test Kontrol Listesi

Bu liste, Scholara'nın kapalı demo testinde kullanılmak içindir. Test sırasında gerçek parola, kimlik belgesi, özel araştırma verisi veya paylaşılmaması gereken kişisel bilgi göndermeyin.

## Test sürümü

- Sürüm: `v0.1.0-demo`
- Android paket adı: `com.scholara.app`
- Derleme kodu: `cf71d94`
- Kurulum sayfası: https://expo.dev/accounts/sentema/projects/scholara/builds/41a57cdf-2885-43cd-9d58-e3d6600e6eb9
- Bu demo bağlantısının son kullanma tarihi: 5 Ekim 2026

## Teste başlamadan önce

- Android telefonda eski Scholara kuruluysa yeni APK'yı üzerine kurabilirsiniz.
- Test için erişebildiğiniz bir e-posta adresi kullanın.
- İki hesap gerektiren adımlarda ikinci bir test hesabı veya ikinci bir test kullanıcısı kullanın.
- Şifreyi veya e-postaya gelen doğrulama kodunu hiç kimseyle paylaşmayın.

## Kontrol listesi

### 1. Kurulum ve giriş

- [ ] APK indiriliyor ve uyarı vermeden kuruluyor.
- [ ] Uygulama açılıyor; beyaz veya boş ekranda kalmıyor.
- [ ] Yeni hesap oluşturulabiliyor.
- [ ] E-posta doğrulamasından sonra giriş yapılabiliyor.
- [ ] Uygulama kapatılıp açıldığında oturum korunuyor.

### 2. Akademik profil

- [ ] Profil adımları küçük ekranda kaydırılabiliyor.
- [ ] Klavye açıkken `Continue` düğmesine ulaşılabiliyor.
- [ ] Üniversite aramasında doğrulanmış kurum önerileri geliyor.
- [ ] Listede olmayan bir kurum manuel olarak girilebiliyor.
- [ ] Ülke seçildikten sonra şehir araması sonuç veriyor.
- [ ] Araştırma alanları ve konuşulan diller eklenip silinebiliyor.
- [ ] İsteğe bağlı JPEG profil fotoğrafı yüklenebiliyor.
- [ ] Profil kaydedildikten sonra bilgiler Profile ekranında görünüyor.

### 3. Discover ve gizlilik

- [ ] Ortak araştırma alanı olan hesap `Research` bölümünde görünüyor.
- [ ] Taşınma bilgileri uygun olan hesap `Moving` bölümünde görünüyor.
- [ ] Mevcut konum `Private` yapılınca diğer hesap konumu göremiyor ve profil Moving sonucundan çıkıyor.
- [ ] Konum tekrar `Visible` yapılınca uygun Moving sonucu geri geliyor.
- [ ] Profil kartından ayrıntılı profil açılabiliyor.

### 4. Bağlantı ve mesajlaşma

- [ ] Bir hesap diğerine bağlantı isteği gönderebiliyor.
- [ ] Alıcı hesap isteği kabul edebiliyor.
- [ ] Eşleşme sonrasında iki hesap mesaj gönderebiliyor.
- [ ] Okunmamış mesaj sayısı doğru görünüyor.

### 5. Topluluk ve bildirimler

- [ ] Topluluk gönderisi oluşturulabiliyor.
- [ ] Gönderiye yorum ve helpful oyu eklenebiliyor.
- [ ] İlgili uygulama içi bildirim zil bölümünde görünüyor.
- [ ] Mümkünse iki ayrı telefonda push bildirimi deneniyor.

### 6. Güvenlik ve hesap ayarları

- [ ] Bir kullanıcı engellenebiliyor ve engellenen kullanıcı yeniden bulunamıyor.
- [ ] Engelleme kaldırılabiliyor.
- [ ] Kullanıcı, gönderi veya yorum için şikâyet oluşturulabiliyor.
- [ ] Çıkış yapıldıktan sonra özel ekranlara geri dönülemiyor.

## Sorun bildirimi

Bir sorun bulduğunuzda aşağıdaki bilgileri gönderin:

1. Telefon modeli ve Android sürümü
2. Hangi ekranda olduğu
3. Yaptığınız son 2–3 işlem
4. Beklediğiniz sonuç
5. Gerçekte olan sonuç
6. Varsa ekran görüntüsü

Parola, doğrulama kodu, erişim anahtarı veya özel mesaj içeriği göndermeyin.

## Demo kabul ölçütü

Kurulum, giriş, profil, Discover, gizlilik, bağlantı ve mesajlaşma bölümlerindeki tüm kritik maddeler en az iki farklı hesapla tamamlandığında demo testi başarılı kabul edilir. Push bildirimi ikinci telefon bulunamadığında ayrıca takip edilebilir; bu durum uygulama içi bildirimin test edilmesine engel değildir.
