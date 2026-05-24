import { normalizeIngredients } from "./ingredientNormalizer";

const sample = [
  "Aqua, Glycerine, Parfum, dl-panthenol, Unknown-X",
  "Water, Glycerin, Fragrance, Panthenol, Sodium Hyaluronate"
];

export const NORMALIZER_SAMPLE_RESULTS = sample.map((item, index) => ({
  index,
  input: item,
  output: normalizeIngredients(item)
}));
