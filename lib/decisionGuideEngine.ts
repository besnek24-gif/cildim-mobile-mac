/**
 * decisionGuideEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ürün çiftini kalite filtresinden geçirir ve Karar Rehberi oluşturur.
 *
 * Tasarım ilkesi: "Dikkatli bir eczacı-editör gibi davran"
 *  · Güvenli karşılaştırmalar → rehbere yüksel
 *  · Zayıf / tutarsız çiftler → reddedilir, rehber oluşturulmaz
 *  · Kategori sınırları asla geçilmez
 */

import { pairingScore, arePairsCompatible } from "./pairKey";
import { sameRawCategory, logCategoryGuardBlock } from "./sameRawCategory";
import { buildGuide, type DecisionGuide } from "./decisionGuideStore";

// ─── Tipler ─────────────────────────────────────────────────────────────────

export interface GuideProduct {
  id:              string | number;
  name?:           string;
  isim?:           string;
  brand?:          string;
  marka?:          string;
  category?:       string;
  kategori?:       string;
  subcategory?:    string;
  concerns?:       string[] | null;
  skin_concern?:   string | string[] | null;
  concerns_supported?: string[] | null;
  purpose?:        string | string[] | null;
  usage_area?:     string | string[] | null;
  features?: {
    paraben?:   boolean | null;
    sulfate?:   boolean | null;
    fragrance?: boolean | null;
    alcohol?:   boolean | null;
    silicone?:  boolean | null;
    vegan?:     boolean | null;
  };
  segment?:        string | null;
  price?:          number | null;
  average_price?:  number | null;
  scores?: { system_total_score?: number | null };
  skin_types?: string[] | null;
  benefits?: string[] | null;
  texture?:        string | null;
  finish?:         string | null;
}

export interface GuideValidationResult {
  valid:          boolean;
  reason?:        string;
  qualityScore:   number;
  guide?:         DecisionGuide;
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function getName(p: GuideProduct): string {
  return (p.name ?? p.isim ?? "").trim();
}
function getBrand(p: GuideProduct): string {
  return (p.brand ?? p.marka ?? "").trim();
}
function getCategory(p: GuideProduct): string {
  return norm(p.category ?? p.kategori);
}
function getSubcategory(p: GuideProduct): string {
  return norm(p.subcategory);
}

function getConcerns(p: GuideProduct): string[] {
  const fields = [p.concerns, p.concerns_supported, p.skin_concern, p.purpose, p.usage_area];
  const out = new Set<string>();
  for (const f of fields) {
    if (!f) continue;
    const arr = Array.isArray(f) ? f : [f];
    for (const s of arr) {
      const n = s?.trim().toLowerCase();
      if (n) out.add(n);
    }
  }
  return [...out];
}

function metadataRichness(p: GuideProduct): number {
  let score = 0;
  if (getName(p)) score += 2;
  if (getBrand(p)) score += 2;
  if (getCategory(p)) score += 2;
  if (getSubcategory(p)) score++;
  if ((p.features && Object.keys(p.features).length > 0)) score += 3;
  if (getConcerns(p).length > 0) score += 2;
  if ((p.skin_types ?? []).length > 0) score++;
  if ((p.benefits ?? []).length > 0) score++;
  if (p.price != null || p.average_price != null) score++;
  if (p.segment) score++;
  return score;  // max ~16
}

/**
 * İki ürünün ne kadar farklı olduğunu ölçer (0–10).
 * Düşük skor → anlamsız çift (neredeyse aynı ürün).
 */
function differenceRichness(pA: GuideProduct, pB: GuideProduct): number {
  let score = 0;
  const fA = pA.features ?? {};
  const fB = pB.features ?? {};

  const featureKeys = ["paraben", "sulfate", "fragrance", "alcohol", "silicone", "vegan"] as const;
  for (const k of featureKeys) {
    if (fA[k] != null && fB[k] != null && fA[k] !== fB[k]) score += 1;
  }

  // Fiyat farkı
  const priceA = pA.price ?? pA.average_price;
  const priceB = pB.price ?? pB.average_price;
  if (priceA != null && priceB != null) {
    const diff = Math.abs(priceA - priceB) / Math.max(priceA, priceB);
    if (diff > 0.15) score += 1;
  }

  // Segment farkı
  if (pA.segment && pB.segment && norm(pA.segment) !== norm(pB.segment)) score += 2;

  // Farklı marka
  const bA = norm(getBrand(pA));
  const bB = norm(getBrand(pB));
  if (bA && bB && bA !== bB) score += 1;

  // Doku/kıvam
  if (pA.texture && pB.texture && norm(pA.texture) !== norm(pB.texture)) score += 1;

  // Faydalar
  const benA = (pA.benefits ?? []).map(norm);
  const benB = (pB.benefits ?? []).map(norm);
  const onlyInA = benA.filter((b) => !benB.includes(b));
  const onlyInB = benB.filter((b) => !benA.includes(b));
  if (onlyInA.length + onlyInB.length >= 2) score += 1;

  return score;
}

// ─── Güven skoru ────────────────────────────────────────────────────────────

/**
 * Rehberin genel güven skorunu hesapla (0–100).
 * Pairing quality score + meta zenginliği + fark zenginliği
 */
function computeConfidenceScore(
  qualityScore:   number,  // pairingScore (0-~31)
  richA:          number,  // metadataRichness (0-16)
  richB:          number,
  diffScore:      number,  // differenceRichness (0-10)
): number {
  const qNorm    = Math.min(qualityScore / 31, 1) * 40;   // max 40
  const richNorm = Math.min((richA + richB) / 32, 1) * 30; // max 30
  const diffNorm = Math.min(diffScore / 10, 1) * 30;       // max 30
  return Math.round(qNorm + richNorm + diffNorm);
}

// ─── İçerik üretimi ─────────────────────────────────────────────────────────

function buildTitle(pA: GuideProduct, pB: GuideProduct): string {
  const cat = getCategory(pA) || getCategory(pB);
  const sub = getSubcategory(pA) || getSubcategory(pB);
  const label = sub || cat;

  const brandA = getBrand(pA);
  const brandB = getBrand(pB);
  const bSame = norm(brandA) === norm(brandB);

  if (brandA && brandB && !bSame) {
    return `${brandA} mi, ${brandB} mi? ${toTitleCase(label)}`;
  }
  const nameA = getName(pA);
  const nameB = getName(pB);
  if (nameA && nameB) {
    const shortA = nameA.split(" ").slice(0, 3).join(" ");
    const shortB = nameB.split(" ").slice(0, 3).join(" ");
    return `${shortA} vs ${shortB}`;
  }
  return `${toTitleCase(label)} Karar Rehberi`;
}

function toTitleCase(s: string): string {
  return s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function buildSummary(pA: GuideProduct, pB: GuideProduct): string {
  const cat = getCategory(pA) || getCategory(pB);
  const sub = getSubcategory(pA) || getSubcategory(pB);
  const label = sub || cat || "bu kategori";
  const bA = getBrand(pA);
  const bB = getBrand(pB);

  const concernsA = getConcerns(pA);
  const concernsB = getConcerns(pB);
  const shared = concernsA.filter((c) => concernsB.includes(c));
  const concernNote = shared.length > 0
    ? ` özellikle ${shared.slice(0, 2).join(", ")} için`
    : "";

  if (bA && bB && norm(bA) !== norm(bB)) {
    return `${toTitleCase(label)}${concernNote} arayan kullanıcılar için ${bA} ve ${bB} arasındaki temel fark.`;
  }
  return `${toTitleCase(label)} kategorisinde${concernNote} hangi ürünün size daha uygun olduğunu keşfedin.`;
}

function buildDifferencePoints(pA: GuideProduct, pB: GuideProduct): string[] {
  const points: string[] = [];
  const nameA = getName(pA) || "Ürün A";
  const nameB = getName(pB) || "Ürün B";

  const fA = pA.features ?? {};
  const fB = pB.features ?? {};

  // Koku
  if (fA.fragrance === true && fB.fragrance !== true)
    points.push(`${nameA} parfüm/koku içerir; ${nameB} daha yalın bir formüle sahip.`);
  else if (fB.fragrance === true && fA.fragrance !== true)
    points.push(`${nameB} parfüm/koku içerir; ${nameA} hassas ciltler için daha güvenli.`);

  // Alkol
  if (fA.alcohol === true && fB.alcohol !== true)
    points.push(`${nameA} alkol içerir; ${nameB} kuruluk riski taşımaz.`);
  else if (fB.alcohol === true && fA.alcohol !== true)
    points.push(`${nameB} alkol içerir; ${nameA} kuru/hassas cilt için daha uygun.`);

  // Paraben
  if (fA.paraben === true && fB.paraben !== true)
    points.push(`${nameB} paraben içermez; tercihine göre daha doğal bir seçim.`);
  else if (fB.paraben === true && fA.paraben !== true)
    points.push(`${nameA} paraben içermez; tercihine göre daha doğal bir seçim.`);

  // Vegan
  if (fA.vegan === true && fB.vegan !== true)
    points.push(`${nameA} vegan formüllüdür.`);
  else if (fB.vegan === true && fA.vegan !== true)
    points.push(`${nameB} vegan formüllüdür.`);

  // Segment / fiyat segmenti
  const segA = norm(pA.segment);
  const segB = norm(pB.segment);
  if (segA && segB && segA !== segB)
    points.push(`Segment farkı: ${getName(pA)} ${segA}, ${getName(pB)} ${segB} segmentinde.`);

  // Fiyat farkı
  const prA = pA.price ?? pA.average_price;
  const prB = pB.price ?? pB.average_price;
  if (prA != null && prB != null) {
    const diff = Math.abs(prA - prB);
    const pct  = diff / Math.max(prA, prB);
    if (pct > 0.15) {
      const cheaper  = prA < prB ? nameA : nameB;
      const costDiff = Math.round(diff);
      points.push(`Fiyat farkı yaklaşık ₺${costDiff}; ${cheaper} daha bütçe dostu.`);
    }
  }

  // Benzersiz faydalar
  const benA = (pA.benefits ?? []).map(norm);
  const benB = (pB.benefits ?? []).map(norm);
  const onlyA = benA.filter((b) => b && !benB.includes(b));
  const onlyB = benB.filter((b) => b && !benA.includes(b));
  if (onlyA.length > 0)
    points.push(`${nameA} özgün avantajı: ${onlyA.slice(0, 2).join(", ")}.`);
  if (onlyB.length > 0)
    points.push(`${nameB} özgün avantajı: ${onlyB.slice(0, 2).join(", ")}.`);

  // Yeterince nokta yoksa genel bir fark ekle
  if (points.length === 0) {
    points.push(`${nameA} ve ${nameB} aynı kategoride yer alır; detaylı formül incelemesi yapın.`);
  }

  return points.slice(0, 5); // max 5 madde
}

function buildBestFor(p: GuideProduct, other: GuideProduct): string {
  const name = getName(p) || "Bu ürün";
  const fP   = p.features ?? {};
  const fO   = other.features ?? {};

  const traits: string[] = [];

  // Hassas cilt uyumu
  if (fP.fragrance !== true && fO.fragrance === true)
    traits.push("hassas ciltler");
  if (fP.alcohol !== true && fO.alcohol === true)
    traits.push("kuru ve hassas ciltler");
  if (fP.vegan === true)
    traits.push("vegan tercihler");
  if (fP.paraben !== true && fO.paraben === true)
    traits.push("doğal içerik arayanlar");

  // Cilt tipi
  const skinTypes = (p.skin_types ?? []).map(norm);
  if (skinTypes.length > 0)
    traits.push(...skinTypes.slice(0, 2).map((st) => `${st} cilt`));

  // Fayda
  const benefits = (p.benefits ?? []).slice(0, 2);
  if (benefits.length > 0)
    traits.push(...benefits);

  if (traits.length > 0) {
    return `${name} özellikle ${traits.slice(0, 3).join(", ")} için önerilir.`;
  }
  return `${name} bu kategoride genel bir seçim sunar.`;
}

// ─── Kalite filtresi + Rehber üretici ───────────────────────────────────────

/**
 * Ürün çiftini değerlendirir.
 *  · Kalite eşiğini geçemezse → valid: false
 *  · Geçerse → rehber objesi üretilir
 *
 * MIN_QUALITY_SCORE: pairingScore bazlı eşik (10 = subcategory eşleşmesi var demek)
 */
const MIN_QUALITY_SCORE   = 3;   // pairingScore minimum
const MIN_METADATA_SUM    = 6;   // her iki ürün birlikte min meta zenginliği
const MIN_CONFIDENCE      = 20;  // güven skoru minimum

export function validateAndBuildGuide(
  pA: GuideProduct,
  pB: GuideProduct,
): GuideValidationResult {
  // ── 1. Temel zorunlu alanlar ─────────────────────────────────────────────
  if (!getName(pA) || !getName(pB)) {
    return { valid: false, reason: "Ürün adı eksik", qualityScore: 0 };
  }
  if (!getCategory(pA) || !getCategory(pB)) {
    return { valid: false, reason: "Kategori verisi eksik", qualityScore: 0 };
  }

  // ── 2. Kategori uyumluluğu (hard kural) ─────────────────────────────────
  if (!arePairsCompatible(pA as any, pB as any)) {
    return { valid: false, reason: "Kategori uyumsuzluğu", qualityScore: 0 };
  }

  // ── 2b. HARD RAW CATEGORY GUARD ─────────────────────────────────────────
  // pairKey isim-fallback'i farklı kategorideki ürünleri aynı havuza
  // düşürebilir (örn. iki ürünün de adında "krem" geçtiği için ikisi de
  // "nemlendirici" pairKey'i alır). Raw category eşit değilse rehber
  // üretme — Karar Rehberi'nde cross-category çift olamaz.
  if (!sameRawCategory(pA as any, pB as any)) {
    logCategoryGuardBlock("validateAndBuildGuide", pA as any, pB as any);
    return { valid: false, reason: "Raw kategori uyumsuzluğu", qualityScore: 0 };
  }

  // ── 3. Kalite skoru ──────────────────────────────────────────────────────
  const qualityScore = pairingScore(pA as any, pB as any);
  if (qualityScore < MIN_QUALITY_SCORE) {
    return { valid: false, reason: `Kalite skoru çok düşük (${qualityScore})`, qualityScore };
  }

  // ── 4. Meta zenginliği ──────────────────────────────────────────────────
  const richA = metadataRichness(pA);
  const richB = metadataRichness(pB);
  if (richA + richB < MIN_METADATA_SUM) {
    return { valid: false, reason: "Yetersiz ürün meta verisi", qualityScore };
  }

  // ── 5. Fark zenginliği — neredeyse aynı ürünleri reddet ─────────────────
  const diffScore = differenceRichness(pA, pB);
  // Not: fark zenginliği 0 olsa bile reddetme; bazı ürünler iyi meta sağlar

  // ── 6. Güven skoru ──────────────────────────────────────────────────────
  const confidence = computeConfidenceScore(qualityScore, richA, richB, diffScore);
  if (confidence < MIN_CONFIDENCE) {
    return { valid: false, reason: `Güven skoru yetersiz (${confidence})`, qualityScore };
  }

  // ── 7. Rehberi oluştur ───────────────────────────────────────────────────
  const catA   = getCategory(pA);
  const subA   = getSubcategory(pA) || getSubcategory(pB);
  const sharedConcerns = getConcerns(pA).filter((c) => getConcerns(pB).includes(c));
  const pairKey = [String(pA.id), String(pB.id)].sort().join("|");

  const guide = buildGuide({
    pairKey,
    category:            catA,
    subcategory:         subA,
    concern_tags:        sharedConcerns.slice(0, 5),
    product_1_id:        String(pA.id),
    product_2_id:        String(pB.id),
    product_1_name:      getName(pA),
    product_2_name:      getName(pB),
    product_1_brand:     getBrand(pA),
    product_2_brand:     getBrand(pB),
    title:               buildTitle(pA, pB),
    short_summary:       buildSummary(pA, pB),
    difference_points:   buildDifferencePoints(pA, pB),
    best_for_product_1:  buildBestFor(pA, pB),
    best_for_product_2:  buildBestFor(pB, pA),
    confidence_score:    confidence,
    quality_score:       qualityScore,
    is_featured:         qualityScore >= 15 && confidence >= 60,
  });

  return { valid: true, qualityScore, guide };
}

/**
 * Bir ürün çiftinden benzersiz pair anahtarı üretir.
 * Depoda duplicate kontrolü için kullanılır.
 */
export function makePairKey(pA: GuideProduct, pB: GuideProduct): string {
  return [String(pA.id), String(pB.id)].sort().join("|");
}
