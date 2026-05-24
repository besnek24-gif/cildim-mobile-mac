/**
 * adminReviewQueueService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ingredient Learning Pipeline — Phase 1 — REVIEW QUEUE SERVICE
 *
 * PURPOSE:
 *   Admin-only read helpers for the ingredient_learning_candidates table.
 *   Surfaces highest-priority, highest-frequency, and review-ready candidates
 *   so human reviewers know where to focus.
 *
 * ALSO PROVIDES:
 *   syncCandidatesToSupabase — optional upsert from in-memory candidates to DB.
 *   Call this after buildAllCandidates() to persist the learning snapshot.
 *
 * POSITION IN PIPELINE:
 *   ingredient_learning_candidates (DB)
 *     ──[getHighestPriorityUnknowns]──▶  admin review UI / debug scripts
 *     ──[getHighRepeatCandidates]──────▶  high-frequency focus list
 *     ──[getCandidatesReadyForReview]──▶  promotion shortlist
 *
 * STRICT RULES:
 *   - All read helpers are READ-ONLY (zero writes)
 *   - syncCandidatesToSupabase is the ONLY write path — and it's admin-initiated
 *   - Does NOT auto-promote anything
 *   - Does NOT change scoring, resolver, or UI
 *   - Additive only — no existing file modified
 *
 * TABLE DEPENDENCY:
 *   Requires ingredient_learning_candidates (migration-learning-pipeline.sql).
 *   If the table doesn't exist, all read helpers return [] gracefully.
 */

import { supabase } from "@/lib/supabaseClient";
import type { LearningCandidate } from "./adminCandidateBuilderService";

// ── DB row type (matches table schema) ───────────────────────────────────────

export interface LearningCandidateRow {
  id:                       string;
  normalized_name:          string;
  suggested_canonical_name: string;
  suggested_aliases:        string[];
  total_seen_count:         number;
  unique_product_count:     number;
  latest_seen_at:           string | null;
  sample_raw_names:         string[];
  sample_product_names:     string[];
  confidence_score:         number;
  evidence_status:          "not_checked" | "pending" | "reviewed";
  evidence_sources:         unknown[];
  review_status:            "capture_only" | "review_ready" | "promotion_ready";
  promotion_status:         "capture_only" | "review_ready" | "promotion_ready";
  notes:                    string;
  created_at:               string;
  updated_at:               string;
}

/** Aggregate statistics for the learning candidates table. */
export interface LearningQueueStats {
  total_candidates:     number;
  promotion_ready:      number;
  review_ready:         number;
  capture_only:         number;
  avg_confidence:       number;
  max_seen_count:       number;
  last_synced_at:       string | null;
}

// ── Internal SELECT columns ───────────────────────────────────────────────────

const ALL_COLUMNS =
  "id, normalized_name, suggested_canonical_name, suggested_aliases, " +
  "total_seen_count, unique_product_count, latest_seen_at, " +
  "sample_raw_names, sample_product_names, confidence_score, " +
  "evidence_status, evidence_sources, review_status, promotion_status, " +
  "notes, created_at, updated_at";

// ── Read helpers ──────────────────────────────────────────────────────────────

/**
 * getHighestPriorityUnknowns
 *
 * Returns the top-N candidates ranked by promotion_status then confidence
 * then seen_count. Shows what deserves the most human attention right now.
 *
 * Ordering:
 *   1. promotion_status: promotion_ready > review_ready > capture_only
 *   2. confidence_score DESC
 *   3. total_seen_count DESC
 *
 * @param limit  Max results to return (default 50, max 200)
 */
export async function getHighestPriorityUnknowns(
  limit = 50
): Promise<LearningCandidateRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const { data, error } = await supabase
    .from("ingredient_learning_candidates")
    .select(ALL_COLUMNS)
    .order("confidence_score",  { ascending: false })
    .order("total_seen_count",  { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[getHighestPriorityUnknowns] error:", error.message);
    return [];
  }

  // Sort in memory by promotion_status priority (Supabase doesn't support enum ordering)
  const statusOrder: Record<string, number> = {
    promotion_ready: 0,
    review_ready:    1,
    capture_only:    2,
  };

  return ((data ?? []) as unknown as LearningCandidateRow[]).sort((a, b) => {
    const sDiff = (statusOrder[a.promotion_status] ?? 2) - (statusOrder[b.promotion_status] ?? 2);
    if (sDiff !== 0) return sDiff;
    const cDiff = b.confidence_score - a.confidence_score;
    if (Math.abs(cDiff) > 0.001) return cDiff > 0 ? 1 : -1;
    return b.total_seen_count - a.total_seen_count;
  });
}

/**
 * getHighRepeatCandidates
 *
 * Returns candidates seen at least `minCount` times, sorted by seen_count DESC.
 * Useful for identifying ingredients that appear most often across products —
 * these are the highest-value additions to the Supabase library.
 *
 * @param minCount  Minimum total_seen_count to include (default 3)
 * @param limit     Max results (default 50, max 200)
 */
export async function getHighRepeatCandidates(
  minCount = 3,
  limit    = 50
): Promise<LearningCandidateRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const { data, error } = await supabase
    .from("ingredient_learning_candidates")
    .select(ALL_COLUMNS)
    .gte("total_seen_count", minCount)
    .order("total_seen_count", { ascending: false })
    .order("confidence_score",  { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[getHighRepeatCandidates] error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as LearningCandidateRow[];
}

/**
 * getCandidatesReadyForReview
 *
 * Returns only candidates with promotion_status = "review_ready" or
 * "promotion_ready" — the shortlist for human review before any promotion.
 * Sorted by promotion_ready first, then confidence DESC.
 *
 * @param limit  Max results (default 100, max 500)
 */
export async function getCandidatesReadyForReview(
  limit = 100
): Promise<LearningCandidateRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);

  const { data, error } = await supabase
    .from("ingredient_learning_candidates")
    .select(ALL_COLUMNS)
    .in("promotion_status", ["review_ready", "promotion_ready"])
    .order("confidence_score",  { ascending: false })
    .order("total_seen_count",  { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[getCandidatesReadyForReview] error:", error.message);
    return [];
  }

  const statusOrder: Record<string, number> = { promotion_ready: 0, review_ready: 1 };

  return ((data ?? []) as unknown as LearningCandidateRow[]).sort(
    (a, b) => (statusOrder[a.promotion_status] ?? 1) - (statusOrder[b.promotion_status] ?? 1)
  );
}

/**
 * getLearningQueueStats
 *
 * Returns aggregate statistics for the ingredient_learning_candidates table.
 * Useful for quick health-check of the learning pipeline.
 *
 * READ-ONLY.
 */
export async function getLearningQueueStats(): Promise<LearningQueueStats> {
  const { data, error } = await supabase
    .from("ingredient_learning_candidates")
    .select("promotion_status, confidence_score, total_seen_count, updated_at");

  if (error || !data || data.length === 0) {
    return {
      total_candidates: 0,
      promotion_ready:  0,
      review_ready:     0,
      capture_only:     0,
      avg_confidence:   0,
      max_seen_count:   0,
      last_synced_at:   null,
    };
  }

  type StatRow = {
    promotion_status: string;
    confidence_score: number;
    total_seen_count: number;
    updated_at:       string;
  };

  const rows = data as unknown as StatRow[];
  const totalConf   = rows.reduce((s, r) => s + (r.confidence_score ?? 0), 0);
  const maxSeen     = Math.max(...rows.map((r) => r.total_seen_count ?? 0));
  const lastUpdated = rows.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]?.updated_at ?? null;

  return {
    total_candidates: rows.length,
    promotion_ready:  rows.filter((r) => r.promotion_status === "promotion_ready").length,
    review_ready:     rows.filter((r) => r.promotion_status === "review_ready").length,
    capture_only:     rows.filter((r) => r.promotion_status === "capture_only").length,
    avg_confidence:   Math.round((totalConf / rows.length) * 100) / 100,
    max_seen_count:   maxSeen,
    last_synced_at:   lastUpdated,
  };
}

// ── Sync (write path — admin-initiated only) ──────────────────────────────────

export interface SyncResult {
  upserted:  number;
  skipped:   number;
  errors:    string[];
}

/**
 * syncCandidatesToSupabase
 *
 * ADMIN-INITIATED WRITE — upserts LearningCandidates to ingredient_learning_candidates.
 *
 * Uses UPSERT on normalized_name (unique constraint) so repeated runs are safe.
 * Existing rows are updated; new rows are inserted. No rows are deleted.
 *
 * CALL THIS: after buildAllCandidates() when you want to persist the snapshot.
 * The debug script does NOT call this (it's read-only).
 *
 * @param candidates  Output of buildAllCandidates()
 * @param batchSize   Rows per upsert batch (default 50, max 200)
 */
export async function syncCandidatesToSupabase(
  candidates: LearningCandidate[],
  batchSize   = 50
): Promise<SyncResult> {
  const result: SyncResult = { upserted: 0, skipped: 0, errors: [] };

  if (candidates.length === 0) return result;

  const safeBatch = Math.min(Math.max(1, batchSize), 200);
  const now       = new Date().toISOString();

  for (let i = 0; i < candidates.length; i += safeBatch) {
    const batch = candidates.slice(i, i + safeBatch);

    const rows = batch.map((c) => ({
      normalized_name:          c.normalized_name,
      suggested_canonical_name: c.suggested_canonical_name,
      suggested_aliases:        c.suggested_aliases,
      total_seen_count:         c.total_seen_count,
      unique_product_count:     c.unique_product_count,
      latest_seen_at:           c.latest_seen_at,
      sample_raw_names:         c.sample_raw_names,
      sample_product_names:     c.sample_product_names,
      confidence_score:         c.confidence_score,
      evidence_status:          c.evidence_status,
      evidence_sources:         c.evidence_sources,
      review_status:            c.review_status,
      promotion_status:         c.promotion_status,
      notes:                    c.notes,
      updated_at:               now,
    }));

    const { error } = await supabase
      .from("ingredient_learning_candidates")
      .upsert(rows, { onConflict: "normalized_name", ignoreDuplicates: false });

    if (error) {
      result.errors.push(`Batch ${Math.floor(i / safeBatch) + 1}: ${error.message}`);
      result.skipped += batch.length;
    } else {
      result.upserted += batch.length;
    }
  }

  return result;
}
