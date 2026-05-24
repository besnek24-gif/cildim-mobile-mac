/**
 * ECZ-REC-GATE-1 — Scan-derived ürün önerisi güvenlik filtresi
 *
 * Saf, deterministik. Ağ yok, Supabase yok, mutation yok.
 *
 * Yalnızca scan-derived (taramadan türeyen) ürün gösterimi yollarında
 * çağrılır. Home/Search/Favoriler/Comparison/Product Detail gibi genel
 * gezinme alanlarına kesinlikle DEĞMEZ — entegrasyon noktaları sadece
 * premium-skin-scan-v2 içindeki tüketicilerdir (result.tsx,
 * routine-program.tsx).
 *
 * Tek doğruluk kaynağı: SkinScanContextBundle. Bu modül kendi risk modu
 * hesabı yapmaz — yalnızca bundle alanlarını okur.
 *
 * Şema değişikliği yok: yalnızca V2DBProduct'ta mevcut alanları okur
 * (id, name, brand, short_benefit, category, segment, badges).
 */

import type { V2DBProduct } from "@/lib/premium-skin-scan-v2/v2ProductDB";
import type { SkinScanContextBundle } from "./contextBundle";

// ─── Yasaklı tokenlar (aktif-ağır/agresif içerikler) ─────────────────────────
// Tümü küçük harfle. Searchable text'te substring araması yapılır.

const ACTIVE_HEAVY_TOKENS: readonly string[] = [
  // Retinoidler
  "retinol", "retinal", "retinoid", "retinoik", "retinoic",
  "tretinoin", "adapalen", "adapalene",
  // Asitler
  "aha", "bha", "pha",
  "glycolic", "glikolik",
  "lactic acid", "laktik asit",
  "salicylic", "salisilik",
  "mandelic", "mandelik",
  "azelaic", "azelaik",
  // Aydınlatıcı / leke karşıtı yoğun
  "hydroquinone", "hidrokinon",
  "arbutin", "alfa arbutin", "alpha arbutin",
  "kojic", "kojik",
  "leke karşıtı yoğun bakım", "leke karsiti yogun bakim",
  // Eksfoliant / peeling / soyucu
  "peeling", "eksfoliasyon", "exfoliant", "exfoliating", "soyucu",
  // Akne / sivilce karşıtı tedavi
  "anti-acne", "anti acne", "acne treatment", "akne tedavi",
  "akne karşıtı tedavi", "akne karsiti tedavi",
  "sivilce karşıtı tedavi", "sivilce karsiti tedavi",
  "spot treatment", "leke tedavisi",
  // C vitamini (aktif serum konumlandırması)
  "vitamin c serum", "c vitamini serum", "ascorbic acid", "askorbik asit",
  // Niasinamid yalnızca yoğun/serum konumlandırmasında — pediatric/irritated/blocked'ta blok
  // (pediatric ve irritated modlarda zaten yalnız bariyer/temizleyici/güneş tutuyoruz)
];

// Niasinamid için bağlama duyarlı (pediatric/irritated dışında izinli)
const NIACINAMIDE_TOKENS: readonly string[] = [
  "niacinamide", "niasinamid", "niyasinamid",
];

// ─── Konservatif kategori etiketleri (DB category alanı ILIKE) ───────────────

const CATEGORY_BUCKETS = {
  cleanser:    ["temizle", "cleanser", "cleansing", "köpük", "kopuk", "jel temiz", "yıkama", "yikama", "micel", "face wash"],
  moisturizer: ["nemlendir", "moistur", "krem", "cream", "losyon", "lotion", "bariyer", "barrier", "onarıcı", "onarici", "ceramid", "ceram"],
  sunscreen:   ["güneş", "gunes", "spf", "sunscreen", "uv koruyucu", "fizik filtre", "mineral spf"],
  soothing:    ["yatıştırıcı", "yatistirici", "soothing", "calming", "cicaplast", "cica ", "panthenol", "pantenol", "centella"],
  barrier:     ["bariyer", "barrier", "onarıcı", "onarici", "ceramid", "ceram"],
  baby_safe:   ["bebek", "baby", "çocuk", "cocuk", "kids", "child"],
} as const;

type Bucket = keyof typeof CATEGORY_BUCKETS;

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function lc(s: unknown): string {
  return String(s ?? "").toLowerCase();
}

/** V2DBProduct alanlarından aranabilir tek metin üretir. Schema'ya dokunmaz. */
function searchableText(p: V2DBProduct): string {
  const badgesText = (() => {
    const b: any = (p as any).badges;
    if (!b) return "";
    if (Array.isArray(b)) return b.map(String).join(" ");
    if (typeof b === "string") return b;
    if (typeof b === "object") {
      try { return Object.values(b).map(String).join(" "); } catch { return ""; }
    }
    return "";
  })();

  return [
    p.name,
    p.brand ?? "",
    p.short_benefit ?? "",
    p.category ?? "",
    p.segment ?? "",
    badgesText,
  ].map(lc).join(" | ");
}

function containsAny(text: string, tokens: readonly string[]): boolean {
  for (const t of tokens) {
    if (text.includes(t)) return true;
  }
  return false;
}

function inBucket(p: V2DBProduct, bucket: Bucket): boolean {
  const text = searchableText(p);
  return containsAny(text, CATEGORY_BUCKETS[bucket]);
}

function inAnyBucket(p: V2DBProduct, buckets: Bucket[]): boolean {
  return buckets.some((b) => inBucket(p, b));
}

// ─── Sonuç tipi ──────────────────────────────────────────────────────────────

export type SafetyMode =
  | "off"           // tam serbest (high/medium reliability + normal/sensitive)
  | "low_conf"      // düşük güven: sade kategoriler, max 3, aktif yok
  | "irritated"     // tahriş/kızarıklık: bariyer/yatıştırıcı, max 3, aktif yok
  | "pediatric"     // bebek/çocuk: baby-safe + temel kategoriler, max 3, aktif yok
  | "blocked";      // hiç ürün önerisi gösterme

export interface ScanRecFilterResult {
  products: V2DBProduct[];
  removed: number;
  mode: SafetyMode;
  /** Tüketici küçük bir not göstermek istiyorsa kullanır. Boş ise not yok. */
  note: string | null;
}

export interface ScanRecFilterOptions {
  /** Belirtilirse cap için override; yoksa moda özgü varsayılan. */
  maxCount?: number;
  /** Tüketici loglama/debug için adım adı geçebilir; davranışı etkilemez. */
  stepName?: string;
}

// ─── Mod karar fonksiyonu ────────────────────────────────────────────────────

function decideMode(bundle: SkinScanContextBundle): SafetyMode {
  // Önce kesin engeller
  if (bundle.routineEligibility === "blocked") return "blocked";
  if (bundle.resultReliabilityLevel === "insufficient") return "blocked";

  if (bundle.riskMode === "pediatric" || bundle.ageGroup === "baby" || bundle.ageGroup === "child") {
    // pediatric eligibility minimal ise pediatric modu uygula; blocked üstte zaten kesti
    return "pediatric";
  }

  if (bundle.riskMode === "irritated") return "irritated";

  if (
    bundle.riskMode === "low_confidence" ||
    bundle.resultReliabilityLevel === "low" ||
    bundle.routineEligibility === "minimal"
  ) {
    return "low_conf";
  }

  // normal / sensitive + medium/high reliability + full eligibility
  return "off";
}

// ─── Mod başına filtre kuralları ─────────────────────────────────────────────

function isActiveHeavy(p: V2DBProduct, includeNiacinamide: boolean): boolean {
  const t = searchableText(p);
  if (containsAny(t, ACTIVE_HEAVY_TOKENS)) return true;
  if (includeNiacinamide && containsAny(t, NIACINAMIDE_TOKENS)) return true;
  return false;
}

function pediatricKeep(p: V2DBProduct): boolean {
  // Asla aktif-ağır ürün
  if (isActiveHeavy(p, true)) return false;

  // Yetişkin kozmetik kategorileri (serum, toner-asit, anti-aging) reddet
  const t = searchableText(p);
  const adultOnly = [
    "anti-aging", "anti aging", "yaşlanma karşıtı", "yaslanma karsiti",
    "serum", "ampul", "ampoule",
    "toner",
  ];
  if (containsAny(t, adultOnly)) return false;

  // Güneş koruyucu yalnızca baby/child-safe veya mineral filtre işareti varsa
  if (inBucket(p, "sunscreen")) {
    return inBucket(p, "baby_safe") || t.includes("mineral") || t.includes("fizik filtre");
  }

  // Onaylı kategoriler: temizleyici, nemlendirici, bariyer/onarıcı, baby_safe
  return inAnyBucket(p, ["cleanser", "moisturizer", "barrier", "baby_safe"]);
}

function irritatedKeep(p: V2DBProduct): boolean {
  if (isActiveHeavy(p, true)) return false;
  // Bariyer / yatıştırıcı / nemlendirici / temizleyici (sade) kabul
  if (inAnyBucket(p, ["barrier", "soothing", "moisturizer", "cleanser"])) return true;
  // Güneş koruyucu — yalnız mineral / fizik filtre
  if (inBucket(p, "sunscreen")) {
    const t = searchableText(p);
    return t.includes("mineral") || t.includes("fizik filtre");
  }
  return false;
}

function lowConfKeep(p: V2DBProduct): boolean {
  if (isActiveHeavy(p, false)) return false; // niasinamid genel low_conf'ta tolere edilir
  // Temel bakım: temizleyici, nemlendirici, güneş, bariyer/yatıştırıcı
  return inAnyBucket(p, ["cleanser", "moisturizer", "sunscreen", "barrier", "soothing"]);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Scan-derived ürün listesini context bundle'a göre güvenli hale getirir.
 *
 * @param products  Aday V2DBProduct listesi (sırayı korur).
 * @param bundle    SkinScanContextBundle (tek doğruluk).
 * @param options   maxCount override / debug stepName.
 *
 * Saf fonksiyon. Aynı input → aynı output. Ürün objelerini değiştirmez.
 */
export function applyScanRecommendationSafetyFilter(
  products: V2DBProduct[] | null | undefined,
  bundle: SkinScanContextBundle,
  options: ScanRecFilterOptions = {},
): ScanRecFilterResult {
  const input = Array.isArray(products) ? products : [];
  const mode  = decideMode(bundle);

  if (mode === "off") {
    return { products: input, removed: 0, mode, note: null };
  }

  if (mode === "blocked") {
    return {
      products: [],
      removed: input.length,
      mode,
      note:
        "Bu sonuçla otomatik ürün önerisi yapmak güvenli görünmüyor. Daha net fotoğraflarla tekrar deneyebilir veya eczacınıza/hekiminize danışabilirsiniz.",
    };
  }

  let predicate: (p: V2DBProduct) => boolean;
  let defaultCap: number;
  let note: string;

  switch (mode) {
    case "pediatric":
      predicate  = pediatricKeep;
      defaultCap = 3;
      note =
        "Bebek/çocuk cildi için yalnızca temel bakım ürünleri gösteriliyor. Belirgin kızarıklık veya tahriş şüphesinde eczacı/hekim görüşü alınmalıdır.";
      break;
    case "irritated":
      predicate  = irritatedKeep;
      defaultCap = 3;
      note =
        "Belirgin tahriş/kızarıklık benzeri görünüm nedeniyle yalnızca bariyer ve yatıştırıcı bakım ürünleri öneriliyor.";
      break;
    case "low_conf":
    default:
      predicate  = lowConfKeep;
      defaultCap = 3;
      note =
        "Güvenilirlik sınırlı olduğu için öneriler temel bakım düzeyinde tutuldu.";
      break;
  }

  const cap     = Math.max(0, options.maxCount ?? defaultCap);
  const kept    = input.filter(predicate).slice(0, cap);
  const removed = input.length - kept.length;

  return {
    products: kept,
    removed,
    mode,
    note: kept.length === 0
      ? "Bu sonuçla güvenli bir ürün önerisi yapılamıyor."
      : note,
  };
}
