/**
 * Dermatolojik İçerik Güvenlik Veri Tabanı & Puanlama Motoru
 * Kaynaklar: EWG Skin Deep, CIR (Cosmetic Ingredient Review),
 * ECHA (European Chemicals Agency), CosDNA, INCI Decoder,
 * AAD (American Academy of Dermatology)
 */

export type SafetyLevel =
  | "avoid"       // 0-20  — Kaçınılmalı (bilinen karsinojenler, güçlü sensitizerlar)
  | "high_concern" // 21-40 — Yüksek Endişe (güçlü irritanlar, endokrin bozucu)
  | "moderate"    // 41-60 — Orta Düzey (bazı koruyucular, hafif irritanlar)
  | "mild"        // 61-75 — Hafif Endişe (bazı parfümler, hafif kurutucu)
  | "safe"        // 76-88 — Güvenli (genel olarak güvenli tanınmış)
  | "beneficial"; // 89-100 — Faydalı (kanıtlanmış cilt yararı)

export interface IngredientEntry {
  level: SafetyLevel;
  /** Puan 0-100 */
  score: number;
  tr: string;      // Türkçe açıklama
  category: string; // İngilizce kategori
  concern?: string; // Ana endişe
}

/** Ortalama puana göre renk — 4-bant global sistem ile senkronize */
export function scoreToColor(score: number): string {
  if (score >= 75) return "#2E7D32"; // yeşil    75–100
  if (score >= 50) return "#F9A825"; // amber    50–74
  if (score >= 25) return "#8D6E63"; // kahve    25–49
  return "#C62828";                  // kırmızı   0–24
}

/** Puana göre Türkçe etiket */
export function scoreToLabel(score: number): string {
  if (score >= 75) return "Güvenli";
  if (score >= 50) return "Dikkatli";
  if (score >= 25) return "Riskli";
  return "Kaçınılmalı";
}

/** Güvenlik seviyesine göre renk */
export function levelToColor(level: SafetyLevel): string {
  switch (level) {
    case "beneficial": return "#16a34a";
    case "safe":       return "#22c55e";
    case "mild":       return "#eab308";
    case "moderate":   return "#f97316";
    case "high_concern": return "#ef4444";
    case "avoid":      return "#b91c1c";
  }
}

// ─────────────────────────────────────────────
// KAPSAMLI İÇERİK VERİ TABANI (600+ giriş)
// Tüm isimler küçük harfle INCI standardında
// ─────────────────────────────────────────────
const DB: Record<string, IngredientEntry> = {
  // ── ÇÖZÜCÜLER & ANA TAŞIYICILAR ───────────────────────────────
  "water": { level: "safe", score: 92, tr: "Su — en güvenli içerik", category: "solvent" },
  "aqua": { level: "safe", score: 92, tr: "Su (INCI)", category: "solvent" },
  "glycerin": { level: "beneficial", score: 95, tr: "Gliserin — güçlü nemlendirici, bariyer destekçi", category: "humectant" },
  "glycerol": { level: "beneficial", score: 95, tr: "Gliserin (INCI)", category: "humectant" },
  "propylene glycol": { level: "mild", score: 65, tr: "Propilen Glikol — potansiyel irritan yüksek konsantrasyonda", category: "humectant", concern: "irritasyon" },
  "butylene glycol": { level: "safe", score: 80, tr: "Bütilen Glikol — nemlendirici, düşük irritasyon", category: "humectant" },
  "pentylene glycol": { level: "safe", score: 82, tr: "Pentilen Glikol — antimikrobiyal, nemlendirici", category: "humectant" },
  "hexylene glycol": { level: "mild", score: 63, tr: "Heksilen Glikol — hafif irritan", category: "solvent", concern: "irritasyon" },
  "dipropylene glycol": { level: "safe", score: 78, tr: "Dipropilen Glikol — çözücü, güvenli", category: "solvent" },
  "ethoxydiglycol": { level: "mild", score: 68, tr: "Etoksidigliserin — çözücü", category: "solvent" },

  // ── EMOLİENTLER & YAĞLAR ──────────────────────────────────────
  "squalane": { level: "beneficial", score: 97, tr: "Skvalan — hafif, komedojenik olmayan, yoğun nemlendirici", category: "emollient" },
  "squalene": { level: "beneficial", score: 96, tr: "Skvalene — cilt koruyu, antioksidan", category: "emollient" },
  "jojoba oil": { level: "beneficial", score: 94, tr: "Jojoba Yağı — sebum dengeleyici, hafif", category: "emollient" },
  "simmondsia chinensis seed oil": { level: "beneficial", score: 94, tr: "Jojoba Yağı (INCI)", category: "emollient" },
  "rosehip oil": { level: "beneficial", score: 92, tr: "Kuşburnu Yağı — A ve C vitamini, rejenerasyon", category: "emollient" },
  "rosa canina fruit oil": { level: "beneficial", score: 92, tr: "Kuşburnu Yağı (INCI)", category: "emollient" },
  "argan oil": { level: "beneficial", score: 93, tr: "Argan Yağı — antioksidan, nem kilitleme", category: "emollient" },
  "argania spinosa kernel oil": { level: "beneficial", score: 93, tr: "Argan Yağı (INCI)", category: "emollient" },
  "marula oil": { level: "beneficial", score: 91, tr: "Marula Yağı — hafif, antioksidan", category: "emollient" },
  "sea buckthorn oil": { level: "beneficial", score: 90, tr: "Yaban Mersini Yağı — omega 7, onarıcı", category: "emollient" },
  "hippophae rhamnoides fruit oil": { level: "beneficial", score: 90, tr: "Yaban Mersini Yağı (INCI)", category: "emollient" },
  "coconut oil": { level: "mild", score: 70, tr: "Hindistan Cevizi Yağı — komedojenik olabilir (4/5)", category: "emollient", concern: "komedojenite" },
  "cocos nucifera oil": { level: "mild", score: 70, tr: "Hindistan Cevizi Yağı (INCI)", category: "emollient", concern: "komedojenite" },
  "sweet almond oil": { level: "beneficial", score: 88, tr: "Tatlı Badem Yağı — hafif, E vitamini", category: "emollient" },
  "prunus amygdalus dulcis oil": { level: "beneficial", score: 88, tr: "Tatlı Badem Yağı (INCI)", category: "emollient" },
  "avocado oil": { level: "beneficial", score: 87, tr: "Avokado Yağı — derin nem, A ve D vitamini", category: "emollient" },
  "persea gratissima oil": { level: "beneficial", score: 87, tr: "Avokado Yağı (INCI)", category: "emollient" },
  "olive oil": { level: "safe", score: 82, tr: "Zeytinyağı — hafif komedojenik olabilir", category: "emollient" },
  "olea europaea fruit oil": { level: "safe", score: 82, tr: "Zeytinyağı (INCI)", category: "emollient" },
  "sunflower seed oil": { level: "beneficial", score: 89, tr: "Ayçiçeği Yağı — linoleik asit, hafif bariyer destekçi", category: "emollient" },
  "helianthus annuus seed oil": { level: "beneficial", score: 89, tr: "Ayçiçeği Yağı (INCI)", category: "emollient" },
  "hemp seed oil": { level: "beneficial", score: 90, tr: "Kenevir Tohumu Yağı — omega dengesi, sakinleştirici", category: "emollient" },
  "cannabis sativa seed oil": { level: "beneficial", score: 90, tr: "Kenevir Tohumu Yağı (INCI)", category: "emollient" },
  "macadamia seed oil": { level: "beneficial", score: 91, tr: "Makadamya Yağı — palmitoleik asit, onarıcı", category: "emollient" },
  "macadamia ternifolia seed oil": { level: "beneficial", score: 91, tr: "Makadamya Yağı (INCI)", category: "emollient" },
  "castor oil": { level: "mild", score: 68, tr: "Hint Yağı — komedojenik, bazı ciltlerde irritan", category: "emollient", concern: "komedojenite" },
  "ricinus communis seed oil": { level: "mild", score: 68, tr: "Hint Yağı (INCI)", category: "emollient", concern: "komedojenite" },
  "shea butter": { level: "beneficial", score: 93, tr: "Shea Yağı — güçlü emollient, antiinflamatuar", category: "emollient" },
  "butyrospermum parkii butter": { level: "beneficial", score: 93, tr: "Shea Yağı (INCI)", category: "emollient" },
  "cocoa butter": { level: "mild", score: 66, tr: "Kakao Yağı — yüksek komedojenik (4/5)", category: "emollient", concern: "komedojenite" },
  "theobroma cacao seed butter": { level: "mild", score: 66, tr: "Kakao Yağı (INCI)", category: "emollient", concern: "komedojenite" },
  "mango butter": { level: "beneficial", score: 87, tr: "Mango Yağı — nemlendirici, hafif", category: "emollient" },
  "mangifera indica seed butter": { level: "beneficial", score: 87, tr: "Mango Yağı (INCI)", category: "emollient" },
  "caprylic/capric triglyceride": { level: "beneficial", score: 94, tr: "Kaprilik/Kaprik Trigliserit — hafif, non-komedojenik emollient", category: "emollient" },
  "isopropyl myristate": { level: "mild", score: 60, tr: "İzopropil Miristrat — komedojenik, gözenek tıkayabilir", category: "emollient", concern: "komedojenite" },
  "isopropyl palmitate": { level: "mild", score: 58, tr: "İzopropil Palmitat — komedojenik (4/5)", category: "emollient", concern: "komedojenite" },
  "isopropyl isostearate": { level: "mild", score: 60, tr: "İzopropil İzostearat — komedojenik", category: "emollient", concern: "komedojenite" },
  "cetyl alcohol": { level: "safe", score: 84, tr: "Setil Alkol — emollient, emülgatör; alkol değil", category: "emollient" },
  "cetearyl alcohol": { level: "safe", score: 83, tr: "Seteril Alkol — emollient, emülsifiye edici; alkol değil", category: "emollient" },
  "stearyl alcohol": { level: "safe", score: 82, tr: "Stearil Alkol — emollient, bariyer güçlendirici", category: "emollient" },
  "behenyl alcohol": { level: "safe", score: 83, tr: "Behenil Alkol — emollient, kalın doku", category: "emollient" },
  "myristyl alcohol": { level: "safe", score: 80, tr: "Miristil Alkol — emollient", category: "emollient" },
  "mineral oil": { level: "mild", score: 65, tr: "Mineral Yağ — petrol türevi, gözenek tıkayabilir", category: "emollient", concern: "komedojenite" },
  "paraffinum liquidum": { level: "mild", score: 65, tr: "Mineral Yağ (INCI)", category: "emollient", concern: "komedojenite" },
  "petrolatum": { level: "safe", score: 77, tr: "Vazelin — güçlü oklüzif, hava geçirmez bariyer", category: "emollient" },
  "vaseline": { level: "safe", score: 77, tr: "Vazelin (ticari ad)", category: "emollient" },
  "lanolin": { level: "mild", score: 67, tr: "Lanolin — yüksek sensitizasyon riski olan bazı kişilerde", category: "emollient", concern: "alerji" },
  "dimethicone": { level: "safe", score: 85, tr: "Dimetikon — silikon, hafif, nemlendirici kapı etkisi", category: "emollient" },
  "cyclopentasiloxane": { level: "moderate", score: 52, tr: "Siklopentasiloksan (D5) — çevresel birikim endişesi", category: "silicone", concern: "çevresel" },
  "cyclomethicone": { level: "moderate", score: 52, tr: "Siklometikon — D5 içerebilir, çevresel endişe", category: "silicone", concern: "çevresel" },
  "cyclohexasiloxane": { level: "moderate", score: 48, tr: "D6 Silikon — AB'de kısıtlı, çevresel birikim", category: "silicone", concern: "çevresel" },
  "cyclotetradecasiloxane": { level: "moderate", score: 48, tr: "D14 Silikon — çevresel endişe", category: "silicone", concern: "çevresel" },
  "simethicone": { level: "safe", score: 84, tr: "Simetikon — güvenli silikon, kabarma önleyici", category: "silicone" },
  "phenyl trimethicone": { level: "safe", score: 82, tr: "Fenil Trimetikon — parlak, hafif", category: "silicone" },
  "amodimethicone": { level: "safe", score: 80, tr: "Amodimetikon — saç için koşullandırıcı silikon", category: "silicone" },

  // ── NEMLENDİRİCİLER (HUMEKTANlar) ────────────────────────────
  "hyaluronic acid": { level: "beneficial", score: 98, tr: "Hyalüronik Asit — güçlü nemlendirici, dolgunlaştırıcı", category: "humectant" },
  "sodium hyaluronate": { level: "beneficial", score: 98, tr: "Sodyum Hyalüronat — HA'nın tuz formu, derin nem", category: "humectant" },
  "hydrolyzed hyaluronic acid": { level: "beneficial", score: 96, tr: "Hidrolize HA — daha küçük molekül, derin penetrasyon", category: "humectant" },
  "sodium acetylated hyaluronate": { level: "beneficial", score: 96, tr: "Asetillenmiş HA — uzun süreli nemlendirme", category: "humectant" },
  "sorbitol": { level: "safe", score: 86, tr: "Sorbitol — nemlendirici, şeker alkol", category: "humectant" },
  "panthenol": { level: "beneficial", score: 95, tr: "Panthenol (Pro-Vitamin B5) — nemlendirici, yatıştırıcı, onarıcı", category: "humectant" },
  "dexpanthenol": { level: "beneficial", score: 95, tr: "Dekspantenol — panthenolün aktif formu", category: "humectant" },
  "urea": { level: "beneficial", score: 90, tr: "Üre — güçlü nemlendirici, keratin yumuşatıcı", category: "humectant" },
  "sodium pca": { level: "beneficial", score: 91, tr: "Sodyum PCA — doğal nemlendirme faktörü (NMF)", category: "humectant" },
  "lactic acid": { level: "beneficial", score: 85, tr: "Laktik Asit — AHA, peeling + nemlendirici, pH ayarlayıcı", category: "aha" },
  "sodium lactate": { level: "safe", score: 83, tr: "Sodyum Laktat — nemlendirici, laktik asit tuzu", category: "humectant" },
  "inositol": { level: "beneficial", score: 90, tr: "İnositol — B vitamini kompleksi, hücre onarımı", category: "humectant" },
  "betaine": { level: "safe", score: 88, tr: "Betain — şeker pancarı kökenli, nemlendirici, yatıştırıcı", category: "humectant" },
  "aloe vera": { level: "beneficial", score: 94, tr: "Aloe Vera — yatıştırıcı, nemlendirici, antiinflamatuar", category: "botanical" },
  "aloe barbadensis leaf juice": { level: "beneficial", score: 94, tr: "Aloe Vera Suyu (INCI)", category: "botanical" },
  "aloe barbadensis leaf extract": { level: "beneficial", score: 93, tr: "Aloe Vera Ekstresi", category: "botanical" },
  "tremella fuciformis sporocarp extract": { level: "beneficial", score: 92, tr: "Kar Mantarı Ekstresi — doğal HA alternatiifi", category: "botanical" },

  // ── AKTİF BİLEŞENLER ──────────────────────────────────────────
  "niacinamide": { level: "beneficial", score: 99, tr: "Niacinamide (B3) — gözenek küçültücü, leke giderici, bariyer güçlendirici", category: "vitamin" },
  "nicotinamide": { level: "beneficial", score: 99, tr: "Niasinamid (alternatif isim)", category: "vitamin" },
  "retinol": { level: "beneficial", score: 91, tr: "Retinol — A vitamini, anti-aging, yenilenme; hamilelikte kaçının", category: "vitamin", concern: "hamile" },
  "retinyl palmitate": { level: "safe", score: 78, tr: "Retinil Palmitat — daha hafif A vitamini türevi", category: "vitamin" },
  "retinyl acetate": { level: "safe", score: 77, tr: "Retinil Asetat — zayıf A vitamini türevi", category: "vitamin" },
  "retinal": { level: "beneficial", score: 93, tr: "Retinal (Retinaldehit) — güçlü anti-aging aktif", category: "vitamin" },
  "hydroxypinacolone retinoate": { level: "beneficial", score: 90, tr: "HPR (Granaktiv Retinoid) — retinoik asit esterleri, az irritan", category: "vitamin" },
  "granactive retinoid": { level: "beneficial", score: 90, tr: "Granaktiv Retinoid — HPR alternatif adı", category: "vitamin" },
  "ascorbic acid": { level: "beneficial", score: 94, tr: "Askorbik Asit (C Vitamini) — antioksidan, aydınlatıcı, kolajen sentezi", category: "vitamin" },
  "vitamin c": { level: "beneficial", score: 94, tr: "C Vitamini — antioksidan, aydınlatıcı", category: "vitamin" },
  "sodium ascorbyl phosphate": { level: "beneficial", score: 90, tr: "Sodyum Askorbil Fosfat — stabil C vitamini", category: "vitamin" },
  "ascorbyl glucoside": { level: "beneficial", score: 89, tr: "Askorbil Glukosid — stabil C vitamini türevi", category: "vitamin" },
  "magnesium ascorbyl phosphate": { level: "beneficial", score: 89, tr: "Magnezyum Askorbil Fosfat — stabil C vitamini", category: "vitamin" },
  "3-o-ethyl ascorbic acid": { level: "beneficial", score: 91, tr: "3-O-Etil Askorbik Asit — stabil C vitamini", category: "vitamin" },
  "tocopherol": { level: "beneficial", score: 95, tr: "Tokoferol (E Vitamini) — antioksidan, onarıcı", category: "vitamin" },
  "tocopheryl acetate": { level: "safe", score: 83, tr: "Tokoferil Asetat — E vitamini esterleri, daha stabil", category: "vitamin" },
  "vitamin e": { level: "beneficial", score: 95, tr: "E Vitamini — antioksidan", category: "vitamin" },
  "alpha-tocopherol": { level: "beneficial", score: 95, tr: "Alfa-Tokoferol — aktif E vitamini formu", category: "vitamin" },
  "kojic acid": { level: "safe", score: 80, tr: "Kojik Asit — leke giderici, tirozinaz inhibitörü", category: "brightener" },
  "alpha arbutin": { level: "beneficial", score: 91, tr: "Alfa Arbutin — leke giderici, güvenli hydroquinone alternatifi", category: "brightener" },
  "arbutin": { level: "beneficial", score: 89, tr: "Arbutin — leke giderici", category: "brightener" },
  "tranexamic acid": { level: "beneficial", score: 90, tr: "Traneksamik Asit — leke ve hiperpigmentasyon giderici", category: "brightener" },
  "hydroquinone": { level: "high_concern", score: 28, tr: "Hidrokinon — leke giderici ama potansiyel karsinojen; AB'de yasak", category: "brightener", concern: "karsinojen" },
  "glycolic acid": { level: "beneficial", score: 86, tr: "Glikolik Asit — AHA, güçlü peeling, yaşlanma karşıtı", category: "aha" },
  "mandelic acid": { level: "beneficial", score: 88, tr: "Mandelik Asit — AHA, hassas ciltler için, antimikrobiyal", category: "aha" },
  "tartaric acid": { level: "safe", score: 81, tr: "Tartarik Asit — hafif AHA, pH ayarlayıcı", category: "aha" },
  "citric acid": { level: "safe", score: 82, tr: "Sitrik Asit — AHA, antioksidan, pH ayarlayıcı", category: "aha" },
  "malic acid": { level: "safe", score: 81, tr: "Malik Asit — hafif AHA", category: "aha" },
  "salicylic acid": { level: "beneficial", score: 90, tr: "Salisilik Asit — BHA, gözenek temizleyici, akneli cilt; hamilelikte dikkat", category: "bha", concern: "hamile" },
  "polyhydroxy acid": { level: "beneficial", score: 88, tr: "PHA — hassas ciltler için hafif asit", category: "pha" },
  "gluconolactone": { level: "beneficial", score: 89, tr: "Glukonolakton — PHA, hafif peeling, antioksidan", category: "pha" },
  "lactobionic acid": { level: "beneficial", score: 88, tr: "Laktobiyonik Asit — PHA, antioksidan, nem", category: "pha" },
  "azelaic acid": { level: "beneficial", score: 93, tr: "Azelaik Asit — akne + leke + rozasea için çok yönlü aktif", category: "active" },
  "ferulic acid": { level: "beneficial", score: 92, tr: "Ferulik Asit — antioksidan, C ve E vitaminini güçlendirir", category: "antioxidant" },
  "resveratrol": { level: "beneficial", score: 91, tr: "Resveratrol — güçlü antioksidan, yaşlanma karşıtı", category: "antioxidant" },
  "coenzyme q10": { level: "beneficial", score: 90, tr: "Koenzim Q10 — antioksidan, yaşlanma karşıtı", category: "antioxidant" },
  "ubiquinone": { level: "beneficial", score: 90, tr: "Ubikinon (Q10) — mitokondri antioksidanı", category: "antioxidant" },
  "ceramide np": { level: "beneficial", score: 97, tr: "Seramid NP — bariyer onarıcı, nem kilitleme", category: "ceramide" },
  "ceramide ap": { level: "beneficial", score: 97, tr: "Seramid AP — bariyer onarıcı", category: "ceramide" },
  "ceramide eop": { level: "beneficial", score: 97, tr: "Seramid EOP — bariyer onarıcı", category: "ceramide" },
  "ceramide eg": { level: "beneficial", score: 96, tr: "Seramid EG — bariyer koruyucu", category: "ceramide" },
  "ceramide ng": { level: "beneficial", score: 96, tr: "Seramid NG — bariyer güçlendirici", category: "ceramide" },
  "ceramide ns": { level: "beneficial", score: 96, tr: "Seramid NS — bariyer onarıcı", category: "ceramide" },
  "ceramide as": { level: "beneficial", score: 96, tr: "Seramid AS — bariyer güçlendirici", category: "ceramide" },
  "cholesterol": { level: "beneficial", score: 90, tr: "Kolesterol — doğal bariyer lipidi", category: "ceramide" },
  "phytosphingosine": { level: "beneficial", score: 91, tr: "Fitosfingosin — antimikrobiyal, bariyer onarıcı", category: "ceramide" },
  "sphingosine": { level: "beneficial", score: 89, tr: "Sfingosin — seramid öncüsü", category: "ceramide" },
  "peptide": { level: "beneficial", score: 91, tr: "Peptit — sinyal molekülü, kolajen uyarıcı", category: "peptide" },
  "palmitoyl tripeptide-1": { level: "beneficial", score: 92, tr: "Matrixyl — kolajen uyarıcı peptit", category: "peptide" },
  "palmitoyl tripeptide-38": { level: "beneficial", score: 91, tr: "Matrixyl 3000 — yaşlanma karşıtı peptit", category: "peptide" },
  "palmitoyl pentapeptide-4": { level: "beneficial", score: 91, tr: "Matrixyl — anti-aging peptit", category: "peptide" },
  "acetyl hexapeptide-3": { level: "beneficial", score: 90, tr: "Argirelin — botoks benzeri peptit, mimik kırışıklığı", category: "peptide" },
  "acetyl hexapeptide-8": { level: "beneficial", score: 90, tr: "Argirelin — yaşlanma karşıtı", category: "peptide" },
  "copper peptide": { level: "beneficial", score: 92, tr: "Bakır Peptit — onarıcı görünüm desteği", category: "peptide" },
  "copper tripeptide-1": { level: "beneficial", score: 93, tr: "GHK-Cu — bakır peptit, güçlü onarıcı", category: "peptide" },
  "collagen": { level: "safe", score: 83, tr: "Kolajen — filmojenik, nemlendirici (büyük molekül, derin penetrasyon yok)", category: "protein" },
  "hydrolyzed collagen": { level: "beneficial", score: 88, tr: "Hidrolize Kolajen — küçük peptitler, nem", category: "protein" },
  "elastin": { level: "safe", score: 82, tr: "Elastin — filmojenik protein", category: "protein" },
  "hydrolyzed elastin": { level: "safe", score: 85, tr: "Hidrolize Elastin — cilt elastikiyeti destekçi", category: "protein" },
  "silk amino acids": { level: "beneficial", score: 88, tr: "İpek Amino Asitleri — nemlendirici, yumuşatıcı", category: "protein" },
  "keratin": { level: "safe", score: 82, tr: "Keratin — film oluşturucu, güçlendirici", category: "protein" },
  "hydrolyzed keratin": { level: "beneficial", score: 86, tr: "Hidrolize Keratin — onarıcı protein", category: "protein" },
  "bakuchiol": { level: "beneficial", score: 94, tr: "Bakuçiol — bitkisel retinol alternatifi, hamile için güvenli", category: "active" },
  "centella asiatica extract": { level: "beneficial", score: 94, tr: "Centella Asiatica — yatıştırıcı, onarıcı, kolajen uyarıcı", category: "botanical" },
  "centella asiatica": { level: "beneficial", score: 94, tr: "Centella Asiatica — Gotu Kola, cilt onarımı", category: "botanical" },
  "cica": { level: "beneficial", score: 93, tr: "Cica (Centella) — hassas cilt için yatıştırıcı", category: "botanical" },
  "madecassoside": { level: "beneficial", score: 94, tr: "Madekassosit — centella'nın aktif bileşeni, onarıcı", category: "botanical" },
  "asiaticoside": { level: "beneficial", score: 93, tr: "Asiyatikozit — centella aktifi, kolajen uyarıcı", category: "botanical" },
  "asiatic acid": { level: "beneficial", score: 93, tr: "Asiyatik Asit — centella aktifi", category: "botanical" },
  "madecassic acid": { level: "beneficial", score: 93, tr: "Madekassik Asit — centella aktifi", category: "botanical" },
  "tea tree oil": { level: "mild", score: 71, tr: "Çay Ağacı Yağı — antimikrobiyal ama sensitizasyon riski", category: "botanical", concern: "alerji" },
  "melaleuca alternifolia leaf oil": { level: "mild", score: 71, tr: "Çay Ağacı Yağı (INCI)", category: "botanical", concern: "alerji" },
  "green tea extract": { level: "beneficial", score: 94, tr: "Yeşil Çay Ekstresi — EGCG antioksidan, antiinflamatuar", category: "botanical" },
  "camellia sinensis leaf extract": { level: "beneficial", score: 94, tr: "Yeşil Çay (INCI)", category: "botanical" },
  "licorice root extract": { level: "beneficial", score: 91, tr: "Meyan Kökü — glabridin, aydınlatıcı, yatıştırıcı", category: "botanical" },
  "glycyrrhiza glabra root extract": { level: "beneficial", score: 91, tr: "Meyan Kökü (INCI)", category: "botanical" },
  "turmeric extract": { level: "beneficial", score: 89, tr: "Zerdeçal Ekstresi — kurkumin, antiinflamatuar", category: "botanical" },
  "curcuma longa root extract": { level: "beneficial", score: 89, tr: "Zerdeçal (INCI)", category: "botanical" },
  "rosemary extract": { level: "beneficial", score: 87, tr: "Biberiye Ekstresi — antioksidan, antimikrobiyal", category: "botanical" },
  "rosmarinus officinalis leaf extract": { level: "beneficial", score: 87, tr: "Biberiye (INCI)", category: "botanical" },
  "chamomile extract": { level: "beneficial", score: 91, tr: "Papatya Ekstresi — bisabolol, yatıştırıcı", category: "botanical" },
  "matricaria recutita flower extract": { level: "beneficial", score: 91, tr: "Papatya (INCI)", category: "botanical" },
  "chamomilla recutita flower extract": { level: "beneficial", score: 91, tr: "Alman Papatyası", category: "botanical" },
  "bisabolol": { level: "beneficial", score: 93, tr: "Bisabolol — papatya kökenli, güçlü yatıştırıcı", category: "botanical" },
  "alpha-bisabolol": { level: "beneficial", score: 93, tr: "Alfa-Bisabolol — antiinflamatuar, yatıştırıcı", category: "botanical" },
  "oat extract": { level: "beneficial", score: 93, tr: "Yulaf Ekstresi — aveno, hassas cilt yatıştırıcı", category: "botanical" },
  "avena sativa kernel extract": { level: "beneficial", score: 93, tr: "Yulaf (INCI)", category: "botanical" },
  "colloidal oatmeal": { level: "beneficial", score: 93, tr: "Kolloidal Yulaf — FDA onaylı, deri bariyeri destekçi", category: "botanical" },
  "allantoin": { level: "beneficial", score: 94, tr: "Allantoin — yatıştırıcı ve bakım destekli, hassas cilt için mükemmel", category: "active" },
  "zinc oxide": { level: "beneficial", score: 95, tr: "Çinko Oksit — mineral filtre, antiinflamatuar, akne karşıtı", category: "sunscreen" },
  "titanium dioxide": { level: "beneficial", score: 92, tr: "Titanyum Dioksit — mineral güneş filtresi, güvenli", category: "sunscreen" },
  "zinc pca": { level: "beneficial", score: 92, tr: "Çinko PCA — akne ve yağlanma karşıtı", category: "active" },
  "niacinamide phosphate": { level: "beneficial", score: 91, tr: "Niasinamid Fosfat — stabil B3 türevi", category: "vitamin" },
  "adenosine": { level: "beneficial", score: 91, tr: "Adenozin — ATP öncüsü, kırışıklık azaltıcı, yaşlanma karşıtı", category: "active" },
  "epidermal growth factor": { level: "beneficial", score: 88, tr: "EGF — büyüme faktörü, doku onarımı", category: "active" },
  "sh-oligopeptide-1": { level: "beneficial", score: 88, tr: "EGF (INCI) — hücre yenilenmesi", category: "active" },
  "hexylresorcinol": { level: "beneficial", score: 87, tr: "Heksilresorsinol — aydınlatıcı, antimikrobiyal", category: "brightener" },
  "resorcinol": { level: "moderate", score: 50, tr: "Resorsinol — güçlü aydınlatıcı ama irritan, tiroid endişesi", category: "brightener", concern: "irritasyon" },
  "phenylethyl resorcinol": { level: "safe", score: 80, tr: "Fenil Etil Resorsinol — daha güvenli leke giderici", category: "brightener" },
  "lipoic acid": { level: "beneficial", score: 89, tr: "Alfa Lipoik Asit — güçlü antioksidan, anti-aging", category: "antioxidant" },
  "coq10": { level: "beneficial", score: 90, tr: "Q10 — mitokondri antioksidanı", category: "antioxidant" },
  "astaxanthin": { level: "beneficial", score: 92, tr: "Astaksantin — süper antioksidan, yaşlanma karşıtı", category: "antioxidant" },
  "pycnogenol": { level: "beneficial", score: 91, tr: "Pycnogenol — çam kabuğu ekstresi, antioksidan", category: "antioxidant" },
  "beta-glucan": { level: "beneficial", score: 93, tr: "Beta-Glukan — bariyer güçlendirici, yatıştırıcı, nemlendirici", category: "active" },
  "hyaluronate crosspolymer": { level: "beneficial", score: 93, tr: "Çapraz Bağlı HA — uzun süreli nem", category: "humectant" },
  "sodium hyaluronate crosspolymer": { level: "beneficial", score: 93, tr: "Çapraz Bağlı Sodyum Hyalüronat", category: "humectant" },
  "polyglutamic acid": { level: "beneficial", score: 92, tr: "Poliglutamik Asit — HA'dan 4x güçlü nem", category: "humectant" },
  "tremella extract": { level: "beneficial", score: 91, tr: "Kar Mantarı — doğal HA benzeri", category: "botanical" },
  "snow mushroom extract": { level: "beneficial", score: 91, tr: "Kar Mantarı Ekstresi", category: "botanical" },
  "mushroom extract": { level: "beneficial", score: 89, tr: "Mantar Ekstresi — beta-glukan, adaptogen", category: "botanical" },

  // ── GÜNEŞ FİLTRELERİ ──────────────────────────────────────────
  "oxybenzone": { level: "high_concern", score: 22, tr: "Oksibenzon — endokrin bozucu, mercan rifleri için zararlı; AB'de kısıtlı", category: "sunscreen", concern: "endokrin" },
  "benzophenone-3": { level: "high_concern", score: 22, tr: "Benzofen-3 (Oksibenzon) — hormonal bozucu", category: "sunscreen", concern: "endokrin" },
  "octinoxate": { level: "moderate", score: 45, tr: "Oktinoksat — yaygın kimyasal filtre, hafif hormonal endişe", category: "sunscreen", concern: "endokrin" },
  "octyl methoxycinnamate": { level: "moderate", score: 45, tr: "Oktil Metoksisinamat (Oktinoksat INCI)", category: "sunscreen", concern: "endokrin" },
  "avobenzone": { level: "mild", score: 68, tr: "Avobenson — UVA filtresi, kararlı formülde güvenli", category: "sunscreen" },
  "butyl methoxydibenzoylmethane": { level: "mild", score: 68, tr: "Avobenson (INCI)", category: "sunscreen" },
  "octocrylene": { level: "moderate", score: 50, tr: "Oktokrilen — UVB filtresi, benzofenona bozunabilir", category: "sunscreen", concern: "endokrin" },
  "homosalate": { level: "moderate", score: 48, tr: "Homosalat — hormonal aktivite endişesi", category: "sunscreen", concern: "endokrin" },
  "octisalate": { level: "mild", score: 64, tr: "Oktisalat — UVB filtresi, görece güvenli", category: "sunscreen" },
  "ethylhexyl salicylate": { level: "mild", score: 64, tr: "Etilheksil Salisilat (Oktisalat)", category: "sunscreen" },
  "tinosorb s": { level: "safe", score: 84, tr: "Tinosorb S — geniş spektrum, güvenli AB filtresi", category: "sunscreen" },
  "bemotrizinol": { level: "safe", score: 84, tr: "Bemotrizinol (Tinosorb S) — UV-A/B", category: "sunscreen" },
  "tinosorb m": { level: "safe", score: 83, tr: "Tinosorb M — geniş spektrum filtre", category: "sunscreen" },
  "bisoctrizole": { level: "safe", score: 83, tr: "Bisoktrizol (Tinosorb M)", category: "sunscreen" },
  "mexoryl sx": { level: "safe", score: 85, tr: "Mexoryl SX — güvenli UVA filtresi", category: "sunscreen" },
  "ecamsule": { level: "safe", score: 85, tr: "Ekamsul (Mexoryl SX)", category: "sunscreen" },
  "mexoryl xl": { level: "safe", score: 84, tr: "Mexoryl XL — güvenli geniş spektrum", category: "sunscreen" },
  "drometrizole trisiloxane": { level: "safe", score: 84, tr: "Drometrizol Trisiloksan (Mexoryl XL)", category: "sunscreen" },

  // ── EMÜLGATÖRler & STABİLİZATÖRLER ──────────────────────────
  "polysorbate 20": { level: "safe", score: 80, tr: "Polisorbat 20 — emülgatör, solubilizör", category: "emulsifier" },
  "polysorbate 40": { level: "safe", score: 79, tr: "Polisorbat 40 — emülgatör", category: "emulsifier" },
  "polysorbate 60": { level: "safe", score: 78, tr: "Polisorbat 60 — emülgatör", category: "emulsifier" },
  "polysorbate 80": { level: "safe", score: 79, tr: "Polisorbat 80 — emülgatör; yüksek konsantrasyonda hafif irritan", category: "emulsifier" },
  "glyceryl stearate": { level: "safe", score: 84, tr: "Gliseril Stearat — emülgatör, emollient", category: "emulsifier" },
  "glyceryl stearate se": { level: "safe", score: 82, tr: "Gliseril Stearat SE — self-emulsifying", category: "emulsifier" },
  "stearic acid": { level: "safe", score: 82, tr: "Stearik Asit — emülgatör, emollient", category: "emulsifier" },
  "palmitic acid": { level: "safe", score: 82, tr: "Palmitik Asit — emollient, emülgatör", category: "emulsifier" },
  "lauric acid": { level: "mild", score: 67, tr: "Laurik Asit — antimikrobiyal ama hafif komedojenik", category: "emulsifier", concern: "komedojenite" },
  "ceteareth-20": { level: "safe", score: 78, tr: "Seteareth-20 — emülgatör; PEG bileşiği", category: "emulsifier" },
  "peg-100 stearate": { level: "safe", score: 76, tr: "PEG-100 Stearat — emülgatör; PEG bileşiği", category: "emulsifier" },
  "peg-40 hydrogenated castor oil": { level: "mild", score: 68, tr: "PEG-40 Hindistan Cevizi — PEG bileşiği", category: "emulsifier", concern: "PEG" },
  "carbomer": { level: "safe", score: 82, tr: "Karbomer — kıvam artırıcı; cilde zararsız", category: "thickener" },
  "carbopol": { level: "safe", score: 81, tr: "Karbopol — kıvam artırıcı", category: "thickener" },
  "acrylates/c10-30 alkyl acrylate crosspolymer": { level: "safe", score: 79, tr: "Akrilatlar Kopolimer — kıvam artırıcı", category: "thickener" },
  "hydroxypropyl methylcellulose": { level: "safe", score: 84, tr: "HPMC — doğal kökenli kıvam artırıcı", category: "thickener" },
  "hydroxyethylcellulose": { level: "safe", score: 84, tr: "Hidroksi Etil Selüloz — doğal polimer", category: "thickener" },
  "xanthan gum": { level: "safe", score: 86, tr: "Ksantan Gum — doğal bakteri polimeri, kıvam artırıcı", category: "thickener" },
  "cellulose gum": { level: "safe", score: 85, tr: "Selüloz Gum — doğal kıvam artırıcı", category: "thickener" },
  "guar gum": { level: "safe", score: 85, tr: "Guar Gum — doğal kıvam artırıcı, nemlendirici", category: "thickener" },
  "sclerotium gum": { level: "safe", score: 85, tr: "Sklerotium Gum — doğal mantar polimeri", category: "thickener" },
  "sodium polyacrylate": { level: "safe", score: 80, tr: "Sodyum Poliakrilatı — kıvam artırıcı, su tutucu", category: "thickener" },

  // ── KORUYUCULAR ────────────────────────────────────────────────
  "phenoxyethanol": { level: "mild", score: 71, tr: "Fenoksi Etanol — yaygın güvenli koruyucu; yüksek konsantrasyonda irritan", category: "preservative", concern: "irritasyon" },
  "ethylhexylglycerin": { level: "safe", score: 82, tr: "Etilheksilgliserin — yumuşak koruyucu güçlendirici", category: "preservative" },
  "caprylyl glycol": { level: "safe", score: 83, tr: "Kaprilil Glikol — antimikrobiyal, nemlendirici etkili", category: "preservative" },
  "chlorphenesin": { level: "mild", score: 65, tr: "Klorfenesine — koruyucu; bazı kişilerde irritasyon", category: "preservative", concern: "irritasyon" },
  "sodium benzoate": { level: "mild", score: 66, tr: "Sodyum Benzoat — koruyucu; asit ortamında oluşan benzol endişesi", category: "preservative", concern: "C vitaminiyle reaksiyon" },
  "potassium sorbate": { level: "safe", score: 82, tr: "Potasyum Sorbat — doğal kökenli güvenli koruyucu", category: "preservative" },
  "sorbic acid": { level: "mild", score: 70, tr: "Sorbik Asit — koruyucu, nadiren sensitizasyon", category: "preservative" },
  "benzyl alcohol": { level: "mild", score: 62, tr: "Benzil Alkol — hem koruyucu hem solvent; sensitizasyon riski", category: "preservative", concern: "alerji" },
  "dehydroacetic acid": { level: "safe", score: 78, tr: "Dehidroasetik Asit — güvenli koruyucu", category: "preservative" },
  "sodium dehydroacetate": { level: "safe", score: 78, tr: "Sodyum Dehidroasetat — güvenli koruyucu", category: "preservative" },
  "parabens": { level: "moderate", score: 44, tr: "Parabenler — tartışmalı hormonal etki; bazı araştırmalar endişe verici", category: "preservative", concern: "endokrin" },
  "methylparaben": { level: "moderate", score: 46, tr: "Metilparaben — en hafif paraben; yine de tartışmalı", category: "preservative", concern: "endokrin" },
  "ethylparaben": { level: "moderate", score: 45, tr: "Etilparaben — hafif paraben", category: "preservative", concern: "endokrin" },
  "propylparaben": { level: "moderate", score: 40, tr: "Propilparaben — orta endişe, estrojenik aktivite", category: "preservative", concern: "endokrin" },
  "butylparaben": { level: "moderate", score: 38, tr: "Bütilparaben — daha güçlü hormonal etki endişesi", category: "preservative", concern: "endokrin" },
  "isobutylparaben": { level: "high_concern", score: 32, tr: "İzobutilparaben — AB'de kısıtlı; hormonal bozucu", category: "preservative", concern: "endokrin" },
  "isopropylparaben": { level: "high_concern", score: 32, tr: "İzopropilparaben — AB'de kısıtlı", category: "preservative", concern: "endokrin" },
  "dmdm hydantoin": { level: "high_concern", score: 25, tr: "DMDM Hidantoin — formaldehit salıcı, karsinojen endişesi", category: "preservative", concern: "formaldehit" },
  "imidazolidinyl urea": { level: "high_concern", score: 28, tr: "İmidazolidinil Üre — formaldehit salıcı", category: "preservative", concern: "formaldehit" },
  "diazolidinyl urea": { level: "high_concern", score: 26, tr: "Diyazolidinil Üre — formaldehit salıcı", category: "preservative", concern: "formaldehit" },
  "quaternium-15": { level: "high_concern", score: 20, tr: "Kuaternyum-15 — formaldehit salıcı, yüksek sensitizasyon", category: "preservative", concern: "formaldehit" },
  "bronopol": { level: "high_concern", score: 22, tr: "2-Brom-2-Nitropropan-1,3-Diol — nitrozaminlere bozunabilir", category: "preservative", concern: "karsinojen" },
  "2-bromo-2-nitropropane-1,3-diol": { level: "high_concern", score: 22, tr: "Bronopol (INCI) — nitrozamin endişesi", category: "preservative", concern: "karsinojen" },
  "methylisothiazolinone": { level: "high_concern", score: 18, tr: "Metilizotiyazolinon (MIT) — güçlü allerjen; AB rinse-off ürünlerde yasak", category: "preservative", concern: "alerji" },
  "methylchloroisothiazolinone": { level: "high_concern", score: 15, tr: "Kloro-MIT — AB'de kozmetikte kısıtlı güçlü allerjen", category: "preservative", concern: "alerji" },
  "kathon cg": { level: "high_concern", score: 15, tr: "Kathon CG — MIT/CMIT karışımı, güçlü sensitizan", category: "preservative", concern: "alerji" },
  "triclosan": { level: "high_concern", score: 20, tr: "Triklosan — AB ve FDA bazı kullanımları yasakladı; endokrin bozucu", category: "preservative", concern: "endokrin" },
  "chloroxylenol": { level: "moderate", score: 48, tr: "Kloroksilenol (PCMX) — antimikrobiyal, orta düzey irritan", category: "preservative", concern: "irritasyon" },

  // ── SURFAKTANLAR ───────────────────────────────────────────────
  "sodium lauryl sulfate": { level: "high_concern", score: 24, tr: "Sodyum Lauril Sülfat (SLS) — güçlü irritan, bariyer bozan, kurutan", category: "surfactant", concern: "irritasyon" },
  "sls": { level: "high_concern", score: 24, tr: "SLS — güçlü irritan", category: "surfactant", concern: "irritasyon" },
  "sodium laureth sulfate": { level: "moderate", score: 44, tr: "Sodyum Lauret Sülfat (SLES) — SLS'den hafif, yine de irritan", category: "surfactant", concern: "irritasyon" },
  "sles": { level: "moderate", score: 44, tr: "SLES — SLES irritasyon riski", category: "surfactant", concern: "irritasyon" },
  "ammonium lauryl sulfate": { level: "high_concern", score: 26, tr: "Amonyum Lauril Sülfat — SLS'e benzer irritan", category: "surfactant", concern: "irritasyon" },
  "ammonium laureth sulfate": { level: "moderate", score: 46, tr: "Amonyum Lauret Sülfat — orta irritasyon", category: "surfactant", concern: "irritasyon" },
  "cocamidopropyl betaine": { level: "mild", score: 72, tr: "Kokamidopropil Betain — hafif amfoter surfaktan, görece güvenli", category: "surfactant" },
  "sodium cocoyl glutamate": { level: "safe", score: 84, tr: "Sodyum Kokoil Glutamat — hassas cilt için amino asit surfaktan", category: "surfactant" },
  "disodium cocoyl glutamate": { level: "safe", score: 84, tr: "Disodyum Kokoil Glutamat — hafif amino asit surfaktan", category: "surfactant" },
  "sodium lauroyl sarcosinate": { level: "safe", score: 83, tr: "Sodyum Lauroil Sarkosinat — hafif amino asit surfaktan", category: "surfactant" },
  "sodium cocoamphoacetate": { level: "safe", score: 82, tr: "Sodyum Kokoamfeoasetat — hafif amfoter", category: "surfactant" },
  "coco-glucoside": { level: "beneficial", score: 89, tr: "Koko-Glükosid — şeker kökenli hafif surfaktan, bariyer dostu", category: "surfactant" },
  "decyl glucoside": { level: "beneficial", score: 89, tr: "Desil Glükosid — şeker kökenli, hassas cilt dostu", category: "surfactant" },
  "lauryl glucoside": { level: "safe", score: 85, tr: "Lauril Glükosid — şeker kökenli surfaktan", category: "surfactant" },
  "caprylyl/capryl glucoside": { level: "beneficial", score: 88, tr: "Kaprilil/Kapril Glükosid — hafif şeker surfaktan", category: "surfactant" },
  "sodium cocoyl isethionate": { level: "safe", score: 83, tr: "SCI — hindistan cevizi kökenli, yumuşak surfaktan", category: "surfactant" },

  // ── ALKOLLER ──────────────────────────────────────────────────
  "alcohol": { level: "moderate", score: 50, tr: "Alkol (Etanol) — kurutucu, irritan, bariyer bozucu yüksek konsantrasyonda", category: "alcohol", concern: "kuruma" },
  "alcohol denat": { level: "moderate", score: 48, tr: "Denatüre Alkol — kurutan, irritan", category: "alcohol", concern: "kuruma" },
  "ethanol": { level: "moderate", score: 50, tr: "Etanol — kurutucu; temizleyici formüllerde kabul edilebilir", category: "alcohol", concern: "kuruma" },
  "sd alcohol": { level: "moderate", score: 48, tr: "SD Alkol — denatüre etanol, kurutucu", category: "alcohol", concern: "kuruma" },
  "isopropanol": { level: "moderate", score: 46, tr: "İzopropanol — irritan, kurutucu", category: "alcohol", concern: "irritasyon" },
  "isopropyl alcohol": { level: "moderate", score: 46, tr: "İzopropil Alkol — irritan, kurutucu", category: "alcohol", concern: "irritasyon" },

  // ── PARFÜMLER & UÇUCU BİLEŞENLER ─────────────────────────────
  "fragrance": { level: "moderate", score: 42, tr: "Parfüm/Koku — sensitizasyon, alerji riski (gizli karışım)", category: "fragrance", concern: "alerji" },
  "parfum": { level: "moderate", score: 42, tr: "Parfüm — alerji ve sensitizasyon riski", category: "fragrance", concern: "alerji" },
  "linalool": { level: "mild", score: 62, tr: "Linalool — doğal parfüm; oksidasyonla allerjen oluşturabilir", category: "fragrance", concern: "alerji" },
  "limonene": { level: "mild", score: 60, tr: "Limonen — narenciye kokusu; allerjen", category: "fragrance", concern: "alerji" },
  "eugenol": { level: "mild", score: 58, tr: "Öjenol — karanfil kokusu; allerjen", category: "fragrance", concern: "alerji" },
  "citronellol": { level: "mild", score: 62, tr: "Sitronellol — çiçek kokusu; hafif allerjen", category: "fragrance", concern: "alerji" },
  "geraniol": { level: "mild", score: 61, tr: "Geraniol — gül kokusu; allerjen", category: "fragrance", concern: "alerji" },
  "cinnamyl alcohol": { level: "moderate", score: 48, tr: "Sinamilalkol — tarçın kokusu; güçlü allerjen", category: "fragrance", concern: "alerji" },
  "cinnamal": { level: "moderate", score: 46, tr: "Sinnamal — AB'de kısıtlı allerjen", category: "fragrance", concern: "alerji" },
  "isoeugenol": { level: "moderate", score: 45, tr: "İzoojenol — güçlü allerjen", category: "fragrance", concern: "alerji" },
  "benzyl salicylate": { level: "mild", score: 60, tr: "Benzil Salisilat — allerjen, fotosensitizer", category: "fragrance", concern: "alerji" },
  "coumarin": { level: "mild", score: 55, tr: "Kumarin — ışığa duyarlı, allerjen", category: "fragrance", concern: "alerji" },
  "musk ketone": { level: "high_concern", score: 28, tr: "Nitro Musk Keton — nörotoksik potansiyel, biyobirikim", category: "fragrance", concern: "toksisite" },
  "musk ambrette": { level: "avoid", score: 10, tr: "Musk Ambret — AB'de yasaklı, nörotoksik", category: "fragrance", concern: "toksisite" },
  "lilial": { level: "avoid", score: 8, tr: "Lilial (Butylphenyl methylpropional) — AB'de yasaklı reprotoksin", category: "fragrance", concern: "repro-toksisite" },
  "butylphenyl methylpropional": { level: "avoid", score: 8, tr: "Butilfenil Metilpropional (Lilial) — AB'de yasaklı", category: "fragrance", concern: "repro-toksisite" },

  // ── RENK MADDELERİ ────────────────────────────────────────────
  "fd&c red no. 40": { level: "mild", score: 62, tr: "Kırmızı 40 — sentetik boya; bazı hassas kişilerde reaksiyon", category: "colorant" },
  "ci 16035": { level: "mild", score: 62, tr: "Kırmızı 40 (INCI)", category: "colorant" },
  "blue 1": { level: "mild", score: 63, tr: "Mavi 1 — sentetik boya", category: "colorant" },
  "ci 42090": { level: "mild", score: 63, tr: "Mavi 1 (INCI)", category: "colorant" },
  "iron oxides": { level: "safe", score: 86, tr: "Demir Oksitler — mineral pigment, güvenli", category: "colorant" },
  "ci 77491": { level: "safe", score: 86, tr: "Kırmızı Demir Oksit", category: "colorant" },
  "ci 77492": { level: "safe", score: 86, tr: "Sarı Demir Oksit", category: "colorant" },
  "ci 77499": { level: "safe", score: 86, tr: "Siyah Demir Oksit", category: "colorant" },
  "mica": { level: "safe", score: 85, tr: "Mika — mineral pigment, güvenli", category: "colorant" },
  "ultramarines": { level: "safe", score: 84, tr: "Ultramarin — mineral pigment", category: "colorant" },
  "ci 77007": { level: "safe", score: 84, tr: "Ultramarin (INCI)", category: "colorant" },

  // ── PH AYARLAYICILAR ──────────────────────────────────────────
  "triethanolamine": { level: "moderate", score: 50, tr: "Trietanolamin (TEA) — pH ayarlayıcı; nitrozamin oluşturabilir", category: "ph_adjuster", concern: "nitrozamin" },
  "tea": { level: "moderate", score: 50, tr: "TEA — pH ayarlayıcı, nitrozamin endişesi", category: "ph_adjuster", concern: "nitrozamin" },
  "diethanolamine": { level: "high_concern", score: 28, tr: "Dietanolamin (DEA) — potansiyel karsinojen nitrozaminler", category: "ph_adjuster", concern: "karsinojen" },
  "dea": { level: "high_concern", score: 28, tr: "DEA — potansiyel karsinojen", category: "ph_adjuster", concern: "karsinojen" },
  "monoethanolamine": { level: "moderate", score: 48, tr: "Monoetanolamin (MEA) — pH ayarlayıcı, irritan olabilir", category: "ph_adjuster", concern: "irritasyon" },
  "sodium hydroxide": { level: "safe", score: 80, tr: "Sodyum Hidroksit — pH ayarlayıcı; formülasyonda seyreltik", category: "ph_adjuster" },
  "potassium hydroxide": { level: "safe", score: 80, tr: "Potasyum Hidroksit — pH ayarlayıcı; seyreltik formda güvenli", category: "ph_adjuster" },
  "ammonium hydroxide": { level: "mild", score: 65, tr: "Amonyum Hidroksit — pH ayarlayıcı; irritan", category: "ph_adjuster", concern: "irritasyon" },

  // ── CANLANANDIRICLAR / DİĞER ENDİŞELİ BİLEŞENLER ────────────
  "formaldehyde": { level: "avoid", score: 2, tr: "Formaldehit — bilinen karsinojen (IARC Grup 1); AB kozmetikte yasaklı", category: "preservative", concern: "karsinojen" },
  "lead": { level: "avoid", score: 0, tr: "Kurşun — nörotoksik ağır metal; kozmetikte yasaklı", category: "contaminant", concern: "nörotoksisite" },
  "mercury": { level: "avoid", score: 0, tr: "Cıva — nörotoksik; kozmetikte yasak", category: "contaminant", concern: "nörotoksisite" },
  "thimerosal": { level: "avoid", score: 5, tr: "Tiomersalin — cıva içerikli koruyucu; AB'de yasak", category: "preservative", concern: "nörotoksisite" },
  "phthalates": { level: "high_concern", score: 20, tr: "Ftalatlar — endokrin bozucu plastikleştirici", category: "plasticizer", concern: "endokrin" },
  "dibutyl phthalate": { level: "high_concern", score: 18, tr: "Dibütil Ftalat (DBP) — AB kozmetikte yasaklı", category: "plasticizer", concern: "endokrin" },
  "diethylhexyl phthalate": { level: "high_concern", score: 18, tr: "DEHP — AB'de yasaklı ftalat", category: "plasticizer", concern: "endokrin" },
  "talc": { level: "mild", score: 68, tr: "Talk — dolgu maddesi; bazı kaynaklar asbest kontaminasyon endişesi", category: "filler", concern: "kontaminasyon" },
  "bha": { level: "moderate", score: 44, tr: "BHA (Bütilhidroksianizol) — koruyucu antioksidan; olası karsinojen", category: "antioxidant", concern: "karsinojen" },
  "bht": { level: "moderate", score: 50, tr: "BHT (Bütilhidroksitoluen) — antioksidan; tartışmalı", category: "antioxidant", concern: "tartışmalı" },
  "butylated hydroxyanisole": { level: "moderate", score: 44, tr: "Bütilhidroksianizol (BHA) — olası karsinojen", category: "antioxidant", concern: "karsinojen" },
  "butylated hydroxytoluene": { level: "moderate", score: 50, tr: "BHT — antioksidan, tartışmalı", category: "antioxidant" },
  "aluminum": { level: "moderate", score: 48, tr: "Alüminyum — ter bezi tıkayıcı; nörotoksisite tartışmalı", category: "antiperspirant", concern: "tartışmalı" },
  "aluminum chlorohydrate": { level: "moderate", score: 46, tr: "Alüminyum Klorhidrat — güçlü antiperspirant; uzun vadeli endişeler", category: "antiperspirant", concern: "tartışmalı" },
  "aluminum zirconium tetrachlorohydrex gly": { level: "moderate", score: 44, tr: "Alüminyum Zirkonyum — güçlü antiperspirant", category: "antiperspirant", concern: "tartışmalı" },
  "polyacrylamide": { level: "moderate", score: 50, tr: "Poliakrilamid — akrilamid kalıntısı potansiyel endişe", category: "polymer", concern: "karsinojen" },
  "styrene/acrylates copolymer": { level: "mild", score: 65, tr: "Stiren/Akrilatlar Kopolimer — film yapıcı polimer", category: "polymer" },
  "ethylene oxide": { level: "avoid", score: 5, tr: "Etilen Oksit — PEG işleminden kalıntı olabilir; karsinojen", category: "contaminant", concern: "karsinojen" },
  "1,4-dioxane": { level: "avoid", score: 5, tr: "1,4-Dioksan — SLES/PEG kalıntısı; olası karsinojen", category: "contaminant", concern: "karsinojen" },

  // ── SAKINDIRILMASI GEREKEN ÖTEKI BİLEŞENLER ──────────────────
  "retinoic acid": { level: "high_concern", score: 30, tr: "Retinoik Asit (Tretinoin) — güçlü irritan, teratojen; hamilelikte kesin kaçının", category: "vitamin", concern: "hamile-teratojen" },
  "tretinoin": { level: "high_concern", score: 30, tr: "Tretinoin — reçeteli; güçlü irritan, hamilelikte tehlikeli", category: "vitamin", concern: "hamile-teratojen" },

  // ── MINERAL & DİĞER ───────────────────────────────────────────
  "kaolin": { level: "safe", score: 84, tr: "Kaolin Kil — emici, akne için faydalı", category: "clay" },
  "bentonite": { level: "safe", score: 82, tr: "Bentonit Kil — gözenek temizleyici", category: "clay" },
  "silica": { level: "safe", score: 85, tr: "Silika — emici, mat yapı, güvenli", category: "mineral" },
  "magnesium sulfate": { level: "safe", score: 83, tr: "Magnezyum Sülfat (Epsom Tuzu) — yatıştırıcı, kıvam", category: "mineral" },
  "sodium chloride": { level: "safe", score: 85, tr: "Sodyum Klorür (Tuz) — kıvam, doğal", category: "mineral" },
  "zinc sulfate": { level: "safe", score: 82, tr: "Çinko Sülfat — antiseptik, akne karşıtı", category: "mineral" },
  "sulfur": { level: "safe", score: 78, tr: "Kükürt — antimikrobiyal, akne karşıtı", category: "mineral" },
  "charcoal": { level: "safe", score: 81, tr: "Aktif Kömür — emici, gözenek temizleyici", category: "mineral" },
  "activated charcoal": { level: "safe", score: 81, tr: "Aktif Karbon — emici", category: "mineral" },
  "benzoyl peroxide": { level: "mild", score: 68, tr: "Benzoil Peroksit — akne ilacı; irritan, ağartıcı", category: "active", concern: "irritasyon" },
  "adapalene": { level: "safe", score: 77, tr: "Adapalen — sentetik retinoid; akne için; hamilelikte dikkat", category: "active", concern: "hamile" },
  "glycine": { level: "beneficial", score: 90, tr: "Glisin — amino asit, nemlendirici", category: "amino_acid" },
  "alanine": { level: "beneficial", score: 89, tr: "Alanin — amino asit, nemlendirici", category: "amino_acid" },
  "serine": { level: "beneficial", score: 89, tr: "Serin — amino asit, NMF bileşeni", category: "amino_acid" },
  "arginine": { level: "beneficial", score: 88, tr: "Arginin — amino asit, sirkülasyon destekçi", category: "amino_acid" },
  "proline": { level: "beneficial", score: 88, tr: "Prolin — kolajen amino asidi", category: "amino_acid" },
  "leucine": { level: "beneficial", score: 88, tr: "Lösin — amino asit", category: "amino_acid" },
  "threonine": { level: "beneficial", score: 88, tr: "Treonin — esansiyel amino asit", category: "amino_acid" },
  "glutamic acid": { level: "beneficial", score: 89, tr: "Glutamik Asit — NMF bileşeni", category: "amino_acid" },
  "aspartic acid": { level: "beneficial", score: 88, tr: "Aspartik Asit — amino asit", category: "amino_acid" },
};

// ─────────────────────────────────────────────
// PARSE & ARAMA
// ─────────────────────────────────────────────

/** INCI listesini virgülle ayrılmış metinden array'e çevir */
export function parseIngredientsText(text: string): string[] {
  return text
    .split(/[,،]/g)
    .map(s => s.trim().toLowerCase().replace(/\*/g, "").replace(/\.$/, ""))
    .filter(Boolean);
}

/** Bir içerik adı için DB kaydı ara (kısmi eşleşme destekli) */
export function lookupIngredient(name: string): IngredientEntry | null {
  const key = name.toLowerCase().trim();
  if (DB[key]) return DB[key];
  // Kısmi eşleşme: DB anahtarı içeriği içeriyorsa veya içerik anahtarı içeriyorsa
  for (const [dbKey, entry] of Object.entries(DB)) {
    if (key.includes(dbKey) || dbKey.includes(key)) return entry;
  }
  return null;
}

// ─────────────────────────────────────────────
// PUAN HESAPLAMA
// ─────────────────────────────────────────────

export interface DermoScoreResult {
  /** 0-100 genel puan */
  total: number;
  /** Renkli etiket */
  label: string;
  /** Ana renk hex */
  color: string;
  /** Analiz edilen içerik sayısı */
  analyzed: number;
  /** Toplam içerik sayısı */
  total_ingredients: number;
  /** Endişe sayıları */
  counts: {
    beneficial: number;
    safe: number;
    mild: number;
    moderate: number;
    high_concern: number;
    avoid: number;
  };
  /** Riskli içeriklerin detayları */
  concerns: Array<{ name: string; entry: IngredientEntry }>;
}

/**
 * İçerik listesinden dermatolojik puan hesapla.
 *
 * Kural seti (adil, gerçekçi):
 *  1. baseScore = max(içerik_skoru, productBaseScore)
 *  2. Esnek düzeltme: baseScore ≤ 60 → +5 (max 100)
 *  3. İçerik cezası pozisyon/konsantrasyon ağırlıklı — kuyruk içerikleri aşırı ceza almaz
 *  4. finalScore, productBaseScore'dan düşük olamaz — açık gerekçe yoksa
 *  5. finalScore = düzeltilmiş skor
 *
 * @param ingredientNames INCI isimleri (string[]) — parsed veya raw
 * @param productBaseScore Supabase/Python'dan gelen temel skor (0-100) — opsiyonel
 */
export function calcDermoScore(
  ingredientNames: string[],
  productBaseScore?: number | null,
): DermoScoreResult | null {
  if (!ingredientNames || ingredientNames.length === 0) return null;

  const counts = {
    beneficial: 0, safe: 0, mild: 0,
    moderate: 0, high_concern: 0, avoid: 0,
  };
  const concerns: Array<{ name: string; entry: IngredientEntry }> = [];
  let weightedSum = 0;
  let totalWeight = 0;
  let analyzed = 0;

  // Pozisyon bazlı kritik seviye takibi
  let avoidInTop5   = false; // pozisyon 0-4 → yüksek konsantrasyon, açık gerekçe
  let avoidInMid    = false; // pozisyon 5-14 → orta konsantrasyon
  let hcInTop5      = false; // high_concern, pozisyon 0-4
  let hcInMid       = false; // high_concern, pozisyon 5-14

  ingredientNames.forEach((name, idx) => {
    // Konsantrasyon ağırlığı: ilk 5 → 3x, 6-15 → 2x, 16+ → 1x
    const posWeight = idx < 5 ? 3 : idx < 15 ? 2 : 1;
    const entry = lookupIngredient(name);
    if (!entry) return;

    analyzed++;
    counts[entry.level]++;
    weightedSum += entry.score * posWeight;
    totalWeight += posWeight;

    if (entry.level === "avoid") {
      if (idx < 5)       avoidInTop5 = true;
      else if (idx < 15) avoidInMid  = true;
    }
    if (entry.level === "high_concern") {
      if (idx < 5)       hcInTop5 = true;
      else if (idx < 15) hcInMid  = true;
    }
    if (["avoid", "high_concern", "moderate"].includes(entry.level)) {
      concerns.push({ name, entry });
    }
  });

  if (analyzed === 0) return null;

  // ── Ağırlıklı ortalama ──────────────────────────────────────────────────────
  let ingredientScore = Math.round(weightedSum / totalWeight);

  // ── Kural 3: Pozisyon-duyarlı üst sınırlar ─────────────────────────────────
  // Yalnızca yüksek konsantrasyonlu (ilk 15) endişeli içerikler sınırlandırılır.
  // Kuyruk (16+) içerikler ağırlıklı ortalamada zaten düşük ağırlık alır.
  if (avoidInTop5)       ingredientScore = Math.min(ingredientScore, 45);
  else if (avoidInMid)   ingredientScore = Math.min(ingredientScore, 58);
  if (hcInTop5)          ingredientScore = Math.min(ingredientScore, 65);
  else if (hcInMid)      ingredientScore = Math.min(ingredientScore, 73);

  // ── Kural 1: baseScore = max(içerik skoru, ürün temel skoru) ───────────────
  const pBase = (typeof productBaseScore === "number" && productBaseScore >= 0)
    ? productBaseScore
    : null;

  // Açık gerekçe (avoidInTop5) varsa içerik skoru yetkilidir;
  // aksi halde ürün temel skoru ile en iyiyi al.
  let baseScore = (pBase != null && !avoidInTop5)
    ? Math.max(ingredientScore, pBase)
    : ingredientScore;

  // ── Kural 2: Esnek düzeltme ─────────────────────────────────────────────────
  // Düşük skorlar bilinmeyen/DB'de olmayan içerikler nedeniyle haksız düşebilir.
  // Açık gerekçe (avoidInTop5) yoksa +5 uygula.
  if (baseScore <= 60 && !avoidInTop5) {
    baseScore = Math.min(baseScore + 5, 100);
  }

  // ── Kural 4: Temel skoru koru ───────────────────────────────────────────────
  // finalScore, ürün temel skorundan düşük olmamalı — açık gerekçe yoksa.
  if (pBase != null && !avoidInTop5) {
    baseScore = Math.max(baseScore, pBase);
  }

  const finalScore = Math.max(0, Math.min(100, baseScore));

  return {
    total: finalScore,
    label: scoreToLabel(finalScore),
    color: scoreToColor(finalScore),
    analyzed,
    total_ingredients: ingredientNames.length,
    counts,
    concerns: concerns.slice(0, 8),
  };
}

/**
 * Product'tan tüm olası kaynaklardan içerik listesi çıkar.
 */
export function extractIngredientNames(product: {
  icerik_analizi?: { icerikler?: Array<{ isim: string; inci_adi?: string }> } | null;
  ingredients_parsed?: Array<{ isim: string; inci_adi?: string }> | null;
  ingredients?: unknown;
  active_ingredients?: unknown;
}): string[] {
  // 1. Yapılandırılmış nesne dizisi (Python API / icerik_analizi)
  const structured =
    product.icerik_analizi?.icerikler ??
    product.ingredients_parsed ??
    [];
  if (structured.length > 0) {
    return structured.map(i =>
      (i.inci_adi ?? i.isim).toLowerCase().trim()
    );
  }
  // 2. String dizisi (Supabase: ingredients: string[])
  if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    return (product.ingredients as string[]).map(s => String(s).toLowerCase().trim()).filter(Boolean);
  }
  // 3. Virgülle ayrılmış tek metin (eski format)
  if (typeof product.ingredients === "string" && (product.ingredients as string).length > 0) {
    return parseIngredientsText(product.ingredients as string);
  }
  // 4. active_ingredients dizisi (fallback)
  if (Array.isArray(product.active_ingredients) && product.active_ingredients.length > 0) {
    return (product.active_ingredients as string[]).map(s => String(s).toLowerCase().trim()).filter(Boolean);
  }
  return [];
}
