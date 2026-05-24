/**
 * Home Product Ranking System
 *
 * Second-pass ranking layer that builds ON TOP of applyPersonalizedRanking.
 * Does NOT replace safety / allergy / learning signals — extends them.
 *
 * Pipeline:
 *   1. applyPersonalizedRanking  → safety + skin-type + learning (existing)
 *   2. getConcernRelevanceScore  → last completed concern flow
 *   3. getRoutineCompatibilityScore → concern profile flags
 *   4. getWarningSafetyScore     → product.warnings list
 *   5. applyDiversityAdjustment  → avoid subcategory clusters
 *   6. getRankingReasonTag       → human-readable explanation (optional display)
 *
 * Formula (higher = better):
 *   homeScore = positionBonus + concernRelevance + routineCompat + warningSafety
 *
 * This is a trust-oriented ranking — NOT sales or popularity.
 */

import { getConcernProfile } from "./concernFlowStore";
import { applyPersonalizedRanking } from "./safetyRanking";
import type { UserPreferences } from "./userPreferences";
import type { LearningProfile } from "./userEvents";

// ── Types ─────────────────────────────────────────────────────────────────────

type ConcernFlowKey = "akne" | "hassasiyet" | "leke" | "kuruluk" | "gunes" | "sac";

const CONCERN_FLOW_KEYS: ConcernFlowKey[] = ["akne", "hassasiyet", "leke", "kuruluk", "gunes", "sac"];

export interface ProductWithReason {
  product: any;
  reason?: string;
}

// ── Concern → product keyword maps ───────────────────────────────────────────

/**
 * For each concern flow, keywords that indicate a product is especially relevant.
 * Checked against the full product text haystack (name + category + tags + description).
 */
const CONCERN_BOOST_KEYWORDS: Record<ConcernFlowKey, string[]> = {
  akne: [
    "acne", "akne", "sivilce", "blemish", "breakout",
    "salicylic", "salisilik", "niacinamide", "niasina", "bha",
    "zinc", "çinko", "oil-free", "yağsız", "mat", "matte", "gözenek",
  ],
  hassasiyet: [
    "sensitive", "hassas", "duyarlı", "calming", "sakinleştirici",
    "soothing", "barrier", "bariyer", "ceramide", "seramid",
    "gentle", "nazik", "fragrance-free", "parfümsüz", "low-irritant",
  ],
  leke: [
    "brightening", "aydınlatma", "leke", "spot", "pigment",
    "vitamin c", "c vitamini", "niacinamide", "alpha arbutin",
    "kojic", "spf", "güneş koruyucu", "ton eşitsizliği",
  ],
  kuruluk: [
    "hydrating", "nem", "nemi", "nemlendirici", "moisturizing",
    "hyaluronic", "hyaluron", "ceramide", "seramid", "barrier",
    "dry skin", "kuru cilt", "moisture", "hydration", "onarım",
  ],
  gunes: [
    "spf", "spf 30", "spf 50", "güneş", "sunscreen",
    "sun protection", "uv", "uva", "uvb", "solar",
    "güneş koruyucu", "broad spectrum",
  ],
  sac: [
    "hair", "saç", "scalp", "kafa derisi", "dökülme",
    "hair loss", "saç dökülmesi", "biotin", "keratin",
    "saç bakım", "hair care", "shampoo", "şampuan",
  ],
};

/**
 * Keywords that suggest a product is aggressive — deprioritize for sensitivity-heavy flows.
 */
const AGGRESSIVE_KEYWORDS: string[] = [
  "retinol", "tretinoin", "retinoik", "exfoliant", "peeling",
  "aha", "glycolic", "glikolik", "lactic", "laktik",
  "strong acid", "high strength", "30%", "20%",
];

// ── Text haystack builder ─────────────────────────────────────────────────────

function buildHaystack(product: any): string {
  const parts: string[] = [
    product.name ?? "",
    product.isim ?? "",
    product.category ?? "",
    product.kategori ?? "",
    product.subcategory ?? "",
    product.short_benefit ?? "",
    product.description ?? "",
    product.short_description ?? "",
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.concerns_supported) ? product.concerns_supported : []),
    ...(Array.isArray(product.concerns) ? product.concerns : []),
    ...(Array.isArray(product.benefits) ? product.benefits : []),
    ...(Array.isArray(product.skin_types) ? product.skin_types : []),
  ];
  return parts.join(" ").toLowerCase();
}

// ── Signal 1: Concern relevance ───────────────────────────────────────────────

/**
 * How relevant is this product for the user's last completed concern flow?
 * Returns a score in [-1, 3]:
 *   +3  strong keyword match for the primary concern
 *   +1  mild partial match
 *    0  no signal
 *   -1  aggressive product when user's primary concern is hassasiyet
 */
export function getConcernRelevanceScore(product: any, lastConcern: ConcernFlowKey | null): number {
  if (!lastConcern) return 0;

  const haystack = buildHaystack(product);
  const boostKws = CONCERN_BOOST_KEYWORDS[lastConcern];
  const matchCount = boostKws.filter(kw => haystack.includes(kw)).length;

  // Strong match: 2+ keywords
  if (matchCount >= 2) return 3;
  // Mild match: 1 keyword
  if (matchCount === 1) return 1;

  // Penalty: aggressive product for sensitivity-flow users
  if (lastConcern === "hassasiyet" || lastConcern === "kuruluk") {
    const isAggressive = AGGRESSIVE_KEYWORDS.some(kw => haystack.includes(kw));
    if (isAggressive) return -1;
  }

  return 0;
}

// ── Signal 2: Routine compatibility ───────────────────────────────────────────

/**
 * Checks concern profile flags to adjust compatibility.
 * Returns a score in [-1, 2]:
 *   +2  product is ideal for user's specific sub-profile
 *   +1  moderate fit
 *    0  neutral
 *   -1  potentially incompatible with profile flags
 */
export function getRoutineCompatibilityScore(product: any, lastConcern: ConcernFlowKey | null): number {
  if (!lastConcern) return 0;

  const profile = getConcernProfile(lastConcern);
  if (!profile) return 0;

  const haystack = buildHaystack(product);
  let score = 0;

  // Hassasiyet profile: check sensitivity flags
  if (lastConcern === "hassasiyet") {
    // If profile indicates barrier weakness → boost barrier products
    if (profile.barrierWeakness || profile.barrier_weakness || profile.bariyer_zayif) {
      if (haystack.includes("ceramide") || haystack.includes("seramid") || haystack.includes("barrier")) {
        score += 2;
      }
    }
    // If profile indicates high reactivity → gentle products get extra boost
    if (profile.reactivity === "high" || profile.reaktivite === "yüksek") {
      if (haystack.includes("gentle") || haystack.includes("nazik") || haystack.includes("sensitive")) {
        score += 1;
      }
      // Deprioritize actives for highly reactive profiles
      if (AGGRESSIVE_KEYWORDS.some(kw => haystack.includes(kw))) score -= 1;
    }
  }

  // Akne profile: check oiliness / clogging flags
  if (lastConcern === "akne") {
    if (profile.oiliness === "high" || profile.yağlanma === "yüksek") {
      if (haystack.includes("oil-free") || haystack.includes("yağsız") || haystack.includes("matte")) {
        score += 1;
      }
    }
    // Non-comedogenic tag boost
    if (haystack.includes("non-comedogenic") || haystack.includes("gözenek tıkamaz")) {
      score += 1;
    }
  }

  // Kuruluk profile: dehydration severity
  if (lastConcern === "kuruluk") {
    if (profile.severity === "severe" || profile.siddet === "şiddetli") {
      if (haystack.includes("rich") || haystack.includes("intense") || haystack.includes("yoğun")) {
        score += 2;
      }
    }
  }

  return Math.max(-1, Math.min(2, score));
}

// ── Signal 3: Warning safety ──────────────────────────────────────────────────

/**
 * Products that surface warning flags should rank lower in home recommendations.
 * Returns a score in [-2, 0].
 */
export function getWarningSafetyScore(product: any): number {
  const warnings: string[] = Array.isArray(product.warnings) ? product.warnings : [];
  if (warnings.length === 0) return 0;

  // 2+ warnings → meaningful deprioritization
  if (warnings.length >= 2) return -2;
  // 1 warning → mild deprioritization
  return -1;
}

// ── Signal 4: Diversity adjustment ───────────────────────────────────────────

/**
 * Reorders a scored list to avoid consecutive products from the same subcategory.
 *
 * Algorithm:
 *   1. Group products by subcategory.
 *   2. Interleave groups so no two adjacent products share a subcategory.
 *   3. Overflow (extra same-subcategory) appended at end.
 *
 * Products without a subcategory are treated as distinct (no grouping).
 */
export function applyDiversityAdjustment<T extends { id: string }>(
  ranked: T[],
): T[] {
  if (ranked.length <= 3) return ranked;

  const getSubcat = (p: any) => ((p.subcategory ?? p.category ?? p.kategori ?? "") as string).toLowerCase().trim() || `__unique_${p.id}`;

  // Group by subcategory
  const groups = new Map<string, T[]>();
  for (const p of ranked) {
    const key = getSubcat(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // Sort groups by size desc (most represented first — better interleaving)
  const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length);

  // Round-robin interleave
  const result: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const group of sortedGroups) {
      if (group.length > 0) {
        result.push(group.shift()!);
        added = true;
      }
    }
  }

  return result;
}

// ── Signal 5: Reason tag ──────────────────────────────────────────────────────

const REASON_TAGS: Record<ConcernFlowKey, string> = {
  akne:       "Akne eğilimli cilt için daha uygun",
  hassasiyet: "Hassas cilde daha nazik bir seçenek",
  leke:       "Leke ve ton eşitsizliği için öne çıkıyor",
  kuruluk:    "Nem dengesini desteklediği için önerildi",
  gunes:      "Güneş koruması için uygun",
  sac:        "Saç ve kafa derisi için seçildi",
};

/**
 * Returns an optional human-readable reason tag for a ranked product.
 * Ready for future UI display — not shown by default yet.
 */
export function getRankingReasonTag(
  product: any,
  lastConcern: ConcernFlowKey | null,
  concernScore: number,
): string | undefined {
  if (!lastConcern || concernScore <= 0) return undefined;
  return REASON_TAGS[lastConcern];
}

// ── Main ranking function ─────────────────────────────────────────────────────

/**
 * Full home product ranking pipeline.
 *
 * Drop-in replacement for `applyPersonalizedRanking` in home screen sections.
 * Returns Product[] (same shape — reason tags are attached as `_reason` for optional use).
 */
export function rankHomeProducts<T extends { id: string }>(
  products: T[],
  preferences: Pick<UserPreferences, "allergies" | "specialConditions" | "skinType" | "skinConcerns">,
  learningProfile?: LearningProfile,
): T[] {
  if (products.length === 0) return products;

  // Step 1: Base ranking (safety + skin match + learning)
  const baseRanked = applyPersonalizedRanking(products, preferences, learningProfile);

  // Step 2: Detect last completed concern flow (most-recently-completed)
  const lastConcern: ConcernFlowKey | null =
    CONCERN_FLOW_KEYS.find(k => getConcernProfile(k) !== null) ?? null;

  // Step 3: Score each product with additional home-specific signals
  const scored = baseRanked.map((product, index) => {
    // Convert position to bonus (top = higher bonus)
    const positionBonus = Math.max(0, baseRanked.length - index) / baseRanked.length;

    const concernScore   = getConcernRelevanceScore(product, lastConcern);
    const routineScore   = getRoutineCompatibilityScore(product, lastConcern);
    const warningScore   = getWarningSafetyScore(product);

    const homeScore = positionBonus + concernScore + routineScore + warningScore;

    // Attach reason tag for potential future display (non-enumerable won't break JSON)
    const reason = getRankingReasonTag(product, lastConcern, concernScore);
    if (reason) (product as any)._reason = reason;

    return { product, homeScore, index };
  });

  // Step 4: Sort by homeScore descending, break ties by original position
  scored.sort((a, b) =>
    b.homeScore !== a.homeScore ? b.homeScore - a.homeScore : a.index - b.index,
  );

  const reranked = scored.map(({ product }) => product);

  // Step 5: Diversity adjustment (avoid subcategory clusters)
  return applyDiversityAdjustment(reranked);
}

// ── Fallback for new users ────────────────────────────────────────────────────

/**
 * Soft default ranking for users with no concern flow.
 * Prioritizes: beginner-friendly, gentle, broad utility, category diversity.
 * Used automatically by rankHomeProducts when lastConcern === null.
 */
export function rankForNewUser<T extends { id: string }>(products: T[]): T[] {
  const BEGINNER_KEYWORDS = [
    "gentle", "nazik", "sensitive", "hassas", "daily", "günlük",
    "all skin", "tüm cilt", "lightweight", "hafif",
  ];

  const scored = products.map((p, i) => {
    const h = buildHaystack(p);
    const beginnerScore = BEGINNER_KEYWORDS.filter(kw => h.includes(kw)).length;
    const warningPenalty = Array.isArray((p as any).warnings) ? (p as any).warnings.length : 0;
    return { p, score: beginnerScore - warningPenalty, i };
  });

  scored.sort((a, b) => b.score !== a.score ? b.score - a.score : a.i - b.i);
  return applyDiversityAdjustment(scored.map(({ p }) => p));
}
