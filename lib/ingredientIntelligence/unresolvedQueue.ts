/**
 * unresolvedQueue.ts — ingredientIntelligence
 *
 * Lightweight in-memory queue for ingredients that could not be resolved
 * against the canonical library.
 *
 * When a new product is ingested and contains unknown tokens, they are
 * appended here for later batch review and library expansion.
 *
 * Design:
 * - Singleton in-memory store (module-level Map)
 * - Frequency tracking across multiple products
 * - Export as snapshot for persistence or review
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UnresolvedEntry {
  normalized:    string;
  raw_variants:  string[];
  frequency:     number;
  seen_in:       string[];    // product names / IDs
  first_seen_at: string;      // ISO timestamp
}

// ── In-memory store ───────────────────────────────────────────────────────────

const _queue = new Map<string, UnresolvedEntry>();

// ── Queue API ─────────────────────────────────────────────────────────────────

/**
 * Adds an unresolved token to the queue.
 * @param normalized  Normalized form of the token
 * @param raw         Original raw string from product label
 * @param productId   Product name or ID for tracking
 */
export function enqueueUnresolved(
  normalized: string,
  raw: string,
  productId: string = "unknown"
): void {
  const existing = _queue.get(normalized);

  if (existing) {
    existing.frequency++;
    if (!existing.raw_variants.includes(raw)) {
      existing.raw_variants.push(raw);
    }
    if (!existing.seen_in.includes(productId)) {
      existing.seen_in.push(productId);
    }
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

/**
 * Returns all unresolved entries, sorted by frequency (most frequent first).
 */
export function getUnresolvedQueue(): UnresolvedEntry[] {
  return Array.from(_queue.values()).sort((a, b) => b.frequency - a.frequency);
}

/**
 * Returns only entries with frequency >= minFrequency.
 */
export function getHighFrequencyUnresolved(minFrequency: number = 2): UnresolvedEntry[] {
  return getUnresolvedQueue().filter((e) => e.frequency >= minFrequency);
}

/**
 * Returns the current queue size.
 */
export function getQueueSize(): number {
  return _queue.size;
}

/**
 * Clears the in-memory queue. Use with care.
 */
export function clearQueue(): void {
  _queue.clear();
}

/**
 * Returns a JSON-serializable snapshot of the queue.
 * Use this to persist the queue between sessions.
 */
export function exportQueueSnapshot(): UnresolvedEntry[] {
  return getUnresolvedQueue();
}

/**
 * Hydrates the queue from a previously exported snapshot.
 */
export function importQueueSnapshot(snapshot: UnresolvedEntry[]): void {
  clearQueue();
  for (const entry of snapshot) {
    _queue.set(entry.normalized, { ...entry });
  }
}
