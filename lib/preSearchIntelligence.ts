/**
 * CiltBakımım — Ön-Arama Zeka Sistemi
 * Kullanıcı yazmadan önce öneri sunar, yazarken intent algılar.
 * Genişletilebilir: POPULAR_CHIPS ve PERSONALIZED_TRIGGERS'a eklemek yeterli.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Tip tanımları ──────────────────────────────────────────────────────────────

export type IntentType = "concern" | "product" | "ingredient" | "routine";

export type SuggestionActionType = "flow" | "product-search" | "tab";

export interface SuggestionAction {
  type: SuggestionActionType;
  payload: string; // flow id | search term | tab route
}

export interface SuggestionChip {
  id: string;
  label: string;
  subtitle?: string;        // "Hassasiyet ile ilişkili" microcopy
  icon?: string;            // Feather icon name
  color?: string;           // Chip accent rengi
  action: SuggestionAction;
  category: "popular" | "personalized" | "contextual";
}

// ─── Tracking (öğrenme alt yapısı) ──────────────────────────────────────────────

const TRACKING_KEY = "@ciltbakim:search_tracking";
const MAX_TRACK_ENTRIES = 100;

interface TrackEntry {
  id: string;
  tappedAt: number;
  type: "suggestion" | "search";
  label: string;
}

export async function trackSuggestionTap(chip: SuggestionChip): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_KEY);
    const existing: TrackEntry[] = raw ? JSON.parse(raw) : [];
    const entry: TrackEntry = {
      id: chip.id,
      tappedAt: Date.now(),
      type: "suggestion",
      label: chip.label,
    };
    const updated = [entry, ...existing].slice(0, MAX_TRACK_ENTRIES);
    await AsyncStorage.setItem(TRACKING_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
}

export async function trackSearch(query: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_KEY);
    const existing: TrackEntry[] = raw ? JSON.parse(raw) : [];
    const entry: TrackEntry = {
      id: `search-${Date.now()}`,
      tappedAt: Date.now(),
      type: "search",
      label: query,
    };
    const updated = [entry, ...existing].slice(0, MAX_TRACK_ENTRIES);
    await AsyncStorage.setItem(TRACKING_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
}

// ─── Popüler öneriler ────────────────────────────────────────────────────────────

export const POPULAR_CHIPS: SuggestionChip[] = [
  {
    id: "pop-sivilce",
    label: "Sivilce",
    subtitle: "Akne eğilimli ciltler için",
    icon: "droplet",
    color: "#15803D",
    action: { type: "flow", payload: "akne" },
    category: "popular",
  },
  {
    id: "pop-kizariklik",
    label: "Kızarıklık",
    subtitle: "Hassasiyet ile ilişkili",
    icon: "heart",
    color: "#BE123C",
    action: { type: "flow", payload: "hassasiyet" },
    category: "popular",
  },
  {
    id: "pop-leke",
    label: "Leke",
    subtitle: "Ton eşitsizliği ve izler",
    icon: "zap",
    color: "#7C3AED",
    action: { type: "flow", payload: "leke" },
    category: "popular",
  },
  {
    id: "pop-gunes",
    label: "Güneş Koruma",
    subtitle: "SPF seçimi için",
    icon: "sun",
    color: "#B45309",
    action: { type: "flow", payload: "gunes" },
    category: "popular",
  },
  {
    id: "pop-kuruluk",
    label: "Kuruluk",
    subtitle: "Nem ve bariyer desteği",
    icon: "cloud",
    color: "#1D4ED8",
    action: { type: "flow", payload: "kuruluk" },
    category: "popular",
  },
  {
    id: "pop-sac",
    label: "Saç Dökülmesi",
    subtitle: "Güçlendirici bakım",
    icon: "wind",
    color: "#C2410C",
    action: { type: "flow", payload: "sac" },
    category: "popular",
  },
  {
    id: "pop-rozasea",
    label: "Rozasea",
    subtitle: "Hassasiyet ile ilişkili",
    icon: "heart",
    color: "#BE123C",
    action: { type: "flow", payload: "hassasiyet" },
    category: "popular",
  },
  {
    id: "pop-egzama",
    label: "Egzama",
    subtitle: "Hassas ve kuru ciltler için",
    icon: "heart",
    color: "#BE123C",
    action: { type: "flow", payload: "hassasiyet" },
    category: "popular",
  },
];

// ─── Şahsileştirilmiş öneri tetikleyiciler ─────────────────────────────────────
// Her flow için, flow tamamlandığında gösterilecek özel chip'ler.

const PERSONALIZED_TRIGGERS: Record<string, SuggestionChip[]> = {
  akne: [
    {
      id: "pers-akne-serum",
      label: "Akne için serum",
      subtitle: "Akne rutinine devam",
      icon: "zap",
      color: "#15803D",
      action: { type: "product-search", payload: "akne serum" },
      category: "personalized",
    },
    {
      id: "pers-akne-temizleyici",
      label: "Akneye uygun temizleyici",
      subtitle: "Gözenek bakımı için",
      icon: "droplet",
      color: "#15803D",
      action: { type: "product-search", payload: "akne temizleyici" },
      category: "personalized",
    },
  ],
  hassasiyet: [
    {
      id: "pers-hass-nazik",
      label: "Hassas cilt için nazik bakım",
      subtitle: "Daha nazik bakım arayanlar",
      icon: "heart",
      color: "#BE123C",
      action: { type: "product-search", payload: "hassas nazik" },
      category: "personalized",
    },
    {
      id: "pers-hass-bariyer",
      label: "Bariyer güçlendirici",
      subtitle: "Hassas cilt bakımı",
      icon: "shield",
      color: "#BE123C",
      action: { type: "product-search", payload: "bariyer onarım" },
      category: "personalized",
    },
  ],
  leke: [
    {
      id: "pers-leke-vitamin-c",
      label: "Leke için C vitamini",
      subtitle: "Aydınlatma ve ton eşitleme",
      icon: "sun",
      color: "#7C3AED",
      action: { type: "product-search", payload: "vitamin c leke" },
      category: "personalized",
    },
    {
      id: "pers-leke-spf",
      label: "Leke sonrası SPF",
      subtitle: "Koruma olmadan leke bakımı zor",
      icon: "sun",
      color: "#B45309",
      action: { type: "flow", payload: "gunes" },
      category: "personalized",
    },
  ],
  kuruluk: [
    {
      id: "pers-kuru-nemlendirici",
      label: "Yoğun nemlendirici",
      subtitle: "Kuru cilt için güçlü destek",
      icon: "cloud",
      color: "#1D4ED8",
      action: { type: "product-search", payload: "yoğun nemlendirici kuru" },
      category: "personalized",
    },
    {
      id: "pers-kuru-hyaluronik",
      label: "Hyaluronik asit serumu",
      subtitle: "Derin nem desteği",
      icon: "droplet",
      color: "#1D4ED8",
      action: { type: "product-search", payload: "hyaluronik serum" },
      category: "personalized",
    },
  ],
  gunes: [
    {
      id: "pers-gunes-spf50",
      label: "SPF 50+ güneş kremi",
      subtitle: "Güneş koruması için",
      icon: "sun",
      color: "#B45309",
      action: { type: "product-search", payload: "spf50 güneş" },
      category: "personalized",
    },
  ],
  sac: [
    {
      id: "pers-sac-serum",
      label: "Saç güçlendirici serum",
      subtitle: "Dökülme karşıtı",
      icon: "wind",
      color: "#C2410C",
      action: { type: "product-search", payload: "saç serumu dökülme" },
      category: "personalized",
    },
  ],
};

// ─── Şahsileştirilmiş önerileri üret ───────────────────────────────────────────

export function getPersonalizedChips(
  completedFlows: string[] // getConcernProfile(x) !== null olan flow id'leri
): SuggestionChip[] {
  const chips: SuggestionChip[] = [];
  for (const flowId of completedFlows) {
    const triggers = PERSONALIZED_TRIGGERS[flowId] ?? [];
    chips.push(...triggers.slice(0, 2));
  }
  return chips.slice(0, 4); // En fazla 4 şahsi öneri
}

// ─── Bağlamsal öneriler (son görüntüleme geçmişi) ────────────────────────────────

export async function getContextualChips(): Promise<SuggestionChip[]> {
  try {
    const raw = await AsyncStorage.getItem("@ciltbakim:local_history");
    if (!raw) return [];
    const history: Array<{ productName: string; productId: string; brand?: string }> = JSON.parse(raw);
    // Son 3 üründen contextual chip üret
    return history.slice(0, 3).map((entry, idx) => ({
      id: `ctx-product-${idx}`,
      label: entry.productName,
      subtitle: entry.brand ? `${entry.brand} · Tekrar bak` : "Son görüntülenen",
      icon: "eye",
      color: "#3D6E56",
      action: { type: "product-search", payload: entry.productName },
      category: "contextual" as const,
    }));
  } catch {
    return [];
  }
}

// ─── Son aramalar ────────────────────────────────────────────────────────────────

export interface RecentSearch {
  query: string;
  searchedAt: number;
}

export async function getRecentSearches(limit = 5): Promise<RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_KEY);
    if (!raw) return [];
    const all: TrackEntry[] = JSON.parse(raw);
    const searches = all.filter(e => e.type === "search" && e.label.trim().length >= 2);
    // Deduplicate (same label) — keep latest
    const seen = new Set<string>();
    const unique: RecentSearch[] = [];
    for (const entry of searches) {
      const key = entry.label.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ query: entry.label.trim(), searchedAt: entry.tappedAt });
      }
    }
    return unique.slice(0, limit);
  } catch {
    return [];
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_KEY);
    if (!raw) return;
    const all: TrackEntry[] = JSON.parse(raw);
    const filtered = all.filter(e => e.type !== "search");
    await AsyncStorage.setItem(TRACKING_KEY, JSON.stringify(filtered));
  } catch { /* silent */ }
}

// ─── Mevsimsel / Zamansal öneri ───────────────────────────────────────────────────

export interface SeasonalSuggestion {
  label: string;
  subtitle: string;
  icon: string;
  color: string;
  action: SuggestionAction;
}

export function getSeasonalSuggestion(): SeasonalSuggestion | null {
  const now = new Date();
  const month = now.getMonth() + 1; // 1–12
  const hour  = now.getHours();

  // Sabah rutini hatırlatma (06:00–09:30)
  if (hour >= 6 && hour < 10) {
    return {
      label: "Sabah rutinine ne ekledin?",
      subtitle: "SPF'siz güne başlama",
      icon: "sun",
      color: "#B45309",
      action: { type: "tab", payload: "/(tabs)/rutin" },
    };
  }

  // Gece rutini hatırlatma (21:00–23:30)
  if (hour >= 21 && hour < 24) {
    return {
      label: "Gece bakımını yaptın mı?",
      subtitle: "Onarım gece olur",
      icon: "moon",
      color: "#4338CA",
      action: { type: "tab", payload: "/(tabs)/rutin" },
    };
  }

  // Mevsimsel öneriler
  if (month >= 6 && month <= 8) {
    // Yaz
    return {
      label: "Yazın cildin ne istiyor?",
      subtitle: "SPF ve hafif nemlendirici",
      icon: "sun",
      color: "#B45309",
      action: { type: "flow", payload: "gunes" },
    };
  }
  if (month >= 12 || month <= 2) {
    // Kış
    return {
      label: "Kış kurulugu başladı mı?",
      subtitle: "Bariyer desteği ve yoğun nem",
      icon: "cloud",
      color: "#1D4ED8",
      action: { type: "flow", payload: "kuruluk" },
    };
  }
  if (month >= 3 && month <= 5) {
    // İlkbahar
    return {
      label: "Mevsim geçişinde hassasiyet var mı?",
      subtitle: "Bahar alerjisi ve cilt tepkisi",
      icon: "wind",
      color: "#BE123C",
      action: { type: "flow", payload: "hassasiyet" },
    };
  }
  // Sonbahar (Eylül–Kasım)
  return {
    label: "Yaz sonrası cildini toparlayalım",
    subtitle: "Güneş hasarı ve ton eşitleme",
    icon: "zap",
    color: "#7C3AED",
    action: { type: "flow", payload: "leke" },
  };
}

// ─── Intent algılama ─────────────────────────────────────────────────────────────

const INGREDIENT_KEYWORDS = [
  "niasinamid", "niacinamide", "retinol", "retinoid", "aha", "bha", "pha",
  "salisilik", "salicylic", "glikolik", "glycolic", "laktik", "lactic",
  "hyaluronik", "hyaluronic", "ceramid", "ceramide", "vitamin c", "ascorbic",
  "pantenol", "panthenol", "allantoin", "azelaik", "azelaic", "benzoil peroksit",
  "benzoyl", "kojik", "kojic", "arbutin", "traneksamik", "tranexamic",
  "bakuchiol", "peptit", "peptide", "kollajen", "collagen",
];

const PRODUCT_KEYWORDS = [
  "temizleyici", "cleanser", "krem", "cream", "serum", "losyon", "lotion",
  "tonik", "toner", "maske", "mask", "güneş kremi", "spf", "yağ", "oil",
  "jel", "gel", "köpük", "foam", "misel", "micellar", "göz kremi",
];

const ROUTINE_KEYWORDS = [
  "rutin", "sabah rutini", "akşam rutini", "bakım rutini", "adım", "sıra",
  "ne kullanayım", "nasıl kullanayım", "hangi sıra",
];

function normalizeTR(s: string): string {
  return s
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .trim();
}

export function detectIntent(query: string): IntentType {
  const q = normalizeTR(query);
  if (INGREDIENT_KEYWORDS.some(k => q.includes(normalizeTR(k)))) return "ingredient";
  if (ROUTINE_KEYWORDS.some(k => q.includes(normalizeTR(k))))    return "routine";
  if (PRODUCT_KEYWORDS.some(k => q.includes(normalizeTR(k))))    return "product";
  return "concern";
}

// ─── Intent microcopy ─────────────────────────────────────────────────────────────

export const INTENT_LABELS: Record<IntentType, { icon: string; label: string; hint: string }> = {
  concern:    { icon: "activity",     label: "Durum araması",   hint: "Endişeyle ilişkili akış" },
  product:    { icon: "package",      label: "Ürün araması",    hint: "Ürün kategorisi filtrelenecek" },
  ingredient: { icon: "layers",       label: "İçerik araması",  hint: "Bu içeriği içeren ürünler" },
  routine:    { icon: "calendar",     label: "Rutin araması",   hint: "Rutin rehberine yönlendir" },
};

// ─── Otomatik tamamlama önerileri (yazarken) ─────────────────────────────────────

interface AutoCompleteItem {
  id: string;
  label: string;
  subtitle: string;
  action: SuggestionAction;
}

const AUTOCOMPLETE_HINTS: Array<{ prefix: string[]; items: AutoCompleteItem[] }> = [
  {
    prefix: ["roz", "rosa", "rosas", "ros"],
    items: [
      { id: "ac-rozasea", label: "Rozasea", subtitle: "Hassasiyet ile ilişkili", action: { type: "flow", payload: "hassasiyet" } },
      { id: "ac-kizariklik", label: "Kızarıklık ve hassas cilt", subtitle: "Hassasiyet akışı", action: { type: "flow", payload: "hassasiyet" } },
    ],
  },
  {
    prefix: ["egz", "egza", "ekze", "ecz"],
    items: [
      { id: "ac-egzama", label: "Egzama", subtitle: "Hassasiyet + kuruluk ile ilişkili", action: { type: "flow", payload: "hassasiyet" } },
    ],
  },
  {
    prefix: ["ato", "atop"],
    items: [
      { id: "ac-atopik", label: "Atopik dermatit", subtitle: "Hassasiyet + kuruluk ile ilişkili", action: { type: "flow", payload: "hassasiyet" } },
    ],
  },
  {
    prefix: ["siv", "sivil", "akn", "acn"],
    items: [
      { id: "ac-sivilce", label: "Sivilce / Akne", subtitle: "Akne eğilimli ciltler için", action: { type: "flow", payload: "akne" } },
    ],
  },
  {
    prefix: ["fung", "fungl", "mantar", "mant"],
    items: [
      { id: "ac-fungal", label: "Fungal akne", subtitle: "Akne akışında değerlendiriliyor", action: { type: "flow", payload: "akne" } },
    ],
  },
  {
    prefix: ["hor", "hormo"],
    items: [
      { id: "ac-hormonal", label: "Hormonal akne", subtitle: "Dönemsel sivilce", action: { type: "flow", payload: "akne" } },
    ],
  },
  {
    prefix: ["kiz", "kiza", "kıza"],
    items: [
      { id: "ac-kizariklik", label: "Kızarıklık", subtitle: "Hassas cilt ile ilişkili", action: { type: "flow", payload: "hassasiyet" } },
    ],
  },
  {
    prefix: ["yan", "yanm"],
    items: [
      { id: "ac-yanma", label: "Cilt yanması / batması", subtitle: "Hassasiyet akışı", action: { type: "flow", payload: "hassasiyet" } },
    ],
  },
  {
    prefix: ["lek", "leke"],
    items: [
      { id: "ac-leke", label: "Leke / iz", subtitle: "Ton eşitsizliği ve iz bakımı", action: { type: "flow", payload: "leke" } },
    ],
  },
  {
    prefix: ["hiperpig", "hiperpig", "pigm", "mela"],
    items: [
      { id: "ac-hiperpig", label: "Hiperpigmentasyon / Melasma", subtitle: "Leke bakımı", action: { type: "flow", payload: "leke" } },
    ],
  },
  {
    prefix: ["kur", "kuru", "nem", "gergi"],
    items: [
      { id: "ac-kuruluk", label: "Kuruluk / Nemsizlik", subtitle: "Bariyer ve nem desteği", action: { type: "flow", payload: "kuruluk" } },
    ],
  },
  {
    prefix: ["bar", "bariyer", "pullan"],
    items: [
      { id: "ac-bariyer", label: "Bariyer zayıflığı / Pullanma", subtitle: "Kuruluk akışı", action: { type: "flow", payload: "kuruluk" } },
    ],
  },
  {
    prefix: ["sac", "saç", "dok", "dökü", "sacim"],
    items: [
      { id: "ac-sac", label: "Saç dökülmesi", subtitle: "Güçlendirme ve bakım", action: { type: "flow", payload: "sac" } },
    ],
  },
  {
    prefix: ["kep", "kepek"],
    items: [
      { id: "ac-kepek", label: "Kepek sorunu", subtitle: "Saç derisi hassasiyeti", action: { type: "flow", payload: "sac" } },
    ],
  },
  {
    prefix: ["gün", "güne", "gune", "spf", "uv", "sun"],
    items: [
      { id: "ac-gunes", label: "Güneş koruma / SPF", subtitle: "Koruma ve seçim rehberi", action: { type: "flow", payload: "gunes" } },
    ],
  },
  {
    prefix: ["tah", "tahri"],
    items: [
      { id: "ac-tahris", label: "Tahriş / Hassas tepki", subtitle: "Hassasiyet akışı", action: { type: "flow", payload: "hassasiyet" } },
    ],
  },
  {
    prefix: ["siy", "siyah"],
    items: [
      { id: "ac-siyah-nokta", label: "Siyah nokta / Gözenek", subtitle: "Akne akışı", action: { type: "flow", payload: "akne" } },
    ],
  },
  {
    prefix: ["yag", "yağ"],
    items: [
      { id: "ac-yaglanma", label: "Yağlanma / Yağlı cilt", subtitle: "Akne ile ilişkili", action: { type: "flow", payload: "akne" } },
    ],
  },
];

export function getAutoCompleteItems(query: string): AutoCompleteItem[] {
  if (query.length < 1) return [];
  const q = normalizeTR(query);
  const results: AutoCompleteItem[] = [];
  for (const group of AUTOCOMPLETE_HINTS) {
    if (group.prefix.some(p => q.startsWith(normalizeTR(p)) || normalizeTR(p).startsWith(q))) {
      results.push(...group.items);
    }
  }
  return results.slice(0, 3);
}
