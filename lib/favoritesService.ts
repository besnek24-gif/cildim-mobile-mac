/**
 * favoritesService.ts — Supabase tabanlı favoriler CRUD
 *
 * favorites tablosu beklenen şema:
 *   user_id     text  (Supabase auth UID)
 *   product_id  text  (products.id)
 *   created_at  timestamptz (opsiyonel)
 */

import { supabase } from "@/lib/supabaseClient";
import { resolveThumbnailUrl, resolveScore } from "@/types/product";

/* ─── Toggle ─────────────────────────────────────────────────────────────── */

/**
 * Favoriye ekler veya çıkarır.
 * @returns `true` → eklendi, `false` → çıkarıldı
 */
export async function toggleFavoriteSupabase(
  userId: string,
  productId: string,
): Promise<boolean> {
  const { data: existing, error: selectErr } = await supabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (selectErr) {
    console.error("[favorites] select error:", selectErr.message);
    throw selectErr;
  }

  if (existing) {
    const { error: delErr } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (delErr) {
      console.error("[favorites] delete error:", delErr.message);
      throw delErr;
    }
    return false;
  } else {
    const { error: insErr } = await supabase
      .from("favorites")
      .insert([{ user_id: userId, product_id: productId }]);

    if (insErr) {
      console.error("[favorites] insert error:", insErr.message);
      throw insErr;
    }
    return true;
  }
}

/* ─── Fetch IDs ──────────────────────────────────────────────────────────── */

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", userId);

  if (error) {
    // Recoverable: network blip / RLS / transient Supabase 5xx. UI already
    // tolerates [] (renders empty favorites). Demoted from error → warn so
    // mobile DEV LogBox does NOT show a red overlay on transient failures.
    if (__DEV__) {
      console.warn("[favorites] getFavoriteIds (recoverable):", error.message);
    }
    return [];
  }

  return data?.map((f: { product_id: string }) => f.product_id) ?? [];
}

/* ─── Fetch full rows with product details ───────────────────────────────── */

export interface FavoriteRow {
  productId: string;
  createdAt: string;
  name?: string;
  brand?: string;
  /** thumbnail_url ?? image_url — ready-to-use image URI */
  imageUrl?: string;
  /** Dermatology score 0–100 */
  score?: number;
  category?: string;
  segment?: string;
  /** Raw product object from Supabase — for any extra fields needed by callers */
  rawProduct?: Record<string, unknown>;
}

// ECZ4 NAV STEP D — FIX 1: Favoriler için lightweight field seti.
// Önceden `select("*")` kullanılıyordu → ingredients (~50-200KB/satır) +
// full_description + diğer ağır alanlar her warm focus'ta wire'dan geliyordu.
// Yalnızca favoriler kart render'ı (id, name, brand, image, score, badge)
// + Favorite navigation payload (image_url) için gereken alanlar.
// NOT: `scores` ve `sistem_toplam_puani` Supabase products tablosunda YOK
// (runtime hatası: "column does not exist") → favoriler skoru için
// dermo_score → rating fallback'ine güveniliyor (resolveScore optional-safe).
// Geri alma: bu listeyi `*` ile değiştir.
const FAVORITES_PRODUCT_FIELDS =
  "id,name,brand,category,segment,rating,image_url,thumbnail_url,storage_image_url,dermo_score,dermo_label";

export async function getFavoriteRows(userId: string): Promise<FavoriteRow[]> {
  // 1. Favori satırlarını çek
  const { data: favRows, error: favErr } = await supabase
    .from("favorites")
    .select("product_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (favErr) {
    console.error("[favorites] getFavoriteRows error:", favErr.message);
    return [];
  }

  const productIds = (favRows ?? []).map((f: { product_id: string }) => f.product_id);
  if (productIds.length === 0) return [];

  // 2. Ürün detaylarını çek — explicit lightweight fields (ECZ4 STEP D).
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(FAVORITES_PRODUCT_FIELDS)
    .in("id", productIds);

  if (prodErr) {
    console.error("[favorites] products fetch error:", prodErr.message);
  }

  // id → product satırı haritası
  const productMap = new Map<string, Record<string, any>>(
    (products ?? []).map((p: any) => [String(p.id), p]),
  );

  return ((favRows ?? []).map((fav: { product_id: string; created_at: string }) => {
    const p: Record<string, any> | undefined = productMap.get(String(fav.product_id));

    if (!p) return null as any;

    // resolveThumbnailUrl: thumbnail_url → image_url → gorsel_url → gorsel → brand avatar
    const imageUrl = p ? (resolveThumbnailUrl(p) ?? undefined) : undefined;

    // resolveScore: dermo_score → scores.system_total_score → sistem_toplam_puani → rating
    const score = p ? (resolveScore(p) ?? undefined) : undefined;

    return {
      productId:  fav.product_id,
      createdAt:  fav.created_at ?? new Date().toISOString(),
      name:       (p?.name ?? p?.isim) ?? undefined,
      brand:      (p?.brand ?? p?.marka) ?? undefined,
      imageUrl,
      score,
      category:   p?.category ?? p?.kategori ?? undefined,
      segment:    p?.segment ?? undefined,
      rawProduct: p ?? undefined,
    };
  }).filter(Boolean)) as FavoriteRow[];
}

/* ─── Delete by productId ────────────────────────────────────────────────── */

export async function deleteFavorite(userId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) {
    console.error("[favorites] deleteFavorite error:", error.message);
    throw error;
  }
}
