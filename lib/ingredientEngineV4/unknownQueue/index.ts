/**
 * unknownQueue/index.ts — ingredientEngineV4
 *
 * Isolated in-memory queue for V4 unresolved ingredient tokens.
 *
 * Design:
 *   - Module-level singleton Map (no React, no UI, no legacy deps)
 *   - Frequency tracking across multiple product analyses
 *   - Exportable snapshot for future persistence
 *   - Fully independent from V3 unresolvedQueue
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface V4UnresolvedEntry {
  normalized:    string;
  raw_variants:  string[];
  frequency:     number;
  seen_in:       string[];
  first_seen_at: string;
}

// ── In-memory store ────────────────────────────────────────────────────────────

const _queue = new Map<string, V4UnresolvedEntry>();

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * Records one unresolved token sighting.
 * Safe to call on every analysis — deduplicates automatically.
 */
export function enqueueV4Unknown(
  normalized: string,
  raw:        string,
  productId:  string = "unknown"
): void {
  const existing = _queue.get(normalized);
  if (existing) {
    existing.frequency++;
    if (!existing.raw_variants.includes(raw))    existing.raw_variants.push(raw);
    if (!existing.seen_in.includes(productId))   existing.seen_in.push(productId);
  } else {
    _queue.set(normalized, {
      normalized,
      raw_variants:  [raw],
      frequency:     1,
      seen_in:       [productId],
      first_seen_at: new Date().toISOString(),
    });
  }
}

/** Returns all entries sorted by frequency descending. */
export function getV4UnresolvedQueue(): V4UnresolvedEntry[] {
  return Array.from(_queue.values()).sort((a, b) => b.frequency - a.frequency);
}

/** Returns entries with frequency >= minFrequency. */
export function getV4HighFrequencyUnresolved(minFreq = 2): V4UnresolvedEntry[] {
  return getV4UnresolvedQueue().filter((e) => e.frequency >= minFreq);
}

/** Current queue size. */
export function getV4QueueSize(): number {
  return _queue.size;
}

/** Clears the in-memory queue. */
export function clearV4Queue(): void {
  _queue.clear();
}

/** JSON-serializable snapshot of the current queue. */
export function exportV4QueueSnapshot(): V4UnresolvedEntry[] {
  return getV4UnresolvedQueue();
}

/** Hydrates queue from a previously exported snapshot (replaces current state). */
export function importV4QueueSnapshot(snapshot: V4UnresolvedEntry[]): void {
  clearV4Queue();
  for (const entry of snapshot) {
    _queue.set(entry.normalized, { ...entry });
  }
}

/** Merges a snapshot into the existing queue (additive). */
export function mergeV4QueueSnapshot(snapshot: V4UnresolvedEntry[]): void {
  for (const entry of snapshot) {
    const existing = _queue.get(entry.normalized);
    if (existing) {
      existing.frequency += entry.frequency;
      for (const v of entry.raw_variants) {
        if (!existing.raw_variants.includes(v)) existing.raw_variants.push(v);
      }
      for (const s of entry.seen_in) {
        if (!existing.seen_in.includes(s)) existing.seen_in.push(s);
      }
    } else {
      _queue.set(entry.normalized, { ...entry });
    }
  }
}
