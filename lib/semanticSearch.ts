/**
 * semanticSearch.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Akıllı, çok katmanlı arama motoru.
 *
 * Katmanlar:
 *  1. Intent detection  — brand / concern / ingredient / category / mixed / generic
 *  2. Concern dictionary — 9 Türkçe cilt kaygısı
 *  3. Ingredient dictionary — 14 aktif içerik
 *  4. Product scoring — kategori + kaygı + içerik + özellik
 *  5. Result grouping — En Uygun / Benzer / İlgili
 *
 * Import:
 *  import { semanticSearch, detectIntent } from "@/lib/semanticSearch";
 */

import type { Product } from "@/types/product";
import { normTR } from "./fuzzySearch";

// ─── Tipler ──────────────────────────────────────────────────────────────────

export type SearchIntentType =
  | "concern"
  | "ingredient"
  | "category"
  | "brand"
  | "mixed"
  | "generic";

export interface SearchIntent {
  type: SearchIntentType;
  concern?: string;
  ingredient?: string;
  category?: string;
  label?: string;
  excludeIngredient?: string;
}

export interface SemanticResult {
  product: Product;
  score: number;
  group: "top" | "similar" | "related";
  matchReasons: string[];
}

export interface SemanticSearchOutput {
  intent: SearchIntent;
  results: SemanticResult[];
  concernSuggestions: string[];
  active: boolean;
}

// ─── Kaygı Sözlüğü ──────────────────────────────────────────────────────────

interface ConcernEntry {
  trTerms: string[];
  productKeywords: string[];
  ingredients: string[];
  categories: string[];
  label: string;
  matchLabel: string;
}

const CONCERN_DICT: Record<string, ConcernEntry> = {
  acne: {
    trTerms: [
      "sivilce", "akne", "sivilceli", "akneli", "siyah nokta",
      "beyaz nokta", "gözenek tıkanıklığı", "yağ dengesi", "comedone",
    ],
    productKeywords: [
      "acne", "sivilce", "akne", "bha", "salisilik", "oil control",
      "mat", "gözenek", "pore", "sebum", "anti-acne", "salicyl",
      "blackhead", "whitehead",
    ],
    ingredients: [
      "salicylic acid", "niacinamide", "zinc", "tea tree",
      "benzoyl peroxide", "bha", "beta hydroxy", "sulfur", "azelaic",
    ],
    categories: ["serum", "temizleyici", "toner", "nemlendirici"],
    label: "Akne / Sivilce",
    matchLabel: "akne karşıtı",
  },
  hyperpigmentation: {
    trTerms: [
      "leke", "iz", "lekeli", "hiperpigmentasyon", "aydınlatıcı",
      "pigmentasyon", "cilt tonu", "koyu leke", "güneş lekesi",
    ],
    productKeywords: [
      "leke", "brightening", "aydınlatıcı", "vitamin c", "c vitamini",
      "arbutin", "kojic", "glow", "radiance", "luminous", "even skin",
      "dark spot", "pigment",
    ],
    ingredients: [
      "vitamin c", "niacinamide", "arbutin", "kojic acid",
      "tranexamic acid", "alpha arbutin", "ascorbic acid",
      "licorice", "melatonin", "azelaic",
    ],
    categories: ["serum", "krem", "nemlendirici"],
    label: "Leke / Aydınlatma",
    matchLabel: "leke karşıtı",
  },
  hydration: {
    trTerms: [
      "kuruluk", "kuru", "kuru cilt", "nemlendirme", "nem",
      "susuzluk", "dehidrasyon", "pul pul", "gerginlik",
    ],
    productKeywords: [
      "nem", "hydra", "moisture", "hydration", "kuruluk", "hyaluronic",
      "ceramide", "nemlendirici", "moisturizing", "dewy", "nourish",
      "rich", "intensive",
    ],
    ingredients: [
      "hyaluronic acid", "ceramide", "glycerin", "squalane",
      "shea butter", "sodium hyaluronate", "panthenol",
      "aloe vera", "urea", "lactic acid",
    ],
    categories: ["nemlendirici", "krem", "serum", "maske", "yağ"],
    label: "Kuruluk / Nem",
    matchLabel: "yoğun nemlendirici",
  },
  sensitivity: {
    trTerms: [
      "kızarıklık", "hassas", "hassas cilt", "kızarma",
      "tahriş", "reaktif", "sakinleştirici", "rosacea",
    ],
    productKeywords: [
      "hassas", "sensitive", "soothing", "sakinleştirici",
      "redness", "calming", "centella", "cica", "gentle",
      "mild", "barrier", "bariyer",
    ],
    ingredients: [
      "centella", "niacinamide", "aloe vera", "bisabolol",
      "allantoin", "panthenol", "madecassoside", "asiaticoside",
      "oat", "chamomile",
    ],
    categories: ["nemlendirici", "serum", "toner", "krem"],
    label: "Kızarıklık / Hassasiyet",
    matchLabel: "hassas ciltlere uygun",
  },
  antiaging: {
    trTerms: [
      "yaşlanma", "kırışık", "anti aging", "antiaging",
      "kolajen", "sıkılaştırıcı", "lifting", "dolgunlaştırıcı",
      "ince çizgi",
    ],
    productKeywords: [
      "anti-aging", "yaşlanma", "kırışık", "retinol", "kolajen",
      "firming", "lifting", "peptide", "collagen", "wrinkle",
      "age", "youth", "plump", "elastin",
    ],
    ingredients: [
      "retinol", "retinoid", "peptide", "vitamin c",
      "coq10", "collagen", "aha", "glycolic acid",
      "niacinamide", "adenosine",
    ],
    categories: ["serum", "krem", "gece kremi", "göz kremi"],
    label: "Yaşlanma Karşıtı",
    matchLabel: "yaşlanma karşıtı",
  },
  oilyskin: {
    trTerms: [
      "yağlı cilt", "yağlı", "parlama", "gözenek",
      "mat yüz", "sebum kontrolü", "karma cilt",
    ],
    productKeywords: [
      "oil control", "mat", "yağlı", "gözenek", "pore",
      "sebum", "oil-free", "matte", "gel", "mattifying",
      "shine control", "pore minimizing",
    ],
    ingredients: [
      "niacinamide", "salicylic acid", "clay", "zinc",
      "witch hazel", "bha",
    ],
    categories: ["nemlendirici", "toner", "serum", "temizleyici"],
    label: "Yağlı Cilt",
    matchLabel: "yağlı ciltlere uygun",
  },
  sunprotection: {
    trTerms: [
      "güneş", "spf", "güneş koruması", "bronzlaşma",
      "uv koruması", "güneş yanığı", "güneş kremi",
    ],
    productKeywords: [
      "spf", "güneş", "koruyucu", "sunscreen", "sunblock",
      "uv", "solar", "sun protection", "spf 50", "spf50",
    ],
    ingredients: [
      "zinc oxide", "titanium dioxide", "octinoxate",
      "avobenzone", "tinosorb",
    ],
    categories: ["güneş koruyucu"],
    label: "Güneş Koruması",
    matchLabel: "güneş korumalı",
  },
  eyecare: {
    trTerms: [
      "göz altı", "göz çevresi", "mor halka",
      "şişlik", "göz altı morluğu", "göz kremi",
    ],
    productKeywords: [
      "göz altı", "eye", "dark circle", "puffiness",
      "göz çevresi", "under eye",
    ],
    ingredients: [
      "caffeine", "retinol", "peptide",
      "vitamin k", "arnica",
    ],
    categories: ["göz kremi"],
    label: "Göz Çevresi",
    matchLabel: "göz çevresi bakımı",
  },
  cleansing: {
    trTerms: [
      "temizleme", "temizleyici", "yüz yıkama",
      "makyaj temizleme", "derin temizlik", "yüz temizleyici",
    ],
    productKeywords: [
      "temizleme", "cleanser", "foaming", "köpük",
      "jel temizleyici", "micellar", "yüz temizleme", "cleansing",
    ],
    ingredients: ["glycerin", "salicylic acid", "aloe vera", "surfactant"],
    categories: ["temizleyici", "micellar su", "jel"],
    label: "Yüz Temizleme",
    matchLabel: "temizleyici",
  },
};

// ─── İçerik Sözlüğü ─────────────────────────────────────────────────────────

interface IngredientEntry {
  displayName: string;
  trTerms: string[];
}

const INGREDIENT_DICT: Record<string, IngredientEntry> = {
  niacinamide: {
    displayName: "Niacinamide",
    trTerms: ["niasinamid", "nicotinamide", "b3 vitamini"],
  },
  retinol: {
    displayName: "Retinol",
    trTerms: ["retinoid", "retin", "a vitamini", "tretinoin"],
  },
  "vitamin c": {
    displayName: "C Vitamini",
    trTerms: ["c vitamini", "vitamin c", "ascorbic", "askorbik", "l-ascorbic"],
  },
  "hyaluronic acid": {
    displayName: "Hyaluronik Asit",
    trTerms: ["hyaluronik", "hyaluronic", "sodium hyaluronate"],
  },
  ceramide: {
    displayName: "Ceramide",
    trTerms: ["seramid", "ceramide"],
  },
  "salicylic acid": {
    displayName: "Salisilik Asit",
    trTerms: ["salisilik", "salicyl", "bha"],
  },
  peptide: {
    displayName: "Peptit",
    trTerms: ["peptit", "peptide", "matrixyl", "argireline"],
  },
  centella: {
    displayName: "Centella",
    trTerms: ["centella", "cica", "gotu kola", "madecassoside", "asiaticoside"],
  },
  arbutin: {
    displayName: "Arbutin",
    trTerms: ["arbutin", "alpha arbutin"],
  },
  "azelaic acid": {
    displayName: "Azelaik Asit",
    trTerms: ["azelaik", "azelaic"],
  },
  aha: {
    displayName: "AHA",
    trTerms: ["aha", "glycolic", "lactic acid", "glikolik", "laktik", "mandelic"],
  },
  "tranexamic acid": {
    displayName: "Traneksamik Asit",
    trTerms: ["traneksamik", "tranexamic"],
  },
  squalane: {
    displayName: "Skualan",
    trTerms: ["squalane", "skualan", "squalan"],
  },
  spf: {
    displayName: "SPF",
    trTerms: ["spf", "güneş faktörü", "sun protection factor"],
  },
};

// ─── Kategori Anahtar Kelimeleri ─────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  serum: ["serum", "ampul", "ampoule", "essans", "concentrate"],
  nemlendirici: ["nemlendirici", "krem", "cream", "moisturizer", "lotion", "losyon", "balsam", "gel krem"],
  "güneş koruyucu": ["güneş", "güneş kremi", "spf", "sunscreen", "sunblock", "sun cream", "solar"],
  temizleyici: ["temizleyici", "cleanser", "jel", "köpük", "foam", "gel", "micellar"],
  toner: ["toner", "tonik", "essence", "esans", "mist"],
  maske: ["maske", "mask", "sheet mask", "kil maskesi"],
  "göz kremi": ["göz kremi", "göz altı", "eye cream", "eye gel"],
  peeling: ["peeling", "eksfolian", "scrub", "peel"],
};

// ─── Hariç Tutma Modifikatörleri ─────────────────────────────────────────────

const EXCLUSION_MODIFIERS: Record<string, string[]> = {
  "fragrance-free": ["parfümsüz", "koku yok", "fragrance free", "koku içermez", "parfüm içermez"],
  "alcohol-free": ["alkol içermez", "alkol yok", "alcohol free"],
  "oil-free": ["yağ içermez", "oil free", "yağsız"],
};

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

function getProductText(p: Product): string {
  const parts = [
    p.name ?? "",
    (p as any).brand ?? "",
    (p as any).category ?? "",
    (p as any).kategori ?? "",
    p.short_benefit ?? "",
    ...(p.features ?? []),
    ...(p.concerns_supported ?? []),
    ...(p.concerns ?? []),
    ...(p.ingredients ?? []),
    ...(p.active_ingredients ?? []),
    (p.skin_type ?? ""),
    ...(p.skin_types ?? []),
  ];
  return normTR(parts.filter(Boolean).join(" "));
}

function getIngredientText(p: Product): string {
  return normTR([
    ...(p.ingredients ?? []),
    ...(p.active_ingredients ?? []),
    p.short_benefit ?? "",
    p.name ?? "",
    ...(p.features ?? []),
  ].filter(Boolean).join(" "));
}

function getProductCategory(p: Product): string {
  return normTR((p as any).category ?? (p as any).kategori ?? "");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Intent Tespiti ──────────────────────────────────────────────────────────

export function detectIntent(query: string): SearchIntent {
  const q = normTR(query.trim());
  if (!q || q.length < 2) return { type: "generic" };

  let excludeIngredient: string | undefined;
  for (const [key, terms] of Object.entries(EXCLUSION_MODIFIERS)) {
    if (terms.some((t) => q.includes(normTR(t)))) {
      excludeIngredient = key;
      break;
    }
  }

  let matchedConcern: string | undefined;
  let bestConcernScore = 0;
  for (const [key, entry] of Object.entries(CONCERN_DICT)) {
    let score = 0;
    for (const term of entry.trTerms) {
      const nt = normTR(term);
      if (q === nt) { score += 100; break; }
      if (q.includes(nt) && nt.length >= 3) score += 60;
      else if (nt.includes(q) && q.length >= 4) score += 40;
    }
    if (score > bestConcernScore) {
      bestConcernScore = score;
      matchedConcern = key;
    }
  }

  let matchedIngredient: string | undefined;
  let bestIngredientScore = 0;
  for (const [key, entry] of Object.entries(INGREDIENT_DICT)) {
    let score = 0;
    const allTerms = [key, ...entry.trTerms];
    for (const term of allTerms) {
      const nt = normTR(term);
      if (q === nt) { score += 100; break; }
      if (q.includes(nt) && nt.length >= 3) score += 70;
      else if (nt.includes(q) && q.length >= 4) score += 50;
    }
    if (score > bestIngredientScore) {
      bestIngredientScore = score;
      matchedIngredient = key;
    }
  }

  let matchedCategory: string | undefined;
  for (const [key, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    if (terms.some((t) => {
      const nt = normTR(t);
      return q.includes(nt) || (nt.includes(q) && q.length >= 4);
    })) {
      matchedCategory = key;
      break;
    }
  }

  const hasConcern = bestConcernScore >= 40;
  const hasIngredient = bestIngredientScore >= 50;
  const hasCategory = !!matchedCategory;

  if (hasConcern && hasCategory) {
    const label = CONCERN_DICT[matchedConcern!]?.label ?? "";
    return { type: "mixed", concern: matchedConcern, category: matchedCategory, label: `${label} — ${capitalize(matchedCategory)}`, excludeIngredient };
  }
  if (hasConcern && hasIngredient) {
    return { type: "mixed", concern: matchedConcern, ingredient: matchedIngredient, label: CONCERN_DICT[matchedConcern!]?.label, excludeIngredient };
  }
  if (hasConcern) {
    return { type: "concern", concern: matchedConcern, label: CONCERN_DICT[matchedConcern!]?.label, excludeIngredient };
  }
  if (hasIngredient) {
    return { type: "ingredient", ingredient: matchedIngredient, label: INGREDIENT_DICT[matchedIngredient!]?.displayName, excludeIngredient };
  }
  if (hasCategory) {
    return { type: "category", category: matchedCategory, label: capitalize(matchedCategory), excludeIngredient };
  }
  if (excludeIngredient) {
    return { type: "ingredient", excludeIngredient, label: "Uygun Ürünler" };
  }
  return { type: "generic" };
}

// ─── Ürün Skorlama ───────────────────────────────────────────────────────────

function scoreByConcern(
  product: Product,
  concernKey: string,
): { score: number; reasons: string[] } {
  const entry = CONCERN_DICT[concernKey];
  if (!entry) return { score: 0, reasons: [] };

  const text = getProductText(product);
  const ingText = getIngredientText(product);
  const cat = getProductCategory(product);
  const reasons: string[] = [];
  let score = 0;

  // Kategori eşleşmesi
  if (entry.categories.some((c) => cat.includes(normTR(c)))) {
    score += 12;
  }

  // Ürün anahtar kelimeler
  let kwHits = 0;
  for (const kw of entry.productKeywords) {
    if (text.includes(normTR(kw))) kwHits++;
  }
  if (kwHits > 0) {
    score += Math.min(32, kwHits * 11);
    reasons.push(capitalize(entry.matchLabel));
  }

  // İçerik eşleşmesi
  let ingHits = 0;
  let firstIngMatch = "";
  for (const ing of entry.ingredients) {
    if (ingText.includes(normTR(ing))) {
      if (!firstIngMatch) firstIngMatch = ing;
      ingHits++;
    }
  }
  if (ingHits > 0) {
    score += Math.min(28, ingHits * 14);
    reasons.push(`${capitalize(firstIngMatch)} içerir`);
  }

  // concerns_supported alanı
  const supported = [...(product.concerns_supported ?? []), ...(product.concerns ?? [])];
  if (supported.some((c) =>
    entry.trTerms.some((t) => normTR(c).includes(normTR(t))) ||
    normTR(c).includes(normTR(entry.label))
  )) {
    score += 18;
    if (reasons.length === 0) reasons.push(capitalize(entry.matchLabel));
  }

  // Cilt tipi uyum bonusu
  if (concernKey === "oilyskin") {
    const st = text;
    if (st.includes("yagli") || st.includes("karma")) {
      score += 8;
      if (!reasons.some((r) => r.includes("yağlı"))) reasons.push("Yağlı ciltlere uygun");
    }
  }
  if (concernKey === "sensitivity") {
    const st = text;
    if (st.includes("hassas") || st.includes("sensitive")) {
      score += 8;
    }
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 2) };
}

function scoreByIngredient(
  product: Product,
  ingredientKey: string,
): { score: number; reasons: string[] } {
  const entry = INGREDIENT_DICT[ingredientKey];
  if (!entry) return { score: 0, reasons: [] };

  const ingText = getIngredientText(product);
  const allText = getProductText(product);
  const allTerms = [ingredientKey, ...entry.trTerms];
  const reasons: string[] = [];
  let score = 0;

  if (allTerms.some((t) => ingText.includes(normTR(t)))) {
    score += 60;
    reasons.push(`${entry.displayName} içerir`);
  }
  if (allTerms.some((t) => allText.includes(normTR(t)))) {
    score += 15;
    if (reasons.length === 0) reasons.push(`${entry.displayName} içerir`);
  }

  return { score, reasons: reasons.slice(0, 1) };
}

function scoreByCategory(
  product: Product,
  categoryKey: string,
): { score: number; reasons: string[] } {
  const cat = getProductCategory(product);
  const name = normTR(product.name ?? "");
  const terms = CATEGORY_KEYWORDS[categoryKey] ?? [];

  if (terms.some((t) => cat.includes(normTR(t)) || name.includes(normTR(t)))) {
    return { score: 40, reasons: [capitalize(categoryKey)] };
  }
  return { score: 0, reasons: [] };
}

function scoreExclusionBonus(product: Product, excludeKey: string): number {
  if (!excludeKey) return 0;
  const text = getProductText(product);
  if (excludeKey === "fragrance-free") {
    if (
      text.includes("parfumsuz") ||
      text.includes("koku icermez") ||
      text.includes("fragrance free") ||
      text.includes("unscented")
    ) {
      return 20;
    }
  }
  return 0;
}

// ─── Ana Semantik Arama ──────────────────────────────────────────────────────

export function semanticSearch(
  query: string,
  products: Product[],
): SemanticSearchOutput {
  const intent = detectIntent(query);
  const shouldActivate =
    intent.type === "concern" ||
    intent.type === "ingredient" ||
    intent.type === "category" ||
    intent.type === "mixed";

  if (!shouldActivate) {
    return { intent, results: [], concernSuggestions: [], active: false };
  }

  const scored: SemanticResult[] = [];

  for (const product of products) {
    let total = 0;
    const allReasons: string[] = [];

    if (intent.concern) {
      const { score, reasons } = scoreByConcern(product, intent.concern);
      total += score;
      allReasons.push(...reasons);
    }

    if (intent.ingredient) {
      const { score, reasons } = scoreByIngredient(product, intent.ingredient);
      total += score;
      allReasons.push(...reasons);
    }

    if (intent.category) {
      const { score, reasons } = scoreByCategory(product, intent.category);
      // Mixed modda kategori eşleşmemesi cezası
      if (intent.type === "mixed" && score === 0) {
        total = Math.max(0, total - 15);
      } else {
        total += score;
        if (reasons.length > 0 && allReasons.length === 0) allReasons.push(...reasons);
      }
    }

    if (intent.excludeIngredient) {
      total += scoreExclusionBonus(product, intent.excludeIngredient);
      if (allReasons.length === 0) allReasons.push("Parfümsüz seçenek");
    }

    if (total >= 5) {
      const group: "top" | "similar" | "related" =
        total >= 45 ? "top" : total >= 20 ? "similar" : "related";

      scored.push({
        product,
        score: total,
        group,
        matchReasons: [...new Set(allReasons)].slice(0, 2),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Vague/empty durumda öneri listesi
  const concernSuggestions: string[] =
    scored.length < 3
      ? ["nemlendirici", "güneş kremi", "sivilce serumu", "serum", "leke karşıtı"]
      : [];

  return { intent, results: scored, concernSuggestions, active: true };
}
