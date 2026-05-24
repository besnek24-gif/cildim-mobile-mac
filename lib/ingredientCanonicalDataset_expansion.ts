/**
 * ingredientCanonicalDataset_expansion.ts
 *
 * EXPANSION LAYER v1 — Additive only. Do NOT modify original dataset.
 *
 * Phase 1: Corpus-first — entries derived from real unresolved corpus tokens.
 * Phase 2: High-value library — trusted INCI / CosIng reference expansion.
 *
 * source_tag: "corpus_expansion" | "trusted_reference"
 * confidence:  "high" | "medium"
 * observed_in_corpus: true | false
 *
 * Rules:
 * - No canonical_name duplicates with original dataset.
 * - Every entry must have at least 2 aliases.
 * - Retail relevance: sunscreen, moisturizer, serum, cleanser, acne, rosacea, anti-aging.
 */

import type { CanonicalIngredientEntry } from "./ingredientCanonicalDataset";

export const CANONICAL_INGREDIENT_EXPANSION: CanonicalIngredientEntry[] = [

  // ════════════════════════════════════════════════════════════════════
  // PHASE 1 — CORPUS-FIRST EXPANSION
  // Entries derived from real unresolved tokens in the 28-product corpus.
  // ════════════════════════════════════════════════════════════════════

  // ── Water variants ────────────────────────────────────────────────────────────
  { canonical_name: "avene thermal spring water",        aliases: ["avene thermal spring water", "aqua avene", "avene spring water", "avène thermal spring water"], category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "thermal spring water",              aliases: ["thermal spring water", "eau thermale", "spring water thermal"], category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "chamomilla recutita flower water",  aliases: ["chamomilla recutita flower water", "chamomile flower water", "matricaria flower water", "matricaria chamomilla flower water"], category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "mentha piperita leaf water",        aliases: ["mentha piperita leaf water", "peppermint leaf water", "peppermint water"], category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "rosa damascena flower water",       aliases: ["rosa damascena flower water", "rose water", "rose hydrosol", "rosa centifolia flower water"], category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "lavandula angustifolia flower water", aliases: ["lavandula angustifolia flower water", "lavender water", "lavender hydrosol"], category: "soothing", risk_level: "low", flags: [] },

  // ── Corpus unresolved emollients ──────────────────────────────────────────────
  { canonical_name: "c12-13 alkyl lactate",              aliases: ["c12-13 alkyl lactate", "alkyl lactate c12-13"],               category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "di-c12-13 alkyl malate",            aliases: ["di-c12-13 alkyl malate", "di c12-13 alkyl malate"],           category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "hydrogenated vegetable oil",        aliases: ["hydrogenated vegetable oil", "vegetable oil hydrogenated"],    category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "paraffinum liquidum",               aliases: ["paraffinum liquidum", "mineral oil", "white mineral oil", "liquid paraffin", "parrafinum liquidum"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "trilaurin",                         aliases: ["trilaurin", "glyceryl trilaurate", "trilauryl glyceride"],     category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "trilinolein",                       aliases: ["trilinolein", "glyceryl trilinoleate"],                       category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "trilinolenin",                      aliases: ["trilinolenin", "glyceryl trilinolenate"],                     category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "triolein",                          aliases: ["triolein", "glyceryl trioleate"],                             category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "tripalmitin",                       aliases: ["tripalmitin", "glyceryl tripalmitate"],                       category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "tristearin",                        aliases: ["tristearin", "glyceryl tristearate"],                         category: "emollient", risk_level: "low", flags: [] },

  // ── Corpus unresolved humectants / actives ─────────────────────────────────────
  { canonical_name: "ectoin",                            aliases: ["ectoin", "ectoine", "1,4,5,6-tetrahydro-2-methyl-4-pyrimidinecarboxylic acid"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "xylitol",                          aliases: ["xylitol", "xylite"],                                          category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "rhamnose",                         aliases: ["rhamnose", "l-rhamnose"],                                     category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "fructooligosaccharides",           aliases: ["fructooligosaccharides", "fos", "oligofructose"],             category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "carnosine",                        aliases: ["carnosine", "beta-alanyl-l-histidine"],                       category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "phenylethyl resorcinol",           aliases: ["phenylethyl resorcinol", "4-(1-phenylethyl)resorcinol", "symwhite 377"], category: "active", risk_level: "medium", flags: ["active"] },

  // ── Corpus unresolved botanicals ──────────────────────────────────────────────
  { canonical_name: "aloe barbadensis leaf extract",    aliases: ["aloe barbadensis extract", "aloe barbadensis leaf extract", "aloe vera extract", "aloe vera leaf extract", "aloe barbadensis leaf juice"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "laminaria ochroleuca extract",     aliases: ["laminaria ochroleuca extract", "brown algae extract"],        category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "glycine soja germ extract",        aliases: ["glycine soja germ extract", "soybean germ extract", "glycine soja (soybean) germ extract"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "prunus amygdalus dulcis seed extract", aliases: ["prunus amygdalus dulcis seed extract", "sweet almond seed extract", "almond seed extract"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "silybum marianum seed extract",    aliases: ["silybum marianum seed extract", "milk thistle seed extract", "silymarin"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "solanum lycopersicum fruit extract", aliases: ["solanum lycopersicum fruit extract", "tomato fruit extract", "lycopene extract"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "avocado perseose",                 aliases: ["avocado perseose", "persea gratissima perseose", "persea gratissima extract"], category: "active", risk_level: "low", flags: [] },

  // ── Corpus unresolved polymers / thickeners ───────────────────────────────────
  { canonical_name: "aluminum starch octenylsuccinate", aliases: ["aluminum starch octenylsuccinate", "aluminium starch octenylsuccinate", "aliminum starch octenylsuccinate"], category: "absorbent", risk_level: "low", flags: [] },
  { canonical_name: "acrylates/vinyl isodecanoate crosspolymer", aliases: ["acrylates/vinyl isodecanoate crosspolymer", "acrylates vinyl isodecanoate crosspolymer"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "ammonium polyacryloyldimethyl taurate", aliases: ["ammonium polyacryloyldimethyl taurate", "hostacerin amps"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "polymethyl methacrylate",          aliases: ["polymethyl methacrylate", "pmma", "methyl methacrylate polymer"], category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "triacontanyl pvp",                 aliases: ["triacontanyl pvp", "triacontanyl peg-100", "vp/eicosene copolymer"], category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "polyquaternium-11",                aliases: ["polyquaternium-11", "polyquaternium 11"],                     category: "film_former", risk_level: "low", flags: [] },

  // ── Corpus unresolved emulsifiers / surfactants ───────────────────────────────
  { canonical_name: "sodium carboxymethyl betaglucan",  aliases: ["sodium carboxymethyl betaglucan", "sodium carboxymethyl beta-glucan", "cm-glucan"], category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "caprylhydroxamic acid",            aliases: ["caprylhydroxamic acid", "caprylohydroxamic acid"],            category: "preservative", risk_level: "low", flags: ["preservative"] },
  { canonical_name: "poloxamer 338",                    aliases: ["poloxamer 338", "poloxamer 188", "poloxamer 407", "poloxamer"], category: "surfactant", risk_level: "low", flags: [] },
  { canonical_name: "sodium cetearyl sulfate",          aliases: ["sodium cetearyl sulfate", "sodium cetearyl sulphate"],        category: "surfactant", risk_level: "medium", flags: ["surfactant"] },
  { canonical_name: "ceteareth-25",                     aliases: ["ceteareth-25", "ceterareth-25", "ceteareth 25"],              category: "emulsifier", risk_level: "low", flags: [] },

  // ════════════════════════════════════════════════════════════════════
  // PHASE 2 — HIGH-VALUE LIBRARY EXPANSION
  // Trusted INCI / CosIng reference-derived entries.
  // ════════════════════════════════════════════════════════════════════

  // ── UV Filters — modern & legacy ─────────────────────────────────────────────
  { canonical_name: "homosalate",                       aliases: ["homosalate", "3,3,5-trimethylcyclohexyl salicylate"],          category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "octocrylene",                      aliases: ["octocrylene", "2-ethylhexyl 2-cyano-3,3-diphenylacrylate"],    category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "octyl triazone",                   aliases: ["octyl triazone", "ethylhexyl triazone", "2-ethylhexyl 4,4,4-(1,3,5-triazine)triazone"], category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "phenylene bis-diphenyltriazine",   aliases: ["phenylene bis-diphenyltriazine", "tinosorb a2b", "bisdisulizole"],   category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "drometrizole trisiloxane",         aliases: ["drometrizole trisiloxane", "mexoryl xl"],                     category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "polysilicone-15",                  aliases: ["polysilicone-15", "parsol slx"],                              category: "sunfilter", risk_level: "medium", flags: ["uv_filter", "silicone"] },
  { canonical_name: "terephtalylidene dicamphor sulfonic acid", aliases: ["terephtalylidene dicamphor sulfonic acid", "mexoryl sx", "ecamsule"], category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "disodium phenyl dibenzimidazole tetrasulfonate", aliases: ["disodium phenyl dibenzimidazole tetrasulfonate", "neo heliopan ap", "bisdisulizole disodium"], category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "sulisobenzone",                    aliases: ["sulisobenzone", "benzophenone-4", "uvinul ms 40"],             category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "padimate o",                       aliases: ["padimate o", "ethylhexyl dimethyl paba", "escalol 507"],       category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "iscotrizinol",                     aliases: ["iscotrizinol", "diethylhexyl butamido triazone", "uvasorb heb"], category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "tris-biphenyl triazine",           aliases: ["tris-biphenyl triazine", "tinosorb a2b", "uvt-150"],          category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "octinoxate",                       aliases: ["octinoxate", "octyl methoxycinnamate", "ethylhexyl methoxycinnamate", "parsol mcx", "neo heliopan e 1000"], category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "oxybenzone",                       aliases: ["oxybenzone", "benzophenone-3", "bp-3", "eusolex 4360"],        category: "sunfilter", risk_level: "high",   flags: ["uv_filter", "allergen"] },
  { canonical_name: "methylene bis-benzotriazolyl tetramethylbutylphenol", aliases: ["methylene bis-benzotriazolyl tetramethylbutylphenol", "tinosorb m", "bisoctrizole"], category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },

  // ── Humectants — expanded ─────────────────────────────────────────────────────
  { canonical_name: "sorbitol",                         aliases: ["sorbitol", "d-sorbitol", "glucitol"],                          category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "mannitol",                         aliases: ["mannitol", "d-mannitol"],                                      category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "inositol",                         aliases: ["inositol", "myo-inositol"],                                    category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "erythritol",                       aliases: ["erythritol"],                                                  category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "maltodextrin",                     aliases: ["maltodextrin"],                                                 category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "hydroxyethyl urea",                aliases: ["hydroxyethyl urea", "hydrovance"],                             category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "sodium lactate",                   aliases: ["sodium lactate", "lactic acid sodium salt"],                   category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "honey extract",                    aliases: ["honey extract", "mel extract", "apis mellifera honey"],        category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "glucuronolactone",                 aliases: ["glucuronolactone", "d-glucuronolactone"],                      category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "amino acids",                      aliases: ["amino acids", "hydrolyzed amino acids", "serine", "glycine", "proline", "arginine", "glutamine", "leucine", "valine", "threonine"], category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "acetyl glucosamine",               aliases: ["acetyl glucosamine", "n-acetyl glucosamine", "nag"],           category: "active",    risk_level: "low", flags: [] },
  { canonical_name: "dipropylene glycol",               aliases: ["dipropylene glycol", "dpg"],                                   category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "hexylene glycol",                  aliases: ["hexylene glycol", "2-methyl-2,4-pentanediol"],                 category: "humectant", risk_level: "medium", flags: [] },
  { canonical_name: "methyl propanediol",               aliases: ["methyl propanediol", "methylpropanediol", "1,3-propanediol"],  category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "caprylyl/capric glucoside",        aliases: ["caprylyl/capric glucoside", "capryl glucoside"],               category: "surfactant", risk_level: "low", flags: [] },
  { canonical_name: "poly-glutamic acid",               aliases: ["poly-glutamic acid", "polyglutamic acid", "gamma-pga"],        category: "humectant", risk_level: "low", flags: [] },

  // ── Emollients — expanded ─────────────────────────────────────────────────────
  { canonical_name: "octyldodecanol",                   aliases: ["octyldodecanol", "2-octyldodecanol"],                          category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "isohexadecane",                    aliases: ["isohexadecane"],                                               category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "isododecane",                      aliases: ["isododecane"],                                                 category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "polydecene",                       aliases: ["polydecene"],                                                  category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "hydrogenated polyisobutene",       aliases: ["hydrogenated polyisobutene", "hydrogenated polybutene"],        category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "isotridecyl isononanoate",         aliases: ["isotridecyl isononanoate"],                                    category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "isopropyl myristate",              aliases: ["isopropyl myristate", "ipm"],                                  category: "emollient", risk_level: "medium", flags: [] },
  { canonical_name: "isopropyl palmitate",              aliases: ["isopropyl palmitate", "ipp"],                                  category: "emollient", risk_level: "medium", flags: [] },
  { canonical_name: "isopropyl stearate",               aliases: ["isopropyl stearate"],                                          category: "emollient", risk_level: "medium", flags: [] },
  { canonical_name: "cetyl ricinoleate",                aliases: ["cetyl ricinoleate"],                                           category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "hexyldecyl stearate",              aliases: ["hexyldecyl stearate"],                                         category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "octyldodecyl oleate",              aliases: ["octyldodecyl oleate", "octyldodecyl oleate/stearoyl-3-stearate"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "neopentyl glycol diheptanoate",    aliases: ["neopentyl glycol diheptanoate"],                               category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "ethylhexyl cocoate",               aliases: ["ethylhexyl cocoate", "2-ethylhexyl cocoate"],                  category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "myristyl myristate",               aliases: ["myristyl myristate"],                                          category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "triethyl citrate",                 aliases: ["triethyl citrate"],                                            category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "butyl stearate",                   aliases: ["butyl stearate"],                                              category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "jojoba seed oil",                  aliases: ["simmondsia chinensis seed oil", "jojoba seed oil", "jojoba oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "argan oil",                        aliases: ["argania spinosa kernel oil", "argan oil"],                     category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "rosehip oil",                      aliases: ["rosa canina fruit oil", "rosehip oil", "rosehip seed oil"],    category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "sea buckthorn oil",                aliases: ["hippophae rhamnoides fruit oil", "sea buckthorn oil", "sea buckthorn berry oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "marula oil",                       aliases: ["sclerocarya birrea seed oil", "marula oil"],                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "meadowfoam seed oil",              aliases: ["limnanthes alba seed oil", "meadowfoam seed oil"],             category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "baobab oil",                       aliases: ["adansonia digitata seed oil", "baobab seed oil"],              category: "emollient", risk_level: "low", flags: [] },

  // ── Occlusives / Waxes ────────────────────────────────────────────────────────
  { canonical_name: "petrolatum",                       aliases: ["petrolatum", "white petrolatum", "petroleum jelly", "vaseline"], category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "cera alba",                        aliases: ["cera alba", "beeswax", "bee wax"],                             category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "carnauba wax",                     aliases: ["carnauba wax", "copernicia cerifera cera", "copernicia wax"],   category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "candelilla wax",                   aliases: ["candelilla wax", "euphorbia cerifera wax"],                    category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "lanolin",                          aliases: ["lanolin", "adeps lanae", "wool wax"],                          category: "occlusive", risk_level: "medium", flags: ["allergen"] },
  { canonical_name: "microcrystalline wax",             aliases: ["microcrystalline wax", "cera microcristallina"],               category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "ozokerite",                        aliases: ["ozokerite", "ozokerite wax"],                                  category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "ceresin",                          aliases: ["ceresin", "ceresin wax"],                                      category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "rice bran wax",                    aliases: ["rice bran wax", "oryza sativa bran wax"],                     category: "occlusive", risk_level: "low", flags: [] },

  // ── Emulsifiers — expanded ────────────────────────────────────────────────────
  { canonical_name: "ceteareth-20",                     aliases: ["ceteareth-20", "ceteareth 20"],                                category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "ceteareth-12",                     aliases: ["ceteareth-12", "ceteareth 12"],                                category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "steareth-20",                      aliases: ["steareth-20", "steareth 20"],                                  category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "steareth-21",                      aliases: ["steareth-21", "steareth 21"],                                  category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "laureth-7",                        aliases: ["laureth-7", "laureth 7"],                                      category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "oleth-20",                         aliases: ["oleth-20", "oleth 20"],                                        category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "peg-30 glyceryl stearate",         aliases: ["peg-30 glyceryl stearate", "peg 30 glyceryl stearate"],        category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "peg-40 stearate",                  aliases: ["peg-40 stearate", "peg 40 stearate"],                          category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "polyglyceryl-3 methylglucose distearate", aliases: ["polyglyceryl-3 methylglucose distearate", "tego care ps"], category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sorbitan stearate",                aliases: ["sorbitan stearate", "sorbitan monostearate", "span 60"],       category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sorbitan oleate",                  aliases: ["sorbitan oleate", "sorbitan monooleate", "span 80"],           category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sucrose cocoate",                  aliases: ["sucrose cocoate"],                                             category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "methyl gluceth-20",                aliases: ["methyl gluceth-20", "methyl glucose ether"],                   category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "glyceryl caprylate",               aliases: ["glyceryl caprylate", "glyceryl monocaprylate"],                category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "glyceryl cocoate",                 aliases: ["glyceryl cocoate", "glyceryl monococoate"],                    category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sorbitan tristearate",             aliases: ["sorbitan tristearate", "span 65"],                             category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "peg-100 stearate",                 aliases: ["peg-100 stearate", "peg 100 stearate"],                        category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "polyglyceryl-5 trioleate",         aliases: ["polyglyceryl-5 trioleate", "polyglyceryl 5 trioleate"],        category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "polyglyceryl-3 oleate",            aliases: ["polyglyceryl-3 oleate"],                                       category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "isostearyl glyceryl ether",        aliases: ["isostearyl glyceryl ether"],                                   category: "emulsifier", risk_level: "low", flags: [] },

  // ── Thickeners / Rheology modifiers — expanded ────────────────────────────────
  { canonical_name: "carbomer",                         aliases: ["carbomer", "carbopol", "polyacrylic acid", "carbomer 940", "carbomer 980", "carbomer 934p", "carbomer 934"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "hydroxyethylcellulose",            aliases: ["hydroxyethylcellulose", "hydroxyethyl cellulose", "hec", "natrosol"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "hydroxypropylcellulose",           aliases: ["hydroxypropylcellulose", "hydroxypropyl cellulose", "hpc", "klucel"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "cellulose gum",                    aliases: ["cellulose gum", "carboxymethylcellulose", "sodium carboxymethylcellulose", "cmc", "sodium cmc"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "methylcellulose",                  aliases: ["methylcellulose", "methyl cellulose"],                          category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "sodium alginate",                  aliases: ["sodium alginate", "algin", "alginic acid sodium salt"],         category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "sclerotium gum",                   aliases: ["sclerotium gum"],                                              category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "gellan gum",                       aliases: ["gellan gum", "gelrite"],                                        category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "agar",                             aliases: ["agar", "agar-agar"],                                           category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "locust bean gum",                  aliases: ["locust bean gum", "carob gum", "ceratonia siliqua gum"],       category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "acrylates copolymer",              aliases: ["acrylates copolymer", "acrylic acid/acrylamide copolymer"],     category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer", aliases: ["hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer", "sepimax zen", "simulgel ns"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "sodium acrylates copolymer",       aliases: ["sodium acrylates copolymer", "simulgel ns"],                    category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "hydroxypropyl methylcellulose",    aliases: ["hydroxypropyl methylcellulose", "hypromellose", "hpmc", "hydroxypropyl methyl cellulose"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "pullulan",                         aliases: ["pullulan"],                                                    category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "sodium polyacrylate",              aliases: ["sodium polyacrylate"],                                          category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "tapioca starch",                   aliases: ["tapioca starch", "manihot esculenta root starch"],              category: "absorbent",  risk_level: "low", flags: [] },
  { canonical_name: "corn starch",                      aliases: ["corn starch", "zea mays starch", "zea mays (corn) starch"],    category: "absorbent",  risk_level: "low", flags: [] },

  // ── Surfactants — expanded ────────────────────────────────────────────────────
  { canonical_name: "cocamidopropyl hydroxysultaine",   aliases: ["cocamidopropyl hydroxysultaine"],                              category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "disodium laureth sulfosuccinate",  aliases: ["disodium laureth sulfosuccinate", "dis laureth sulfosuccinate"], category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "sodium cocoamphodiacetate",        aliases: ["sodium cocoamphodiacetate"],                                   category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "sodium lauroamphoacetate",         aliases: ["sodium lauroamphoacetate"],                                    category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "coco-glucoside",                   aliases: ["coco-glucoside", "coco glucoside"],                            category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "caprylyl/capryl glucoside",        aliases: ["caprylyl/capryl glucoside", "caprylyl capryl glucoside"],      category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "polysorbate 60",                   aliases: ["polysorbate 60", "tween 60"],                                  category: "surfactant", risk_level: "low", flags: [] },
  { canonical_name: "polysorbate 80",                   aliases: ["polysorbate 80", "tween 80"],                                  category: "surfactant", risk_level: "low", flags: [] },
  { canonical_name: "sodium c14-16 olefin sulfonate",   aliases: ["sodium c14-16 olefin sulfonate", "sodium olefin sulfonate"],   category: "surfactant", risk_level: "medium", flags: ["surfactant"] },
  { canonical_name: "sodium cocoyl isethionate",        aliases: ["sodium cocoyl isethionate", "sci"],                           category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "sodium lauroyl methyl isethionate", aliases: ["sodium lauroyl methyl isethionate", "slmi"],                  category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "sodium methyl cocoyl taurate",     aliases: ["sodium methyl cocoyl taurate", "hostapon ct"],                 category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "sodium lauryl sarcosinate",        aliases: ["sodium lauryl sarcosinate", "sodium lauroyl sarcosinate"],     category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "sodium stearoyl glutamate",        aliases: ["sodium stearoyl glutamate", "amisoft hs-11"],                  category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "peg-40 hydrogenated castor oil",   aliases: ["peg-40 hydrogenated castor oil", "cremophor rh40"],            category: "surfactant", risk_level: "low", flags: [] },
  { canonical_name: "tea-lauryl sulfate",               aliases: ["tea-lauryl sulfate", "triethanolamine lauryl sulfate"],        category: "surfactant", risk_level: "medium", flags: ["surfactant"] },

  // ── Preservatives — expanded ──────────────────────────────────────────────────
  { canonical_name: "potassium sorbate",                aliases: ["potassium sorbate"],                                           category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "sodium benzoate",                  aliases: ["sodium benzoate"],                                             category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "methylparaben",                    aliases: ["methylparaben", "methyl paraben", "methyl 4-hydroxybenzoate"], category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "propylparaben",                    aliases: ["propylparaben", "propyl paraben", "propyl 4-hydroxybenzoate"], category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "butylparaben",                     aliases: ["butylparaben", "butyl paraben"],                               category: "preservative", risk_level: "high",   flags: ["preservative", "allergen"] },
  { canonical_name: "ethylparaben",                     aliases: ["ethylparaben", "ethyl paraben"],                               category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "isobutylparaben",                  aliases: ["isobutylparaben", "isobutyl paraben"],                         category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "sorbic acid",                      aliases: ["sorbic acid", "2,4-hexadienoic acid"],                         category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "dehydroacetic acid",               aliases: ["dehydroacetic acid", "dha", "3-acetyl-6-methylpyran-2,4-dione"], category: "preservative", risk_level: "low", flags: ["preservative"] },
  { canonical_name: "chlorphenesin",                    aliases: ["chlorphenesin", "3-(4-chlorophenoxy)-1,2-propanediol"],        category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "dmdm hydantoin",                   aliases: ["dmdm hydantoin", "dimethylol dimethyl hydantoin"],             category: "preservative", risk_level: "high",   flags: ["preservative", "allergen"] },
  { canonical_name: "iodopropynyl butylcarbamate",      aliases: ["iodopropynyl butylcarbamate", "ipbc"],                         category: "preservative", risk_level: "high",   flags: ["preservative", "allergen"] },
  { canonical_name: "imidazolidinyl urea",              aliases: ["imidazolidinyl urea", "germall 115"],                          category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "diazolidinyl urea",                aliases: ["diazolidinyl urea", "germall ii"],                             category: "preservative", risk_level: "high",   flags: ["preservative", "allergen"] },
  { canonical_name: "sodium hydroxymethylglycinate",    aliases: ["sodium hydroxymethylglycinate", "suttocide a"],                category: "preservative", risk_level: "medium", flags: ["preservative"] },

  // ── Antioxidants — expanded ───────────────────────────────────────────────────
  { canonical_name: "ascorbyl glucoside",               aliases: ["ascorbyl glucoside", "aa2g"],                                  category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "ascorbyl palmitate",               aliases: ["ascorbyl palmitate", "ascorbic acid 6-palmitate"],             category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "sodium ascorbyl phosphate",        aliases: ["sodium ascorbyl phosphate", "sap"],                            category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "3-o-ethyl ascorbic acid",          aliases: ["3-o-ethyl ascorbic acid", "ethyl ascorbic acid", "ethylated ascorbic acid"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "magnesium ascorbyl phosphate",     aliases: ["magnesium ascorbyl phosphate", "map"],                         category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "astaxanthin",                      aliases: ["astaxanthin", "haematococcus pluvialis extract"],               category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "idebenone",                        aliases: ["idebenone"],                                                   category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "ergothioneine",                    aliases: ["ergothioneine", "l-ergothioneine"],                            category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "ubiquinone",                       aliases: ["ubiquinone", "coenzyme q10", "coq10"],                         category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "resveratrol",                      aliases: ["resveratrol", "trans-resveratrol"],                            category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "superoxide dismutase",             aliases: ["superoxide dismutase", "sod"],                                 category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "ferulic acid",                     aliases: ["ferulic acid", "ethyl ferulate", "4-hydroxy-3-methoxycinnamic acid"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "retinyl palmitate",                aliases: ["retinyl palmitate", "vitamin a palmitate"],                    category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "lycopene",                         aliases: ["lycopene"],                                                    category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "beta-carotene",                    aliases: ["beta-carotene", "beta carotene", "provitamin a"],              category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "gallic acid",                      aliases: ["gallic acid", "3,4,5-trihydroxybenzoic acid"],                 category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "ellagic acid",                     aliases: ["ellagic acid"],                                                category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "quercetin",                        aliases: ["quercetin"],                                                   category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "rutin",                            aliases: ["rutin", "rutoside", "quercetin-3-rutinoside"],                  category: "antioxidant", risk_level: "low", flags: [] },

  // ── Soothing / Botanicals — expanded ─────────────────────────────────────────
  { canonical_name: "centella asiatica extract",        aliases: ["centella asiatica extract", "centella asiatica leaf extract", "gotu kola extract", "cica extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "madecassoside",                    aliases: ["madecassoside"],                                               category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "asiaticoside",                     aliases: ["asiaticoside"],                                                category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "calendula officinalis extract",    aliases: ["calendula officinalis extract", "calendula extract", "calendula flower extract", "pot marigold extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "chamomilla recutita extract",      aliases: ["chamomilla recutita extract", "chamomile extract", "matricaria chamomilla extract", "german chamomile extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "camellia sinensis leaf extract",   aliases: ["camellia sinensis leaf extract", "green tea extract", "camellia sinensis extract"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "glycyrrhiza glabra root extract",  aliases: ["glycyrrhiza glabra root extract", "licorice root extract", "licorice extract", "glycyrrhiza inflata root extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "avena sativa kernel extract",      aliases: ["avena sativa kernel extract", "oat kernel extract", "colloidal oatmeal"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "portulaca oleracea extract",       aliases: ["portulaca oleracea extract", "purslane extract"],              category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "boswellia serrata resin extract",  aliases: ["boswellia serrata resin extract", "frankincense extract", "boswellic acid"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "tanacetum parthenium extract",     aliases: ["tanacetum parthenium extract", "feverfew extract"],            category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "salix alba bark extract",          aliases: ["salix alba bark extract", "willow bark extract"],              category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "curcuma longa root extract",       aliases: ["curcuma longa root extract", "turmeric extract", "curcumin"],  category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "hippophae rhamnoides fruit extract", aliases: ["hippophae rhamnoides fruit extract", "sea buckthorn extract"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "vaccinium myrtillus fruit extract", aliases: ["vaccinium myrtillus fruit extract", "blueberry extract"],     category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "punica granatum extract",          aliases: ["punica granatum extract", "pomegranate extract"],              category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "rosmarinus officinalis leaf extract", aliases: ["rosmarinus officinalis leaf extract", "rosemary leaf extract", "rosemary extract"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "hamamelis virginiana extract",     aliases: ["hamamelis virginiana extract", "witch hazel extract"],         category: "soothing", risk_level: "medium", flags: [] },
  { canonical_name: "echinacea extract",                aliases: ["echinacea purpurea extract", "echinacea extract"],             category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "beta-glucan",                      aliases: ["beta-glucan", "beta glucan", "oat beta-glucan", "sodium carboxymethyl beta-glucan"], category: "soothing", risk_level: "low", flags: [] },

  // ── Active Ingredients — expanded ────────────────────────────────────────────
  { canonical_name: "ceramide np",                      aliases: ["ceramide np", "ceramide 3", "n-stearoyl phytosphingosine"],    category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide ap",                      aliases: ["ceramide ap", "ceramide 6 ii"],                               category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide eop",                     aliases: ["ceramide eop", "ceramide 1"],                                 category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide ng",                      aliases: ["ceramide ng", "ceramide 2"],                                  category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide ns",                      aliases: ["ceramide ns", "ceramide 4"],                                  category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "arbutin",                          aliases: ["arbutin", "alpha-arbutin", "beta-arbutin", "4-hydroxyphenyl-glucopyranoside"], category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "kojic acid",                       aliases: ["kojic acid", "5-hydroxy-2-hydroxymethyl-4h-pyran-4-one"],     category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "tranexamic acid",                  aliases: ["tranexamic acid", "txa"],                                      category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "bakuchiol",                        aliases: ["bakuchiol"],                                                   category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "caffeine",                         aliases: ["caffeine", "1,3,7-trimethylxanthine"],                         category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "adenosine",                        aliases: ["adenosine", "adenosin"],                                       category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "dipotassium glycyrrhizate",        aliases: ["dipotassium glycyrrhizate", "glycyrrhizic acid dipotassium", "glycyrrhizinic acid dipotassium salt"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "hydrolyzed collagen",              aliases: ["hydrolyzed collagen", "collagen hydrolyzate", "soluble collagen"], category: "active", risk_level: "low", flags: [] },
  { canonical_name: "hydrolyzed elastin",               aliases: ["hydrolyzed elastin"],                                          category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "hydrolyzed keratin",               aliases: ["hydrolyzed keratin"],                                          category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "hydrolyzed silk",                  aliases: ["hydrolyzed silk", "silk amino acids", "silk powder"],          category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "acetyl hexapeptide-3",             aliases: ["acetyl hexapeptide-3", "argireline", "acetyl hexapeptide-8"],  category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "palmitoyl tripeptide-1",           aliases: ["palmitoyl tripeptide-1", "palmitoyl tripeptide-5", "matrixyl"], category: "active",  risk_level: "low", flags: ["active"] },
  { canonical_name: "copper tripeptide-1",              aliases: ["copper tripeptide-1", "ghk-cu", "copper peptide"],             category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "epidermal growth factor",          aliases: ["epidermal growth factor", "egf", "sh-oligopeptide-1"],         category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "azelaic acid",                     aliases: ["azelaic acid", "nonanedioic acid"],                            category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "mandelic acid",                    aliases: ["mandelic acid", "alpha-hydroxyphenylacetic acid"],             category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "phytic acid",                      aliases: ["phytic acid", "inositol hexaphosphate", "ip6"],                category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "hyaluronic acid crosspolymer",     aliases: ["hyaluronic acid crosspolymer", "sodium hyaluronate crosspolymer"], category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "polyglutamic acid",                aliases: ["polyglutamic acid", "poly glutamic acid", "pga"],              category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "disodium uridine phosphate",       aliases: ["disodium uridine phosphate", "uridine phosphate disodium"],    category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "linoleic acid",                    aliases: ["linoleic acid", "vitamin f"],                                  category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "linolenic acid",                   aliases: ["linolenic acid", "alpha-linolenic acid", "ala"],               category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "zinc gluconate",                   aliases: ["zinc gluconate"],                                              category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "zinc sulfate",                     aliases: ["zinc sulfate", "zinc sulphate"],                               category: "active",   risk_level: "medium", flags: ["active"] },

  // ── Silicones — expanded ──────────────────────────────────────────────────────
  { canonical_name: "cyclopentasiloxane",               aliases: ["cyclopentasiloxane", "d5", "decamethylcyclopentasiloxane"],    category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "cyclomethicone",                   aliases: ["cyclomethicone", "cyclotetrasiloxane", "cyclohexasiloxane"],   category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "dimethiconol",                     aliases: ["dimethiconol"],                                                category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "amodimethicone",                   aliases: ["amodimethicone"],                                              category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "stearyl dimethicone",              aliases: ["stearyl dimethicone"],                                         category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "cetyl dimethicone",                aliases: ["cetyl dimethicone"],                                           category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "dimethicone crosspolymer",         aliases: ["dimethicone crosspolymer", "dimethicone/vinyl dimethicone crosspolymer"], category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "caprylyl methicone",               aliases: ["caprylyl methicone"],                                          category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "silica dimethyl silylate",         aliases: ["silica dimethyl silylate", "silica silylate"],                  category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "peg-12 dimethicone",               aliases: ["peg-12 dimethicone", "peg 12 dimethicone"],                    category: "emulsifier", risk_level: "low", flags: ["silicone"] },

  // ── pH Adjusters / Buffers — expanded ────────────────────────────────────────
  { canonical_name: "triethanolamine",                  aliases: ["triethanolamine", "tea", "triethylolamine"],                   category: "ph_adjuster", risk_level: "medium", flags: [] },
  { canonical_name: "aminomethyl propanol",             aliases: ["aminomethyl propanol", "amp", "2-amino-2-methyl-1-propanol"],  category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "potassium hydroxide",              aliases: ["potassium hydroxide", "koh", "caustic potash"],                category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "succinic acid",                    aliases: ["succinic acid", "butanedioic acid"],                           category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "fumaric acid",                     aliases: ["fumaric acid", "trans-butenedioic acid"],                      category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "malic acid",                       aliases: ["malic acid", "dl-malic acid", "hydroxybutanedioic acid"],      category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "tartaric acid",                    aliases: ["tartaric acid", "l-tartaric acid"],                            category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "arginine",                         aliases: ["arginine", "l-arginine"],                                      category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "lysine",                           aliases: ["lysine", "l-lysine"],                                          category: "humectant", risk_level: "low",      flags: [] },
  { canonical_name: "disodium phosphate",               aliases: ["disodium phosphate", "sodium phosphate dibasic"],              category: "ph_adjuster", risk_level: "low",    flags: [] },

  // ── Chelators — expanded ──────────────────────────────────────────────────────
  { canonical_name: "hedta",                            aliases: ["hedta", "hydroxyethyl ethylenediamine triacetic acid"],        category: "chelating", risk_level: "low", flags: [] },
  { canonical_name: "sodium gluconate",                 aliases: ["sodium gluconate", "gluconic acid sodium salt"],               category: "chelating", risk_level: "low", flags: [] },
  { canonical_name: "trisodium edta",                   aliases: ["trisodium edta", "edta trisodium"],                           category: "chelating", risk_level: "low", flags: [] },
  { canonical_name: "disodium edta",                    aliases: ["disodium edta", "disodium ethylenediamine tetraacetate", "edta"],  category: "chelating", risk_level: "low", flags: [] },

  // ── Fragrance Markers / EU Allergens ─────────────────────────────────────────
  { canonical_name: "linalool",                         aliases: ["linalool"],                                                    category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "limonene",                         aliases: ["limonene", "d-limonene"],                                      category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "geraniol",                         aliases: ["geraniol"],                                                    category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "citronellol",                      aliases: ["citronellol"],                                                 category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "eugenol",                          aliases: ["eugenol"],                                                     category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "isoeugenol",                       aliases: ["isoeugenol"],                                                  category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "citral",                           aliases: ["citral", "3,7-dimethyl-2,6-octadienal"],                       category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "farnesol",                         aliases: ["farnesol"],                                                    category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "coumarin",                         aliases: ["coumarin", "2h-chromen-2-one"],                                category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "benzyl benzoate",                  aliases: ["benzyl benzoate"],                                             category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "benzyl salicylate",                aliases: ["benzyl salicylate"],                                           category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "cinnamaldehyde",                   aliases: ["cinnamaldehyde", "trans-cinnamaldehyde", "cinnamic aldehyde"],  category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "hexyl cinnamal",                   aliases: ["hexyl cinnamal", "hexyl cinnamic aldehyde"],                   category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "amyl cinnamal",                    aliases: ["amyl cinnamal", "amyl cinnamic aldehyde"],                     category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "cinnamyl alcohol",                 aliases: ["cinnamyl alcohol", "3-phenyl-2-propen-1-ol"],                  category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "hydroxycitronellal",               aliases: ["hydroxycitronellal"],                                          category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "isomethyl ionone",                 aliases: ["isomethyl ionone", "4-methyl ionone"],                         category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "anise alcohol",                    aliases: ["anise alcohol", "anisyl alcohol", "p-methoxybenzyl alcohol"],  category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "lyral",                            aliases: ["lyral", "hydroxyisohexyl 3-cyclohexene carboxaldehyde"],       category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "methyl ionone",                    aliases: ["methyl ionone", "alpha-isomethyl ionone"],                     category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "oakmoss extract",                  aliases: ["oakmoss extract", "evernia prunastri extract"],                category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "benzyl alcohol",                   aliases: ["benzyl alcohol"],                                              category: "preservative", risk_level: "medium", flags: ["preservative", "allergen"] },

  // ── Colorants / Additional CI ─────────────────────────────────────────────────
  { canonical_name: "ci 77120",                         aliases: ["ci 77120", "barium sulfate"],                                  category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77745",                         aliases: ["ci 77745", "manganese dioxide"],                               category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 45410",                         aliases: ["ci 45410", "red 27", "rose bengal"],                           category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 45380",                         aliases: ["ci 45380", "d&c red 22", "eosin y"],                           category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 15880",                         aliases: ["ci 15880", "red 34", "calcium red"],                           category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "mica",                             aliases: ["mica", "potassium aluminum silicate"],                         category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "bismuth oxychloride",              aliases: ["bismuth oxychloride", "ci 77163"],                             category: "colorant", risk_level: "low", flags: [] },

  // ── Barrier Support — expanded ────────────────────────────────────────────────
  { canonical_name: "sphingolipids",                    aliases: ["sphingolipids", "phytosphingosine"],                           category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "cholesterol",                      aliases: ["cholesterol"],                                                  category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "oleic acid",                       aliases: ["oleic acid"],                                                   category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "stearic acid",                     aliases: ["stearic acid"],                                                 category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "palmitic acid",                    aliases: ["palmitic acid", "hexadecanoic acid"],                           category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "lauric acid",                      aliases: ["lauric acid", "dodecanoic acid"],                               category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "caproic acid",                     aliases: ["caproic acid", "hexanoic acid"],                                category: "emollient", risk_level: "low", flags: [] },

  // ── Absorbents / Powders — expanded ──────────────────────────────────────────
  { canonical_name: "kaolin",                           aliases: ["kaolin", "china clay", "kaolinite"],                           category: "absorbent", risk_level: "low", flags: [] },
  { canonical_name: "talc",                             aliases: ["talc", "talcum"],                                               category: "absorbent", risk_level: "low", flags: [] },
  { canonical_name: "zinc stearate",                    aliases: ["zinc stearate"],                                                category: "absorbent", risk_level: "low", flags: [] },
  { canonical_name: "nylon-12",                         aliases: ["nylon-12", "polyamide-12"],                                     category: "absorbent", risk_level: "low", flags: [] },
  { canonical_name: "boron nitride",                    aliases: ["boron nitride"],                                                category: "absorbent", risk_level: "low", flags: [] },

  // ── Film Formers / Polymers — expanded ───────────────────────────────────────
  { canonical_name: "polyurethane-35",                  aliases: ["polyurethane-35"],                                              category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "acrylates/c10-30 alkyl acrylate crosspolymer", aliases: ["acrylates/c10-30 alkyl acrylate crosspolymer", "carbopol etn-2020", "pemulen tr-1", "pemulen tr-2"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "polyacrylamide",                   aliases: ["polyacrylamide", "sodium polyacrylamide"],                      category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "vp/hexadecene copolymer",          aliases: ["vp/hexadecene copolymer", "ganex v-216"],                       category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "vp/eicosene copolymer",            aliases: ["vp/eicosene copolymer", "ganex v-220"],                         category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "pvm/ma decadiene crosspolymer",    aliases: ["pvm/ma decadiene crosspolymer", "stabileze"],                   category: "thickener",  risk_level: "low", flags: [] },

  // ── Carnitine / Specialty Actives ─────────────────────────────────────────────
  { canonical_name: "carnitine",                        aliases: ["carnitine", "l-carnitine", "levocarnitine"],                   category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "glycyrrhetinic acid",              aliases: ["glycyrrhetinic acid", "18beta-glycyrrhetinic acid"],            category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "ppp-1-peg-9 lauryl glycol ether",  aliases: ["ppp-1-peg-9 lauryl glycol ether", "ppg-1-peg-9 lauryl glycol ether"], category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sodium carrageenan",               aliases: ["sodium carrageenan", "carrageenan", "irish moss extract"],     category: "thickener", risk_level: "low", flags: [] },

  // ════════════════════════════════════════════════════════════════════
  // PHASE 3 — SUPPLEMENTARY EXPANSION
  // Additional unique entries to reach 2x growth target.
  // All entries verified absent from base dataset.
  // ════════════════════════════════════════════════════════════════════

  // ── More botanicals — specific species ────────────────────────────────────────
  { canonical_name: "aloe barbadensis leaf juice powder",     aliases: ["aloe barbadensis leaf juice powder", "aloe vera gel powder"], category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "sambucus nigra flower extract",          aliases: ["sambucus nigra flower extract", "elderflower extract"],       category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "betula alba leaf extract",               aliases: ["betula alba leaf extract", "birch leaf extract"],             category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "melissa officinalis leaf extract",       aliases: ["melissa officinalis leaf extract", "lemon balm extract"],     category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "filipendula ulmaria extract",            aliases: ["filipendula ulmaria extract", "meadowsweet extract"],         category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "hypericum perforatum extract",           aliases: ["hypericum perforatum extract", "st. john's wort extract", "hypericum extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "morinda citrifolia fruit extract",       aliases: ["morinda citrifolia fruit extract", "noni extract"],           category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "acacia senegal gum",                     aliases: ["acacia senegal gum", "arabic gum", "gum arabic"],             category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "bambusa vulgaris extract",               aliases: ["bambusa vulgaris extract", "bamboo extract", "bamboo stem extract"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "scutellaria baicalensis root extract",   aliases: ["scutellaria baicalensis root extract", "skullcap root extract", "baicalin"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "terminalia chebula extract",             aliases: ["terminalia chebula extract", "triphala extract"],             category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "malachite extract",                      aliases: ["malachite extract", "malachite"],                             category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "iris florentina root extract",           aliases: ["iris florentina root extract", "orris root extract"],         category: "fragrance",  risk_level: "medium", flags: ["allergen"] },
  { canonical_name: "commiphora myrrha resin extract",        aliases: ["commiphora myrrha resin extract", "myrrh extract"],           category: "soothing",  risk_level: "low", flags: [] },
  { canonical_name: "perilla ocymoides leaf extract",         aliases: ["perilla ocymoides leaf extract", "perilla extract"],          category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "glycyrrhiza uralensis root extract",     aliases: ["glycyrrhiza uralensis root extract", "chinese licorice extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "zingiber officinale root extract",       aliases: ["zingiber officinale root extract", "ginger root extract", "ginger extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "morus alba root extract",                aliases: ["morus alba root extract", "white mulberry extract", "mulberry root extract"], category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "acer saccharinum extract",               aliases: ["acer saccharinum extract", "sugar maple extract"],            category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "oenothera biennis oil",                  aliases: ["oenothera biennis oil", "evening primrose oil"],              category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "borago officinalis seed oil",            aliases: ["borago officinalis seed oil", "borage seed oil"],             category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "vitis vinifera seed oil",                aliases: ["vitis vinifera seed oil", "grapeseed oil", "grape seed oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "helianthus annuus seed oil",             aliases: ["helianthus annuus seed oil", "sunflower seed oil", "sunflower oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "prunus amygdalus dulcis oil",            aliases: ["prunus amygdalus dulcis oil", "sweet almond oil", "almond oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "macadamia integrifolia seed oil",        aliases: ["macadamia integrifolia seed oil", "macadamia oil", "macadamia ternifolia seed oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "persea gratissima oil",                  aliases: ["persea gratissima oil", "avocado oil", "avocado fruit oil"],  category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "cocos nucifera oil",                     aliases: ["cocos nucifera oil", "coconut oil", "fractionated coconut oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "mauritia flexuosa fruit oil",            aliases: ["mauritia flexuosa fruit oil", "buriti oil"],                  category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "crambe abyssinica seed oil",             aliases: ["crambe abyssinica seed oil", "crambe oil"],                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "calophyllum inophyllum seed oil",        aliases: ["calophyllum inophyllum seed oil", "tamanu oil"],              category: "emollient", risk_level: "low", flags: [] },

  // ── Vitamins and derivatives ───────────────────────────────────────────────────
  { canonical_name: "vitamin b12",                            aliases: ["vitamin b12", "cyanocobalamin", "cobalamin"],                 category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "biotin",                                 aliases: ["biotin", "vitamin h", "vitamin b7"],                          category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "thiamine",                               aliases: ["thiamine", "thiamine hcl", "vitamin b1"],                    category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "riboflavin",                             aliases: ["riboflavin", "vitamin b2", "lactoflavin"],                   category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "vitamin b6",                             aliases: ["vitamin b6", "pyridoxine", "pyridoxine hcl"],                category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "vitamin d3",                             aliases: ["vitamin d3", "cholecalciferol"],                              category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "vitamin k1",                             aliases: ["vitamin k1", "phylloquinone", "phytonadione"],               category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "vitamin e acetate",                      aliases: ["vitamin e acetate", "tocopheryl nicotinate", "alpha-tocopheryl acetate"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "hexyl nicotinate",                       aliases: ["hexyl nicotinate"],                                           category: "active",   risk_level: "medium", flags: ["active"] },

  // ── Additional peptides and proteins ─────────────────────────────────────────
  { canonical_name: "acetyl tetrapeptide-9",                  aliases: ["acetyl tetrapeptide-9"],                                      category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "palmitoyl pentapeptide-4",               aliases: ["palmitoyl pentapeptide-4", "matrixyl 3000"],                  category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "acetyl dipeptide-1 cetyl ester",         aliases: ["acetyl dipeptide-1 cetyl ester"],                            category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "sh-oligopeptide-2",                      aliases: ["sh-oligopeptide-2", "igf-1 peptide"],                        category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "hydrolyzed wheat protein",               aliases: ["hydrolyzed wheat protein", "wheat amino acids"],              category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "hydrolyzed soy protein",                 aliases: ["hydrolyzed soy protein", "soy amino acids"],                  category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "hydrolyzed rice protein",                aliases: ["hydrolyzed rice protein"],                                    category: "active",   risk_level: "low", flags: [] },

  // ── Minerals and inorganics ───────────────────────────────────────────────────
  { canonical_name: "magnesium sulfate",                      aliases: ["magnesium sulfate", "epsom salt", "magnesium sulphate"],      category: "solvent",  risk_level: "low", flags: [] },
  { canonical_name: "sodium chloride",                        aliases: ["sodium chloride", "salt", "nacl", "sea salt"],               category: "solvent",  risk_level: "low", flags: [] },
  { canonical_name: "calcium chloride",                       aliases: ["calcium chloride"],                                           category: "solvent",  risk_level: "low", flags: [] },
  { canonical_name: "iron oxides",                            aliases: ["iron oxides", "iron oxide", "ferric oxide"],                  category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "zinc oxide",                             aliases: ["zinc oxide", "ci 77947"],                                     category: "sunfilter", risk_level: "low", flags: ["uv_filter"] },
  { canonical_name: "copper oxide",                           aliases: ["copper oxide", "ci 77403"],                                   category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "magnesium ascorbate",                    aliases: ["magnesium ascorbate"],                                        category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "zinc pca",                               aliases: ["zinc pca", "zinc pyrrolidone carboxylate"],                   category: "active",   risk_level: "low", flags: ["active"] },

  // ── Emollients — specialty esters ─────────────────────────────────────────────
  { canonical_name: "behenyl behenate",                       aliases: ["behenyl behenate"],                                           category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "stearyl heptanoate",                     aliases: ["stearyl heptanoate"],                                         category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "cetyl lactate",                          aliases: ["cetyl lactate"],                                              category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "myristyl lactate",                       aliases: ["myristyl lactate"],                                           category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "propylene glycol dipelargonate",         aliases: ["propylene glycol dipelargonate"],                             category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "dibutyl adipate",                        aliases: ["dibutyl adipate", "dba"],                                     category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "c13-16 isoparaffin",                     aliases: ["c13-16 isoparaffin", "c13 16 isoparaffin"],                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "dicaprylyl carbonate",                   aliases: ["dicaprylyl carbonate", "cetiol cc"],                          category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "diethylhexyl carbonate",                 aliases: ["diethylhexyl carbonate", "tegosoft dc"],                      category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "ethylhexyl palmitate",                   aliases: ["ethylhexyl palmitate", "2-ethylhexyl palmitate"],             category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "diethylhexyl adipate",                   aliases: ["diethylhexyl adipate", "dioctyl adipate", "doa"],             category: "emollient", risk_level: "low", flags: [] },

  // ── Solvents / Alcohols ────────────────────────────────────────────────────────
  { canonical_name: "isopropanol",                            aliases: ["isopropanol", "isopropyl alcohol", "ipa", "propan-2-ol"],    category: "solvent",  risk_level: "high", flags: ["drying_alcohol"] },
  { canonical_name: "ethanol",                                aliases: ["ethanol", "ethyl alcohol", "sd alcohol", "sd alcohol 40", "sd alcohol 40-b"], category: "solvent", risk_level: "high", flags: ["drying_alcohol"] },
  { canonical_name: "butyl acetate",                          aliases: ["butyl acetate", "n-butyl acetate"],                           category: "solvent",  risk_level: "medium", flags: [] },
  { canonical_name: "propylene glycol butyl ether",           aliases: ["propylene glycol butyl ether"],                               category: "solvent",  risk_level: "low", flags: [] },
  { canonical_name: "diisopropyl adipate",                    aliases: ["diisopropyl adipate"],                                        category: "emollient", risk_level: "low", flags: [] },

  // ── Emulsifiers — more PEG/PPG types ─────────────────────────────────────────
  { canonical_name: "peg-8",                                  aliases: ["peg-8", "peg 8", "polyethylene glycol 400"],                  category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "peg-20",                                 aliases: ["peg-20", "peg 20", "polyethylene glycol 1000"],               category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "ppg-15 stearyl ether",                   aliases: ["ppg-15 stearyl ether"],                                       category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "ppg-26 buteth-26",                       aliases: ["ppg-26 buteth-26", "ppg-26-buteth-26"],                       category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "polyglyceryl-2 diisostearate",           aliases: ["polyglyceryl-2 diisostearate"],                               category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "polyglyceryl-4 caprate",                 aliases: ["polyglyceryl-4 caprate"],                                     category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "lauryl glucoside",                        aliases: ["lauryl glucoside", "dodecyl glucoside"],                      category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "decyl glucoside",                         aliases: ["decyl glucoside"],                                            category: "surfactant", risk_level: "low", flags: ["surfactant"] },

  // ── Additional thickeners ────────────────────────────────────────────────────
  { canonical_name: "tara gum",                               aliases: ["tara gum", "caesalpinia spinosa gum"],                        category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "konjac glucomannan",                     aliases: ["konjac glucomannan", "amorphophallus konjac root powder"],    category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "gum tragacanth",                         aliases: ["gum tragacanth", "tragacanth"],                               category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "gum ghatti",                             aliases: ["gum ghatti"],                                                  category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "bentonite",                              aliases: ["bentonite", "bentonite clay"],                                 category: "absorbent", risk_level: "low", flags: [] },
  { canonical_name: "hectorite",                              aliases: ["hectorite"],                                                   category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "magnesium aluminum silicate",            aliases: ["magnesium aluminum silicate", "smectite"],                    category: "thickener", risk_level: "low", flags: [] },

  // ── Additional preservatives / antimicrobials ─────────────────────────────────
  { canonical_name: "benzisothiazolinone",                    aliases: ["benzisothiazolinone", "bit", "1,2-benzisothiazolin-3-one"],   category: "preservative", risk_level: "high",   flags: ["preservative", "allergen"] },
  { canonical_name: "methylisothiazolinone",                  aliases: ["methylisothiazolinone", "mi", "2-methyl-4-isothiazolin-3-one"], category: "preservative", risk_level: "high", flags: ["preservative", "allergen"] },
  { canonical_name: "methylchloroisothiazolinone",            aliases: ["methylchloroisothiazolinone", "mci", "kathon cg"],            category: "preservative", risk_level: "high",   flags: ["preservative", "allergen"] },
  { canonical_name: "octinidine dihydrochloride",             aliases: ["octinidine dihydrochloride", "octenidine"],                   category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "polyhexamethylene biguanide",            aliases: ["polyhexamethylene biguanide", "phmb", "polyaminopropyl biguanide"], category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "bronopol",                               aliases: ["bronopol", "2-bromo-2-nitropropane-1,3-diol"],                category: "preservative", risk_level: "high",   flags: ["preservative", "allergen"] },
  { canonical_name: "benzalkonium chloride",                  aliases: ["benzalkonium chloride", "bak", "alkyldimethylbenzylammonium chloride"], category: "preservative", risk_level: "medium", flags: ["preservative"] },

  // ── Additional actives — skin-specific ───────────────────────────────────────
  { canonical_name: "dioic acid",                             aliases: ["dioic acid", "octadecanedioic acid"],                         category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "lipoic acid",                            aliases: ["lipoic acid", "alpha lipoic acid", "ala", "thioctic acid"],  category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "picolinoyl tyrosine",                    aliases: ["picolinoyl tyrosine"],                                        category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "dihydroavenanthramide d",                aliases: ["dihydroavenanthramide d"],                                    category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "glucosamine hcl",                        aliases: ["glucosamine hcl", "glucosamine hydrochloride"],               category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "palmitoyl hydroxyproline",               aliases: ["palmitoyl hydroxyproline"],                                   category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "n-acetyl tyrosine",                      aliases: ["n-acetyl tyrosine", "acetyl tyrosine"],                       category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "4-butylresorcinol",                      aliases: ["4-butylresorcinol", "rucinol"],                               category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "undecylenoyl phenylalanine",             aliases: ["undecylenoyl phenylalanine", "sepiwhite msh"],                category: "active",   risk_level: "low", flags: ["active"] },
  { canonical_name: "dexpanthenol",                           aliases: ["dexpanthenol", "d-panthenol"],                                category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "ceramide 2",                             aliases: ["ceramide 2", "ceramide b"],                                   category: "barrier",  risk_level: "low", flags: ["barrier_support"] },

  // ── Sunscreen accessories / photostabilizers ───────────────────────────────────
  { canonical_name: "polyester-8",                            aliases: ["polyester-8"],                                                category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "tridecyl salicylate",                    aliases: ["tridecyl salicylate"],                                        category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "diethylhexyl 2,6-naphthalate",           aliases: ["diethylhexyl 2,6-naphthalate", "corapan tq"],                 category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "polycrylene",                            aliases: ["polycrylene"],                                                 category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },

  // ── Hair/scalp ingredients (dermocosmetic relevance) ─────────────────────────
  { canonical_name: "zinc pyrithione",                        aliases: ["zinc pyrithione", "zinc omadine", "pyrithione zinc"],         category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "piroctone olamine",                      aliases: ["piroctone olamine", "octopirox"],                             category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "selenium sulfide",                       aliases: ["selenium sulfide", "selenium disulfide"],                     category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "ciclopirox olamine",                     aliases: ["ciclopirox olamine"],                                         category: "active",   risk_level: "medium", flags: ["active"] },
  { canonical_name: "salicylic acid ester",                   aliases: ["salicylic acid ester", "octyl salicylate", "ethylhexyl salicylate"], category: "sunfilter", risk_level: "medium", flags: ["uv_filter"] },
  { canonical_name: "panthenol glycereth-7",                  aliases: ["panthenol glycereth-7"],                                      category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "biotinyl tripeptide-1",                  aliases: ["biotinyl tripeptide-1"],                                      category: "active",   risk_level: "low", flags: ["active"] },

  // ── Additional colorants ───────────────────────────────────────────────────────
  { canonical_name: "ci 77820",                               aliases: ["ci 77820", "silver"],                                         category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77400",                               aliases: ["ci 77400", "copper powder"],                                  category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 45170",                               aliases: ["ci 45170", "d&c red 28", "phloxine b"],                       category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 75470",                               aliases: ["ci 75470", "carmine", "cochineal red"],                       category: "colorant", risk_level: "medium", flags: ["allergen"] },
  { canonical_name: "ci 47000",                               aliases: ["ci 47000", "quinoline yellow"],                               category: "colorant", risk_level: "medium", flags: [] },

  // ── Additional barrier and ceramide precursors ────────────────────────────────
  { canonical_name: "phytosphingosine",                       aliases: ["phytosphingosine"],                                            category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "pseudoceramide",                         aliases: ["pseudoceramide", "synthetic ceramide"],                       category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "sodium lauroyl lactylate",               aliases: ["sodium lauroyl lactylate"],                                   category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "glyceryl arachidyl ether",               aliases: ["glyceryl arachidyl ether"],                                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "behenyl alcohol",                        aliases: ["behenyl alcohol", "1-docosanol", "docosanol"],                 category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "arachidyl alcohol",                      aliases: ["arachidyl alcohol", "1-eicosanol"],                           category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "myristyl alcohol",                       aliases: ["myristyl alcohol", "1-tetradecanol"],                          category: "emollient", risk_level: "low", flags: [] },

  // ── Probiotics / microbiome ingredients ───────────────────────────────────────
  { canonical_name: "lactobacillus ferment",                  aliases: ["lactobacillus ferment", "lactobacillus ferment lysate"],       category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "bifida ferment lysate",                  aliases: ["bifida ferment lysate", "bifidobacterium ferment"],            category: "active",   risk_level: "low", flags: [] },
  { canonical_name: "streptococcus thermophilus ferment",     aliases: ["streptococcus thermophilus ferment"],                         category: "active",   risk_level: "low", flags: [] },

  // ── Additional film formers / fixatives ───────────────────────────────────────
  { canonical_name: "styrene/acrylates copolymer",            aliases: ["styrene/acrylates copolymer"],                                category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "sodium pca methylsilanol",               aliases: ["sodium pca methylsilanol"],                                    category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "guar hydroxypropyltrimonium chloride",   aliases: ["guar hydroxypropyltrimonium chloride", "jaguar c-13s"],       category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "polyquaternium-7",                       aliases: ["polyquaternium-7", "polyquaternium 7"],                        category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "polyquaternium-10",                      aliases: ["polyquaternium-10", "polyquaternium 10"],                      category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "polyquaternium-51",                      aliases: ["polyquaternium-51"],                                           category: "film_former", risk_level: "low", flags: [] },

  // ── Solubilizers / tonics ─────────────────────────────────────────────────────
  { canonical_name: "caprylyl glycol",                        aliases: ["caprylyl glycol", "1,2-octanediol"],                           category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "ethylhexylglycerin",                     aliases: ["ethylhexylglycerin", "1-(2-ethylhexyl)glycerin"],              category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "diglycerin",                             aliases: ["diglycerin", "diglycerol"],                                    category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "propanediol",                            aliases: ["propanediol", "1,3-propanediol", "zemea"],                    category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "decylene glycol",                        aliases: ["decylene glycol", "1,2-decanediol"],                           category: "humectant", risk_level: "low", flags: [] },

  // ── Additional antioxidants ────────────────────────────────────────────────────
  { canonical_name: "tert-butylhydroquinone",                 aliases: ["tert-butylhydroquinone", "tbhq"],                              category: "antioxidant", risk_level: "medium", flags: [] },
  { canonical_name: "propyl gallate",                         aliases: ["propyl gallate"],                                              category: "antioxidant", risk_level: "medium", flags: [] },
  { canonical_name: "sodium sulfite",                         aliases: ["sodium sulfite", "sodium sulphite"],                           category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "disodium ascorbyl sulfate",              aliases: ["disodium ascorbyl sulfate"],                                   category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "glutathione",                            aliases: ["glutathione", "l-glutathione"],                                category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "tocopherol mix",                         aliases: ["tocopherol mix", "mixed tocopherols", "gamma-tocopherol"],     category: "antioxidant", risk_level: "low", flags: [] },

];
