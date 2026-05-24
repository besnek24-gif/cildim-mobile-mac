/**
 * Dermatolojik Güvenlik Puan Motoru (Pure JavaScript)
 * dermoScore.ts ile senkronize tutun.
 * Kullanım: import { calcDermoScore, extractIngredientNames } from './dermo-score-engine.js'
 */

// ─── İçerik Veritabanı ────────────────────────────────────────────────────────
const DB = {
  // ÇÖZÜCÜLER & TAŞIYICILAR
  "water": { level: "safe", score: 92 },
  "aqua": { level: "safe", score: 92 },
  "glycerin": { level: "beneficial", score: 95 },
  "glycerol": { level: "beneficial", score: 95 },
  "propylene glycol": { level: "mild", score: 65 },
  "butylene glycol": { level: "safe", score: 80 },
  "pentylene glycol": { level: "safe", score: 82 },
  "hexylene glycol": { level: "mild", score: 63 },
  "dipropylene glycol": { level: "safe", score: 78 },
  "ethoxydiglycol": { level: "mild", score: 68 },

  // EMOLİENTLER & YAĞLAR
  "squalane": { level: "beneficial", score: 97 },
  "squalene": { level: "beneficial", score: 96 },
  "jojoba oil": { level: "beneficial", score: 94 },
  "simmondsia chinensis seed oil": { level: "beneficial", score: 94 },
  "rosehip oil": { level: "beneficial", score: 92 },
  "rosa canina fruit oil": { level: "beneficial", score: 92 },
  "argan oil": { level: "beneficial", score: 93 },
  "argania spinosa kernel oil": { level: "beneficial", score: 93 },
  "marula oil": { level: "beneficial", score: 91 },
  "sea buckthorn oil": { level: "beneficial", score: 90 },
  "hippophae rhamnoides fruit oil": { level: "beneficial", score: 90 },
  "coconut oil": { level: "mild", score: 70 },
  "cocos nucifera oil": { level: "mild", score: 70 },
  "sweet almond oil": { level: "beneficial", score: 88 },
  "prunus amygdalus dulcis oil": { level: "beneficial", score: 88 },
  "avocado oil": { level: "beneficial", score: 87 },
  "persea gratissima oil": { level: "beneficial", score: 87 },
  "olive oil": { level: "safe", score: 82 },
  "olea europaea fruit oil": { level: "safe", score: 82 },
  "sunflower seed oil": { level: "beneficial", score: 89 },
  "helianthus annuus seed oil": { level: "beneficial", score: 89 },
  "hemp seed oil": { level: "beneficial", score: 90 },
  "cannabis sativa seed oil": { level: "beneficial", score: 90 },
  "macadamia seed oil": { level: "beneficial", score: 91 },
  "macadamia ternifolia seed oil": { level: "beneficial", score: 91 },
  "castor oil": { level: "mild", score: 68 },
  "ricinus communis seed oil": { level: "mild", score: 68 },
  "shea butter": { level: "beneficial", score: 93 },
  "butyrospermum parkii butter": { level: "beneficial", score: 93 },
  "cocoa butter": { level: "mild", score: 66 },
  "theobroma cacao seed butter": { level: "mild", score: 66 },
  "mango butter": { level: "beneficial", score: 87 },
  "mangifera indica seed butter": { level: "beneficial", score: 87 },
  "caprylic/capric triglyceride": { level: "beneficial", score: 94 },
  "isopropyl myristate": { level: "mild", score: 60 },
  "isopropyl palmitate": { level: "mild", score: 58 },
  "isopropyl isostearate": { level: "mild", score: 60 },
  "cetyl alcohol": { level: "safe", score: 84 },
  "cetearyl alcohol": { level: "safe", score: 83 },
  "stearyl alcohol": { level: "safe", score: 82 },
  "behenyl alcohol": { level: "safe", score: 83 },
  "myristyl alcohol": { level: "safe", score: 80 },
  "mineral oil": { level: "mild", score: 65 },
  "paraffinum liquidum": { level: "mild", score: 65 },
  "petrolatum": { level: "safe", score: 77 },
  "vaseline": { level: "safe", score: 77 },
  "lanolin": { level: "mild", score: 67 },
  "dimethicone": { level: "safe", score: 85 },
  "cyclopentasiloxane": { level: "moderate", score: 52 },
  "cyclomethicone": { level: "moderate", score: 52 },
  "cyclohexasiloxane": { level: "moderate", score: 48 },
  "simethicone": { level: "safe", score: 84 },
  "phenyl trimethicone": { level: "safe", score: 82 },
  "amodimethicone": { level: "safe", score: 80 },

  // NEMLENDİRİCİLER
  "hyaluronic acid": { level: "beneficial", score: 98 },
  "sodium hyaluronate": { level: "beneficial", score: 98 },
  "hydrolyzed hyaluronic acid": { level: "beneficial", score: 96 },
  "sodium acetylated hyaluronate": { level: "beneficial", score: 96 },
  "sorbitol": { level: "safe", score: 86 },
  "panthenol": { level: "beneficial", score: 95 },
  "dexpanthenol": { level: "beneficial", score: 95 },
  "urea": { level: "beneficial", score: 90 },
  "sodium pca": { level: "beneficial", score: 91 },
  "lactic acid": { level: "beneficial", score: 85 },
  "sodium lactate": { level: "safe", score: 83 },
  "inositol": { level: "beneficial", score: 90 },
  "betaine": { level: "safe", score: 88 },
  "aloe vera": { level: "beneficial", score: 94 },
  "aloe barbadensis leaf juice": { level: "beneficial", score: 94 },
  "aloe barbadensis leaf extract": { level: "beneficial", score: 93 },
  "tremella fuciformis sporocarp extract": { level: "beneficial", score: 92 },

  // AKTİF BİLEŞENLER
  "niacinamide": { level: "beneficial", score: 99 },
  "nicotinamide": { level: "beneficial", score: 99 },
  "retinol": { level: "beneficial", score: 91 },
  "retinyl palmitate": { level: "safe", score: 78 },
  "retinyl acetate": { level: "safe", score: 77 },
  "retinal": { level: "beneficial", score: 93 },
  "hydroxypinacolone retinoate": { level: "beneficial", score: 90 },
  "granactive retinoid": { level: "beneficial", score: 90 },
  "ascorbic acid": { level: "beneficial", score: 94 },
  "vitamin c": { level: "beneficial", score: 94 },
  "sodium ascorbyl phosphate": { level: "beneficial", score: 90 },
  "ascorbyl glucoside": { level: "beneficial", score: 89 },
  "magnesium ascorbyl phosphate": { level: "beneficial", score: 89 },
  "3-o-ethyl ascorbic acid": { level: "beneficial", score: 91 },
  "tocopherol": { level: "beneficial", score: 95 },
  "tocopheryl acetate": { level: "safe", score: 83 },
  "vitamin e": { level: "beneficial", score: 95 },
  "alpha-tocopherol": { level: "beneficial", score: 95 },
  "kojic acid": { level: "safe", score: 80 },
  "alpha arbutin": { level: "beneficial", score: 91 },
  "arbutin": { level: "beneficial", score: 89 },
  "tranexamic acid": { level: "beneficial", score: 90 },
  "hydroquinone": { level: "high_concern", score: 28 },
  "glycolic acid": { level: "beneficial", score: 86 },
  "mandelic acid": { level: "beneficial", score: 88 },
  "tartaric acid": { level: "safe", score: 81 },
  "citric acid": { level: "safe", score: 82 },
  "malic acid": { level: "safe", score: 81 },
  "salicylic acid": { level: "beneficial", score: 90 },
  "polyhydroxy acid": { level: "beneficial", score: 88 },
  "gluconolactone": { level: "beneficial", score: 89 },
  "lactobionic acid": { level: "beneficial", score: 88 },
  "azelaic acid": { level: "beneficial", score: 93 },
  "ferulic acid": { level: "beneficial", score: 92 },
  "resveratrol": { level: "beneficial", score: 91 },
  "coenzyme q10": { level: "beneficial", score: 90 },
  "ubiquinone": { level: "beneficial", score: 90 },
  "ceramide np": { level: "beneficial", score: 97 },
  "ceramide ap": { level: "beneficial", score: 97 },
  "ceramide eop": { level: "beneficial", score: 97 },
  "ceramide eg": { level: "beneficial", score: 96 },
  "ceramide ng": { level: "beneficial", score: 96 },
  "ceramide ns": { level: "beneficial", score: 96 },
  "ceramide as": { level: "beneficial", score: 96 },
  "cholesterol": { level: "beneficial", score: 90 },
  "phytosphingosine": { level: "beneficial", score: 91 },
  "sphingosine": { level: "beneficial", score: 89 },
  "peptide": { level: "beneficial", score: 91 },
  "palmitoyl tripeptide-1": { level: "beneficial", score: 92 },
  "palmitoyl tripeptide-38": { level: "beneficial", score: 91 },
  "palmitoyl pentapeptide-4": { level: "beneficial", score: 91 },
  "acetyl hexapeptide-3": { level: "beneficial", score: 90 },
  "acetyl hexapeptide-8": { level: "beneficial", score: 90 },
  "copper peptide": { level: "beneficial", score: 92 },
  "copper tripeptide-1": { level: "beneficial", score: 93 },
  "collagen": { level: "safe", score: 83 },
  "hydrolyzed collagen": { level: "beneficial", score: 88 },
  "elastin": { level: "safe", score: 82 },
  "hydrolyzed elastin": { level: "safe", score: 85 },
  "silk amino acids": { level: "beneficial", score: 88 },
  "keratin": { level: "safe", score: 82 },
  "hydrolyzed keratin": { level: "beneficial", score: 86 },
  "bakuchiol": { level: "beneficial", score: 94 },
  "centella asiatica extract": { level: "beneficial", score: 94 },
  "centella asiatica": { level: "beneficial", score: 94 },
  "cica": { level: "beneficial", score: 93 },
  "madecassoside": { level: "beneficial", score: 94 },
  "asiaticoside": { level: "beneficial", score: 93 },
  "asiatic acid": { level: "beneficial", score: 93 },
  "madecassic acid": { level: "beneficial", score: 93 },
  "tea tree oil": { level: "mild", score: 71 },
  "melaleuca alternifolia leaf oil": { level: "mild", score: 71 },
  "green tea extract": { level: "beneficial", score: 94 },
  "camellia sinensis leaf extract": { level: "beneficial", score: 94 },
  "licorice root extract": { level: "beneficial", score: 91 },
  "glycyrrhiza glabra root extract": { level: "beneficial", score: 91 },
  "turmeric extract": { level: "beneficial", score: 89 },
  "curcuma longa root extract": { level: "beneficial", score: 89 },
  "rosemary extract": { level: "beneficial", score: 87 },
  "rosmarinus officinalis leaf extract": { level: "beneficial", score: 87 },
  "chamomile extract": { level: "beneficial", score: 91 },
  "matricaria recutita flower extract": { level: "beneficial", score: 91 },
  "chamomilla recutita flower extract": { level: "beneficial", score: 91 },
  "bisabolol": { level: "beneficial", score: 93 },
  "alpha-bisabolol": { level: "beneficial", score: 93 },
  "oat extract": { level: "beneficial", score: 93 },
  "avena sativa kernel extract": { level: "beneficial", score: 93 },
  "colloidal oatmeal": { level: "beneficial", score: 93 },
  "allantoin": { level: "beneficial", score: 94 },
  "zinc oxide": { level: "beneficial", score: 95 },
  "titanium dioxide": { level: "beneficial", score: 92 },
  "zinc pca": { level: "beneficial", score: 92 },
  "niacinamide phosphate": { level: "beneficial", score: 91 },
  "adenosine": { level: "beneficial", score: 91 },
  "epidermal growth factor": { level: "beneficial", score: 88 },
  "sh-oligopeptide-1": { level: "beneficial", score: 88 },
  "hexylresorcinol": { level: "beneficial", score: 87 },
  "resorcinol": { level: "moderate", score: 50 },
  "phenylethyl resorcinol": { level: "safe", score: 80 },
  "lipoic acid": { level: "beneficial", score: 89 },
  "coq10": { level: "beneficial", score: 90 },
  "astaxanthin": { level: "beneficial", score: 92 },
  "pycnogenol": { level: "beneficial", score: 91 },
  "beta-glucan": { level: "beneficial", score: 93 },
  "hyaluronate crosspolymer": { level: "beneficial", score: 93 },
  "sodium hyaluronate crosspolymer": { level: "beneficial", score: 93 },
  "polyglutamic acid": { level: "beneficial", score: 92 },
  "tremella extract": { level: "beneficial", score: 91 },
  "snow mushroom extract": { level: "beneficial", score: 91 },
  "mushroom extract": { level: "beneficial", score: 89 },

  // GÜNEŞ FİLTRELERİ
  "oxybenzone": { level: "high_concern", score: 22 },
  "benzophenone-3": { level: "high_concern", score: 22 },
  "octinoxate": { level: "moderate", score: 45 },
  "octyl methoxycinnamate": { level: "moderate", score: 45 },
  "avobenzone": { level: "mild", score: 68 },
  "butyl methoxydibenzoylmethane": { level: "mild", score: 68 },
  "octocrylene": { level: "moderate", score: 50 },
  "homosalate": { level: "moderate", score: 48 },
  "octisalate": { level: "mild", score: 64 },
  "ethylhexyl salicylate": { level: "mild", score: 64 },
  "tinosorb s": { level: "safe", score: 84 },
  "bemotrizinol": { level: "safe", score: 84 },
  "tinosorb m": { level: "safe", score: 83 },
  "bisoctrizole": { level: "safe", score: 83 },
  "mexoryl sx": { level: "safe", score: 85 },
  "ecamsule": { level: "safe", score: 85 },
  "mexoryl xl": { level: "safe", score: 84 },
  "drometrizole trisiloxane": { level: "safe", score: 84 },

  // EMÜLGATÖRler & STABİLİZATÖRLER
  "polysorbate 20": { level: "safe", score: 80 },
  "polysorbate 40": { level: "safe", score: 79 },
  "polysorbate 60": { level: "safe", score: 78 },
  "polysorbate 80": { level: "safe", score: 79 },
  "glyceryl stearate": { level: "safe", score: 84 },
  "glyceryl stearate se": { level: "safe", score: 82 },
  "stearic acid": { level: "safe", score: 82 },
  "palmitic acid": { level: "safe", score: 82 },
  "lauric acid": { level: "mild", score: 67 },
  "ceteareth-20": { level: "safe", score: 78 },
  "peg-100 stearate": { level: "safe", score: 76 },
  "peg-40 hydrogenated castor oil": { level: "mild", score: 68 },
  "carbomer": { level: "safe", score: 82 },
  "carbopol": { level: "safe", score: 81 },
  "acrylates/c10-30 alkyl acrylate crosspolymer": { level: "safe", score: 79 },
  "hydroxypropyl methylcellulose": { level: "safe", score: 84 },
  "hydroxyethylcellulose": { level: "safe", score: 84 },
  "xanthan gum": { level: "safe", score: 86 },
  "cellulose gum": { level: "safe", score: 85 },
  "guar gum": { level: "safe", score: 85 },
  "sclerotium gum": { level: "safe", score: 85 },
  "sodium polyacrylate": { level: "safe", score: 80 },

  // KORUYUCULAR
  "phenoxyethanol": { level: "mild", score: 71 },
  "ethylhexylglycerin": { level: "safe", score: 82 },
  "caprylyl glycol": { level: "safe", score: 83 },
  "chlorphenesin": { level: "mild", score: 65 },
  "sodium benzoate": { level: "mild", score: 66 },
  "potassium sorbate": { level: "safe", score: 82 },
  "sorbic acid": { level: "mild", score: 70 },
  "benzyl alcohol": { level: "mild", score: 62 },
  "dehydroacetic acid": { level: "safe", score: 78 },
  "sodium dehydroacetate": { level: "safe", score: 78 },
  "parabens": { level: "moderate", score: 44 },
  "methylparaben": { level: "moderate", score: 46 },
  "ethylparaben": { level: "moderate", score: 45 },
  "propylparaben": { level: "moderate", score: 40 },
  "butylparaben": { level: "moderate", score: 38 },
  "isobutylparaben": { level: "high_concern", score: 32 },
  "isopropylparaben": { level: "high_concern", score: 32 },
  "dmdm hydantoin": { level: "high_concern", score: 25 },
  "imidazolidinyl urea": { level: "high_concern", score: 28 },
  "diazolidinyl urea": { level: "high_concern", score: 26 },
  "quaternium-15": { level: "high_concern", score: 20 },
  "bronopol": { level: "high_concern", score: 22 },
  "2-bromo-2-nitropropane-1,3-diol": { level: "high_concern", score: 22 },
  "methylisothiazolinone": { level: "high_concern", score: 18 },
  "methylchloroisothiazolinone": { level: "high_concern", score: 15 },
  "kathon cg": { level: "high_concern", score: 15 },
  "triclosan": { level: "high_concern", score: 20 },
  "chloroxylenol": { level: "moderate", score: 48 },

  // SURFAKTANLAR
  "sodium lauryl sulfate": { level: "high_concern", score: 24 },
  "sls": { level: "high_concern", score: 24 },
  "sodium laureth sulfate": { level: "moderate", score: 44 },
  "sles": { level: "moderate", score: 44 },
  "ammonium lauryl sulfate": { level: "high_concern", score: 26 },
  "ammonium laureth sulfate": { level: "moderate", score: 46 },
  "cocamidopropyl betaine": { level: "mild", score: 72 },
  "sodium cocoyl glutamate": { level: "safe", score: 84 },
  "disodium cocoyl glutamate": { level: "safe", score: 84 },
  "sodium lauroyl sarcosinate": { level: "safe", score: 83 },
  "sodium cocoamphoacetate": { level: "safe", score: 82 },
  "coco-glucoside": { level: "beneficial", score: 89 },
  "decyl glucoside": { level: "beneficial", score: 89 },
  "lauryl glucoside": { level: "safe", score: 85 },
  "caprylyl/capryl glucoside": { level: "beneficial", score: 88 },
  "sodium cocoyl isethionate": { level: "safe", score: 83 },

  // ALKOLLER
  "alcohol": { level: "moderate", score: 50 },
  "alcohol denat": { level: "moderate", score: 48 },
  "ethanol": { level: "moderate", score: 50 },
  "sd alcohol": { level: "moderate", score: 48 },
  "isopropanol": { level: "moderate", score: 46 },
  "isopropyl alcohol": { level: "moderate", score: 46 },

  // PARFÜMLER
  "fragrance": { level: "moderate", score: 42 },
  "parfum": { level: "moderate", score: 42 },
  "linalool": { level: "mild", score: 62 },
  "limonene": { level: "mild", score: 60 },
  "eugenol": { level: "mild", score: 58 },
  "citronellol": { level: "mild", score: 62 },
  "geraniol": { level: "mild", score: 61 },
  "cinnamyl alcohol": { level: "moderate", score: 48 },
  "cinnamal": { level: "moderate", score: 46 },
  "isoeugenol": { level: "moderate", score: 45 },
  "benzyl salicylate": { level: "mild", score: 60 },
  "coumarin": { level: "mild", score: 55 },
  "musk ketone": { level: "high_concern", score: 28 },
  "musk ambrette": { level: "avoid", score: 10 },
  "lilial": { level: "avoid", score: 8 },
  "butylphenyl methylpropional": { level: "avoid", score: 8 },

  // RENK MADDELERİ
  "fd&c red no. 40": { level: "mild", score: 62 },
  "ci 16035": { level: "mild", score: 62 },
  "blue 1": { level: "mild", score: 63 },
  "ci 42090": { level: "mild", score: 63 },
  "iron oxides": { level: "safe", score: 86 },
  "ci 77491": { level: "safe", score: 86 },
  "ci 77492": { level: "safe", score: 86 },
  "ci 77499": { level: "safe", score: 86 },
  "mica": { level: "safe", score: 85 },
  "ultramarines": { level: "safe", score: 84 },
  "ci 77007": { level: "safe", score: 84 },

  // PH AYARLAYICILAR
  "triethanolamine": { level: "moderate", score: 50 },
  "tea": { level: "moderate", score: 50 },
  "diethanolamine": { level: "high_concern", score: 28 },
  "dea": { level: "high_concern", score: 28 },
  "monoethanolamine": { level: "moderate", score: 48 },
  "sodium hydroxide": { level: "safe", score: 80 },
  "potassium hydroxide": { level: "safe", score: 80 },
  "ammonium hydroxide": { level: "mild", score: 65 },

  // ENDİŞELİ BİLEŞENLER
  "formaldehyde": { level: "avoid", score: 2 },
  "lead": { level: "avoid", score: 0 },
  "mercury": { level: "avoid", score: 0 },
  "thimerosal": { level: "avoid", score: 5 },
  "phthalates": { level: "high_concern", score: 20 },
  "dibutyl phthalate": { level: "high_concern", score: 18 },
  "diethylhexyl phthalate": { level: "high_concern", score: 18 },
  "talc": { level: "mild", score: 68 },
  "bha": { level: "moderate", score: 44 },
  "bht": { level: "moderate", score: 50 },
  "butylated hydroxyanisole": { level: "moderate", score: 44 },
  "butylated hydroxytoluene": { level: "moderate", score: 50 },
  "aluminum": { level: "moderate", score: 48 },
  "aluminum chlorohydrate": { level: "moderate", score: 46 },
  "aluminum zirconium tetrachlorohydrex gly": { level: "moderate", score: 44 },
  "polyacrylamide": { level: "moderate", score: 50 },
  "styrene/acrylates copolymer": { level: "mild", score: 65 },
  "ethylene oxide": { level: "avoid", score: 5 },
  "1,4-dioxane": { level: "avoid", score: 5 },
  "retinoic acid": { level: "high_concern", score: 30 },
  "tretinoin": { level: "high_concern", score: 30 },

  // MİNERAL & DİĞER
  "kaolin": { level: "safe", score: 84 },
  "bentonite": { level: "safe", score: 82 },
  "silica": { level: "safe", score: 85 },
  "magnesium sulfate": { level: "safe", score: 83 },
  "sodium chloride": { level: "safe", score: 85 },
  "zinc sulfate": { level: "safe", score: 82 },
  "sulfur": { level: "safe", score: 78 },
  "charcoal": { level: "safe", score: 81 },
  "activated charcoal": { level: "safe", score: 81 },
};

// ─── Fonksiyonlar ─────────────────────────────────────────────────────────────

export function parseIngredientsText(text) {
  return text
    .split(/[,،]/g)
    .map(s => s.trim().toLowerCase().replace(/\*/g, "").replace(/\.$/, ""))
    .filter(Boolean);
}

export function lookupIngredient(name) {
  const key = name.toLowerCase().trim();
  if (DB[key]) return DB[key];
  for (const [dbKey, entry] of Object.entries(DB)) {
    if (key.includes(dbKey) || dbKey.includes(key)) return entry;
  }
  return null;
}

export function scoreToLabel(score) {
  if (score >= 85) return "Mükemmel";
  if (score >= 70) return "İyi";
  if (score >= 55) return "Orta";
  if (score >= 40) return "Dikkatli";
  if (score >= 25) return "Riskli";
  return "Kaçınılmalı";
}

export function calcDermoScore(ingredientNames) {
  if (!ingredientNames || ingredientNames.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;
  let analyzed = 0;
  let hasAvoid = false;
  let hasHighConcern = false;

  ingredientNames.forEach((name, idx) => {
    const posWeight = idx < 5 ? 3 : idx < 15 ? 2 : 1;
    const entry = lookupIngredient(name);
    if (!entry) return;
    analyzed++;
    weightedSum += entry.score * posWeight;
    totalWeight += posWeight;
    if (entry.level === "avoid") hasAvoid = true;
    if (entry.level === "high_concern") hasHighConcern = true;
  });

  if (analyzed === 0) return null;

  let total = Math.round(weightedSum / totalWeight);
  if (hasAvoid) total = Math.min(total, 40);
  else if (hasHighConcern) total = Math.min(total, 62);
  total = Math.max(0, Math.min(100, total));

  return {
    total,
    label: scoreToLabel(total),
    analyzed,
    total_ingredients: ingredientNames.length,
  };
}

export function extractIngredientNames(product) {
  const structured =
    product.icerik_analizi?.icerikler ??
    product.ingredients_parsed ??
    [];
  if (structured.length > 0) {
    return structured.map(i => (i.inci_adi ?? i.isim).toLowerCase().trim());
  }
  if (typeof product.ingredients === "string" && product.ingredients) {
    return parseIngredientsText(product.ingredients);
  }
  return [];
}

export function calcDermoScoreForProduct(product) {
  const names = extractIngredientNames(product);
  return calcDermoScore(names);
}
