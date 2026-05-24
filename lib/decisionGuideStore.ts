/**
 * decisionGuideStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Karar Rehberleri veri deposu.
 *
 * Sorumluluklar:
 *  · Rehberleri AsyncStorage'da sakla (tenvir_decision_guides)
 *  · Ücretsiz kullanıcılar için eşsiz rehber açma sayısını izle
 *  · Premium kapı yönetimi: max 5 ücretsiz, Seçkin üyeler sınırsız
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Sabitler ───────────────────────────────────────────────────────────────

const GUIDES_KEY    = "tenvir_decision_guides";
const VIEWS_KEY     = "tenvir_guide_view_ids";   // Açılan eşsiz rehber ID'leri
const FREE_LIMIT    = 5;

// ─── Tipler ─────────────────────────────────────────────────────────────────

export type VisibilityStatus = "published" | "hidden" | "pending";
export type SourceType       = "auto-generated" | "user-driven" | "editorial";

export interface DecisionGuide {
  id:                        string;
  title:                     string;
  slug:                      string;
  category:                  string;
  subcategory:               string;
  concern_tags:              string[];
  product_1_id:              string;
  product_2_id:              string;
  product_1_name:            string;
  product_2_name:            string;
  product_1_brand:           string;
  product_2_brand:           string;
  short_summary:             string;
  difference_points:         string[];
  best_for_product_1:        string;
  best_for_product_2:        string;
  confidence_score:          number;  // 0-100
  comparison_quality_score:  number;  // pairingScore bazlı
  is_featured:               boolean;
  visibility_status:         VisibilityStatus;
  source_type:               SourceType;
  created_from_pair_key:     string;  // tekrar tespiti için
  created_at:                string;
  updated_at:                string;
  total_views:               number;
  free_views:                number;
  premium_views:             number;
  unlock_clicks:             number;
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

function makeId(): string {
  return `guide_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Okuma / Yazma ──────────────────────────────────────────────────────────

export async function loadGuides(): Promise<DecisionGuide[]> {
  try {
    const raw = await AsyncStorage.getItem(GUIDES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DecisionGuide[];
  } catch {
    return [];
  }
}

export async function saveGuides(guides: DecisionGuide[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GUIDES_KEY, JSON.stringify(guides));
  } catch {}
}

/**
 * Yeni bir rehberi depoya ekle (varsa güncelleme yapmaz).
 * Duplicate pair_key varsa ekleme.
 */
export async function upsertGuide(guide: DecisionGuide): Promise<void> {
  const existing = await loadGuides();
  const idx = existing.findIndex((g) => g.created_from_pair_key === guide.created_from_pair_key);
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...guide, updated_at: new Date().toISOString() };
  } else {
    existing.push(guide);
  }
  await saveGuides(existing);
}

export async function hideGuide(id: string): Promise<void> {
  const guides = await loadGuides();
  const idx = guides.findIndex((g) => g.id === id);
  if (idx >= 0) {
    guides[idx].visibility_status = "hidden";
    guides[idx].updated_at = new Date().toISOString();
    await saveGuides(guides);
  }
}

// ─── Görüntüleme takibi ─────────────────────────────────────────────────────

async function loadViewedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(VIEWS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveViewedIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(VIEWS_KEY, JSON.stringify([...ids]));
  } catch {}
}

/**
 * Bir rehber açılışını kaydet.
 * @returns Yeni toplam eşsiz görüntüleme sayısı
 */
export async function trackGuideOpen(
  guideId: string,
  isPremium: boolean,
): Promise<number> {
  const ids = await loadViewedIds();
  if (!ids.has(guideId)) {
    ids.add(guideId);
    await saveViewedIds(ids);

    // Görünüm istatistiklerini rehberde güncelle
    const guides = await loadGuides();
    const idx = guides.findIndex((g) => g.id === guideId);
    if (idx >= 0) {
      guides[idx].total_views++;
      if (isPremium) guides[idx].premium_views++;
      else guides[idx].free_views++;
      await saveGuides(guides);
    }
  }
  return ids.size;
}

/**
 * Eşsiz açılan rehber sayısını döner.
 */
export async function getGuideViewCount(): Promise<number> {
  const ids = await loadViewedIds();
  return ids.size;
}

/**
 * Kullanıcı yeni bir rehberi açabilir mi?
 * · isPremium = true → her zaman true
 * · free kullanıcı → viewCount < FREE_LIMIT
 */
export async function canOpenGuide(
  guideId: string,
  isPremium: boolean,
): Promise<boolean> {
  if (isPremium) return true;
  const ids = await loadViewedIds();
  if (ids.has(guideId)) return true; // zaten açılmış → tekrar sayma
  return ids.size < FREE_LIMIT;
}

export function getFreeLimit(): number {
  return FREE_LIMIT;
}

// ─── Rehber fabrikası (decisionGuideEngine'den kullanılır) ──────────────────

export function buildGuide(params: {
  pairKey:              string;
  category:             string;
  subcategory:          string;
  concern_tags:         string[];
  product_1_id:         string;
  product_2_id:         string;
  product_1_name:       string;
  product_2_name:       string;
  product_1_brand:      string;
  product_2_brand:      string;
  title:                string;
  short_summary:        string;
  difference_points:    string[];
  best_for_product_1:   string;
  best_for_product_2:   string;
  confidence_score:     number;
  quality_score:        number;
  is_featured?:         boolean;
}): DecisionGuide {
  const now = new Date().toISOString();
  return {
    id:                       makeId(),
    title:                    params.title,
    slug:                     makeSlug(params.title),
    category:                 params.category,
    subcategory:              params.subcategory,
    concern_tags:             params.concern_tags,
    product_1_id:             params.product_1_id,
    product_2_id:             params.product_2_id,
    product_1_name:           params.product_1_name,
    product_2_name:           params.product_2_name,
    product_1_brand:          params.product_1_brand,
    product_2_brand:          params.product_2_brand,
    short_summary:            params.short_summary,
    difference_points:        params.difference_points,
    best_for_product_1:       params.best_for_product_1,
    best_for_product_2:       params.best_for_product_2,
    confidence_score:         params.confidence_score,
    comparison_quality_score: params.quality_score,
    is_featured:              params.is_featured ?? false,
    visibility_status:        "published",
    source_type:              "auto-generated",
    created_from_pair_key:    params.pairKey,
    created_at:               now,
    updated_at:               now,
    total_views:              0,
    free_views:               0,
    premium_views:            0,
    unlock_clicks:            0,
  };
}
