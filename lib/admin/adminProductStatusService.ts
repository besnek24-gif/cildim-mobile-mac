/**
 * adminProductStatusService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolated admin-only service for reading and writing product moderation status.
 *
 * Uses the product_status table — completely separate from the products table.
 * Public app is NOT affected: products without a record are treated as "approved".
 *
 * Table schema (run in Supabase SQL editor):
 *   CREATE TABLE product_status (
 *     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 *     status      text NOT NULL CHECK (status IN ('approved','pending','rejected')),
 *     updated_by  text,
 *     updated_at  timestamptz NOT NULL DEFAULT now(),
 *     CONSTRAINT product_status_product_id_unique UNIQUE (product_id)
 *   );
 */

import { supabase } from "@/lib/supabaseClient";

export type ProductStatus = "approved" | "pending" | "rejected";

export interface ProductStatusRecord {
  product_id: string;
  status:     ProductStatus;
  updated_by?: string | null;
  updated_at:  string;
}

/**
 * Fetch moderation status for a single product.
 * Returns null if no record exists (treated as "approved" by convention).
 */
export async function getStatus(productId: string): Promise<ProductStatus | null> {
  try {
    const { data, error } = await supabase
      .from("product_status")
      .select("status")
      .eq("product_id", productId)
      .maybeSingle();

    if (error) return null;
    return (data?.status as ProductStatus) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch all product statuses in one query (for list view).
 * Returns a map: productId → status.
 */
export async function getAllStatuses(): Promise<Map<string, ProductStatus>> {
  const map = new Map<string, ProductStatus>();
  try {
    const { data } = await supabase
      .from("product_status")
      .select("product_id, status");

    for (const row of data ?? []) {
      map.set(row.product_id, row.status as ProductStatus);
    }
  } catch { /* graceful — table may not exist yet */ }
  return map;
}

/**
 * Upsert moderation status for a product.
 * Never touches the products table.
 */
export async function setStatus(
  productId: string,
  status: ProductStatus,
  updatedBy?: string | null,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("product_status")
      .upsert(
        {
          product_id: productId,
          status,
          updated_by: updatedBy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id" },
      );
    return { error: error?.message ?? null };
  } catch (e: any) {
    return { error: e?.message ?? "Bilinmeyen hata" };
  }
}
