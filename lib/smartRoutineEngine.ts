/**
 * smartRoutineEngine.ts  —  Akıllı Kişisel Rutin Motoru
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mevcut sistemlerden farklı olarak bu motor:
 *   · Gerçek ürünleri adım slotlarına atar (iskelet değil, somut rutin)
 *   · Her slot için segment alternatifi bulur (ekonomik / profesyonel / seçkin)
 *   · Profile göre kompleksite belirler (basit / dengeli / kapsamlı)
 *   · Eczacı tonlu motivasyon mesajı + zaman çizelgesi üretir
 *
 * Giriş:
 *   matchResults  : rankProductsForConcern() çıktısı
 *   allProducts   : Supabase'den gelen tüm ürünler (alternatif bulmak için)
 *   prefs         : kullanıcı profili
 *   concern       : seçilen cilt kaygısı
 *
 * Çıkış: SmartRoutine
 */

import { classifyBucket } from "@/lib/concernFlows";
import { CONCERN_TIMELINES } from "@/lib/concernRoutineBridge";
import type { TieredMatchResults, MatchResult } from "@/lib/productMatchEngine";
import type { UserPreferences, SkinConcernKey } from "@/lib/userPreferences";
import type { Product } from "@/types/product";

// ─────────────────────────────────────────────────────────────────────────────
// TİP TANIMLARI
// ─────────────────────────────────────────────────────────────────────────────

export type StepSlot   = "cleanser" | "treatment" | "moisturizer" | "sunscreen" | "repair";
export type TimeOfDay  = "morning" | "evening";
export type RoutineLevel = "simple" | "balanced" | "rich";

export interface RoutineAlternative {
  product:  Product;
  segment:  string;
  label:    string;   // "Daha ekonomik" | "Daha güçlü" | "Seçkin"
}

export interface SmartRoutineStep {
  slot:             StepSlot;
  stepLabel:        string;   // Türkçe ad
  icon:             string;   // Feather icon
  isEssential:      boolean;
  product:          Product | null;   // en iyi eşleşen ürün (null = ürün bulunamadı)
  productScore:     number;
  alternatives:     RoutineAlternative[];
  why:              string;   // "Neden bu adım?" açıklaması
  howTo:            string;   // Kullanım talimatı
  caution?:         string;   // Uyarı notu (opsiyonel)
  timeOfDay:        TimeOfDay | "both";
  noProductReason?: "no_match" | "low_score"; // null product durumunda neden
}

export interface RoutineTimeline {
  phase1: string;
  phase2: string;
  phase3: string;
  unit:   string;
  note:   string;
}

export interface SafetySummary {
  pregnancyExcludedCount: number;
  allergyExcludedCount:   number;
  totalExcluded:          number;   // unique products excluded by any safety gate
  hasPregnancyGate:       boolean;
  hasAllergyGate:         boolean;
}

export interface SmartRoutine {
  morning:         SmartRoutineStep[];
  evening:         SmartRoutineStep[];
  level:           RoutineLevel;
  levelLabel:      string;
  motivationMsg:   string;
  timeline:        RoutineTimeline;
  warningNotes:    string[];
  safetySummary?:  SafetySummary;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT TANIMLARI
// ─────────────────────────────────────────────────────────────────────────────

interface SlotConfig {
  slot:        StepSlot;
  label:       string;
  icon:        string;
  isEssential: boolean;
  bucket:      "cleanser" | "serum" | "moisturizer" | "sunscreen" | "other";
  morningOrder:number;  // -1 = sabah yok
  eveningOrder:number;  // -1 = akşam yok
}

const ALL_SLOTS: SlotConfig[] = [
  { slot: "cleanser",    label: "Temizleyici",       icon: "droplet",  isEssential: true,  bucket: "cleanser",    morningOrder: 1, eveningOrder: 1 },
  { slot: "treatment",   label: "Aktif / Serum",     icon: "zap",      isEssential: false, bucket: "serum",       morningOrder: -1, eveningOrder: 2 }, // akşam önce
  { slot: "moisturizer", label: "Nemlendirici",      icon: "cloud",    isEssential: true,  bucket: "moisturizer", morningOrder: 2, eveningOrder: 3 },
  { slot: "sunscreen",   label: "Güneş Koruyucu",    icon: "sun",      isEssential: true,  bucket: "sunscreen",   morningOrder: 3, eveningOrder: -1 },
  { slot: "repair",      label: "Bariyer / Onarım",  icon: "shield",   isEssential: false, bucket: "moisturizer", morningOrder: -1, eveningOrder: 4 },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFİL → ROUTİNE LEVEL
// ─────────────────────────────────────────────────────────────────────────────

function resolveLevel(prefs: UserPreferences, concern: SkinConcernKey): RoutineLevel {
  const sc = prefs.specialConditions ?? [];
  const hasSensitive = sc.includes("sensitive_skin") || sc.includes("rosacea") || sc.includes("eczema") || sc.includes("psoriasis");
  if (hasSensitive) return "simple";

  const profileComplete =
    prefs.skinType !== null &&
    prefs.allergies.length > 0 &&
    prefs.skinConcerns.length > 0;

  const isAdvancedConcern = concern === "anti_aging" || concern === "spots" || concern === "barrier_repair";
  if (profileComplete && isAdvancedConcern) return "rich";

  return "balanced";
}

const LEVEL_LABELS: Record<RoutineLevel, string> = {
  simple:   "Basit Rutin",
  balanced: "Dengeli Rutin",
  rich:     "Kapsamlı Rutin",
};

// ─────────────────────────────────────────────────────────────────────────────
// KAYGIYA GÖRE AKTİF SERUM ÖNCELIK SİNYALLERİ
// ─────────────────────────────────────────────────────────────────────────────

const CONCERN_TREATMENT_SIGNALS: Record<SkinConcernKey, string[]> = {
  acne:          ["salicylic", "salisilik", "niacinamide", "niasinamid", "benzoyl", "zinc", "çinko", "retinol"],
  spots:         ["vitamin c", "ascorbic", "arbutin", "kojic", "tranexamic", "azelaik", "niacinamide"],
  redness:       ["centella", "madecassoside", "allantoin", "panthenol", "bisabolol", "chamomile"],
  dehydration:   ["hyaluronic", "hüalüronik", "sodium hyaluronate", "glycerin", "gliserin", "urea"],
  barrier_repair:["ceramide", "ceramid", "niacinamide", "panthenol", "cholesterol", "fatty acid"],
  anti_aging:    ["retinol", "retinal", "bakuchiol", "peptide", "niacinamide", "vitamin c"],
  pore:          ["salicylic", "salisilik", "niacinamide", "niasinamid", "zinc", "kaolin"],
};

// ─────────────────────────────────────────────────────────────────────────────
// NEDEN BU ADIM — PER SLOT + CONCERN
// ─────────────────────────────────────────────────────────────────────────────

type WhyMap = Record<StepSlot, Partial<Record<SkinConcernKey, string>> & { default: string }>;

const WHY_TEXTS: WhyMap = {
  cleanser: {
    acne:          "Gözenek tıkanmasının önüne geçmek için gün başı ve sonu temizlik şarttır. Kirlilik, aktif içeriklerinizin cildinize nüfuz etmesini engeller.",
    spots:         "Temiz bir yüzey olmadan aktif içerikler (C vitamini, arbutin) etkin çalışamaz. Temizlik, tedavinin ilk basamağıdır.",
    redness:       "Nazif temizlik, kızarıklığı tetikleyen kalıntıları uzaklaştırır; bariyeri stres altına sokmadan taze bir başlangıç sağlar.",
    dehydration:   "Sabah hafif, akşam eksiksiz bir temizlik nemlendirici içeriklerin daha iyi emilmesini doğrudan destekler.",
    barrier_repair:"Köpüksüz veya düşük pH'lı temizleyici, zedelenmiş bariyeri daha da yormadan rutin başlatır.",
    anti_aging:    "Aktif içeriklerin (retinol, peptid) ciltte tutunabilmesi için temiz bir zemin şarttır.",
    pore:          "Gün içinde biriken yağ ve kirlilik gözenek tıkanmasının doğrudan nedenidir. Günde iki kez temizlik bu döngüyü kırar.",
    default:       "Cilt bakımının her adımı, temiz bir yüzey üzerine kurulur. Temizlik atlanırsa hiçbir aktif tam potansiyeline ulaşamaz.",
  },
  treatment: {
    acne:          "Salisilik asit veya niasinamid içerikli bir serum, gözenek içindeki birikimleri çözer ve yeni sivilce oluşumunu kademeli olarak engeller.",
    spots:         "C vitamini veya alpha arbutin içerikli aktif serum, melanin sentezini yavaşlatarak leke görünümünü kökten hedefler. Sabah kullanıyorsanız SPF şart.",
    redness:       "Centella asiatica veya bisabolol bazlı yatıştırıcı serum, akşam başlayan bariyer onarımını güçlendirir ve reaktif cildi sakinleştirir.",
    dehydration:   "Hüalüronik asit serumu, nemlendirici uygulamadan önce cilde nem çekerek katmanlı nemlendirmenin temelini oluşturur.",
    barrier_repair:"Ceramid veya niasinamid içerikli serum, bariyer proteinlerini aktive ederek onarım sürecini doğrudan tetikler.",
    anti_aging:    "Retinol veya peptid içerikli aktif, hücre yenilenmesini hızlandırır. Akşam kullanımı hem etkiyi artırır hem de güneş hassasiyeti riskini sıfırlar.",
    pore:          "Salisilik asit veya niasinamid içeren hedefli serum, gözenek görünümünü küçültürken sebum dengesini de sağlar.",
    default:       "Aktif serum, rutinin en güçlü hedefleme aracıdır. Doğru aktifle eşleştirildiğinde rutin sonuçları belirgin şekilde hızlanır.",
  },
  moisturizer: {
    acne:          "Nemlendirici ihmal edilen akne rutinlerinde cilt, eksik nemi telafi etmek için daha fazla yağ üretir — bu kısır döngüyü kırmak için hafif nemlendirici şarttır.",
    spots:         "Aktif içerikler (C vitamini, asitler) cilt bariyerini kurutabilir; nemlendirici bu dengeyi korur ve aktifin irritan etkisini freler.",
    redness:       "Bariyer güçlendirici bir nemlendirici, kızarıklık tetikleyicilere karşı doğal savunmayı artırır. Katmanlı nem = dayanıklı cilt.",
    dehydration:   "Serumun tuttuğu nemi kilitlemek için nemlendirici şarttır. Serum yalnız bırakılırsa nem yeniden buharlaşır.",
    barrier_repair:"Yoğun ceramid ve lipid içerikli nemlendirici, onarımı hızlandıran son 'kapak' katmanıdır.",
    anti_aging:    "Aktif içerikler tek başına cildi kurutabilir; destekleyici bir nemlendirici hem konforu artırır hem de bariyeri korur.",
    pore:          "Gözenek rutininde hafif, jel bazlı nemlendirici yağlanmayı artırmadan cildi dengeli tutar.",
    default:       "Nemlendirici, tüm aktif içeriklerin üzerine çektiğiniz koruyucu kapaktır. Bu adım atlanırsa bariyer zaman içinde zayıflar.",
  },
  sunscreen: {
    acne:          "SPF olmadan niasinamid veya salisilik asit kullandığınızda leke riski artar. Güneş koruyucu bu yan etkiyi engeller.",
    spots:         "Leke tedavisinin en kritik adımı SPF'tir. Güneş ışığı, aydınlatıcı aktiflerinizin tüm etkisini gün içinde geri alabilir.",
    redness:       "UV ışığı vasküler reaktiviteyi artırır. Mineral filtreli (çinko oksit, titanyum dioksit) SPF hassas ciltlerde tercih edilir.",
    dehydration:   "Güneş ışığı cildi kurutur ve nem bariyerini zayıflatır. SPF bu kaybı önler.",
    barrier_repair:"UV hasarı, onarımını yeni tamamladığınız bariyer üzerinde en büyük stres faktörüdür. SPF bu yatırımı korur.",
    anti_aging:    "Kırışıklıkların %80'i UV kaynaklıdır. Anti-aging rutinin en etkili parçası retinol değil, SPF'tir.",
    pore:          "UV ışığı kolajeni parçalayarak gözenek genişlemesini hızlandırır. SPF bu süreci yavaşlatır.",
    default:       "Güneş koruyucu, tüm cilt bakımının sigortasıdır. Bu adım atlanırsa diğer tüm adımların etkisi ciddi ölçüde azalır.",
  },
  repair: {
    acne:          "Akşam onarım adımı, gün içinde tahriş olan deriyi sıfırlar ve sabah için temiz bir bariyer hazırlar.",
    spots:         "Aydınlatıcı aktifler kullanılan ciltlerde akşam bariyer onarımı, irritasyon riskini dengeler.",
    redness:       "Uyku sırasında bariyer doğal olarak onarılır; ceramid içerikli bir kapak katmanı bu süreci destekler.",
    dehydration:   "Uyku sırasında transepidermal su kaybı (TEWL) artar. Onarım kremi bu kaybı engeller.",
    barrier_repair:"Bu adım rutinin çekirdeğidir. Ceramid ve kolesterol içerikli onarım ürünü, hasarlı bariyeri yapısal olarak yeniden inşa eder.",
    anti_aging:    "Uyku, hücre yenilenmesinin en hızlı yaşandığı dönemdir. Bariyer onarım adımı bu süreci besler.",
    pore:          "Akşam onarım adımı, gün içinde birikmiş yağ ve kirlilik stresinden sonra gözenek çevresini sakinleştirir.",
    default:       "Akşam bariyer onarımı, cildin kendini yenileme mekanizmasını destekleyen kritik son adımdır.",
  },
};

function getWhyText(slot: StepSlot, concern: SkinConcernKey): string {
  const map = WHY_TEXTS[slot];
  return map[concern] ?? map.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// NASIL KULLANILIR — PER SLOT
// ─────────────────────────────────────────────────────────────────────────────

const HOW_TO: Record<StepSlot, string> = {
  cleanser:    "Islak yüze küçük miktarda uygulayın, 20–30 saniye hafif dairesel hareketlerle masaj yapın, bol suyla durulayın.",
  treatment:   "Temiz ve hafif nemli cilde 2–3 damla uygulayın; göz çevresini atlayın. Emilmesini bekledikten sonra nemlendiriciyi uygulayın.",
  moisturizer: "Nemlendiriciyi serum üzerine cömertçe uygulayın; yukarı doğru hafif baskı hareketleriyle sindirin.",
  sunscreen:   "Son adım olarak yüz ve boyuna en az ¼ çay kaşığı kadar yayın. 2 saatte bir yenilemeniz önerilir.",
  repair:      "Akşam rutininin son adımı olarak özellikle kuru ve gergin hissedilen alanlara fazladan katman ekleyerek uygulayın.",
};

const CAUTIONS: Partial<Record<StepSlot, string>> = {
  treatment:   "Yeni başlıyorsanız haftada 3 gece ile başlayın; ilk haftalarda hafif bir kızarıklık veya soyulma normaldir.",
  sunscreen:   "Nemlendirici üzerine uygulanmalı, altına değil. Bulutlu günlerde de ihmal etmeyin.",
};

// ─────────────────────────────────────────────────────────────────────────────
// ÜRÜN SEÇME — DEFENSIVE NORMALIZATION + SAFETY FILTERS
// (ECZ4 Routine Quality · Step 3 E1 hotfix — additive, single-source)
// ─────────────────────────────────────────────────────────────────────────────

type RoutineProductTextFields = {
  features:            string[];
  ingredients:         string[];
  activeIngredients:   string[];
  concernsSupported:   string[];
  skinTypes:           string[];
  badges:              string[];
  concerns:            string[];
  /** lowercased, diacritic-folded composite blob for substring scans */
  blob:                string;
};

const ROUTINE_PRODUCT_TEXT_CACHE = new WeakMap<object, RoutineProductTextFields>();

function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const v of value) {
      if (v == null) continue;
      if (typeof v === "string") { if (v.trim()) out.push(v); }
      else if (typeof v === "number" || typeof v === "boolean") out.push(String(v));
      else if (typeof v === "object") {
        const name = (v as any).name ?? (v as any).label ?? (v as any).key;
        if (typeof name === "string" && name.trim()) out.push(name);
      }
    }
    return out;
  }
  if (typeof value === "string") {
    return value.trim() ? [value] : [];
  }
  if (typeof value === "object") {
    const out: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === true) {
        out.push(k);
        if (k === "fragrance" || k === "fragrance_free") out.push("fragrance_free");
      } else if (v === false && k === "fragrance") {
        out.push("fragrance_free");
      } else if (typeof v === "string" && v.trim()) {
        out.push(v);
      }
    }
    return out;
  }
  return [];
}

function foldTr(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ş/g, "s").replace(/ç/g, "c")
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o");
}

function getRoutineFields(product: Product): RoutineProductTextFields {
  if (!product || typeof product !== "object") {
    return { features: [], ingredients: [], activeIngredients: [], concernsSupported: [], skinTypes: [], badges: [], concerns: [], blob: "" };
  }
  const cached = ROUTINE_PRODUCT_TEXT_CACHE.get(product as object);
  if (cached) return cached;

  const raw = product as unknown as Record<string, unknown>;
  const features          = toStringArray(raw.features);
  const ingredients       = toStringArray(raw.ingredients);
  const activeIngredients = toStringArray(raw.active_ingredients);
  const concernsSupported = toStringArray(raw.concerns_supported);
  const skinTypes         = toStringArray(raw.skin_types);
  const badges            = toStringArray(raw.badges);
  const concerns          = toStringArray(raw.concerns);

  const scalarParts: string[] = [];
  for (const k of ["name","isim","brand","marka","short_benefit","kisa_fayda","description","aciklama","category","kategori","subcategory","alt_kategori","skin_type","segment","full_description"]) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) scalarParts.push(v);
  }
  const blob = foldTr(
    [
      ...scalarParts,
      ...features, ...ingredients, ...activeIngredients,
      ...concernsSupported, ...skinTypes, ...badges, ...concerns,
    ].join(" ")
  );

  const out: RoutineProductTextFields = {
    features, ingredients, activeIngredients,
    concernsSupported, skinTypes, badges, concerns, blob,
  };
  ROUTINE_PRODUCT_TEXT_CACHE.set(product as object, out);
  return out;
}

// ── Pregnancy / breastfeeding gate ───────────────────────────────────────────
const PREGNANCY_KEYS = [
  "pregnancy","pregnant","hamile","hamilelik","gebelik","gebe",
  "breastfeeding","breast_feeding","emzirme","emziren","lactation","laktasyon",
];

function hasPregnancyOrBreastfeeding(prefs: UserPreferences | null | undefined): boolean {
  if (!prefs) return false;
  const sc = (prefs as any).specialConditions;
  if (!sc) return false;
  const arr = Array.isArray(sc) ? sc : (typeof sc === "object" ? Object.entries(sc).filter(([_, v]) => !!v).map(([k]) => k) : [String(sc)]);
  for (const item of arr) {
    const norm = foldTr(String(item));
    if (PREGNANCY_KEYS.some(k => norm.includes(k))) return true;
  }
  return false;
}

const PREGNANCY_UNSAFE_PATTERNS: RegExp[] = [
  /\bretinol\b/, /\bretinal\b/, /\bretinaldehyde\b/, /\bretinoid(s)?\b/,
  /\bretinyl\b/, /\btretinoin\b/, /\badapalene\b/, /\btazarotene\b/,
  /\bisotretinoin\b/, /\bretinoic\s*acid\b/, /\bretinoik\s*asit\b/,
  /\bsalicylic\s*acid\b/, /\bsalisilik\s*asit\b/, /(^|[^a-z])bha([^a-z]|$)/,
];

function isPregnancyUnsafeProduct(product: Product): boolean {
  const { blob } = getRoutineFields(product);
  if (!blob) return false;
  return PREGNANCY_UNSAFE_PATTERNS.some(rx => rx.test(blob));
}

// ── Allergy / avoided ingredient gate ────────────────────────────────────────
const ALLERGY_KEY_TERMS: Record<string, string[]> = {
  fragrance:    ["fragrance","perfume","parfum","parfum","koku","aroma","fragrance_mix"],
  perfume:      ["fragrance","perfume","parfum","koku"],
  parfum:       ["fragrance","perfume","parfum","koku"],
  koku:         ["fragrance","perfume","parfum","koku"],
  alcohol:      ["alcohol denat","alcohol_denat","denatured alcohol","alkol","ethanol"],
  alkol:        ["alcohol denat","alcohol_denat","denatured alcohol","alkol","ethanol"],
  essential_oil:["essential oil","esansiyel yag","esansiyel yağ","limonene","linalool","citronellol","geraniol","citral","eugenol"],
  paraben:      ["paraben","methylparaben","propylparaben","butylparaben","ethylparaben"],
  sulfate:      ["sulfate","sulphate","sulfat","sodium lauryl sulfate","sls","sodium laureth sulfate","sles"],
  silicone:     ["silicone","silikon","dimethicone","cyclopentasiloxane","cyclomethicone"],
  lanolin:      ["lanolin"],
  gluten:       ["gluten","wheat","triticum","bugday","buğday"],
  nut:          ["almond","badem","walnut","ceviz","hazelnut","findik","fındık","peanut"],
};

function isAllergyExcludedProduct(product: Product, prefs: UserPreferences | null | undefined): boolean {
  if (!prefs) return false;
  const fields = getRoutineFields(product);
  const blob = fields.blob;
  if (!blob) return false;

  const allergies = (prefs as any).allergies;
  const allergyArr: string[] = Array.isArray(allergies) ? allergies.map(String) : [];
  for (const a of allergyArr) {
    const norm = foldTr(a);
    const terms = ALLERGY_KEY_TERMS[norm] ?? [norm];
    for (const t of terms) {
      const folded = foldTr(t);
      if (folded.length >= 3 && blob.includes(folded)) return true;
    }
  }

  for (const key of ["allergyIngredients","avoidedIngredients"] as const) {
    const v = (prefs as any)[key];
    if (!v) continue;
    const items: string[] = Array.isArray(v)
      ? v.map(String)
      : typeof v === "string"
        ? v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
        : [];
    for (const term of items) {
      const folded = foldTr(term);
      if (folded.length >= 3 && blob.includes(folded)) return true;
    }
  }

  return false;
}

function isRoutineSafetyExcluded(product: Product, prefs: UserPreferences | null | undefined): boolean {
  if (!product) return false;
  if (hasPregnancyOrBreastfeeding(prefs) && isPregnancyUnsafeProduct(product)) return true;
  if (isAllergyExcludedProduct(product, prefs)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────

function scoreForTreatmentSignals(product: Product, concern: SkinConcernKey): number {
  const fields = getRoutineFields(product);
  const raw    = product as unknown as Record<string, unknown>;
  const text   = [
    fields.ingredients.join(" "),
    fields.activeIngredients.join(" "),
    typeof raw.short_benefit === "string" ? raw.short_benefit : "",
    typeof raw.description === "string" ? raw.description : "",
  ].filter(Boolean).join(" ").toLowerCase();
  const signals = CONCERN_TREATMENT_SIGNALS[concern] ?? [];
  return signals.filter(s => text.includes(s)).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORİ GÜVENİLİRLİK SKORU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir ürünün gerekli bucket'a ne kadar güvenilir eşleştiğini hesaplar.
 *
 * Skor bileşenleri:
 *   · 100 — category/kategori DB alanı doğrudan hedef bucket'ı işaret ediyor
 *   ·  40 — subcategory veya ürün adı üzerinden eşleşme
 *   ·   0 — classifyBucket eşleşmiyor → SERT RED (yanlış kategori)
 *
 * Çapraz-kategori kirliliği kuralları:
 *   · Güneş koruyucu → asla nemlendirici slotuna gelmesin
 *   · Temizleyici    → asla serum slotuna gelmesin
 *   · Serum          → asla temizleyici slotuna gelmesin
 *   · vb.
 */
const BUCKET_CAT_SIGNALS: Record<string, RegExp> = {
  cleanser:    /temizley|cleanser|cleansing|micel|face\s*wash/,
  sunscreen:   /güneş|sunscreen|spf/,
  moisturizer: /nemlendirici|moisturizer|\bkrem\b|\bcream\b|\blosyon\b|lotion/,
  serum:       /\bserum\b|ampul|ampoule|\btonik\b|\btoner\b/,
};

// ─────────────────────────────────────────────────────────────────────────────
// SMART SCORING SYSTEM — Kategori filtresinden sonra en iyi ürünü seçer
// Tamamen eklemeli — mevcut category gate dokunulmaz.
// ─────────────────────────────────────────────────────────────────────────────

/** Puan eşiği: altında kalırsa ürün atanmaz */
const SELECTION_THRESHOLD = 25;

/** Slot baseline bonusu: tedavi dışı slotlarda her ürün kısmen geçerlidir */
const SLOT_BASELINE: Partial<Record<StepSlot, number>> = {
  cleanser:    12,
  sunscreen:   12,
  moisturizer: 8,
  repair:      8,
  treatment:   0,
};

/** Endişe sinyalleri — güçlü ve kısmi eşleşme */
const CONCERN_SIGNALS: Record<SkinConcernKey, { strong: string[]; partial: string[] }> = {
  acne:          { strong: ["sivilce", "akne", "acne", "blemish", "gözenek", "pore"], partial: ["yağ", "oil", "sebum", "mat"] },
  spots:         { strong: ["leke", "spot", "dark spot", "aydınlatıcı", "brightening", "pigment"], partial: ["vitamin c", "arbutin", "kojic"] },
  redness:       { strong: ["kızarıklık", "redness", "sakinleştir", "soothing", "centella", "rosacea"], partial: ["hassas", "sensitive", "gentle"] },
  dehydration:   { strong: ["nem", "hydrat", "nemlendirici", "moisture", "hüalüronik", "hyaluronic"], partial: ["su", "water", "plumping"] },
  barrier_repair:{ strong: ["bariyer", "barrier", "onarım", "repair", "ceramid"], partial: ["hassas", "gentle", "koruyucu"] },
  anti_aging:    { strong: ["yaşlanma", "aging", "anti-aging", "kırışık", "wrinkle", "peptid", "lifting"], partial: ["retinol", "bakuchiol", "firming"] },
  pore:          { strong: ["gözenek", "pore", "blackhead", "siyah nokta", "tıkanma"], partial: ["yağ", "oil", "sebum", "mat"] },
};

/** Cilt tipi sinyalleri */
const SKIN_TYPE_SIGNALS: Record<string, { match: string[]; keywords: string[] }> = {
  oily:        { match: ["oily", "yağlı"],       keywords: ["oil control", "yağ kontrolü", "mat", "matte", "sebum", "hafif", "light", "jel", "gel"] },
  dry:         { match: ["dry", "kuru"],          keywords: ["zengin", "rich", "besleyici", "nourishing", "yoğun", "intense"] },
  combination: { match: ["combination", "karma"], keywords: ["dengeli", "balanced", "t-bölgesi", "t-zone"] },
  sensitive:   { match: ["sensitive", "hassas", "hypoallergenic"], keywords: ["nazif", "gentle", "sakin", "calm", "parfümsüz", "fragrance-free"] },
  normal:      { match: ["normal"], keywords: [] },
};

/** Slot bazlı özellik sinyalleri */
const SLOT_FEATURE_SIGNALS: Record<StepSlot, { strong: string[]; partial: string[] }> = {
  cleanser:    { strong: ["derin temizlik", "deep clean", "makyaj temizleme", "makeup removal", "double cleanser"], partial: ["köpük", "foam", "jel temizleyici", "temizleyici"] },
  moisturizer: { strong: ["yoğun nem", "intense hydration", "bariyer güçlendirici", "barrier", "ceramid"], partial: ["nemlendirici", "moisture", "hydrating"] },
  sunscreen:   { strong: ["geniş spektrum", "broad spectrum", "uva uvb", "spf50", "spf 50+"], partial: ["spf", "güneş", "sun"] },
  treatment:   { strong: ["aktif içerik", "konsantre", "hedefli", "targeted", "concentrated"], partial: ["serum", "ampul", "ampoule"] },
  repair:      { strong: ["gece bakımı", "night care", "onarım yoğun", "ceramid yoğun"], partial: ["gece", "night", "onarıcı", "bariyer"] },
};

/** Faydalı içerik sinyalleri */
const BENEFICIAL_INGREDIENTS = [
  "niacinamide", "niasinamid", "ceramide", "ceramid",
  "hyaluronic acid", "hüalüronik asit", "sodium hyaluronate",
  "centella", "panthenol", "glycerin", "gliserin",
  "vitamin c", "ascorbic", "retinol", "retinal",
  "zinc", "çinko", "salicylic", "salisilik",
  "peptide", "bakuchiol", "arbutin", "allantoin", "bisabolol",
];

/** Riskli içerik cezaları */
const RISK_SIGNALS: { concern?: SkinConcernKey; skinType?: string; ingredients: string[]; penalty: number }[] = [
  { concern: "acne",           ingredients: ["fragrance", "parfüm", "alcohol denat", "koku"], penalty: -50 },
  { concern: "redness",        ingredients: ["fragrance", "parfüm", "alcohol", "alkol"],       penalty: -50 },
  { concern: "barrier_repair", ingredients: ["fragrance", "parfüm", "sodium lauryl sulfate"],  penalty: -50 },
  { skinType: "sensitive",     ingredients: ["alcohol denat", "denatured alcohol", "alkol"],   penalty: -50 },
];

interface ScoreBreakdown {
  baseline:   number;
  concern:    number;
  skinType:   number;
  feature:    number;
  ingredient: number;
  penalty:    number;
  total:      number;
}

function getProductSearchText(product: Product): string {
  const raw    = product as unknown as Record<string, unknown>;
  const fields = getRoutineFields(product);
  return [
    String(product.name              ?? ""),
    String(raw.isim                  ?? ""),
    String(product.short_benefit     ?? ""),
    String(raw.kisa_fayda            ?? ""),
    String(raw.description           ?? ""),
    String(raw.aciklama              ?? ""),
    fields.features.join(" "),
    fields.activeIngredients.join(" "),
  ].join(" ").toLowerCase();
}

function scoreProductForRoutineSlot(
  product: Product,
  concern: SkinConcernKey,
  prefs:   UserPreferences,
  slot:    SlotConfig,
): ScoreBreakdown {
  const fields   = getRoutineFields(product);
  const text     = getProductSearchText(product);
  const ings     = [...fields.ingredients, ...fields.activeIngredients].join(" ").toLowerCase();
  const concerns = [...fields.concernsSupported, ...fields.concerns].map(s => s.toLowerCase());
  const skinTypes = [
    ...fields.skinTypes,
    String(product.skin_type ?? ""),
  ].map(s => s.toLowerCase()).filter(Boolean);

  // Baseline (slot tipi)
  const baseline = SLOT_BASELINE[slot.slot] ?? 0;

  // 1. Concern match (0–40)
  let concernPts = 0;
  if (concerns.some(c => c.includes(concern.replace("_", " ")))) {
    concernPts = 40;
  } else {
    const sigs = CONCERN_SIGNALS[concern];
    if (sigs) {
      if (sigs.strong.some(s => text.includes(s) || ings.includes(s))) concernPts = 40;
      else if (sigs.partial.some(s => text.includes(s) || ings.includes(s))) concernPts = 20;
    }
  }

  // 2. Skin type match (0–25)
  let skinTypePts = 0;
  if (prefs.skinType) {
    const stSigs = SKIN_TYPE_SIGNALS[prefs.skinType];
    if (stSigs) {
      if (skinTypes.some(st => stSigs.match.some(m => st.includes(m)))) skinTypePts = 25;
      else if (stSigs.keywords.some(kw => text.includes(kw))) skinTypePts = 10;
    }
  }

  // 3. Feature relevance (0–20)
  let featurePts = 0;
  const fSigs = SLOT_FEATURE_SIGNALS[slot.slot];
  if (fSigs) {
    if (fSigs.strong.some(s => text.includes(s)))        featurePts = 20;
    else if (fSigs.partial.some(s => text.includes(s)))  featurePts = 10;
  }

  // 4. Ingredient logic (0–10)
  let ingPts = 0;
  if (BENEFICIAL_INGREDIENTS.some(bi => ings.includes(bi) || text.includes(bi))) ingPts = 10;

  // 5. Penalty (-50 per risk)
  let penalty = 0;
  for (const risk of RISK_SIGNALS) {
    if (risk.concern  && risk.concern  !== concern)        continue;
    if (risk.skinType && risk.skinType !== prefs.skinType) continue;
    if (risk.ingredients.some(ri => ings.includes(ri) || text.includes(ri))) penalty += risk.penalty;
  }

  const total = baseline + concernPts + skinTypePts + featurePts + ingPts + penalty;
  return { baseline, concern: concernPts, skinType: skinTypePts, feature: featurePts, ingredient: ingPts, penalty, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD CATEGORY PROTECTION LAYER
// Mevcut categoryConfidence akışına ek — öncesinde çalışır.
// DB'deki category/kategori alanı YOKSA → keyword akışı devam eder.
// DB alanı VARSA ve slot bucket'ıyla eşleşmiyorsa → sert red (override edilemez).
// ─────────────────────────────────────────────────────────────────────────────

function dbCategoryHardGuard(
  product:        Product,
  requiredBucket: string,
  slotLabel:      string,
): boolean {
  const p           = product as unknown as Record<string, unknown>;
  const productName = String((p.name ?? (p as any).isim) ?? "bilinmeyen");

  const rawParts = [
    String(p.category  ?? ""),
    String(p.kategori  ?? ""),
  ].filter((s) => s && s !== "undefined" && s !== "null" && s.trim() !== "");

  if (rawParts.length === 0) {
    // DB category alanı boş → mevcut keyword akışına devret
    return true;
  }

  const catField = rawParts.join(" ").toLowerCase().trim();
  const sig      = BUCKET_CAT_SIGNALS[requiredBucket];

  if (!sig) {
    // Bucket için sinyal tanımlı değil → geçir
    return true;
  }

  if (!sig.test(catField)) {
    // DB category FARKLI bir kategori → sert red; keyword/skor geçemez
    return false;
  }

  return true;
}

function categoryConfidence(product: Product, requiredBucket: string): number {
  const p   = product as unknown as Record<string, unknown>;
  const cls = classifyBucket(p);

  // Hard fail: classified bucket ≠ required bucket → bu ürünü reddet
  if (cls !== requiredBucket) return 0;

  // category/kategori alanından doğrudan eşleşme → yüksek güven
  const catField = [
    String(p.category  ?? ""),
    String(p.kategori  ?? ""),
  ].filter((s) => s && s !== "undefined").join(" ").toLowerCase().trim();

  const sig = BUCKET_CAT_SIGNALS[requiredBucket];
  if (catField.length > 0 && sig?.test(catField)) return 100;

  // subcategory veya isim üzerinden eşleşme → orta güven
  return 40;
}

/**
 * Ortak aday seçim helper'ı — verilen ürün havuzundan slot için en iyi adayı seçer.
 * pickProductForSlot tarafından hem primary (allMatched) hem fallback (bucketPool) için kullanılır.
 * Mevcut tüm kapılar (usedIds + dbCategoryHardGuard + categoryConfidence + threshold) korunur.
 */
function selectBestFromPool(
  candidates: Product[],
  slot:       SlotConfig,
  concern:    SkinConcernKey,
  prefs:      UserPreferences,
  usedIds:    Set<string>,
):
  | { kind: "ok"; product: Product; score: number }
  | { kind: "fail"; reason: "no_match" | "low_score" } {

  const valid = candidates.filter((p) => {
    const id = String(p.id);
    if (usedIds.has(id)) return false;
    if (!dbCategoryHardGuard(p, slot.bucket, slot.label)) return false;
    return categoryConfidence(p, slot.bucket) > 0;
  });

  if (valid.length === 0) {
    return { kind: "fail", reason: "no_match" };
  }

  const scored = valid.map((product) => {
    const breakdown = scoreProductForRoutineSlot(product, concern, prefs, slot);
    return { product, breakdown, smartScore: breakdown.total };
  });
  scored.sort((a, b) => b.smartScore - a.smartScore);

  const best = scored[0];
  if (best.smartScore < SELECTION_THRESHOLD) {
    return { kind: "fail", reason: "low_score" };
  }

  return { kind: "ok", product: best.product, score: best.smartScore };
}

/**
 * Step 5 — Staged fallback bucket pool precompute.
 * allProducts üzerinde tek geçiş: safety filter + classifyBucket gruplaması.
 * usedIds ve slot-spesifik kapılar runtime'da uygulanır (her slotta değiştiği için).
 */
type BucketPools = Record<"cleanser" | "serum" | "moisturizer" | "sunscreen", Product[]>;

/**
 * ECZ4 — Safety Explanation Phase Step 2:
 * precompute artık aynı tek-geçişte safety exclusion sayımlarını da
 * üretiyor. Filter davranışı değişmez; sadece neden/sayı görünürlüğü eklenir.
 */
function precomputeBucketPools(
  allProducts: Product[],
  prefs:       UserPreferences,
): { pools: BucketPools; safetySummary: SafetySummary } {
  const pools: BucketPools = { cleanser: [], serum: [], moisturizer: [], sunscreen: [] };

  const hasPregnancyGate = hasPregnancyOrBreastfeeding(prefs);
  const hasAllergyGate = (() => {
    const a = (prefs as any)?.allergies;
    if (Array.isArray(a) && a.length > 0) return true;
    const ai = (prefs as any)?.allergyIngredients;
    if (Array.isArray(ai) ? ai.length > 0 : (typeof ai === "string" && ai.trim().length > 0)) return true;
    const av = (prefs as any)?.avoidedIngredients;
    if (Array.isArray(av) ? av.length > 0 : (typeof av === "string" && av.trim().length > 0)) return true;
    return false;
  })();

  let pregnancyExcludedCount = 0;
  let allergyExcludedCount   = 0;
  let totalExcluded          = 0;

  for (const p of allProducts) {
    if (!p) continue;

    const pregHit = hasPregnancyGate && isPregnancyUnsafeProduct(p);
    const allergyHit = hasAllergyGate && isAllergyExcludedProduct(p, prefs);

    if (pregHit) pregnancyExcludedCount++;
    if (allergyHit) allergyExcludedCount++;
    if (pregHit || allergyHit) {
      totalExcluded++;
      continue; // safety filter — havuza eklenmez (mevcut davranış korunur)
    }

    const bucket = classifyBucket(p as unknown as Record<string, unknown>);
    if (bucket === "cleanser" || bucket === "serum" || bucket === "moisturizer" || bucket === "sunscreen") {
      pools[bucket].push(p);
    }
  }

  return {
    pools,
    safetySummary: {
      pregnancyExcludedCount,
      allergyExcludedCount,
      totalExcluded,
      hasPregnancyGate,
      hasAllergyGate,
    },
  };
}

function pickProductForSlot(
  slot:       SlotConfig,
  concern:    SkinConcernKey,
  prefs:      UserPreferences,
  allMatched: MatchResult[],
  usedIds:    Set<string>,
  bucketPool?: Product[],
): { product: Product; score: number } | { product: null; reason: "no_match" | "low_score" } {

  // ── Primary: concern-filtreli allMatched (mevcut Step 1 recommendation bridge — DOKUNULMADI) ──
  const primaryCandidates = allMatched.map((mr) => mr.product);
  const primary = selectBestFromPool(primaryCandidates, slot, concern, prefs, usedIds);

  if (primary.kind === "ok") {
    return { product: primary.product, score: primary.score };
  }

  // ── Fallback (Step 5): bucketPool — allProducts'tan safety-filtreli geniş havuz ──
  // Sadece primary başarısız olduğunda devreye girer; treatment dahil tüm slotlar için aktif
  // ama treatment slot'unda concern-uyum scoring zaten threshold ile filtrelendiği için
  // recommendation truth pratikte korunur (concern-blind ürünler eşik geçemez).
  if (bucketPool && bucketPool.length > 0) {
    const fallback = selectBestFromPool(bucketPool, slot, concern, prefs, usedIds);
    if (fallback.kind === "ok") {
      return { product: fallback.product, score: fallback.score };
    }
  }

  // ── Her iki aşama da başarısız → primary'nin failure semantiği korunur ─────
  return { product: null, reason: primary.reason };
}

function findAlternatives(
  slot:          SlotConfig,
  selectedId:    string,
  allProducts:   Product[],
  maxPerSegment: number,
  prefs?:        UserPreferences | null,
): RoutineAlternative[] {
  const SEGMENT_LABELS: Record<string, string> = {
    ekonomik:    "Daha ekonomik seçenek",
    profesyonel: "Orta segment",
    seçkin:      "Seçkin alternatif",
  };
  const ORDER = ["ekonomik", "profesyonel", "seçkin"];

  const bySegment: Partial<Record<string, Product[]>> = {};

  for (const p of allProducts) {
    const id     = String(p.id);
    if (id === selectedId) continue;
    const bucket = classifyBucket(p as unknown as Record<string, unknown>);
    if (bucket !== slot.bucket) continue;
    const seg    = ((p as any).segment ?? "").toLowerCase();
    if (!ORDER.includes(seg)) continue;
    if (prefs && isRoutineSafetyExcluded(p, prefs)) continue;
    if (!bySegment[seg]) bySegment[seg] = [];
    bySegment[seg]!.push(p);
  }

  const result: RoutineAlternative[] = [];
  for (const seg of ORDER) {
    const list = bySegment[seg] ?? [];
    if (list.length === 0) continue;
    result.push({
      product: list[0],
      segment: seg,
      label:   SEGMENT_LABELS[seg] ?? seg,
    });
    if (result.length >= maxPerSegment) break;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTİVASYON MESAJI
// ─────────────────────────────────────────────────────────────────────────────

const MOTIVATION_MESSAGES: Record<SkinConcernKey, string> = {
  acne:
    "Akne kontrolü anlık bir çözüm değil, düzenli bir yatırımdır. Bu rutin tutarlı uygulandığında 2–3 hafta içinde yeni oluşumların azaldığını fark edeceksiniz. İlk günlerde hafif bir kötüleşme görülebilir — bu adaptasyon sürecinin normal bir parçasıdır, endişelenmeyin.",
  spots:
    "Leke aydınlatması sabır isteyen bir süreçtir; ancak doğru aktiflerle ilk tonal iyileşme 4–6 haftada başlar. Bu rutinde her sabah uygulayacağınız güneş koruyucu, tüm diğer adımların etkisini katlar.",
  redness:
    "Reaktif ciltlerde rutini basit tutmak en büyük fark yaratır. Karmaşıklık yerine tutarlılık — bu rutin cildinize güvenlik hissi verecek ve kızarıklık sıklığını kademeli olarak azaltacak.",
  dehydration:
    "Nem kaybı tek adımla değil, katmanlı bir yaklaşımla geri kazanılır. Serum + nemlendirici kombinasyonu düzenli uygulandığında 7–14 gün içinde gerginlik ve soyulma önemli ölçüde azalır.",
  barrier_repair:
    "Cilt bariyeri bir kez bozulduğunda sabırlı bir onarım süreci gerektirir. Bu rutin, keratinositlerinize yeniden 'örülmeleri' için gerekli ham maddeleri sağlar. 3–4 hafta sonra daha dayanıklı bir cilt hissedeceksiniz.",
  anti_aging:
    "Hücre yenilenmesi uyku sırasında en yüksek seviyeye ulaşır — bu yüzden akşam rutini anti-aging bakımın kalbi sayılır. Gözle görülür sıkılaşma genellikle 6–8 haftalık düzenli kullanımdan sonra başlar.",
  pore:
    "Gözenek görünümü cilt elastikiyetinin bir yansımasıdır; anlık bir silme operasyonu değil, kademeli bir dengeleme sürecidir. Bu rutin 3–4 hafta sonra gözenek bölgesinde belirgin bir sıkılaşma ve mat görünüm sunmaya başlar.",
};

// ─────────────────────────────────────────────────────────────────────────────
// ZİYADELER — UYARI NOTLARI
// ─────────────────────────────────────────────────────────────────────────────

function buildWarnings(prefs: UserPreferences, concern: SkinConcernKey): string[] {
  const notes: string[] = [];
  const sc = prefs.specialConditions ?? [];

  if (sc.includes("pregnancy") || sc.includes("breastfeeding")) {
    notes.push("Hamilelik/emzirme döneminde retinol ve yüksek doz BHA içeren ürünleri kullanmadan önce hekiminize danışın.");
  }
  if (sc.includes("rosacea")) {
    notes.push("Rozasea aktif dönemindeyken yeni bir ürün eklemeden önce 2 hafta beklemenizi öneririm.");
  }
  if (concern === "anti_aging" && prefs.skinType === "sensitive") {
    notes.push("Hassas cildiniz varsa retinol yerine bakuchiol ile başlamayı değerlendirin — benzer etkiyle çok daha az irritasyon.");
  }
  if (concern === "spots") {
    notes.push("C vitamini serumu güneş hassasiyetini artırabilir — sabah uygulamak istiyorsanız üzerine kesinlikle SPF uygulayın.");
  }
  return notes;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANA FONKSİYON
// ─────────────────────────────────────────────────────────────────────────────

export function buildSmartRoutine(
  matchResults: TieredMatchResults,
  allProducts:  Product[],
  prefs:        UserPreferences,
  concern:      SkinConcernKey,
): SmartRoutine {
  const level = resolveLevel(prefs, concern);
  const allMatched = [...matchResults.best, ...matchResults.strong, ...matchResults.consider]
    .filter(mr => !isRoutineSafetyExcluded(mr.product, prefs));
  const usedIds    = new Set<string>();

  // Step 5 — bucket pool fallback (allProducts üzerinde tek geçiş, safety-filtreli)
  // ECZ4 Safety Explanation Phase Step 2 — aynı geçişten safetySummary üretilir.
  const { pools: bucketPools, safetySummary } = precomputeBucketPools(allProducts, prefs);

  // ── Hangi slotlar aktif? ─────────────────────────────────────────────────
  function buildSteps(timeOfDay: TimeOfDay): SmartRoutineStep[] {
    const orderKey = timeOfDay === "morning" ? "morningOrder" : "eveningOrder";
    const eligible = ALL_SLOTS.filter(s => s[orderKey] !== -1);

    // Level filtresi
    const activeSlots = eligible.filter(s => {
      if (s.slot === "repair" && level === "simple") return false;
      if (s.slot === "treatment" && level === "simple") return false;
      if (s.slot === "repair"    && level === "balanced" && timeOfDay === "evening") return false;
      return true;
    });

    // Sırala
    activeSlots.sort((a, b) => a[orderKey] - b[orderKey]);

    const steps: SmartRoutineStep[] = [];
    const localUsed = new Set(usedIds);

    for (const slotCfg of activeSlots) {
      // Sunscreen yalnızca sabah
      if (slotCfg.slot === "sunscreen" && timeOfDay === "evening") continue;

      const slotBucketPool =
        slotCfg.bucket === "cleanser" || slotCfg.bucket === "serum" ||
        slotCfg.bucket === "moisturizer" || slotCfg.bucket === "sunscreen"
          ? bucketPools[slotCfg.bucket]
          : undefined;
      const pick = pickProductForSlot(slotCfg, concern, prefs, allMatched, localUsed, slotBucketPool);

      let selectedProduct:  Product | null = null;
      let selectedScore     = 0;
      let noProductReason:  "no_match" | "low_score" | undefined;

      if (pick.product) {
        selectedProduct = pick.product;
        selectedScore   = pick.score;
        localUsed.add(String(pick.product.id));
        usedIds.add(String(pick.product.id));
      } else {
        noProductReason = pick.reason;
      }

      const alternatives = selectedProduct
        ? findAlternatives(slotCfg, String(selectedProduct.id), allProducts, 2, prefs)
        : [];

      steps.push({
        slot:             slotCfg.slot,
        stepLabel:        slotCfg.label,
        icon:             slotCfg.icon,
        isEssential:      slotCfg.isEssential,
        product:          selectedProduct,
        productScore:     selectedScore,
        alternatives,
        why:              getWhyText(slotCfg.slot, concern),
        howTo:            HOW_TO[slotCfg.slot],
        caution:          CAUTIONS[slotCfg.slot],
        timeOfDay,
        noProductReason,
      });
    }

    return steps;
  }

  const morning = buildSteps("morning");
  const evening = buildSteps("evening");

  // ── Motivasyon + Zaman çizelgesi ─────────────────────────────────────────
  const tlKey = concern === "spots" ? "dark_spots" : concern === "dehydration" ? "dryness" : concern === "barrier_repair" ? "dryness" : concern as string;
  const tl    = CONCERN_TIMELINES[tlKey] ?? CONCERN_TIMELINES.dryness!;
  const timeline: RoutineTimeline = {
    phase1: tl.phase1.range,
    phase2: tl.phase2.range,
    phase3: tl.phase3.range,
    unit:   tl.phase2.label,
    note:   tl.note,
  };

  // ECZ4 Safety Explanation Phase Step 2 — gerçek exclusion sayımına dayalı
  // ek uyarı notları (mevcut buildWarnings çıktısına additive eklenir).
  const baseWarnings = buildWarnings(prefs, concern);
  const safetyNotes: string[] = [];
  if (safetySummary.pregnancyExcludedCount > 0) {
    safetyNotes.push("Hamilelik/emzirme bilgine göre bazı aktif içerikler öneri dışında bırakıldı.");
  }
  if (safetySummary.allergyExcludedCount > 0) {
    safetyNotes.push("Belirttiğin alerji veya kaçındığın içerikler nedeniyle bazı ürünler bu rutinde gösterilmedi.");
  }
  if (safetySummary.totalExcluded > 0) {
    const hasEmptySlot =
      morning.some(st => !st.product) || evening.some(st => !st.product);
    if (hasEmptySlot) {
      safetyNotes.push("Güvenlik filtreleri devrede olduğu için bu rutinde uygun ürün havuzu daralmış olabilir.");
    }
  }
  const warningNotes = [...baseWarnings, ...safetyNotes];

  return {
    morning,
    evening,
    level,
    levelLabel:    LEVEL_LABELS[level],
    motivationMsg: MOTIVATION_MESSAGES[concern],
    timeline,
    warningNotes,
    safetySummary,
  };
}
