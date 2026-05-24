/**
 * ingredientCanonicalDataset.ts
 *
 * SINGLE SOURCE OF TRUTH for ingredient data in the mobile app.
 * This file mirrors artifacts/api-server/src/lib/ingredientLibraryV2.ts.
 *
 * When the API server library is updated, sync this file to match.
 * Do NOT hand-edit entries here — update the API server source and re-sync.
 *
 * Last synced from: ingredientLibraryV2.ts (151 entries)
 */

export interface CanonicalIngredientEntry {
  canonical_name: string;
  aliases: string[];
  category: string;
  risk_level: "low" | "medium" | "high" | "unknown";
  flags: string[];
}

export const CANONICAL_INGREDIENT_DATASET: CanonicalIngredientEntry[] = [
  // ── Solvent / base ──────────────────────────────────────────────────────────
  { canonical_name: "water",           aliases: ["aqua", "water", "eau"],                category: "solvent",   risk_level: "low",    flags: [] },
  { canonical_name: "alcohol denat.",  aliases: ["alcohol denat", "alcohol denat.", "denatured alcohol"], category: "solvent", risk_level: "high", flags: ["drying_alcohol"] },

  // ── Humectants ───────────────────────────────────────────────────────────────
  { canonical_name: "glycerin",             aliases: ["glycerin", "glycerine", "glycerol"],                              category: "humectant", risk_level: "low",    flags: [] },
  { canonical_name: "sodium hyaluronate",   aliases: ["sodium hyaluronate"],                                             category: "humectant", risk_level: "low",    flags: [] },
  { canonical_name: "hyaluronic acid",      aliases: ["hyaluronic acid"],                                                category: "humectant", risk_level: "low",    flags: [] },
  { canonical_name: "butylene glycol",      aliases: ["butylene glycol", "1,3-butylene glycol", "1,3-butanediol"],      category: "humectant", risk_level: "medium", flags: [] },
  { canonical_name: "propylene glycol",     aliases: ["propylene glycol", "1,2-propanediol"],                           category: "humectant", risk_level: "medium", flags: [] },
  { canonical_name: "pentylene glycol",     aliases: ["pentylene glycol", "1,2-pentanediol"],                           category: "humectant", risk_level: "low",    flags: [] },
  { canonical_name: "sodium pca",           aliases: ["sodium pca", "sodium l-pyrrolidone carboxylate"],                 category: "humectant", risk_level: "low",    flags: [] },
  { canonical_name: "urea",                 aliases: ["urea", "carbamide"],                                              category: "humectant", risk_level: "low",    flags: [] },
  { canonical_name: "trehalose",            aliases: ["trehalose"],                                                      category: "humectant", risk_level: "low",    flags: [] },

  // ── Emollients / occlusives ──────────────────────────────────────────────────
  { canonical_name: "shea butter",                  aliases: ["butyrospermum parkii butter", "shea butter", "butyrospermum parkii (shea) butter"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "caprylic/capric triglyceride", aliases: ["caprylic/capric triglyceride", "caprylic capric triglyceride"],                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "dimethicone",                  aliases: ["dimethicone", "polydimethylsiloxane"],                                            category: "emollient", risk_level: "low",    flags: ["silicone"] },
  { canonical_name: "cyclopentasiloxane",           aliases: ["cyclopentasiloxane", "d5"],                                                       category: "emollient", risk_level: "medium", flags: ["silicone"] },
  { canonical_name: "squalane",                     aliases: ["squalane"],                                                                        category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "petrolatum",                   aliases: ["petrolatum", "petroleum jelly", "vaseline"],                                       category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "cetearyl alcohol",             aliases: ["cetearyl alcohol"],                                                                 category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "cetyl alcohol",                aliases: ["cetyl alcohol"],                                                                    category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "stearyl alcohol",              aliases: ["stearyl alcohol"],                                                                  category: "emollient", risk_level: "medium", flags: [] },
  { canonical_name: "isopropyl myristate",          aliases: ["isopropyl myristate"],                                                             category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "behenyl alcohol",              aliases: ["behenyl alcohol"],                                                                  category: "emollient", risk_level: "low", flags: [] },

  // ── Soothing / barrier ───────────────────────────────────────────────────────
  { canonical_name: "panthenol",                aliases: ["panthenol", "d-panthenol", "dl-panthenol", "provitamin b5"],                              category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "allantoin",                aliases: ["allantoin"],                                                                               category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "bisabolol",                aliases: ["bisabolol", "alpha-bisabolol", "(-)-alpha-bisabolol"],                                     category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "madecassoside",            aliases: ["madecassoside"],                                                                           category: "soothing", risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "centella asiatica extract",aliases: ["centella asiatica extract", "gotu kola extract", "centella asiatica (gotu kola) extract"], category: "soothing", risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide np",              aliases: ["ceramide np", "ceramide 3"],                                                              category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide ap",              aliases: ["ceramide ap", "ceramide 6 ii"],                                                           category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide eop",             aliases: ["ceramide eop", "ceramide 1"],                                                             category: "barrier",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "cholesterol",              aliases: ["cholesterol"],                                                                             category: "barrier",  risk_level: "low", flags: ["barrier_support"] },

  // ── Antioxidants / vitamins ──────────────────────────────────────────────────
  { canonical_name: "tocopherol",                   aliases: ["tocopherol", "vitamin e"],                          category: "antioxidant", risk_level: "low",    flags: [] },
  { canonical_name: "tocopheryl acetate",           aliases: ["tocopheryl acetate"],                               category: "antioxidant", risk_level: "low",    flags: [] },
  { canonical_name: "niacinamide",                  aliases: ["niacinamide", "nicotinamide", "vitamin b3"],        category: "active",      risk_level: "low",    flags: ["active"] },
  { canonical_name: "ascorbic acid",                aliases: ["ascorbic acid", "l-ascorbic acid", "vitamin c"],    category: "active",      risk_level: "medium", flags: ["active"] },
  { canonical_name: "sodium ascorbyl phosphate",    aliases: ["sodium ascorbyl phosphate"],                        category: "active",      risk_level: "low",    flags: ["active"] },
  { canonical_name: "magnesium ascorbyl phosphate", aliases: ["magnesium ascorbyl phosphate"],                     category: "active",      risk_level: "low",    flags: ["active"] },
  { canonical_name: "retinol",                      aliases: ["retinol", "vitamin a"],                             category: "active",      risk_level: "medium", flags: ["active"] },
  { canonical_name: "retinal",                      aliases: ["retinal", "retinaldehyde"],                         category: "active",      risk_level: "medium", flags: ["active"] },

  // ── Cleansers / surfactants ──────────────────────────────────────────────────
  { canonical_name: "cocamidopropyl betaine",     aliases: ["cocamidopropyl betaine"],                                                  category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "sodium laureth sulfate",     aliases: ["sodium laureth sulfate", "sles", "sodium lauryl ether sulfate"],           category: "surfactant", risk_level: "medium", flags: ["surfactant"] },
  { canonical_name: "sodium lauryl sulfate",      aliases: ["sodium lauryl sulfate", "sls"],                                           category: "surfactant", risk_level: "high",   flags: ["surfactant"] },
  { canonical_name: "decyl glucoside",            aliases: ["decyl glucoside"],                                                        category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "coco-glucoside",             aliases: ["coco-glucoside", "coco glucoside"],                                       category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "disodium cocoamphodiacetate",aliases: ["disodium cocoamphodiacetate"],                                            category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "potassium cetyl phosphate",  aliases: ["potassium cetyl phosphate"],                                              category: "emulsifier", risk_level: "low",    flags: [] },

  // ── Preservatives / functional ───────────────────────────────────────────────
  { canonical_name: "phenoxyethanol",     aliases: ["phenoxyethanol"],                                  category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "ethylhexylglycerin", aliases: ["ethylhexylglycerin"],                              category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "chlorphenesin",      aliases: ["chlorphenesin"],                                   category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "sodium benzoate",    aliases: ["sodium benzoate"],                                  category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "potassium sorbate",  aliases: ["potassium sorbate"],                               category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "disodium edta",      aliases: ["disodium edta", "edta", "disodium edetate", "trisodium edta", "trisodium edetate"], category: "chelating", risk_level: "low", flags: [] },
  { canonical_name: "xanthan gum",        aliases: ["xanthan gum"],                                     category: "thickener",    risk_level: "low",    flags: [] },
  { canonical_name: "carbomer",           aliases: ["carbomer"],                                         category: "thickener",    risk_level: "low",    flags: [] },
  { canonical_name: "acrylates/c10-30 alkyl acrylate crosspolymer", aliases: ["acrylates/c10-30 alkyl acrylate crosspolymer"], category: "thickener", risk_level: "low", flags: [] },

  // ── Fragrance allergens ──────────────────────────────────────────────────────
  { canonical_name: "fragrance",   aliases: ["parfum", "fragrance", "aroma"],                    category: "fragrance", risk_level: "high",   flags: ["fragrance"] },
  { canonical_name: "linalool",    aliases: ["linalool"],                                         category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "limonene",    aliases: ["limonene", "d-limonene"],                           category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "citronellol", aliases: ["citronellol"],                                      category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "geraniol",    aliases: ["geraniol"],                                          category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "hexyl cinnamal", aliases: ["hexyl cinnamal", "hexyl cinnamaldehyde"],        category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },

  // ── Silicones (extended) ─────────────────────────────────────────────────────
  { canonical_name: "cyclohexasiloxane",       aliases: ["cyclohexasiloxane", "d6"],                  category: "emollient", risk_level: "medium", flags: ["silicone"] },
  { canonical_name: "trimethicone",            aliases: ["trimethicone"],                             category: "emollient", risk_level: "low",    flags: ["silicone"] },
  { canonical_name: "amodimethicone",          aliases: ["amodimethicone"],                           category: "emollient", risk_level: "low",    flags: ["silicone"] },
  { canonical_name: "dimethiconol",            aliases: ["dimethiconol"],                             category: "emollient", risk_level: "low",    flags: ["silicone"] },
  { canonical_name: "silica dimethyl silylate",aliases: ["silica dimethyl silylate"],                 category: "emollient", risk_level: "low",    flags: ["silicone"] },

  // ── PEG / polymers ───────────────────────────────────────────────────────────
  { canonical_name: "peg-100 stearate",                aliases: ["peg-100 stearate", "peg 100 stearate", "polyethylene glycol 100 stearate"], category: "emulsifier", risk_level: "medium", flags: [] },
  { canonical_name: "peg-40 hydrogenated castor oil",  aliases: ["peg-40 hydrogenated castor oil", "peg 40 hydrogenated castor oil"],         category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "peg-7 glyceryl cocoate",          aliases: ["peg-7 glyceryl cocoate", "peg 7 glyceryl cocoate"],                         category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "ppg-1-peg-9 lauryl glycol ether", aliases: ["ppg-1-peg-9 lauryl glycol ether"],                                          category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "acrylates copolymer",              aliases: ["acrylates copolymer"],                                                       category: "thickener",  risk_level: "low",    flags: [] },

  // ── Emulsifiers / texture ────────────────────────────────────────────────────
  { canonical_name: "glyceryl stearate",             aliases: ["glyceryl stearate"],              category: "emulsifier", risk_level: "medium", flags: [] },
  { canonical_name: "stearic acid",                  aliases: ["stearic acid"],                   category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "ceteareth-20",                  aliases: ["ceteareth-20", "ceteareth 20"],   category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "hydroxyethylcellulose",         aliases: ["hydroxyethylcellulose", "hec"],   category: "thickener",  risk_level: "low",    flags: [] },
  { canonical_name: "sodium polyacrylate",           aliases: ["sodium polyacrylate"],            category: "thickener",  risk_level: "low",    flags: [] },
  { canonical_name: "glyceryl behenate",             aliases: ["glyceryl behenate"],              category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "glyceryl dibehenate",           aliases: ["glyceryl dibehenate"],            category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "glyceryl laurate",              aliases: ["glyceryl laurate"],               category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "tribehenin",                    aliases: ["tribehenin"],                     category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "sodium stearoyl glutamate",     aliases: ["sodium stearoyl glutamate"],      category: "emulsifier", risk_level: "low",    flags: [] },
  { canonical_name: "hydroxypropyl methylcellulose", aliases: ["hydroxypropyl methylcellulose", "hpmc"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "sodium carrageenan",            aliases: ["sodium carrageenan", "carrageenan"], category: "thickener", risk_level: "low",   flags: [] },
  { canonical_name: "sodium chloride",               aliases: ["sodium chloride"],                category: "thickener",  risk_level: "low",    flags: [] },
  { canonical_name: "sodium hydroxide",              aliases: ["sodium hydroxide"],               category: "ph_adjuster",risk_level: "low",    flags: [] },

  // ── Solvents / co-preservatives ──────────────────────────────────────────────
  { canonical_name: "caprylyl glycol",   aliases: ["caprylyl glycol"],                category: "solvent",     risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "1,2-hexanediol",    aliases: ["1,2-hexanediol", "hexanediol"],   category: "solvent",     risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "benzyl alcohol",    aliases: ["benzyl alcohol"],                  category: "preservative",risk_level: "high",   flags: ["preservative"] },
  { canonical_name: "dehydroacetic acid",aliases: ["dehydroacetic acid"],              category: "preservative",risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "benzoic acid",      aliases: ["benzoic acid"],                    category: "preservative",risk_level: "low",    flags: ["preservative"] },

  // ── Actives / exfoliants ─────────────────────────────────────────────────────
  { canonical_name: "salicylic acid",   aliases: ["salicylic acid", "bha"],           category: "active", risk_level: "medium", flags: ["active"] },
  { canonical_name: "glycolic acid",    aliases: ["glycolic acid"],                   category: "active", risk_level: "medium", flags: ["active"] },
  { canonical_name: "lactic acid",      aliases: ["lactic acid"],                     category: "active", risk_level: "medium", flags: ["active"] },
  { canonical_name: "mandelic acid",    aliases: ["mandelic acid"],                   category: "active", risk_level: "medium", flags: ["active"] },
  { canonical_name: "azelaic acid",     aliases: ["azelaic acid"],                    category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "kojic acid",       aliases: ["kojic acid"],                      category: "active", risk_level: "medium", flags: ["active"] },
  { canonical_name: "tranexamic acid",  aliases: ["tranexamic acid"],                 category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "alpha arbutin",    aliases: ["alpha arbutin", "alpha-arbutin"],  category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "bakuchiol",        aliases: ["bakuchiol"],                        category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "resveratrol",      aliases: ["resveratrol"],                      category: "antioxidant", risk_level: "low", flags: ["active"] },
  { canonical_name: "ferulic acid",     aliases: ["ferulic acid"],                    category: "antioxidant", risk_level: "low", flags: ["active"] },
  { canonical_name: "adenosine",        aliases: ["adenosine"],                        category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "ubiquinone",       aliases: ["ubiquinone", "coenzyme q10", "coq10"], category: "antioxidant", risk_level: "low", flags: ["active"] },
  { canonical_name: "carnitine",        aliases: ["carnitine", "l-carnitine"],        category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "glycyrrhetinic acid",             aliases: ["glycyrrhetinic acid"],                                                                  category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "glycyrrhiza inflata root extract",aliases: ["glycyrrhiza inflata root extract", "licorice root extract"],                            category: "active", risk_level: "low", flags: ["active"] },

  // ── Barrier / repair (extended) ──────────────────────────────────────────────
  { canonical_name: "phytosphingosine",   aliases: ["phytosphingosine"],                                                      category: "barrier",   risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "beta-glucan",        aliases: ["beta-glucan", "beta glucan", "oat beta glucan"],                         category: "soothing",  risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "hydrolyzed collagen",aliases: ["hydrolyzed collagen", "soluble collagen"],                               category: "barrier",   risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "hydrolyzed silk",    aliases: ["hydrolyzed silk", "silk amino acids"],                                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "polyglutamic acid",  aliases: ["polyglutamic acid", "pga"],                                              category: "humectant", risk_level: "low", flags: [] },

  // ── Peptides ─────────────────────────────────────────────────────────────────
  { canonical_name: "palmitoyl pentapeptide-4",aliases: ["palmitoyl pentapeptide-4", "matrixyl", "palmitoyl pentapeptide 4"], category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "acetyl hexapeptide-3",    aliases: ["acetyl hexapeptide-3", "argireline", "acetyl hexapeptide 3"],       category: "active", risk_level: "low", flags: ["active"] },

  // ── Sun filters ──────────────────────────────────────────────────────────────
  { canonical_name: "zinc oxide",                                        aliases: ["zinc oxide"],                                                                          category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "titanium dioxide",                                  aliases: ["titanium dioxide", "ci 77891"],                                                        category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "ethylhexyl methoxycinnamate",                       aliases: ["ethylhexyl methoxycinnamate", "octinoxate", "octyl methoxycinnamate"],                 category: "sunfilter", risk_level: "medium", flags: [] },
  { canonical_name: "avobenzone",                                        aliases: ["avobenzone", "butyl methoxydibenzoylmethane", "butyl/methoxydibenzoylmethane"],        category: "sunfilter", risk_level: "medium", flags: [] },
  { canonical_name: "octocrylene",                                       aliases: ["octocrylene"],                                                                         category: "sunfilter", risk_level: "medium", flags: [] },
  { canonical_name: "bis-ethylhexyloxyphenol methoxyphenyl triazine",    aliases: ["bis-ethylhexyloxyphenol methoxyphenyl triazine", "tinosorb s"],                        category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "diethylhexyl butamido triazone",                    aliases: ["diethylhexyl butamido triazone", "uvasorb heb"],                                      category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "ethylhexyl triazone",                               aliases: ["ethylhexyl triazone", "uvinul t 150"],                                                category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "diethylamino hydroxybenzoyl hexyl benzoate",        aliases: ["diethylamino hydroxybenzoyl hexyl benzoate", "uvinul a plus"],                         category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "phenylbenzimidazole sulfonic acid",                 aliases: ["phenylbenzimidazole sulfonic acid", "ensulizole"],                                     category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "methylene bis-benzotriazolyl tetramethylbutylphenol",aliases: ["methylene bis-benzotriazolyl tetramethylbutylphenol", "tinosorb m", "bisoctrizole"], category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "phenylene bis-diphenyltriazine",                    aliases: ["phenylene bis-diphenyltriazine", "triafiltri"],                                        category: "sunfilter", risk_level: "low",    flags: [] },

  // ── Plant oils ───────────────────────────────────────────────────────────────
  { canonical_name: "jojoba oil",          aliases: ["simmondsia chinensis seed oil", "jojoba oil", "jojoba"],              category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "argan oil",           aliases: ["argania spinosa kernel oil", "argan oil"],                            category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "rosehip oil",         aliases: ["rosa canina fruit oil", "rosehip oil", "rosa canina seed oil"],       category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "c10-18 triglycerides",aliases: ["c10-18 triglycerides"],                                               category: "emollient", risk_level: "low", flags: [] },

  // ── Botanicals / extracts ────────────────────────────────────────────────────
  { canonical_name: "aloe vera extract",              aliases: ["aloe barbadensis leaf extract", "aloe vera extract", "aloe vera", "aloe barbadensis leaf juice"], category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "green tea extract",              aliases: ["camellia sinensis leaf extract", "green tea extract", "camellia sinensis extract"],               category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "chamomile extract",              aliases: ["chamomilla recutita extract", "chamomile extract", "matricaria chamomilla extract"],              category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "licorice root extract",          aliases: ["glycyrrhiza glabra root extract", "licorice root extract", "licorice extract"],                  category: "active",      risk_level: "low", flags: ["active"] },
  { canonical_name: "oat extract",                    aliases: ["avena sativa kernel extract", "oat extract", "colloidal oatmeal"],                               category: "soothing",    risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "myrtus communis leaf extract",   aliases: ["myrtus communis leaf extract"],                                                                  category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "tripterygium wilfordii callus extract", aliases: ["tripterygium wilfordii callus extract"],                                                  category: "active",      risk_level: "low", flags: [] },

  // ── Minerals / trace elements ─────────────────────────────────────────────────
  { canonical_name: "zinc gluconate",     aliases: ["zinc gluconate"],      category: "active",    risk_level: "low", flags: ["active"] },
  { canonical_name: "magnesium gluconate",aliases: ["magnesium gluconate"], category: "active",    risk_level: "low", flags: [] },
  { canonical_name: "silica",             aliases: ["silica"],              category: "absorbent", risk_level: "low", flags: [] },

  // ── Additional carriers ───────────────────────────────────────────────────────
  { canonical_name: "diisopropyl adipate",               aliases: ["diisopropyl adipate"],                                       category: "emollient",   risk_level: "low",    flags: [] },
  { canonical_name: "dibutyl adipate",                   aliases: ["dibutyl adipate"],                                           category: "emollient",   risk_level: "low",    flags: [] },
  { canonical_name: "dicaprylyl carbonate",              aliases: ["dicaprylyl carbonate"],                                      category: "emollient",   risk_level: "low",    flags: [] },
  { canonical_name: "c12-15 alkyl benzoate",             aliases: ["c12-15 alkyl benzoate"],                                     category: "emollient",   risk_level: "medium", flags: [] },
  { canonical_name: "copernicia cerifera cera",          aliases: ["copernicia cerifera cera", "carnauba wax"],                  category: "occlusive",   risk_level: "low",    flags: [] },
  { canonical_name: "corn starch",                       aliases: ["zea mays starch", "zea mays (corn) starch", "corn starch"], category: "absorbent",   risk_level: "low",    flags: [] },
  { canonical_name: "tapioca starch",                    aliases: ["tapioca starch"],                                            category: "absorbent",   risk_level: "low",    flags: [] },
  { canonical_name: "rice starch",                       aliases: ["oryza sativa starch", "oryza sativa (rice) starch", "rice starch"], category: "absorbent", risk_level: "low", flags: [] },
  { canonical_name: "vp/eicosene copolymer",             aliases: ["vp/eicosene copolymer"],                                     category: "film_former", risk_level: "low",    flags: [] },
  { canonical_name: "butylene glycol dicaprylate/dicaprate", aliases: ["butylene glycol dicaprylate/dicaprate"],                 category: "emollient",   risk_level: "low",    flags: [] },

  // ── Additional surfactants ────────────────────────────────────────────────────
  { canonical_name: "lauryl glucoside",          aliases: ["lauryl glucoside"],                       category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "sodium cocoyl isethionate", aliases: ["sodium cocoyl isethionate", "sci"],       category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "polysorbate 20",            aliases: ["polysorbate 20", "tween 20"],             category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "polysorbate 80",            aliases: ["polysorbate 80", "tween 80"],             category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "polysorbate 60",            aliases: ["polysorbate 60", "tween 60"],             category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "ammonium lauryl sulfate",   aliases: ["ammonium lauryl sulfate", "als"],         category: "surfactant", risk_level: "medium", flags: ["surfactant"] },
  { canonical_name: "sodium lauroyl sarcosinate",aliases: ["sodium lauroyl sarcosinate", "sarcosinate"], category: "surfactant", risk_level: "low", flags: ["surfactant"] },
  { canonical_name: "disodium laureth sulfosuccinate", aliases: ["disodium laureth sulfosuccinate"],  category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "sodium cocoyl glycinate",   aliases: ["sodium cocoyl glycinate"],                category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "sodium myreth sulfate",     aliases: ["sodium myreth sulfate"],                  category: "surfactant", risk_level: "medium", flags: ["surfactant"] },
  { canonical_name: "sodium lauroyl glutamate",  aliases: ["sodium lauroyl glutamate"],               category: "surfactant", risk_level: "low",    flags: ["surfactant"] },
  { canonical_name: "sodium lauroyl isethionate",aliases: ["sodium lauroyl isethionate"],             category: "surfactant", risk_level: "low",    flags: ["surfactant"] },

  // ── Solvents (expanded) ───────────────────────────────────────────────────────
  { canonical_name: "isohexadecane",   aliases: ["isohexadecane"],                                    category: "solvent",  risk_level: "low",    flags: [] },
  { canonical_name: "isododecane",     aliases: ["isododecane"],                                      category: "solvent",  risk_level: "low",    flags: [] },
  { canonical_name: "dipropylene glycol", aliases: ["dipropylene glycol", "dpg"],                     category: "solvent",  risk_level: "low",    flags: [] },
  { canonical_name: "propanediol",     aliases: ["propanediol", "1,3-propanediol"],                   category: "solvent",  risk_level: "low",    flags: [] },
  { canonical_name: "ethanol",         aliases: ["ethanol", "ethyl alcohol"],                         category: "solvent",  risk_level: "medium", flags: ["drying_alcohol"] },
  { canonical_name: "diethylhexyl carbonate", aliases: ["diethylhexyl carbonate"],                    category: "solvent",  risk_level: "low",    flags: [] },
  { canonical_name: "hexylene glycol", aliases: ["hexylene glycol"],                                  category: "solvent",  risk_level: "medium", flags: [] },

  // ── Humectants (expanded) ─────────────────────────────────────────────────────
  { canonical_name: "sorbitol",        aliases: ["sorbitol"],                                         category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "betaine",         aliases: ["betaine", "trimethylglycine"],                      category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "sodium lactate",  aliases: ["sodium lactate"],                                   category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "glyceryl polyacrylate", aliases: ["glyceryl polyacrylate"],                      category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "erythritol",      aliases: ["erythritol"],                                       category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "mannitol",        aliases: ["mannitol"],                                         category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "sodium acetyl hyaluronate", aliases: ["sodium acetyl hyaluronate"],              category: "humectant", risk_level: "low", flags: [] },
  { canonical_name: "hydrolyzed hyaluronic acid",aliases: ["hydrolyzed hyaluronic acid"],             category: "humectant", risk_level: "low", flags: [] },

  // ── Emollients — plant oils ───────────────────────────────────────────────────
  { canonical_name: "sunflower seed oil",  aliases: ["helianthus annuus seed oil", "sunflower seed oil", "helianthus annuus (sunflower) seed oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "sweet almond oil",    aliases: ["prunus amygdalus dulcis oil", "sweet almond oil", "prunus amygdalus dulcis (sweet almond) oil"], category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "avocado oil",         aliases: ["persea gratissima oil", "avocado oil", "persea gratissima (avocado) oil"],                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "olive oil",           aliases: ["olea europaea fruit oil", "olive oil", "olea europaea (olive) fruit oil"],                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "marula oil",          aliases: ["sclerocarya birrea seed oil", "marula oil"],                                                 category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "evening primrose oil",aliases: ["oenothera biennis oil", "evening primrose oil"],                                             category: "emollient", risk_level: "low", flags: ["active"] },
  { canonical_name: "coconut oil",         aliases: ["cocos nucifera oil", "coconut oil", "cocos nucifera (coconut) oil"],                         category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "hemp seed oil",       aliases: ["cannabis sativa seed oil", "hemp seed oil", "cannabis sativa (hemp) seed oil"],              category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "macadamia oil",       aliases: ["macadamia integrifolia seed oil", "macadamia oil"],                                          category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "mineral oil",         aliases: ["mineral oil", "paraffinum liquidum", "white mineral oil"],                                   category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "hydrogenated polyisobutene", aliases: ["hydrogenated polyisobutene"],                                                         category: "emollient", risk_level: "low", flags: [] },
  { canonical_name: "c13-15 alkane",       aliases: ["c13-15 alkane"],                                                                             category: "emollient", risk_level: "low", flags: [] },

  // ── Occlusives (expanded) ─────────────────────────────────────────────────────
  { canonical_name: "beeswax",             aliases: ["cera alba", "beeswax", "apis mellifera beeswax"],         category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "microcrystalline wax",aliases: ["microcrystalline wax", "cera microcristallina"],          category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "ozokerite",           aliases: ["ozokerite", "ceresine"],                                  category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "paraffin",            aliases: ["paraffin", "paraffin wax"],                               category: "occlusive", risk_level: "low", flags: [] },
  { canonical_name: "lanolin",             aliases: ["lanolin", "adeps lanae", "wool wax"],                     category: "occlusive", risk_level: "medium", flags: [] },

  // ── Emulsifiers (expanded) ────────────────────────────────────────────────────
  { canonical_name: "sorbitan stearate",   aliases: ["sorbitan stearate", "span 60"],                          category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sorbitan olivate",    aliases: ["sorbitan olivate"],                                       category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sorbitan isostearate",aliases: ["sorbitan isostearate"],                                   category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "lecithin",            aliases: ["lecithin", "soya lecithin", "sunflower lecithin"],        category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "polyglyceryl-3 methylglucose distearate", aliases: ["polyglyceryl-3 methylglucose distearate"], category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "behentrimonium methosulfate", aliases: ["behentrimonium methosulfate", "btms"],            category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "steareth-2",          aliases: ["steareth-2"],                                             category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "steareth-21",         aliases: ["steareth-21"],                                            category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "glycol stearate",     aliases: ["glycol stearate"],                                        category: "emulsifier", risk_level: "low", flags: [] },
  { canonical_name: "sucrose stearate",    aliases: ["sucrose stearate"],                                       category: "emulsifier", risk_level: "low", flags: [] },

  // ── Thickeners / rheology modifiers (expanded) ───────────────────────────────
  { canonical_name: "hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer", aliases: ["hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer", "aristoflex hmbg"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "ammonium acryloyldimethyltaurate/vp copolymer", aliases: ["ammonium acryloyldimethyltaurate/vp copolymer", "aristoflex avc"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "cellulose gum",       aliases: ["cellulose gum", "sodium carboxymethyl cellulose", "cmc"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "guar gum",            aliases: ["guar gum", "cyamopsis tetragonoloba gum"],               category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "locust bean gum",     aliases: ["locust bean gum", "ceratonia siliqua gum"],              category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "magnesium aluminum silicate", aliases: ["magnesium aluminum silicate"],                   category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "hydroxypropyl guar",  aliases: ["hydroxypropyl guar"],                                    category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "acrylates/c12-22 alkyl methacrylate copolymer", aliases: ["acrylates/c12-22 alkyl methacrylate copolymer"], category: "thickener", risk_level: "low", flags: [] },
  { canonical_name: "sodium polyacrylate starch", aliases: ["sodium polyacrylate starch"],                     category: "thickener", risk_level: "low", flags: [] },

  // ── Preservatives (expanded) ──────────────────────────────────────────────────
  { canonical_name: "methylparaben",       aliases: ["methylparaben", "methyl paraben", "methyl 4-hydroxybenzoate"],   category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "ethylparaben",        aliases: ["ethylparaben", "ethyl paraben", "ethyl 4-hydroxybenzoate"],     category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "propylparaben",       aliases: ["propylparaben", "propyl paraben", "propyl 4-hydroxybenzoate"],  category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "butylparaben",        aliases: ["butylparaben", "butyl paraben", "butyl 4-hydroxybenzoate"],     category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "imidazolidinyl urea", aliases: ["imidazolidinyl urea"],                                          category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "dmdm hydantoin",      aliases: ["dmdm hydantoin"],                                               category: "preservative", risk_level: "high",   flags: ["preservative"] },
  { canonical_name: "methylisothiazolinone", aliases: ["methylisothiazolinone", "mit", "2-methylisothiazol-3(2h)-one"], category: "preservative", risk_level: "high", flags: ["preservative"] },
  { canonical_name: "iodopropynyl butylcarbamate", aliases: ["iodopropynyl butylcarbamate", "ipbc"],                  category: "preservative", risk_level: "medium", flags: ["preservative"] },
  { canonical_name: "phenethyl alcohol",   aliases: ["phenethyl alcohol", "phenoxyethyl alcohol"],                    category: "preservative", risk_level: "low",    flags: ["preservative"] },
  { canonical_name: "bht",                 aliases: ["bht", "butylated hydroxytoluene", "dibutylhydroxytoluene"],     category: "antioxidant",  risk_level: "medium", flags: [] },
  { canonical_name: "bha",                 aliases: ["bha", "butylated hydroxyanisole"],                              category: "antioxidant",  risk_level: "medium", flags: [] },

  // ── Antioxidants (expanded) ───────────────────────────────────────────────────
  { canonical_name: "ascorbyl glucoside",          aliases: ["ascorbyl glucoside", "vitamin c glucoside"],             category: "active", risk_level: "low",  flags: ["active"] },
  { canonical_name: "ethyl ascorbic acid",         aliases: ["ethyl ascorbic acid", "3-o-ethyl ascorbic acid"],        category: "active", risk_level: "low",  flags: ["active"] },
  { canonical_name: "ascorbyl tetraisopalmitate",  aliases: ["ascorbyl tetraisopalmitate", "tetrahexyldecyl ascorbate"], category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "propyl gallate",              aliases: ["propyl gallate"],                                         category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "ergothioneine",               aliases: ["ergothioneine"],                                          category: "antioxidant", risk_level: "low", flags: ["active"] },

  // ── Barrier / repair (expanded) ──────────────────────────────────────────────
  { canonical_name: "linoleic acid",   aliases: ["linoleic acid"],                 category: "barrier", risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "linolenic acid",  aliases: ["linolenic acid"],                category: "barrier", risk_level: "low", flags: ["barrier_support"] },
  { canonical_name: "ceramide ns",     aliases: ["ceramide ns", "ceramide 2"],     category: "barrier", risk_level: "low", flags: ["barrier_support"] },

  // ── UV filters (expanded) ─────────────────────────────────────────────────────
  { canonical_name: "homosalate",                aliases: ["homosalate", "hms"],                                                                     category: "sunfilter", risk_level: "medium", flags: [] },
  { canonical_name: "octisalate",                aliases: ["octisalate", "ethylhexyl salicylate", "2-ethylhexyl salicylate"],                        category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "sulisobenzone",             aliases: ["sulisobenzone", "benzophenone-4"],                                                        category: "sunfilter", risk_level: "medium", flags: [] },
  { canonical_name: "dioxybenzone",              aliases: ["dioxybenzone", "benzophenone-8"],                                                         category: "sunfilter", risk_level: "medium", flags: [] },
  { canonical_name: "drometrizole trisiloxane",  aliases: ["drometrizole trisiloxane", "mexoryl xl"],                                                  category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "ecamsule",                  aliases: ["ecamsule", "mexoryl sx", "terephthalylidene dicamphor sulfonic acid"],                    category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "iscotrizinol",              aliases: ["iscotrizinol", "uvasorb heb", "diethylhexyl butamido triazone"],                          category: "sunfilter", risk_level: "low",    flags: [] },
  { canonical_name: "benzophenone-3",            aliases: ["benzophenone-3", "oxybenzone"],                                                           category: "sunfilter", risk_level: "medium", flags: [] },

  // ── Acids / exfoliants (expanded) ────────────────────────────────────────────
  { canonical_name: "gluconolactone",    aliases: ["gluconolactone", "glucono-delta-lactone"],            category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "lactobionic acid",  aliases: ["lactobionic acid"],                                   category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "malic acid",        aliases: ["malic acid"],                                         category: "active", risk_level: "medium", flags: ["active"] },
  { canonical_name: "tartaric acid",     aliases: ["tartaric acid"],                                      category: "active", risk_level: "medium", flags: ["active"] },
  { canonical_name: "citric acid",       aliases: ["citric acid"],                                        category: "ph_adjuster", risk_level: "low", flags: [] },

  // ── Retinoids (expanded) ──────────────────────────────────────────────────────
  { canonical_name: "retinyl palmitate", aliases: ["retinyl palmitate", "vitamin a palmitate"],           category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "retinyl acetate",   aliases: ["retinyl acetate", "vitamin a acetate"],               category: "active", risk_level: "low",    flags: ["active"] },
  { canonical_name: "hydroxypinacolone retinoate", aliases: ["hydroxypinacolone retinoate", "hpr", "granactive retinoid"], category: "active", risk_level: "medium", flags: ["active"] },

  // ── Peptides (expanded) ───────────────────────────────────────────────────────
  { canonical_name: "palmitoyl tripeptide-1",  aliases: ["palmitoyl tripeptide-1", "palmitoyl tripeptide 1"],              category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "palmitoyl tripeptide-38", aliases: ["palmitoyl tripeptide-38", "matrixyl synthe 6"],                  category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "copper tripeptide-1",     aliases: ["copper tripeptide-1", "ghk-cu", "tripeptide-copper"],            category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "acetyl octapeptide-3",    aliases: ["acetyl octapeptide-3", "snap-8"],                                category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "tripeptide-29",           aliases: ["tripeptide-29"],                                                  category: "active", risk_level: "low", flags: ["active"] },
  { canonical_name: "dipeptide diaminobutyroyl benzylamide diacetate", aliases: ["dipeptide diaminobutyroyl benzylamide diacetate", "syn-ake"], category: "active", risk_level: "low", flags: ["active"] },

  // ── Soothing agents (expanded) ────────────────────────────────────────────────
  { canonical_name: "calendula officinalis flower extract", aliases: ["calendula officinalis flower extract", "calendula extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "white tea extract",        aliases: ["camellia sinensis leaf extract white", "white tea extract"],    category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "willow herb extract",      aliases: ["epilobium angustifolium flower/leaf/stem extract", "willow herb extract"], category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "horse chestnut extract",   aliases: ["aesculus hippocastanum seed extract", "horse chestnut extract"],category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "feverfew extract",         aliases: ["tanacetum parthenium extract", "feverfew extract"],             category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "portulaca oleracea extract",aliases: ["portulaca oleracea extract", "purslane extract"],              category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "tremella fuciformis extract",aliases: ["tremella fuciformis extract", "snow mushroom extract"],       category: "humectant",   risk_level: "low", flags: [] },

  // ── Silicones (expanded) ──────────────────────────────────────────────────────
  { canonical_name: "phenyl trimethicone",      aliases: ["phenyl trimethicone"],                                          category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "stearyl dimethicone",      aliases: ["stearyl dimethicone"],                                          category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "peg-10 dimethicone",       aliases: ["peg-10 dimethicone"],                                           category: "emollient", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "dimethicone crosspolymer", aliases: ["dimethicone crosspolymer"],                                     category: "emollient", risk_level: "low", flags: ["silicone"] },

  // ── Fragrance allergens (EU 26 list — expanded) ───────────────────────────────
  { canonical_name: "amyl cinnamal",        aliases: ["amyl cinnamal", "amylcinnamaldehyde"],                              category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "benzyl benzoate",      aliases: ["benzyl benzoate"],                                                  category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "benzyl cinnamate",     aliases: ["benzyl cinnamate"],                                                 category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "benzyl salicylate",    aliases: ["benzyl salicylate"],                                                category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "eugenol",              aliases: ["eugenol"],                                                          category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "isoeugenol",           aliases: ["isoeugenol"],                                                       category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "farnesol",             aliases: ["farnesol"],                                                         category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "hydroxycitronellal",   aliases: ["hydroxycitronellal"],                                               category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "alpha-isomethyl ionone",aliases: ["alpha-isomethyl ionone", "methyl ionone"],                        category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "coumarin",             aliases: ["coumarin"],                                                         category: "fragrance", risk_level: "medium", flags: ["fragrance", "allergen"] },
  { canonical_name: "oak moss extract",     aliases: ["evernia prunastri extract", "oak moss extract"],                    category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "tree moss extract",    aliases: ["evernia furfuracea extract", "tree moss extract"],                  category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "cinnamaldehyde",       aliases: ["cinnamaldehyde", "cinnamic aldehyde"],                              category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },
  { canonical_name: "cinnamal",             aliases: ["cinnamal", "3-phenylpropenal"],                                     category: "fragrance", risk_level: "high",   flags: ["fragrance", "allergen"] },

  // ── Botanicals / extracts (expanded) ─────────────────────────────────────────
  { canonical_name: "pomegranate extract",  aliases: ["punica granatum extract", "pomegranate extract", "pomegranate seed oil"], category: "antioxidant", risk_level: "low", flags: ["active"] },
  { canonical_name: "sea kelp extract",     aliases: ["laminaria digitata extract", "sea kelp extract", "kelp extract"],   category: "soothing", risk_level: "low", flags: [] },
  { canonical_name: "spirulina extract",    aliases: ["arthrospira platensis extract", "spirulina extract"],               category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "ginkgo biloba extract",aliases: ["ginkgo biloba leaf extract", "ginkgo biloba extract"],              category: "antioxidant", risk_level: "low", flags: ["active"] },
  { canonical_name: "grape seed extract",   aliases: ["vitis vinifera seed extract", "grape seed extract"],                category: "antioxidant", risk_level: "low", flags: ["active"] },
  { canonical_name: "turmeric extract",     aliases: ["curcuma longa root extract", "turmeric extract", "curcumin"],       category: "soothing",    risk_level: "low", flags: [] },
  { canonical_name: "rice bran extract",    aliases: ["oryza sativa bran extract", "rice bran extract"],                   category: "active",      risk_level: "low", flags: ["active"] },
  { canonical_name: "coffea arabica extract",aliases: ["coffea arabica seed extract", "coffee extract", "coffea arabica (coffee) seed extract"], category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "blackcurrant extract", aliases: ["ribes nigrum fruit extract", "blackcurrant extract"],               category: "antioxidant", risk_level: "low", flags: [] },
  { canonical_name: "sea buckthorn extract",aliases: ["hippophae rhamnoides fruit extract", "sea buckthorn extract"],      category: "antioxidant", risk_level: "low", flags: ["active"] },
  { canonical_name: "frankincense extract", aliases: ["boswellia carterii extract", "boswellia serrata extract", "frankincense extract"], category: "soothing", risk_level: "low", flags: [] },

  // ── pH adjusters / chelators (expanded) ──────────────────────────────────────
  { canonical_name: "triethanolamine",       aliases: ["triethanolamine", "tea"],                     category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "aminomethyl propanol",  aliases: ["aminomethyl propanol", "amp"],                category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "arginine",              aliases: ["arginine", "l-arginine"],                     category: "ph_adjuster", risk_level: "low",    flags: [] },
  { canonical_name: "trisodium ethylenediamine disuccinate", aliases: ["trisodium ethylenediamine disuccinate", "trisodium edds"], category: "chelating", risk_level: "low", flags: [] },
  { canonical_name: "tetrasodium edta",      aliases: ["tetrasodium edta", "edta tetrasodium"],       category: "chelating",   risk_level: "low",    flags: [] },
  { canonical_name: "tetrasodium glutamate diacetate", aliases: ["tetrasodium glutamate diacetate", "glda"], category: "chelating", risk_level: "low", flags: [] },
  { canonical_name: "phytic acid",           aliases: ["phytic acid", "inositol hexaphosphoric acid"], category: "chelating",  risk_level: "low",    flags: [] },

  // ── Colorants / CI pigments ───────────────────────────────────────────────────
  { canonical_name: "ci 77491",  aliases: ["ci 77491", "iron oxides red", "iron oxide red"],          category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77492",  aliases: ["ci 77492", "iron oxides yellow", "iron oxide yellow"],    category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77499",  aliases: ["ci 77499", "iron oxides black", "iron oxide black"],      category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77266",  aliases: ["ci 77266", "carbon black", "black 2"],                    category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77007",  aliases: ["ci 77007", "ultramarines", "ultramarine blue"],            category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77742",  aliases: ["ci 77742", "manganese violet"],                           category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77288",  aliases: ["ci 77288", "chromium oxide greens", "chromium oxide"],    category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77289",  aliases: ["ci 77289", "chromium hydroxide green"],                   category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 19140",  aliases: ["ci 19140", "yellow 5", "tartrazine"],                     category: "colorant", risk_level: "medium", flags: [] },
  { canonical_name: "ci 16035",  aliases: ["ci 16035", "red 40", "allura red ac"],                    category: "colorant", risk_level: "medium", flags: [] },
  { canonical_name: "ci 42090",  aliases: ["ci 42090", "blue 1", "brilliant blue fcf"],               category: "colorant", risk_level: "medium", flags: [] },
  { canonical_name: "ci 15985",  aliases: ["ci 15985", "yellow 6", "sunset yellow fcf"],              category: "colorant", risk_level: "medium", flags: [] },
  { canonical_name: "ci 17200",  aliases: ["ci 17200", "red 33"],                                     category: "colorant", risk_level: "medium", flags: [] },
  { canonical_name: "ci 77510",  aliases: ["ci 77510", "ferric ammonium ferrocyanide", "prussian blue"], category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77861",  aliases: ["ci 77861", "bismuth oxychloride"],                        category: "colorant", risk_level: "low", flags: [] },
  { canonical_name: "ci 77000",  aliases: ["ci 77000", "aluminum powder"],                            category: "colorant", risk_level: "low", flags: [] },

  // ── Film formers / polymers ───────────────────────────────────────────────────
  { canonical_name: "pvp",              aliases: ["pvp", "polyvinylpyrrolidone", "polyvinyl pyrrolidone"], category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "pvp/va copolymer", aliases: ["pvp/va copolymer", "vp/va copolymer"],                 category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "polyvinyl alcohol",aliases: ["polyvinyl alcohol", "pva"],                             category: "film_former", risk_level: "low", flags: [] },
  { canonical_name: "trimethylsiloxysilicate", aliases: ["trimethylsiloxysilicate"],                      category: "film_former", risk_level: "low", flags: ["silicone"] },
  { canonical_name: "acrylates/dimethicone copolymer", aliases: ["acrylates/dimethicone copolymer"],      category: "film_former", risk_level: "low", flags: [] },
];
