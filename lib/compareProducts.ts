import type { Product } from "@/types/product";
import { analyzeIngredients, type IngredientAnalysis } from "./analyzeIngredients";
import { getIngredientInfo } from "./ingredientAnalysis";
import { getDisplayScore } from "./getFinalScore";
import {
  resolveFeature as truthResolveFeature,
  type FeatureKey as TruthFeatureKey,
} from "@/lib/features/featureTruth";

// ─── Types ─────────────────────────────────────────────────────────────────

export type BadgeStatus = "positive" | "negative" | "unknown";

export interface ComparisonBadge {
  key: string;
  label: string;
  /** "positive" = içermez/vegan  |  "negative" = içerir  |  "unknown" = belirsiz */
  a: BadgeStatus;
  b: BadgeStatus;
  /** Hangi yön "iyi"? positive=içermez-iyi, negative=içerir-iyi (vegan gibi) */
  positiveIsGood: boolean;
}

export interface IngredientComparisonResult {
  common: string[];
  onlyA: string[];
  onlyB: string[];
  totalA: number;
  totalB: number;
  riskA: { high: number; medium: number; low: number; safe: number };
  riskB: { high: number; medium: number; low: number; safe: number };
  hasData: boolean;
}

export interface SharedFeature {
  icon: string;
  label: string;
}

export interface DiffFeature {
  icon: string;
  label: string;
  winner: "A" | "B" | null;
}

export interface SkinTypeRow {
  type: string;
  label: string;
  a: "good" | "caution" | "neutral";
  b: "good" | "caution" | "neutral";
}

export interface ComparisonSummaryItem {
  icon: string;
  label: string;
  winner: "A" | "B" | "tie" | null;
  detail: string;
}

// ── Kullanıcıya özel güvenlik verisi ────────────────────────────────────────

/** compareProducts'a iletilen kullanıcı profil özeti. */
export interface UserSafetyProfile {
  /** Kullanıcının bildirdiği alerji keyleri (AllergyKey[]). */
  allergies: string[];
  /** Kullanıcının özel koşulları: "pregnancy" | "breastfeeding" | "sensitive_skin" vb. */
  specialConditions: string[];
}

/** Tek ürün için kullanıcıya özel güvenlik özeti. */
export interface UserSafetyProductResult {
  /** Ürünün içeriğiyle örtüşen kullanıcı alerji keyleri. */
  matchedAllergies: string[];
  /** Bileşen tabanlı hamilelik riski (profil bağımsız — her zaman üretilir). */
  pregnancyRisk: boolean;
  /** Bileşen tabanlı emzirme riski. */
  breastfeedingRisk: boolean;
  /** Bileşen tabanlı hassas cilt riski. */
  sensitiveSkinRisk: boolean;
}

export interface ComparisonResult {
  shared: SharedFeature[];
  different: DiffFeature[];
  ingredients: IngredientComparisonResult;
  badges: ComparisonBadge[];
  skinTypes: SkinTypeRow[];
  summary: ComparisonSummaryItem[];
  verdict: string[];
  ingredientAnalysis: { a: IngredientAnalysis; b: IngredientAnalysis };
  ingredientDiffNotes: string[];
  ingredientScoreBonus: { a: number; b: number };
  ingredientAnalysisReliable: boolean;
  /**
   * Kullanıcıya özel güvenlik özeti.
   * Profil verilmese bile her zaman mevcuttur (varsayılan: boş array / false).
   */
  userSafety: { a: UserSafetyProductResult; b: UserSafetyProductResult };
  /**
   * Kullanıcıya gösterilebilecek kısa güvenlik notları.
   * Profil veya ilgili özel durum seçili değilse boş array.
   */
  safetyNotes: { a: string[]; b: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function normName(p: Product): string {
  return (p.name ?? (p as any).isim ?? "Ürün").trim();
}
function normBrand(p: Product): string {
  return (p.brand ?? (p as any).marka ?? "").trim();
}
function normCategory(p: Product): string {
  return (p.category ?? (p as any).kategori ?? "").trim();
}
export function normScore(p: Product): number | null {
  // Tüm ekranlarla tutarlı kalmak için TEK kaynak getDisplayScore'a yönlendir.
  return getDisplayScore(p as any);
}
export function normPrice(p: Product): number | null {
  return p.price ?? p.average_price ?? null;
}
function normIngredients(p: Product): string[] {
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
function arraysOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => setB.has(x.toLowerCase()));
}

/**
 * extractBadgeStatus — ROBUST TOKEN MATCHING (refactor v3).
 *
 * Veri yelpazesi (öncelik sırası — değişmedi):
 *   1) Explicit boolean (contains_paraben/fragrance/alcohol) — iki yönlü
 *      polarite. Booleanlar token'ları EZER.
 *   2) product.features[] ∪ product.badges[]  → tek token havuzu.
 *
 * v3 değişiklik: tam eşleme yerine AGRESİF NORMALİZASYON + SUBSTRING.
 *   • TR aksanlar ASCII'ye düşürülür (ı→i, ü→u, ö→o, ş→s, ç→c, ğ→g)
 *   • '-' ve boşluk → '_' birleştirilir
 *   • "paraben_free", "Parabensiz", "PARABEN-FREE" hepsi yakalanır.
 *
 * Risk yönetimi: substring "paraben" hem "paraben_free" hem
 * "paraben_iceriyor" eşler → false-positive olur. Bu yüzden
 * NEGATION_MARKERS ile negatif token'lar AYIKLANIR; pozitif kontrol
 * sadece "negation taşımayan" token'larda yapılır.
 *
 * Ingredient parsing YOK. Tahmin YOK.
 */
const KEY_SUBSTRINGS: Record<string, string[]> = {
  // Türkçe formlar normalizasyondan SONRAKİ ASCII halleriyle yazıldı.
  vegan:     ["vegan"],
  paraben:   ["paraben"],
  sulfate:   ["sulfat", "sulfate", "sls"],
  fragrance: ["parfum", "fragrance", "koku"],
  alcohol:   ["alkol", "alcohol"],
  silicone:  ["silikon", "silicone"],
};

/** Bir token'ın "ürün BU maddeyi İÇERİR" anlamına geldiğini söyleyen iz. */
const NEGATION_MARKERS = [
  "iceriyor",   // "paraben_iceriyor"
  "contains",   // "contains_paraben"
  "icerir",
  "degil",      // "vegan_degil"
  "not_",       // "not_vegan"
];

/** Sadece pozitif (X içermez) anlamına gelen iz. */
const FREE_MARKERS = [
  "_free", "free", "siz", "yok", "icermez", "unscented", "no_",
];

const BOOLEAN_FIELDS: Record<string, string | undefined> = {
  paraben:   "contains_paraben",
  fragrance: "contains_fragrance",
  alcohol:   "contains_alcohol",
};

/**
 * Agresif normalizasyon (spec STEP 1):
 *   • Türkçe karakter → ASCII
 *   • Boşluk ve tire → alt çizgi
 *   • lowercase + trim
 */
function normalizeBadgeTokens(product: any): string[] {
  const tokens: any[] = [
    ...(Array.isArray(product?.features) ? product.features : []),
    ...(Array.isArray(product?.badges)   ? product.badges   : []),
  ];
  return tokens
    .filter(Boolean)
    .map((x) =>
      String(x)
        .toLowerCase()
        .trim()
        .replace(/ı/g, "i")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ş/g, "s")
        .replace(/ç/g, "c")
        .replace(/ğ/g, "g")
        .replace(/-/g, "_")
        .replace(/\s+/g, "_"),
    );
}

const isNegationToken = (t: string): boolean =>
  NEGATION_MARKERS.some((m) => t.includes(m));

const isFreeToken = (t: string): boolean =>
  FREE_MARKERS.some((m) => t.includes(m));

// ─── resolveFeature — TEK GERÇEK KAYNAK (additive, performans nötr) ─────────
//
// Sadece 4 polarite anahtarı için: alcohol, silicone, paraben, fragrance.
// Öncelik:
//   1) features object map  →  product.features[key] (true/false)
//   2) LIGHT ingredients scan (substring, hazır lowercase tek geçiş)
//   3) null  →  bilinmiyor
//
// Geri dönüş: true = içeriyor, false = içermez, null = sinyal yok.
// Sözleşme: bu fonksiyon yalnızca extractBadgeStatus tarafından çağrılır.
// LIGHT_SCAN — regex tabanlı (yanlış-pozitif riski olan anahtarlar için
// kelime sınırı kontrolü). alcohol özelinde sadece KURUTUCU formlar
// işaretlenir; setearil/setil/stearil/behenil/benzil alkoller (yağlı
// asit türevleri / parfüm-allerjen) ELENİR.
const _LIGHT_SCAN: Record<string, RegExp[]> = {
  alcohol: [
    /alcohol denat/,         // denatured forms
    /denatured alcohol/,
    /sd alcohol/,            // SD Alcohol 40-B vb.
    /isopropyl alcohol/,
    /\bethanol\b/,           // \b → phenoxyethanol/methanol false-positive engellenir
  ],
  silicone:  [/dimethicone/, /siloxane/],
  paraben:   [/paraben/],
  fragrance: [/parfum/, /fragrance/],
};
function resolveFeature(product: any, key: string): boolean | null {
  if (!product) return null;

  // 1) features object map (jsonb { alcohol: false, paraben: true } şekli)
  const f = product.features;
  if (f && typeof f === "object" && !Array.isArray(f)) {
    const v = f[key];
    if (v === true  || v === "true"  || v === 1) {
      if (__DEV__) console.log("[resolveFeature]", product?.name, key, true);
      return true;
    }
    if (v === false || v === "false" || v === 0) {
      if (__DEV__) console.log("[resolveFeature]", product?.name, key, false);
      return false;
    }
  }

  // 2) LIGHT ingredients scan — tek lowercase geçiş, regex test
  const rxs = _LIGHT_SCAN[key];
  if (rxs) {
    const raw = product.ingredients;
    const text = Array.isArray(raw)
      ? raw.join(",")
      : (typeof raw === "string" ? raw : "");
    if (text) {
      const lower = text.toLowerCase();
      const hit = rxs.some((rx) => rx.test(lower));
      if (__DEV__) console.log("[resolveFeature]", product?.name, key, hit);
      return hit;
    }
  }

  if (__DEV__) console.log("[resolveFeature]", product?.name, key, null);
  return null;
}

export function extractBadgeStatus(product: any, key: string): BadgeStatus | null {
  if (!product) return "unknown" as BadgeStatus;

  // 0) FEATURE TRUTH LAYER — final source of truth (additive injection).
  //    6 anahtar tam kapsam: alcohol/silicone/paraben/fragrance/sulfate/vegan.
  //    null ise token havuzuna düş (eski davranışı koru).
  if (
    key === "alcohol" || key === "silicone" || key === "paraben" ||
    key === "fragrance" || key === "sulfate" || key === "vegan"
  ) {
    const truth = truthResolveFeature(product, key as TruthFeatureKey);
    if (truth === true) {
      // alcohol/silicone/etc.: contains → negative; vegan: is-vegan → positive
      return (key === "vegan" ? "positive" : "negative") as BadgeStatus;
    }
    if (truth === false) {
      return (key === "vegan" ? "negative" : "positive") as BadgeStatus;
    }
  }

  // 1) Explicit boolean — token'ları EZER. İki yönlü polarite.
  const boolField = BOOLEAN_FIELDS[key];
  if (boolField && Object.prototype.hasOwnProperty.call(product, boolField)) {
    const v = product[boolField];
    if (v === false) return "positive" as BadgeStatus;
    if (v === true)  return "negative" as BadgeStatus;
  }

  // 2) Token havuzu (features ∪ badges, agresif normalize)
  const tokens = normalizeBadgeTokens(product);
  const subs = KEY_SUBSTRINGS[key] ?? [];
  const containsKeyTerm = (t: string) => subs.some((s) => t.includes(s));

  // 3) Pozitif: anahtar geçen ve "negation" izi TAŞIMAYAN token.
  //    Vegan özel: "vegan" → tek başına pozitiftir; "vegan_degil" negatif.
  const positiveHit = tokens.some(
    (t) => containsKeyTerm(t) && !isNegationToken(t),
  );
  if (positiveHit) {
    // Ama "vegan" gibi nötr-isim token'ları için ek doğrulama:
    // X-free dışı (silikon/sulfat/parfum/alkol/paraben isimleri) tek
    // başına geçerse → pozitif olarak değerlendirilir mi?
    // EVET — gerçek veride features[] alanı pozitif claim taşır
    // (datasette "paraben" tek başına ASLA "içerir" anlamında basılmaz;
    //  bu durumda contains_paraben === true olur). Spec STEP 2 birebir.
    return "positive" as BadgeStatus;
  }

  // 4) Negatif: anahtar geçen + negation izi olan token (TR/EN).
  const negativeHit = tokens.some(
    (t) => containsKeyTerm(t) && isNegationToken(t),
  );
  if (negativeHit) return "negative" as BadgeStatus;

  // 5) Sinyal yok → unknown.
  void isFreeToken; // ileride lazım olursa diye export'suz tutuldu.
  return "unknown" as BadgeStatus;
}

// ─── compareBadges ─────────────────────────────────────────────────────────

export function compareBadges(pA: Product, pB: Product): ComparisonBadge[] {
  const KEYS: Array<{
    key: "vegan" | "paraben" | "sulfate" | "fragrance" | "alcohol" | "silicone";
    label: string;
    positiveIsGood: boolean;
  }> = [
    { key: "vegan", label: "Vegan", positiveIsGood: true },
    { key: "paraben", label: "Paraben", positiveIsGood: true },
    { key: "sulfate", label: "Sülfat", positiveIsGood: true },
    { key: "fragrance", label: "Parfüm", positiveIsGood: true },
    { key: "alcohol", label: "Alkol", positiveIsGood: true },
    { key: "silicone", label: "Silikon", positiveIsGood: true },
  ];

  // EH19 · null → "unknown" normalizasyonu. Aksi halde mukayese-detay'daki
  // BadgeSectionOrFallback all-unknown kontrolü (b.a === "unknown" && b.b === "unknown")
  // null değerleri yakalayamıyor, tablo "—" dolu hâlde render ediliyor.
  return KEYS.map(({ key, label, positiveIsGood }) => {
    const a = extractBadgeStatus(pA, key);
    const b = extractBadgeStatus(pB, key);
    return {
      key,
      label,
      a: (a ?? "unknown") as BadgeStatus,
      b: (b ?? "unknown") as BadgeStatus,
      positiveIsGood,
    };
  });
}

// ─── compareIngredients ────────────────────────────────────────────────────

export function compareIngredients(
  pA: Product,
  pB: Product,
): IngredientComparisonResult {
  const rawA = normIngredients(pA);
  const rawB = normIngredients(pB);
  const hasData = rawA.length > 0 || rawB.length > 0;

  const setA = new Set(rawA.map((x) => x.toLowerCase()));
  const setB = new Set(rawB.map((x) => x.toLowerCase()));

  const common = rawA.filter((x) => setB.has(x.toLowerCase()));
  const onlyA = rawA.filter((x) => !setB.has(x.toLowerCase()));
  const onlyB = rawB.filter((x) => !setA.has(x.toLowerCase()));

  function riskCounts(list: string[]) {
    const counts = { high: 0, medium: 0, low: 0, safe: 0 };
    for (const name of list) {
      const info = getIngredientInfo(name);
      if (info.level === "high_risk") counts.high++;
      else if (info.level === "medium_risk") counts.medium++;
      else if (info.level === "low_risk") counts.low++;
      else if (info.level === "safe") counts.safe++;
    }
    return counts;
  }

  return {
    common,
    onlyA,
    onlyB,
    totalA: rawA.length,
    totalB: rawB.length,
    riskA: riskCounts(rawA),
    riskB: riskCounts(rawB),
    hasData,
  };
}

// ─── getSharedFeatures ─────────────────────────────────────────────────────

export function getSharedFeatures(pA: Product, pB: Product): SharedFeature[] {
  const shared: SharedFeature[] = [];

  const catA = normCategory(pA).toLowerCase();
  const catB = normCategory(pB).toLowerCase();
  if (catA && catB && catA === catB)
    shared.push({ icon: "tag", label: `Aynı kategori: ${normCategory(pA)}` });

  const subA = (pA.subcategory ?? "").toLowerCase();
  const subB = (pB.subcategory ?? "").toLowerCase();
  if (subA && subB && subA === subB)
    shared.push({
      icon: "layers",
      label: `Aynı alt kategori: ${pA.subcategory}`,
    });

  const segA = (pA.segment ?? "").toLowerCase();
  const segB = (pB.segment ?? "").toLowerCase();
  if (segA && segB && segA === segB)
    shared.push({ icon: "award", label: `İkisi de ${pA.segment} segmentinde` });

  const skinsA: string[] = Array.isArray(pA.skin_types) ? pA.skin_types : [];
  const skinsB: string[] = Array.isArray(pB.skin_types) ? pB.skin_types : [];
  const commonSkins = arraysOverlap(skinsA, skinsB);
  if (commonSkins.length > 0)
    shared.push({
      icon: "users",
      label: `Ortak cilt uyumu: ${commonSkins.join(", ")}`,
    });

  const benA: string[] = Array.isArray(pA.benefits) ? pA.benefits : [];
  const benB: string[] = Array.isArray(pB.benefits) ? pB.benefits : [];
  const commonBen = arraysOverlap(benA, benB);
  if (commonBen.length > 0)
    shared.push({
      icon: "check-circle",
      label: `Ortak fayda: ${commonBen.slice(0, 3).join(", ")}`,
    });

  const conA: string[] = Array.isArray(pA.concerns) ? pA.concerns : [];
  const conB: string[] = Array.isArray(pB.concerns) ? pB.concerns : [];
  const commonCon = arraysOverlap(conA, conB);
  if (commonCon.length > 0)
    shared.push({
      icon: "target",
      label: `Ortak hedef: ${commonCon.slice(0, 3).join(", ")}`,
    });

  const utA = pA.usage_time;
  const utB = pB.usage_time;
  if (utA && utB && utA === utB) {
    const label =
      utA === "morning"
        ? "Sabah kullanımı"
        : utA === "evening"
          ? "Akşam kullanımı"
          : "Sabah & Akşam kullanımı";
    shared.push({ icon: "shield" });
  }

  // Badge-based shared features (uses boolean fields)
  const badges: Array<{
    key: "paraben" | "fragrance" | "alcohol" | "silicone" | "vegan" | "sulfate";
    label?: string;
  }> = [
    { key: "paraben" },
    { key: "fragrance", label: "parfüm içermiyor" },
    { key: "alcohol", label: "alkol içermiyor" },
    { key: "silicone", label: "silikon içermiyor" },
    { key: "vegan", label: "vegan" },
    { key: "sulfate", label: "sülfat içermiyor" },
  ];
  for (const { key, label } of badges) {
    if (
      extractBadgeStatus(pA, key) === "positive" &&
      extractBadgeStatus(pB, key) === "positive"
    )
      shared.push({ icon: "shield", label: `Her ikisi de ${label}` });
  }

  const pregA = (pA.pregnancy_use ?? pA.pregnancy_safe ?? "")
    .toString()
    .toLowerCase();
  const pregB = (pB.pregnancy_use ?? pB.pregnancy_safe ?? "")
    .toString()
    .toLowerCase();
  const safeA =
    pregA.includes("güvenli") || pregA.includes("guvenli") || pregA === "true";
  const safeB =
    pregB.includes("güvenli") || pregB.includes("guvenli") || pregB === "true";
  if (safeA && safeB)
    shared.push({ icon: "heart", label: "Her ikisi de hamilelerde güvenli" });

  const ings = compareIngredients(pA, pB);
  if (ings.common.length > 0)
    shared.push({
      icon: "layers",
      label: `${ings.common.length} ortak içerik`,
    });

  return shared;
}

// ─── getDifferentFeatures ──────────────────────────────────────────────────

export function getDifferentFeatures(pA: Product, pB: Product): DiffFeature[] {
  const scoreDiffs: DiffFeature[] = [];
  const badgeDiffsList: DiffFeature[] = [];
  const priceDiffs: DiffFeature[] = [];
  const heartDiffs: DiffFeature[] = [];
  const restDiffs: DiffFeature[] = [];

  const nameA = normName(pA);
  const nameB = normName(pB);
  const scoreA = normScore(pA);
  const scoreB = normScore(pB);
  const priceA = normPrice(pA);
  const priceB = normPrice(pB);

  // 1. Skor farkı
  if (scoreA != null && scoreB != null && scoreA !== scoreB) {
    const winner: "A" | "B" = scoreA > scoreB ? "A" : "B";
    const winnerName = winner === "A" ? nameA : nameB;
    const diff = Math.abs(scoreA - scoreB);
    scoreDiffs.push({
      icon: "bar-chart-2",
      label: `${winnerName} dermatolojik olarak öne çıkıyor — ${diff} puan daha yüksek güvenilirliğe sahip.`,
      winner,
    });
  }

  // 2. Fiyat farkı
  if (priceA != null && priceB != null && priceA !== priceB) {
    const winner: "A" | "B" = priceA < priceB ? "A" : "B";
    const winnerName = winner === "A" ? nameA : nameB;
    const diff = Math.abs(priceA - priceB);
    priceDiffs.push({
      icon: "dollar-sign",
      label: `${winnerName} bütçe dostu — yaklaşık ${diff} ₺ daha uygun fiyatlı.`,
      winner,
    });
  }

  // 3. Segment farkı (düşük öncelik — restDiffs)
  const segA = pA.segment ?? "";
  const segB = pB.segment ?? "";
  if (segA && segB && segA.toLowerCase() !== segB.toLowerCase())
    restDiffs.push({
      icon: "award",
      label: `${nameA} ${segA} segmentinde, ${nameB} ${segB} segmentinde yer alıyor.`,
      winner: null,
    });

  // 4. Kategori farkı atlanıyor (görsel değeri düşük)

  // 5. Badge farkları (parfüm / alkol / paraben / silikon / sülfat)
  const badgeList: Array<{
    key: "paraben" | "fragrance" | "alcohol" | "silicone" | "sulfate";
    icon: string;
    cleanLabel: string;
  }> = [
    { key: "paraben",   icon: "check-square", cleanLabel: "paraben"  },
    { key: "silicone",  icon: "disc",         cleanLabel: "silikon"  },
    { key: "fragrance", icon: "wind",         cleanLabel: "parfüm"   },
    { key: "alcohol",   icon: "droplet",      cleanLabel: "alkol"    },
    { key: "sulfate",   icon: "zap",          cleanLabel: "sülfat"   },
  ];
  for (const { key, icon, cleanLabel } of badgeList) {
    const sA = extractBadgeStatus(pA, key);
    const sB = extractBadgeStatus(pB, key);
    if ((sA !== "unknown" || sB !== "unknown") && sA !== sB) {
      const noA = sA === "positive";
      const noB = sB === "positive";
      const better: "A" | "B" | null =
        noA && !noB ? "A" : noB && !noA ? "B" : null;
      const winnerName = better === "A" ? nameA : better === "B" ? nameB : null;
      const label = winnerName
        ? `${winnerName} avantajlı çünkü ${cleanLabel} içermiyor — daha temiz formül sunar.`
        : `${cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1)} içerimi iki ürün arasında farklılık gösteriyor.`;
      badgeDiffsList.push({ icon, label, winner: better });
    }
  }

  // 6. İçerik karmaşıklığı (restDiffs)
  const ings = compareIngredients(pA, pB);
  if (
    ings.totalA > 0 &&
    ings.totalB > 0 &&
    Math.abs(ings.totalA - ings.totalB) > 3
  ) {
    const winner: "A" | "B" = ings.totalA < ings.totalB ? "A" : "B";
    const winnerName = winner === "A" ? nameA : nameB;
    restDiffs.push({
      icon: "list",
      label: `${winnerName} daha sade formüle sahip — az içerik, daha az bilinmeyen.`,
      winner,
    });
  }

  // 7. Cilt tipi farkı (restDiffs)
  const skinsA: string[] = Array.isArray(pA.skin_types) ? pA.skin_types : [];
  const skinsB: string[] = Array.isArray(pB.skin_types) ? pB.skin_types : [];
  const onlyInA = skinsA.filter(
    (s) => !skinsB.some((b) => b.toLowerCase() === s.toLowerCase()),
  );
  const onlyInB = skinsB.filter(
    (s) => !skinsA.some((a) => a.toLowerCase() === s.toLowerCase()),
  );
  if (onlyInA.length > 0 || onlyInB.length > 0) {
    const hasMoreA = onlyInA.length >= onlyInB.length;
    const winnerName = hasMoreA ? nameA : nameB;
    const extra = hasMoreA ? onlyInA.slice(0, 1) : onlyInB.slice(0, 1);
    restDiffs.push({
      icon: "users",
      label: `${winnerName} daha geniş cilt tipine uygun — özellikle ${extra.join(", ")} cilt sahipleri için de uyar.`,
      winner: hasMoreA ? "A" : "B",
    });
  }

  // 8. Hamilelik güvenliliği (heartDiffs)
  const pregA = (pA.pregnancy_use ?? pA.pregnancy_safe ?? "")
    .toString()
    .toLowerCase();
  const pregB = (pB.pregnancy_use ?? pB.pregnancy_safe ?? "")
    .toString()
    .toLowerCase();
  const safeA =
    pregA.includes("güvenli") || pregA.includes("guvenli") || pregA === "true";
  const safeB =
    pregB.includes("güvenli") || pregB.includes("guvenli") || pregB === "true";
  if (safeA !== safeB)
    heartDiffs.push({
      icon: "heart",
      label: `${safeA ? nameA : nameB} hamilelikte güvenle kullanılabilir.`,
      winner: safeA ? "A" : "B",
    });

  // Öncelik sırası: skor → badge (max 2) → fiyat → hamilelik → diğerleri. Toplam max 4.
  const prioritized = [
    ...scoreDiffs,
    ...badgeDiffsList.slice(0, 2),
    ...priceDiffs,
    ...heartDiffs,
    ...restDiffs,
  ];
  return prioritized.slice(0, 4);
}

// ─── compareSkinCompatibility ──────────────────────────────────────────────

export function compareSkinCompatibility(
  pA: Product,
  pB: Product,
): SkinTypeRow[] {
  const SKIN_TYPES = [
    { key: "kuru", label: "Kuru Cilt" },
    { key: "yağlı", label: "Yağlı Cilt" },
    { key: "karma", label: "Karma Cilt" },
    { key: "hassas", label: "Hassas Cilt" },
    { key: "akne", label: "Akne Eğilimli" },
    { key: "rosacea", label: "Rosacea" },
    { key: "egzama", label: "Egzama" },
  ];

  const skinsA = (Array.isArray(pA.skin_types) ? pA.skin_types : []).map((s) =>
    s.toLowerCase(),
  );
  const skinsB = (Array.isArray(pB.skin_types) ? pB.skin_types : []).map((s) =>
    s.toLowerCase(),
  );
  const warnsA = (Array.isArray(pA.warnings) ? pA.warnings : []).map((s) =>
    s.toLowerCase(),
  );
  const warnsB = (Array.isArray(pB.warnings) ? pB.warnings : []).map((s) =>
    s.toLowerCase(),
  );

  // Also derive from skin_type (single) field
  const singleA = (pA.skin_type ?? "").toLowerCase();
  const singleB = (pB.skin_type ?? "").toLowerCase();

  return SKIN_TYPES.map(({ key, label }) => {
    const matchA =
      skinsA.some((s) => s.includes(key)) ||
      singleA.includes(key) ||
      singleA.includes("all");
    const warnA = warnsA.some((w) => w.includes(key));
    const matchB =
      skinsB.some((s) => s.includes(key)) ||
      singleB.includes(key) ||
      singleB.includes("all");
    const warnB = warnsB.some((w) => w.includes(key));

    return {
      type: key,
      label,
      a: warnA ? "caution" : matchA ? "good" : "neutral",
      b: warnB ? "caution" : matchB ? "good" : "neutral",
    };
  });
}

// ─── buildComparisonSummary ────────────────────────────────────────────────

export function buildComparisonSummary(
  pA: Product,
  pB: Product,
): ComparisonSummaryItem[] {
  const items: ComparisonSummaryItem[] = [];
  const nameA = normName(pA);
  const nameB = normName(pB);
  const scoreA = normScore(pA);
  const scoreB = normScore(pB);
  const priceA = normPrice(pA);
  const priceB = normPrice(pB);
  const ings = compareIngredients(pA, pB);

  // 1. Güvenli
  const fragA = extractBadgeStatus(pA, "fragrance");
  const fragB = extractBadgeStatus(pB, "fragrance");
  const alcA = extractBadgeStatus(pA, "alcohol");
  const alcB = extractBadgeStatus(pB, "alcohol");
  const parA = extractBadgeStatus(pA, "paraben");
  const parB = extractBadgeStatus(pB, "paraben");

  if (scoreA != null && scoreB != null) {
    const winner: "A" | "B" | "tie" =
      scoreA === scoreB ? "tie" : scoreA > scoreB ? "A" : "B";
    items.push({
      icon: "shield",
      label: "Daha Güvenli",
      winner,
      detail:
        winner === "tie"
          ? "Eşit puan"
          : `${winner === "A" ? nameA : nameB} (${winner === "A" ? scoreA : scoreB}/100)`,
    });
  } else {
    // Badge-based safety score
    const safeScoreA = [fragA, alcA, parA].filter(
      (s) => s === "positive",
    ).length;
    const safeScoreB = [fragB, alcB, parB].filter(
      (s) => s === "positive",
    ).length;
    const knownA = [fragA, alcA, parA].some((s) => s !== "unknown");
    const knownB = [fragB, alcB, parB].some((s) => s !== "unknown");
    if (knownA || knownB) {
      const winner: "A" | "B" | "tie" =
        safeScoreA === safeScoreB ? "tie" : safeScoreA > safeScoreB ? "A" : "B";
      items.push({
        icon: "shield",
        label: "Daha Güvenli",
        winner,
        detail:
          winner === "tie"
            ? "Benzer profil"
            : `${winner === "A" ? nameA : nameB} öne çıkıyor`,
      });
    }
  }

  // 2. Ekonomik
  if (priceA != null && priceB != null) {
    const winner: "A" | "B" | "tie" =
      priceA === priceB ? "tie" : priceA < priceB ? "A" : "B";
    items.push({
      icon: "dollar-sign",
      label: "Daha Ekonomik",
      winner,
      detail:
        winner === "tie"
          ? "Eşit fiyat"
          : `${winner === "A" ? nameA : nameB} (${Math.min(priceA, priceB).toLocaleString("tr-TR")} ₺)`,
    });
  }

  // 3. Sade İçerik
  if (ings.totalA > 0 && ings.totalB > 0) {
    const winner: "A" | "B" | "tie" =
      ings.totalA === ings.totalB
        ? "tie"
        : ings.totalA < ings.totalB
          ? "A"
          : "B";
    items.push({
      icon: "list",
      label: "Daha Sade İçerik",
      winner,
      detail: `${Math.min(ings.totalA, ings.totalB)} madde`,
    });
  }

  // 4. Parfüm
  if (fragA !== "unknown" || fragB !== "unknown") {
    const winner: "A" | "B" | "tie" | null =
      fragA === "positive" && fragB !== "positive"
        ? "A"
        : fragB === "positive" && fragA !== "positive"
          ? "B"
          : fragA === fragB
            ? "tie"
            : null;
    if (winner !== null) {
      items.push({
        icon: "wind",
        label: "Parfüm Hassasiyeti",
        winner,
        detail:
          winner === "tie"
            ? "İkisi de aynı"
            : `${winner === "A" ? nameA : nameB} parfüm içermiyor`,
      });
    }
  }

  // 5. Hassas cilt
  const skinsA = (Array.isArray(pA.skin_types) ? pA.skin_types : []).map((s) =>
    s.toLowerCase(),
  );
  const skinsB = (Array.isArray(pB.skin_types) ? pB.skin_types : []).map((s) =>
    s.toLowerCase(),
  );
  const hassasA =
    skinsA.some((s) => s.includes("hassas")) ||
    (pA.skin_type ?? "").toLowerCase().includes("hassas") ||
    (pA.skin_type ?? "").toLowerCase() === "sensitive";
  const hassasB =
    skinsB.some((s) => s.includes("hassas")) ||
    (pB.skin_type ?? "").toLowerCase().includes("hassas") ||
    (pB.skin_type ?? "").toLowerCase() === "sensitive";
  if (hassasA || hassasB) {
    const winner: "A" | "B" | "tie" =
      hassasA && hassasB ? "tie" : hassasA ? "A" : "B";
    items.push({
      icon: "heart",
      label: "Hassas Cilt İçin",
      winner,
      detail:
        winner === "tie"
          ? "Her ikisi de uyumlu"
          : `${winner === "A" ? nameA : nameB} daha uygun`,
    });
  }

  return items;
}

// ─── buildVerdict ──────────────────────────────────────────────────────────

export function buildVerdict(
  pA: Product,
  pB: Product,
  bonusA = 0,
  bonusB = 0,
): string[] {
  const verdicts: string[] = [];
  const nameA = normName(pA);
  const nameB = normName(pB);
  const rawA = normScore(pA);
  const rawB = normScore(pB);

  // Ingredient bonus yalnızca yakın yarışlarda devreye girsin.
  // Ana skor farkı ≥ 1.5 ise bonus etkisi sıfırlanır.
  // Yakın yarışlarda ise bonusun %65'i uygulanır.
  const BONUS_EFFECT = 0.65;
  const CLOSE_THRESHOLD = 1.5;
  const rawDiff = rawA != null && rawB != null ? Math.abs(rawA - rawB) : Infinity;
  const applyBonus = rawDiff < CLOSE_THRESHOLD;
  const scoreA = rawA != null ? rawA + (applyBonus ? bonusA * BONUS_EFFECT : 0) : null;
  const scoreB = rawB != null ? rawB + (applyBonus ? bonusB * BONUS_EFFECT : 0) : null;
  const priceA = normPrice(pA);
  const priceB = normPrice(pB);
  const ings = compareIngredients(pA, pB);

  // Score comparison
  if (scoreA != null && scoreB != null) {
    if (scoreA > scoreB + 5)
      verdicts.push(
        `${nameA}, dermatolojik puan açısından belirgin biçimde öne çıkıyor (${scoreA} vs ${scoreB}).`,
      );
    else if (scoreB > scoreA + 5)
      verdicts.push(
        `${nameB}, dermatolojik puan açısından belirgin biçimde öne çıkıyor (${scoreB} vs ${scoreA}).`,
      );
    else verdicts.push("İki ürünün dermatolojik puanı birbirine yakın.");
  }

  // Price
  if (priceA != null && priceB != null) {
    if (priceA < priceB * 0.8)
      verdicts.push(`${nameA} fiyat-performans açısından daha dengeli.`);
    else if (priceB < priceA * 0.8)
      verdicts.push(`${nameB} fiyat-performans açısından daha dengeli.`);
  }

  // Fragrance
  const fragA = extractBadgeStatus(pA, "fragrance");
  const fragB = extractBadgeStatus(pB, "fragrance");
  if (fragA === "negative" && fragB === "positive")
    verdicts.push(
      `Parfüm hassasiyeti olanlar için ${nameB} daha güvenli seçenek.`,
    );
  else if (fragB === "negative" && fragA === "positive")
    verdicts.push(
      `Parfüm hassasiyeti olanlar için ${nameA} daha güvenli seçenek.`,
    );
  else if (fragA === "positive" && fragB === "positive")
    verdicts.push(
      "Her ikisi de parfüm içermiyor — koku hassasiyeti olanlar için güvenli.",
    );
  else if (fragA === "negative" && fragB === "negative")
    verdicts.push(
      "Her iki ürün de parfüm içeriyor; koku hassasiyeti olanlar dikkatli olmalı.",
    );

  // Paraben
  const parA = extractBadgeStatus(pA, "paraben");
  const parB = extractBadgeStatus(pB, "paraben");
  if (parA === "positive" && parB === "negative")
    verdicts.push(
      `${nameA} paraben içermediğinden hormonal hassasiyeti olanlar için daha uygun.`,
    );
  else if (parB === "positive" && parA === "negative")
    verdicts.push(
      `${nameB} paraben içermediğinden hormonal hassasiyeti olanlar için daha uygun.`,
    );

  // Ingredient richness
  if (ings.totalA > 0 && ings.totalB > 0) {
    if (ings.totalA < ings.totalB - 5)
      verdicts.push(
        `${nameA} daha sade içerik listesiyle minimalist cilt rutini arayanlar için avantajlı.`,
      );
    else if (ings.totalB < ings.totalA - 5)
      verdicts.push(
        `${nameB} daha sade içerik listesiyle minimalist cilt rutini arayanlar için avantajlı.`,
      );
  }

  // Risk
  if (ings.riskA.high < ings.riskB.high && ings.riskB.high > 0)
    verdicts.push(
      `İçerik güvenliği açısından ${nameA} daha az riskli madde barındırıyor.`,
    );
  else if (ings.riskB.high < ings.riskA.high && ings.riskA.high > 0)
    verdicts.push(
      `İçerik güvenliği açısından ${nameB} daha az riskli madde barındırıyor.`,
    );

  // Sensitive skin
  const skinsA = (Array.isArray(pA.skin_types) ? pA.skin_types : []).map((s) =>
    s.toLowerCase(),
  );
  const skinsB = (Array.isArray(pB.skin_types) ? pB.skin_types : []).map((s) =>
    s.toLowerCase(),
  );
  const hassasA = skinsA.some((s) => s.includes("hassas"));
  const hassasB = skinsB.some((s) => s.includes("hassas"));
  if (hassasA && !hassasB)
    verdicts.push(`Hassas cilt için ${nameA} daha uygun görünüyor.`);
  else if (hassasB && !hassasA)
    verdicts.push(`Hassas cilt için ${nameB} daha uygun görünüyor.`);

  // Segment
  const segA = (pA.segment ?? "").toLowerCase();
  const segB = (pB.segment ?? "").toLowerCase();
  if (segA && segB && segA !== segB) {
    if (segA === "ekonomik" && segB !== "ekonomik")
      verdicts.push(
        `${nameA} ekonomik segmentte yer aldığından bütçe dostu bir tercih.`,
      );
    else if (segB === "ekonomik" && segA !== "ekonomik")
      verdicts.push(
        `${nameB} ekonomik segmentte yer aldığından bütçe dostu bir tercih.`,
      );
  }

  if (verdicts.length === 0)
    verdicts.push(
      "İki ürün benzer özelliklere sahip. Şahsî cilt ihtiyaçlarına ve bütçeye göre tercih şekillenebilir.",
    );

  return verdicts;
}

// ─── buildIngredientBonus ──────────────────────────────────────────────────

const BONUS_MAX = 1.0;

// matchedAllergies string[] olduğu için Omit listesine ekliyoruz; yalnızca boolean flag'ler kural anahtarı olabilir
type BooleanIngredientKey = keyof Omit<IngredientAnalysis, "reliable" | "matchedAllergies">;
type BonusRule = { key: BooleanIngredientKey; present: boolean; value: number };

const CATEGORY_BONUS_RULES: Record<string, BonusRule[]> = {
  nemlendirici: [
    { key: "hyaluronic_acid", present: true,  value: 0.4 },
    { key: "ceramide",        present: true,  value: 0.5 },
    { key: "fragrance",       present: false, value: 0.3 },
    { key: "alcohol",         present: false, value: 0.3 },
  ],
  "güneş kremi": [
    { key: "fragrance",       present: false, value: 0.4 },
    { key: "alcohol",         present: false, value: 0.4 },
    { key: "hyaluronic_acid", present: true,  value: 0.2 },
  ],
  akne: [
    { key: "salicylic_acid",  present: true,  value: 0.5 },
    { key: "niacinamide",     present: true,  value: 0.4 },
    { key: "fragrance",       present: false, value: 0.2 },
    { key: "alcohol",         present: false, value: 0.2 },
  ],
  leke: [
    { key: "niacinamide",     present: true,  value: 0.5 },
    { key: "fragrance",       present: false, value: 0.2 },
    { key: "alcohol",         present: false, value: 0.2 },
  ],
};

// Alias eşlemeleri: DB'deki kategori adı → kural anahtarı
const CATEGORY_ALIASES: Record<string, string> = {
  "nem": "nemlendirici",
  "nemlendirici": "nemlendirici",
  "moisturizer": "nemlendirici",
  "moisturising": "nemlendirici",
  "güneş": "güneş kremi",
  "spf": "güneş kremi",
  "sunscreen": "güneş kremi",
  "sun care": "güneş kremi",
  "akne": "akne",
  "acne": "akne",
  "sivilce": "akne",
  "leke": "leke",
  "ton eşitleme": "leke",
  "aydınlatma": "leke",
  "brightening": "leke",
};

export function buildIngredientBonus(
  ia: IngredientAnalysis,
  category: string,
): number {
  const key = CATEGORY_ALIASES[category.toLowerCase().trim()] ?? null;
  if (!key) return 0;

  const rules = CATEGORY_BONUS_RULES[key] ?? [];
  let total = 0;
  for (const rule of rules) {
    const matches = rule.present ? ia[rule.key] === true : ia[rule.key] === false;
    if (matches) total += rule.value;
  }
  return Math.min(total, BONUS_MAX);
}

// ─── buildIngredientDiffNotes ──────────────────────────────────────────────

function buildIngredientDiffNotes(
  ia: IngredientAnalysis,
  ib: IngredientAnalysis,
  nameA: string,
  nameB: string,
): string[] {
  const notes: string[] = [];
  const MAX = 3;

  type Key = BooleanIngredientKey;

  // Hangi ürünün avantajlı olduğunu döner.
  // present=true  → içeriği olan kazanır
  // present=false → içeriği olmayan kazanır (negatif madde)
  function winnerOf(key: Key, present: boolean): "A" | "B" | null {
    const hasA = ia[key];
    const hasB = ib[key];
    if (present) {
      if (hasA && !hasB) return "A";
      if (hasB && !hasA) return "B";
    } else {
      if (!hasA && hasB) return "A";
      if (!hasB && hasA) return "B";
    }
    return null;
  }

  function n(w: "A" | "B"): string {
    return w === "A" ? nameA : nameB;
  }

  // ── 1. Aktif içerik farkları (öncelik sırası: leke/akne aktifi → nem/bariyer) ──
  const activeChecks: Array<{ key: Key; note: (w: string) => string }> = [
    {
      key: "niacinamide",
      note: (w) => `${w}, niacinamide içeriğiyle leke ve ton eşitlemede daha etkin.`,
    },
    {
      key: "salicylic_acid",
      note: (w) => `${w}, salisilik asit içeriğiyle yağlı ve akneye eğilimli ciltler için daha uygun.`,
    },
    {
      key: "hyaluronic_acid",
      note: (w) => `${w}, hyaluronik asit desteğiyle nem avantajı sağlar.`,
    },
    {
      key: "ceramide",
      note: (w) => `${w}, seramid desteğiyle bariyer onarımında öne çıkar.`,
    },
  ];

  for (const { key, note } of activeChecks) {
    if (notes.length >= MAX) break;
    const w = winnerOf(key, true);
    if (w) notes.push(note(n(w)));
  }

  // ── 2. Hassasiyet/risk farkı — alkol + parfüm birleştirilir ──
  if (notes.length < MAX) {
    const alcW = winnerOf("alcohol", false);
    const fragW = winnerOf("fragrance", false);

    if (alcW && fragW && alcW === fragW) {
      // Aynı ürün her iki maddeden de arınmış → tek, güçlü cümle
      notes.push(`${n(alcW)}, alkol ve parfüm içermediği için hassas ciltlerde daha güvenli tercih.`);
    } else {
      if (alcW) {
        notes.push(`${n(alcW)}, alkol içermediği için hassas ciltlere daha uygun.`);
      }
      if (fragW && notes.length < MAX) {
        notes.push(`${n(fragW)}, parfüm içermediği için hassasiyet riski daha düşük.`);
      }
    }
  }

  return notes;
}

// ─── buildSafetyNotes ─────────────────────────────────────────────────────

const MAX_NOTES = 3;

/**
 * UserSafetyProductResult + kullanıcının özel koşul listesinden
 * kullanıcıya gösterilebilecek kısa güvenlik notları üretir.
 *
 * Kurallar:
 *  - Profilde ilgili özel durum seçili değilse o notu üretme.
 *  - Güven veren, kısa, kesin hüküm içermeyen dil kullan.
 *  - Maksimum MAX_NOTES (3) not.
 */
function buildSafetyNotes(
  safety: UserSafetyProductResult,
  specialConditions: string[],
): string[] {
  const notes: string[] = [];
  const conds = new Set(specialConditions);

  // 1. Alerji eşleşmesi (özel durum seçimine bakmaksızın — alerji her zaman şahsi)
  if (safety.matchedAllergies.length > 0) {
    notes.push("Seçtiğiniz hassasiyetlerle örtüşen içerikler barındırıyor olabilir.");
  }

  // 2. Hamilelik riski (yalnızca kullanıcı "pregnancy" seçtiyse)
  if (conds.has("pregnancy") && safety.pregnancyRisk) {
    notes.push("Hamilelik döneminde dikkat gerektirebilir.");
  }

  // 3. Emzirme riski (yalnızca kullanıcı "breastfeeding" seçtiyse)
  if (conds.has("breastfeeding") && safety.breastfeedingRisk) {
    notes.push("Emzirme döneminde içerik kontrolü önerilir.");
  }

  // 4. Hassas cilt riski (yalnızca kullanıcı "sensitive_skin" seçtiyse)
  if (conds.has("sensitive_skin") && safety.sensitiveSkinRisk) {
    notes.push("Hassas ciltler için tahriş riski oluşturabilir.");
  }

  return notes.slice(0, MAX_NOTES);
}

// ─── buildUserSafety helper ────────────────────────────────────────────────

/** Bir ürünün ingredient analizinden kullanıcıya özel güvenlik özetini çıkarır. */
function buildUserSafetyProduct(ia: IngredientAnalysis): UserSafetyProductResult {
  return {
    matchedAllergies: ia.matchedAllergies,
    pregnancyRisk: ia.pregnancyRisk,
    breastfeedingRisk: ia.breastfeedingRisk,
    sensitiveSkinRisk: ia.sensitiveSkinRisk,
  };
}

const EMPTY_USER_SAFETY: UserSafetyProductResult = {
  matchedAllergies: [],
  pregnancyRisk: false,
  breastfeedingRisk: false,
  sensitiveSkinRisk: false,
};

// ─── compareProducts (main) ────────────────────────────────────────────────

/**
 * İki ürünü karşılaştırır.
 *
 * @param pA          - Birinci ürün
 * @param pB          - İkinci ürün
 * @param userProfile - Opsiyonel kullanıcı profili.
 *                      Verilmezse userSafety güvenli default değerler taşır.
 */
export function compareProducts(
  pA: Product,
  pB: Product,
  userProfile?: UserSafetyProfile,
): ComparisonResult {
  const nameA = normName(pA);
  const nameB = normName(pB);

  // Kullanıcı alerjilerini analyzeIngredients'a aktar (boşsa [] → matchedAllergies=[])
  const allergies = userProfile?.allergies ?? [];
  const ia = analyzeIngredients((pA as any).ingredients, allergies);
  const ib = analyzeIngredients((pB as any).ingredients, allergies);

  const catA = ((pA as any).category ?? (pA as any).kategori ?? "").toString();
  const catB = ((pB as any).category ?? (pB as any).kategori ?? "").toString();

  // Her iki ürün güvenilirse içerik analizini aktif et, değilse nötr bırak
  const reliable = ia.reliable && ib.reliable;
  const bonusA = reliable ? buildIngredientBonus(ia, catA) : 0;
  const bonusB = reliable ? buildIngredientBonus(ib, catB) : 0;

  // Kullanıcıya özel güvenlik özeti:
  // - reliable=false ise içerik güvenilir değil → EMPTY_USER_SAFETY (false positive riski)
  // - reliable=true  → ia/ib içindeki risk flaglerini ve matchedAllergies'i aktar
  const safetyA = reliable ? buildUserSafetyProduct(ia) : { ...EMPTY_USER_SAFETY };
  const safetyB = reliable ? buildUserSafetyProduct(ib) : { ...EMPTY_USER_SAFETY };
  const userSafety = { a: safetyA, b: safetyB };

  // Güvenlik notları: sadece kullanıcının aktif özel koşullarıyla örtüşen riskler
  const specialConditions = userProfile?.specialConditions ?? [];
  const safetyNotes = {
    a: buildSafetyNotes(safetyA, specialConditions),
    b: buildSafetyNotes(safetyB, specialConditions),
  };

  return {
    shared: getSharedFeatures(pA, pB),
    different: getDifferentFeatures(pA, pB),
    ingredients: compareIngredients(pA, pB),
    badges: compareBadges(pA, pB),
    skinTypes: compareSkinCompatibility(pA, pB),
    summary: buildComparisonSummary(pA, pB),
    verdict: buildVerdict(pA, pB, bonusA, bonusB),
    ingredientAnalysis: { a: ia, b: ib },
    ingredientDiffNotes: reliable ? buildIngredientDiffNotes(ia, ib, nameA, nameB) : [],
    ingredientScoreBonus: { a: bonusA, b: bonusB },
    ingredientAnalysisReliable: reliable,
    userSafety,
    safetyNotes,
  };
}

// ─── getProductSafetyNotes (standalone) ────────────────────────────────────

/**
 * Tek bir ürün için kullanıcıya özel güvenlik notlarını üretir.
 * Compare akışındaki mantığın aynısını kullanır; ürün detay ekranında çağrılır.
 *
 * @param ingredients - Ürün içerik listesi / metni
 * @param userProfile - Kullanıcı profili (allergies + specialConditions)
 * @returns           - Gösterilebilecek güvenlik notu stringleri (max 3, boş olabilir)
 */
export function getProductSafetyNotes(
  ingredients: string | string[] | null | undefined,
  userProfile: UserSafetyProfile,
): string[] {
  const ia = analyzeIngredients(ingredients, userProfile.allergies);
  if (!ia.reliable) return [];
  const safety = buildUserSafetyProduct(ia);
  return buildSafetyNotes(safety, userProfile.specialConditions);
}
