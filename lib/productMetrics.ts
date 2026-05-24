/**
 * productMetrics.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ürün başına etkileşim sinyali takibi — Supabase product_metrics tablosu.
 *
 * Tüm fonksiyonlar fire-and-forget'tir: await etmek zorunda değilsiniz,
 * hata sessizce yutulur — UI akışını hiçbir zaman bozmaz.
 *
 * Interest score ağırlıkları (deterministik, değişmez):
 *   view_count          × 0.5   — pasif gezinme
 *   compare_count       × 1.0   — karşılaştırma isteği
 *   compare_win_count   × 3.0   — açık tercih sinyali (en güçlü)
 *   similar_click_count × 1.5   — keşif + merak
 *
 * Hesaplama veritabanında atomik olarak yapılır (increment_product_metric RPC).
 *
 * Önkoşul: migrate-product-metrics.sql Supabase'de çalıştırılmış olmalı.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "./supabaseClient";

type MetricField = "view" | "compare" | "compare_win" | "similar_click";

/**
 * Verilen ürün için belirtilen sayacı 1 artırır ve interest_score'u yeniden hesaplar.
 * Satır yoksa otomatik oluşturulur (upsert).
 */
async function increment(productId: string, field: MetricField): Promise<void> {
  const { error } = await supabase.rpc("increment_product_metric", {
    p_id:    productId,
    p_field: field,
  });

  if (error && __DEV__) {
    console.warn(`[productMetrics] increment(${field}, ${productId}) failed:`, error.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Kullanıcı ürün detay sayfasını açtığında çağrılır.
 * view_count += 1 → interest_score güncellenir.
 */
export function trackProductView(productId: string): void {
  increment(productId, "view").catch(() => {});
}

/**
 * Kullanıcı karşılaştırma sayfasını açtığında çağrılır.
 * Her iki ürün için de compare_count += 1.
 */
export function trackCompareOpen(productIds: string[]): void {
  for (const id of productIds) {
    increment(id, "compare").catch(() => {});
  }
}

/**
 * Kullanıcı karşılaştırmada bir ürünü seçip detayına geçtiğinde çağrılır.
 * compare_win_count += 1 — en güçlü açık tercih sinyali (ağırlık: 3.0).
 */
export function trackCompareWinner(productId: string): void {
  increment(productId, "compare_win").catch(() => {});
}

/**
 * Kullanıcı benzer ürünler listesinden bir ürüne tıkladığında çağrılır.
 * similar_click_count += 1 → interest_score güncellenir.
 */
export function trackSimilarClick(productId: string): void {
  increment(productId, "similar_click").catch(() => {});
}

// ── Okuma yardımcıları (gelecekte trend/ranking için) ─────────────────────────

export interface ProductMetrics {
  product_id:          string;
  view_count:          number;
  compare_count:       number;
  compare_win_count:   number;
  similar_click_count: number;
  interest_score:      number;
  last_interaction_at: string | null;
}

/**
 * Tek bir ürünün metriklerini getirir.
 * Henüz kaydı yoksa sıfır değerlerle dolu bir nesne döner.
 */
export async function getProductMetrics(productId: string): Promise<ProductMetrics> {
  const { data } = await supabase
    .from("product_metrics")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  return data ?? {
    product_id:          productId,
    view_count:          0,
    compare_count:       0,
    compare_win_count:   0,
    similar_click_count: 0,
    interest_score:      0,
    last_interaction_at: null,
  };
}

/**
 * En yüksek interest_score'a sahip N ürünü getirir.
 * İleride "Trend Ürünler" veya "En Çok Karşılaştırılan" bölümleri için kullanılabilir.
 */
export async function getTopProducts(
  limit  = 10,
  sortBy: "interest_score" | "view_count" | "compare_win_count" | "compare_count" = "interest_score",
): Promise<ProductMetrics[]> {
  const { data } = await supabase
    .from("product_metrics")
    .select("*")
    .order(sortBy, { ascending: false })
    .limit(limit);

  return data ?? [];
}
