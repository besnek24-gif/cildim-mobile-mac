import { matchIngredients } from "./ingredientMatcher";

const sampleInputs = [
  "Aqua, Glycerine, Parfum, PEG-100 Stearate, Niacinamide, Linalool",
  "Water, Glycerin, Fragrance, Peg 100 Stearate, Sodium Hyaluronate, Panthenol",
  "Eau, Alcohol Denat., Tocopheryl Acetate, Butylene Glycol, Carbomer",
  "Aqua, Centella Asiatica Extract, Madecassoside, Ceramide NP, Cholesterol",
  "Water, Cocamidopropyl Betaine, Decyl Glucoside, Phenoxyethanol, Unknown-X"
];

export const INGREDIENT_MATCHER_SAMPLE_RESULTS = sampleInputs.map((input, index) => ({
  index,
  input,
  output: matchIngredients(input)
}));
