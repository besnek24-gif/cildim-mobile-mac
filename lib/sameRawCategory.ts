/**
 * sameRawCategory.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD CATEGORY GUARD — additive, defensive layer.
 *
 * Why this exists:
 *   `pairKey()` collapses many raw categories into a small set of canonical
 *   labels (e.g. anything matching /krem|cream/ in the product NAME falls
 *   into "nemlendirici"). That works well for grouping but can bridge two
 *   products whose RAW `category` columns are different (e.g. a treatment
 *   "Sebium Kerato+ Krem" and a foundation "BB Krem"), which leaks
 *   cross-category items into similarity, comparison candidates and the
 *   Karar Rehberi pair builder.
 *
 *   This helper is the strict raw-category equality check that runs
 *   ALONGSIDE `pairKey` / `arePairsCompatible` — never instead of them.
 *   It is applied at every candidate-collection site, BEFORE pushing.
 *
 * Contract:
 *   - Returns true iff both products have a non-empty raw category and
 *     those categories are equal (case + whitespace insensitive).
 *   - Returns false when either side's category is empty — empty
 *     categories must NEVER bridge to anything else.
 *   - Reads `category` first, then legacy `kategori` field.
 *   - Pure; no side effects; no normalization beyond trim/lowercase.
 *
 * Scope:
 *   - Does NOT touch `pairKey` or `arePairsCompatible` internals.
 *   - Does NOT touch Supabase queries, UI, ranking, or product scores.
 */

type CategoryAble = {
  category?: string | null;
  kategori?: string | null;
  name?: string | null;
  isim?: string | null;
  id?: string | number | null;
};

function rawCategory(p: CategoryAble | null | undefined): string {
  if (!p) return "";
  const raw = (p.category ?? p.kategori ?? "") as string;
  return raw.trim().toLowerCase();
}

/**
 * Hard category guard: true iff both products share the same non-empty
 * raw category (case/whitespace insensitive).
 */
export function sameRawCategory(
  a: CategoryAble | null | undefined,
  b: CategoryAble | null | undefined,
): boolean {
  const ca = rawCategory(a);
  const cb = rawCategory(b);
  if (!ca || !cb) return false;
  return ca === cb;
}

/**
 * DEV-only diagnostic: log a candidate that the rest of the pipeline
 * would have accepted but the raw-category guard blocked. Helps surface
 * exactly which `pairKey` collisions are being prevented.
 *
 * In production builds (`__DEV__ === false`) this is a no-op.
 */
export function logCategoryGuardBlock(
  source: string,
  current: CategoryAble | null | undefined,
  candidate: CategoryAble | null | undefined,
): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log("[CATEGORY_GUARD]", source, "blocked:", {
    cur: current?.name ?? current?.isim,
    curCat: current?.category ?? current?.kategori,
    cand: candidate?.name ?? candidate?.isim,
    candCat: candidate?.category ?? candidate?.kategori,
  });
}
