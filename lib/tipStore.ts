/**
 * Lightweight in-memory store for passing tip payload during navigation.
 * Follows the same pattern as productStore.ts.
 * Home screen sets the payload; detail screen consumes it without re-computing.
 */

import type { DailyTip } from "@/lib/dailyTips";
import type { Product } from "@/types/product";

export type TipPayload = {
  tip: DailyTip;
  relatedProducts: Product[];
};

let _tipPayload: TipPayload | null = null;

export function setTipPayload(payload: TipPayload): void {
  _tipPayload = payload;
}

export function getTipPayload(): TipPayload | null {
  return _tipPayload;
}
