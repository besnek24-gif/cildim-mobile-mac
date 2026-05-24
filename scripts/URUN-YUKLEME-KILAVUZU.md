# Ürün Yükleme Kılavuzu

Bu belge, **TENVİR** sistemine toplu ürün eklemek için kullanılan JSON/CSV import scriptini açıklar.

---

## Nasıl Kullanılır?

```bash
# Varsayılan dosya (product-import.json)
node scripts/supabase-import.js

# Kendi JSON dosyanız
node scripts/supabase-import.js yeni-urunler.json

# CSV ile yükle
node scripts/supabase-import.js urunler.csv

# Önce test et — veritabanına yazılmaz, badge önizlemesi gösterilir
node scripts/supabase-import.js yeni-urunler.json --dry-run
```

**Çalıştırma yeri:** `artifacts/ciltbakim-mobile/` klasöründen çalıştırın.

---

## Tekrar Önleme (Deduplication)

| Durum | Kontrol Yöntemi |
|-------|----------------|
| `barcode` girildiyse | Barkod üzerinden upsert — en güvenilir |
| `barcode` yoksa | `name + brand` çiftiyle kontrol (büyük/küçük harf duyarsız) |

Aynı ürün bulunursa **güncellenir**, bulunamazsa **yeni eklenir**. Veri kaybı olmaz.

---

## Alan Referansı

### 🔴 Zorunlu Alanlar

| Alan | Açıklama | Örnek |
|------|----------|-------|
| `name` | Ürünün tam adı | `"Hydra Boost Nemlendirici Krem"` |
| `brand` | Marka adı | `"CeraVe"` |

> `barcode` artık zorunlu DEĞİL — girilirse daha güvenilir deduplication sağlar.

---

### 🟠 Önemli Alanlar (Şiddetle Önerilir)

| Alan | Açıklama | Örnek |
|------|----------|-------|
| `category` | Ana kategori | `"Nemlendirici"` |
| `subcategory` | Alt kategori | `"Yüz Kremi"` |
| `short_description` | 1-2 cümlelik kısa özet | `"Hyalüronik asit içeren nem kremi."` |
| `ingredients` | INCI formatında içerik listesi | `"Aqua, Glycerin, Niacinamide, ..."` |
| `image_url` | Tam çözünürlüklü görsel URL | `"https://cdn.site.com/urun.jpg"` |
| `thumbnail_url` | Küçük boyutlu önizleme URL | `"https://cdn.site.com/urun-thumb.jpg"` |

---

### 🌟 Otomatik Rozet Sistemi (YENİ)

Rozet üretimi artık **tamamen otomatik** — elle badge girmenize gerek yok.

| Alan | Tür | Açıklama | Örnek |
|------|-----|----------|-------|
| `features` | `string[]` | Ürünün anahtar özellikleri | `["nemlendirici", "parfümsüz", "seramid"]` |
| `concerns` | `string[]` | Hedef cilt sorunları | `["leke", "kuru cilt", "kırışık"]` |
| `active_ingredients` | `string[]` | Aktif bileşenler | `["niacinamide", "hyaluronic acid"]` |
| `badges` | `string[]` | Manuel rozet geçersiz kılma | `["Leke Karşıtı", "Yoğun Nem"]` — boşsa engine devreye girer |

**Badge Engine Önceliği:**
1. `badges[]` doluysa → olduğu gibi kullanılır (manuel kontrol)
2. `badges[]` boşsa → `features`, `concerns`, `active_ingredients`, `ingredients`, `skin_types`, `tags` üzerinden engine çalışır
3. Engine çıkmazsa → rozet gösterilmez (sahte badge yok)

**`--dry-run` modunda** her ürün için hangi rozetlerin türeceği önizlenir:
```
[1/3] 🔍  Hydra Boost Nemlendirici Krem (CeraVe)
       barkod: 8681234560001
       Alan: 18  |  dermo=82 (iyi)
       rozet[engine]: Yoğun Nem, Bariyer Güçlendirici
```

---

### 🟡 Dermatolojik & Güvenlik Alanları

| Alan | Açıklama | Örnek |
|------|----------|-------|
| `warnings` | Uyarılar | `"Gözle temastan kaçının."` |
| `pregnancy_use` | Hamilelikte kullanım | `"Güvenli — retinol içermez."` |
| `breastfeeding_use` | Emzirmede kullanım | `"Güvenli — parfümsüz formül."` |
| `allergy_info` | Alerjen bilgisi | `"Parfüm ve paraben içermez."` |
| `disclaimer` | Sorumluluk reddi | `"Tıbbi tavsiye yerine geçmez."` |

---

### 🟢 Fayda & Cilt Tipi Alanları

| Alan | Tür | Açıklama |
|------|-----|----------|
| `benefits` | `string[]` | Ürünün faydaları |
| `skin_types` | `string[]` | `"kuru"` `"yağlı"` `"karma"` `"normal"` `"hassas"` `"akneli"` `"olgun"` `"lekeli"` |
| `usage_instructions` | metin | Kullanım talimatları |

---

### 🔵 Ürün Detay Alanları

| Alan | Tür | Örnek |
|------|-----|-------|
| `age_group` | metin | `"18+"` `"3+"` `"Tüm yaşlar"` |
| `size` | metin | `"50 ml"` `"200 g"` |
| `form` | metin | `"Krem"` `"Serum"` `"Jel"` `"Fluid"` `"Toz"` |

---

### 🟣 Katalog & Mağaza Alanları

| Alan | Tür | Örnek |
|------|-----|-------|
| `rating` | sayı | `4.7` |
| `review_count` | tam sayı | `2341` |
| `stock_status` | metin | `"var"` `"yok"` `"sınırlı"` |
| `featured` | boolean | `true` `false` |
| `tags` | `string[]` | `["seramid", "parfümsüz"]` |
| `barcode` | metin | `"8691234567890"` |

---

## Hızlı Şablon (Kopyala & Yapıştır)

```json
[
  {
    "name": "Ürün Adı",
    "brand": "Marka",

    "category": "Nemlendirici",
    "subcategory": "Yüz Kremi",
    "short_description": "Kısa açıklama.",

    "ingredients": "Aqua, Glycerin, Niacinamide, ...",

    "features": ["nemlendirici", "parfümsüz"],
    "concerns": ["kuru cilt", "nem eksikliği"],
    "active_ingredients": ["niacinamide", "glycerin"],

    "benefits": ["Fayda 1", "Fayda 2"],
    "skin_types": ["kuru", "hassas"],

    "usage_instructions": "Sabah ve akşam temizlenmiş cilde uygulayın.",
    "warnings": "Gözle temastan kaçının.",
    "pregnancy_use": "Güvenli — hekiminize danışın.",
    "breastfeeding_use": "Güvenli.",
    "allergy_info": "Parfüm ve paraben içermez.",

    "size": "50 ml",
    "form": "Krem",
    "image_url": "",
    "thumbnail_url": "",

    "rating": 4.5,
    "review_count": 100,
    "stock_status": "var",
    "featured": false,
    "tags": ["etiket1", "etiket2"],
    "disclaimer": "Tıbbi tavsiye yerine geçmez."
  }
]
```

---

## Geçerli `features` Anahtar Kelimeleri

Badge engine bu kelimeleri arar; Türkçe veya İngilizce girebilirsiniz:

| Rozet | Anahtar Kelimeler |
|-------|-------------------|
| **Leke Karşıtı** | `leke`, `vitamin c`, `vitamin-c`, `aydınlatıcı`, `askorbik`, `brightening` |
| **Yoğun Nem** | `nemlendirici`, `nem`, `hyaluronik`, `moisture`, `hydrat` |
| **Yaşlanma Karşıtı** | `anti-aging`, `yaşlanma`, `kırışık`, `retinol`, `peptid` |
| **Güneş Koruma** | `spf`, `güneş`, `uva`, `uvb`, `sunscreen` |
| **Bariyer Güçlendirici** | `seramid`, `ceramide`, `bariyer` |
| **Gözenek Sıkılaştırıcı** | `niacinamide`, `niasinamid`, `gözenek` |
| **Peelingli** | `aha`, `bha`, `peeling`, `salicylic`, `glikolik` |
| **Parfümsüz** | `parfümsüz`, `fragrance-free`, `kokusuz` |
| **Kuru Cilt** | `kuru` (skin_types içinde) |
| **Hassas Cilt** | `hassas` (skin_types içinde) |
| **Vegan** | `vegan` |

---

## Sık Yapılan Hatalar

| Hata | Çözüm |
|------|-------|
| `name` veya `brand` boş | Her üründe bu iki alan zorunludur |
| `features` metin olarak girilmiş | Dizi olmalı: `["...", "..."]` |
| `benefits`, `skin_types`, `tags` metin | Dizi olmalı: `["a", "b"]` |
| `rating` tırnak içinde | Sayı olarak: `4.7` (tırnak yok) |
| `featured` tırnak içinde | Boolean: `true` (tırnak yok) |
| JSON syntax hatası | [jsonlint.com](https://jsonlint.com) ile doğrulayın |

---

## Toplu Yükleme Akışı

```bash
# 1. JSON hazırla (bu dosyayı şablon olarak kullan)
cp scripts/product-import.json scripts/yeni-batch.json
# ... düzenle ...

# 2. Önce test et
node scripts/supabase-import.js scripts/yeni-batch.json --dry-run

# 3. Her şey doğruysa gerçek yükle
node scripts/supabase-import.js scripts/yeni-batch.json

# 4. (Opsiyonel) Yüklenen ürünlerin features/dermo verilerini yenile
node scripts/auto-features.js
```

**Hedef:** 20–50 ürünü birkaç dakikada ekle — badge girmeye, elle hesaplamaya gerek yok.
