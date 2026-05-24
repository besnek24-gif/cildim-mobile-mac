/**
 * unknownAnalyzer.ts — ingredientExpansion
 *
 * Pattern-based categorizer for unknown ingredient tokens.
 * Groups unknowns by chemical family and suggests probable INCI categories.
 *
 * Design: pure functions, no I/O, no side effects.
 */

import type { UnknownEntry } from "./unknownCollector";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SuggestedCategory =
  | "sunfilter"
  | "silicone"
  | "film_former"
  | "thickener"
  | "emulsifier"
  | "humectant"
  | "solvent"
  | "preservative"
  | "fragrance"
  | "emollient"
  | "active"
  | "botanical"
  | "colorant"
  | "ph_adjuster"
  | "chelating"
  | "surfactant"
  | "other";

export type DefaultRiskLevel = "low" | "medium" | "high" | "unknown";

export interface PatternRule {
  pattern:  RegExp;
  category: SuggestedCategory;
  confidence: "high" | "medium" | "low";
  hint:     string;
}

export interface AnalyzedUnknown {
  raw:                string;
  normalized:         string;
  frequency:          number;
  suggested_category: SuggestedCategory;
  default_risk_level: DefaultRiskLevel;
  confidence:         "high" | "medium" | "low";
  matched_pattern:    string | null;
  suggested_flags:    string[];
}

// ── Pattern rule table ────────────────────────────────────────────────────────
// Ordered by specificity — first match wins.

const PATTERN_RULES: PatternRule[] = [
  // UV filters
  { pattern: /triazine|triazone|benzophenone|methoxyphenol|cinnamate|avobenzone|sulisobenzone|octocrylene|ensulizole|mexoryl|tinosorb|uvasorb|uvinul/i, category: "sunfilter", confidence: "high", hint: "UV filter family" },
  { pattern: /\buv\b.*filter|sun.*filter|filter.*uv|filter.*sun/i, category: "sunfilter", confidence: "high", hint: "UV filter descriptor" },

  // Silicones
  { pattern: /siloxane|methicone|dimethicone|silicone|silylate|silsesquioxane|siloxysilicate/i, category: "silicone", confidence: "high", hint: "Silicone family" },

  // Polymers / film formers
  { pattern: /copolymer|crosspolymer|acrylate|polyurethane|polysilicone|pvp|polyvinyl|polysaccharide|polyester|polyethylene|polyisobutene|polylactic|polyquaternium/i, category: "film_former", confidence: "high", hint: "Polymer / film former family" },

  // Thickeners
  { pattern: /cellulose|carrageenan|xanthan|guar.*gum|locust.*bean|methylcellulose|hydroxypropyl.*gum|bentonite|hectorite|laponite|magnesium.*silicate|aluminum.*silicate/i, category: "thickener", confidence: "high", hint: "Thickener / rheology modifier" },
  { pattern: /carbomer|carbopol|acrylates.*taurate|taurate.*copolymer/i, category: "thickener", confidence: "high", hint: "Carbomer / acrylate thickener" },

  // Emulsifiers
  { pattern: /\bpeg[\-\s]\d|ppg[\-\s]\d|polysorbate|sorbitan|glycereth|ceteareth|steareth|beheneth|laureth[\-\s]\d|oleth[\-\s]\d|polyglyceryl/i, category: "emulsifier", confidence: "high", hint: "PEG/ethoxylated emulsifier" },

  // Surfactants
  { pattern: /sulfate|sulfonate|betaine|glucoside|isethionate|sarcosinate|sultaine|amphoacetate|amphodiacetate/i, category: "surfactant", confidence: "high", hint: "Surfactant / cleansing agent" },

  // Preservatives
  { pattern: /paraben|methylisothiazol|chloromethylisothiazol|isothiazolin|hydantoin|imidazolidinyl|diazolidinyl|iodopropynyl|bronopol|sorbate.*salt|phenoxyethanol|caprylhydroxamic|hydroxymethylglycinate/i, category: "preservative", confidence: "high", hint: "Preservative family" },

  // Fragrance / allergens
  { pattern: /\bparfum\b|\bfragrance\b|linalool|limonene|eugenol|coumarin|cinnamal|ionone|geraniol|citronellol|benzyl.*(?:alcohol|benzoate|cinnamate|salicylate)|farnesol|hydroxycitronellal/i, category: "fragrance", confidence: "high", hint: "Fragrance / allergen marker" },

  // Actives — acids
  { pattern: /(?:ascorbyl|ascorbic)|kojic.*acid|arbutin|azelaic|salicyl|glycolic|lactic.*acid|mandelic|tranexamic|phytic.*acid|retinyl|hydroxypinacolone|bakuchiol|niacinamide|adenosine/i, category: "active", confidence: "high", hint: "Active ingredient (acid / vitamin)" },

  // Botanicals / extracts
  { pattern: /extract|officinalis|sinensis|vulgaris|leaf.*juice|root.*oil|seed.*oil|fruit.*extract|bark.*extract|callus.*extract|ferment.*filtrate/i, category: "botanical", confidence: "medium", hint: "Botanical extract" },

  // Humectants / glycols
  { pattern: /(?:butylene|propylene|pentylene|hexylene|ethylene|dipropylene).*glycol|sorbitol|mannitol|erythritol|xylitol|betaine|sodium.*lactate|hyaluronate|polyglutamic/i, category: "humectant", confidence: "high", hint: "Glycol / humectant family" },

  // Emollients — esters / oils
  { pattern: /myristate|palmitate|stearate.*ester|isopropyl|isononyl|isoamyl|dicaprylyl|diisopropyl|cetyl.*ester|isostearyl|octyl.*ester|decyl.*oleate|ethylhexyl.*(?!salicylate|methoxycinnamate)/i, category: "emollient", confidence: "medium", hint: "Ester / emollient" },

  // Colorants
  { pattern: /\bci\s+\d{4,6}\b|iron.*oxide|titanium.*dioxide|ultramarine|manganese.*violet|chromium.*oxide|carbon.*black|bismuth.*oxychloride|mica|lake|pigment/i, category: "colorant", confidence: "high", hint: "CI pigment / colorant" },

  // pH adjusters
  { pattern: /\bhydroxide\b|triethanolamine|\btea\b|arginine|aminomethyl.*propanol|\bamp\b|citric.*acid|tartaric.*acid|malic.*acid|phosphoric.*acid/i, category: "ph_adjuster", confidence: "high", hint: "pH adjuster / buffer" },

  // Chelating agents
  { pattern: /\bedta\b|edetate|glutamate.*diacetate|gluconate.*chelat|phytate|disodium.*edta|tetrasodium.*edta/i, category: "chelating", confidence: "high", hint: "Chelating agent" },

  // Silicone derivatives (broader — lower confidence)
  { pattern: /trimethylsiloxy|siloxysilicate|silsesquioxane/i, category: "silicone", confidence: "medium", hint: "Silicone derivative" },

  // Solvent fallback
  { pattern: /isohexadecane|isododecane|ethanol|denatured.*alcohol|isoparaffin|hexamethylindanopyran/i, category: "solvent", confidence: "medium", hint: "Solvent" },
];

// ── Default risk level per category ───────────────────────────────────────────

const CATEGORY_DEFAULT_RISK: Record<SuggestedCategory, DefaultRiskLevel> = {
  sunfilter:   "medium",
  silicone:    "low",
  film_former: "low",
  thickener:   "low",
  emulsifier:  "low",
  humectant:   "low",
  solvent:     "low",
  preservative:"medium",
  fragrance:   "high",
  emollient:   "low",
  active:      "medium",
  botanical:   "low",
  colorant:    "low",
  ph_adjuster: "low",
  chelating:   "low",
  surfactant:  "medium",
  other:       "unknown",
};

// ── Default flags per category ─────────────────────────────────────────────────

const CATEGORY_DEFAULT_FLAGS: Record<SuggestedCategory, string[]> = {
  sunfilter:   [],
  silicone:    ["silicone"],
  film_former: [],
  thickener:   [],
  emulsifier:  [],
  humectant:   [],
  solvent:     [],
  preservative:["preservative"],
  fragrance:   ["fragrance"],
  emollient:   [],
  active:      ["active"],
  botanical:   [],
  colorant:    [],
  ph_adjuster: [],
  chelating:   [],
  surfactant:  ["surfactant"],
  other:       [],
};

// ── Core analyzer ──────────────────────────────────────────────────────────────

function analyzeOne(entry: UnknownEntry): AnalyzedUnknown {
  const text = entry.normalized;

  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(text) || rule.pattern.test(entry.raw)) {
      const cat = rule.category;
      return {
        raw:                entry.raw,
        normalized:         entry.normalized,
        frequency:          entry.frequency,
        suggested_category: cat,
        default_risk_level: CATEGORY_DEFAULT_RISK[cat],
        confidence:         rule.confidence,
        matched_pattern:    rule.hint,
        suggested_flags:    CATEGORY_DEFAULT_FLAGS[cat],
      };
    }
  }

  return {
    raw:                entry.raw,
    normalized:         entry.normalized,
    frequency:          entry.frequency,
    suggested_category: "other",
    default_risk_level: "unknown",
    confidence:         "low",
    matched_pattern:    null,
    suggested_flags:    [],
  };
}

/**
 * Analyzes a list of unknown entries and returns categorization suggestions.
 * Sorted by frequency (most frequent first).
 */
export function analyzeUnknowns(entries: UnknownEntry[]): AnalyzedUnknown[] {
  return entries
    .map(analyzeOne)
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Groups analyzed unknowns by suggested category.
 */
export function groupByCategory(
  analyzed: AnalyzedUnknown[]
): Record<SuggestedCategory, AnalyzedUnknown[]> {
  const groups = {} as Record<SuggestedCategory, AnalyzedUnknown[]>;
  for (const item of analyzed) {
    if (!groups[item.suggested_category]) {
      groups[item.suggested_category] = [];
    }
    groups[item.suggested_category].push(item);
  }
  return groups;
}
