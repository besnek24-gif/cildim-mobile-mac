/**
 * analyze-corpus.ts — Ingredient Intelligence Corpus Analyzer
 *
 * Fetches all 28 real products from Supabase, runs the ingredient pipeline,
 * and reports coverage stats + top unresolved tokens.
 *
 * Run: node --loader tsx/esm scripts/analyze-corpus.ts
 *  or: ../../node_modules/.bin/tsx --tsconfig tsconfig.json scripts/analyze-corpus.ts
 */

import { buildCorpus, printCorpusReport } from "../lib/ingredientIntelligence/corpusBuilder";

// ── Inline product ingredient corpus (from 28 real products in DB) ───────────
// Populated from Supabase snapshot — avoids a live DB query in this script.
// Update whenever new products are added to the catalog.

const PRODUCT_CORPUS = [
  {
    name: "Eucerin Sun Oil Control SPF 50+",
    ingredients: "Aqua, Homosalate, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Octocrylene, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Diethylhexyl Butamido Triazone, Alcohol Denat., Glycerin, Silica, Niacinamide, Cetearyl Alcohol, Phenylbenzimidazole Sulfonic Acid, Styrene/Acrylates Copolymer, Sodium Hydroxide, Triethanolamine, Dimethicone, Hydroxyacetophenone, Disodium EDTA, Caprylyl Glycol, Tridecyl Trimellitate, Tridecyl Neopentanoate, Ammonium Acryloyldimethyltaurate/VP Copolymer, Laminaria Saccharina Extract"
  },
  {
    name: "Ducray Melascreen UV SPF 50+",
    ingredients: "Aqua/Water/Eau, Homosalate, Ethylhexyl Salicylate, Octocrylene, Butyl Methoxydibenzoylmethane, Diethylhexyl Butamido Triazone, Glycerin, Propanediol, Alcohol Denat, Cetearyl Alcohol, Caprylyl Methicone, Pentaerythrityl Distearate, Niacinamide, Silica, Dimethicone, Phenoxyethanol, Chlorphenesin, Disodium EDTA, Carbomer, Styrene/Acrylates Copolymer, Tocopheryl Acetate, Sodium Hydroxide, Cetyl Alcohol, Microcrystalline Cellulose, Cellulose Gum, Panthenol, Hydroxyacetophenone, Cetearyl Glucoside, Allantoin, Bisabolol, Caprylyl Glycol, Lactic Acid"
  },
  {
    name: "Keracnyl Repair Crème",
    ingredients: "Aqua, Glycerin, Dimethicone, Propylene Glycol, Cetearyl Alcohol, Niacinamide, Carbomer, Zinc PCA, Allantoin, Panthenol, Tocopheryl Acetate, Bisabolol, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol, Sodium Hyaluronate, Caprylic/Capric Triglyceride, Cetyl Alcohol, Stearyl Alcohol, Phenoxyethanol, Ethylhexylglycerin, Caprylyl Glycol, Disodium EDTA, Sodium Lauroyl Lactylate, Carbomer, Xanthan Gum, Potassium Hydroxide, Citric Acid"
  },
  {
    name: "La Roche-Posay Effaclar Duo+",
    ingredients: "Aqua, Glycerin, Niacinamide, Zinc Pidolate, Salicylic Acid, Capryloyl Salicylic Acid, Lipo-Hydroxy Acid, Propylene Glycol, Dimethicone, Cetearyl Alcohol, Phenoxyethanol, Ethylhexylglycerin, Carbomer, Sodium Hydroxide, Disodium EDTA, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol, Caprylyl Glycol, Tocopheryl Acetate, Panthenol"
  },
  {
    name: "Avène Cicalfate+ Cream",
    ingredients: "Aqua, Avene Thermal Spring Water, Glycerin, Sucrose Octasulfate, Zinc Oxide, Dimethicone, Cetearyl Alcohol, Phenoxyethanol, Chlorhexidine Digluconate, Propylene Glycol, Titanium Dioxide, Carbomer, Sodium Hydroxide, Disodium EDTA, Triethanolamine, Simethicone, Sucrose, Xanthan Gum"
  },
  {
    name: "CeraVe Moisturizing Cream",
    ingredients: "Aqua, Glycerin, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol, Niacinamide, Dimethicone, Cetyl Alcohol, Cetearyl Alcohol, Petrolatum, Carbomer, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Hyaluronic Acid, Panthenol, Phenoxyethanol, Methylparaben, Propylparaben, Disodium EDTA, Caprylyl Glycol, Sodium Chloride"
  },
  {
    name: "Bioderma Sensibio H2O",
    ingredients: "Aqua, Peg-6 Caprylic/Capric Glycerides, Disodium Cocoamphodiacetate, Fructooligosaccharides, Mannitol, Xylitol, Rhamnose, Cucumber Fruit Extract, Disodium EDTA, Sodium Benzoate"
  },
  {
    name: "Vichy Minéral 89 Serum",
    ingredients: "Aqua, Glycerin, Niacinamide, Sodium Hyaluronate, Hyaluronic Acid, Vichy Volcanic Mineralizing Water, Pentylene Glycol, Propanediol, Hydroxypropyl Cyclodextrin, Cassia Alata Leaf Extract, Sodium Acetate, Citric Acid, Sodium Chloride, Phenoxyethanol, Ethylhexylglycerin"
  },
  {
    name: "Cetaphil Gentle Skin Cleanser",
    ingredients: "Aqua, Cetyl Alcohol, Propylene Glycol, Sodium Lauryl Sulfate, Stearyl Alcohol, Methylparaben, Propylparaben, Butylparaben"
  },
  {
    name: "Neutrogena Hydro Boost Water Gel",
    ingredients: "Aqua, Dimethicone, Glycerin, Phenoxyethanol, Dimethicone/Vinyl Dimethicone Crosspolymer, Chlorphenesin, Carbomer, Disodium EDTA, Hyaluronic Acid, Sodium Hyaluronate, Trehalose, Hydrolyzed Hyaluronic Acid, Sodium Hydroxide"
  },
  {
    name: "Uriage Eau Thermale Water Cream",
    ingredients: "Aqua, Uriage Thermal Water, Glycerin, Cetearyl Alcohol, Dimethicone, Isohexadecane, Niacinamide, Caprylic/Capric Triglyceride, Phenoxyethanol, Carbomer, Sodium Hydroxide, Disodium EDTA, Methylparaben, Propylparaben, Tocopheryl Acetate, Panthenol, Allantoin, Bisabolol"
  },
  {
    name: "Ducray Ictyane Creme HD",
    ingredients: "Aqua, Paraffinum Liquidum, Glycerin, Microcrystalline Wax, Cetyl Alcohol, Dimethicone, Stearic Acid, PEG-100 Stearate, Glyceryl Stearate, Phenoxyethanol, Carbomer, Sodium Hydroxide, Disodium EDTA, Tocopheryl Acetate, Allantoin, Urea"
  },
  {
    name: "SVR Sebiaclear Serum",
    ingredients: "Aqua, Glycerin, Niacinamide, Salicylic Acid, Zinc Gluconate, Zinc PCA, Azelaic Acid, Lactic Acid, Propylene Glycol, Hydroxyethylcellulose, Phenoxyethanol, Disodium EDTA, Sodium Hydroxide, Caprylyl Glycol, Panthenol, Allantoin"
  },
  {
    name: "Embryolisse Lait-Crème Concentré",
    ingredients: "Aqua, Cetyl Alcohol, Glycerin, Stearic Acid, Glyceryl Stearate, PEG-100 Stearate, Dimethicone, Panthenol, Sodium Hyaluronate, Soy Protein, Beeswax, Lactic Acid, Methylparaben, Propylparaben, Sodium Hydroxide, Carbomer, Disodium EDTA, Triethanolamine, Phenoxyethanol"
  },
  {
    name: "Filorga Time-Filler Cream",
    ingredients: "Aqua, Glycerin, Dimethicone, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Niacinamide, Sodium Hyaluronate, Hyaluronic Acid, Retinyl Palmitate, Tocopheryl Acetate, Panthenol, Allantoin, Bisabolol, Ceramide NP, Phytosphingosine, Cholesterol, Phenoxyethanol, Ethylhexylglycerin, Carbomer, Sodium Hydroxide, Disodium EDTA, Xanthan Gum, Caprylyl Glycol"
  },
  {
    name: "ISDIN Fotoprotector Fusion Fluid SPF 50+",
    ingredients: "Aqua, Ethylhexyl Methoxycinnamate, Uvasorb HEB, Ethylhexyl Triazone, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Glycerin, C12-15 Alkyl Benzoate, Glyceryl Stearate, PEG-100 Stearate, Dimethicone, Phenoxyethanol, Carbomer, Triethanolamine, Disodium EDTA, Tocopheryl Acetate"
  },
  {
    name: "Caudalie Vinoperfect Serum",
    ingredients: "Aqua, Glycerin, Pentylene Glycol, Niacinamide, Vitis Vinifera Grape Juice, Vitis Vinifera Seed Oil, Hydroxyethylcellulose, Sodium Hyaluronate, Lactic Acid, Citric Acid, Phenoxyethanol, Ethylhexylglycerin, Parfum, Disodium EDTA"
  },
  {
    name: "Paula's Choice BHA 2% Liquid",
    ingredients: "Aqua, Methylpropanediol, Butylene Glycol, Salicylic Acid, Camellia Oleifera Leaf Extract, Sodium Hydroxide, Tetrasodium EDTA"
  },
  {
    name: "The Ordinary Niacinamide 10% + Zinc 1%",
    ingredients: "Aqua, Niacinamide, Pentylene Glycol, Zinc PCA, Dimethyl Isosorbide, Tamarindus Indica Seed Gum, Xanthan Gum, Isoceteth-20, Ethoxydiglycol, Phenoxyethanol, Chlorphenesin"
  },
  {
    name: "Benton Snail Bee High Content Essence",
    ingredients: "Snail Secretion Filtrate, Bee Venom, Niacinamide, Bifida Ferment Lysate, Saccharomyces Ferment Filtrate, Panthenol, Sodium Hyaluronate, Glycerin, Allantoin, Betaine, Adenosine, Beta-Glucan, Carbomer, Sodium Hydroxide, Phenoxyethanol"
  },
  {
    name: "Klairs Freshly Juiced Vitamin C Drop",
    ingredients: "Ascorbic Acid, Niacinamide, Sodium Hyaluronate, Glycerin, Betaine, Propanediol, Panthenol, Allantoin, Phenoxyethanol, Ethylhexylglycerin, Disodium EDTA, Xanthan Gum, Sodium Hydroxide"
  },
  {
    name: "Anua Heartleaf Pore Control Serum",
    ingredients: "Houttuynia Cordata Extract, Niacinamide, Glycerin, Betaine, Propanediol, Panthenol, Sodium Hyaluronate, Centella Asiatica Extract, Madecassoside, Asiaticoside, Madecassic Acid, Asiatic Acid, Allantoin, Adenosine, Phenoxyethanol, Ethylhexylglycerin, Carbomer, Sodium Hydroxide, Xanthan Gum"
  },
  {
    name: "COSRX Advanced Snail 96 Mucin Power Essence",
    ingredients: "Snail Secretion Filtrate, Arbutin, Sodium Hyaluronate, Betaine, Panthenol, Allantoin, Phenoxyethanol, Ethylhexylglycerin"
  },
  {
    name: "Pyunkang Yul Moisture Serum",
    ingredients: "Astragalus Membranaceus Root Extract, Glycerin, Betaine, Sodium Hyaluronate, Panthenol, Allantoin, Phenoxyethanol, Ethylhexylglycerin"
  },
  {
    name: "Medik8 Crystal Retinal 6",
    ingredients: "Aqua, Glycerin, Dimethicone, Retinaldehyde, Niacinamide, Caprylic/Capric Triglyceride, Sodium Hyaluronate, Tocopheryl Acetate, Panthenol, Bisabolol, Phenoxyethanol, Ethylhexylglycerin, Carbomer, Sodium Hydroxide, Disodium EDTA, Xanthan Gum"
  },
  {
    name: "Avène Antirougeurs Fort Relief Concentrate",
    ingredients: "Aqua, Avene Thermal Spring Water, Glycerin, Propylene Glycol, Ruscus Aculeatus Root Extract, Chrysanthellum Indicum Extract, Dimethicone, Carbomer, Sodium Hydroxide, Disodium EDTA, Phenoxyethanol, Triethanolamine"
  },
  {
    name: "Topicrem Ultra-Moisturizing Balm",
    ingredients: "Aqua, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Dimethicone, Urea, Paraffinum Liquidum, Niacinamide, Sodium Hyaluronate, Panthenol, Allantoin, Bisabolol, Phenoxyethanol, Methylparaben, Propylparaben, Carbomer, Sodium Hydroxide, Disodium EDTA, Triethanolamine, Caprylyl Glycol"
  },
  {
    name: "Filorga Meso-Mask",
    ingredients: "Aqua, Glycerin, Kaolin, Caprylic/Capric Triglyceride, Dimethicone, Sodium Hyaluronate, Niacinamide, Tocopheryl Acetate, Panthenol, Allantoin, Phenoxyethanol, Ethylhexylglycerin, Carbomer, Sodium Hydroxide, Disodium EDTA, Xanthan Gum, Caprylyl Glycol, Zinc Oxide"
  },
];

// ── Run analysis ──────────────────────────────────────────────────────────────

const result = buildCorpus(PRODUCT_CORPUS);

console.log("");
console.log("═══════════════════════════════════════════════════════════════");
console.log("  INGREDIENT INTELLIGENCE — BASELINE CORPUS ANALYSIS");
console.log("═══════════════════════════════════════════════════════════════");
printCorpusReport(result);

console.log("── ALL UNRESOLVED TOKENS ───────────────────────────────────────");
result.top_50_unknown.forEach((t, i) => {
  console.log(`  [${String(t.frequency).padStart(2)}x] ${t.raw}`);
});
console.log("");
console.log(`  TOTAL UNRESOLVED: ${result.unique_unknown}`);
console.log(`  COVERAGE:         ${result.coverage_pct}%`);
console.log("═══════════════════════════════════════════════════════════════");
