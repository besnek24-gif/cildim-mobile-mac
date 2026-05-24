/**
 * adminIngredientQueueService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only admin utility for inspecting the ingredient_unknown_queue table.
 *
 * Purpose:
 *   Surfaces which ingredients the V4 engine is failing to recognise so that
 *   admins can decide what to add to ingredients_master / ingredient_aliases.
 *
 * Rules:
 *   - READ-ONLY: zero writes to any table
 *   - Does NOT change resolver behaviour
 *   - Does NOT change scoring logic
 *   - Completely additive — no existing file is modified
 *
 * Companion tables (managed by resolver):
 *   ingredient_unknown_queue  ← populated by resolveIngredientV4() (PATH 3)
 *   ingredients_master        ← admin populates to fix unknown entries
 *   ingredient_aliases        ← admin populates to teach the resolver
 */

import { supabase } from "@/lib/supabaseClient";

// ── Synonym groups for near-duplicate detection ────────────────────────────────
//
// Each sub-array is one equivalence group.
// First element = suggested canonical INCI name.
// Entries must be lowercase and match the normalizeForSupabaseLookup() format.
// Conservative list — only add when confidence is high.

const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["aqua", "water", "eau", "purified water", "deionized water", "distilled water"],
  ["parfum", "fragrance", "aroma", "perfume"],
  ["panthenol", "d-panthenol", "dl-panthenol", "dexpanthenol", "d panthenol", "dl panthenol", "provitamin b5"],
  ["glycerin", "glycerol", "glycerine", "vegetable glycerin"],
  ["tocopherol", "tocopherols", "tocopheryl", "vitamin e", "dl-alpha-tocopherol"],
  ["tocopheryl acetate", "vitamin e acetate", "dl-alpha-tocopheryl acetate"],
  ["sodium hyaluronate", "hyaluronic acid", "hyaluronate sodium", "sodium hyaluronate crosspolymer"],
  ["niacinamide", "nicotinamide", "vitamin b3"],
  ["retinol", "retinyl palmitate", "retinyl acetate", "vitamin a"],
  ["salicylic acid", "beta-hydroxy acid", "bha"],
  ["glycolic acid", "alpha-hydroxy acid"],
  ["lactic acid"],
  ["alcohol denat", "ethanol denat", "sd alcohol", "sd alcohol 40", "denatured alcohol"],
  ["dimethicone", "dimethiconol"],
  ["cyclopentasiloxane", "cyclomethicone", "d5 silicone"],
  ["sodium lauryl sulfate", "sls", "sodium dodecyl sulfate"],
  ["sodium laureth sulfate", "sles", "sodium lauryl ether sulfate"],
  ["carbomer", "carbopol", "carbomer 940", "carbomer 980", "carbomer 934"],
  ["alpha-arbutin", "arbutin"],
  ["ceramide np", "ceramide ap", "ceramide eop", "ceramide ns", "ceramide ng", "ceramide"],
  ["centella asiatica extract", "centella extract", "cica extract", "gotu kola extract"],
  ["allantoin"],
  ["adenosine"],
  ["kojic acid"],
  ["caffeine"],
  ["collagen", "hydrolyzed collagen", "soluble collagen"],
  ["beta-glucan", "oat beta-glucan"],
  ["citric acid"],
  ["propylene glycol"],
  ["butylene glycol"],
  ["phenoxyethanol"],
  ["titanium dioxide", "ci 77891", "zinc oxide titanium dioxide"],
  ["zinc oxide", "ci 77947"],
];

// ── Resolution candidate output type ──────────────────────────────────────────

export interface ResolutionCandidate {
  /** Suggested canonical INCI name — admin should verify and adjust */
  suggested_canonical_name: string;
  /** All normalized aliases found in the queue that map to this canonical */
  aliases:                  string[];
  /** Sample raw names from the queue (up to 5, most common first) */
  sample_raw_names:         string[];
  /** Combined seen_count across all aliases in this group */
  total_seen_count:         number;
  /** How this group was formed: "synonym" | "substring" | "singleton" */
  group_method:             "synonym" | "substring" | "singleton";
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Builds an O(1) lookup: normalized_name → synonym group index */
function buildSynonymIndex(): Map<string, number> {
  const index = new Map<string, number>();
  for (let gi = 0; gi < SYNONYM_GROUPS.length; gi++) {
    for (const term of SYNONYM_GROUPS[gi]) {
      index.set(term, gi);
    }
  }
  return index;
}

/**
 * Word-boundary-aware substring check.
 * Returns true if `shorter` appears inside `longer` at a word boundary.
 * Prevents "acid" matching "polyacid", but allows "panthenol" inside "d-panthenol".
 */
function isWordAlignedSubstring(shorter: string, longer: string): boolean {
  if (shorter.length < 5) return false;
  const idx = longer.indexOf(shorter);
  if (idx === -1) return false;
  const before = idx === 0 || /[ \-]/.test(longer[idx - 1]);
  const after  = idx + shorter.length === longer.length || /[ \-]/.test(longer[idx + shorter.length]);
  return before && after;
}

/** Returns true if two normalized names are near-duplicates via substring. */
function areSubstringDuplicates(a: string, b: string): boolean {
  if (a === b) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return isWordAlignedSubstring(shorter, longer);
}

/** Picks the best canonical name from a set of aliases for a synonym group. */
function pickCanonicalFromSynonymGroup(groupIdx: number, aliases: string[]): string {
  const group = SYNONYM_GROUPS[groupIdx];
  // Prefer the curated canonical (first element) if it appears in aliases
  if (group.length > 0 && aliases.includes(group[0])) return group[0];
  // Otherwise use the first curated term that overlaps with our aliases
  for (const term of group) {
    if (aliases.includes(term)) return term;
  }
  // Fallback to shortest alias (closest to a root name)
  return aliases.slice().sort((a, b) => a.length - b.length)[0] ?? aliases[0];
}

/** Picks the best canonical for a substring group: shortest word-boundary match. */
function pickCanonicalFromSubstringGroup(aliases: string[], rowsBySeen: Map<string, number>): string {
  // Prefer highest seen_count, break ties with shortest string
  return aliases.slice().sort((a, b) => {
    const diff = (rowsBySeen.get(b) ?? 0) - (rowsBySeen.get(a) ?? 0);
    return diff !== 0 ? diff : a.length - b.length;
  })[0] ?? aliases[0];
}

// ── getUnknownResolutionCandidates ────────────────────────────────────────────

/**
 * Reads top pending rows from ingredient_unknown_queue, groups near-duplicates,
 * and returns a clean review list for batch resolution into Supabase.
 *
 * READ-ONLY — zero writes. Safe to call at any time.
 *
 * Grouping strategy (in order):
 *   1. Synonym groups  — curated known-equivalent terms (aqua/water/eau, etc.)
 *   2. Substring match — word-boundary-aware containment (panthenol ⊂ d-panthenol)
 *   3. Singleton       — no match found, returned as a group of one
 *
 * @param limit  How many queue rows to fetch before grouping (default 100, max 500)
 */
export async function getUnknownResolutionCandidates(
  limit = 100
): Promise<ResolutionCandidate[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);

  // ── 1. Fetch pending rows from Supabase ──────────────────────────────────────
  const { data, error } = await supabase
    .from("ingredient_unknown_queue")
    .select("raw_name, normalized_name, seen_count")
    .eq("resolution_status", "pending")
    .order("seen_count",   { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[adminIngredientQueueService] getUnknownResolutionCandidates error:", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  // ── 2. Deduplicate by normalized_name, aggregate seen_count + raw variants ───
  const seenCountByNorm   = new Map<string, number>();
  const rawVariantsByNorm = new Map<string, string[]>();

  for (const row of data) {
    const norm = row.normalized_name ?? "";
    const raw  = row.raw_name        ?? "";
    if (!norm) continue;

    seenCountByNorm.set(norm, (seenCountByNorm.get(norm) ?? 0) + (row.seen_count ?? 1));

    const variants = rawVariantsByNorm.get(norm) ?? [];
    if (!variants.includes(raw)) variants.push(raw);
    rawVariantsByNorm.set(norm, variants);
  }

  // Unique normalized names, sorted by seen_count DESC
  const allNorms = Array.from(seenCountByNorm.keys()).sort(
    (a, b) => (seenCountByNorm.get(b) ?? 0) - (seenCountByNorm.get(a) ?? 0)
  );

  // ── 3. Build synonym index for O(1) lookup ───────────────────────────────────
  const synonymIndex = buildSynonymIndex();

  // ── 4. Group: Synonym pass ────────────────────────────────────────────────────
  const assigned   = new Set<string>();
  const candidates: ResolutionCandidate[] = [];

  // Group entries that belong to the same curated synonym group
  const synonymGroups = new Map<number, string[]>(); // groupIdx → normalized names found

  for (const norm of allNorms) {
    const groupIdx = synonymIndex.get(norm);
    if (groupIdx !== undefined) {
      const bucket = synonymGroups.get(groupIdx) ?? [];
      bucket.push(norm);
      synonymGroups.set(groupIdx, bucket);
      assigned.add(norm);
    }
  }

  for (const [groupIdx, aliases] of synonymGroups) {
    const totalSeen = aliases.reduce((s, a) => s + (seenCountByNorm.get(a) ?? 0), 0);
    const sampleRaws = aliases
      .flatMap((a) => rawVariantsByNorm.get(a) ?? [])
      .slice(0, 5);

    candidates.push({
      suggested_canonical_name: pickCanonicalFromSynonymGroup(groupIdx, aliases),
      aliases:                  aliases.filter((a) => a !== SYNONYM_GROUPS[groupIdx][0]),
      sample_raw_names:         sampleRaws,
      total_seen_count:         totalSeen,
      group_method:             "synonym",
    });
  }

  // ── 5. Group: Substring pass ──────────────────────────────────────────────────
  const unassigned = allNorms.filter((n) => !assigned.has(n));

  for (let i = 0; i < unassigned.length; i++) {
    const norm = unassigned[i];
    if (assigned.has(norm)) continue;

    const group: string[] = [norm];
    assigned.add(norm);

    for (let j = i + 1; j < unassigned.length; j++) {
      const other = unassigned[j];
      if (assigned.has(other)) continue;
      if (areSubstringDuplicates(norm, other)) {
        group.push(other);
        assigned.add(other);
      }
    }

    const totalSeen = group.reduce((s, a) => s + (seenCountByNorm.get(a) ?? 0), 0);
    const canonical = pickCanonicalFromSubstringGroup(group, seenCountByNorm);
    const sampleRaws = group
      .flatMap((a) => rawVariantsByNorm.get(a) ?? [])
      .slice(0, 5);

    candidates.push({
      suggested_canonical_name: canonical,
      aliases:                  group.filter((a) => a !== canonical),
      sample_raw_names:         sampleRaws,
      total_seen_count:         totalSeen,
      group_method:             group.length > 1 ? "substring" : "singleton",
    });
  }

  // ── 6. Sort by total_seen_count DESC ─────────────────────────────────────────
  return candidates.sort((a, b) => b.total_seen_count - a.total_seen_count);
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UnknownIngredientRow {
  raw_name:          string;
  normalized_name:   string;
  seen_count:        number;
  first_seen_at:     string;
  last_seen_at:      string;
  resolution_status: string;
}

export interface UnknownQueueStats {
  total_entries:   number;
  pending_count:   number;
  resolved_count:  number;
  ignored_count:   number;
  top_seen_count:  number;
}

// ── getTopUnknownIngredients ───────────────────────────────────────────────────

/**
 * Returns the most-seen unresolved ingredients from the Supabase queue.
 *
 * Ordered by: seen_count DESC, last_seen_at DESC (most impactful first).
 *
 * @param limit  Maximum rows to return (default 50, max 200)
 */
export async function getTopUnknownIngredients(
  limit = 50
): Promise<UnknownIngredientRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const { data, error } = await supabase
    .from("ingredient_unknown_queue")
    .select(
      "raw_name, normalized_name, seen_count, first_seen_at, last_seen_at, resolution_status"
    )
    .order("seen_count",   { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[adminIngredientQueueService] getTopUnknownIngredients error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    raw_name:          row.raw_name          ?? "",
    normalized_name:   row.normalized_name   ?? "",
    seen_count:        row.seen_count        ?? 0,
    first_seen_at:     row.first_seen_at     ?? "",
    last_seen_at:      row.last_seen_at      ?? "",
    resolution_status: row.resolution_status ?? "pending",
  }));
}

// ── getUnknownIngredientsByStatus ──────────────────────────────────────────────

/**
 * Returns unknown ingredients filtered by resolution_status.
 *
 * @param status  "pending" | "resolved" | "ignored"
 * @param limit   Max rows (default 50)
 */
export async function getUnknownIngredientsByStatus(
  status: "pending" | "resolved" | "ignored",
  limit = 50
): Promise<UnknownIngredientRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const { data, error } = await supabase
    .from("ingredient_unknown_queue")
    .select(
      "raw_name, normalized_name, seen_count, first_seen_at, last_seen_at, resolution_status"
    )
    .eq("resolution_status", status)
    .order("seen_count",   { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("[adminIngredientQueueService] getUnknownIngredientsByStatus error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    raw_name:          row.raw_name          ?? "",
    normalized_name:   row.normalized_name   ?? "",
    seen_count:        row.seen_count        ?? 0,
    first_seen_at:     row.first_seen_at     ?? "",
    last_seen_at:      row.last_seen_at      ?? "",
    resolution_status: row.resolution_status ?? "pending",
  }));
}

// ── getUnknownQueueStats ───────────────────────────────────────────────────────

/**
 * Returns a lightweight summary of the current queue state.
 * Useful for admin dashboard badges / counters.
 */
export async function getUnknownQueueStats(): Promise<UnknownQueueStats | null> {
  const { data, error } = await supabase
    .from("ingredient_unknown_queue")
    .select("resolution_status, seen_count");

  if (error) {
    console.error("[adminIngredientQueueService] getUnknownQueueStats error:", error.message);
    return null;
  }

  const rows = data ?? [];
  const stats: UnknownQueueStats = {
    total_entries:  rows.length,
    pending_count:  rows.filter((r) => r.resolution_status === "pending").length,
    resolved_count: rows.filter((r) => r.resolution_status === "resolved").length,
    ignored_count:  rows.filter((r) => r.resolution_status === "ignored").length,
    top_seen_count: rows.length > 0
      ? Math.max(...rows.map((r) => r.seen_count ?? 0))
      : 0,
  };

  return stats;
}
