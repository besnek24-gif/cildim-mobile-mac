/**
 * cleanupResolvedUnknownQueuePhase1C.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 1C — Queue cleanup utility.
 *
 * PURPOSE:
 *   The Phase 1C insert script (batchInsertFragranceAllergensPhase1C.ts) added
 *   22 EU-26 fragrance-allergen ingredients to ingredients_master +
 *   ingredient_aliases but intentionally did NOT touch
 *   ingredient_unknown_queue. Some of those queue rows therefore still appear
 *   as `pending` even though the resolver can now resolve them. This script
 *   flips `resolution_status` to "resolved" for ONLY those queue rows whose
 *   normalized_name is now resolvable through one of the 22 Phase 1C
 *   canonicals or their registered aliases.
 *
 * STRICT SAFETY GUARANTEES:
 *   - DRY-RUN BY DEFAULT (set DRY_RUN=false to actually update)
 *   - WRITES ONLY to ingredient_unknown_queue.resolution_status
 *     (no other table or column is touched)
 *   - Does NOT delete any row
 *   - Does NOT modify products
 *   - Does NOT modify ingredients_master
 *   - Does NOT modify ingredient_aliases
 *   - Does NOT change resolver, score engine, UI, or registry code
 *   - Only flips rows whose normalized_name is verifiably in the resolved set
 *     (intersection of master canonicals + aliases for the 22 Phase 1C items)
 *   - Only flips rows whose current resolution_status = "pending"
 *
 * NORMALIZED-FORM SOURCE OF TRUTH:
 *   The 22 canonical names below are the EXACT same ones inserted by
 *   batchInsertFragranceAllergensPhase1C.ts. We deliberately duplicate them
 *   here (rather than importing the other script) because importing that
 *   module would auto-execute its main() runner at module load time.
 *
 * HOW TO RUN (from artifacts/ciltbakim-mobile):
 *
 *   # DRY RUN (default — no writes):
 *   set -a && source .env && set +a && \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/cleanupResolvedUnknownQueuePhase1C.ts
 *
 *   # LIVE UPDATE (only when explicitly requested):
 *   set -a && source .env && set +a && DRY_RUN=false \
 *     /home/runner/workspace/node_modules/.bin/tsx \
 *       --tsconfig tsconfig.json \
 *       lib/admin/scripts/cleanupResolvedUnknownQueuePhase1C.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLeanSupabase, normalizeForLookup } from "../nodeResolver";

// ── DRY-RUN guard ─────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== "false";

// ── Phase 1C canonicals (must match batchInsertFragranceAllergensPhase1C.ts) ──
const PHASE_1C_CANONICALS: readonly string[] = [
  "limonene",
  "linalool",
  "citral",
  "geraniol",
  "eugenol",
  "citronellol",
  "coumarin",
  "farnesol",
  "cinnamal",
  "cinnamyl alcohol",
  "isoeugenol",
  "hexyl cinnamal",
  "amyl cinnamal",
  "amylcinnamyl alcohol",
  "benzyl alcohol",
  "benzyl salicylate",
  "benzyl benzoate",
  "benzyl cinnamate",
  "hydroxycitronellal",
  "anise alcohol",
  "methyl 2-octynoate",
  "alpha-isomethyl ionone",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

interface QueueRow {
  raw_name:          string;
  normalized_name:   string;
  seen_count:        number;
  resolution_status: string;
  first_seen_at:     string;
  last_seen_at:      string;
}

async function fetchPhase1CMasterIds(
  sb: SupabaseClient,
  normalizedCanonicals: string[]
): Promise<{ id: string; canonical_name: string }[]> {
  const { data, error } = await sb
    .from("ingredients_master")
    .select("id, canonical_name")
    .in("canonical_name", normalizedCanonicals);

  if (error) {
    throw new Error(`ingredients_master fetch failed: ${error.message}`);
  }
  return (data ?? []) as { id: string; canonical_name: string }[];
}

async function fetchAliasNormsForIds(
  sb: SupabaseClient,
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return [];

  const all: string[] = [];
  const PAGE = 200;
  for (let i = 0; i < ids.length; i += PAGE) {
    const slice = ids.slice(i, i + PAGE);
    const { data, error } = await sb
      .from("ingredient_aliases")
      .select("normalized_alias")
      .in("ingredient_id", slice)
      .eq("is_active", true);

    if (error) {
      throw new Error(`ingredient_aliases fetch failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      const v = (row as { normalized_alias?: string }).normalized_alias;
      if (v) all.push(v);
    }
  }
  return all;
}

async function fetchPendingQueueRowsByNorm(
  sb: SupabaseClient,
  norms: string[]
): Promise<QueueRow[]> {
  if (norms.length === 0) return [];

  const all: QueueRow[] = [];
  const PAGE = 200;
  for (let i = 0; i < norms.length; i += PAGE) {
    const slice = norms.slice(i, i + PAGE);
    const { data, error } = await sb
      .from("ingredient_unknown_queue")
      .select(
        "raw_name, normalized_name, seen_count, resolution_status, first_seen_at, last_seen_at"
      )
      .in("normalized_name", slice)
      .eq("resolution_status", "pending");

    if (error) {
      throw new Error(`ingredient_unknown_queue fetch failed: ${error.message}`);
    }
    for (const row of (data ?? []) as QueueRow[]) all.push(row);
  }
  return all;
}

// ── Main runner ───────────────────────────────────────────────────────────────

async function main() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log(" cleanupResolvedUnknownQueuePhase1C");
  console.log(` Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` MODE    : ${DRY_RUN ? "DRY-RUN  (no writes)" : "LIVE  (writes enabled)"}`);
  console.log(` Phase 1C canonicals declared: ${PHASE_1C_CANONICALS.length}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  const sb = createLeanSupabase();

  // ── Step 1: Resolve Phase 1C canonicals → ingredient ids ────────────────────
  const normalizedCanonicals = PHASE_1C_CANONICALS.map((c) => normalizeForLookup(c));
  const masterRows           = await fetchPhase1CMasterIds(sb, normalizedCanonicals);

  const presentMasterCanonSet = new Set(masterRows.map((r) => r.canonical_name));
  const masterCanonToId       = new Map(masterRows.map((r) => [r.canonical_name, r.id]));
  const missingFromMaster     = normalizedCanonicals.filter((c) => !presentMasterCanonSet.has(c));

  console.log(" Phase 1C → ingredients_master lookup:");
  console.log(`   present in master : ${masterRows.length} / ${PHASE_1C_CANONICALS.length}`);
  if (missingFromMaster.length > 0) {
    console.log(`   ⚠ MISSING in master (will not be flipped):`);
    for (const m of missingFromMaster) console.log(`     • "${m}"`);
  }
  console.log();

  // ── Step 2: Build resolved-form set (canonicals ∪ aliases) ──────────────────
  const ingredientIds = [...masterCanonToId.values()];
  const aliasNorms    = await fetchAliasNormsForIds(sb, ingredientIds);

  const resolvedSet = new Set<string>();
  for (const c of presentMasterCanonSet) resolvedSet.add(c);
  for (const a of aliasNorms)            resolvedSet.add(a);

  console.log(" Resolved-form set built from master + aliases:");
  console.log(`   distinct normalized forms : ${resolvedSet.size}`);
  console.log();

  // ── Step 3: Fetch pending queue rows that match the resolved set ────────────
  const pendingMatches = await fetchPendingQueueRowsByNorm(sb, [...resolvedSet]);

  console.log(" Queue scan:");
  console.log(`   pending queue rows resolvable via Phase 1C : ${pendingMatches.length}`);
  console.log();

  // ── Step 4: Group + report planned updates ──────────────────────────────────
  const aliasNormToCanon = new Map<string, string>();
  for (const c of presentMasterCanonSet) aliasNormToCanon.set(c, c);
  {
    const idToCanon = new Map<string, string>();
    for (const r of masterRows) idToCanon.set(r.id, r.canonical_name);

    if (ingredientIds.length > 0) {
      const PAGE = 200;
      for (let i = 0; i < ingredientIds.length; i += PAGE) {
        const slice = ingredientIds.slice(i, i + PAGE);
        const { data } = await sb
          .from("ingredient_aliases")
          .select("normalized_alias, ingredient_id")
          .in("ingredient_id", slice)
          .eq("is_active", true);
        for (const r of (data ?? []) as { normalized_alias: string; ingredient_id: string }[]) {
          const c = idToCanon.get(r.ingredient_id);
          if (c && r.normalized_alias) aliasNormToCanon.set(r.normalized_alias, c);
        }
      }
    }
  }

  type PlannedUpdate = {
    raw_name:        string;
    normalized_name: string;
    seen_count:      number;
    resolved_to:     string;
  };
  const planned: PlannedUpdate[] = [];
  const skipped: { raw_name: string; normalized_name: string; reason: string }[] = [];

  for (const row of pendingMatches) {
    const canon = aliasNormToCanon.get(row.normalized_name);
    if (!canon) {
      skipped.push({
        raw_name:        row.raw_name,
        normalized_name: row.normalized_name,
        reason:          "could not map to a Phase 1C canonical (defensive skip)",
      });
      continue;
    }
    planned.push({
      raw_name:        row.raw_name,
      normalized_name: row.normalized_name,
      seen_count:      row.seen_count,
      resolved_to:     canon,
    });
  }

  const byCanon = new Map<string, PlannedUpdate[]>();
  for (const p of planned) {
    if (!byCanon.has(p.resolved_to)) byCanon.set(p.resolved_to, []);
    byCanon.get(p.resolved_to)!.push(p);
  }

  console.log("=============================================================");
  console.log(" PLANNED UPDATES (resolution_status: pending → resolved)");
  console.log("=============================================================\n");

  let totalRowsToFlip    = 0;
  let totalSeenInstances = 0;
  let canonsWithMatches  = 0;
  let canonsNoMatches    = 0;

  for (const c of normalizedCanonicals) {
    const rows = byCanon.get(c) ?? [];
    const inMaster = presentMasterCanonSet.has(c);
    const tag      = inMaster ? "✓ master" : "✗ NOT in master";

    if (rows.length === 0) {
      canonsNoMatches++;
      console.log(`  • [${tag}]  "${c}"  → 0 pending queue rows to flip`);
      continue;
    }
    canonsWithMatches++;
    console.log(`  • [${tag}]  "${c}"  → ${rows.length} pending queue row(s):`);
    for (const r of rows) {
      totalRowsToFlip++;
      totalSeenInstances += r.seen_count;
      console.log(
        `      └─ raw="${r.raw_name}"  norm="${r.normalized_name}"  seen=${r.seen_count}`
      );
    }
  }

  console.log();
  if (skipped.length > 0) {
    console.log(" Defensive skips (should be 0 in normal operation):");
    for (const s of skipped) {
      console.log(`   - "${s.raw_name}" (norm="${s.normalized_name}")  reason: ${s.reason}`);
    }
    console.log();
  }

  console.log("─────────────────────────────────────────────────────────────");
  console.log(" SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`   Phase 1C canonicals declared          : ${PHASE_1C_CANONICALS.length}`);
  console.log(`   Phase 1C canonicals present in master : ${masterRows.length}`);
  console.log(`   Phase 1C canonicals missing in master : ${missingFromMaster.length}`);
  console.log(`   Canonicals with ≥1 pending queue row  : ${canonsWithMatches}`);
  console.log(`   Canonicals with 0  pending queue rows : ${canonsNoMatches}`);
  console.log(`   Pending queue rows planned to FLIP    : ${totalRowsToFlip}`);
  console.log(`   Σ seen_count of those rows            : ${totalSeenInstances}`);
  console.log(`   Defensive skips                       : ${skipped.length}`);
  console.log("─────────────────────────────────────────────────────────────\n");

  if (DRY_RUN) {
    console.log(" No data was written. Re-run with DRY_RUN=false to apply.");
    return;
  }

  // ── LIVE UPDATE path ────────────────────────────────────────────────────────
  console.log(" Applying updates …\n");

  let updated = 0;
  let failed  = 0;

  for (const p of planned) {
    const { error } = await sb
      .from("ingredient_unknown_queue")
      .update({ resolution_status: "resolved" })
      .eq("normalized_name", p.normalized_name)
      .eq("resolution_status", "pending");

    if (error) {
      failed++;
      console.log(`   ✗ FAIL  norm="${p.normalized_name}"  → ${error.message}`);
    } else {
      updated++;
    }
  }

  console.log("\n─────────────────────────────────────────────────────────────");
  console.log(" LIVE RESULT");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`   queue rows updated to "resolved" : ${updated}`);
  console.log(`   update failures                  : ${failed}`);
  console.log("─────────────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
