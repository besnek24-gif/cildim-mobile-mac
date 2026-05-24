/**
 * debugLearningCandidates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ingredient Learning Pipeline — Phase 1 — DEBUG SCRIPT
 *
 * PURPOSE:
 *   Reads ingredient_unknown_queue, runs the candidate builder pipeline, and
 *   prints the top 20 learning candidates — ranked by promotion readiness,
 *   confidence, and seen_count.
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/debugLearningCandidates.ts
 *
 * WHAT THIS PRINTS:
 *   - Queue stats (total, pending, resolved, high-frequency)
 *   - Batch stats (promotion_ready / review_ready / capture_only counts)
 *   - Top 20 candidates with:
 *       normalized_name, suggested_canonical_name, suggested_aliases
 *       total_seen_count, unique_product_count, latest_seen_at
 *       confidence_score, promotion_status
 *       is_clean_alias, needs_manual_review flag
 *       sample_raw_names, sample_product_names
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT write to ingredient_learning_candidates (read-only debug)
 *   - Does NOT modify ingredient_unknown_queue
 *   - Does NOT affect live scoring, resolvers, or UI
 *   - Does NOT run automatically — manual execution only
 *
 * NODE.JS SAFETY:
 *   Uses createLeanSupabase() — never imports from supabaseClient.ts.
 *   Imports adminCandidateBuilderService (pure TS — no Supabase dependency).
 *   Replicates Supabase queries inline using the lean client.
 */

import { createLeanSupabase }            from "../nodeResolver";
import { buildAllCandidates, computeBatchStats } from "../adminCandidateBuilderService";
import type { CaptureAggregate }          from "../adminLearningCaptureService";

// ── Lean client (node-safe — never supabaseClient.ts) ─────────────────────────

const sb = createLeanSupabase();

// ── Capture aggregate builder (node-safe mirror of captureUnknownAggregates) ──

type QueueRow = {
  raw_name:            string | null;
  normalized_name:     string | null;
  seen_count:          number | null;
  first_seen_at:       string | null;
  last_seen_at:        string | null;
  resolution_status:   string | null;
  source_product_name: string | null;
};

function normalizeForLookup(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 \-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCaptureAggregates(limit = 500): Promise<CaptureAggregate[]> {
  const { data, error } = await sb
    .from("ingredient_unknown_queue")
    .select(
      "raw_name, normalized_name, seen_count, " +
      "first_seen_at, last_seen_at, resolution_status, " +
      "source_product_name"
    )
    .eq("resolution_status", "pending")
    .order("seen_count",   { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[fetchCaptureAggregates] Supabase error:", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  const byNorm = new Map<string, {
    seen:      number;
    firstSeen: string;
    lastSeen:  string;
    rawNames:  Set<string>;
    products:  Set<string>;
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
        rawNames:  new Set(row.raw_name            ? [row.raw_name]            : []),
        products:  new Set(row.source_product_name ? [row.source_product_name] : []),
      });
    } else {
      existing.seen += rowSeen;
      if (row.first_seen_at && row.first_seen_at < existing.firstSeen)
        existing.firstSeen = row.first_seen_at;
      if (row.last_seen_at && row.last_seen_at > existing.lastSeen)
        existing.lastSeen = row.last_seen_at;
      if (row.raw_name)            existing.rawNames.add(row.raw_name);
      if (row.source_product_name) existing.products.add(row.source_product_name);
    }
  }

  const aggregates: CaptureAggregate[] = [];
  for (const [norm, agg] of byNorm) {
    aggregates.push({
      normalized_name:      norm,
      total_seen_count:     agg.seen,
      unique_product_count: agg.products.size || 1,
      latest_seen_at:       agg.lastSeen,
      first_seen_at:        agg.firstSeen,
      sample_raw_names:     [...agg.rawNames].slice(0, 5),
      sample_product_names: [...agg.products].slice(0, 5),
      resolution_status:    "pending",
    });
  }

  return aggregates.sort((a, b) => {
    const diff = b.total_seen_count - a.total_seen_count;
    return diff !== 0 ? diff : a.normalized_name.localeCompare(b.normalized_name);
  });
}

// ── Queue stats (node-safe) ───────────────────────────────────────────────────

async function fetchQueueStats(): Promise<{
  total: number; pending: number; resolved: number;
  ignored: number; highFreq: number; topSeen: number;
}> {
  const { data, error } = await sb
    .from("ingredient_unknown_queue")
    .select("resolution_status, seen_count");

  if (error || !data) {
    return { total: 0, pending: 0, resolved: 0, ignored: 0, highFreq: 0, topSeen: 0 };
  }

  type StatRow = { resolution_status: string | null; seen_count: number | null };
  const rows    = data as StatRow[];
  const pending = rows.filter((r) => r.resolution_status === "pending");

  return {
    total:    rows.length,
    pending:  pending.length,
    resolved: rows.filter((r) => r.resolution_status === "resolved").length,
    ignored:  rows.filter((r) => r.resolution_status === "ignored").length,
    highFreq: pending.filter((r) => (r.seen_count ?? 0) >= 5).length,
    topSeen:  pending.length > 0 ? Math.max(...pending.map((r) => r.seen_count ?? 0)) : 0,
  };
}

// ── Printer ───────────────────────────────────────────────────────────────────

const HR  = "═".repeat(72);
const HR2 = "─".repeat(72);

function promotionIcon(status: string): string {
  if (status === "promotion_ready") return "🟢";
  if (status === "review_ready")    return "🟡";
  return "⚪";
}

function confidenceBar(score: number): string {
  const filled = Math.round(score * 10);
  return "[" + "█".repeat(filled) + "░".repeat(10 - filled) + "]";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function printCandidate(c: ReturnType<typeof buildAllCandidates>[0], idx: number): void {
  const icon     = promotionIcon(c.promotion_status);
  const confBar  = confidenceBar(c.confidence_score);
  const aliases  = c.suggested_aliases.length > 0
    ? c.suggested_aliases.join(", ")
    : "(none)";
  const rawNames = c.sample_raw_names.length > 0
    ? c.sample_raw_names.join(" | ")
    : "(none)";
  const products = c.sample_product_names.length > 0
    ? c.sample_product_names.join(" | ")
    : "(none)";

  const flags: string[] = [];
  if (!c.is_clean_alias)      flags.push("⚠️ DIRTY_ALIAS");
  if (c.needs_manual_review)  flags.push("👁 MANUAL_REVIEW");

  console.log(`\n  ${String(idx + 1).padStart(2)}. ${icon} ${c.normalized_name}`);
  console.log(`      Canonical   : ${c.suggested_canonical_name}`);

  // Normalization trace — only shown when name actually changed
  if (c._normTrace && c._normTrace.raw !== c._normTrace.final) {
    console.log(`      Norm trace  :`);
    console.log(`        raw     : "${c._normTrace.raw}"`);
    if (c._normTrace.raw !== c._normTrace.cleaned)
      console.log(`        cleaned : "${c._normTrace.cleaned}"`);
    console.log(`        final   : "${c._normTrace.final}"  [${c._normTrace.source}]`);
  }

  console.log(`      Aliases     : ${aliases}`);
  console.log(`      Seen        : ${c.total_seen_count}×  (products: ${c.unique_product_count})`);
  console.log(`      Latest      : ${formatDate(c.latest_seen_at)}`);
  console.log(`      Confidence  : ${c.confidence_score.toFixed(2)} ${confBar}`);
  console.log(`      Status      : ${c.promotion_status}`);
  if (flags.length > 0)
    console.log(`      Flags       : ${flags.join("  ")}`);
  console.log(`      Raw names   : ${rawNames}`);
  console.log(`      Products    : ${products}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${HR}`);
  console.log(` Ingredient Learning Pipeline — Phase 1 Debug`);
  console.log(` Top 20 Learning Candidates`);
  console.log(`${HR}`);

  // ── 1. Queue stats ─────────────────────────────────────────────────────────
  process.stdout.write(" Fetching queue stats… ");
  const stats = await fetchQueueStats();
  console.log("done.");

  console.log(`\n${HR2}`);
  console.log(` QUEUE STATS  (ingredient_unknown_queue)`);
  console.log(`${HR2}`);
  console.log(`  Total entries    : ${stats.total}`);
  console.log(`  Pending          : ${stats.pending}`);
  console.log(`  Resolved         : ${stats.resolved}`);
  console.log(`  Ignored          : ${stats.ignored}`);
  console.log(`  High-freq (≥5×)  : ${stats.highFreq}`);
  console.log(`  Top seen_count   : ${stats.topSeen}`);

  if (stats.pending === 0) {
    console.log(`\n  ℹ️  No pending unknowns in queue.`);
    console.log(`     Use the app to scan products, then re-run this script.`);
    console.log(`${HR}\n`);
    return;
  }

  // ── 2. Capture aggregates ──────────────────────────────────────────────────
  process.stdout.write("\n Aggregating capture data… ");
  const aggregates = await fetchCaptureAggregates(500);
  console.log(`${aggregates.length} unique ingredients.`);

  // ── 3. Build candidates ────────────────────────────────────────────────────
  process.stdout.write(" Building candidates… ");
  const candidates = buildAllCandidates(aggregates);
  const batchStats = computeBatchStats(candidates);
  console.log("done.");

  console.log(`\n${HR2}`);
  console.log(` CANDIDATE BATCH STATS`);
  console.log(`${HR2}`);
  console.log(`  Total candidates    : ${batchStats.total_candidates}`);
  console.log(`  🟢 promotion_ready  : ${batchStats.promotion_ready}`);
  console.log(`  🟡 review_ready     : ${batchStats.review_ready}`);
  console.log(`  ⚪ capture_only     : ${batchStats.capture_only}`);
  console.log(`  👁  needs review    : ${batchStats.needs_manual_review}`);
  console.log(`  Avg confidence      : ${batchStats.avg_confidence.toFixed(2)}`);
  console.log(`  High confidence(≥.75): ${batchStats.high_confidence}`);

  // ── 4. Top 20 candidates ───────────────────────────────────────────────────
  const top20 = candidates.slice(0, 20);

  console.log(`\n${HR2}`);
  console.log(` TOP 20 CANDIDATES  (sorted: status → confidence → seen_count)`);
  console.log(HR2);
  console.log(` Icon: 🟢 promotion_ready  🟡 review_ready  ⚪ capture_only`);
  console.log(HR2);

  if (top20.length === 0) {
    console.log("  No candidates to display.");
  } else {
    for (let i = 0; i < top20.length; i++) {
      printCandidate(top20[i], i);
    }
  }

  // ── 5. Actionable summary ──────────────────────────────────────────────────
  console.log(`\n${HR2}`);
  console.log(` NEXT STEPS`);
  console.log(HR2);

  if (batchStats.promotion_ready > 0) {
    console.log(`  ✅ ${batchStats.promotion_ready} candidate(s) are PROMOTION READY.`);
    console.log(`     Review them above, then run syncCandidatesToSupabase() +`);
    console.log(`     a batch insert script to add them to ingredients_master.`);
  }
  if (batchStats.review_ready > 0) {
    console.log(`  🟡 ${batchStats.review_ready} candidate(s) are REVIEW READY.`);
    console.log(`     Check the normalized_name and suggested_canonical_name.`);
    console.log(`     If correct, they will reach promotion_ready with more sightings.`);
  }
  if (batchStats.capture_only > 0) {
    console.log(`  ⚪ ${batchStats.capture_only} candidate(s) are CAPTURE ONLY.`);
    console.log(`     These need more sightings or manual review before promotion.`);
  }

  console.log(`\n  To persist to DB: call syncCandidatesToSupabase(candidates)`);
  console.log(`  from adminReviewQueueService in an admin script.`);
  console.log(`  (NOT auto-run — this is a manual step.)\n`);
  console.log(`${HR}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
