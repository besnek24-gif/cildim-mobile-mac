/**
 * adminLearningCaptureService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ingredient Learning Pipeline — Phase 1 — CAPTURE ENGINE
 *
 * PURPOSE:
 *   Reads from ingredient_unknown_queue, aggregates by normalized_name, and
 *   returns structured capture aggregates ready for candidate building.
 *
 * POSITION IN PIPELINE:
 *   ingredient_unknown_queue
 *     ──[captureUnknownAggregates]──▶ CaptureAggregate[]
 *       ──[adminCandidateBuilderService]──▶ LearningCandidate[]
 *         ──[adminReviewQueueService]──▶ ingredient_learning_candidates (DB)
 *
 * STRICT RULES:
 *   - READ-ONLY: zero writes to any table
 *   - Does NOT change resolver, scoring, or UI behavior
 *   - Does NOT auto-promote anything
 *   - Additive only — no existing file modified
 *
 * NOTE ON unique_product_count:
 *   The ingredient_unknown_queue resolver (resolveIngredientV4) stores one
 *   row per normalized_name, tracking only the FIRST product that triggered
 *   the unknown. Subsequent sightings increment seen_count on the same row.
 *   Therefore unique_product_count is always 1 from the queue alone.
 *   A future Phase 2 resolver change could track multi-product exposure;
 *   for Phase 1 this field is set to 1 for all entries.
 */

import { supabase } from "@/lib/supabaseClient";

// ── Output types ──────────────────────────────────────────────────────────────

/**
 * Aggregated capture record for one unknown ingredient.
 * Built from ingredient_unknown_queue rows grouped by normalized_name.
 */
export interface CaptureAggregate {
  /** Normalized form stored in the queue (lowercase, stripped) */
  normalized_name:       string;
  /**
   * How many times this ingredient was seen across all products.
   * Directly from queue.seen_count.
   */
  total_seen_count:      number;
  /**
   * Number of distinct products that triggered this unknown.
   * Phase 1: always 1 due to queue schema (see file header note).
   */
  unique_product_count:  number;
  /** Most recent sighting timestamp */
  latest_seen_at:        string;
  /** First sighting timestamp */
  first_seen_at:         string;
  /**
   * Distinct raw name variants seen for this ingredient.
   * Typically 1 entry (queue stores the first raw_name seen).
   * Useful for alias suggestion.
   */
  sample_raw_names:      string[];
  /**
   * Product names that triggered this unknown.
   * Phase 1: at most 1 (first product only, per queue schema).
   */
  sample_product_names:  string[];
  /**
   * Current resolution status in the queue.
   * "pending" | "resolved" | "ignored"
   */
  resolution_status:     string;
}

/** Aggregate statistics across the full capture dataset. */
export interface CaptureStats {
  total_unknowns:         number;
  pending_count:          number;
  resolved_count:         number;
  ignored_count:          number;
  high_frequency_count:   number;   // seen_count >= 5
  top_seen_count:         number;   // max seen_count in pending
  avg_seen_count:         number;   // average seen_count in pending
}

// ── Internal normalizer (mirrors resolver, for consistent comparison) ─────────

function normalizeForLookup(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 \-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Main capture function ─────────────────────────────────────────────────────

/**
 * captureUnknownAggregates
 *
 * Reads pending rows from ingredient_unknown_queue, deduplicates by
 * normalized_name, and returns a sorted list of CaptureAggregate records.
 *
 * READ-ONLY — safe to call at any time.
 * Does NOT write to any table.
 *
 * Results are sorted by total_seen_count DESC (highest impact first).
 *
 * @param limit    Max queue rows to read before aggregating (default 300, max 1000)
 * @param status   Filter by resolution_status (default "pending")
 */
export async function captureUnknownAggregates(
  limit  = 300,
  status = "pending"
): Promise<CaptureAggregate[]> {
  const safeLimit = Math.min(Math.max(1, limit), 1000);

  const { data, error } = await supabase
    .from("ingredient_unknown_queue")
    .select(
      "raw_name, normalized_name, seen_count, " +
      "first_seen_at, last_seen_at, resolution_status, " +
      "source_product_name"
    )
    .eq("resolution_status", status)
    .order("seen_count",   { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[captureUnknownAggregates] Supabase error:", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  // ── Aggregate by normalized_name ───────────────────────────────────────────
  // Phase 1: queue has one row per normalized_name, but we group defensively
  // in case of legacy duplicates from before the SELECT+INSERT guard was added.

  type QueueRow = {
    raw_name:            string | null;
    normalized_name:     string | null;
    seen_count:          number | null;
    first_seen_at:       string | null;
    last_seen_at:        string | null;
    resolution_status:   string | null;
    source_product_name: string | null;
  };

  const byNorm = new Map<string, {
    seen:       number;
    firstSeen:  string;
    lastSeen:   string;
    rawNames:   Set<string>;
    products:   Set<string>;
    status:     string;
  }>();

  for (const row of data as unknown as QueueRow[]) {
    const norm = normalizeForLookup(row.normalized_name ?? row.raw_name ?? "");
    if (!norm || norm.length < 2) continue;

    const existing = byNorm.get(norm);
    const rowSeen  = row.seen_count ?? 1;

    if (!existing) {
      byNorm.set(norm, {
        seen:      rowSeen,
        firstSeen: row.first_seen_at ?? new Date().toISOString(),
        lastSeen:  row.last_seen_at  ?? new Date().toISOString(),
        rawNames:  new Set(row.raw_name ? [row.raw_name] : []),
        products:  new Set(row.source_product_name ? [row.source_product_name] : []),
        status:    row.resolution_status ?? "pending",
      });
    } else {
      // Merge: accumulate seen_count, keep earliest/latest timestamps, union sets
      existing.seen      += rowSeen;
      if (row.first_seen_at && row.first_seen_at < existing.firstSeen)
        existing.firstSeen = row.first_seen_at;
      if (row.last_seen_at && row.last_seen_at > existing.lastSeen)
        existing.lastSeen = row.last_seen_at;
      if (row.raw_name)            existing.rawNames.add(row.raw_name);
      if (row.source_product_name) existing.products.add(row.source_product_name);
    }
  }

  // ── Build output array ─────────────────────────────────────────────────────
  const aggregates: CaptureAggregate[] = [];

  for (const [norm, agg] of byNorm) {
    aggregates.push({
      normalized_name:      norm,
      total_seen_count:     agg.seen,
      unique_product_count: agg.products.size || 1,  // always ≥ 1
      latest_seen_at:       agg.lastSeen,
      first_seen_at:        agg.firstSeen,
      sample_raw_names:     [...agg.rawNames].slice(0, 5),
      sample_product_names: [...agg.products].slice(0, 5),
      resolution_status:    agg.status,
    });
  }

  // Sort: total_seen_count DESC, then alphabetical for stability
  return aggregates.sort((a, b) => {
    const diff = b.total_seen_count - a.total_seen_count;
    return diff !== 0 ? diff : a.normalized_name.localeCompare(b.normalized_name);
  });
}

// ── Stats helper ──────────────────────────────────────────────────────────────

/**
 * getCaptureStats
 *
 * Returns aggregate statistics across the full ingredient_unknown_queue.
 * Useful for dashboards and progress tracking.
 *
 * READ-ONLY. Does NOT modify queue rows.
 */
export async function getCaptureStats(): Promise<CaptureStats> {
  const { data, error } = await supabase
    .from("ingredient_unknown_queue")
    .select("resolution_status, seen_count");

  if (error || !data) {
    console.error("[getCaptureStats] Supabase error:", error?.message);
    return {
      total_unknowns:       0,
      pending_count:        0,
      resolved_count:       0,
      ignored_count:        0,
      high_frequency_count: 0,
      top_seen_count:       0,
      avg_seen_count:       0,
    };
  }

  type StatRow = { resolution_status: string | null; seen_count: number | null };
  const rows = data as StatRow[];

  const pending  = rows.filter((r) => r.resolution_status === "pending");
  const resolved = rows.filter((r) => r.resolution_status === "resolved");
  const ignored  = rows.filter((r) => r.resolution_status === "ignored");

  const pendingSeen = pending.map((r) => r.seen_count ?? 1);
  const topSeen     = pendingSeen.length > 0 ? Math.max(...pendingSeen) : 0;
  const avgSeen     = pendingSeen.length > 0
    ? Math.round(pendingSeen.reduce((s, v) => s + v, 0) / pendingSeen.length)
    : 0;

  return {
    total_unknowns:       rows.length,
    pending_count:        pending.length,
    resolved_count:       resolved.length,
    ignored_count:        ignored.length,
    high_frequency_count: pending.filter((r) => (r.seen_count ?? 0) >= 5).length,
    top_seen_count:       topSeen,
    avg_seen_count:       avgSeen,
  };
}
