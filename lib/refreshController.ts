/**
 * Controlled Dynamic Refresh Controller
 *
 * Tracks refresh frequency and computes rotation offsets for semi-dynamic content.
 * Module-level state → no React context, no re-renders.
 *
 * Tiers:
 *   STATIC     – concern categories, layout           → never changes
 *   SEMI       – sana özel, öne çıkanlar              → ~20–25% rotation
 *   DYNAMIC    – Günün Notu, makaleler, proactive      → full refresh
 */

// ── Session-level state ────────────────────────────────────────────────────
let _sessionCount = 0;        // refreshes this session (resets on cold start)
let _lastRefreshMs = 0;       // epoch ms of last refresh

// ── Public API ─────────────────────────────────────────────────────────────

export type ChangeIntensity = "low" | "medium" | "high";

/**
 * Record a refresh and return the new session count.
 */
export function recordRefresh(): number {
  _sessionCount++;
  _lastRefreshMs = Date.now();
  return _sessionCount;
}

/**
 * How much variation to allow based on frequency.
 *
 *  high   – last refresh >30 min ago  → more variation allowed
 *  low    – ≥4 quick refreshes        → barely any change
 *  medium – normal usage
 */
export function getChangeIntensity(): ChangeIntensity {
  const msSinceLast = Date.now() - _lastRefreshMs;
  if (_lastRefreshMs === 0) return "medium";
  if (msSinceLast > 30 * 60 * 1000) return "high";   // 30+ min
  if (_sessionCount >= 4) return "low";               // rapid tapping
  return "medium";
}

/**
 * Rotate offset for a list of `length` items.
 *
 * Semi-dynamic: ~20–25% of the list shifts each refresh.
 * The seed drives the shift so each tap gives a different but small window.
 *
 * seed=0 (initial)   → offset=0 (no change)
 * seed=1,2,3…        → 1–3 items shift, wrapping around
 *
 * With "low" intensity, offset is halved to minimize change.
 */
export function getRotateOffset(seed: number, listLength: number, intensity: ChangeIntensity): number {
  if (seed === 0 || listLength <= 2) return 0;

  const maxShift = Math.max(1, Math.floor(listLength * 0.25));

  const raw = (seed * 2) % Math.max(1, maxShift);

  if (intensity === "low") return Math.floor(raw / 2);
  if (intensity === "high") return Math.min(raw + 1, maxShift);
  return raw;
}

/**
 * Rotate an array by `offset` positions (left-shift).
 * Most items stay put; a few scroll into view from the end.
 */
export function rotateList<T>(list: T[], offset: number): T[] {
  if (offset === 0 || list.length === 0) return list;
  const safe = offset % list.length;
  return [...list.slice(safe), ...list.slice(0, safe)];
}
