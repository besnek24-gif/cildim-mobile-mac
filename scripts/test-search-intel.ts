/**
 * Offline validation harness for the intent-based search engine.
 * Run with: tsx scripts/test-search-intel.ts
 * (Dev-only — not bundled into the app.)
 */
import {
  normalizeSearchText,
  expandSearchQuery,
  getSearchScore,
  getDidYouMeanSuggestion,
  detectSearchIntent,
  type SearchableProduct,
} from "../src/search/searchIntelligence";

const products: SearchableProduct[] = [
  { brand: "Bioderma",       name: "Atoderm Lotion Ultra",       category: "Vücut Bakımı", subcategory: "Vücut Losyonu", short_benefit: "Kuru cilt için yatıştırıcı losyon", concerns: ["kuru cilt"] },
  { brand: "Garnier",        name: "Body Lotion Intense 7 Days", category: "Vücut Bakımı" },
  { brand: "La Roche-Posay", name: "Effaclar Duo+",              category: "Yüz Bakımı",   subcategory: "Krem", concerns: ["akne","sivilce"], short_description: "Anti-blemish krem; niacinamide içerir" },
  { brand: "Bioderma",       name: "Sebium Sensitive",           category: "Yüz Bakımı",   subcategory: "Krem", concerns: ["akne","yağlı cilt"] },
  { brand: "Bioderma",       name: "Photoderm SPF 50+",          category: "Güneş Bakımı", subcategory: "Güneş Kremi", short_benefit: "Geniş spektrum güneş koruyucu" },
  { brand: "Bioderma",       name: "Pigmentbio Daily Care",      category: "Yüz Bakımı",   subcategory: "Krem", short_description: "Leke karşıtı krem; niacinamide içerir" },
  { brand: "Vichy",          name: "Mineral 89",                 category: "Yüz Bakımı",   subcategory: "Nemlendirici" },
  { brand: "Avène",          name: "Tolerance Extreme",          category: "Yüz Bakımı",   subcategory: "Krem", concerns: ["hassas"], short_description: "Sensitive skin cream" },
  { brand: "CeraVe",         name: "Moisturising Cream",         category: "Yüz Bakımı",   subcategory: "Krem", short_benefit: "Kuru cilt için seramidli nemlendirici", ingredients: ["ceramide","hyaluronic acid"] },
  { brand: "Ducray",         name: "Kelual DS Şampuan",          category: "Saç Bakımı",   subcategory: "Şampuan", concerns: ["kepek"] },
  { brand: "La Roche-Posay", name: "Cicaplast Baume B5",         category: "Yüz Bakımı",   subcategory: "Balm", short_description: "Onarıcı bariyer kremi; panthenol içerir" },
  { brand: "La Roche-Posay", name: "Anthelios SPF 50",           category: "Güneş Bakımı", subcategory: "Güneş Kremi" },
  { brand: "Eucerin",        name: "Anti-Pigment Serum",         category: "Yüz Bakımı",   subcategory: "Serum", short_description: "Vitamin C içerikli leke karşıtı serum", ingredients: ["vitamin c","arbutin"] },
  { brand: "Paula's Choice", name: "2% BHA Liquid Exfoliant",    category: "Yüz Bakımı",   subcategory: "Tonik", short_description: "Salisilik asit içeren tonik", ingredients: ["salicylic acid"] },
  { brand: "The Ordinary",   name: "Niacinamide 10% + Zinc 1%",  category: "Yüz Bakımı",   subcategory: "Serum", short_description: "Niasinamid + çinko serum", ingredients: ["niacinamide","zinc"] },
];

console.log("=== detectSearchIntent + expandSearchQuery (örnekler) ===");
const probes = ["bioderma","biyoderma","bioderma losyon","losyon","lotion","la roche","laroche","lrp","gunes kremi","spf 50","sivilce","akne","leke","hassas cilt","kuru cilt","bariyer","salisilik asit","niasinamid","c vitamini"];
for (const q of probes) {
  const intents = detectSearchIntent(q);
  const exp = expandSearchQuery(q);
  console.log(`  ${q.padEnd(18)} | intents=${JSON.stringify(intents).padEnd(35)} | expanded(${exp.length})=${JSON.stringify(exp.slice(0,8))}${exp.length>8?"…":""}`);
}

console.log("\n=== Search results (top 3) — relevance, NOT rating ===");
for (const q of probes) {
  const scored = products
    .map((p) => ({ p, s: getSearchScore(q, p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const top = scored.slice(0, 3).map((x) => `${x.p.brand}/${x.p.name}(${x.s})`).join(" | ") || "(none)";
  console.log(`  ${q.padEnd(18)} → ${top}`);
}

console.log("\n=== getDidYouMeanSuggestion ===");
const dymTests = ["biyoderma","vichi","laroche","dukrey","serave","bioderma","la roche posay","gunes koruyucu","abracadabra"];
for (const q of dymTests) {
  const s = getDidYouMeanSuggestion(q, products);
  console.log(`  ${q.padEnd(18)} → ${s ? `${s.suggestion} (${s.reason})` : "(no suggestion)"}`);
}
