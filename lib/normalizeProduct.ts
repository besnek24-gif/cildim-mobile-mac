/**
 * normalizeProduct.ts
 * Single source of truth for product data normalization.
 * Every field has a guaranteed shape — never undefined/null in consumers.
 */

import {
  Product,
  resolveImageUrl,
  resolveThumbnailUrl,
  resolveBrand,
  resolveProductName,
} from "@/types/product";
import { getFinalProductScore } from "@/lib/getFinalScore";
import {
  buildQuickBadges,
  buildIngredientSummary,
  type QuickBadge,
} from "@/lib/ingredientAnalysis";
import { resolveFeature as truthResolveFeature } from "@/lib/features/featureTruth";
import {
  calcDermoScore,
  extractIngredientNames,
  scoreToLabel,
  scoreToColor,
  type DermoScoreResult,
} from "@/lib/dermoScore";
import { extractBadgeStatus, type BadgeStatus } from "@/lib/compareProducts";

export interface NormalizedWarning {
  text: string;
  isRisk: boolean;
}

export interface NormalizedBadge {
  key: string;
  label: string;
  status: BadgeStatus;
  positiveLabel: string;
  negativeLabel: string;
  unknownLabel: string;
}

export interface NormalizedProduct {
  // Identity
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  subcategory: string | null;
  segment: string | null;
  score: number | null;
  rating: number | null;
  reviewCount: number | null;

  // Content (de-duplicated)
  shortBenefit: string | null; // One-liner top benefit
  about: string | null; // Full description (≠ shortBenefit)
  extraInfo: string | null; // short_description if different from above two
  usageInstructions: string | null;
  disclaimer: string | null;

  // Parsed data
  benefits: string[];
  warnings: NormalizedWarning[];
  skinTypes: string[];
  tags: string[];
  price: number | null;
  volume: number | null;
  usageTime: string | null;
  pregnancySafe: string | null;
  breastfeedingSafe: string | null;
  allergyInfo: string | null;
  concerns: string[];

  // Ingredient data
  ingredientsRaw: string | null; // comma-separated string
  ingredientsList: string[]; // array
  quickBadges: QuickBadge[];
  badges: NormalizedBadge[];

  // Dermo score
  dermoResult: DermoScoreResult | null;

  // Raw product reference (for anything not normalized)
  _raw: Product;
}

const BADGE_DEFS: Array<{
  key: "vegan" | "paraben" | "sulfate" | "fragrance" | "alcohol" | "silicone";
  label: string;
  positiveLabel: string;
  negativeLabel: string;
  unknownLabel: string;
}> = [
  {
    key: "vegan",
    label: "Vegan",
    positiveLabel: "Vegan",
    negativeLabel: "Vegan Değil",
    unknownLabel: "Belirsiz",
  },
  {
    key: "paraben",
    label: "Paraben",
    positiveLabel: "Paraben İçermez",
    negativeLabel: "Paraben İçerir",
    unknownLabel: "Belirsiz",
  },
  {
    key: "sulfate",
    label: "Sülfat",
    positiveLabel: "Sülfat İçermez",
    negativeLabel: "Sülfat İçerir",
    unknownLabel: "Belirsiz",
  },
  {
    key: "fragrance",
    label: "Parfüm",
    positiveLabel: "Parfüm İçermez",
    negativeLabel: "Parfüm İçerir",
    unknownLabel: "Belirsiz",
  },
  {
    key: "alcohol",
    label: "Alkol",
    positiveLabel: "Alkol İçermez",
    negativeLabel: "Alkol İçerir",
    unknownLabel: "Belirsiz",
  },
  {
    key: "silicone",
    label: "Silikon",
    positiveLabel: "Silikon İçermez",
    negativeLabel: "Silikon İçerir",
    unknownLabel: "Belirsiz",
  },
];

// D1 fix: unified with `_getLowerIngredients` in featureTruth.ts — both now
// accept ingredients as either a STRING or an ARRAY. Previously, an array
// `p.ingredients` returned null here while featureTruth handled it, producing
// the asymmetric "rozetler boş ama notlar net" (or vice versa) divergence.
function getIngredientsString(p: Product): string | null {
  const raw = (p as unknown as { ingredients?: unknown }).ingredients;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    const joined = (raw as unknown[])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .join(", ");
    return joined.length > 0 ? joined : null;
  }
  return null;
}

function getIngredientsList(p: Product): string[] {
  if (Array.isArray(p.ingredients) && p.ingredients.length > 0)
    return p.ingredients;
  const raw = (p as any).icerik_listesi ?? (p as any).ingredientsList ?? "";
  if (typeof raw === "string" && raw.trim())
    return raw
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  if (Array.isArray(raw)) return raw;
  return [];
}

function buildWarnings(p: Product): NormalizedWarning[] {
  const result: NormalizedWarning[] = [];
  const raw: string[] = Array.isArray(p.warnings)
    ? (p.warnings as unknown as string[])
    : typeof (p.warnings as unknown) === "string" &&
        (p.warnings as unknown as string)
      ? [p.warnings as unknown as string]
      : [];

  for (const w of raw.slice(0, 4)) {
    result.push({ text: w, isRisk: true });
  }

  // Fallback from badges if no explicit warnings.
  // FEATURE TRUTH LAYER — direct call (extractBadgeStatus de aynı katmanı kullanır;
  // burada doğrudan çağırarak truth = canonical bağımlılık olduğunu netleştiriyoruz).
  if (result.length === 0) {
    const frag = truthResolveFeature(p, "fragrance");
    const alc  = truthResolveFeature(p, "alcohol");
    const par  = truthResolveFeature(p, "paraben");
    const sil  = truthResolveFeature(p, "silicone");
    if (frag === true)
      result.push({
        text: "Parfüm içerir — hassas ciltte irritasyon riski",
        isRisk: true,
      });
    if (alc === true)
      result.push({
        text: "Alkol içerir — kurutucu etki yapabilir",
        isRisk: true,
      });
    if (par === true)
      result.push({
        text: "Paraben içerir — hormonal hassasiyeti olanlar dikkat",
        isRisk: true,
      });
    if (sil === true)
      result.push({
        text: "Silikon içerir — gözenek tıkanması ve birikim riski",
        isRisk: true,
      });
    if (result.length === 0)
      result.push({
        text: "Belirgin risk sinyali tespit edilmedi",
        isRisk: false,
      });
  }

  return result.slice(0, 3);
}

// ─── Short Benefit Üretimi ────────────────────────────────────────────────────
// KURAL: Metin kopyalama YASAK. Üretim zorunlu.
// Akış:
//   1. DB'de short_benefit varsa → sadece dil kuralları uygula (insan yazdı, temiz tut)
//   2. Yoksa → description'dan ETKİ tespit et → segment'e göre hazır cümle seç
//   3. Hiç etki tespit edilemezse → null (BenefitCard gösterilmez)

type ProductSegment = "ekonomik" | "profesyonel" | "seçkin";

// ── Yasaklı kelimeler (DB'den gelen short_benefit üzerinde uygulanır) ─────────
const BANNED_REPLACEMENTS: [RegExp, string][] = [
  [/\bdeneyim\b/gi, "tecrübe"],
  [/\bsağlar\b/gi, "sunar"],
  [/\bsağlamaya\b/gi, "sunmaya"],
  [/\bşahsi\b/gi, "şahsi"],
];

const FILLER_RX: RegExp[] = [
  /\bayrıca\b/gi,
  /\bve ayrıca\b/gi,
  /\bile birlikte\b/gi,
  /\bbununla birlikte\b/gi,
];

// ── Etki kütüphanesi (öncelik sırası önemlidir) ───────────────────────────────
// Her etki kategorisi: hangi kelimeleri arar + her segment için hazır cümle
interface EffectEntry {
  detect: RegExp[];
  sentence: Record<ProductSegment, string>;
}

const EFFECT_LIBRARY: EffectEntry[] = [
  // 1. Güneş koruma (en spesifik)
  {
    detect: [/güneş/i, /\bspf\b/i, /\buv\b/i, /ultraviyole/i],
    sentence: {
      ekonomik: "Güneşe karşı günlük koruma sunar.",
      profesyonel: "Güneşin zararlı ışınlarına karşı güçlü koruma sunar.",
      seçkin: "Güneşin zararlı etkilerine karşı ileri düzey koruma sunar.",
    },
  },
  // 2. Yaşlanma karşıtı
  {
    detect: [
      /yaşlanma/i,
      /kırışık/i,
      /anti.?aging/i,
      /kolajen/i,
      /elastin/i,
      /retinol/i,
    ],
    sentence: {
      ekonomik: "Kırışık görünümünü azaltmaya yardımcı olur.",
      profesyonel:
        "Kırışık görünümünü azaltır ve cilt elastikiyetini destekler.",
      seçkin: "Yaşlanma karşıtı etki sunar ve cilt yapısını güçlendirir.",
    },
  },
  // 3. Aydınlatma / leke
  {
    detect: [
      /aydınlat/i,
      /leke/i,
      /eşit.?ton/i,
      /parlaklık/i,
      /vitamin\s*c/i,
      /niasinamid/i,
    ],
    sentence: {
      ekonomik: "Cilt tonunu eşitler ve parlaklık sunar.",
      profesyonel: "Leke görünümünü azaltır ve cilt tonunu eşitler.",
      seçkin: "Cilt aydınlatır ve leke görünümünü belirgin biçimde azaltır.",
    },
  },
  // 4. Sıkılaştırma / lifting
  {
    detect: [
      /sıkılaştır/i,
      /elastiyet/i,
      /gerginl/i,
      /lifting/i,
      /form\s*kaz/i,
    ],
    sentence: {
      ekonomik: "Cilt görünümünü sıkılaştırmaya yardımcı olur.",
      profesyonel: "Cilt elastikiyetini destekler ve sıkılaştırır.",
      seçkin: "Cildi sıkılaştırır ve kalıcı elastikiyet desteği sunar.",
    },
  },
  // 5. Bariyer güçlendirme
  {
    detect: [/bariyer/i, /dış\s*etken/i, /koruma\s*kal/i, /ceramid/i],
    sentence: {
      ekonomik: "Cilt bariyerini korur ve destekler.",
      profesyonel: "Cilt bariyer fonksiyonunu güçlendirir ve korur.",
      seçkin:
        "Cilt bariyerini güçlendirir ve dış etkenlere karşı koruma sunar.",
    },
  },
  // 6. Nemlendirme
  {
    detect: [/nemlend/i, /nem\s*den/i, /hidratas/i, /hyaluronik/i, /gliserin/i],
    sentence: {
      ekonomik: "Cildi nemlendirir ve yumuşak tutar.",
      profesyonel:
        "Cilt nem dengesini korur ve bariyer fonksiyonunu destekler.",
      seçkin: "Derin nem desteği sunar ve cilt bariyerini güçlendirir.",
    },
  },
  // 7. Arındırma / gözenek temizleme
  {
    detect: [
      /arındır/i,
      /temizl/i,
      /gözenek/i,
      /sebum/i,
      /yağ\s*deng/i,
      /salisilik/i,
    ],
    sentence: {
      ekonomik: "Cildi temizler ve gözenekleri arındırır.",
      profesyonel: "Cildi derinlemesine arındırır ve yağ dengesini destekler.",
      seçkin: "Cildi yoğun şekilde arındırır ve yağ dengesini güçlendirir.",
    },
  },
  // 8. Yatıştırma / hassas cilt
  {
    detect: [
      /yatıştır/i,
      /hassas/i,
      /kızarık/i,
      /sakinleştir/i,
      /tahriş/i,
      /aloe/i,
    ],
    sentence: {
      ekonomik: "Hassas cildi yatıştırır ve tahriş giderir.",
      profesyonel: "Cilt tahrişini giderir ve hassas cildi yatıştırır.",
      seçkin: "Hassas cildi yatıştırır ve deri bariyerini korur.",
    },
  },
  // 9. Besleyici / antioksidan
  {
    detect: [/besle/i, /antioksidan/i, /vitamin\s*[ae]/i, /omega/i, /retinol/i],
    sentence: {
      ekonomik: "Cildi besler ve canlı tutar.",
      profesyonel: "Cildi besler ve antioksidan koruma sunar.",
      seçkin: "Cildi yoğun besinlerle besler ve antioksidan koruma sunar.",
    },
  },
  // 10. Ferahlık / serinleme
  {
    detect: [/ferahlatır/i, /serinlet/i, /ferah/i, /mentol/i, /nane/i],
    sentence: {
      ekonomik: "Cildi ferahlatır ve serinlik hissi sunar.",
      profesyonel: "Cilde anlık ferahlık hissi sunar ve canlandırır.",
      seçkin: "Anlık ferahlık hissi sunar ve cildi canlandırır.",
    },
  },
];

// ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────────

function resolveSegment(segment: string | null): ProductSegment {
  if (
    segment === "ekonomik" ||
    segment === "profesyonel" ||
    segment === "seçkin"
  )
    return segment;
  return "profesyonel";
}

function cleanStoredBenefit(text: string): string {
  let out = text;
  for (const [rx, rep] of BANNED_REPLACEMENTS) out = out.replace(rx, rep);
  for (const fill of FILLER_RX) out = out.replace(fill, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  // Nokta ile bitir
  if (!out.match(/[.!?]$/)) out += ".";
  // Max 25 kelime — stored benefit olduğu için kırpmaya izin var
  const words = out.split(/\s+/);
  if (words.length > 25)
    out =
      words
        .slice(0, 25)
        .join(" ")
        .replace(/[,;]?$/, "") + ".";
  return out;
}

function detectEffect(description: string): EffectEntry | null {
  for (const entry of EFFECT_LIBRARY) {
    if (entry.detect.some((rx) => rx.test(description))) return entry;
  }
  return null;
}

// ── Ana fonksiyon ──────────────────────────────────────────────────────────────

function generateShortBenefit(
  storedBenefit: string | null,
  description: string | null,
  segment: string | null,
): string | null {
  const seg = resolveSegment(segment);

  // 1. DB'de short_benefit varsa → sadece dil temizliği uygula (kopyalama değil, zaten kısa)
  if (storedBenefit) {
    const cleaned = cleanStoredBenefit(storedBenefit);
    return cleaned || null;
  }

  // 2. Description yoksa → üretemeyiz
  if (!description) return null;

  // 3. Description'dan etki tespit et → hazır cümle seç (KOPYALAMA YOK)
  const effect = detectEffect(description);
  if (!effect) return null;

  return effect.sentence[seg];
}

function buildDermoResult(p: Product): DermoScoreResult | null {
  const stored = (p as any).dermo_score;
  const storedLabel = (p as any).dermo_label;
  if (typeof stored === "number") {
    return {
      total: stored,
      label: storedLabel ?? scoreToLabel(stored),
      color: scoreToColor(stored),
      analyzed: 0,
      total_ingredients: 0,
      counts: {
        beneficial: 0,
        safe: 0,
        mild: 0,
        moderate: 0,
        high_concern: 0,
        avoid: 0,
      },
      concerns: [],
    };
  }
  const names = extractIngredientNames(p as any);
  if (names.length === 0) {
    // Estimate from explicit boolean fields if no ingredients
    const boolFields = [
      extractBadgeStatus(p, "paraben"),
      extractBadgeStatus(p, "fragrance"),
      extractBadgeStatus(p, "alcohol"),
    ].filter((s) => s !== "unknown");
    if (boolFields.length === 0) return null;
    const riskCount = boolFields.filter((s) => s === "negative").length;
    const estimatedScore = Math.max(60 - riskCount * 15, 30);
    return {
      total: estimatedScore,
      label: scoreToLabel(estimatedScore),
      color: scoreToColor(estimatedScore),
      analyzed: 0,
      total_ingredients: 0,
      counts: {
        beneficial: 0,
        safe: 0,
        mild: 0,
        moderate: 0,
        high_concern: 0,
        avoid: 0,
      },
      concerns: [],
    };
  }
  return calcDermoScore(names);
}

/** Main normalization function — call once, pass NormalizedProduct everywhere */
export function normalizeProductData(p: Product): NormalizedProduct {
  const ingredientsRaw = getIngredientsString(p);
  const ingredientsList = getIngredientsList(p);
  // D1 fix: pass the FULL product object so buildQuickBadges can route
  // through resolveFeature (which reads features jsonb + contains_<key> +
  // ingredient regex in canonical priority order). Identical verdict source
  // as extractBadgeStatus → safetyAlertEngine → productWarnings.
  const quickBadges = buildQuickBadges(p);

  // Compute badge status (uses explicit boolean fields first)
  const badges: NormalizedBadge[] = BADGE_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    status: extractBadgeStatus(p, def.key),
    positiveLabel: def.positiveLabel,
    negativeLabel: def.negativeLabel,
    unknownLabel: def.unknownLabel,
  }));

  // De-duplicate text fields
  // short_benefit priority: explicit field → short_description (batch imports) → generate from description
  const _storedBenefit: string | null =
    (p.short_benefit as string | undefined)?.trim() ||
    // Batch imports use short_description instead of short_benefit
    ((p as any).short_description as string | undefined)?.trim() ||
    null;
  const shortBenefit = generateShortBenefit(
    _storedBenefit,
    (
      p.description ??
      p.full_description ??
      ((p as any).aciklama as string | undefined)
    )?.trim() || null,
    p.segment || null,
  );
  const fullDesc =
    (
      p.description ??
      p.full_description ??
      ((p as any).aciklama as string | undefined)
    )?.trim() || null;
  const shortDesc = null;

  const about: string | null =
    fullDesc || (shortDesc && shortDesc !== shortBenefit ? shortDesc : null);
  const extraInfo: string | null =
    shortDesc && shortDesc !== shortBenefit && shortDesc !== about
      ? shortDesc
      : null;

  const scoreInt = getFinalProductScore(p);

  return {
    id: String(p.id ?? ""),
    name: resolveProductName(p),
    brand: resolveBrand(p) || null,
    imageUrl: resolveImageUrl(p) || null,
    thumbnailUrl: resolveThumbnailUrl(p) || null,
    category:
      (p.category ?? ((p as any).kategori as string | undefined)) || null,
    subcategory: (p.subcategory as string | undefined) || null,
    segment: p.segment || null,
    score: scoreInt,
    rating: (p.rating as number | undefined) ?? null,
    reviewCount: (p.review_count as number | undefined) ?? null,

    shortBenefit,
    about,
    extraInfo,
    usageInstructions:
      (p.usage_instructions as string | undefined)?.trim() || null,
    disclaimer: (p.disclaimer as string | undefined)?.trim() || null,

    benefits: Array.isArray(p.benefits) ? p.benefits : [],
    warnings: buildWarnings(p),
    skinTypes: Array.isArray(p.skin_types)
      ? p.skin_types
      : p.skin_type
        ? [p.skin_type]
        : [],
    tags: Array.isArray((p as any).tags) ? (p as any).tags : [],
    price: p.price ?? p.average_price ?? null,
    volume: (p.volume as number | undefined) ?? null,
    usageTime: (p.usage_time as string | undefined) || null,
    pregnancySafe:
      (p.pregnancy_safe ?? ((p as any).pregnancy_use as any))?.toString() ||
      null,
    breastfeedingSafe: (p.breastfeeding_safe as string | undefined) || null,
    allergyInfo: (p.allergy_info as string | undefined) || null,
    concerns: Array.isArray(p.concerns) ? p.concerns : [],

    ingredientsRaw,
    ingredientsList,
    quickBadges,
    badges,

    dermoResult: buildDermoResult(p),

    _raw: p,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Eksik Veri Raporu — Admin / geliştirici yardımcısı
// ─────────────────────────────────────────────────────────────────────────────

export type MissingField =
  | "short_benefit"
  | "category_label"
  | "dermatology_score"
  | "badges"
  | "usage_instructions"
  | "about_product"
  | "image"
  | "ingredients";

export interface ProductValidationReport {
  productId: string;
  productName: string;
  missingFields: MissingField[];
  completeness: number; // 0–100 yüzde
  isComplete: boolean;
}

const REQUIRED_FIELDS: Array<{
  key: MissingField;
  check: (p: NormalizedProduct) => boolean;
}> = [
  { key: "short_benefit", check: (p) => !!p.shortBenefit },
  { key: "category_label", check: (p) => !!p.category },
  { key: "dermatology_score", check: (p) => p.dermoResult !== null },
  {
    key: "badges",
    check: (p) =>
      p.badges.some((b) => b.status !== "unknown") || p.quickBadges.length > 0,
  },
  { key: "usage_instructions", check: (p) => !!p.usageInstructions },
  { key: "about_product", check: (p) => !!p.about },
  { key: "image", check: (p) => !!p.imageUrl },
  {
    key: "ingredients",
    check: (p) => p.ingredientsList.length > 0 || !!p.ingredientsRaw,
  },
];

/**
 * Bir ürünün hangi alanlarının eksik olduğunu raporlar.
 * Admin paneli veya geliştirici konsolunda kullanın.
 *
 * @example
 * const report = validateProductData(normalizeProductData(product));
 * if (!report.isComplete) console.warn(report);
 */
export function validateProductData(
  p: NormalizedProduct,
): ProductValidationReport {
  const missing: MissingField[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!field.check(p)) missing.push(field.key);
  }
  const completeness = Math.round(
    ((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100,
  );
  return {
    productId: p.id,
    productName: p.name,
    missingFields: missing,
    completeness,
    isComplete: missing.length === 0,
  };
}

/**
 * Birden fazla ürünü toplu kontrol eder.
 * Sadece eksik alanı olan ürünleri döndürür.
 */
export function validateProductBatch(
  products: NormalizedProduct[],
): ProductValidationReport[] {
  return products.map(validateProductData).filter((r) => !r.isComplete);
}
