/**
 * registry/coreRegistry.ts — ingredientEngineV4
 *
 * V4 canonical ingredient registry — core layer.
 * ~170 entries covering INCI corpus essentials.
 *
 * Field rules:
 *   - canonical_name: lowercase INCI name (authoritative form)
 *   - aliases: all known spelling/synonym variants (lowercase)
 *   - pregnancy_safe: true = established safe, false = avoid, "uncertain" = limited data
 *   - confidence: high = well-studied, medium = adequate data, low = limited info
 *
 * ZERO imports from legacy/V3/V1 systems.
 * Extension: add ingredientEngineV4/registry/coreRegistryExpansion.ts (future layers)
 */

import type { V4RegistryEntry } from "./types";

export const CORE_REGISTRY: V4RegistryEntry[] = [

  // ── SOLVENTS ─────────────────────────────────────────────────────────────────

  {
    canonical_name: "water",
    aliases: ["water", "aqua", "eau", "purified water", "deionized water", "distilled water",
              "aqua purificata", "demineralized water"],
    category: "solvent", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
  },
  {
    canonical_name: "alcohol denat.",
    aliases: ["alcohol denat.", "alcohol denat", "denatured alcohol", "sd alcohol",
              "alcohol (denat.)", "alcohol denatured"],
    category: "solvent", risk_level: "high_risk", flags: ["drying_alcohol"],
    pregnancy_safe: false, confidence: "high",
    notes: "Barrier-disrupting; drying; not recommended for sensitive or dry skin",
  },
  {
    canonical_name: "isopropyl alcohol",
    aliases: ["isopropyl alcohol", "isopropanol", "2-propanol"],
    category: "solvent", risk_level: "high_risk", flags: ["drying_alcohol"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "propylene glycol",
    aliases: ["propylene glycol", "1,2-propanediol"],
    category: "humectant", risk_level: "low_risk", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
  },

  // ── HUMECTANTS ────────────────────────────────────────────────────────────────

  {
    canonical_name: "glycerin",
    aliases: ["glycerin", "glycerine", "glycerol", "glycerina"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
  },
  {
    canonical_name: "sodium hyaluronate",
    aliases: ["sodium hyaluronate", "sodium hyaluronic acid"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
  },
  {
    canonical_name: "hyaluronic acid",
    aliases: ["hyaluronic acid", "ha", "hya", "hyaluronate"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
  },
  {
    canonical_name: "butylene glycol",
    aliases: ["butylene glycol", "1,3-butylene glycol", "1,3-butanediol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "pentylene glycol",
    aliases: ["pentylene glycol", "1,2-pentanediol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "panthenol",
    aliases: ["panthenol", "d-panthenol", "dl-panthenol", "provitamin b5", "vitamin b5"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
  },
  {
    canonical_name: "urea",
    aliases: ["urea", "carbamide"],
    category: "humectant", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "May sting in broken skin; effective keratolytic at higher %",
  },
  {
    canonical_name: "betaine",
    aliases: ["betaine", "trimethylglycine"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sodium pca",
    aliases: ["sodium pca", "sodium pyrrolidone carboxylic acid"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sorbitol",
    aliases: ["sorbitol", "d-glucitol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "inositol",
    aliases: ["inositol", "myo-inositol"],
    category: "humectant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },

  // ── EMOLLIENTS ────────────────────────────────────────────────────────────────

  {
    canonical_name: "cetyl alcohol",
    aliases: ["cetyl alcohol", "1-hexadecanol", "hexadecan-1-ol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "cetearyl alcohol",
    aliases: ["cetearyl alcohol", "cetostearyl alcohol", "cetearyl", "cetyl stearyl alcohol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "stearyl alcohol",
    aliases: ["stearyl alcohol", "1-octadecanol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "behenyl alcohol",
    aliases: ["behenyl alcohol", "1-docosanol", "docosanol"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "caprylic/capric triglyceride",
    aliases: ["caprylic/capric triglyceride", "caprylic capric triglyceride",
              "c8-c10 triglyceride", "medium chain triglycerides"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "isopropyl myristate",
    aliases: ["isopropyl myristate", "ipm"],
    category: "emollient", risk_level: "low_risk", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "May cause comedogenicity in acne-prone skin",
  },
  {
    canonical_name: "squalane",
    aliases: ["squalane", "squalene"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "jojoba oil",
    aliases: ["simmondsia chinensis seed oil", "jojoba oil", "jojoba"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "ethylhexyl palmitate",
    aliases: ["ethylhexyl palmitate", "octyl palmitate", "2-ethylhexyl palmitate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "c12-15 alkyl benzoate",
    aliases: ["c12-15 alkyl benzoate", "c12 15 alkyl benzoate"],
    category: "emollient", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },

  // ── OCCLUSIVES / BARRIER ──────────────────────────────────────────────────────

  {
    canonical_name: "petrolatum",
    aliases: ["petrolatum", "petroleum jelly", "white petrolatum", "vaseline"],
    category: "occlusive", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "mineral oil",
    aliases: ["mineral oil", "paraffinum liquidum", "white mineral oil"],
    category: "occlusive", risk_level: "low_risk", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "beeswax",
    aliases: ["beeswax", "cera alba", "cire d'abeille", "apis mellifera cera"],
    category: "occlusive", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "ceramide np",
    aliases: ["ceramide np", "ceramide 3", "ceramide", "ceramides"],
    category: "barrier", risk_level: "safe", flags: ["barrier_support"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "cholesterol",
    aliases: ["cholesterol"],
    category: "barrier", risk_level: "safe", flags: ["barrier_support"],
    pregnancy_safe: true, confidence: "high",
  },

  // ── SILICONES ─────────────────────────────────────────────────────────────────

  {
    canonical_name: "dimethicone",
    aliases: ["dimethicone", "dimethylpolysiloxane", "pdms", "poly-dimethylsiloxane",
              "polydimethylsiloxane"],
    category: "silicone", risk_level: "safe", flags: ["silicone"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "cyclopentasiloxane",
    aliases: ["cyclopentasiloxane", "d5 silicone", "d5"],
    category: "silicone", risk_level: "low_risk", flags: ["silicone"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "EU scrutiny for bioaccumulation; restricted in rinse-off since 2020",
  },
  {
    canonical_name: "cyclohexasiloxane",
    aliases: ["cyclohexasiloxane", "d6"],
    category: "silicone", risk_level: "low_risk", flags: ["silicone"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "dimethiconol",
    aliases: ["dimethiconol"],
    category: "silicone", risk_level: "safe", flags: ["silicone"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "phenyl trimethicone",
    aliases: ["phenyl trimethicone"],
    category: "silicone", risk_level: "safe", flags: ["silicone"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "caprylyl methicone",
    aliases: ["caprylyl methicone"],
    category: "silicone", risk_level: "safe", flags: ["silicone"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "bis-peg/ppg-14/14 dimethicone",
    aliases: ["bis-peg/ppg-14/14 dimethicone", "bis peg/ppg 14/14 dimethicone"],
    category: "silicone", risk_level: "safe", flags: ["silicone"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },

  // ── EMULSIFIERS ───────────────────────────────────────────────────────────────

  {
    canonical_name: "glyceryl stearate",
    aliases: ["glyceryl stearate", "glyceryl monostearate", "glyceryl stearate se"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "peg-100 stearate",
    aliases: ["peg-100 stearate", "peg 100 stearate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "polysorbate 20",
    aliases: ["polysorbate 20", "polysorbate-20", "tween 20"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "polysorbate 60",
    aliases: ["polysorbate 60", "polysorbate-60"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "polysorbate 80",
    aliases: ["polysorbate 80", "polysorbate-80", "tween 80"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "ceteareth-20",
    aliases: ["ceteareth-20", "ceteareth 20"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "sorbitan stearate",
    aliases: ["sorbitan stearate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "glyceryl polyacrylate",
    aliases: ["glyceryl polyacrylate"],
    category: "emulsifier", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },

  // ── THICKENERS / POLYMERS ─────────────────────────────────────────────────────

  {
    canonical_name: "carbomer",
    aliases: ["carbomer", "carbopol", "acrylic acid polymer", "polyacrylic acid"],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
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
    canonical_name: "hydroxypropyl methylcellulose",
    aliases: ["hydroxypropyl methylcellulose", "hydroxypropyl methyl cellulose", "hpmc", "hypromellose"],
    category: "thickener", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "acrylates/c10-30 alkyl acrylate crosspolymer",
    aliases: ["acrylates/c10-30 alkyl acrylate crosspolymer",
              "acrylates c10-30 alkyl acrylate crosspolymer",
              "carbomer 1342"],
    category: "thickener", risk_level: "safe", flags: ["polymer"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "polyacrylamide",
    aliases: ["polyacrylamide"],
    category: "polymer", risk_level: "low_risk", flags: ["polymer"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Trace acrylamide monomer is of concern; well-formulated products are safe",
  },

  // ── PRESERVATIVES ─────────────────────────────────────────────────────────────

  {
    canonical_name: "phenoxyethanol",
    aliases: ["phenoxyethanol", "2-phenoxyethanol"],
    category: "preservative", risk_level: "medium_risk", flags: ["preservative"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Widely used broad-spectrum preservative; sensitization in some individuals",
  },
  {
    canonical_name: "methylparaben",
    aliases: ["methylparaben", "methyl paraben", "methyl 4-hydroxybenzoate"],
    category: "preservative", risk_level: "medium_risk",
    flags: ["preservative", "paraben", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "high",
    notes: "Paraben class; estrogenic activity debated; avoid in pregnancy as precaution",
  },
  {
    canonical_name: "propylparaben",
    aliases: ["propylparaben", "propyl paraben"],
    category: "preservative", risk_level: "medium_risk",
    flags: ["preservative", "paraben", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "butylparaben",
    aliases: ["butylparaben", "butyl paraben"],
    category: "preservative", risk_level: "high_risk",
    flags: ["preservative", "paraben", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "ethylparaben",
    aliases: ["ethylparaben", "ethyl paraben"],
    category: "preservative", risk_level: "medium_risk",
    flags: ["preservative", "paraben"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "isobutylparaben",
    aliases: ["isobutylparaben", "isobutyl paraben"],
    category: "preservative", risk_level: "high_risk",
    flags: ["preservative", "paraben", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "benzyl alcohol",
    aliases: ["benzyl alcohol", "phenylmethanol"],
    category: "preservative", risk_level: "low_risk", flags: ["preservative", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Also a fragrance allergen; EU 26 list",
  },
  {
    canonical_name: "potassium sorbate",
    aliases: ["potassium sorbate"],
    category: "preservative", risk_level: "safe", flags: ["preservative"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sodium benzoate",
    aliases: ["sodium benzoate"],
    category: "preservative", risk_level: "safe", flags: ["preservative"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "ethylhexylglycerin",
    aliases: ["ethylhexylglycerin", "ethylhexyl glycerin"],
    category: "preservative", risk_level: "safe", flags: ["preservative"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "caprylyl glycol",
    aliases: ["caprylyl glycol", "1,2-octanediol"],
    category: "preservative", risk_level: "safe", flags: ["preservative"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "methylisothiazolinone",
    aliases: ["methylisothiazolinone", "mit", "2-methyl-4-isothiazolin-3-one"],
    category: "preservative", risk_level: "high_risk",
    flags: ["preservative", "allergen", "eu_restricted"],
    pregnancy_safe: false, confidence: "high",
    notes: "Banned in EU leave-on products since 2016; potent contact allergen",
  },
  {
    canonical_name: "methylchloroisothiazolinone",
    aliases: ["methylchloroisothiazolinone", "cmit", "chloromethylisothiazolinone",
              "5-chloro-2-methyl-4-isothiazolin-3-one"],
    category: "preservative", risk_level: "high_risk",
    flags: ["preservative", "allergen", "eu_restricted"],
    pregnancy_safe: false, confidence: "high",
    notes: "Often appears as CMIT/MIT mixture; high sensitizer",
  },
  {
    canonical_name: "chlorphenesin",
    aliases: ["chlorphenesin"],
    category: "preservative", risk_level: "low_risk", flags: ["preservative"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "dmdm hydantoin",
    aliases: ["dmdm hydantoin", "dmdhantoin"],
    category: "preservative", risk_level: "high_risk",
    flags: ["preservative", "formaldehyde_releaser"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "formaldehyde",
    aliases: ["formaldehyde", "formalin", "methanediol"],
    category: "preservative", risk_level: "high_risk",
    flags: ["preservative", "allergen", "formaldehyde_releaser", "eu_restricted"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "quaternium-15",
    aliases: ["quaternium-15", "quaternium 15"],
    category: "preservative", risk_level: "high_risk",
    flags: ["preservative", "formaldehyde_releaser", "allergen"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "imidazolidinyl urea",
    aliases: ["imidazolidinyl urea", "imidazolidinylurea"],
    category: "preservative", risk_level: "medium_risk",
    flags: ["preservative", "formaldehyde_releaser"],
    pregnancy_safe: "uncertain", confidence: "high",
  },

  // ── UV FILTERS — MINERAL ──────────────────────────────────────────────────────

  {
    canonical_name: "titanium dioxide",
    aliases: ["titanium dioxide", "ci 77891", "tio2"],
    category: "uv_filter", risk_level: "safe", flags: ["uv_filter", "mineral_filter"],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
    notes: "Inorganic UV filter; well-tolerated; large particles do not penetrate skin",
  },
  {
    canonical_name: "zinc oxide",
    aliases: ["zinc oxide", "zno"],
    category: "uv_filter", risk_level: "safe", flags: ["uv_filter", "mineral_filter"],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
    notes: "Inorganic broad-spectrum UV filter; well-tolerated; often preferred in pregnancy",
  },

  // ── UV FILTERS — CHEMICAL / ORGANIC ──────────────────────────────────────────

  {
    canonical_name: "ethylhexyl methoxycinnamate",
    aliases: ["ethylhexyl methoxycinnamate", "octinoxate", "2-ethylhexyl methoxycinnamate",
              "oct methoxycinnamate"],
    category: "uv_filter", risk_level: "medium_risk",
    flags: ["uv_filter", "endocrine_disruptor"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Most common UVB filter; mild estrogenic activity reported",
  },
  {
    canonical_name: "butyl methoxydibenzoylmethane",
    aliases: ["butyl methoxydibenzoylmethane", "avobenzone", "parsol 1789"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "UVA filter; may be sensitizing; photolabile — needs stabilizer",
  },
  {
    canonical_name: "octocrylene",
    aliases: ["octocrylene"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "UVB/short-UVA filter; photostabilizer for avobenzone",
  },
  {
    canonical_name: "benzophenone-3",
    aliases: ["benzophenone-3", "oxybenzone", "2-hydroxy-4-methoxybenzophenone"],
    category: "uv_filter", risk_level: "medium_risk",
    flags: ["uv_filter", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "high",
    notes: "Significant skin penetration; hormonal activity; avoid in pregnancy",
  },
  {
    canonical_name: "ethylhexyl salicylate",
    aliases: ["ethylhexyl salicylate", "octyl salicylate", "2-ethylhexyl salicylate"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "bis-ethylhexyloxyphenol methoxyphenyl triazine",
    aliases: ["bis-ethylhexyloxyphenol methoxyphenyl triazine", "tinosorb s",
              "bemotrizinol", "anisotriazine"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Broad-spectrum filter; low skin penetration; considered safe",
  },
  {
    canonical_name: "diethylamino hydroxybenzoyl hexyl benzoate",
    aliases: ["diethylamino hydroxybenzoyl hexyl benzoate", "uvinul a plus", "uvinul a+",
              "diethylaminohydroxybenzoyl hexyl benzoate"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "ethylhexyl triazone",
    aliases: ["ethylhexyl triazone", "uvinul t 150", "octyl triazone"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "phenylbenzimidazole sulfonic acid",
    aliases: ["phenylbenzimidazole sulfonic acid", "ensulizole", "eusolex 232"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "drometrizole trisiloxane",
    aliases: ["drometrizole trisiloxane", "mexoryl xl"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "methylene bis-benzotriazolyl tetramethylbutylphenol",
    aliases: ["methylene bis-benzotriazolyl tetramethylbutylphenol", "tinosorb m",
              "bisoctrizole"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "phenylene bis-diphenyltriazine",
    aliases: ["phenylene bis-diphenyltriazine", "triazine uv filter", "heb filter"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "low",
  },
  {
    canonical_name: "diethylhexyl butamido triazone",
    aliases: ["diethylhexyl butamido triazone", "uvasorb heb"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "low",
  },
  {
    canonical_name: "4-methylbenzylidene camphor",
    aliases: ["4-methylbenzylidene camphor", "enzacamene"],
    category: "uv_filter", risk_level: "medium_risk",
    flags: ["uv_filter", "endocrine_disruptor"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "ecamsule",
    aliases: ["ecamsule", "mexoryl sx"],
    category: "uv_filter", risk_level: "medium_risk", flags: ["uv_filter"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },

  // ── SURFACTANTS ───────────────────────────────────────────────────────────────

  {
    canonical_name: "sodium lauryl sulfate",
    aliases: ["sodium lauryl sulfate", "sls", "sodium dodecyl sulfate", "sodium laurilsulfate"],
    category: "surfactant", risk_level: "high_risk", flags: ["surfactant"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Strong anionic surfactant; significant barrier disruption; irritating",
  },
  {
    canonical_name: "sodium laureth sulfate",
    aliases: ["sodium laureth sulfate", "sles", "sodium lauryl ether sulfate"],
    category: "surfactant", risk_level: "medium_risk", flags: ["surfactant"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Milder than SLS; but irritating in high concentrations",
  },
  {
    canonical_name: "ammonium laureth sulfate",
    aliases: ["ammonium laureth sulfate", "ales"],
    category: "surfactant", risk_level: "medium_risk", flags: ["surfactant"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "cocamidopropyl betaine",
    aliases: ["cocamidopropyl betaine", "capb"],
    category: "surfactant", risk_level: "low_risk", flags: ["surfactant"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Amphoteric; mild; some sensitization potential",
  },
  {
    canonical_name: "decyl glucoside",
    aliases: ["decyl glucoside"],
    category: "surfactant", risk_level: "safe", flags: ["surfactant"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "coco-glucoside",
    aliases: ["coco-glucoside", "coco glucoside"],
    category: "surfactant", risk_level: "safe", flags: ["surfactant"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "lauryl glucoside",
    aliases: ["lauryl glucoside"],
    category: "surfactant", risk_level: "safe", flags: ["surfactant"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sodium cocoamphoacetate",
    aliases: ["sodium cocoamphoacetate"],
    category: "surfactant", risk_level: "safe", flags: ["surfactant"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "sodium lauroyl sarcosinate",
    aliases: ["sodium lauroyl sarcosinate", "sarcosinate"],
    category: "surfactant", risk_level: "safe", flags: ["surfactant"],
    pregnancy_safe: "uncertain", confidence: "high",
  },

  // ── ACTIVES ───────────────────────────────────────────────────────────────────

  {
    canonical_name: "niacinamide",
    aliases: ["niacinamide", "nicotinamide", "vitamin b3", "niacinamid", "niacinamide bp"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
    notes: "Well-studied multipurpose active; low sensitization potential",
  },
  {
    canonical_name: "retinol",
    aliases: ["retinol", "vitamin a", "all-trans retinol"],
    category: "active", risk_level: "medium_risk", flags: ["active"],
    pregnancy_safe: false, breastfeeding_safe: false, confidence: "high",
    notes: "Vitamin A derivative; AVOID in pregnancy (teratogenic potential)",
  },
  {
    canonical_name: "retinyl palmitate",
    aliases: ["retinyl palmitate", "vitamin a palmitate"],
    category: "active", risk_level: "medium_risk", flags: ["active"],
    pregnancy_safe: false, confidence: "high",
    notes: "Vitamin A ester; milder than retinol but still avoid in pregnancy",
  },
  {
    canonical_name: "retinal",
    aliases: ["retinal", "retinaldehyde"],
    category: "active", risk_level: "medium_risk", flags: ["active"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "ascorbic acid",
    aliases: ["ascorbic acid", "vitamin c", "l-ascorbic acid"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "ascorbyl glucoside",
    aliases: ["ascorbyl glucoside", "aa-2g"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "sodium ascorbyl phosphate",
    aliases: ["sodium ascorbyl phosphate", "sap"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "salicylic acid",
    aliases: ["salicylic acid", "2-hydroxybenzoic acid", "bha"],
    category: "active", risk_level: "medium_risk", flags: ["active"],
    pregnancy_safe: false, confidence: "high",
    notes: "BHA exfoliant; avoid in pregnancy (systemic absorption risk)",
  },
  {
    canonical_name: "glycolic acid",
    aliases: ["glycolic acid", "hydroxyacetic acid"],
    category: "active", risk_level: "medium_risk", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "AHA; irritation and photosensitivity risk; ok in low % topically",
  },
  {
    canonical_name: "lactic acid",
    aliases: ["lactic acid", "l-lactic acid"],
    category: "active", risk_level: "low_risk", flags: ["active"],
    pregnancy_safe: true, confidence: "high",
    notes: "Mild AHA + humectant; generally accepted in pregnancy at cosmetic %",
  },
  {
    canonical_name: "azelaic acid",
    aliases: ["azelaic acid", "nonanedioic acid"],
    category: "active", risk_level: "low_risk", flags: ["active"],
    pregnancy_safe: true, confidence: "high",
    notes: "Anti-inflammatory; anti-bacterial; generally safe in pregnancy",
  },
  {
    canonical_name: "kojic acid",
    aliases: ["kojic acid"],
    category: "active", risk_level: "medium_risk", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "adenosine",
    aliases: ["adenosine"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "high",
    notes: "Anti-aging; anti-inflammatory; well-tolerated",
  },
  {
    canonical_name: "bakuchiol",
    aliases: ["bakuchiol"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Retinol alternative; plant-derived; pregnancy safety not fully established",
  },
  {
    canonical_name: "ferulic acid",
    aliases: ["ferulic acid"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "resveratrol",
    aliases: ["resveratrol"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "medium",
  },

  // ── ANTIOXIDANTS ──────────────────────────────────────────────────────────────

  {
    canonical_name: "tocopherol",
    aliases: ["tocopherol", "vitamin e", "alpha-tocopherol", "d-alpha-tocopherol"],
    category: "antioxidant", risk_level: "safe", flags: [],
    pregnancy_safe: true, breastfeeding_safe: true, confidence: "high",
  },
  {
    canonical_name: "tocopheryl acetate",
    aliases: ["tocopheryl acetate", "vitamin e acetate", "alpha-tocopheryl acetate"],
    category: "antioxidant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "bht",
    aliases: ["bht", "butylated hydroxytoluene"],
    category: "antioxidant", risk_level: "medium_risk",
    flags: ["endocrine_disruptor"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Synthetic antioxidant; endocrine disruption debated; used at low %",
  },
  {
    canonical_name: "bha",
    aliases: ["bha", "butylated hydroxyanisole"],
    category: "antioxidant", risk_level: "medium_risk",
    flags: ["endocrine_disruptor"],
    pregnancy_safe: false, confidence: "high",
    notes: "Possible human carcinogen; hormonal activity; avoid in pregnancy",
  },

  // ── BOTANICALS / SOOTHING ─────────────────────────────────────────────────────

  {
    canonical_name: "allantoin",
    aliases: ["allantoin"],
    category: "soothing", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "bisabolol",
    aliases: ["bisabolol", "alpha-bisabolol", "l-bisabolol"],
    category: "soothing", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "aloe barbadensis leaf juice",
    aliases: ["aloe barbadensis leaf juice", "aloe vera", "aloe vera gel",
              "aloe barbadensis gel", "aloe barbadensis"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "centella asiatica extract",
    aliases: ["centella asiatica extract", "centella asiatica", "cica", "gotu kola extract"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "medium",
  },
  {
    canonical_name: "camellia sinensis leaf extract",
    aliases: ["camellia sinensis leaf extract", "green tea extract", "green tea",
              "camellia sinensis extract"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "chamomilla recutita flower extract",
    aliases: ["chamomilla recutita flower extract", "chamomile extract", "chamomilla extract",
              "matricaria chamomilla extract"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "calendula officinalis flower extract",
    aliases: ["calendula officinalis flower extract", "calendula extract"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "licorice root extract",
    aliases: ["glycyrrhiza glabra root extract", "licorice root extract",
              "licorice extract", "glycyrrhiza glabra extract"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },
  {
    canonical_name: "caffeine",
    aliases: ["caffeine"],
    category: "active", risk_level: "safe", flags: ["active"],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Topical caffeine; anti-inflammatory; systemic absorption minimal",
  },
  {
    canonical_name: "madecassoside",
    aliases: ["madecassoside"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
    notes: "Centella asiatica-derived active; barrier support",
  },
  {
    canonical_name: "asiaticoside",
    aliases: ["asiaticoside"],
    category: "botanical", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "medium",
  },

  // ── FRAGRANCE / ALLERGENS ─────────────────────────────────────────────────────

  {
    canonical_name: "fragrance",
    aliases: ["fragrance", "parfum", "perfume", "aroma", "flavor"],
    category: "fragrance", risk_level: "high_risk", flags: ["fragrance"],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Undisclosed mixture; contains unknown sensitizers; patch test recommended",
  },
  {
    canonical_name: "limonene",
    aliases: ["limonene", "d-limonene"],
    category: "fragrance", risk_level: "medium_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "linalool",
    aliases: ["linalool"],
    category: "fragrance", risk_level: "medium_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "citronellol",
    aliases: ["citronellol"],
    category: "fragrance", risk_level: "medium_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "geraniol",
    aliases: ["geraniol"],
    category: "fragrance", risk_level: "medium_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "eugenol",
    aliases: ["eugenol"],
    category: "fragrance", risk_level: "high_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "benzyl benzoate",
    aliases: ["benzyl benzoate"],
    category: "fragrance", risk_level: "medium_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "coumarin",
    aliases: ["coumarin"],
    category: "fragrance", risk_level: "medium_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "hydroxycitronellal",
    aliases: ["hydroxycitronellal"],
    category: "fragrance", risk_level: "medium_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "cinnamyl alcohol",
    aliases: ["cinnamyl alcohol"],
    category: "fragrance", risk_level: "high_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: false, confidence: "high",
  },
  {
    canonical_name: "amyl cinnamal",
    aliases: ["amyl cinnamal", "amylcinnamaldehyde"],
    category: "fragrance", risk_level: "high_risk", flags: ["fragrance", "allergen"],
    pregnancy_safe: false, confidence: "high",
  },

  // ── pH ADJUSTERS / CHELATING ──────────────────────────────────────────────────

  {
    canonical_name: "citric acid",
    aliases: ["citric acid", "citric acid anhydrous"],
    category: "ph_adjuster", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "sodium hydroxide",
    aliases: ["sodium hydroxide", "lye", "caustic soda"],
    category: "ph_adjuster", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
    notes: "Used in trace amounts to adjust pH; inert at final product pH",
  },
  {
    canonical_name: "triethanolamine",
    aliases: ["triethanolamine", "tea", "trolamine"],
    category: "ph_adjuster", risk_level: "low_risk", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Mild concern for nitrosamine formation; widely used at low %",
  },
  {
    canonical_name: "arginine",
    aliases: ["arginine", "l-arginine"],
    category: "ph_adjuster", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "disodium edta",
    aliases: ["disodium edta", "edta", "disodium ethylenediaminetetraacetate",
              "edetate disodium", "disodium edetate"],
    category: "chelating", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "tetrasodium edta",
    aliases: ["tetrasodium edta", "tetrasodium ethylenediaminetetraacetate"],
    category: "chelating", risk_level: "safe", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
  },
  {
    canonical_name: "sodium gluconate",
    aliases: ["sodium gluconate", "gluconate", "d-gluconic acid sodium salt"],
    category: "chelating", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },

  // ── ABSORBENTS / MINERALS ─────────────────────────────────────────────────────

  {
    canonical_name: "silica",
    aliases: ["silica", "silicon dioxide", "amorphous silica", "hydrated silica"],
    category: "absorbent", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "kaolin",
    aliases: ["kaolin", "china clay", "kaolin clay"],
    category: "absorbent", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
  {
    canonical_name: "talc",
    aliases: ["talc"],
    category: "absorbent", risk_level: "low_risk", flags: [],
    pregnancy_safe: "uncertain", confidence: "high",
    notes: "Cosmetic talc is asbestos-free; safe topically but avoid inhalation",
  },
  {
    canonical_name: "iron oxides",
    aliases: ["iron oxides", "ci 77499", "ci 77491", "ci 77492", "ci 77502"],
    category: "colorant", risk_level: "safe", flags: [],
    pregnancy_safe: true, confidence: "high",
  },
];
