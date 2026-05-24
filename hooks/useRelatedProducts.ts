/**
 * useRelatedProducts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Slim "related slice" loader for the product detail bottom sections.
 *
 * Why this exists:
 *   The detail screen used to consume the full Home catalog (~1250 rows × all
 *   columns) only to feed findSimilarProducts() and getRecommendedProducts().
 *   That select("*") + per-row normalization on the JS thread caused a 3-4s
 *   freeze on detail open. The full-catalog fetch was killed; this hook
 *   replaces it with a tiny, targeted query.
 *
 * What it does:
 *   - Fetches at most `limit` (default 40) other products in the SAME category
 *     as the current product, ordered by dermo_score desc.
 *   - Selects ONLY card-relevant columns. Never selects `ingredients` or any
 *     other heavy column — protects Home query parity (HOME_FIELDS) and keeps
 *     payload small.
 *   - Defers the network call until after the screen-open animation has
 *     finished via InteractionManager.runAfterInteractions, so the freeze is
 *     gone and the sections fade in below the fold a moment later.
 *
 * Safety:
 *   - If `currentId` or `category` is missing → no fetch, returns [].
 *   - If the request errors → console.warn + returns []. Never throws.
 *   - Cancels in-flight work on unmount or when the inputs change.
 *
 * Scope guards:
 *   - Does NOT touch useSupabaseProducts / HOME_FIELDS / Home query.
 *   - Does NOT select ingredients.
 *   - Does NOT call adaptLegacyProduct — engines accept the raw row shape and
 *     normalize internally via normalizeProductData().
 */

import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { supabase } from "@/lib/supabaseClient";
import type { Product } from "@/types/product";

// Card-relevant columns only. Mirrors the audit's allow-list.
// ⚠ Do NOT add `ingredients`, `full_description`, `benefits`, etc.
const RELATED_FIELDS =
  "id, name, brand, category, subcategory, segment, image_url, thumbnail_url, short_benefit, dermo_score, dermo_label";

export interface UseRelatedProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
}

export function useRelatedProducts(
  currentId: string | null,
  category: string | null,
  subcategory?: string | null,
  limit: number = 40,
): UseRelatedProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Safety: missing inputs → no fetch, empty result.
    if (!currentId || !category) {
      setProducts([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const handle = InteractionManager.runAfterInteractions(async () => {
      try {
        let query = supabase
          .from("products")
          .select(RELATED_FIELDS)
          .neq("id", currentId)
          .eq("category", category)
          .order("dermo_score", { ascending: false, nullsFirst: false })
          .limit(limit);

        // Subcategory is a soft preference, not a hard filter — we still want
        // results when the current product's subcategory has too few siblings.
        // So we don't add a subcategory filter; the engine ranks subcategory
        // matches higher itself via similarity scoring.
        if (subcategory) {
          // intentionally unused — kept in signature for future tuning
        }

        const { data, error: qErr } = await query;
        if (cancelled) return;

        if (qErr) {
          console.warn("[useRelatedProducts] query-error:", qErr.message);
          setProducts([]);
          setError(qErr.message);
          setLoading(false);
          return;
        }

        setProducts((data as Product[]) ?? []);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message ?? "unknown";
        console.warn("[useRelatedProducts] threw:", msg);
        setProducts([]);
        setError(msg);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      handle.cancel?.();
    };
  }, [currentId, category, subcategory, limit]);

  return { products, loading, error };
}
