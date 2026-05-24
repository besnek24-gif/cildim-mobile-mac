/**
 * lib/features/featureTruth.ts
 *
 * FEATURE TRUTH LAYER — Final source of truth for all product feature
 * decisions on the product detail screen.
 *
 * Purpose: eliminate the 22 documented inconsistencies (audit 2026-05-04)
 * where the same feature ("alkol içerir mi?", "hamilelikte uygun mu?",
 * "alerji eşleşmesi var mı?") yielded different answers across badges,
 * warnings, hero chips and sticky lists.
 *
 * Design principles:
 *   • Pure functions; no I/O, no React, no Supabase.
 *   • Per-product memoization via WeakMap (cache GC'ed with product object).
 *     → No additional regex passes when the same product is queried by
 *       multiple consumers in the same render cycle.
 *   • Additive: each consumer injects this at the TOP of its existing
 *     resolver. Existing logic remains as fallback for keys this layer
 *     does not yet cover.
 *   • DEV-only console.log via __DEV__ gate; zero runtime cost in prod.
 *
 * Polarity convention for resolveFeature:
 *   For alcohol/fragrance/paraben/silicone/sulfate:
 *     true  = product CONTAINS the feature   (safety: negative)
 *     false = product is FREE of the feature (safety: positive)
 *   For vegan:
 *     true  = product IS vegan                (safety: positive)
 *     false = product is NOT vegan            (safety: negative)
 *   null = bilinmiyor (no signal in any source)
 */

declare const __DEV__: boolean;

// ─── Public types ──────────────────────────────────────────────────────────

export type FeatureKey =
  | "alcohol"
  | "fragrance"
  | "paraben"
  | "silicone"
  | "sulfate"
  | "vegan";

export type FeatureVerdict = boolean | null;

export type PregnancyStatus = "safe" | "caution" | "avoid";

export interface PregnancyVerdict {
  status: PregnancyStatus;
  reason: "db" | "use_field" | "ingredient" | "default";
}

export interface AllergenMatch {
  matched: boolean;
  matchedTokens: string[];        // hangi user girdisi tetikledi
  matchedIngredients: string[];   // hangi INCI parçası eşleşti
}

export interface AllergenProfile {
  allergyIngredients?: string[];  // serbest metin (kullanıcı yazdı)
  avoidedIngredients?: string[];  // serbest metin (kaçınma)
  allergies?: string[];           // preset kategoriler ("fragrance"|"nut"|"latex"|...)
}

// ─── Tek doğruluk regex evreni ─────────────────────────────────────────────
// Tüm UI yüzeyleri bu listeyi paylaşır. Yeni bir form bulunursa SADECE buraya
// eklenir; consumer kodu değişmez.
const KW: Record<FeatureKey, RegExp[]> = {
  alcohol: [
    /alcohol denat/,
    /denatured alcohol/,
    /sd alcohol/,
    /isopropyl alcohol/,
    /\bethanol\b/,         // \b → phenoxyethanol/methanol false-positive engellenir
    /\bethyl alcohol\b/,
  ],
  fragrance: [
    /\bparfum\b/,
    /\bfragrance\b/,
    /\bperfume\b/,
    /\baroma\b/,
  ],
  paraben: [
    /paraben/,             // tüm named parabens (methyl/ethyl/propyl/butyl/...)
  ],
  silicone: [
    /dimethicone/,
    /cyclomethicone/,
    /cyclopentasiloxane/,
    /cyclotetrasiloxane/,
    /cyclohexasiloxane/,
    /trimethicone/,
    /siloxane/,
    /\bsilicone\b/,
  ],
  sulfate: [
    /sodium lauryl sulfate/,
    /sodium laureth sulfate/,
    /ammonium lauryl sulfate/,
    /\bsls\b/,
    /\bsles\b/,
    /\bals\b/,
    /\bsulfate\b/,
    /\bsulphate\b/,
  ],
  vegan: [
    // Hayvansal kökenli işaretleyiciler — hit = NON-vegan (polarite tersine çevrilir)
    /\bbeeswax\b/,
    /cera alba/,
    /\bhoney\b/,
    /\bmel\b/,
    /carmine/,
    /ci 75470/,
    /\blanolin\b/,
    /\bcollagen\b/,
    /\bkeratin\b/,
    /\bsilk\b/,
    /\bserica\b/,
    /\bcasein\b/,
    /\bshellac\b/,
    /\btallow\b/,
    /\blard\b/,
    /\bgelatin\b/,
    /\bsqualene\b/,        // squalane = vegan, squalene = often shark-derived
  ],
};

const _PREG_AVOID_RX: RegExp[] = [
  /\bretinol\b/,
  /retinyl/,
  /\bretinal\b/,
  /tretinoin/,
  /retinoid/,
  /retinoic/,
  /hydroquinone/,
  /benzoyl peroxide/,
  /formaldehyde/,
];

const _PREG_CAUTION_RX: RegExp[] = [
  /salicylic acid/,
  /\bbeta hydroxy\b/,
  /glycolic acid/,
  /lactic acid/,
  /mandelic acid/,
];

const _ALLERGY_PRESET: Record<string, RegExp[]> = {
  fragrance:     KW.fragrance,
  alcohol:       KW.alcohol,
  paraben:       KW.paraben,
  silicone:      KW.silicone,
  sulfate:       KW.sulfate,
  essential_oil: [
    /lavandula/, /melaleuca/, /citrus aurantium/, /eucalyptus/,
    /tea tree/, /rosmarinus/, /mentha piperita/, /peppermint/,
    /lemongrass/, /cymbopogon/,
  ],
  nut: [
    /prunus amygdalus/, /almond oil/, /juglans regia/, /\bwalnut\b/,
    /corylus avellana/, /hazelnut/, /macadamia/, /pistacia/,
  ],
  latex:   [/\blatex\b/, /natural rubber/, /hevea brasiliensis/],
  lanolin: [/lanolin/, /wool wax/, /adeps lanae/],
  gluten: [
    /triticum vulgare/, /\bwheat\b/, /hydrolyzed wheat/,
    /avena sativa/, /\boat\b/, /\bbarley\b/, /\bsecale\b/,
  ],
  nickel: [/nickel sulfate/, /\bnickel\b/],
};

const _STATUS_ORDER: Record<PregnancyStatus, number> = {
  safe: 0,
  caution: 1,
  avoid: 2,
};

// ─── Per-product cache (WeakMap → GC-friendly) ─────────────────────────────
//
// CACHE INVALIDATION (D1 fix): Each cache entry stores the ingredient
// signature (lowercase ingredients text) it was computed from. On read, if
// the current signature differs from the cached one — typically when
// ingredients hydrate after the initial render — the entire per-product
// entry is treated as stale and recomputed. This eliminates the cache
// poisoning vector documented in the D0 audit (mechanism #5), where a
// `null` verdict computed before hydration would persist for the lifetime
// of the product object reference, even after `product.ingredients` was
// later populated.
//
// `_ingredientLowerCache` was REMOVED — it was the primary poisoning
// surface and recomputing `.toLowerCase()` on a few hundred characters per
// resolve is microseconds. The verdict caches below absorb the real cost
// (regex matching across all 6 KW arrays).

interface FeatureCacheEntry {
  sig: string;
  map: Map<FeatureKey, FeatureVerdict>;
}
interface VerdictCacheEntry<T> {
  sig: string;
  value: T;
}

const _featureCache = new WeakMap<object, FeatureCacheEntry>();
const _pregCache    = new WeakMap<object, VerdictCacheEntry<PregnancyVerdict>>();
const _breastCache  = new WeakMap<object, VerdictCacheEntry<PregnancyVerdict>>();

// ─── Internals ─────────────────────────────────────────────────────────────

function _getLowerIngredients(product: unknown): string {
  if (!product || typeof product !== "object") return "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (product as any).ingredients;
  if (typeof raw === "string") return raw.toLowerCase();
  if (Array.isArray(raw)) {
    // Filter non-strings (matches getIngredientsString in normalizeProduct.ts).
    // Prevents `[Object object]` style coercion noise affecting regex matches.
    return (raw as unknown[])
      .filter((s): s is string => typeof s === "string")
      .join(",")
      .toLowerCase();
  }
  return "";
}

// All FeatureKey values — used to build a per-product signature that
// captures every feature-state input resolveFeature reads. Listed inline
// (not derived from a Record) so the signature is stable across runs.
const _SIG_KEYS: FeatureKey[] = [
  "alcohol",
  "fragrance",
  "paraben",
  "silicone",
  "sulfate",
  "vegan",
];

/**
 * Build a per-product cache signature that captures EVERY input
 * resolveFeature consults: ingredient text, `features` jsonb (per known
 * key), and the 6 `contains_<key>` boolean columns.
 *
 * Why all three: the D0 audit closed the ingredient hydration vector, but
 * code review surfaced a remaining stale-cache window — if a product is
 * resolved BEFORE `features` jsonb populates and AGAIN after, the verdict
 * cache (keyed only on ingredients) would return the stale null. Including
 * features+contains in the signature forces re-evaluation when curator
 * data finishes loading, even when the product object reference is stable.
 *
 * Cost: ~24 string concatenations per resolveFeature call (cheap; verdict
 * cache absorbs all subsequent same-render lookups).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _computeSig(product: any, lowerIngredients: string): string {
  let fSig = "_";
  const f = product.features;
  if (f && typeof f === "object" && !Array.isArray(f)) {
    fSig = "";
    for (const k of _SIG_KEYS) {
      fSig += String((f as Record<string, unknown>)[k]) + ",";
    }
  }
  let cSig = "";
  for (const k of _SIG_KEYS) {
    cSig += String(product[`contains_${k}`]) + ",";
  }
  return `${lowerIngredients}|${fSig}|${cSig}`;
}

/**
 * Public helper: explicitly invalidate the cached verdicts/signatures for
 * a product. Useful when the caller knows it has just mutated product data
 * in place (rare; React Query typically replaces the reference). Safe to
 * call defensively — it only deletes WeakMap entries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clearFeatureCache(product: any): void {
  if (!product || typeof product !== "object") return;
  _featureCache.delete(product);
  _pregCache.delete(product);
  _breastCache.delete(product);
}

function _logTruth(product: unknown, key: string, value: unknown): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console, @typescript-eslint/no-explicit-any
    console.log("[truth]", (product as any)?.name, key, value);
  }
}

// ─── resolveFeature — primary API ──────────────────────────────────────────
//
// Karar sırası:
//   1) features jsonb objesi  →  product.features[key]
//   2) Backward-compat        →  product.contains_<key>
//   3) Ingredient regex tarama (tek lowercase geçiş, cache'li)
//   4) null                   →  bilinmiyor

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveFeature(product: any, key: FeatureKey): FeatureVerdict {
  if (!product || typeof product !== "object") return null;

  // Compute the cache signature ONCE per call. This signature captures
  // EVERY input resolveFeature reads (ingredients + features jsonb +
  // contains_<key> columns) so any hydration of any of those sources after
  // the initial render correctly invalidates the cached verdict — not just
  // ingredient hydration. Closes the architect-identified gap from D1.
  const lowerForEscalation = _getLowerIngredients(product);
  const sig = _computeSig(product, lowerForEscalation);

  let entry = _featureCache.get(product);
  if (!entry || entry.sig !== sig) {
    entry = { sig, map: new Map() };
    _featureCache.set(product, entry);
  }
  const cached = entry.map.get(key);
  if (cached !== undefined) return cached;

  const finalize = (v: FeatureVerdict): FeatureVerdict => {
    entry!.map.set(key, v);
    _logTruth(product, key, v);
    return v;
  };

  // ─── INGREDIENT EVIDENCE ESCALATION (audit 2026-05-04 fix #2) ─────────────
  // 369 üründe silikon INCI'de var; 133'ünde küratör verisi
  // features.silicone=false yanlış işaretlemiş (curation contradiction).
  // Aynı durum sulfate/fragrance/paraben/alcohol için de yaşanıyor.
  // Kural: küratör "false" dese bile içerik regex'i NET hit verirse → true.
  // Yalnızca CURATED FALSE'u ESCALATE ediyoruz (true'yu değil → küratör pozitif
  // hâkim). Vegan polarite ters olduğundan bu kuraldan MUAF.
  const ingredientHit =
    key !== "vegan" && lowerForEscalation
      ? KW[key].some((rx) => rx.test(lowerForEscalation))
      : false;

  // 1) features object map (jsonb { alcohol: false, vegan: true } şekli)
  const f = product.features;
  if (f && typeof f === "object" && !Array.isArray(f)) {
    const v = (f as Record<string, unknown>)[key];
    // jsonb true/false direkt feature polaritesini taşır:
    //   { alcohol: true } = içerir, { vegan: true } = vegan
    if (v === true || v === "true" || v === 1) return finalize(true);
    if (v === false || v === "false" || v === 0) {
      // ESCALATION: ingredient evidence wins over curated false (vegan hariç).
      if (ingredientHit) return finalize(true);
      return finalize(false);
    }
  }

  // 2) Backward-compat: contains_<key> boolean (legacy schema)
  const direct = product[`contains_${key}`];
  if (direct === true) {
    return finalize(key === "vegan" ? false : true);
  }
  if (direct === false) {
    // Aynı escalation contains_<key>=false için de geçerli.
    if (ingredientHit) return finalize(true);
    return finalize(key === "vegan" ? true : false);
  }

  // 3) Ingredient regex scan (curated veri yoksa)
  if (lowerForEscalation) {
    // vegan için polarite ters: NON_VEGAN içerikte hit = vegan değil
    if (key === "vegan") {
      const veganHit = KW.vegan.some((rx) => rx.test(lowerForEscalation));
      return finalize(!veganHit);
    }
    return finalize(ingredientHit);
  }

  // 4) Sinyal yok
  return finalize(null);
}

// ─── resolvePregnancyVerdict ───────────────────────────────────────────────
//
// 3 kaynağı birleştirir:
//   • DB sütunu pregnancy_safe ("guvenli"|"dikkatli_kullanim"|"onerilemez"|bool)
//   • DB sütunu pregnancy_use  ("caution"|"avoid"|...)
//   • Ingredient regex tarama (retinoidler, hidroquinon, BHA/AHA vs.)
//
// Güvenlik kuralı: en kötü sonuç kazanır (DB "guvenli" + INCI'de retinol →
// "avoid"). UI bu çıktıya GÜVENİR; bağımsız hesaplama yapmaz.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolvePregnancyVerdict(product: any): PregnancyVerdict {
  if (!product || typeof product !== "object") {
    return { status: "safe", reason: "default" };
  }
  // Same content-keyed signature as resolveFeature — invalidates cache
  // when ingredients OR features OR contains_<key> hydrate after first call.
  const sig = _computeSig(product, _getLowerIngredients(product));
  const cached = _pregCache.get(product);
  if (cached && cached.sig === sig) return cached.value;

  const candidates: { s: PregnancyStatus; r: PregnancyVerdict["reason"] }[] = [];

  // 1) DB column: pregnancy_safe
  const pSafe = product.pregnancy_safe;
  if (pSafe != null) {
    let key: string;
    if (typeof pSafe === "boolean") key = pSafe ? "guvenli" : "onerilemez";
    else key = String(pSafe).toLowerCase();
    if (key === "guvenli" || key === "safe" || key === "true") {
      candidates.push({ s: "safe", r: "db" });
    } else if (key === "onerilemez" || key === "avoid") {
      candidates.push({ s: "avoid", r: "db" });
    } else if (key.indexOf("dikkat") !== -1 || key === "caution") {
      candidates.push({ s: "caution", r: "db" });
    }
  }

  // 2) pregnancy_use field — İngilizce token + Türkçe serbest metin (DB'de
  //    826 ürün "Genellikle uygundur", 57 "Doktora danışılması önerilir",
  //    2 "Önerilmez" gibi Türkçe değerler taşıyor; bunları yakalamak şart.
  const pUse = String(product.pregnancy_use ?? product.hamilelik ?? "")
    .toLowerCase()
    .trim();
  if (pUse) {
    // AVOID — en kötü ihtimal, önce kontrol
    if (
      pUse === "avoid" ||
      pUse.indexOf("önerilmez") !== -1 ||
      pUse.indexOf("onerilmez") !== -1 ||
      pUse.indexOf("uygun değil") !== -1 ||
      pUse.indexOf("uygun degil") !== -1 ||
      pUse.indexOf("kullanılmamalı") !== -1 ||
      pUse.indexOf("kullanilmamali") !== -1
    ) {
      candidates.push({ s: "avoid", r: "use_field" });
    } else if (
      pUse === "caution" ||
      pUse.indexOf("dikkat") !== -1 ||
      pUse.indexOf("doktora danış") !== -1 ||
      pUse.indexOf("doktora danis") !== -1 ||
      pUse.indexOf("hekim onayı") !== -1 ||
      pUse.indexOf("hekim onayi") !== -1 ||
      pUse.indexOf("doktor onayı") !== -1 ||
      pUse.indexOf("doktor onayi") !== -1 ||
      pUse.indexOf("doktor görüşü") !== -1 ||
      pUse.indexOf("doktor gorusu") !== -1
    ) {
      candidates.push({ s: "caution", r: "use_field" });
    }
  }

  // 3) Ingredient scan (escalation source — never downgrades safer DB values)
  const lower = _getLowerIngredients(product);
  if (lower) {
    if (_PREG_AVOID_RX.some((rx) => rx.test(lower))) {
      candidates.push({ s: "avoid", r: "ingredient" });
    } else if (_PREG_CAUTION_RX.some((rx) => rx.test(lower))) {
      candidates.push({ s: "caution", r: "ingredient" });
    }
  }

  let result: PregnancyVerdict;
  if (candidates.length === 0) {
    result = { status: "safe", reason: "default" };
  } else {
    const worst = candidates.reduce((acc, cur) =>
      _STATUS_ORDER[cur.s] > _STATUS_ORDER[acc.s] ? cur : acc,
    );
    result = { status: worst.s, reason: worst.r };
  }

  _pregCache.set(product, { sig, value: result });
  _logTruth(product, "pregnancy", result);
  return result;
}

// ─── resolveBreastfeedingVerdict ───────────────────────────────────────────
//
// 2 kaynağı birleştirir (DB'de breastfeeding_safe sütunu YOK — sadece
// breastfeeding_use Türkçe serbest metin):
//   • DB sütunu breastfeeding_use ("Genellikle uygundur" / "Önerilmez" /
//     "Doktora danışılması önerilir" / "Uygun değildir" / ...)
//   • Ingredient regex tarama (retinoidler, hidroquinon, BHA/AHA vs. —
//     emzirmede de aynı kritik aktifler hassas).
//
// Güvenlik kuralı: en kötü sonuç kazanır. UI bu çıktıya GÜVENİR.
// Audit 2026-05-04 fix #3: Önceden tüm tüketiciler pregnancy verdict'inden
// piggyback'liyordu → DB breastfeeding_use değerleri (982 ürün) UI'ya hiç
// yansımıyordu. Bu fonksiyon o boşluğu kapatır.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveBreastfeedingVerdict(product: any): PregnancyVerdict {
  if (!product || typeof product !== "object") {
    return { status: "safe", reason: "default" };
  }
  // Same content-keyed signature as resolveFeature — invalidates cache
  // when ingredients OR features OR contains_<key> hydrate after first call.
  const sig = _computeSig(product, _getLowerIngredients(product));
  const cached = _breastCache.get(product);
  if (cached && cached.sig === sig) return cached.value;

  const candidates: { s: PregnancyStatus; r: PregnancyVerdict["reason"] }[] = [];

  // 1) breastfeeding_use field — Türkçe serbest metin + İngilizce token
  const bUse = String(product.breastfeeding_use ?? product.emzirme ?? "")
    .toLowerCase()
    .trim();
  if (bUse) {
    if (
      bUse === "avoid" ||
      bUse.indexOf("önerilmez") !== -1 ||
      bUse.indexOf("onerilmez") !== -1 ||
      bUse.indexOf("uygun değil") !== -1 ||
      bUse.indexOf("uygun degil") !== -1 ||
      bUse.indexOf("kullanılmamalı") !== -1 ||
      bUse.indexOf("kullanilmamali") !== -1
    ) {
      candidates.push({ s: "avoid", r: "use_field" });
    } else if (
      bUse === "caution" ||
      bUse.indexOf("dikkat") !== -1 ||
      bUse.indexOf("doktora danış") !== -1 ||
      bUse.indexOf("doktora danis") !== -1 ||
      bUse.indexOf("hekim onayı") !== -1 ||
      bUse.indexOf("hekim onayi") !== -1 ||
      bUse.indexOf("doktor onayı") !== -1 ||
      bUse.indexOf("doktor onayi") !== -1 ||
      bUse.indexOf("doktor görüşü") !== -1 ||
      bUse.indexOf("doktor gorusu") !== -1
    ) {
      candidates.push({ s: "caution", r: "use_field" });
    } else if (
      // Yalnızca "uygundur" sufix'li net Türkçe ifadeleri safe say.
      // (DB'deki tüm safe varyantlar — "Uygundur", "Genellikle uygundur",
      //  "Emzirme döneminde kullanım için uygundur", "...için genellikle
      //  uygundur" — bu substring'i taşır.) Çıplak "uygun" fallback'i
      //  KASTEN kaldırıldı — "doktor uygun görürse" gibi muğlak ifadelerin
      //  yanlışlıkla safe sayılmasını önler. Eşleşme yoksa worst-wins
      //  default = "safe" olduğundan davranış korunur.
      bUse === "safe" ||
      bUse.indexOf("uygundur") !== -1
    ) {
      candidates.push({ s: "safe", r: "use_field" });
    }
  }

  // 2) Ingredient scan (worst-wins escalation — never downgrades use_field)
  const lower = _getLowerIngredients(product);
  if (lower) {
    if (_PREG_AVOID_RX.some((rx) => rx.test(lower))) {
      candidates.push({ s: "avoid", r: "ingredient" });
    } else if (_PREG_CAUTION_RX.some((rx) => rx.test(lower))) {
      candidates.push({ s: "caution", r: "ingredient" });
    }
  }

  let result: PregnancyVerdict;
  if (candidates.length === 0) {
    result = { status: "safe", reason: "default" };
  } else {
    const worst = candidates.reduce((acc, cur) =>
      _STATUS_ORDER[cur.s] > _STATUS_ORDER[acc.s] ? cur : acc,
    );
    result = { status: worst.s, reason: worst.r };
  }

  _breastCache.set(product, { sig, value: result });
  _logTruth(product, "breastfeeding", result);
  return result;
}

// ─── resolveAllergenMatch ──────────────────────────────────────────────────
//
// Üç farklı kullanıcı girdisini birleşik tarama ile karşılar:
//   • allergies         → preset kategoriler (regex listesi)
//   • allergyIngredients → serbest metin (substring)
//   • avoidedIngredients → serbest metin (substring)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveAllergenMatch(
  product: any,
  profile: AllergenProfile,
): AllergenMatch {
  const empty: AllergenMatch = {
    matched: false,
    matchedTokens: [],
    matchedIngredients: [],
  };
  if (!product || typeof product !== "object") return empty;

  const lower = _getLowerIngredients(product);
  if (!lower) return empty;

  const matchedTokens: string[] = [];
  const matchedIngredients: string[] = [];

  // 1) Preset categories
  const presets = profile.allergies ?? [];
  for (const cat of presets) {
    const rxs = _ALLERGY_PRESET[String(cat).toLowerCase()];
    if (!rxs) continue;
    for (const rx of rxs) {
      const m = lower.match(rx);
      if (m) {
        matchedTokens.push(cat);
        matchedIngredients.push(m[0]);
        break;
      }
    }
  }

  // 2) Free-text allergyIngredients & avoidedIngredients
  const freeText = [
    ...(profile.allergyIngredients ?? []),
    ...(profile.avoidedIngredients ?? []),
  ];
  for (const t of freeText) {
    const needle = String(t).toLowerCase().trim();
    if (needle.length < 3) continue;
    if (lower.indexOf(needle) !== -1) {
      matchedTokens.push(t);
      matchedIngredients.push(needle);
    }
  }

  const result: AllergenMatch = {
    matched: matchedTokens.length > 0,
    matchedTokens,
    matchedIngredients,
  };
  if (result.matched) _logTruth(product, "allergen", matchedTokens);
  return result;
}
