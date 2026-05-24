/**
 * batchResolverNodeSafe.ts — lib/admin
 * ─────────────────────────────────────────────────────────────────────────────
 * Node.js-safe implementation of applyUnknownResolutionCandidates.
 *
 * WHY THIS EXISTS:
 *   adminBatchResolverService.ts exports the canonical `applyUnknownResolutionCandidates`
 *   but imports `supabase` from `@/lib/supabaseClient` (which pulls in Expo/AsyncStorage).
 *   Admin tsx scripts running in Node cannot import that module.
 *
 *   This module provides an identical function using a caller-supplied lean
 *   SupabaseClient (from `createLeanSupabase()`), making it safe to call from
 *   any Node.js admin script.
 *
 * IDENTICAL BEHAVIOUR:
 *   - Same idempotency guarantees as the original
 *   - Same ingredients_master + ingredient_aliases write semantics
 *   - Same alias_type constraint values
 *   - Same BatchResolutionCandidate / BatchResolverResult types
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT import supabaseClient.ts or any expo module
 *   - Does NOT auto-run or trigger anything
 *   - Does NOT modify the live score engine or resolver
 *
 * USAGE (from any admin tsx script):
 *   import { applyUnknownResolutionCandidates } from "../batchResolverNodeSafe";
 *   import { createLeanSupabase }               from "../nodeResolver";
 *
 *   const sb     = createLeanSupabase();
 *   const result = await applyUnknownResolutionCandidates(candidates, sb);
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeForLookup }  from "./nodeResolver";

// ── Type re-exports (import type — no runtime load of adminBatchResolverService) ─

export type {
  BatchResolutionCandidate,
  BatchResolverResult,
  BatchResolverError,
  BatchRiskLevel,
  BatchPregnancyFlag,
  BatchAllergyFlag,
} from "./adminBatchResolverService";

import type {
  BatchResolutionCandidate,
  BatchResolverResult,
} from "./adminBatchResolverService";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function findExistingMasterRow(
  normalizedCanonical: string,
  sb: SupabaseClient
): Promise<string | null> {
  const { data, error } = await sb
    .from("ingredients_master")
    .select("id")
    .eq("canonical_name", normalizedCanonical)
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return (data[0] as { id: string }).id;
}

async function insertMasterRow(
  candidate:           BatchResolutionCandidate,
  normalizedCanonical: string,
  sb:                  SupabaseClient
): Promise<string | null> {
  const { data, error } = await sb
    .from("ingredients_master")
    .insert({
      canonical_name:     normalizedCanonical,
      display_name:       candidate.display_name ?? candidate.suggested_canonical_name,
      description:        candidate.description  ?? null,
      risk_level:         candidate.risk_level   ?? null,
      concern_flags:      candidate.concern_flags      ?? [],
      function_tags:      candidate.function_tags      ?? [],
      pregnancy_flag:     candidate.pregnancy_flag     ?? null,
      breastfeeding_flag: candidate.breastfeeding_flag ?? null,
      allergy_flag:       candidate.allergy_flag       ?? null,
      is_active:          true,
      metadata:           {},
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function aliasExists(
  normalizedAlias: string,
  sb: SupabaseClient
): Promise<boolean> {
  const { data, error } = await sb
    .from("ingredient_aliases")
    .select("id")
    .eq("normalized_alias", normalizedAlias)
    .limit(1);

  return !error && !!data && data.length > 0;
}

async function insertAliasRow(
  ingredientId:    string,
  rawAlias:        string,
  normalizedAlias: string,
  priority:        number,
  aliasType:       "exact" | "synonym" | "language" | "trade_name" | "misspelling" | "parser_rule",
  sb:              SupabaseClient
): Promise<boolean> {
  const { error } = await sb
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
 * applyUnknownResolutionCandidates (Node-safe)
 *
 * Node.js-safe equivalent of the same function in adminBatchResolverService.ts.
 * Accepts a caller-provided lean SupabaseClient instead of the Expo-tied one.
 *
 * Idempotent: re-running with the same candidates is always safe.
 *
 * @param candidates  Reviewed resolution candidates
 * @param sb          Lean SupabaseClient from createLeanSupabase()
 */
export async function applyUnknownResolutionCandidates(
  candidates: BatchResolutionCandidate[],
  sb:         SupabaseClient
): Promise<BatchResolverResult> {

  const result: BatchResolverResult = {
    inserted_master_count: 0,
    reused_master_count:   0,
    inserted_alias_count:  0,
    skipped_alias_count:   0,
    errors:                [],
  };

  for (const candidate of candidates) {
    const normalizedCanonical = normalizeForLookup(candidate.suggested_canonical_name);

    if (!normalizedCanonical) {
      result.errors.push({
        candidate_canonical: candidate.suggested_canonical_name,
        message: "Empty canonical name after normalization — skipped",
      });
      continue;
    }

    // ── Step 1: Resolve ingredients_master row ─────────────────────────────────
    let ingredientId: string | null = await findExistingMasterRow(normalizedCanonical, sb);

    if (ingredientId) {
      result.reused_master_count++;
    } else {
      ingredientId = await insertMasterRow(candidate, normalizedCanonical, sb);
      if (ingredientId) {
        result.inserted_master_count++;
      } else {
        result.errors.push({
          candidate_canonical: candidate.suggested_canonical_name,
          message: `Failed to insert ingredients_master for canonical "${normalizedCanonical}"`,
        });
        continue;
      }
    }

    // ── Step 2: Build full alias set ───────────────────────────────────────────
    // Canonical itself → priority 1 / exact; extra aliases → priority 10 / synonym
    const aliasEntries: Array<{
      raw:      string;
      norm:     string;
      priority: number;
      type:     "exact" | "synonym";
    }> = [
      {
        raw:      candidate.suggested_canonical_name,
        norm:     normalizedCanonical,
        priority: 1,
        type:     "exact",
      },
    ];

    for (const rawAlias of candidate.aliases) {
      const norm = normalizeForLookup(rawAlias);
      if (!norm || norm === normalizedCanonical) continue;
      aliasEntries.push({ raw: rawAlias, norm, priority: 10, type: "synonym" });
    }

    // ── Step 3: Insert aliases (skip if already registered) ───────────────────
    for (const { raw, norm, priority, type } of aliasEntries) {
      try {
        const exists = await aliasExists(norm, sb);
        if (exists) {
          result.skipped_alias_count++;
          continue;
        }

        const ok = await insertAliasRow(ingredientId, raw, norm, priority, type, sb);
        if (ok) {
          result.inserted_alias_count++;
        } else {
          result.errors.push({
            candidate_canonical: candidate.suggested_canonical_name,
            alias:   raw,
            message: `Failed to insert alias "${norm}"`,
          });
        }
      } catch (err) {
        result.errors.push({
          candidate_canonical: candidate.suggested_canonical_name,
          alias:   raw,
          message: `Unexpected error for alias "${norm}": ${String(err)}`,
        });
      }
    }
  }

  return result;
}
