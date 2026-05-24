/**
 * Lightweight in-memory store for passing objects during navigation.
 * Avoids URL serialization issues with JSON params in Expo Router.
 */

import type { Product } from "@/types/product";
import type { DermoScoreResult } from "@/lib/dermoScore";

let _pending: Product | null = null;
let _pendingDermoResult: DermoScoreResult | null = null;
let _pendingProductName: string | null = null;

export function setNavigationProduct(product: Product | null) {
  _pending = product;
}

export function consumeNavigationProduct(): Product | null {
  const p = _pending;
  _pending = null;
  return p;
}

export function setNavigationDermoResult(result: DermoScoreResult | null, productName?: string) {
  _pendingDermoResult = result;
  _pendingProductName = productName ?? null;
}

export function consumeNavigationDermoResult(): { result: DermoScoreResult | null; productName: string | null } {
  const result = _pendingDermoResult;
  const productName = _pendingProductName;
  _pendingDermoResult = null;
  _pendingProductName = null;
  return { result, productName };
}
