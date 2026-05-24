import { resolveFeature, type FeatureKey, type FeatureVerdict } from "./features/featureTruth";

/**
 * Optional pre-resolved verdict map. When supplied, buildQuickBadges reads
 * verdicts from here instead of calling resolveFeature() per key. Used by
 * product detail to share ONE truth map between quickBadges and the safety
 * alert engine — eliminates 11 resolveFeature calls per render down to 6
 * (single shared computation upstream). All other callsites pass undefined
 * and the function falls back to per-key resolveFeature() (legacy behavior).
 */
export type FeatureTruthMap = Partial<Record<FeatureKey, FeatureVerdict>>;

export type RiskLevel = "safe" | "low_risk" | "medium_risk" | "high_risk" | "unknown";

export interface IngredientInfo {
  nameTr: string;
  level: RiskLevel;
  desc: string;
}

export interface ParsedIngredient {
  name: string;
  nameTr: string;
  level: RiskLevel;
  desc: string;
}

export interface IngredientSummary {
  total: number;
  safe: number;
  low: number;
  medium: number;
  high: number;
  unknown: number;
  rating: "cok_iyi" | "iyi" | "orta" | "dikkat" | "riskli";
  ratingLabel: string;
  ratingColor: string;
  warnings: string[];
}

export type BadgeStatus = "positive" | "negative" | "unknown";

export interface QuickBadge {
  key: string;
  positiveLabel: string;
  negativeLabel: string;
  unknownLabel: string;
  status: BadgeStatus;
}

const DB: Record<string, IngredientInfo> = {
  "parfum":                    { level: "high_risk",   nameTr: "Parfüm / Koku",           desc: "Alerjik reaksiyonlara yol açabilir. Hassas ciltlerde tahrişe neden olabilir." },
  "fragrance":                 { level: "high_risk",   nameTr: "Parfüm / Koku",           desc: "Koku bileşeni. Birçok alerjen içerebilir." },
  "alcohol denat":             { level: "high_risk",   nameTr: "Denatüre Alkol",          desc: "Kurutucu alkol. Cilt bariyerini bozabilir, uzun vadede hassaslaştırabilir." },
  "denatured alcohol":         { level: "high_risk",   nameTr: "Denatüre Alkol",          desc: "Kurutucu alkol. Cilt bariyerini bozabilir." },
  "sd alcohol":                { level: "high_risk",   nameTr: "Alkol (SD)",              desc: "Kurutucu alkol. Cilt bariyerini zayıflatabilir." },
  "isopropyl alcohol":         { level: "high_risk",   nameTr: "İzopropil Alkol",         desc: "Kurutucu alkol. Cildi tahriş edebilir." },
  "sodium lauryl sulfate":     { level: "high_risk",   nameTr: "SLS",                     desc: "Güçlü yüzey aktif madde. Cilt bariyerini bozabilir ve tahrişe yol açabilir." },
  "methylisothiazolinone":     { level: "high_risk",   nameTr: "MIT / Metilizotiyazolinon",desc: "Güçlü koruyucu. Alerjik kontakt dermatite neden olabilir." },
  "methylchloroisothiazolinone":{ level: "high_risk",  nameTr: "MCI",                     desc: "Güçlü biyosit. AB'de rinse-off ürünlerde kısıtlanmıştır." },
  "formaldehyde":              { level: "high_risk",   nameTr: "Formaldehit",             desc: "Kanserojen. Pek çok ülkede kozmetikte yasaktır." },
  "dmdm hydantoin":            { level: "high_risk",   nameTr: "DMDM Hidantoin",          desc: "Formaldehit salımlı koruyucu. Tahriş edici olabilir." },
  "methylparaben":             { level: "high_risk",   nameTr: "Metilparaben",            desc: "Paraben koruyucu. Hormonal aktivite gösterebilir." },
  "propylparaben":             { level: "high_risk",   nameTr: "Propilparaben",           desc: "Paraben koruyucu. Hormonal aktivite gösterebilir." },
  "butylparaben":              { level: "high_risk",   nameTr: "Bütilparaben",            desc: "Paraben koruyucu. Hormonal bozucu etkisi şüpheli." },
  "ethylparaben":              { level: "high_risk",   nameTr: "Etilparaben",             desc: "Paraben grubu koruyucu." },
  "isobutylparaben":           { level: "high_risk",   nameTr: "İzobütilparaben",         desc: "Paraben koruyucu. Hormonal aktivite gösterebilir." },
  "triclosan":                 { level: "high_risk",   nameTr: "Triklosan",               desc: "Antibakteriyal ajan. Hormonal bozucu etkisi şüpheli, kısıtlanmıştır." },
  "oxybenzone":                { level: "high_risk",   nameTr: "Oksibenzoon",             desc: "UV filtre. Hormonal bozucu etkisi tartışmalıdır." },
  "benzophenone-3":            { level: "high_risk",   nameTr: "Benzofenon-3",            desc: "UV filtre. Hormonal bozucu etkisi şüpheli." },
  "bht":                       { level: "high_risk",   nameTr: "BHT",                     desc: "Sentetik antioksidan. Yüksek dozda hormonal bozucu etkisi gösterebilir." },
  "bha":                       { level: "high_risk",   nameTr: "BHA",                     desc: "Sentetik antioksidan. Hormonal bozucu etkisi tartışmalıdır." },
  "limonene":                  { level: "medium_risk", nameTr: "Limonen",                 desc: "Turunçgil kokusu bileşeni. AB tarafından alerjen olarak etiketlenmelidir." },
  "linalool":                  { level: "medium_risk", nameTr: "Linalol",                 desc: "Çiçek kokusu bileşeni. Potansiyel alerjen." },
  "citronellol":               { level: "medium_risk", nameTr: "Sitronelol",              desc: "Çiçek kokusu bileşeni. Potansiyel alerjen." },
  "cinnamal":                  { level: "medium_risk", nameTr: "Sinnamal",                desc: "Tarçın kokusu. Güçlü alerjen." },
  "eugenol":                   { level: "medium_risk", nameTr: "Öjenol",                  desc: "Karanfil kokusu bileşeni. Alerjen olabilir." },
  "geraniol":                  { level: "medium_risk", nameTr: "Geraniol",                desc: "Çiçek kokusu bileşeni. Potansiyel alerjen." },
  "coumarin":                  { level: "medium_risk", nameTr: "Kumarin",                 desc: "Tatlı koku bileşeni. Alerjen olarak bildirilmesi gerekir." },
  "phenoxyethanol":            { level: "medium_risk", nameTr: "Fenoksietanol",           desc: "Yaygın koruyucu. Düşük konsantrasyonda güvenli, yüksekte tahriş edebilir." },
  "benzyl alcohol":            { level: "medium_risk", nameTr: "Benzil Alkol",            desc: "Çözücü ve koruyucu. Bazı kişilerde hassasiyet oluşturabilir." },
  "chlorphenesin":             { level: "medium_risk", nameTr: "Klorfenesim",             desc: "Koruyucu madde. Bazı kişilerde tahriş yapabilir." },
  "sodium laureth sulfate":    { level: "medium_risk", nameTr: "SLES",                    desc: "SLS'ye göre daha hafif sülfat türevi. Hassas ciltlerde dikkat gerektirir." },
  "ammonium laureth sulfate":  { level: "medium_risk", nameTr: "Amonyum Lauret Sülfat",   desc: "Sülfat türevi yüzey aktif madde." },
  "propylene glycol":          { level: "medium_risk", nameTr: "Propilen Glikol",         desc: "Nemlendirici ve çözücü. Hassas ciltlerde alerji yapabilir." },
  "menthol":                   { level: "medium_risk", nameTr: "Mentol",                  desc: "Soğutma hissi verir. Hassas ve kuru ciltlerde tahriş edebilir." },
  "isopropyl myristate":       { level: "medium_risk", nameTr: "İzopropil Miristrat",     desc: "Emollient. Akneye yatkın ciltlerde komedojenik olabilir." },
  "isopropyl palmitate":       { level: "medium_risk", nameTr: "İzopropil Palmitat",      desc: "Emollient. Akneye yatkın ciltlerde dikkat gerektirir." },
  "water":                     { level: "safe",        nameTr: "Su",                      desc: "Formülün temel çözücüsü. Tamamen güvenli." },
  "aqua":                      { level: "safe",        nameTr: "Su",                      desc: "Formülün temel çözücüsü. Tamamen güvenli." },
  "glycerin":                  { level: "safe",        nameTr: "Gliserin",                desc: "Güçlü nemlendirici. Tüm cilt tipleri için güvenli ve etkili." },
  "glycerol":                  { level: "safe",        nameTr: "Gliserin",                desc: "Güçlü nemlendirici. Tüm cilt tipleri için güvenli." },
  "glycerine":                 { level: "safe",        nameTr: "Gliserin",                desc: "Güçlü nemlendirici." },
  "hyaluronic acid":           { level: "safe",        nameTr: "Hiyalüronik Asit",        desc: "Güçlü nemlendirici. 1000 katı ağırlığında su tutar." },
  "sodium hyaluronate":        { level: "safe",        nameTr: "Sodyum Hiyaluronat",      desc: "Hiyalüronik asidin küçük moleküllü formu. Daha derin emilir." },
  "niacinamide":               { level: "safe",        nameTr: "Niasinamid (B3 Vitamini)", desc: "Cilt tonu eşitler, por görünümünü azaltır, bariyer fonksiyonunu güçlendirir." },
  "panthenol":                 { level: "safe",        nameTr: "Panthenol (B5 Vitamini)", desc: "Nemlendirici ve yatıştırıcı. Cilt bariyerini destekler." },
  "dexpanthenol":              { level: "safe",        nameTr: "Deksapanthenol",          desc: "Panthenol türevi. Onarıcı ve nemlendirici." },
  "tocopherol":                { level: "safe",        nameTr: "Tokoferol (E Vitamini)",  desc: "Antioksidan. Cildi serbest radikallere karşı korur." },
  "tocopheryl acetate":        { level: "safe",        nameTr: "E Vitamini Asetat",       desc: "E Vitamini türevi antioksidan. Stabil form." },
  "ascorbic acid":             { level: "safe",        nameTr: "C Vitamini",              desc: "Güçlü antioksidan. Aydınlatıcı ve kolajen sentezini destekler." },
  "sodium ascorbyl phosphate": { level: "safe",        nameTr: "Sodyum Askorbil Fosfat",  desc: "Stabil C Vitamini formu. Aydınlatıcı etkisi var." },
  "ascorbyl glucoside":        { level: "safe",        nameTr: "Askorbil Glukosid",       desc: "Stabil C Vitamini türevi. Yavaş salımlı." },
  "retinol":                   { level: "safe",        nameTr: "Retinol (A Vitamini)",    desc: "Anti-aging bileşen. Kırışıklık ve leke görünümünü azaltır." },
  "retinyl palmitate":         { level: "safe",        nameTr: "Retinil Palmitat",        desc: "Hafif A Vitamini türevi. Anti-aging etkisi var." },
  "retinaldehyde":             { level: "safe",        nameTr: "Retinal",                 desc: "Güçlü A Vitamini türevi. Retinolden daha etkili." },
  "allantoin":                 { level: "safe",        nameTr: "Alantoin",                desc: "Yatıştırıcı ve onarıcı destek. Tahriş olmuş cildi sakinleştirir." },
  "bisabolol":                 { level: "safe",        nameTr: "Bisabolol",               desc: "Papatyadan elde edilir. Güçlü yatıştırıcı ve anti-inflamatuvar." },
  "centella asiatica":         { level: "safe",        nameTr: "Centella Asiatica",       desc: "Yatıştırıcı ve onarıcı destek. Kolajen sentezini destekler." },
  "centella asiatica extract": { level: "safe",        nameTr: "Centella Asiatica Özütü", desc: "Yatıştırıcı ve onarıcı." },
  "madecassoside":             { level: "safe",        nameTr: "Madekasosid",             desc: "Centella'dan elde edilir. Güçlü yatıştırıcı." },
  "asiaticoside":              { level: "safe",        nameTr: "Asiyatikosid",            desc: "Centella bileşeni. Yatıştırıcı ve onarıcı destek." },
  "aloe vera":                 { level: "safe",        nameTr: "Aloe Vera",               desc: "Yatıştırıcı ve nemlendirici. Hassas ciltlere uygundur." },
  "aloe barbadensis":          { level: "safe",        nameTr: "Aloe Vera",               desc: "Yatıştırıcı ve nemlendirici." },
  "squalane":                  { level: "safe",        nameTr: "Skualan",                 desc: "Hafif nemlendirici yağ. Komedojenik değil, tüm cilt tiplerine uygun." },
  "jojoba":                    { level: "safe",        nameTr: "Jojoba",                  desc: "Cilt yapısına benzer yapısıyla mükemmel nemlendirici." },
  "simmondsia chinensis":      { level: "safe",        nameTr: "Jojoba Yağı",             desc: "Doğal nemlendirici. Tüm cilt tiplerine uygun." },
  "ceramide":                  { level: "safe",        nameTr: "Seramid",                 desc: "Cilt bariyerinin temel yapı taşı. Nem kaybını önler." },
  "ceramide np":               { level: "safe",        nameTr: "Seramid NP",              desc: "Doğal seramid türü. Cilt bariyerini destekler." },
  "ceramide ap":               { level: "safe",        nameTr: "Seramid AP",              desc: "Doğal seramid türü. Cilt bariyerini destekler." },
  "ceramide eop":              { level: "safe",        nameTr: "Seramid EOP",             desc: "Doğal seramid türü. Cilt bariyerini destekler." },
  "ceramide ng":               { level: "safe",        nameTr: "Seramid NG",              desc: "Doğal seramid türü." },
  "shea butter":               { level: "safe",        nameTr: "Shea Yağı",               desc: "Zengin nemlendirici. Kuru ciltler için idealdir." },
  "butyrospermum parkii":      { level: "safe",        nameTr: "Shea Yağı",               desc: "Zengin yağ asitleri içerir." },
  "zinc oxide":                { level: "safe",        nameTr: "Çinko Oksit",             desc: "Mineral UV filtre. Hassas ciltler için güvenli, anti-inflamatuvar." },
  "titanium dioxide":          { level: "safe",        nameTr: "Titanyum Dioksit",        desc: "Mineral UV filtre. Hassas ciltler için güvenli." },
  "salicylic acid":            { level: "safe",        nameTr: "Salisilik Asit",          desc: "BHA. Akne ve gözenek temizliğinde etkili." },
  "lactic acid":               { level: "safe",        nameTr: "Laktik Asit",             desc: "AHA. Hafif peeling etkisi. Cilt dokusunu düzeltir." },
  "glycolic acid":             { level: "safe",        nameTr: "Glikolik Asit",           desc: "Güçlü AHA. Cilt yenilenmesini hızlandırır." },
  "mandelic acid":             { level: "safe",        nameTr: "Mandelik Asit",           desc: "Nazik AHA. Hassas ciltlere uygundur." },
  "azelaic acid":              { level: "safe",        nameTr: "Azelaik Asit",            desc: "Akne ve leke görünümü için sıkça tercih edilen, yatıştırıcı destek sağlayan içerik." },
  "tranexamic acid":           { level: "safe",        nameTr: "Traneksamik Asit",        desc: "Cilt tonu eşitleme rutinlerinde kullanılan güçlü bir aydınlatıcı destek." },
  "kojic acid":                { level: "safe",        nameTr: "Koji Asidi",              desc: "Aydınlatıcı. Leke görünümünü azaltır." },
  "arbutin":                   { level: "safe",        nameTr: "Arbutin",                 desc: "Aydınlatıcı. Leke görünümünü azaltır." },
  "alpha arbutin":             { level: "safe",        nameTr: "Alfa-Arbutin",            desc: "Leke görünümünü hafifletmeye yardımcı aydınlatıcı destek." },
  "green tea":                 { level: "safe",        nameTr: "Yeşil Çay",               desc: "Güçlü antioksidan. Anti-aging etki sağlar." },
  "camellia sinensis":         { level: "safe",        nameTr: "Yeşil Çay Özütü",         desc: "Antioksidan ve anti-inflamatuvar." },
  "caffeine":                  { level: "safe",        nameTr: "Kafein",                  desc: "Kan dolaşımını uyarır. Şişlik ve morluklara karşı etkili." },
  "ferulic acid":              { level: "safe",        nameTr: "Ferulik Asit",            desc: "Antioksidan. C ve E vitaminiyle sinerjik etki gösterir." },
  "adenosine":                 { level: "safe",        nameTr: "Adenosin",                desc: "Anti-aging. Kırışıklıklara karşı etkili." },
  "resveratrol":               { level: "safe",        nameTr: "Resveratrol",             desc: "Güçlü antioksidan. Üzüm çekirdeğinden elde edilir." },
  "colloidal oatmeal":         { level: "safe",        nameTr: "Kolloidal Yulaf",          desc: "Güçlü yatıştırıcı. Egzama ve hassas ciltler için idealdir." },
  "avena sativa":              { level: "safe",        nameTr: "Yulaf",                   desc: "Yatıştırıcı ve anti-inflamatuvar." },
  "beta-glucan":               { level: "safe",        nameTr: "Beta-Glukan",             desc: "Nemlendirici. Cilt bariyerini güçlendirir." },
  "xanthan gum":               { level: "safe",        nameTr: "Ksantan Gam",             desc: "Doğal kıvam verici. Güvenli." },
  "citric acid":               { level: "safe",        nameTr: "Sitrik Asit",             desc: "pH düzenleyici. Doğal kaynaklı, güvenli." },
  "sodium hydroxide":          { level: "safe",        nameTr: "Sodyum Hidroksit",        desc: "pH düzenleyici. Son üründe etkisizdir." },
  "potassium sorbate":         { level: "safe",        nameTr: "Potasyum Sorbat",         desc: "Doğal koruyucu. Güvenli alternatif koruyucu." },
  "mica":                      { level: "safe",        nameTr: "Mika",                    desc: "Mineral pigment. Güvenli." },
  "zinc pyrithione":           { level: "safe",        nameTr: "Çinko Pirition",          desc: "Antifungal ve antibakteriyal. Kepeğe karşı etkili." },
  "dimethicone":               { level: "low_risk",    nameTr: "Dimetikon (Silikon)",      desc: "Yumuşatıcı silikon. Biyolojik olarak aktif değil." },
  "cyclomethicone":            { level: "low_risk",    nameTr: "Siklometikon (Silikon)",   desc: "Hafif silikon. Çevre etkileri tartışmalıdır." },
  "cyclopentasiloxane":        { level: "low_risk",    nameTr: "D5 Silikon",              desc: "Hafif silikon. AB'de bazı kısıtlamalar mevcut." },
  "cyclotetrasiloxane":        { level: "low_risk",    nameTr: "D4 Silikon",              desc: "Silikon türevi. Çevre etkileri tartışmalıdır." },
  "phenyl trimethicone":       { level: "low_risk",    nameTr: "Fenil Trimetikon",        desc: "Silikon türevi. Parlaklık verir." },
  "carbomer":                  { level: "low_risk",    nameTr: "Karbomer",                desc: "Kıvam verici polimer. Genel olarak güvenli." },
  "polysorbate 20":            { level: "low_risk",    nameTr: "Polisorbat 20",           desc: "Emülgatör. Genel olarak güvenli." },
  "polysorbate 80":            { level: "low_risk",    nameTr: "Polisorbat 80",           desc: "Emülgatör. Genel olarak güvenli." },
  "sodium benzoate":           { level: "low_risk",    nameTr: "Sodyum Benzoat",          desc: "Koruyucu madde. C vitaminiyle birlikte benzen oluşturabilir." },
  "disodium edta":             { level: "low_risk",    nameTr: "Disodyum EDTA",           desc: "Şelatör. Çevresel etkileri tartışmalıdır." },
  "edta":                      { level: "low_risk",    nameTr: "EDTA",                    desc: "Şelatör. Çevresel etkileri tartışmalıdır." },
};

const NON_VEGAN = ["beeswax", "cera alba", "honey", "mel", "carmine", "ci 75470", "lanolin", "collagen", "keratin", "silk", "serica", "casein", "shellac", "tallow", "lard", "gelatin", "squalene"];
const PARABEN_KW = ["paraben"];
const SULFATE_KW = ["sulfate", "sulphate"];
const FRAGRANCE_KW = ["parfum", "fragrance"];
const ALCOHOL_KW = ["alcohol denat", "sd alcohol", "denatured alcohol", "isopropyl alcohol"];
const SILICONE_KW = ["silicone", "dimethicone", "cyclomethicone", "cyclopentasiloxane", "cyclotetrasiloxane", "siloxane", "trimethicone"];

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function matchDB(name: string): IngredientInfo | null {
  const n = normalize(name);
  if (DB[n]) return DB[n];
  for (const key of Object.keys(DB)) {
    if (n.includes(key) || key.includes(n)) return DB[key];
  }
  return null;
}

export function parseIngredients(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => s.trim()).filter(Boolean);
  return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

export function getIngredientInfo(name: string): ParsedIngredient {
  const match = matchDB(name);
  return {
    name,
    nameTr: match?.nameTr ?? name,
    level: match?.level ?? "unknown",
    desc: match?.desc ?? "Bu içerik hakkında dermatolojik veri bulunamadı.",
  };
}

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "safe":        return "#15803d";
    case "low_risk":    return "#0891b2";
    case "medium_risk": return "#d97706";
    case "high_risk":   return "#dc2626";
    default:            return "#6b7280";
  }
}

export function getRiskLevelBg(level: RiskLevel): string {
  switch (level) {
    case "safe":        return "#dcfce7";
    case "low_risk":    return "#e0f2fe";
    case "medium_risk": return "#fef3c7";
    case "high_risk":   return "#fee2e2";
    default:            return "#f3f4f6";
  }
}

export function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case "safe":        return "Güvenli";
    case "low_risk":    return "Düşük Risk";
    case "medium_risk": return "Orta Risk";
    case "high_risk":   return "Dikkat";
    default:            return "Bilinmiyor";
  }
}

function containsAny(ingredients: string[], keywords: string[]): boolean {
  const lc = ingredients.map(normalize);
  return keywords.some(kw => lc.some(ing => ing.includes(kw)));
}

export function buildIngredientSummary(rawIngredients: string | string[] | null | undefined): IngredientSummary {
  const list = parseIngredients(rawIngredients);
  if (list.length === 0) {
    return { total: 0, safe: 0, low: 0, medium: 0, high: 0, unknown: 0, rating: "orta", ratingLabel: "Veri Yok", ratingColor: "#6b7280", warnings: [] };
  }

  const parsed = list.map(getIngredientInfo);
  const safe    = parsed.filter(p => p.level === "safe").length;
  const low     = parsed.filter(p => p.level === "low_risk").length;
  const medium  = parsed.filter(p => p.level === "medium_risk").length;
  const high    = parsed.filter(p => p.level === "high_risk").length;
  const unknown = parsed.filter(p => p.level === "unknown").length;
  const total   = list.length;

  const riskRatio = (high * 3 + medium * 1.5) / total;
  let rating: IngredientSummary["rating"];
  let ratingLabel: string;
  let ratingColor: string;

  if (high === 0 && medium <= 1 && riskRatio < 0.1) {
    rating = "cok_iyi"; ratingLabel = "Çok İyi"; ratingColor = "#15803d";
  } else if (high <= 1 && riskRatio < 0.2) {
    rating = "iyi"; ratingLabel = "İyi"; ratingColor = "#16a34a";
  } else if (high <= 2 && riskRatio < 0.35) {
    rating = "orta"; ratingLabel = "Orta"; ratingColor = "#d97706";
  } else if (high <= 3 && riskRatio < 0.5) {
    rating = "dikkat"; ratingLabel = "Dikkat"; ratingColor = "#ea580c";
  } else {
    rating = "riskli"; ratingLabel = "Riskli"; ratingColor = "#dc2626";
  }

  const warnings: string[] = [];
  if (containsAny(list, FRAGRANCE_KW)) warnings.push("Parfüm / koku içeriyor — hassas ciltlerde tahriş riski");
  if (containsAny(list, ALCOHOL_KW))   warnings.push("Kurutucu alkol içeriyor — cilt bariyerini zayıflatabilir");
  if (containsAny(list, PARABEN_KW))   warnings.push("Paraben içeriyor — hormonal aktivite şüphesi");
  if (containsAny(list, SULFATE_KW))   warnings.push("Sülfat içeriyor — cilt bariyerini bozabilir");
  if (parsed.filter(p => p.level === "high_risk").length === 0 && warnings.length === 0) {
    warnings.push("Belirgin risk sinyali tespit edilmedi");
  }

  return { total, safe, low, medium, high, unknown, rating, ratingLabel, ratingColor, warnings };
}

/**
 * D1 fix (Unified Ingredient Truth): badges now derive from the canonical
 * `resolveFeature(product, key)` source. Same verdicts feed both these
 * badges AND the safety alert engine (via extractBadgeStatus → resolveFeature),
 * eliminating the badge ↔ "Veri Eksik" conflicts documented in the D0 audit.
 *
 * Polarity mapping (matches extractBadgeStatus in compareProducts.ts):
 *   non-vegan keys: true  (contains)  → "negative"
 *                   false (free of)   → "positive"
 *   vegan key:      true  (is vegan)  → "positive"
 *                   false (not vegan) → "negative"
 *   null (no signal in any source)    → "unknown"
 *
 * Performance: resolveFeature uses a per-product, content-keyed WeakMap
 * verdict cache. Six calls here cost effectively the same as one — all
 * subsequent consumers (compareProducts, safetyAlertEngine, productWarnings)
 * get cache hits within the same render cycle.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildQuickBadges(product: any, preResolved?: FeatureTruthMap): QuickBadge[] {
  const make = (
    key: FeatureKey,
    positiveLabel: string,
    negativeLabel: string,
    unknownLabel: string,
  ): QuickBadge => {
    // D2 perf fix: prefer caller-supplied verdict to avoid 6 redundant
    // resolveFeature calls per product detail render. Falls back to
    // per-key resolveFeature for callers that don't pre-resolve.
    const v = preResolved && key in preResolved
      ? (preResolved[key] as FeatureVerdict)
      : resolveFeature(product, key);
    let status: BadgeStatus;
    if (v === null) status = "unknown";
    else if (key === "vegan") status = v ? "positive" : "negative";
    else status = v ? "negative" : "positive";
    return { key, positiveLabel, negativeLabel, unknownLabel, status };
  };

  return [
    make("vegan",     "Vegan",            "Vegan Değil",              "Vegan Durumu Belirsiz"),
    make("paraben",   "Paraben İçermez",  "Paraben İçeriyor",         "Paraben Durumu Belirsiz"),
    make("sulfate",   "Sülfat İçermez",   "Sülfat İçeriyor",          "Sülfat Durumu Belirsiz"),
    make("fragrance", "Parfüm İçermez",   "Parfüm İçeriyor",          "Parfüm Durumu Belirsiz"),
    make("alcohol",   "Alkol İçermez",    "Kurutucu Alkol İçeriyor",  "Alkol Durumu Belirsiz"),
    make("silicone",  "Silikon İçermez",  "Silikon İçeriyor",         "Silikon Durumu Belirsiz"),
  ];
}
