export const INGREDIENT_LIBRARY = [
  // ── Solvent / base ──────────────────────────────────────────────────────────
  {
    canonical_name: "water",
    aliases: ["aqua", "water", "eau"],
    category: "solvent",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "alcohol denat.",
    aliases: ["alcohol denat", "alcohol denat.", "denatured alcohol"],
    category: "solvent",
    risk_level: "medium",
    flags: ["drying_alcohol"]
  },

  // ── Humectants ───────────────────────────────────────────────────────────────
  {
    canonical_name: "glycerin",
    aliases: ["glycerin", "glycerine", "glycerol"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "sodium hyaluronate",
    aliases: ["sodium hyaluronate"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "hyaluronic acid",
    aliases: ["hyaluronic acid"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "butylene glycol",
    aliases: ["butylene glycol", "1,3-butylene glycol", "1,3-butanediol"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "propylene glycol",
    aliases: ["propylene glycol", "1,2-propanediol"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "pentylene glycol",
    aliases: ["pentylene glycol", "1,2-pentanediol"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "sodium pca",
    aliases: ["sodium pca", "sodium l-pyrrolidone carboxylate"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "urea",
    aliases: ["urea", "carbamide"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "trehalose",
    aliases: ["trehalose"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },

  // ── Emollients / occlusives ──────────────────────────────────────────────────
  {
    canonical_name: "shea butter",
    aliases: ["butyrospermum parkii butter", "shea butter", "butyrospermum parkii (shea) butter"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "caprylic/capric triglyceride",
    aliases: ["caprylic/capric triglyceride", "caprylic capric triglyceride"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "dimethicone",
    aliases: ["dimethicone", "polydimethylsiloxane"],
    category: "emollient",
    risk_level: "low",
    flags: ["silicone"]
  },
  {
    canonical_name: "cyclopentasiloxane",
    aliases: ["cyclopentasiloxane", "d5"],
    category: "emollient",
    risk_level: "medium",
    flags: ["silicone"]
  },
  {
    canonical_name: "squalane",
    aliases: ["squalane"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "petrolatum",
    aliases: ["petrolatum", "petroleum jelly", "vaseline"],
    category: "occlusive",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "cetearyl alcohol",
    aliases: ["cetearyl alcohol"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "cetyl alcohol",
    aliases: ["cetyl alcohol"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "stearyl alcohol",
    aliases: ["stearyl alcohol"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "isopropyl myristate",
    aliases: ["isopropyl myristate"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },

  // ── Soothing / barrier ───────────────────────────────────────────────────────
  {
    canonical_name: "panthenol",
    aliases: ["panthenol", "d-panthenol", "dl-panthenol", "provitamin b5"],
    category: "soothing",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "allantoin",
    aliases: ["allantoin"],
    category: "soothing",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "bisabolol",
    aliases: ["bisabolol", "alpha-bisabolol", "(-)-alpha-bisabolol"],
    category: "soothing",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "madecassoside",
    aliases: ["madecassoside"],
    category: "soothing",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "centella asiatica extract",
    aliases: ["centella asiatica extract", "gotu kola extract", "centella asiatica (gotu kola) extract"],
    category: "soothing",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "ceramide np",
    aliases: ["ceramide np", "ceramide 3"],
    category: "barrier",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "ceramide ap",
    aliases: ["ceramide ap", "ceramide 6 ii"],
    category: "barrier",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "ceramide eop",
    aliases: ["ceramide eop", "ceramide 1"],
    category: "barrier",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "cholesterol",
    aliases: ["cholesterol"],
    category: "barrier",
    risk_level: "low",
    flags: ["barrier_support"]
  },

  // ── Antioxidants / vitamins ──────────────────────────────────────────────────
  {
    canonical_name: "tocopherol",
    aliases: ["tocopherol", "vitamin e"],
    category: "antioxidant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "tocopheryl acetate",
    aliases: ["tocopheryl acetate"],
    category: "antioxidant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "niacinamide",
    aliases: ["niacinamide", "nicotinamide", "vitamin b3"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "ascorbic acid",
    aliases: ["ascorbic acid", "l-ascorbic acid", "vitamin c"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },
  {
    canonical_name: "sodium ascorbyl phosphate",
    aliases: ["sodium ascorbyl phosphate"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "magnesium ascorbyl phosphate",
    aliases: ["magnesium ascorbyl phosphate"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "retinol",
    aliases: ["retinol", "vitamin a"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },
  {
    canonical_name: "retinal",
    aliases: ["retinal", "retinaldehyde"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },

  // ── Cleansers / surfactants ──────────────────────────────────────────────────
  {
    canonical_name: "cocamidopropyl betaine",
    aliases: ["cocamidopropyl betaine"],
    category: "surfactant",
    risk_level: "low",
    flags: ["surfactant"]
  },
  {
    canonical_name: "sodium laureth sulfate",
    aliases: ["sodium laureth sulfate", "sles", "sodium lauryl ether sulfate"],
    category: "surfactant",
    risk_level: "medium",
    flags: ["surfactant"]
  },
  {
    canonical_name: "sodium lauryl sulfate",
    aliases: ["sodium lauryl sulfate", "sls"],
    category: "surfactant",
    risk_level: "high",
    flags: ["surfactant"]
  },
  {
    canonical_name: "decyl glucoside",
    aliases: ["decyl glucoside"],
    category: "surfactant",
    risk_level: "low",
    flags: ["surfactant"]
  },
  {
    canonical_name: "coco-glucoside",
    aliases: ["coco-glucoside", "coco glucoside"],
    category: "surfactant",
    risk_level: "low",
    flags: ["surfactant"]
  },
  {
    canonical_name: "disodium cocoamphodiacetate",
    aliases: ["disodium cocoamphodiacetate"],
    category: "surfactant",
    risk_level: "low",
    flags: ["surfactant"]
  },

  // ── Preservatives / functional ───────────────────────────────────────────────
  {
    canonical_name: "phenoxyethanol",
    aliases: ["phenoxyethanol"],
    category: "preservative",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "ethylhexylglycerin",
    aliases: ["ethylhexylglycerin"],
    category: "preservative",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "chlorphenesin",
    aliases: ["chlorphenesin"],
    category: "preservative",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "sodium benzoate",
    aliases: ["sodium benzoate"],
    category: "preservative",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "potassium sorbate",
    aliases: ["potassium sorbate"],
    category: "preservative",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "disodium edta",
    aliases: ["disodium edta", "edta", "disodium edetate"],
    category: "chelating",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "xanthan gum",
    aliases: ["xanthan gum"],
    category: "thickener",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "carbomer",
    aliases: ["carbomer"],
    category: "thickener",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "acrylates/c10-30 alkyl acrylate crosspolymer",
    aliases: ["acrylates/c10-30 alkyl acrylate crosspolymer"],
    category: "thickener",
    risk_level: "low",
    flags: []
  },

  // ── Fragrance allergens ──────────────────────────────────────────────────────
  {
    canonical_name: "fragrance",
    aliases: ["parfum", "fragrance", "aroma"],
    category: "fragrance",
    risk_level: "medium",
    flags: ["fragrance"]
  },
  {
    canonical_name: "linalool",
    aliases: ["linalool"],
    category: "fragrance",
    risk_level: "medium",
    flags: ["fragrance", "allergen"]
  },
  {
    canonical_name: "limonene",
    aliases: ["limonene", "d-limonene"],
    category: "fragrance",
    risk_level: "medium",
    flags: ["fragrance", "allergen"]
  },
  {
    canonical_name: "citronellol",
    aliases: ["citronellol"],
    category: "fragrance",
    risk_level: "medium",
    flags: ["fragrance", "allergen"]
  },
  {
    canonical_name: "geraniol",
    aliases: ["geraniol"],
    category: "fragrance",
    risk_level: "medium",
    flags: ["fragrance", "allergen"]
  },
  {
    canonical_name: "hexyl cinnamal",
    aliases: ["hexyl cinnamal", "hexyl cinnamaldehyde"],
    category: "fragrance",
    risk_level: "medium",
    flags: ["fragrance", "allergen"]
  },

  // ── Silicones (extended) ─────────────────────────────────────────────────────
  {
    canonical_name: "cyclohexasiloxane",
    aliases: ["cyclohexasiloxane", "d6"],
    category: "emollient",
    risk_level: "medium",
    flags: ["silicone"]
  },
  {
    canonical_name: "trimethicone",
    aliases: ["trimethicone"],
    category: "emollient",
    risk_level: "low",
    flags: ["silicone"]
  },
  {
    canonical_name: "amodimethicone",
    aliases: ["amodimethicone"],
    category: "emollient",
    risk_level: "low",
    flags: ["silicone"]
  },
  {
    canonical_name: "dimethiconol",
    aliases: ["dimethiconol"],
    category: "emollient",
    risk_level: "low",
    flags: ["silicone"]
  },

  // ── PEG / polymers ───────────────────────────────────────────────────────────
  {
    canonical_name: "peg-100 stearate",
    aliases: ["peg-100 stearate", "peg 100 stearate", "polyethylene glycol 100 stearate"],
    category: "emulsifier",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "peg-40 hydrogenated castor oil",
    aliases: ["peg-40 hydrogenated castor oil", "peg 40 hydrogenated castor oil"],
    category: "emulsifier",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "peg-7 glyceryl cocoate",
    aliases: ["peg-7 glyceryl cocoate", "peg 7 glyceryl cocoate"],
    category: "emulsifier",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "acrylates copolymer",
    aliases: ["acrylates copolymer"],
    category: "thickener",
    risk_level: "low",
    flags: []
  },

  // ── Emulsifiers / texture ────────────────────────────────────────────────────
  {
    canonical_name: "glyceryl stearate",
    aliases: ["glyceryl stearate"],
    category: "emulsifier",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "stearic acid",
    aliases: ["stearic acid"],
    category: "emulsifier",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "ceteareth-20",
    aliases: ["ceteareth-20", "ceteareth 20"],
    category: "emulsifier",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "hydroxyethylcellulose",
    aliases: ["hydroxyethylcellulose", "hec"],
    category: "thickener",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "sodium polyacrylate",
    aliases: ["sodium polyacrylate"],
    category: "thickener",
    risk_level: "low",
    flags: []
  },

  // ── Solvents / co-preservatives ──────────────────────────────────────────────
  {
    canonical_name: "caprylyl glycol",
    aliases: ["caprylyl glycol"],
    category: "solvent",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "1,2-hexanediol",
    aliases: ["1,2-hexanediol", "hexanediol"],
    category: "solvent",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "benzyl alcohol",
    aliases: ["benzyl alcohol"],
    category: "preservative",
    risk_level: "medium",
    flags: ["preservative"]
  },
  {
    canonical_name: "dehydroacetic acid",
    aliases: ["dehydroacetic acid"],
    category: "preservative",
    risk_level: "low",
    flags: ["preservative"]
  },
  {
    canonical_name: "benzoic acid",
    aliases: ["benzoic acid"],
    category: "preservative",
    risk_level: "low",
    flags: ["preservative"]
  },

  // ── Actives / exfoliants ─────────────────────────────────────────────────────
  {
    canonical_name: "salicylic acid",
    aliases: ["salicylic acid", "bha"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },
  {
    canonical_name: "glycolic acid",
    aliases: ["glycolic acid"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },
  {
    canonical_name: "lactic acid",
    aliases: ["lactic acid"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },
  {
    canonical_name: "mandelic acid",
    aliases: ["mandelic acid"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },
  {
    canonical_name: "azelaic acid",
    aliases: ["azelaic acid"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "kojic acid",
    aliases: ["kojic acid"],
    category: "active",
    risk_level: "medium",
    flags: ["active"]
  },
  {
    canonical_name: "tranexamic acid",
    aliases: ["tranexamic acid"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "alpha arbutin",
    aliases: ["alpha arbutin", "alpha-arbutin"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "bakuchiol",
    aliases: ["bakuchiol"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "resveratrol",
    aliases: ["resveratrol"],
    category: "antioxidant",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "ferulic acid",
    aliases: ["ferulic acid"],
    category: "antioxidant",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "adenosine",
    aliases: ["adenosine"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "ubiquinone",
    aliases: ["ubiquinone", "coenzyme q10", "coq10"],
    category: "antioxidant",
    risk_level: "low",
    flags: ["active"]
  },

  // ── Barrier / repair (extended) ──────────────────────────────────────────────
  {
    canonical_name: "phytosphingosine",
    aliases: ["phytosphingosine"],
    category: "barrier",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "beta-glucan",
    aliases: ["beta-glucan", "beta glucan", "oat beta glucan"],
    category: "soothing",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "hydrolyzed collagen",
    aliases: ["hydrolyzed collagen", "soluble collagen"],
    category: "barrier",
    risk_level: "low",
    flags: ["barrier_support"]
  },
  {
    canonical_name: "hydrolyzed silk",
    aliases: ["hydrolyzed silk", "silk amino acids"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "polyglutamic acid",
    aliases: ["polyglutamic acid", "pga"],
    category: "humectant",
    risk_level: "low",
    flags: []
  },

  // ── Peptides ─────────────────────────────────────────────────────────────────
  {
    canonical_name: "palmitoyl pentapeptide-4",
    aliases: ["palmitoyl pentapeptide-4", "matrixyl", "palmitoyl pentapeptide 4"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "acetyl hexapeptide-3",
    aliases: ["acetyl hexapeptide-3", "argireline", "acetyl hexapeptide 3"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },

  // ── Sun filters ──────────────────────────────────────────────────────────────
  {
    canonical_name: "zinc oxide",
    aliases: ["zinc oxide"],
    category: "sunfilter",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "titanium dioxide",
    aliases: ["titanium dioxide", "ci 77891"],
    category: "sunfilter",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "ethylhexyl methoxycinnamate",
    aliases: ["ethylhexyl methoxycinnamate", "octinoxate", "octyl methoxycinnamate"],
    category: "sunfilter",
    risk_level: "medium",
    flags: []
  },
  {
    canonical_name: "avobenzone",
    aliases: ["avobenzone", "butyl methoxydibenzoylmethane"],
    category: "sunfilter",
    risk_level: "medium",
    flags: []
  },
  {
    canonical_name: "octocrylene",
    aliases: ["octocrylene"],
    category: "sunfilter",
    risk_level: "medium",
    flags: []
  },

  // ── Plant oils ───────────────────────────────────────────────────────────────
  {
    canonical_name: "jojoba oil",
    aliases: ["simmondsia chinensis seed oil", "jojoba oil", "jojoba"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "argan oil",
    aliases: ["argania spinosa kernel oil", "argan oil"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "rosehip oil",
    aliases: ["rosa canina fruit oil", "rosehip oil", "rosa canina seed oil"],
    category: "emollient",
    risk_level: "low",
    flags: []
  },

  // ── Botanicals / extracts ────────────────────────────────────────────────────
  {
    canonical_name: "aloe barbadensis leaf extract",
    aliases: ["aloe barbadensis leaf extract", "aloe vera extract", "aloe vera", "aloe barbadensis leaf juice"],
    category: "soothing",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "camellia sinensis leaf extract",
    aliases: ["camellia sinensis leaf extract", "green tea extract", "camellia sinensis extract"],
    category: "antioxidant",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "chamomilla recutita extract",
    aliases: ["chamomilla recutita extract", "chamomile extract", "matricaria chamomilla extract"],
    category: "soothing",
    risk_level: "low",
    flags: []
  },
  {
    canonical_name: "glycyrrhiza glabra root extract",
    aliases: ["glycyrrhiza glabra root extract", "licorice root extract", "licorice extract"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "avena sativa kernel extract",
    aliases: ["avena sativa kernel extract", "oat extract", "colloidal oatmeal"],
    category: "soothing",
    risk_level: "low",
    flags: ["barrier_support"]
  },

  // ── Minerals / trace elements ─────────────────────────────────────────────────
  {
    canonical_name: "zinc gluconate",
    aliases: ["zinc gluconate"],
    category: "active",
    risk_level: "low",
    flags: ["active"]
  },
  {
    canonical_name: "magnesium gluconate",
    aliases: ["magnesium gluconate"],
    category: "active",
    risk_level: "low",
    flags: []
  },

  // ── Additional surfactants ────────────────────────────────────────────────────
  {
    canonical_name: "lauryl glucoside",
    aliases: ["lauryl glucoside"],
    category: "surfactant",
    risk_level: "low",
    flags: ["surfactant"]
  },
  {
    canonical_name: "sodium cocoyl isethionate",
    aliases: ["sodium cocoyl isethionate", "sci"],
    category: "surfactant",
    risk_level: "low",
    flags: ["surfactant"]
  }
];
