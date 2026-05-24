export interface IngredientAnalysis {
  reliable: boolean;
  // ── Mevcut bileşen flagleri ─────────────────────────────────────────────
  niacinamide: boolean;
  hyaluronic_acid: boolean;
  salicylic_acid: boolean;
  ceramide: boolean;
  alcohol: boolean;
  fragrance: boolean;
  // ── Özel durum risk flagleri ────────────────────────────────────────────
  pregnancyRisk: boolean;       // Hamilelikte kaçınılması önerilen bileşenler
  breastfeedingRisk: boolean;   // Emzirmede kaçınılması önerilen bileşenler
  sensitiveSkinRisk: boolean;   // Hassas cilt için potansiyel tahriş kaynakları
  // ── Kullanıcı alerjisi eşleşmeleri ─────────────────────────────────────
  matchedAllergies: string[];   // Kullanıcının alerji listesiyle örtüşen AllergyKey'ler
}

// ─── Güvenilirlik kontrolü ─────────────────────────────────────────────────

/**
 * İçerik metninin analiz için yeterince güvenilir olup olmadığını kontrol eder.
 * Çok kısa, tamamen sayısal veya yapısız metinler false döner.
 */
function isReliable(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 15) return false;
  if (!/[a-zA-Z]/.test(t)) return false;           // harf yok
  const hasComma = t.includes(",");
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  return hasComma || wordCount >= 3;                 // virgüllü liste veya ≥3 kelime
}

// ─── Token tabanlı eşleşme ─────────────────────────────────────────────────

/**
 * Ham içerik stringini virgülle ayırır, her token'ı trim + lowercase yapar.
 */
function tokenize(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Bir terimin token listesinde kelime-güvenli şekilde eşleşip eşleşmediğini kontrol eder.
 *
 * Kurallar (sırasıyla):
 *  1. token === term           → tam eşleşme
 *  2. token.startsWith(term + " ") → "ceramide np", "ceramide ap", "ceramide eop" gibi varyantlar
 *  3. token.startsWith(term + "-") → tire ile birleşik varyantlar
 *
 * Kasıtlı olarak .includes() KULLANILMAZ — yanlış pozitif eşleşmeleri önler.
 */
function tokenMatches(tokens: string[], term: string): boolean {
  return tokens.some(
    (t) =>
      t === term ||
      t.startsWith(term + " ") ||
      t.startsWith(term + "-"),
  );
}

// ─── Sinonim tabanlı bileşen kontrolleri ───────────────────────────────────

interface CheckDef {
  key: keyof Pick<
    IngredientAnalysis,
    "niacinamide" | "hyaluronic_acid" | "salicylic_acid" | "ceramide" | "alcohol" | "fragrance"
  >;
  terms: string[];
}

const CHECKS: CheckDef[] = [
  {
    key: "niacinamide",
    terms: ["niacinamide"],
  },
  {
    key: "hyaluronic_acid",
    terms: ["hyaluronic acid", "sodium hyaluronate"],
  },
  {
    key: "salicylic_acid",
    terms: ["salicylic acid", "bha"],
  },
  {
    key: "ceramide",
    // ceramide np / ap / eop / eap / ng / nce vb. varyantlar token bazlı yakalanır
    terms: ["ceramide"],
  },
  {
    key: "alcohol",
    terms: ["alcohol denat", "denatured alcohol"],
  },
  {
    key: "fragrance",
    terms: ["fragrance", "parfum", "perfume"],
  },
];

// ─── Özel durum risk kuralları ─────────────────────────────────────────────

/**
 * Hamilelikte kaçınılması önerilen bileşenler.
 * Kaynak: dermatolog konsensüsü.
 */
const PREGNANCY_RISK_TERMS: string[] = [
  "retinol",
  "retinyl",        // retinyl palmitate, retinyl acetate vb.
  "tretinoin",
  "adapalene",
  "salicylic acid",
];

/**
 * Emzirmede kaçınılması önerilen bileşenler.
 */
const BREASTFEEDING_RISK_TERMS: string[] = [
  "retinol",
  "tretinoin",
  "adapalene",
];

/**
 * Hassas cilt için tahriş potansiyeli yüksek bileşenler.
 */
const SENSITIVE_SKIN_RISK_TERMS: string[] = [
  "fragrance",
  "parfum",
  "alcohol denat",
  "denatured alcohol",
];

// ─── Alerji eşleşme haritası ───────────────────────────────────────────────

/**
 * AllergyKey → ingredient terimleri eşleşme haritası.
 * matchesUserAllergies bu haritayı kullanarak token bazlı eşleşme yapar.
 */
const ALLERGY_INGREDIENT_MAP: Record<string, string[]> = {
  fragrance:  ["fragrance", "parfum", "perfume"],
  alcohol:    ["alcohol denat", "denatured alcohol"],
  paraben:    ["methylparaben", "propylparaben", "butylparaben", "ethylparaben", "isobutylparaben"],
  silicone:   ["dimethicone", "cyclomethicone", "cyclopentasiloxane", "cyclotetrasiloxane", "phenyl trimethicone"],
  sulfate:    ["sodium lauryl sulfate", "sodium laureth sulfate", "ammonium lauryl sulfate", "sls", "sles"],
  nut:        ["sweet almond oil", "prunus amygdalus dulcis", "macadamia", "walnut", "hazelnut", "peanut", "arachis"],
  latex:      ["latex", "natural rubber", "hevea brasiliensis"],
  lanolin:    ["lanolin", "wool wax", "adeps lanae"],
  gluten:     ["wheat", "triticum vulgare", "barley", "hordeum", "oat", "avena"],
  nickel:     ["nickel"],
};

// ─── matchesUserAllergies helper ───────────────────────────────────────────

/**
 * Kullanıcının alerji listesiyle içerik metnini karşılaştırır.
 *
 * @param ingredients - Ürün içerik metni
 * @param allergies   - Kullanıcının AllergyKey listesi (boş array güvenli)
 * @returns           - Eşleşen AllergyKey'lerin listesi
 *
 * @example
 * matchesUserAllergies("Water, Fragrance, Dimethicone", ["fragrance", "silicone"])
 * // → ["fragrance", "silicone"]
 */
export function matchesUserAllergies(
  ingredients: string | string[] | null | undefined,
  allergies: string[],
): string[] {
  if (!allergies.length) return [];
  const raw = Array.isArray(ingredients)
    ? ingredients.join(", ")
    : (ingredients ?? "");
  if (!raw.trim()) return [];

  const tokens = tokenize(raw);
  const matched: string[] = [];

  for (const allergyKey of allergies) {
    const terms = ALLERGY_INGREDIENT_MAP[allergyKey];
    if (!terms) continue; // bilinmeyen alerji key'i → atla
    if (terms.some((term) => tokenMatches(tokens, term))) {
      matched.push(allergyKey);
    }
  }

  return matched;
}

// ─── Güvenli boş sonuç ─────────────────────────────────────────────────────

const EMPTY_ANALYSIS: IngredientAnalysis = {
  reliable: false,
  niacinamide: false,
  hyaluronic_acid: false,
  salicylic_acid: false,
  ceramide: false,
  alcohol: false,
  fragrance: false,
  pregnancyRisk: false,
  breastfeedingRisk: false,
  sensitiveSkinRisk: false,
  matchedAllergies: [],
};

// ─── Ana fonksiyon ─────────────────────────────────────────────────────────

/**
 * Ürün içerik listesini analiz eder.
 *
 * - `reliable: false` dönerse tüm boolean alanlar false, matchedAllergies [] kalır.
 * - Token tabanlı eşleşme kullanır: "macroceramide" gibi yanlış eşleşmeleri engeller.
 * - Sinonim desteği: ceramide varyantları, BHA, parfum/perfume/fragrance vb.
 *
 * @param ingredients - string, string[], null veya undefined olabilir
 * @param allergies   - Kullanıcının alerji listesi (opsiyonel, boş array varsayılan)
 */
export function analyzeIngredients(
  ingredients: string | string[] | null | undefined,
  allergies: string[] = [],
): IngredientAnalysis {
  const raw = Array.isArray(ingredients)
    ? ingredients.join(", ")
    : (ingredients ?? "");

  if (!isReliable(raw)) {
    // İçerik güvenilir değilse matchedAllergies bile dönmüyoruz (false positive riski)
    return { ...EMPTY_ANALYSIS };
  }

  const tokens = tokenize(raw);

  const result: IngredientAnalysis = {
    reliable: true,
    niacinamide: false,
    hyaluronic_acid: false,
    salicylic_acid: false,
    ceramide: false,
    alcohol: false,
    fragrance: false,
    pregnancyRisk: false,
    breastfeedingRisk: false,
    sensitiveSkinRisk: false,
    matchedAllergies: [],
  };

  // Bileşen flagleri
  for (const { key, terms } of CHECKS) {
    result[key] = terms.some((term) => tokenMatches(tokens, term));
  }

  // Risk flagleri
  result.pregnancyRisk     = PREGNANCY_RISK_TERMS.some((t) => tokenMatches(tokens, t));
  result.breastfeedingRisk = BREASTFEEDING_RISK_TERMS.some((t) => tokenMatches(tokens, t));
  result.sensitiveSkinRisk = SENSITIVE_SKIN_RISK_TERMS.some((t) => tokenMatches(tokens, t));

  // Kullanıcı alerjisi eşleşmeleri
  result.matchedAllergies = matchesUserAllergies(raw, allergies);

  return result;
}
