/**
 * adminBatchResolverService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only batch writer: converts reviewed resolution candidates into
 * Supabase ingredient library rows.
 *
 * WHAT IT DOES:
 *   - Writes reviewed candidates into ingredients_master + ingredient_aliases
 *   - Fully idempotent — safe to re-run with the same input
 *   - Returns a detailed summary of what was inserted vs skipped
 *
 * WHAT IT DOES NOT DO:
 *   - Does NOT touch score engine (V4 or any other)
 *   - Does NOT modify resolver behaviour
 *   - Does NOT remove local registry fallback
 *   - Does NOT auto-run or auto-trigger
 *   - Does NOT update ingredient_unknown_queue.resolution_status
 *     (that step is intentionally deferred for a separate utility)
 *
 * IDEMPOTENCY GUARANTEES:
 *   - ingredients_master: checked by canonical_name (UNIQUE constraint)
 *   - ingredient_aliases: checked by normalized_alias (UNIQUE constraint)
 *   - Re-running with the same candidates → same result, no duplicates
 *
 * USAGE (admin panel or script only):
 *   import { applyUnknownResolutionCandidates } from
 *     "@/lib/admin/adminBatchResolverService";
 *
 *   const result = await applyUnknownResolutionCandidates([
 *     {
 *       suggested_canonical_name: "panthenol",
 *       aliases: ["d-panthenol", "dl-panthenol"],
 *       risk_level: "low",
 *       function_tags: ["humectant", "soothing"],
 *       pregnancy_flag: "safe",
 *     }
 *   ]);
 *   // { inserted_master_count: 1, reused_master_count: 0,
 *   //   inserted_alias_count: 3, skipped_alias_count: 0, errors: [] }
 */

import { supabase }                    from "@/lib/supabaseClient";
import { normalizeForSupabaseLookup }  from "@/lib/ingredientEngineV4/resolver";

// ── Input types ───────────────────────────────────────────────────────────────

export type BatchRiskLevel     = "low" | "medium" | "high" | "unknown";
export type BatchPregnancyFlag = "safe" | "caution" | "avoid" | "unknown";
export type BatchAllergyFlag   = "low" | "moderate" | "high" | "unknown";

export interface BatchResolutionCandidate {
  /** INCI canonical name (will be normalised before insert) */
  suggested_canonical_name: string;
  /** Human-friendly display name — defaults to suggested_canonical_name */
  display_name?:            string;
  /** All alias strings that should resolve to this canonical */
  aliases:                  string[];
  /** Broad risk tier (optional — stored as text in ingredients_master) */
  risk_level?:              BatchRiskLevel;
  /** Concern flag tags, e.g. ["fragrance", "paraben"] */
  concern_flags?:           string[];
  /** Functional category tags, e.g. ["humectant", "soothing"] */
  function_tags?:           string[];
  /** Pregnancy safety rating */
  pregnancy_flag?:          BatchPregnancyFlag;
  /** Breastfeeding safety rating */
  breastfeeding_flag?:      BatchPregnancyFlag;
  /** Allergy risk rating */
  allergy_flag?:            BatchAllergyFlag;
  /** Free-text description (optional) */
  description?:             string;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface BatchResolverError {
  candidate_canonical: string;
  alias?:              string;
  message:             string;
}

export interface BatchResolverResult {
  /** New rows inserted into ingredients_master */
  inserted_master_count: number;
  /** Existing rows reused from ingredients_master (no insert needed) */
  reused_master_count:   number;
  /** New rows inserted into ingredient_aliases */
  inserted_alias_count:  number;
  /** Aliases skipped because normalized_alias already existed */
  skipped_alias_count:   number;
  /** Per-error details (write failures, not skips) */
  errors:                BatchResolverError[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns canonical_name normalised for consistent storage and lookup. */
function normalizeCanonical(raw: string): string {
  return normalizeForSupabaseLookup(raw);
}

/**
 * Looks up an existing ingredient in ingredients_master by canonical_name.
 * Returns the UUID string if found, null otherwise.
 */
async function findExistingMasterRow(normalizedCanonical: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("ingredients_master")
    .select("id")
    .eq("canonical_name", normalizedCanonical)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].id as string;
}

/**
 * Inserts one row into ingredients_master.
 * Returns the new UUID, or null on error.
 */
async function insertMasterRow(
  candidate: BatchResolutionCandidate,
  normalizedCanonical: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ingredients_master")
    .insert({
      canonical_name:     normalizedCanonical,
      display_name:       candidate.display_name ?? candidate.suggested_canonical_name,
      description:        candidate.description  ?? null,
      risk_level:         candidate.risk_level   ?? null,
      concern_flags:      candidate.concern_flags     ?? [],
      function_tags:      candidate.function_tags     ?? [],
      pregnancy_flag:     candidate.pregnancy_flag    ?? null,
      breastfeeding_flag: candidate.breastfeeding_flag ?? null,
      allergy_flag:       candidate.allergy_flag      ?? null,
      is_active:          true,
      metadata:           {},
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}

/**
 * Checks if a normalized_alias already exists in ingredient_aliases.
 * Returns true if it does (skip the insert).
 */
async function aliasExists(normalizedAlias: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("ingredient_aliases")
    .select("id")
    .eq("normalized_alias", normalizedAlias)
    .limit(1);

  return !error && !!data && data.length > 0;
}

/**
 * Inserts one row into ingredient_aliases.
 * Returns true on success, false on error.
 *
 * alias_type must be one of the values allowed by the DB CHECK constraint:
 *   "exact" | "synonym" | "language" | "trade_name" | "misspelling" | "parser_rule"
 */
async function insertAliasRow(
  ingredientId:     string,
  rawAlias:         string,
  normalizedAlias:  string,
  priority:         number,
  aliasType:        "exact" | "synonym" | "language" | "trade_name" | "misspelling" | "parser_rule" = "synonym"
): Promise<boolean> {
  const { error } = await supabase
    .from("ingredient_aliases")
    .insert({
      ingredient_id:    ingredientId,
      alias_name:       rawAlias,
      normalized_alias: normalizedAlias,
      alias_type:       aliasType,
      language_code:    "en",
      priority,
      is_active:        true,
    });

  return !error;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * applyUnknownResolutionCandidates
 *
 * Batch-writes reviewed candidates into the Supabase ingredient library.
 *
 * For each candidate:
 *   1. Normalises the canonical name
 *   2. Checks if it already exists in ingredients_master
 *      → INSERT if new, reuse id if existing (no overwrite)
 *   3. Builds the full alias set = [canonical_name] + aliases[]
 *   4. For each alias:
 *      → Checks normalized_alias uniqueness
 *      → Skips if already registered, inserts if new
 *
 * Idempotent: re-running with the same input is always safe.
 *
 * @param candidates  Reviewed resolution candidates (from getUnknownResolutionCandidates)
 */
export async function applyUnknownResolutionCandidates(
  candidates: BatchResolutionCandidate[]
): Promise<BatchResolverResult> {

  const result: BatchResolverResult = {
    inserted_master_count: 0,
    reused_master_count:   0,
    inserted_alias_count:  0,
    skipped_alias_count:   0,
    errors:                [],
  };

  for (const candidate of candidates) {
    const normalizedCanonical = normalizeCanonical(candidate.suggested_canonical_name);

    if (!normalizedCanonical) {
      result.errors.push({
        candidate_canonical: candidate.suggested_canonical_name,
        message: "Empty canonical name after normalization — skipped",
      });
      continue;
    }

    // ── Step 1: Resolve ingredients_master row ─────────────────────────────────
    let ingredientId: string | null = await findExistingMasterRow(normalizedCanonical);
    let isNewMaster = false;

    if (ingredientId) {
      result.reused_master_count++;
    } else {
      ingredientId = await insertMasterRow(candidate, normalizedCanonical);
      if (ingredientId) {
        result.inserted_master_count++;
        isNewMaster = true;
      } else {
        result.errors.push({
          candidate_canonical: candidate.suggested_canonical_name,
          message: `Failed to insert into ingredients_master for canonical "${normalizedCanonical}"`,
        });
        continue; // Cannot proceed without a valid ingredient_id
      }
    }

    // ── Step 2: Build full alias set ───────────────────────────────────────────
    // Always include the canonical itself as alias (priority 1 = highest)
    // Then all provided aliases (priority 10)
    const aliasEntries: Array<{ raw: string; normalized: string; priority: number; type: "exact" | "synonym" }> = [
      {
        raw:        candidate.suggested_canonical_name,
        normalized: normalizedCanonical,
        priority:   1,
        type:       "exact",
      },
    ];

    for (const rawAlias of candidate.aliases) {
      const normalizedAlias = normalizeForSupabaseLookup(rawAlias);
      if (!normalizedAlias || normalizedAlias === normalizedCanonical) continue;
      aliasEntries.push({ raw: rawAlias, normalized: normalizedAlias, priority: 10, type: "synonym" });
    }

    // ── Step 3: Insert aliases (skip if already registered) ───────────────────
    for (const { raw, normalized, priority, type } of aliasEntries) {
      try {
        const exists = await aliasExists(normalized);

        if (exists) {
          result.skipped_alias_count++;
          continue;
        }

        const ok = await insertAliasRow(ingredientId, raw, normalized, priority, type);
        if (ok) {
          result.inserted_alias_count++;
        } else {
          result.errors.push({
            candidate_canonical: candidate.suggested_canonical_name,
            alias:   raw,
            message: `Failed to insert alias "${normalized}"`,
          });
        }
      } catch (err) {
        result.errors.push({
          candidate_canonical: candidate.suggested_canonical_name,
          alias:   raw,
          message: `Unexpected error for alias "${normalized}": ${String(err)}`,
        });
      }
    }
  }

  return result;
}
