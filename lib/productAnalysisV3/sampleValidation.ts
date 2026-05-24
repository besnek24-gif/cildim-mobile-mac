import { analyzeProductIngredients } from "./analyzeProductIngredients";

const SUNSCREEN_FORMULA =
  "Aqua, Ethylhexyl Methoxycinnamate, Butyl Methoxydibenzoylmethane, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Ethylhexyl Triazone, Glycerin, Phenoxyethanol, Ethylhexylglycerin, Carbomer, Sodium Hydroxide, Disodium EDTA";

const MOISTURIZER_FORMULA =
  "Aqua, Glycerin, Sodium Hyaluronate, Niacinamide, Squalane, Shea Butter, Cetearyl Alcohol, Glyceryl Stearate, Xanthan Gum, Sodium PCA, Tocopherol, Panthenol, Sodium Hydroxide, Potassium Sorbate, Sodium Benzoate";

const FRAGRANCE_ALCOHOL_FORMULA =
  "Aqua, Alcohol Denat., Propylene Glycol, Butylene Glycol, Parfum, Linalool, Limonene, Geraniol, Sodium Laureth Sulfate, Caprylyl Glycol, Benzyl Alcohol, Citronellol, Disodium EDTA";

export const V3_SAMPLE_RESULTS = [
  {
    name: "Sunscreen-Heavy Formula",
    input: SUNSCREEN_FORMULA,
    output: analyzeProductIngredients(SUNSCREEN_FORMULA),
  },
  {
    name: "Simple Moisturizer Formula",
    input: MOISTURIZER_FORMULA,
    output: analyzeProductIngredients(MOISTURIZER_FORMULA),
  },
  {
    name: "Fragrance & Alcohol-Containing Formula",
    input: FRAGRANCE_ALCOHOL_FORMULA,
    output: analyzeProductIngredients(FRAGRANCE_ALCOHOL_FORMULA),
  },
];
