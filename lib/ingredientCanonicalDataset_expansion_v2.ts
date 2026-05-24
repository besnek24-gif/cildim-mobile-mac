/**
 * ingredientCanonicalDataset_expansion_v2.ts
 *
 * EXPANSION LAYER v2 — Additive only. Never modify v1 or base datasets.
 *
 * Covers all corpus unresolved tokens remaining after normalization fixes.
 * Generated from baseline analysis run on 28-product corpus (April 2026).
 *
 * Rules:
 * - No canonical_name duplicates with v1 or base dataset.
 * - Every entry must have ≥ 2 aliases.
 * - Use CosIng / INCI nomenclature for canonical_name.
 *
 * Categories:
 *   emollient | humectant | occlusive | barrier | soothing | active |
 *   antioxidant | surfactant | preservative | emulsifier | thickener |
 *   chelating | fragrance | sunfilter | absorbent | ph_adjuster |
 *   film_former | solvent | antimicrobial
 */

import type { CanonicalIngredientEntry } from "./ingredientCanonicalDataset";

export const CANONICAL_INGREDIENT_EXPANSION_V2: CanonicalIngredientEntry[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // PRESERVATIVES / ANTIMICROBIALS
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "hydroxyacetophenone",
    aliases: [
      "hydroxyacetophenone",
      "4-hydroxyacetophenone",
      "4 hydroxyacetophenone",
      "p-hydroxyacetophenone",
      "para hydroxyacetophenone",
    ],
    category: "preservative",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "chlorhexidine digluconate",
    aliases: [
      "chlorhexidine digluconate",
      "chlorhexidine gluconate",
      "chlorhexidinum digluconate",
      "chlorhexidine di gluconate",
    ],
    category: "antimicrobial",
    risk_level: "medium",
    flags: ["antimicrobial"],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // EMOLLIENTS / ESTERS
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "tridecyl trimellitate",
    aliases: [
      "tridecyl trimellitate",
      "tridecyl trim ellitate",
    ],
    category: "emollient",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "tridecyl neopentanoate",
    aliases: [
      "tridecyl neopentanoate",
      "tridecyl 2 2 dimethylpropanoate",
    ],
    category: "emollient",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "pentaerythrityl distearate",
    aliases: [
      "pentaerythrityl distearate",
      "pentaerythritol distearate",
      "pentaerythrityl di stearate",
    ],
    category: "emollient",
    risk_level: "low",
    flags: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SILICONES
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "simethicone",
    aliases: [
      "simethicone",
      "simeticone",
      "dimeticone simethicone",
      "dimethicone simethicone",
      "polydimethylsiloxane simethicone",
    ],
    category: "emollient",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "caprylyl methicone",
    aliases: [
      "caprylyl methicone",
      "caprylic methicone",
      "caprylyl methiconol",
    ],
    category: "emollient",
    risk_level: "low",
    flags: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // EMULSIFIERS / SURFACTANTS
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "cetearyl glucoside",
    aliases: [
      "cetearyl glucoside",
      "cetostearyl glucoside",
      "ceto stearyl glucoside",
      "cetearyl glucose",
    ],
    category: "emulsifier",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "peg-6 caprylic/capric glycerides",
    aliases: [
      "peg-6 caprylic/capric glycerides",
      "peg 6 caprylic/capric glycerides",
      "peg-6 caprylic capric glycerides",
      "peg6 capryliccapric glycerides",
      "peg-6 capryliccapric glycerides",
    ],
    category: "emulsifier",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "isoceteth-20",
    aliases: [
      "isoceteth-20",
      "isoceteth 20",
      "peg-20 isocetyl ether",
    ],
    category: "emulsifier",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "sodium lauroyl lactylate",
    aliases: [
      "sodium lauroyl lactylate",
      "sodium lauroyllactylate",
      "sodium lauryl lactylate",
    ],
    category: "emulsifier",
    risk_level: "low",
    flags: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // THICKENERS / FILM FORMERS
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "microcrystalline cellulose",
    aliases: [
      "microcrystalline cellulose",
      "micro crystalline cellulose",
      "cellulose microcrystalline",
      "avicel",
    ],
    category: "thickener",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "tamarindus indica seed gum",
    aliases: [
      "tamarindus indica seed gum",
      "tamarind seed gum",
      "tamarindus indica seed polysaccharide",
      "tamarind gum",
    ],
    category: "thickener",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "styrene/acrylates copolymer",
    aliases: [
      "styrene/acrylates copolymer",
      "styrene acrylates copolymer",
      "styreneacrylates copolymer",
      "acrylates/styrene copolymer",
    ],
    category: "film_former",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "ammonium acryloyldimethyltaurate/vp copolymer",
    aliases: [
      "ammonium acryloyldimethyltaurate/vp copolymer",
      "ammonium acryloyldimethyltaurate vp copolymer",
      "vp/dimethylaminoethylmethacrylate copolymer",
      "ammonium acryloyldimethyltaurate",
    ],
    category: "thickener",
    risk_level: "low",
    flags: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVES — SKIN FUNCTIONAL
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "lipo-hydroxy acid",
    aliases: [
      "lipo-hydroxy acid",
      "lha",
      "capryloyl salicylic acid",
      "lipohydroxy acid",
      "lipo hydroxy acid",
    ],
    category: "active",
    risk_level: "medium",
    flags: ["exfoliant", "active"],
  },

  {
    canonical_name: "sucrose octasulfate",
    aliases: [
      "sucrose octasulfate",
      "sucrose octasulphate",
      "sucrose 1 2 3 4 6 2 3 4 6 octakis hydrogen sulfate",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  {
    canonical_name: "zinc pidolate",
    aliases: [
      "zinc pidolate",
      "zinc pyroglutamate",
      "zinc 2 pyrrolidone 5 carboxylate",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  {
    canonical_name: "hydroxypropyl cyclodextrin",
    aliases: [
      "hydroxypropyl cyclodextrin",
      "2-hydroxypropyl-beta-cyclodextrin",
      "hydroxypropyl beta cyclodextrin",
      "hp beta cd",
    ],
    category: "active",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "dimethyl isosorbide",
    aliases: [
      "dimethyl isosorbide",
      "dmi",
      "1 4 3 6 dianhydro 2 5 di o methyl d glucitol",
    ],
    category: "solvent",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "ethoxydiglycol",
    aliases: [
      "ethoxydiglycol",
      "ethoxy diglycol",
      "diethylene glycol monoethyl ether",
      "carbitol",
      "2-ethoxyethanol",
    ],
    category: "solvent",
    risk_level: "low",
    flags: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVES — CENTELLA ASIATICA FAMILY
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "madecassic acid",
    aliases: [
      "madecassic acid",
      "madecassic",
      "6beta-hydroxyasiatic acid",
      "6 beta hydroxyasiatic acid",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active", "barrier_support"],
  },

  {
    canonical_name: "asiatic acid",
    aliases: [
      "asiatic acid",
      "asiaticacid",
      "2alpha 3beta 23 trihydroxyolean 12 en 28 oic acid",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active", "barrier_support"],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVES — BIOFERMENTS / BIOTECHNOLOGY
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "snail secretion filtrate",
    aliases: [
      "snail secretion filtrate",
      "snail slime filtrate",
      "helix aspersa secretion filtrate",
      "escargot secretion filtrate",
      "mucin secretion filtrate",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  {
    canonical_name: "saccharomyces ferment filtrate",
    aliases: [
      "saccharomyces ferment filtrate",
      "saccharomyces cerevisiae filtrate",
      "yeast ferment filtrate",
      "saccharomyces ferment",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVES — BOTANICAL EXTRACTS
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "laminaria saccharina extract",
    aliases: [
      "laminaria saccharina extract",
      "laminaria digitata extract",
      "kelp extract",
      "seaweed extract laminaria",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  {
    canonical_name: "houttuynia cordata extract",
    aliases: [
      "houttuynia cordata extract",
      "heartleaf extract",
      "chameleon plant extract",
      "houttuynia cordata leaf extract",
    ],
    category: "soothing",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "cassia alata leaf extract",
    aliases: [
      "cassia alata leaf extract",
      "cassia alata extract",
      "senna alata leaf extract",
      "ringworm cassia extract",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  {
    canonical_name: "astragalus membranaceus root extract",
    aliases: [
      "astragalus membranaceus root extract",
      "astragalus root extract",
      "huang qi extract",
      "astragalus membranaceus extract",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  {
    canonical_name: "ruscus aculeatus root extract",
    aliases: [
      "ruscus aculeatus root extract",
      "butcher's broom extract",
      "ruscus extract",
      "ruscogenine",
    ],
    category: "active",
    risk_level: "low",
    flags: ["active"],
  },

  {
    canonical_name: "chrysanthellum indicum extract",
    aliases: [
      "chrysanthellum indicum extract",
      "chrysanthellum americanum extract",
      "golden chamomile extract",
    ],
    category: "soothing",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "camellia oleifera leaf extract",
    aliases: [
      "camellia oleifera leaf extract",
      "camellia oleifera extract",
      "green tea oil leaf extract",
      "tea plant leaf extract",
    ],
    category: "antioxidant",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "vitis vinifera grape juice",
    aliases: [
      "vitis vinifera grape juice",
      "vitis vinifera fruit juice",
      "grape juice vitis vinifera",
      "vitis vinifera juice",
    ],
    category: "antioxidant",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "bee venom",
    aliases: [
      "bee venom",
      "apis mellifera venom",
      "apitoxin",
      "bee apitoxin",
    ],
    category: "active",
    risk_level: "medium",
    flags: ["active"],
  },

  {
    canonical_name: "cucumber fruit extract",
    aliases: [
      "cucumber fruit extract",
      "cucumis sativus fruit extract",
      "cucumber extract",
      "cucumis sativus extract",
    ],
    category: "soothing",
    risk_level: "low",
    flags: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // BRAND-SPECIFIC THERMAL / SPRING WATERS
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "vichy volcanic mineralizing water",
    aliases: [
      "vichy volcanic mineralizing water",
      "vichy volcanic water",
      "eau volcanique vichy",
      "vichy thermal water",
      "vichy mineralizing water",
    ],
    category: "soothing",
    risk_level: "low",
    flags: [],
  },

  {
    canonical_name: "uriage thermal water",
    aliases: [
      "uriage thermal water",
      "eau thermale uriage",
      "uriage thermal spring water",
      "uriage eau thermale",
    ],
    category: "soothing",
    risk_level: "low",
    flags: [],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // pH ADJUSTERS / BUFFERS
  // ════════════════════════════════════════════════════════════════════════════

  {
    canonical_name: "sodium acetate",
    aliases: [
      "sodium acetate",
      "sodium ethanoate",
      "natrium acetate",
      "acetic acid sodium salt",
    ],
    category: "ph_adjuster",
    risk_level: "low",
    flags: [],
  },

];
