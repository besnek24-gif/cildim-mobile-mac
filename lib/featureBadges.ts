/**
 * featureBadges.ts — Akıllı Rozet Dönüştürme Motoru
 *
 * Ürünün ham verilerini (concerns, tags, active_ingredients, skin_types,
 * boolean formülasyon bayrakları, features listesi) analiz ederek
 * en fazla 2 adet kısa, anlamlı Türkçe rozet üretir.
 *
 * Yeni mapping eklemek için ilgili bölümdeki tabloyu genişlet:
 *   - CONCERN_MAP  → concern/tag → anlam
 *   - INGREDIENT_MAP → aktif içerik → anlam
 *   - SKIN_TYPE_MAP → cilt tipi → anlam
 *   - RAW_BADGE_MAP → Supabase'den gelen ham string → anlam
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipler
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeCandidate {
  label: string;
  group: string;   // Semantik grup — aynı gruptakiler birbirinin yerine geçer
  priority: number; // Küçük = daha önemli
}

// ─────────────────────────────────────────────────────────────────────────────
// Yardımcı
// ─────────────────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[İıÖöÜüÇçŞşĞğ]/g, (c) =>
      ({ İ: "i", ı: "i", Ö: "o", ö: "o", Ü: "u", ü: "u", Ç: "c", ç: "c", Ş: "s", ş: "s", Ğ: "g", ğ: "g" }[c] ?? c)
    )
    .trim();
}

function includes(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature Flag Resolver — schema-safe formülasyon bayrağı çözümleyici
//
// Eskiden Supabase `products` tablosunda 3 boolean kolon bekleniyordu:
//   contains_fragrance, contains_alcohol, contains_paraben
// Bu kolonlar şemada YOK (PostgREST 42703 → Home query fail). Bu resolver:
//   1) Backward-compat: ürün üzerinde `contains_<key>` direkt boolean varsa
//      onu döndürür (legacy data ya da gelecekte eklenirse uyumlu kalır).
//   2) `features` (string[] veya jsonb obje) ve `badges` (string[]) içinden
//      pozitif/negatif marker tarayarak çıkarır.
//   3) Sinyal yoksa null.
//
// Dönüş semantiği — legacy `contains_*` ile birebir aynıdır:
//   `false` = ürün BU maddeyi İÇERMEZ ("free")     → pozitif rozet sinyali
//   `true`  = ürün BU maddeyi İÇERİR ("contains")  → negatif rozet sinyali
//   `null`  = bilinmiyor
// ─────────────────────────────────────────────────────────────────────────────

export type FeatureFlagKey =
  | "fragrance"
  | "alcohol"
  | "paraben"
  | "sulfate"
  | "silicone";

const FEATURE_KEY_TOKENS: Record<FeatureFlagKey, string[]> = {
  fragrance: ["parfum", "fragrance", "koku"],
  alcohol:   ["alkol", "alcohol"],
  paraben:   ["paraben"],
  sulfate:   ["sulfat", "sulfate", "sls"],
  silicone:  ["silikon", "silicone"],
};

const FEATURE_FREE_MARKERS = [
  "_free", "free", "siz", "sız", "yok", "icermez", "unscented", "no_",
];

const FEATURE_CONTAINS_MARKERS = [
  "iceriyor", "contains", "icerir", "_with_",
];

function _normalizeFeatureToken(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/ı/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

/**
 * Backward-compatible feature flag resolver.
 *
 * Hangi tarafın çağıracağı: badge motoru, search filter chip'leri, ürün
 * detay analiz ekranı, danışma ekranı kart rozetleri.
 *
 * @param product Herhangi bir ürün-benzeri obje (legacy/domain/raw fark etmez).
 * @param key     Standart formülasyon anahtarı.
 * @returns       false = "free", true = "contains", null = bilinmiyor.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFeatureFlag(product: any, key: FeatureFlagKey): boolean | null {
  if (!product) return null;

  // 1) Backward-compat: explicit boolean column (varsa).
  const directKey = `contains_${key}`;
  const direct = product[directKey];
  if (direct === false) return false;
  if (direct === true) return true;

  // 2) features + badges scan. features bazen jsonb obje gelebilir
  //    ({ fragrance: false }) — bu da desteklenir.
  const tokens: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const push = (v: any): void => {
    if (v == null) return;
    if (Array.isArray(v)) { for (const x of v) push(x); return; }
    if (typeof v === "string") { tokens.push(_normalizeFeatureToken(v)); return; }
    if (typeof v === "object") {
      // jsonb { fragrance: false } / { alcohol: true } şeklinde gelebilir
      if (Object.prototype.hasOwnProperty.call(v, key)) {
        const val = (v as Record<string, unknown>)[key];
        if (val === false || val === "false" || val === 0) tokens.push(`${key}_free`);
        if (val === true  || val === "true"  || val === 1) tokens.push(`contains_${key}`);
      }
      // Ayrıca obje field'larından metin parçaları toplama (yan kanal):
      for (const candidate of [(v as any).name, (v as any).label, (v as any).id, (v as any).key]) {
        if (typeof candidate === "string") tokens.push(_normalizeFeatureToken(candidate));
      }
    }
  };
  push(product.features);
  push(product.badges);

  const subs = FEATURE_KEY_TOKENS[key];
  let foundFree = false;
  let foundContains = false;
  for (const t of tokens) {
    if (!t) continue;
    const hasKey = subs.some((s) => t.includes(s));
    if (!hasKey) continue;
    if (FEATURE_CONTAINS_MARKERS.some((m) => t.includes(m))) { foundContains = true; continue; }
    if (FEATURE_FREE_MARKERS.some((m) => t.includes(m)))     { foundFree = true; continue; }
  }
  if (foundFree && !foundContains) return false;
  if (foundContains && !foundFree) return true;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tablo 1 — Concern / Tag eşleştirmesi
// Her giriş: [anahtar_kelimeler, {label, group, priority}]
// Öncelik: 1 (en yüksek) → 9 (en düşük)
// ─────────────────────────────────────────────────────────────────────────────

type MappingEntry = [string[], Omit<BadgeCandidate, "label"> & { label: string }];

const CONCERN_MAP: MappingEntry[] = [
  // ── Güneş koruma ─────────────────────────────────────────────────────────
  [["spf", "uv", "güneş koruyu", "sunscreen", "güneş filtresi"],
    { label: "yüksek koruma", group: "sun", priority: 1 }],

  // ── Anti-leke / aydınlatma ───────────────────────────────────────────────
  [["leke", "hiperpigmentasyon", "hyperpigmentation", "dark spot", "ton esitsizligi", "ton eşitsizliği"],
    { label: "leke karşıtı", group: "bright", priority: 1 }],
  [["aydınlatma", "aydınlatıcı", "glow", "cilt tonu", "parlak", "brightening", "radiance"],
    { label: "aydınlatıcı etki", group: "bright", priority: 2 }],

  // ── Akne / sivilce ───────────────────────────────────────────────────────
  [["akne", "acne", "sivilce", "breakout", "blemish", "siyah nokta", "blackhead"],
    { label: "akne önleyici", group: "acne", priority: 1 }],

  // ── Yaşlanma karşıtı ─────────────────────────────────────────────────────
  [["anti-aging", "anti aging", "yaşlanma", "kırışıklık", "wrinkle", "fine line", "aging", "yaslanti"],
    { label: "yaşlanma karşıtı", group: "antiage", priority: 1 }],
  [["firming", "sıkılaştır", "lifting", "gergin"],
    { label: "sıkılaştırıcı", group: "antiage", priority: 2 }],

  // ── Bariyer / hassas ─────────────────────────────────────────────────────
  [["bariyer", "barrier", "skin barrier"],
    { label: "bariyer güçlendirici", group: "barrier", priority: 1 }],
  [["hassas", "sensitive", "rosacea", "kızarıklık", "redness", "tahriş", "couperose"],
    { label: "hassas cilt dostu", group: "sensitive", priority: 1 }],

  // ── Nem ──────────────────────────────────────────────────────────────────
  [["derin nem", "intense hydration", "hyalüronic", "hyaluronic", "deep moisture"],
    { label: "derin nemlendirici", group: "hydration", priority: 1 }],
  [["nem", "hydration", "hydrating", "nemlendirici", "moisture", "moisturizing"],
    { label: "yoğun nemlendirici", group: "hydration", priority: 2 }],
  [["kuru cilt", "dry skin", "kuruluk"],
    { label: "kuru cilt bakımı", group: "hydration", priority: 2 }],

  // ── Yağ / gözenek ────────────────────────────────────────────────────────
  [["yağ dengesi", "oil control", "sebum", "mat", "matte", "yağlılık"],
    { label: "yağ dengeleyici", group: "oil", priority: 1 }],
  [["gözenek", "pore", "blackhead", "siyah nokta"],
    { label: "gözenek minimize", group: "pore", priority: 1 }],

  // ── Yenilenme / peeling ──────────────────────────────────────────────────
  [["exfoliant", "exfoliation", "peeling", "asit", "aha", "bha", "pha"],
    { label: "yenileyici peeling", group: "exfoliating", priority: 2 }],

  // ── Göz çevresi ──────────────────────────────────────────────────────────
  [["göz", "eye", "dark circle", "halka", "göz torbası", "morlu"],
    { label: "göz çevresi bakımı", group: "eye", priority: 1 }],

  // ── Kolajen / peptit ─────────────────────────────────────────────────────
  [["kolajen", "collagen", "peptit", "peptide", "elastin"],
    { label: "kolajen destekleyici", group: "antiage", priority: 3 }],

  // ── Cica / yatıştırıcı ───────────────────────────────────────────────────
  [["cica", "centella", "yatıştırıcı", "soothing", "calming"],
    { label: "yatıştırıcı cica", group: "sensitive", priority: 2 }],

  // ── Karma cilt ───────────────────────────────────────────────────────────
  [["karma cilt", "combination", "t-zon", "t-zone"],
    { label: "karma cilt dostu", group: "oil", priority: 3 }],
];

// ─────────────────────────────────────────────────────────────────────────────
// Tablo 2 — Aktif içerik eşleştirmesi (active_ingredients + ingredients)
// ─────────────────────────────────────────────────────────────────────────────

const INGREDIENT_MAP: MappingEntry[] = [
  [["retinol", "retinoid", "tretinoin", "vitamin a", "bakuchiol"],
    { label: "yaşlanma karşıtı", group: "antiage", priority: 2 }],
  [["niacinamide", "niasinamid", "niacin"],
    { label: "leke karşıtı", group: "bright", priority: 2 }],
  [["vitamin c", "c vitamini", "ascorbic", "kakadu", "arbutin", "kojic"],
    { label: "aydınlatıcı etki", group: "bright", priority: 2 }],
  [["hyaluronic acid", "hyalüronik asit", "hyaluronique", "sodium hyaluronate"],
    { label: "derin nemlendirici", group: "hydration", priority: 2 }],
  [["ceramide", "seramid", "ceramid"],
    { label: "bariyer güçlendirici", group: "barrier", priority: 2 }],
  [["salicylic acid", "salisilik asit", "bha", "bha asit"],
    { label: "akne önleyici", group: "acne", priority: 2 }],
  [["glycolic acid", "glikolik asit", "aha", "lactic acid", "mandelic acid"],
    { label: "yenileyici peeling", group: "exfoliating", priority: 3 }],
  [["peptide", "peptit", "matrixyl", "argireline", "leuphasyl"],
    { label: "kolajen destekleyici", group: "antiage", priority: 3 }],
  [["zinc", "çinko", "zinc pca", "zinc gluconate"],
    { label: "yağ dengeleyici", group: "oil", priority: 3 }],
  [["spf", "sunscreen", "uv filter", "titanium dioxide", "zinc oxide"],
    { label: "yüksek koruma", group: "sun", priority: 2 }],
  [["adenosine", "adenozin"],
    { label: "yaşlanma karşıtı", group: "antiage", priority: 3 }],
  [["centella", "cica", "madecassoside", "asiaticoside"],
    { label: "yatıştırıcı cica", group: "sensitive", priority: 3 }],
  [["tranexamic acid", "traneksamik"],
    { label: "leke karşıtı", group: "bright", priority: 2 }],
  [["azelaic acid", "azelaik"],
    { label: "akne önleyici", group: "acne", priority: 3 }],
  [["growth factor", "egf", "büyüme faktörü"],
    { label: "kolajen destekleyici", group: "antiage", priority: 3 }],
];

// ─────────────────────────────────────────────────────────────────────────────
// Tablo 3 — Ham Supabase string'i → anlam dönüşümü
// (raw badges veya features alanından gelen teknik etiketler)
// ─────────────────────────────────────────────────────────────────────────────

const RAW_BADGE_MAP: MappingEntry[] = [
  // ── 26 Standart Feature Key ───────────────────────────────────────────────
  // Tam anahtar eşleştirmeleri — önce bunlar kontrol edilir

  [["high_protection"],
    { label: "yüksek koruma",        group: "sun",      priority: 1 }],

  [["anti_aging", "anti-aging", "anti aging"],
    { label: "yaşlanma karşıtı",     group: "antiage",  priority: 1 }],

  [["hair_loss_support", "anti_hair_loss"],
    { label: "dökülme karşıtı",      group: "hair",     priority: 1 }],

  [["hydrating", "moisturizing", "deep_moisture", "intense_hydration"],
    { label: "yoğun nem",            group: "hydration", priority: 2 }],

  [["oil_control", "shine_control", "sebum_control"],
    { label: "yağ kontrolü",         group: "oil",      priority: 2 }],

  [["spot_care", "dark_spot", "spot_correction"],
    { label: "leke bakımı",          group: "bright",   priority: 2 }],

  [["tone_evening"],
    { label: "ten eşitleme",         group: "bright",   priority: 2 }],

  [["brightening", "whitening"],
    { label: "aydınlatıcı",          group: "bright",   priority: 2 }],

  [["barrier_support", "barrier_repair", "skin_barrier"],
    { label: "bariyer güçlendirici", group: "barrier",  priority: 2 }],

  [["repair_care", "restorative"],
    { label: "onarıcı bakım",        group: "repair",   priority: 2 }],

  [["acne_prone_friendly", "anti_acne", "acne_prone", "acne_control"],
    { label: "akne dostu",           group: "acne",     priority: 2 }],

  [["sensitive_skin_friendly", "for_sensitive"],
    { label: "hassas cilt dostu",    group: "sensitive", priority: 2 }],

  [["redness_support"],
    { label: "kızarıklık karşıtı",   group: "sensitive", priority: 2 }],

  [["soothing", "calming"],
    { label: "yatıştırıcı",          group: "sensitive", priority: 2 }],

  [["pore_care"],
    { label: "gözenek bakımı",       group: "pore",     priority: 2 }],

  [["gentle_cleanse"],
    { label: "nazik temizlik",       group: "cleanse",  priority: 2 }],

  [["deep_cleanse"],
    { label: "derin temizlik",       group: "cleanse",  priority: 2 }],

  [["baby_friendly"],
    { label: "bebek dostu",          group: "gentle",   priority: 2 }],

  [["strengthening", "fortifying"],
    { label: "güçlendirici",         group: "strengthen", priority: 3 }],

  [["matte_finish", "mattifying"],
    { label: "mat görünüm",          group: "finish",   priority: 3 }],

  [["non_comedogenic", "non comedogenic"],
    { label: "akne dostu",           group: "pore",     priority: 3 }],

  [["oily_skin_safe", "oily_skin_friendly"],
    { label: "yağlı cilt uygun",     group: "oil",      priority: 3 }],

  [["water_resistant", "waterproof"],
    { label: "suya dayanıklı",       group: "function", priority: 3 }],

  [["tinted_finish"],
    { label: "renkli formül",        group: "tint",     priority: 3 }],

  [["fragrance_free", "fragrance-free", "no fragrance", "unscented"],
    { label: "parfüm içermez",       group: "clean",    priority: 4 }],

  [["light_texture", "lightweight", "gel_texture", "fluid_texture", "non_greasy"],
    { label: "hafif doku",           group: "texture",  priority: 4 }],

  [["daily_use"],
    { label: "günlük kullanım",      group: "usage",    priority: 5 }],

  // ── Genel formül güvenliği (eski mappingler — backward compat) ────────────
  [["parabensiz", "paraben yok", "paraben-free", "no paraben", "paraben_free"],
    { label: "hassas cilt dostu",    group: "sensitive", priority: 4 }],
  [["parfümsüz", "koku yok"],
    { label: "parfümsüz",            group: "clean",    priority: 4 }],
  [["alkol yok", "alkol içermez", "alcohol-free", "alcohol_free"],
    { label: "bariyer güçlendirici", group: "barrier",  priority: 5 }],
  [["vegan"],
    { label: "vegan formül",         group: "ethical",  priority: 4 }],
  [["doğal", "natural", "organik", "organic"],
    { label: "doğal formül",         group: "ethical",  priority: 5 }],
  [["hypoallergenic", "hipoalerjenik", "allerji dostu", "sensitive_skin"],
    { label: "hassas cilt dostu",    group: "sensitive", priority: 4 }],
  [["dermatologisch", "dermatolog test", "dermatolojik test"],
    { label: "dermatolojik test",    group: "certified", priority: 4 }],

  // ── Güneş (genel) ─────────────────────────────────────────────────────────
  [["spf", "uv", "sun_protection", "sunscreen"],
    { label: "yüksek koruma",        group: "sun",      priority: 2 }],
  [["mineral", "mineral_filter", "zinc oxide", "zinc_oxide", "titanium dioxide", "titanium_dioxide"],
    { label: "mineral filtre",       group: "filter",   priority: 3 }],

  // ── Genel anahtar kelimeler (eski mappingler — backward compat) ───────────
  [["yaşlanma karşıtı", "firming", "lifting"],
    { label: "yaşlanma karşıtı",     group: "antiage",  priority: 2 }],
  [["akne", "acne", "anti-acne"],
    { label: "akne dostu",           group: "acne",     priority: 3 }],
  [["leke", "aydınlatıcı"],
    { label: "leke bakımı",          group: "bright",   priority: 3 }],
  [["nemlendirici", "moisture", "hyaluronik"],
    { label: "yoğun nem",            group: "hydration", priority: 3 }],
  [["oil_free"],
    { label: "yağ kontrolü",         group: "oil",      priority: 3 }],
  [["barrier", "bariyer"],
    { label: "bariyer güçlendirici", group: "barrier",  priority: 3 }],
];

// ─────────────────────────────────────────────────────────────────────────────
// Tablo 4 — Cilt tipi sinyali (son çare, düşük öncelik)
// ─────────────────────────────────────────────────────────────────────────────

const SKIN_TYPE_BADGE: Record<string, { label: string; group: string; priority: number }> = {
  sensitive:   { label: "hassas cilt dostu",  group: "sensitive",  priority: 6 },
  dry:         { label: "kuru cilt bakımı",   group: "hydration",  priority: 6 },
  oily:        { label: "yağ dengeleyici",    group: "oil",        priority: 6 },
  combination: { label: "karma cilt dostu",   group: "oil",        priority: 6 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Eşleştirici
// ─────────────────────────────────────────────────────────────────────────────

function matchTable(table: MappingEntry[], signal: string): BadgeCandidate | null {
  const norm = normalize(signal);
  for (const [keywords, badge] of table) {
    for (const kw of keywords) {
      if (norm.includes(normalize(kw))) {
        return badge;
      }
    }
  }
  return null;
}

function scanList(list: string[], table: MappingEntry[], candidates: BadgeCandidate[]): void {
  for (const item of list) {
    const match = matchTable(table, item);
    if (match) candidates.push(match);
  }
}

/**
 * Supabase alanlarını güvenli string[]'e normalize eder.
 *
 * Gerekçe: Supabase'den gelen `features`, `badges`, `concerns`, `tags`,
 * `ingredients` vb. alanlar zaman zaman beklenmedik şekillerde gelir
 * (jsonb sütunlar): kimi zaman string[], kimi zaman string, kimi zaman
 * { alcohol: false, paraben: false, fragrance: true } gibi düz obje.
 * Düz obje üzerinde `[...obj]` yapmak "iterator method is not callable"
 * hatasına neden olur (objelerin Symbol.iterator yok). Bu yardımcı her
 * şekli güvenli string[]'e çevirir:
 *   - Array            → string elemanlar; obje elemanları JSON'lanır
 *   - string           → tek elemanlı dizi
 *   - object           → değeri true olan key'ler ham rozet sinyali olarak alınır
 *   - null/undefined   → []
 */
function toStringArray(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : v == null ? "" : JSON.stringify(v)))
      .filter((s): s is string => Boolean(s));
  }

  if (typeof value === "string") {
    return value.length > 0 ? [value] : [];
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v === true || v === "true" || v === 1)
      .map(([k]) => k);
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Ürün giriş tipi (sadece badge motoru için gerekli alanlar)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductBadgeInput {
  features?: string[];         // Supabase'den gelen ham feature/badge listesi
  badges?: string[];           // Eski ham rozet listesi (legacy uyum)
  concerns?: string[];         // Cilt endişeleri
  concerns_supported?: string[]; // Ek endişe listesi
  tags?: string[];             // Ürün etiketleri
  active_ingredients?: string[]; // Aktif içerikler
  ingredients?: string[];      // Tüm içerik listesi (tarama için)
  skin_types?: string[];       // Cilt tipi listesi
  skin_type?: string;          // Tekil cilt tipi
  contains_fragrance?: boolean;
  contains_alcohol?: boolean;
  contains_paraben?: boolean;
  category?: string;           // Kategori (güneş kremi vb. çıkarımı)
  short_benefit?: string;      // Tek cümlelik fayda (scan source)
}

// ─────────────────────────────────────────────────────────────────────────────
// Ana fonksiyon
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ürünün ham verilerini analiz ederek max 2 adet anlamlı rozet döndürür.
 *
 * @returns string[] — 0, 1 veya 2 eleman; hiçbiri yoksa [] (sahte badge yok)
 */
export function deriveFeatureBadges(product: ProductBadgeInput): string[] {
  const candidates: BadgeCandidate[] = [];

  // 1. Concern/tag taraması — en yüksek öncelik
  // toStringArray: Supabase jsonb sütunları için defansif normalize.
  const concerns: string[] = [
    ...toStringArray(product.concerns),
    ...toStringArray(product.concerns_supported),
    ...toStringArray(product.tags),
  ];
  scanList(concerns, CONCERN_MAP, candidates);

  // 2. short_benefit taraması — concern'a yakın anlam
  if (product.short_benefit) {
    const match = matchTable(CONCERN_MAP, product.short_benefit);
    if (match) candidates.push({ ...match, priority: match.priority + 0.5 });
  }

  // 3. Aktif içerik taraması
  const actives: string[] = toStringArray(product.active_ingredients);
  scanList(actives, INGREDIENT_MAP, candidates);

  // 4. Genel içerik listesinden sınırlı tarama (sadece en güçlü 5 içerik)
  const allIngredients = toStringArray(product.ingredients).slice(0, 5);
  scanList(allIngredients, INGREDIENT_MAP, candidates);

  // 5. Ham rozet / features taraması — Supabase'den gelen teknik etiketler
  // KRİTİK: features bazen { alcohol: false, fragrance: true } gibi obje gelir;
  // ham spread ("...obj") "iterator method is not callable" hatasına yol açar.
  // toStringArray objedeki true değerli key'leri rozet sinyali olarak alır.
  const rawBadges: string[] = [
    ...toStringArray(product.features),
    ...toStringArray(product.badges),
  ];
  scanList(rawBadges, RAW_BADGE_MAP, candidates);
  // Ham rozetler aynı zamanda concern olarak da taranır
  scanList(rawBadges, CONCERN_MAP, candidates);

  // 6. Boolean formülasyon bayrakları (düşük öncelik, sadece yok ise)
  // Resolver: `contains_*` kolonları şemada yok → features/badges üzerinden türet.
  if (getFeatureFlag(product, "paraben") === false) {
    candidates.push({ label: "hassas cilt dostu", group: "sensitive", priority: 6 });
  }
  if (getFeatureFlag(product, "fragrance") === false) {
    candidates.push({ label: "hassas cilt dostu", group: "sensitive", priority: 7 });
  }
  if (getFeatureFlag(product, "alcohol") === false) {
    candidates.push({ label: "bariyer güçlendirici", group: "barrier", priority: 7 });
  }

  // 7. Cilt tipi sinyali (son çare)
  const skinTypes: string[] = [
    ...toStringArray(product.skin_types),
    ...(product.skin_type ? [product.skin_type] : []),
  ];
  for (const st of skinTypes) {
    const badge = SKIN_TYPE_BADGE[st.toLowerCase()];
    if (badge) candidates.push(badge);
  }

  // 8. Kategori ipucu — güneş ürünü
  const cat = normalize(product.category ?? "");
  if (includes(cat, "güneş") || includes(cat, "spf") || includes(cat, "sun")) {
    candidates.push({ label: "yüksek koruma", group: "sun", priority: 1 });
  }

  // ── Dedup + öncelik sıralaması ────────────────────────────────────────────
  // Aynı semantik gruptaki aday sayısı ne olursa olsun,
  // her gruptan sadece en yüksek öncelikli (en küçük priority) alınır.
  const bestByGroup = new Map<string, BadgeCandidate>();
  for (const c of candidates) {
    const existing = bestByGroup.get(c.group);
    if (!existing || c.priority < existing.priority) {
      bestByGroup.set(c.group, c);
    }
  }

  // Öncelik sırasına göre sırala, max 3 al
  const sorted = [...bestByGroup.values()].sort((a, b) => a.priority - b.priority);
  return sorted.slice(0, 3).map((c) => c.label);
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw badge çeviri yardımcısı — Supabase'den gelen İngilizce key → Türkçe label
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ham badge key'ini (ör. "fragrance_free", "non_comedogenic") Türkçe etikete çevirir.
 * Eşleşme bulunamazsa null döner.
 */
export function translateRawBadge(raw: string): string | null {
  if (!raw) return null;
  const match = matchTable(RAW_BADGE_MAP, raw)
               ?? matchTable(CONCERN_MAP, raw)
               ?? matchTable(INGREDIENT_MAP, raw);
  return match ? match.label : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Purpose tag — kategori → sabit Türkçe amaç etiketi
// ─────────────────────────────────────────────────────────────────────────────

const PURPOSE_MAP: Array<[string[], string]> = [
  [["sunscreen", "güneş", "spf", "uv"],          "güneş koruma"],
  [["moisturizer", "nemlendirici", "moistur"],   "nemlendirme"],
  [["cleanser", "temizleyici", "temizleme", "cleanser", "clean", "jel", "köpük"], "temizleme"],
  [["serum"],                                     "aktif bakım"],
  [["acne", "akne", "sivilce"],                  "akne bakımı"],
  [["toner"],                                     "toner"],
  [["eye", "göz"],                               "göz bakımı"],
  [["mask", "maske"],                            "maske"],
];

export function derivePurposeTag(category?: string | null): string | null {
  if (!category) return null;
  const cat = normalize(category);
  for (const [keys, label] of PURPOSE_MAP) {
    if (keys.some((k) => cat.includes(k))) return label;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ana kompozit fonksiyon — purpose + feature badges + failsafe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her kart için garantili rozet listesi döndürür:
 *  - İlk eleman: kategori purpose tag (varsa)
 *  - Sonrakiler: feature badge'lar (max 2 adet ek)
 *  - Hiçbiri yoksa: ["genel bakım"]
 *  - Toplam max 3 rozet
 */
export function deriveBadgesWithPurpose(
  product: ProductBadgeInput & { category?: string | null },
): string[] {
  const purpose = derivePurposeTag(product.category);
  const featureLabels = deriveFeatureBadges(product);

  // purpose tekrar feature listesinde çıkarsa kaldır
  const filtered = featureLabels.filter((l) => l !== purpose);

  const combined = purpose ? [purpose, ...filtered] : filtered;
  const sliced = combined.slice(0, 3);

  return sliced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card presentation helper — Türkçe-güvenli normalize + dedupe
//
// Amaç: Kart üzerinde gösterilen rozet listesinde aynı etiketin 2-3 kez
// görünmesini engellemek. Sadece SUNUM katmanında (smartBadges → BadgePills)
// uygulanır; hiçbir scoring/recommendation/data flow'una dokunmaz.
//
// Kurallar:
//  - trim
//  - Türkçe-güvenli lowercase (`toLocaleLowerCase("tr-TR")` — İ/I doğru)
//  - whitespace collapse (`\s+` → tek boşluk)
//  - normalize edilmiş key ile dedupe; ilk geçen orijinal label korunur
//  - boş / null / non-string elemanlar atılır
//  - max `limit` adet (varsayılan 3)
//  - Input array MUTATE EDİLMEZ (yeni dizi döner)
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeCardBadges(
  rawBadges: ReadonlyArray<unknown> | null | undefined,
  limit = 3,
): string[] {
  if (!Array.isArray(rawBadges) || rawBadges.length === 0) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawBadges) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= limit) break;
  }

  return out;
}
