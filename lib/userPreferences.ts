import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFS_KEY = "@ciltbakim:user_preferences";

// ─── Tip tanımları ────────────────────────────────────────────────────────────

/**
 * Kullanıcının bildirdiği alerji tetikleyicileri.
 * İngilizce anahtar; UI'da Türkçe etiket gösterilir.
 */
export type AllergyKey =
  | "fragrance"     // Parfüm / Koku
  | "alcohol"       // Alkol
  | "essential_oil" // Esansiyel Yağ
  | "paraben"       // Paraben
  | "silicone"      // Silikon
  | "sulfate"       // Sülfat
  | "nut"           // Fındık / Ceviz yağı
  | "latex"         // Lateks
  | "lanolin"       // Lanolin
  | "gluten"        // Gluten
  | "nickel";       // Nikel

/**
 * Kullanıcının özel sağlık/yaşam koşulları.
 * İngilizce anahtar; UI'da Türkçe etiket gösterilir.
 */
export type SpecialConditionKey =
  | "pregnancy"          // Hamilelik
  | "breastfeeding"      // Emzirme
  | "for_child"          // Çocuk için kullanım
  | "sensitive_skin"     // Hassas Cilt
  | "rosacea"            // Rozasea
  | "eczema"             // Egzama
  | "psoriasis"          // Sedef Hastalığı
  | "acne_prone"         // Akneye Yatkın Cilt
  | "hyperpigmentation"; // Hiperpigmentasyon

/** Kullanıcının cilt tipi tercihi (opsiyonel). */
export type SkinType =
  | "normal"
  | "dry"
  | "oily"
  | "combination"
  | "sensitive";

/**
 * Kullanıcının cilt kaygıları / sorunları.
 * Birden fazla seçilebilir.
 */
export type SkinConcernKey =
  | "acne"          // Akne / Sivilce
  | "spots"         // Leke / Hiperpigmentasyon
  | "redness"       // Kızarıklık
  | "dehydration"   // Nem Kaybı / Susuz Cilt
  | "barrier_repair"// Cilt Bariyeri Onarımı
  | "anti_aging"    // Yaşlanma Karşıtı
  | "pore";         // Gözenek

/**
 * Kullanıcının tercih ettiği ürün dokuları.
 * Birden fazla seçilebilir.
 */
export type TexturePreferenceKey =
  | "light"   // Hafif / Su bazlı
  | "rich"    // Yoğun / Besleyici
  | "gel"     // Jel kıvamı
  | "cream"   // Krem kıvamı
  | "fluid";  // Akışkan / Serum kıvamı

/**
 * Kullanıcının tercih ettiği cilt son görünümü.
 * Tek seçim, opsiyonel.
 */
export type FinishPreferenceKey =
  | "matte"    // Mat
  | "natural"  // Doğal
  | "glow";    // Işıltılı

/** Tüm kullanıcı tercihlerini kapsayan model. */
export interface UserPreferences {
  /** Kullanıcının bildirdiği alerji/hassasiyet listesi. */
  allergies: AllergyKey[];

  /** Özel sağlık veya yaşam koşulları. */
  specialConditions: SpecialConditionKey[];

  /** Cilt tipi (opsiyonel, kullanıcı belirtmeyebilir). */
  skinType: SkinType | null;

  /** Cilt kaygıları / sorunları (çoklu seçim). */
  skinConcerns: SkinConcernKey[];

  /** Tercih edilen ürün dokuları (çoklu seçim). */
  texturePreferences: TexturePreferenceKey[];

  /** Tercih edilen son görünüm (tek seçim, opsiyonel). */
  finishPreference: FinishPreferenceKey | null;

  /**
   * Kullanıcının özellikle kaçınmak istediği serbest metin içerikler.
   * Alerji reaksiyonu olmaksızın tercih meselesi olan bileşenler.
   */
  avoidedIngredients: string[];

  /**
   * Kullanıcıda reaksiyon yapmış / alerji oluşturmuş serbest metin içerikler.
   * avoidedIngredients'tan daha yüksek uyarı seviyesiyle gösterilir.
   */
  allergyIngredients: string[];

  /** Son güncelleme zamanı (ISO 8601). */
  updatedAt: string;
}

/** Boş/varsayılan tercih seti. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  allergies: [],
  specialConditions: [],
  skinType: null,
  skinConcerns: [],
  texturePreferences: [],
  finishPreference: null,
  avoidedIngredients: [],
  allergyIngredients: [],
  updatedAt: new Date(0).toISOString(),
};

// ─── AsyncStorage CRUD ────────────────────────────────────────────────────────

/** Kaydedilmiş tercihleri yükler. Bulunamazsa DEFAULT_PREFERENCES döner. */
export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      allergies: parsed.allergies ?? [],
      specialConditions: parsed.specialConditions ?? [],
      skinType: parsed.skinType ?? null,
      skinConcerns: parsed.skinConcerns ?? [],
      texturePreferences: parsed.texturePreferences ?? [],
      finishPreference: parsed.finishPreference ?? null,
      avoidedIngredients: parsed.avoidedIngredients ?? [],
      allergyIngredients: parsed.allergyIngredients ?? [],
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Tercihleri kaydeder. updatedAt otomatik güncellenir. */
export async function savePreferences(
  prefs: Omit<UserPreferences, "updatedAt">
): Promise<void> {
  const full: UserPreferences = { ...prefs, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(full));
}

/** Yalnızca `allergies` alanını günceller. */
export async function updateAllergies(allergies: AllergyKey[]): Promise<void> {
  const current = await loadPreferences();
  await savePreferences({ ...current, allergies });
}

/** Yalnızca `specialConditions` alanını günceller. */
export async function updateSpecialConditions(
  specialConditions: SpecialConditionKey[]
): Promise<void> {
  const current = await loadPreferences();
  await savePreferences({ ...current, specialConditions });
}

/** Yalnızca `skinType` alanını günceller. */
export async function updateSkinType(skinType: SkinType | null): Promise<void> {
  const current = await loadPreferences();
  await savePreferences({ ...current, skinType });
}

/** Yalnızca `skinConcerns` alanını günceller. */
export async function updateSkinConcerns(skinConcerns: SkinConcernKey[]): Promise<void> {
  const current = await loadPreferences();
  await savePreferences({ ...current, skinConcerns });
}

/** Yalnızca `texturePreferences` alanını günceller. */
export async function updateTexturePreferences(texturePreferences: TexturePreferenceKey[]): Promise<void> {
  const current = await loadPreferences();
  await savePreferences({ ...current, texturePreferences });
}

/** Yalnızca `finishPreference` alanını günceller. */
export async function updateFinishPreference(finishPreference: FinishPreferenceKey | null): Promise<void> {
  const current = await loadPreferences();
  await savePreferences({ ...current, finishPreference });
}

/** Tüm tercihleri sıfırlar (logout veya hesap silme akışında kullanılır). */
export async function clearPreferences(): Promise<void> {
  await AsyncStorage.removeItem(PREFS_KEY);
}

// ─── İnsan okunabilir etiketler (Türkçe) ──────────────────────────────────────

export const ALLERGY_LABELS: Record<AllergyKey, string> = {
  fragrance:    "Parfüm / Koku",
  alcohol:      "Alkol",
  essential_oil:"Esansiyel Yağ",
  paraben:      "Paraben",
  silicone:     "Silikon",
  sulfate:      "Sülfat",
  nut:          "Fındık / Ceviz Yağı",
  latex:        "Lateks",
  lanolin:      "Lanolin",
  gluten:       "Gluten",
  nickel:       "Nikel",
};

export const SPECIAL_CONDITION_LABELS: Record<SpecialConditionKey, string> = {
  pregnancy:         "Hamilelik",
  breastfeeding:     "Emzirme",
  for_child:         "Çocuk İçin Kullanım",
  sensitive_skin:    "Hassas Cilt",
  rosacea:           "Rozasea",
  eczema:            "Egzama",
  psoriasis:         "Sedef Hastalığı",
  acne_prone:        "Akneye Yatkın Cilt",
  hyperpigmentation: "Hiperpigmentasyon",
};

export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  normal:      "Normal Cilt",
  dry:         "Kuru Cilt",
  oily:        "Yağlı Cilt",
  combination: "Karma Cilt",
  sensitive:   "Hassas Cilt",
};

export const SKIN_CONCERN_LABELS: Record<SkinConcernKey, string> = {
  acne:          "Akne / Sivilce",
  spots:         "Leke / Ton Eşitsizliği",
  redness:       "Kızarıklık",
  dehydration:   "Nem Kaybı",
  barrier_repair:"Bariyer Onarımı",
  anti_aging:    "Yaşlanma Karşıtı",
  pore:          "Gözenek",
};

export const TEXTURE_PREFERENCE_LABELS: Record<TexturePreferenceKey, string> = {
  light: "Hafif / Su Bazlı",
  rich:  "Yoğun / Besleyici",
  gel:   "Jel",
  cream: "Krem",
  fluid: "Akışkan / Serum",
};

export const FINISH_PREFERENCE_LABELS: Record<FinishPreferenceKey, string> = {
  matte:   "Mat",
  natural: "Doğal",
  glow:    "Işıltılı",
};
