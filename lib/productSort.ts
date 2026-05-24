/**
 * productSort.ts — Sort helper for product list screens.
 *
 * Additive, side-effect free helper. Used by user-facing sort chips on
 * product list screens (E2: Gündemdekiler first). Designed to coexist with
 * `applyPersonalizedRanking` — caller decides whether to apply personalized
 * ranking or this explicit user sort.
 *
 * Rules (E2 spec):
 *  - Never mutate input array (always works on a copy)
 *  - Missing values (no score / unparseable created_at) go to the END
 *    in ALL modes (regardless of asc/desc direction)
 *  - Stable deterministic tie-breakers:
 *      score modes: score → created_at DESC → id ASC
 *      date  modes: date  → id (direction matches sort: newest→DESC, oldest→ASC)
 *  - Score source: `getFinalProductScore` ONLY (single source of truth, D1)
 *  - `personalized` mode is a no-op: returns a copy without sorting; caller
 *    is responsible for calling `applyPersonalizedRanking` in that case.
 */

import { getFinalProductScore } from "./getFinalScore";

export type ProductSortMode =
  | "personalized"
  | "newest"
  | "oldest"
  | "score_desc"
  | "score_asc";

function getCreatedAtMs(p: unknown): number | null {
  // BUGFIX — Date sort direction
  // ROOT CAUSE: adaptLegacyProduct (src/search/productAdapter.ts L317) yalnizca
  // `createdAt` (camelCase) yaziyor; spread cikti `created_at` (snake_case)
  // alanini birakmiyor. Onceden bu resolver yalnizca snake_case okuyordu
  // → her urunde null donuyordu → newest/oldest ikisinde de "missing → end"
  // koluna dusuyordu → id ASC ile sirali ayni cikti veriyordu.
  // FIX: resolveThumbnailUrl gibi her iki naming convention'i da destekle.
  // Sema dokunulmadi, adapter dokunulmadi, sadece resolver permissive.
  const o = p as any;
  const raw = o?.created_at ?? o?.createdAt;
  if (raw == null || raw === "") return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function getSortScore(p: unknown): number | null {
  const s = getFinalProductScore(p as any);
  return typeof s === "number" && Number.isFinite(s) ? s : null;
}

function compareById(a: unknown, b: unknown): number {
  const ai = String((a as any)?.id ?? "");
  const bi = String((b as any)?.id ?? "");
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}

// DEV-only: log first-5 ids for newest/oldest ONCE per mode per session.
// Verifies the comparator actually reverses (Phase F BUGFIX). Module-scope
// flag prevents log spam on re-renders. Stripped from production by __DEV__.
const _devLoggedModes = new Set<string>();
function _devLogFirstFive(mode: string, list: ReadonlyArray<unknown>): void {
  if (_devLoggedModes.has(mode)) return;
  _devLoggedModes.add(mode);
  const head = list.slice(0, 5).map((p) => {
    const o = p as any;
    const ts = o?.created_at ?? o?.createdAt ?? "—";
    return `${String(o?.id ?? "?").slice(0, 8)}@${String(ts).slice(0, 19)}`;
  });
  // eslint-disable-next-line no-console
  console.log(`[productSort] mode=${mode} first5=`, head);
}

/**
 * Date tie-breaker — used inside score-mode tie resolution.
 * Returns negative if `a` is newer (should come first when sorting newest-first
 * after equal scores). Missing dates → end of list.
 */
function compareCreatedAtDesc(a: unknown, b: unknown): number {
  const ad = getCreatedAtMs(a);
  const bd = getCreatedAtMs(b);
  if (ad === null && bd === null) return 0;
  if (ad === null) return 1;
  if (bd === null) return -1;
  return bd - ad; // newer first
}

export function applyProductSort<T extends { id: string }>(
  products: ReadonlyArray<T>,
  mode: ProductSortMode,
): T[] {
  // Always copy — never mutate caller's array.
  const copy = products.slice();

  if (mode === "personalized") {
    return copy;
  }

  if (mode === "newest" || mode === "oldest") {
    const dir = mode === "newest" ? -1 : 1;
    // Tie-breaker direction (spec):
    //   newest: created_at DESC, then id DESC
    //   oldest: created_at ASC,  then id ASC
    // Many Supabase rows share batch-INSERT timestamps (e.g. 1254 products
    // are clustered into a few hundred distinct created_at values; some
    // timestamps repeat 4+ times). Without a direction-matched id tie-breaker,
    // both orders look IDENTICAL within each timestamp cluster, masking the
    // sort flip even when timestamps themselves differ across clusters.
    const sorted = copy.sort((a, b) => {
      const ad = getCreatedAtMs(a);
      const bd = getCreatedAtMs(b);
      // Missing → end (both directions)
      if (ad === null && bd === null) return compareById(a, b);
      if (ad === null) return 1;
      if (bd === null) return -1;
      if (ad !== bd) return (ad - bd) * dir;
      // Equal valid dates → id direction matches sort direction
      return compareById(a, b) * dir;
    });
    if (__DEV__) _devLogFirstFive(mode, sorted);
    return sorted;
  }

  // score_desc / score_asc
  const dir = mode === "score_desc" ? -1 : 1;
  return copy.sort((a, b) => {
    const as = getSortScore(a);
    const bs = getSortScore(b);
    // Missing scores → end (both directions)
    if (as === null && bs === null) {
      const dt = compareCreatedAtDesc(a, b);
      return dt !== 0 ? dt : compareById(a, b);
    }
    if (as === null) return 1;
    if (bs === null) return -1;
    if (as !== bs) return (as - bs) * dir;
    // Tie-breaker: created_at DESC → id ASC
    const dt = compareCreatedAtDesc(a, b);
    return dt !== 0 ? dt : compareById(a, b);
  });
}
