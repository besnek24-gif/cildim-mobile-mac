import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Event tipleri ──────────────────────────────────────────────────────────

export type EventType =
  | "product_view"           // pasif — ürün detayına girdi
  | "product_click"          // orta — kart tıklaması
  | "compare_open"           // orta — karşılaştırma sayfasını açtı
  | "compare_winner_click"   // güçlü — kazananı seçti
  | "favorite_add"           // güçlü — favoriye ekledi
  | "repeat_view"            // orta-güçlü — aynı ürüne tekrar döndü
  | "tab_view"               // orta — içerik / uygunluk sekmesini açtı
  | "share_product"          // güçlü — ürünü paylaştı
  | "open_teaser"            // sinyal — premium teaser'a tıkladı
  | "view_category"          // pasif — kategoriye baktı
  | "view_brand"             // pasif — markaya baktı
  // ── Yeni (öğrenen sistem v2) ─────────────────────────────
  | "search_query"           // arama yapıldı
  | "corrected_search_used"  // "bunu mu demek istediniz?" tıklandı
  | "recommendation_click"   // öneri satırından ürüne gidildi
  | "routine_created"        // rutin oluşturuldu
  | "routine_step_click"     // rutin adımına tıklandı
  | "decision_guide_open"    // karar rehberi açıldı
  | "premium_unlock_click";  // premium kilit alanına tıklandı

export interface UserEvent {
  eventType: EventType;
  productId?: string;
  brand?: string;
  category?: string;
  segment?: string;
  concern?: string;   // concern slug (acne / sunscreen / dryness …)
  query?: string;     // search_query ve corrected_search_used için
  timestamp: number;
}

// ── Öğrenme profili ────────────────────────────────────────────────────────

export interface EngagementSignals {
  comparesOften:       boolean;  // sık karşılaştırıyor
  sharesProducts:      boolean;  // ürün paylaşıyor
  opensDeepAnalysis:   boolean;  // premium alanlara meraklı
  favoritesFrequently: boolean;  // sık favoriliyor
}

export interface LearningProfile {
  topCategories:    string[];
  topSubcategories: string[];
  topBrands:        string[];
  topSegments:      string[];
  hasEnoughData:    boolean;
  engagementSignals: EngagementSignals;
}

// ── Concern ilgi profili ───────────────────────────────────────────────────

/**
 * Her concern için 0–100 arası ilgi skoru.
 * Puanlar decay ile zamanla azalır.
 * Karar için eşik: ≥ 20 → "ilgileniyorsunuz", ≥ 50 → "güçlü ilgi"
 */
export interface ConcernInterestProfile {
  acne:          number;  // akne / sivilce
  spots:         number;  // leke / hiperpigmentasyon
  dryness:       number;  // kuruluk / nem
  sensitivity:   number;  // hassasiyet / kızarıklık
  sunscreen:     number;  // güneş koruması
  antiaging:     number;  // yaşlanma karşıtı
  barrier:       number;  // bariyer onarımı
  pore:          number;  // gözenek
  serum:         number;  // serum (kategori)
  haircare:      number;  // saç bakımı
  totalEvents:   number;
  hasEnoughData: boolean; // en az 5 concern sinyali
}

// Kategori/query → concern eşleştirme anahtar kelimeleri
const CONCERN_DETECT: Record<keyof Omit<ConcernInterestProfile, "totalEvents" | "hasEnoughData">, string[]> = {
  acne:        ["akne", "sivilce", "acne", "blemish", "breakout", "bha", "salicylic", "niacinamide", "çinko", "zinc"],
  spots:       ["leke", "spot", "pigment", "brightening", "aydınlatma", "vitamin c", "arbutin", "kojic", "ton eşit"],
  dryness:     ["kuru", "nem", "nemlendirici", "hydrat", "moistur", "hyaluronic", "ceramide", "seramid", "dry"],
  sensitivity: ["hassas", "sensitive", "kızarıklık", "redness", "centella", "cica", "gentle", "nazik", "duyarlı"],
  sunscreen:   ["güneş", "spf", "sun", "uv", "koruyucu", "sunscreen"],
  antiaging:   ["yaşlanma", "anti-aging", "kırışıklık", "retinol", "peptide", "bakuchiol", "wrinkle", "collagen"],
  barrier:     ["bariyer", "barrier", "onarım", "repair", "ceramide", "fatty acid", "cilt bariyeri"],
  pore:        ["gözenek", "pore", "minimiz", "blackhead", "siyah nokta"],
  serum:       ["serum", "essence", "ampoule"],
  haircare:    ["saç", "şampuan", "shampoo", "saç dökülme", "biotin", "hair"],
};

/**
 * Event listesinden concern interest profili hesapla.
 * Senkron, saf fonksiyon — hook tarafından kullanılır.
 */
export function computeConcernInterestProfile(events: UserEvent[]): ConcernInterestProfile {
  const scores: Record<keyof Omit<ConcernInterestProfile, "totalEvents" | "hasEnoughData">, number> = {
    acne: 0, spots: 0, dryness: 0, sensitivity: 0, sunscreen: 0,
    antiaging: 0, barrier: 0, pore: 0, serum: 0, haircare: 0,
  };

  let concernSignals = 0;

  // Concern event ağırlıkları
  const CONCERN_EVENT_W: Partial<Record<EventType, number>> = {
    search_query:          2.0,
    corrected_search_used: 2.5,
    product_view:          0.5,
    product_click:         1.0,
    favorite_add:          4.0,
    compare_open:          1.5,
    compare_winner_click:  3.0,
    recommendation_click:  2.0,
    view_category:         0.3,
    decision_guide_open:   1.5,
    repeat_view:           2.0,
  };

  for (const e of events) {
    const baseW = CONCERN_EVENT_W[e.eventType] ?? 0;
    if (baseW === 0) continue;

    const decay = timeDecayMultiplier(e.timestamp);
    const w = baseW * decay;

    // (a) Doğrudan concern alanı varsa
    if (e.concern) {
      const key = e.concern as keyof typeof scores;
      if (key in scores) {
        scores[key] += w;
        concernSignals++;
        continue;
      }
    }

    // (b) Query / category / productId → anahtar kelime tespiti
    const haystack = [e.query ?? "", e.category ?? ""].join(" ").toLowerCase();
    if (!haystack.trim()) continue;

    let matched = false;
    for (const [concern, kws] of Object.entries(CONCERN_DETECT)) {
      if (kws.some(kw => haystack.includes(kw))) {
        scores[concern as keyof typeof scores] += w;
        if (!matched) { concernSignals++; matched = true; }
      }
    }
  }

  // 0–100 sınırla
  for (const k of Object.keys(scores)) {
    scores[k as keyof typeof scores] = Math.min(Math.round(scores[k as keyof typeof scores] * 10), 100);
  }

  return {
    ...scores,
    totalEvents:   events.length,
    hasEnoughData: concernSignals >= 5,
  };
}

// ── Event ağırlıkları ──────────────────────────────────────────────────────
/**
 * product_view        0.5  — pasif gezinme, düşük güven
 * product_click       1.0  — aktif ilgi
 * tab_view            0.7  — sekme merakı
 * compare_open        0.8  — karşılaştırma isteği
 * compare_winner_click 4.0 — en güçlü açık tercih sinyali
 * favorite_add        4.0  — eşdeğer güçlü tercih
 * repeat_view         2.5  — aynı ürüne dönüş → gerçek merak
 * share_product       3.0  — güçlü; paylaşmaya değer buldu
 * open_teaser         1.5  — premium merakı
 * view_category       0.3  — kategori gezinmesi
 * view_brand          0.4  — marka gezinmesi
 */
const EVENT_WEIGHTS: Partial<Record<EventType, number>> = {
  compare_winner_click: 4.0,
  favorite_add:         4.0,
  repeat_view:          2.5,
  share_product:        3.0,
  open_teaser:          1.5,
  product_click:        1.0,
  tab_view:             0.7,
  compare_open:         0.8,
  product_view:         0.5,
  view_brand:           0.4,
  view_category:        0.3,
};

// Engagement eşikleri
const ENGAGE_THRESHOLD = {
  comparesOften:       3,   // en az 3 compare_open veya winner_click
  sharesProducts:      2,   // en az 2 share_product
  opensDeepAnalysis:   2,   // en az 2 open_teaser
  favoritesFrequently: 3,   // en az 3 favorite_add
};

const MIN_EVENTS = 5;
const TOP_N = 3;
const DAY_MS = 1000 * 60 * 60 * 24;

// ── Zaman ağırlığı ────────────────────────────────────────────────────────

function timeDecayMultiplier(timestamp: number): number {
  const ageDays = (Date.now() - timestamp) / DAY_MS;
  if (ageDays <= 7)  return 1.0;
  if (ageDays <= 30) return 0.5;
  return 0.15;
}

// ── Çeşitlilik koruyucu ───────────────────────────────────────────────────

function dampenWeights(weights: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    result[k] = Math.sqrt(v);
  }
  return result;
}

// ── Öğrenme profili hesaplama ──────────────────────────────────────────────

/**
 * Events ve ürün listesinden kullanıcının ilgi profilini çıkarır.
 * Senkron, saf fonksiyon — hook tarafından çağrılır.
 */
export function computeLearningProfile(
  events: UserEvent[],
  products: Array<{ id: string | number; category?: string; subcategory?: string }>,
): LearningProfile {
  const emptyProfile: LearningProfile = {
    topCategories:    [],
    topSubcategories: [],
    topBrands:        [],
    topSegments:      [],
    hasEnoughData:    false,
    engagementSignals: {
      comparesOften:       false,
      sharesProducts:      false,
      opensDeepAnalysis:   false,
      favoritesFrequently: false,
    },
  };

  const productMap = new Map<string, { category: string; subcategory: string }>();
  for (const p of products) {
    productMap.set(String(p.id), {
      category:    ((p as any).category ?? (p as any).kategori ?? "").toLowerCase().trim(),
      subcategory: ((p as any).subcategory ?? "").toLowerCase().trim(),
    });
  }

  const qualified = events.filter(
    (e) => EVENT_WEIGHTS[e.eventType] !== undefined,
  );

  if (qualified.length < MIN_EVENTS) return emptyProfile;

  const catW: Record<string, number> = {};
  const subW: Record<string, number> = {};
  const brandW: Record<string, number> = {};
  const segW: Record<string, number> = {};

  // Engagement sayaçları
  let compareCount   = 0;
  let shareCount     = 0;
  let teaserCount    = 0;
  let favoriteCount  = 0;

  for (const e of qualified) {
    const w = EVENT_WEIGHTS[e.eventType]! * timeDecayMultiplier(e.timestamp);

    // Ürün tabanlı category/subcategory
    if (e.productId) {
      const info = productMap.get(e.productId);
      if (info) {
        if (info.category)    catW[info.category]    = (catW[info.category]    ?? 0) + w;
        if (info.subcategory) subW[info.subcategory] = (subW[info.subcategory] ?? 0) + w;
      }
    }

    // Event içinden gelen brand / segment / category
    if (e.brand) {
      const b = e.brand.toLowerCase().trim();
      if (b) brandW[b] = (brandW[b] ?? 0) + w;
    }
    if (e.segment) {
      const s = e.segment.toLowerCase().trim();
      if (s) segW[s] = (segW[s] ?? 0) + w;
    }
    if (e.category && !e.productId) {
      const c = e.category.toLowerCase().trim();
      if (c) catW[c] = (catW[c] ?? 0) + w;
    }

    // Engagement sayaçları (ham event; zaman ağırlığı uygulanmaz — sadece sayı)
    if (e.eventType === "compare_open" || e.eventType === "compare_winner_click") compareCount++;
    if (e.eventType === "share_product")          shareCount++;
    if (e.eventType === "open_teaser")            teaserCount++;
    if (e.eventType === "favorite_add")           favoriteCount++;
  }

  const top = (r: Record<string, number>) =>
    Object.entries(dampenWeights(r))
      .sort(([, a], [, b]) => b - a)
      .slice(0, TOP_N)
      .map(([k]) => k);

  return {
    topCategories:    top(catW),
    topSubcategories: top(subW),
    topBrands:        top(brandW),
    topSegments:      top(segW),
    hasEnoughData:    true,
    engagementSignals: {
      comparesOften:       compareCount   >= ENGAGE_THRESHOLD.comparesOften,
      sharesProducts:      shareCount     >= ENGAGE_THRESHOLD.sharesProducts,
      opensDeepAnalysis:   teaserCount    >= ENGAGE_THRESHOLD.opensDeepAnalysis,
      favoritesFrequently: favoriteCount  >= ENGAGE_THRESHOLD.favoritesFrequently,
    },
  };
}

// ── Davranış sinyalleri (öneri gerekçesi) ─────────────────────────────────

/**
 * Bir ürün ve mevcut öğrenme profili karşılaştırılarak
 * "neden önerildi" açıklama satırları döner.
 * Boş profilde boş dizi döner — güvenli.
 */
export function getBehaviorSignals(
  product: { category?: string; brand?: string; segment?: string },
  profile: LearningProfile | undefined,
): string[] {
  if (!profile || !profile.hasEnoughData) return [];

  const reasons: string[] = [];
  const cat  = (product.category ?? "").toLowerCase().trim();
  const brand = (product.brand    ?? "").toLowerCase().trim();
  const seg  = (product.segment  ?? "").toLowerCase().trim();

  if (cat  && profile.topCategories.includes(cat))
    reasons.push("Sık incelediğin kategoriyle benzer");

  if (brand && profile.topBrands.includes(brand))
    reasons.push("İlgi gösterdiğin markadan bir ürün");

  if (seg && profile.topSegments.includes(seg))
    reasons.push("İlgi gösterdiğin segmentte yer alıyor");

  return reasons.slice(0, 2);
}

// ── AsyncStorage CRUD ─────────────────────────────────────────────────────

const STORAGE_KEY = "@ciltbakim:user_events";
const MAX_EVENTS  = 500;

/**
 * Kullanıcı olayı kaydeder — ateşle-unut, hata fırlatmaz.
 *
 * @param eventType  Olay türü
 * @param productId  Ürün ID (varsa)
 * @param meta       brand / category / segment (varsa)
 */
export function trackEvent(
  eventType: EventType,
  productId?: string,
  meta?: { brand?: string; category?: string; segment?: string; concern?: string; query?: string },
): void {
  const event: UserEvent = { eventType, timestamp: Date.now() };
  if (productId)      event.productId = productId;
  if (meta?.brand)    event.brand     = meta.brand;
  if (meta?.category) event.category  = meta.category;
  if (meta?.segment)  event.segment   = meta.segment;
  if (meta?.concern)  event.concern   = meta.concern;
  if (meta?.query)    event.query     = meta.query;

  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const existing: UserEvent[] = raw ? JSON.parse(raw) : [];
      const updated = [...existing, event].slice(-MAX_EVENTS);
      return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    })
    .catch(() => {});
}

export async function getUserEvents(): Promise<UserEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearUserEvents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}
