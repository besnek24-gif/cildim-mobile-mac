import { analyzeIngredients } from "./analyzeIngredients";
import type {
  AllergyKey,
  SpecialConditionKey,
  SkinType,
  SkinConcernKey,
  UserPreferences,
} from "./userPreferences";
import type { LearningProfile } from "./userEvents";

// ─── Öğrenme bonusu ────────────────────────────────────────────────────────────

const LEARNING_CAT_BONUS   = 0.3;
const LEARNING_SUB_BONUS   = 0.2;
const LEARNING_BRAND_BONUS = 0.25;
const LEARNING_SEG_BONUS   = 0.1;
const LEARNING_MAX_BONUS   = 0.6;

/**
 * Kullanıcı geçmiş ilgisine göre ürüne küçük bir bonus verir.
 * Bonus, mevcut penalty×4 − matchScore formülünden çok daha küçüktür;
 * çeşitlilik korunur, sadece ince ayar yapılır.
 *
 * Bonus kaynakları (toplamlı, LEARNING_MAX_BONUS ile sınırlı):
 *   +0.30 — kategori eşleşmesi
 *   +0.20 — alt-kategori eşleşmesi
 *   +0.25 — marka eşleşmesi   ← yeni
 *   +0.10 — segment eşleşmesi ← yeni
 */
function computeLearningBonus(product: any, profile: LearningProfile | undefined): number {
  if (!profile?.hasEnoughData) return 0;

  const cat   = ((product.category    ?? product.kategori ?? "") as string).toLowerCase().trim();
  const sub   = ((product.subcategory ?? "") as string).toLowerCase().trim();
  const brand = ((product.brand       ?? product.marka    ?? "") as string).toLowerCase().trim();
  const seg   = ((product.segment     ?? "") as string).toLowerCase().trim();

  let bonus = 0;
  if (cat   && profile.topCategories.includes(cat))    bonus += LEARNING_CAT_BONUS;
  if (sub   && profile.topSubcategories.includes(sub)) bonus += LEARNING_SUB_BONUS;
  if (brand && profile.topBrands.includes(brand))      bonus += LEARNING_BRAND_BONUS;
  if (seg   && profile.topSegments.includes(seg))      bonus += LEARNING_SEG_BONUS;

  return Math.min(bonus, LEARNING_MAX_BONUS);
}

// ─── Anahtar kelime haritaları ────────────────────────────────────────────────

/**
 * Kullanıcının cilt tipini ürün verisinde arama için kullanılan
 * İngilizce + Türkçe anahtar kelimeler.
 */
const SKIN_TYPE_KEYWORDS: Record<SkinType, string[]> = {
  oily:        ["oily", "yağlı", "oil-free", "yağsız", "mat", "matte", "sebum"],
  dry:         ["dry", "kuru", "kuruyan", "dry skin", "kuru cilt"],
  combination: ["combination", "karma", "combination skin"],
  sensitive:   ["sensitive", "hassas", "duyarlı", "sensit"],
  normal:      ["normal"],
};

/**
 * Kullanıcının seçtiği cilt sorunlarını ürün verisinde arama için
 * kullanılan İngilizce + Türkçe anahtar kelimeler.
 */
const CONCERN_KEYWORDS: Record<SkinConcernKey, string[]> = {
  acne:          ["acne", "akne", "sivilce", "blemish", "breakout", "pimple", "anti-acne"],
  spots:         ["spot", "leke", "pigment", "brightening", "aydınlatma", "dark spot", "ton eşitsizliği", "hyperpigment"],
  redness:       ["redness", "kızarıklık", "calming", "sakinleştirici", "soothing", "rosacea", "rozasea"],
  dehydration:   ["dehydration", "nem", "hydration", "nemlendirme", "moistur", "hyaluronic", "hyaluron", "su tutma"],
  barrier_repair:["barrier", "bariyer", "repair", "onarım", "ceramide", "seramid", "recovery", "restore"],
  anti_aging:    ["anti-aging", "yaşlanma", "aging", "wrinkle", "kırışık", "firming", "retinol", "collagen", "kollajen", "peptide"],
  pore:          ["pore", "gözenek", "pore-minim", "gözenek sıkı"],
};

// ─── Match skoru ──────────────────────────────────────────────────────────────

/**
 * Bir ürünün kullanıcı profiliyle ne kadar eşleştiğini puanlar.
 *
 * Puanlama:
 *   +1  — cilt tipi eşleşmesi (ürün skin_types / skin_type / category / tags'te bulunduysa)
 *   +1  — her skinConcern eşleşmesi (concerns_supported / concerns / tags / description)
 *
 * Profil boşsa her zaman 0 döner.
 *
 * Ürün kartı badge eşiği: matchScore >= 2 → "Sana Uygun" etiketi göster.
 */
export function computeMatchScore(
  product: any,
  skinType: SkinType | null,
  skinConcerns: SkinConcernKey[],
): number {
  if (!skinType && skinConcerns.length === 0) return 0;

  // Ürünün tüm metin alanlarını tek bir haystack'e birleştir
  const parts: string[] = [
    product.name ?? "",
    product.isim ?? "",
    product.category ?? "",
    product.kategori ?? "",
    product.subcategory ?? "",
    product.short_benefit ?? "",
    product.description ?? "",
    ...(Array.isArray(product.skin_types) ? product.skin_types : []),
    product.skin_type ?? "",
    ...(Array.isArray(product.concerns_supported) ? product.concerns_supported : []),
    ...(Array.isArray(product.concerns) ? product.concerns : []),
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.benefits) ? product.benefits : []),
  ];
  const haystack = parts.join(" ").toLowerCase();

  let score = 0;

  // Cilt tipi eşleşmesi
  if (skinType) {
    const kws = SKIN_TYPE_KEYWORDS[skinType];
    if (kws.some((kw) => haystack.includes(kw))) score += 1;
  }

  // Cilt kaygısı eşleşmesi — her eşleşme +1
  for (const concern of skinConcerns) {
    const kws = CONCERN_KEYWORDS[concern];
    if (kws.some((kw) => haystack.includes(kw))) score += 1;
  }

  return score;
}

// ─── Güvenlik cezası ──────────────────────────────────────────────────────────

function computeSafetyPenalty(
  product: any,
  allergies: AllergyKey[],
  specialConditions: SpecialConditionKey[],
): number {
  const hasPregnancy     = specialConditions.includes("pregnancy");
  const hasBreastfeeding = specialConditions.includes("breastfeeding");
  const hasSensitiveSkin = specialConditions.includes("sensitive_skin");

  const ia = analyzeIngredients(product.ingredients, allergies);
  if (!ia.reliable) return 0;

  let penalty = 0;
  if (ia.matchedAllergies.length > 0) penalty += 2;
  if (hasPregnancy && ia.pregnancyRisk) penalty += 1;
  if (hasBreastfeeding && ia.breastfeedingRisk) penalty += 1;
  if (hasSensitiveSkin && ia.sensitiveSkinRisk) penalty += 1;
  return penalty;
}

// ─── Dışa açık fonksiyonlar ───────────────────────────────────────────────────

/**
 * Eski imza — yalnızca güvenlik cezasına göre sıralar.
 * Geriye uyumluluk için korunmuştur; yeni kodda `applyPersonalizedRanking` kullanın.
 */
export function applySafetyRanking<T extends { id: string }>(
  products: T[],
  userProfile: {
    allergies: AllergyKey[];
    specialConditions: SpecialConditionKey[];
  },
): T[] {
  const { allergies, specialConditions } = userProfile;
  if (allergies.length === 0 && specialConditions.length === 0) return products;

  const scored = products.map((p, originalIndex) => ({
    p,
    penalty: computeSafetyPenalty(p as any, allergies, specialConditions),
    originalIndex,
  }));

  scored.sort((a, b) =>
    a.penalty !== b.penalty ? a.penalty - b.penalty : a.originalIndex - b.originalIndex
  );
  return scored.map(({ p }) => p);
}

// ─── Keşif karıştırması ───────────────────────────────────────────────────────

/**
 * Sıralanmış listeye küçük bir keşif enjeksiyonu yapar.
 *
 * Her STEP'inci slota, listenin kuyruğundan (daha az görülmüş) bir ürün yerleştirilir.
 * Güvenli ürünler (safety=0) doğal olarak listenin üst bölümünde kümelenir;
 * kuyrukta kalan ürünler "alakalı ama henüz dikkat çekmemiş" adaylardır.
 *
 * Keşif hızı profil gücüne göre ayarlanır:
 *   - Yeni kullanıcı  (profil yok)  → her 4'te 1  (daha taze vitrin)
 *   - Orta sinyal     (1-3 kategori) → her 6'da 1
 *   - Güçlü sinyal    (4+ kategori)  → her 8'de 1  (istikrarlı vitrin)
 *
 * Liste 5'ten kısa veya hiç exploration slotu yoksa değişmeden döner.
 */
const EXPLORATION_STEP_NEW      = 4;
const EXPLORATION_STEP_MODERATE = 6;
const EXPLORATION_STEP_STRONG   = 8;

function applyExplorationMix<T extends { id: string }>(
  ranked: T[],
  learningProfile: LearningProfile | undefined,
): T[] {
  const N = ranked.length;
  if (N < 5) return ranked;

  const hasProfile = learningProfile?.hasEnoughData ?? false;
  const signalStrength = hasProfile
    ? learningProfile!.topCategories.length + learningProfile!.topSubcategories.length
    : 0;

  const step = !hasProfile
    ? EXPLORATION_STEP_NEW
    : signalStrength <= 3
    ? EXPLORATION_STEP_MODERATE
    : EXPLORATION_STEP_STRONG;

  const explorationCount = Math.floor(N / step);
  if (explorationCount === 0) return ranked;

  // Exploit pool: listenin öne çıkan kısmı
  // Discovery pool: kuyruktan gelen, sıralamada düşük kalan ürünler
  const exploitCount = N - explorationCount;
  const exploitPool  = ranked.slice(0, exploitCount);
  const discPool     = ranked.slice(exploitCount);

  const result: T[] = [];
  let eIdx = 0;
  let dIdx = 0;

  for (let i = 0; i < N; i++) {
    if ((i + 1) % step === 0 && dIdx < discPool.length) {
      result.push(discPool[dIdx++]);
    } else if (eIdx < exploitPool.length) {
      result.push(exploitPool[eIdx++]);
    } else {
      result.push(discPool[dIdx++]);
    }
  }

  return result;
}

// ─── Tam şahsileştirme pipeline'ı ─────────────────────────────────────────

/**
 * Kullanıcı profilinin tamamını (güvenlik + cilt tipi + öğrenme) kullanarak
 * ürün listesini şahsileştirir ve ardından keşif dengelemesi uygular.
 *
 * Pipeline sırası (öncelik yüksekten düşüğe):
 *   1. Güvenlik cezası  (alerji / hamilelik / hassas cilt)
 *   2. Şahsileştirme  (cilt tipi + cilt kaygıları)
 *   3. Öğrenme bonusu   (geçmiş davranış + zaman decay)
 *   4. Keşif dengesi    (liste tazeliği, çeşitlilik)
 *
 * Sıralama anahtarı: sortKey = penalty×4 − matchScore − learningBonus
 * (küçük sortKey → listenin üstü)
 */
export function applyPersonalizedRanking<T extends { id: string }>(
  products: T[],
  preferences: Pick<UserPreferences, "allergies" | "specialConditions" | "skinType" | "skinConcerns">,
  learningProfile?: LearningProfile,
): T[] {
  const { allergies, specialConditions, skinType, skinConcerns } = preferences;

  const profileEmpty =
    allergies.length === 0 &&
    specialConditions.length === 0 &&
    !skinType &&
    skinConcerns.length === 0;

  const hasLearning = learningProfile?.hasEnoughData ?? false;

  // Yeni kullanıcı: tercih ve geçmiş yok → sadece keşif karıştırması
  if (profileEmpty && !hasLearning) {
    return applyExplorationMix(products, undefined);
  }

  const scored = products.map((p, originalIndex) => {
    const penalty       = computeSafetyPenalty(p as any, allergies, specialConditions);
    const matchScore    = computeMatchScore(p as any, skinType, skinConcerns);
    const learningBonus = computeLearningBonus(p as any, learningProfile);
    const sortKey       = penalty * 4 - matchScore - learningBonus;
    return { p, sortKey, originalIndex };
  });

  scored.sort((a, b) =>
    a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.originalIndex - b.originalIndex
  );

  const ranked = scored.map(({ p }) => p);
  return applyExplorationMix(ranked, learningProfile);
}
