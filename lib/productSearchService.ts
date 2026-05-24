/**
 * productSearchService
 * Supabase'de barkod ile ürün arar.
 */

import { supabase } from "./supabaseClient";
import type { Product } from "@/types/product";

export interface SearchResult {
  success: true;
  product: Product;
}

export interface SearchNotFound {
  success: false;
  reason: "not_found";
  barcode: string;
}

export interface SearchError {
  success: false;
  reason: "error";
  message: string;
}

export type ProductSearchResult = SearchResult | SearchNotFound | SearchError;

/**
 * Barkod ile ürün ara.
 */
export async function searchProductByBarcode(barcode: string): Promise<ProductSearchResult> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", barcode)
      .maybeSingle();

    if (error) {
      return { success: false, reason: "error", message: error.message };
    }

    if (!data) {
      return { success: false, reason: "not_found", barcode };
    }

    return { success: true, product: data as Product };
  } catch (err: any) {
    return { success: false, reason: "error", message: err?.message ?? "Bilinmeyen hata" };
  }
}
