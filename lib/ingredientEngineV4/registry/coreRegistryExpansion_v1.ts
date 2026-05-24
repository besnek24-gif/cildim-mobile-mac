/**
 * coreRegistryExpansion_v1.ts — ingredientEngineV4
 *
 * V4 registry expansion layer — v1.
 * Adds entries not present in coreRegistry.ts, prioritized by:
 *   - Unknown tokens surfaced from real 28-product corpus analysis
 *   - Common emollients, waxes, emulsifiers, thickeners in SPF products
 *   - Fatty alcohols/acids, polymer thickeners, UV filter variants
 *   - Botanical extracts common in dermatology/SPF product lines
 *
 * RULES:
 *   - NEVER modify coreRegistry.ts
 *   - All entries here are additive; registry/index.ts merges both layers
 *   - canonical_name must be unique across both layers (enforced at merge)
 *   - Only add entries where classification is clear and safe to assert
 *   - Mark uncertain pregnancy safety as "uncertain" — never guess
 *
 * ZERO imports from legacy/V3 systems.
 */

import type { V4RegistryEntry } from "./types";

export const CORE_REGISTRY_EXPANSION_V1: V4RegistryEntry[] = [

  // ── EMOLLIENTS (skin-feel, texture, film-forming) ─────────────────────────

  {
    canonical_name: "dicaprylyl carbonate",
    aliases: ["dicaprylyl carbonate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Lightweight emollient; non-greasy, good skin feel",
  },
  {
    canonical_name: "diisopropyl adipate",
    aliases: ["diisopropyl adipate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Lightweight emollient, often used in SPF products",
  },
  {
    canonical_name: "dicaprylyl ether",
    aliases: ["dicaprylyl ether", "dicaprylic ether"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "ethylhexyl palmitate",
    aliases: ["ethylhexyl palmitate", "octyl palmitate", "2-ethylhexyl palmitate"],
    category: "emollient", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Common SPF emollient; can be comedogenic at high concentrations",
  },
  {
    canonical_name: "ethylhexyl stearate",
    aliases: ["ethylhexyl stearate", "octyl stearate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "isononyl isononanoate",
    aliases: ["isononyl isononanoate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "isopropyl myristate",
    aliases: ["isopropyl myristate"],
    category: "emollient", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "Penetration enhancer; can be comedogenic",
  },
  {
    canonical_name: "isopropyl palmitate",
    aliases: ["isopropyl palmitate"],
    category: "emollient", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "octyl dodecanol",
    aliases: ["octyldodecanol", "octyl dodecanol", "2-octyldodecanol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "cetyl ethylhexanoate",
    aliases: ["cetyl ethylhexanoate", "cetyl 2-ethylhexanoate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "triethylhexanoin",
    aliases: ["triethylhexanoin", "tri-2-ethylhexanoin"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "c10-18 triglycerides",
    aliases: ["c10 18 triglycerides", "c10-18 triglycerides", "c10/18 triglycerides"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Mixture of medium-chain triglycerides; well-tolerated emollient",
  },
  {
    canonical_name: "caprylic/capric triglyceride",
    aliases: ["caprylic/capric triglyceride", "caprylic capric triglyceride",
              "medium chain triglycerides", "fractionated coconut oil",
              "capric caprylic triglyceride"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
  },
  {
    canonical_name: "butyl stearate",
    aliases: ["butyl stearate"],
    category: "emollient", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Can be comedogenic",
  },
  {
    canonical_name: "hexyldecanol",
    aliases: ["hexyldecanol", "hexyl decanol", "2-hexyldecanol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "ethylhexyl olivate",
    aliases: ["ethylhexyl olivate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Olive oil-derived ester; skin conditioning",
  },
  {
    canonical_name: "coco-caprylate/caprate",
    aliases: ["coco caprylate/caprate", "coco-caprylate caprate", "coco caprylate caprate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "squalane",
    aliases: ["squalane"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
    notes: "Highly stable emollient; well-tolerated, non-comedogenic",
  },
  {
    canonical_name: "jojoba oil",
    aliases: ["simmondsia chinensis seed oil", "jojoba oil", "jojoba",
              "simmondsia chinensis (jojoba) seed oil"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sunflower seed oil",
    aliases: ["helianthus annuus seed oil", "sunflower oil", "sunflower seed oil",
              "helianthus annuus (sunflower) seed oil"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },

  // ── WAXES / STRUCTURANTS ──────────────────────────────────────────────────

  {
    canonical_name: "glyceryl behenate",
    aliases: ["glyceryl behenate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Wax-like emollient/emulsifier",
  },
  {
    canonical_name: "glyceryl dibehenate",
    aliases: ["glyceryl dibehenate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "glyceryl laurate",
    aliases: ["glyceryl laurate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Mild emulsifier and emollient; also has mild antimicrobial activity",
  },
  {
    canonical_name: "tribehenin",
    aliases: ["tribehenin"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Wax-like structurant from behenic acid",
  },
  {
    canonical_name: "microcrystalline wax",
    aliases: ["microcrystalline wax", "cera microcristallina"],
    category: "occlusive", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "ceresin",
    aliases: ["ceresin", "ceresin wax"],
    category: "occlusive", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },

  // ── EMULSIFIERS / SURFACTANTS ─────────────────────────────────────────────

  {
    canonical_name: "potassium cetyl phosphate",
    aliases: ["potassium cetyl phosphate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Mild emulsifier common in SPF emulsions",
  },
  {
    canonical_name: "glyceryl stearate",
    aliases: ["glyceryl stearate", "glyceryl monostearate", "glycerol monostearate",
              "glyceryl stearate se"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "ceteareth-20",
    aliases: ["ceteareth-20", "ceteareth 20"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "ceteareth-12",
    aliases: ["ceteareth-12", "ceteareth 12"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "sorbitan stearate",
    aliases: ["sorbitan stearate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "sorbitan olivate",
    aliases: ["sorbitan olivate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "polyglyceryl-3 methylglucose distearate",
    aliases: ["polyglyceryl-3 methylglucose distearate", "polyglyceryl 3 methylglucose distearate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "peg-100 stearate",
    aliases: ["peg-100 stearate", "peg 100 stearate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "steareth-2",
    aliases: ["steareth-2", "steareth 2"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "steareth-21",
    aliases: ["steareth-21", "steareth 21"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "cetyl phosphate",
    aliases: ["cetyl phosphate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "sodium stearoyl lactylate",
    aliases: ["sodium stearoyl lactylate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },

  // ── POLYMERS / THICKENERS ─────────────────────────────────────────────────

  {
    canonical_name: "hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer",
    aliases: [
      "hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer",
      "hydroxyethyl acrylate sodium acryloyldimethyl taurate copolymer",
    ],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Synthetic polymer thickener/emulsifier common in lightweight SPF formulas",
  },
  {
    canonical_name: "ammonium acryloyldimethyltaurate/vp copolymer",
    aliases: [
      "ammonium acryloyldimethyltaurate/vp copolymer",
      "ammonium acryloyldimethyltaurate vp copolymer",
    ],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "acrylates/c10-30 alkyl acrylate crosspolymer",
    aliases: [
      "acrylates/c10-30 alkyl acrylate crosspolymer",
      "acrylates c10 30 alkyl acrylate crosspolymer",
      "acrylates/c10 30 alkyl acrylate crosspolymer",
    ],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Carbomer-type polymer; gelling agent in water-based formulas",
  },
  {
    canonical_name: "acrylamide/sodium acrylate copolymer",
    aliases: ["acrylamide/sodium acrylate copolymer", "acrylamide sodium acrylate copolymer"],
    category: "thickener", risk_level: "low_risk", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Contains acrylamide monomer residues — uncertain reproductive safety",
  },
  {
    canonical_name: "xanthan gum",
    aliases: ["xanthan gum"],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "hydroxyethylcellulose",
    aliases: ["hydroxyethylcellulose", "hydroxyethyl cellulose", "hec"],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sodium polyacrylate",
    aliases: ["sodium polyacrylate"],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },

  // ── FATTY ALCOHOLS (film-formers, co-emulsifiers) ─────────────────────────

  {
    canonical_name: "behenyl alcohol",
    aliases: ["behenyl alcohol", "1-docosanol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "Long-chain fatty alcohol; skin-conditioning and co-emulsifying",
  },
  {
    canonical_name: "stearyl alcohol",
    aliases: ["stearyl alcohol", "1-octadecanol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "myristyl alcohol",
    aliases: ["myristyl alcohol", "1-tetradecanol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },

  // ── FATTY ACIDS ───────────────────────────────────────────────────────────

  {
    canonical_name: "stearic acid",
    aliases: ["stearic acid"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "Fatty acid; emollient and texturizer",
  },
  {
    canonical_name: "palmitic acid",
    aliases: ["palmitic acid", "hexadecanoic acid"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "lauric acid",
    aliases: ["lauric acid", "dodecanoic acid"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "caprylic acid",
    aliases: ["caprylic acid", "octanoic acid"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },

  // ── SILICONE VARIANTS ─────────────────────────────────────────────────────

  {
    canonical_name: "cyclomethicone",
    aliases: ["cyclomethicone"],
    category: "silicone", risk_level: "low_risk", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Volatile silicone; possible environmental concern (EU restricted in rinse-off)",
  },
  {
    canonical_name: "caprylyl methicone",
    aliases: ["caprylyl methicone"],
    category: "silicone", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "trimethylsiloxysilicate",
    aliases: ["trimethylsiloxysilicate"],
    category: "silicone", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Film-forming silicone resin; long-wear properties",
  },
  {
    canonical_name: "bis-peg/ppg-14/14 dimethicone",
    aliases: ["bis-peg/ppg-14/14 dimethicone", "bis peg ppg 14 14 dimethicone"],
    category: "silicone", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "phenyl trimethicone",
    aliases: ["phenyl trimethicone"],
    category: "silicone", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },

  // ── UV FILTER VARIANTS ────────────────────────────────────────────────────

  {
    canonical_name: "phenylbenzimidazole sulfonic acid",
    aliases: ["phenylbenzimidazole sulfonic acid", "ensulizole",
              "2-phenylbenzimidazole-5-sulfonic acid"],
    category: "uv_filter", risk_level: "safe",
    flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "UVB filter; water-soluble",
  },
  {
    canonical_name: "homosalate",
    aliases: ["homosalate", "homomenthyl salicylate"],
    category: "uv_filter", risk_level: "medium_risk",
    flags: ["uv_filter", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "medium",
    notes: "UVB filter; mild endocrine activity — avoid in pregnancy",
  },
  {
    canonical_name: "ethylhexyl salicylate",
    aliases: ["ethylhexyl salicylate", "octyl salicylate", "octisalate",
              "2-ethylhexyl salicylate"],
    category: "uv_filter", risk_level: "low_risk",
    flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "UVB filter; generally considered low concern",
  },
  {
    canonical_name: "diethylhexyl butamido triazone",
    aliases: ["diethylhexyl butamido triazone", "uvasorb heb"],
    category: "uv_filter", risk_level: "safe",
    flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "ethylhexyl triazone",
    aliases: ["ethylhexyl triazone", "octyl triazone", "uvinul t 150"],
    category: "uv_filter", risk_level: "safe",
    flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "methylene bis-benzotriazolyl tetramethylbutylphenol",
    aliases: [
      "methylene bis-benzotriazolyl tetramethylbutylphenol",
      "tinosorb m",
      "bisoctrizole",
    ],
    category: "uv_filter", risk_level: "safe",
    flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Broad-spectrum UV filter (UVA+UVB); well tolerated",
  },
  {
    canonical_name: "drometrizole trisiloxane",
    aliases: ["drometrizole trisiloxane", "mexoryl xl"],
    category: "uv_filter", risk_level: "safe",
    flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "benzophenone-4",
    aliases: ["benzophenone-4", "sulisobenzone", "benzophenone 4"],
    category: "uv_filter", risk_level: "medium_risk",
    flags: ["uv_filter", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "medium",
  },

  // ── FILM-FORMERS / OPACIFIERS ─────────────────────────────────────────────

  {
    canonical_name: "polysilicone-15",
    aliases: ["polysilicone-15", "polysilicone 15", "dimethicodiethylbenzalmalonate"],
    category: "uv_filter", risk_level: "safe",
    flags: ["uv_filter"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Polymeric UV filter; photostable",
  },

  // ── ANTIOXIDANTS / ACTIVES ────────────────────────────────────────────────

  {
    canonical_name: "ascorbyl glucoside",
    aliases: ["ascorbyl glucoside", "ascorbyl 2-glucoside", "aa2g"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Stable vitamin C derivative; brightening",
  },
  {
    canonical_name: "sodium ascorbyl phosphate",
    aliases: ["sodium ascorbyl phosphate", "sap"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "ascorbyl tetraisopalmitate",
    aliases: ["ascorbyl tetraisopalmitate"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Oil-soluble vitamin C derivative",
  },
  {
    canonical_name: "tocopheryl acetate",
    aliases: ["tocopheryl acetate", "vitamin e acetate", "dl-alpha-tocopheryl acetate",
              "alpha-tocopheryl acetate"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "high",
    notes: "Esterified vitamin E; stable antioxidant",
  },
  {
    canonical_name: "ubiquinone",
    aliases: ["ubiquinone", "coenzyme q10", "coq10"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "resveratrol",
    aliases: ["resveratrol"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "bakuchiol",
    aliases: ["bakuchiol"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Plant-derived retinol alternative; gentler than retinol",
  },
  {
    canonical_name: "tranexamic acid",
    aliases: ["tranexamic acid"],
    category: "active", risk_level: "low_risk", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Brightening active; topical use safety in pregnancy is uncertain",
  },

  // ── SKIN CONDITIONERS / OCCLUSIVES ────────────────────────────────────────

  {
    canonical_name: "shea butter",
    aliases: ["butyrospermum parkii butter", "shea butter",
              "butyrospermum parkii (shea) butter",
              "vitellaria paradoxa seed butter"],
    category: "occlusive", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "cocoa butter",
    aliases: ["theobroma cacao seed butter", "cocoa butter",
              "theobroma cacao (cocoa) seed butter"],
    category: "occlusive", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "mineral oil",
    aliases: ["mineral oil", "paraffinum liquidum", "huile minerale", "white mineral oil"],
    category: "occlusive", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "Safe topically; cosmetic-grade only; some comedogenicity concern",
  },
  {
    canonical_name: "paraffin",
    aliases: ["paraffin", "paraffin wax", "cera paraffin"],
    category: "occlusive", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },

  // ── HUMECTANT VARIANTS ────────────────────────────────────────────────────

  {
    canonical_name: "sodium pca",
    aliases: ["sodium pca", "sodium 2-pyrrolidone-5-carboxylate"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "Natural moisturizing factor (NMF) component",
  },
  {
    canonical_name: "erythritol",
    aliases: ["erythritol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "trehalose",
    aliases: ["trehalose"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Disaccharide; protective humectant",
  },
  {
    canonical_name: "glucose",
    aliases: ["glucose"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sorbitol",
    aliases: ["sorbitol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "maltitol",
    aliases: ["maltitol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "dipropylene glycol",
    aliases: ["dipropylene glycol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },

  // ── CHELATING / STABILITY AIDS ────────────────────────────────────────────

  {
    canonical_name: "sodium gluconate",
    aliases: ["sodium gluconate", "gluconate"],
    category: "chelating", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "trisodium edta",
    aliases: ["trisodium edta", "trisodium ethylenediaminetetraacetate"],
    category: "chelating", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "sodium phytate",
    aliases: ["sodium phytate"],
    category: "chelating", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },

  // ── BOTANICALS / PLANT EXTRACTS ───────────────────────────────────────────

  {
    canonical_name: "myrtus communis leaf extract",
    aliases: ["myrtus communis leaf extract", "myrtle leaf extract"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "low",
    notes: "Antioxidant botanical; limited clinical data",
  },
  {
    canonical_name: "tripterygium wilfordii callus extract",
    aliases: ["tripterygium wilfordii callus extract"],
    category: "active", risk_level: "low_risk", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "low",
    notes: "Anti-inflammatory; plant callus extract; limited topical safety data",
  },
  {
    canonical_name: "centella asiatica extract",
    aliases: ["centella asiatica extract", "centella asiatica", "gotu kola",
              "centella asiatica (gotu kola) extract", "cica"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Soothing, wound-healing botanical",
  },
  {
    canonical_name: "nymphaea alba flower extract",
    aliases: ["nymphaea alba flower extract", "white water lily extract"],
    category: "active", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "low",
  },
  {
    canonical_name: "licorice root extract",
    aliases: ["glycyrrhiza glabra root extract", "licorice root extract",
              "licorice extract", "glycyrrhiza uralensis root extract",
              "glycyrrhiza inflata root extract"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Brightening, anti-inflammatory; contains glabridin",
  },
  {
    canonical_name: "camellia sinensis leaf extract",
    aliases: ["camellia sinensis leaf extract", "green tea extract",
              "camellia sinensis (green tea) leaf extract", "green tea"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "high",
    notes: "Rich in antioxidant polyphenols (catechins, EGCG)",
  },
  {
    canonical_name: "rosa canina fruit extract",
    aliases: ["rosa canina fruit extract", "rosehip extract", "rosehip"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "calendula officinalis flower extract",
    aliases: ["calendula officinalis flower extract", "calendula extract"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Soothing, anti-inflammatory botanical",
  },
  {
    canonical_name: "lavandula angustifolia extract",
    aliases: ["lavandula angustifolia extract", "lavender extract",
              "lavandula angustifolia (lavender) extract"],
    category: "active", risk_level: "low_risk", flags: ["fragrance"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "May act as fragrance allergen at high concentrations",
  },
  {
    canonical_name: "chamomilla recutita flower extract",
    aliases: ["chamomilla recutita flower extract", "chamomile extract",
              "matricaria chamomilla flower extract",
              "chamomilla recutita (matricaria) flower extract"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "arnica montana flower extract",
    aliases: ["arnica montana flower extract", "arnica extract"],
    category: "active", risk_level: "low_risk", flags: [],
    pregnancy_safe: false, confidence: "medium",
    notes: "Anti-inflammatory; avoid in pregnancy at therapeutic doses",
  },

  // ── OPACIFIERS / PIGMENTS ─────────────────────────────────────────────────

  {
    canonical_name: "silica dimethyl silylate",
    aliases: ["silica dimethyl silylate"],
    category: "absorbent", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Surface-treated silica; mattifying agent",
  },
  {
    canonical_name: "iron oxides",
    aliases: ["iron oxides", "ci 77491", "ci 77492", "ci 77499",
              "ci 77491 ci 77492 ci 77499"],
    category: "colorant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "mica",
    aliases: ["mica", "ci 77019"],
    category: "colorant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },

  // ── SOLVENTS / CO-SOLVENTS ────────────────────────────────────────────────

  {
    canonical_name: "butylene glycol",
    aliases: ["butylene glycol", "1,3-butylene glycol", "1,3-butanediol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "Humectant and solvent; well-tolerated",
  },
  {
    canonical_name: "hexylene glycol",
    aliases: ["hexylene glycol", "2-methyl-2,4-pentanediol"],
    category: "humectant", risk_level: "low_risk", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "caprylyl glycol",
    aliases: ["caprylyl glycol", "1,2-octanediol"],
    category: "preservative", risk_level: "safe", flags: ["preservative"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Multifunctional; mild antimicrobial + humectant",
  },
  {
    canonical_name: "ethylhexylglycerin",
    aliases: ["ethylhexylglycerin", "ethylhexyl glycerin"],
    category: "preservative", risk_level: "safe", flags: ["preservative"],
    pregnancy_safe: true, confidence: "medium",
    notes: "Skin conditioning preservative booster",
  },

  // ── pH ADJUSTERS ──────────────────────────────────────────────────────────

  {
    canonical_name: "aminomethyl propanol",
    aliases: ["aminomethyl propanol", "amp-95", "2-amino-2-methyl-1-propanol"],
    category: "ph_adjuster", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "pH adjuster; neutralizes carbomer/acrylate gels",
  },
  {
    canonical_name: "tromethamine",
    aliases: ["tromethamine", "tris", "trometamol",
              "tris(hydroxymethyl)aminomethane"],
    category: "ph_adjuster", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "lactic acid",
    aliases: ["lactic acid"],
    category: "ph_adjuster", risk_level: "low_risk", flags: ["active"],
    pregnancy_safe: true, confidence: "high",
    notes: "AHA; exfoliating at >5% but safe pH adjuster at low %; generally pregnancy-safe at cosmetic concentrations",
  },
  {
    canonical_name: "sodium lactate",
    aliases: ["sodium lactate"],
    category: "ph_adjuster", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },

  // ── FRAGRANCE COMPONENTS (individual allergens) ───────────────────────────

  {
    canonical_name: "linalool",
    aliases: ["linalool"],
    category: "fragrance", risk_level: "medium_risk",
    flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Common fragrance allergen; EU must-declare",
  },
  {
    canonical_name: "limonene",
    aliases: ["limonene", "d-limonene"],
    category: "fragrance", risk_level: "medium_risk",
    flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Common fragrance allergen; EU must-declare",
  },
  {
    canonical_name: "citronellol",
    aliases: ["citronellol"],
    category: "fragrance", risk_level: "medium_risk",
    flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "hexyl cinnamal",
    aliases: ["hexyl cinnamal", "hexyl cinnamaldehyde"],
    category: "fragrance", risk_level: "medium_risk",
    flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "benzyl alcohol",
    aliases: ["benzyl alcohol"],
    category: "preservative", risk_level: "medium_risk",
    flags: ["preservative", "fragrance"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Dual-use preservative and fragrance; mild skin sensitizer",
  },

  // ── PRESERVATIVE VARIANTS ─────────────────────────────────────────────────

  {
    canonical_name: "sodium benzoate",
    aliases: ["sodium benzoate"],
    category: "preservative", risk_level: "low_risk",
    flags: ["preservative"],
    pregnancy_safe: true, confidence: "high",
    notes: "Common preservative; generally safe at cosmetic concentrations",
  },
  {
    canonical_name: "potassium sorbate",
    aliases: ["potassium sorbate"],
    category: "preservative", risk_level: "safe",
    flags: ["preservative"],
    pregnancy_safe: true, confidence: "high",
    notes: "Mild food-grade preservative",
  },
  {
    canonical_name: "dehydroacetic acid",
    aliases: ["dehydroacetic acid", "dha preservative"],
    category: "preservative", risk_level: "low_risk",
    flags: ["preservative"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "sodium dehydroacetate",
    aliases: ["sodium dehydroacetate"],
    category: "preservative", risk_level: "low_risk",
    flags: ["preservative"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "chlorphenesin",
    aliases: ["chlorphenesin"],
    category: "preservative", risk_level: "low_risk",
    flags: ["preservative"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Broad-spectrum preservative; generally mild",
  },

  // ── EMOLLIENT ESTERS (additional common SPF ingredients) ─────────────────

  {
    canonical_name: "dibutyl adipate",
    aliases: ["dibutyl adipate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "myristyl myristate",
    aliases: ["myristyl myristate"],
    category: "emollient", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "medium",
    notes: "Can be comedogenic",
  },
  {
    canonical_name: "isostearyl neopentanoate",
    aliases: ["isostearyl neopentanoate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
];
