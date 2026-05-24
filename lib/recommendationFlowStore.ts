/**
 * Recommendation Flow Store (ECZ-4 DÖRTLÜ — Step 1)
 *
 * Lightweight module-level singleton bridging:
 *   profil-eslesme.tsx  → setRecommendation(...)
 *   akilli-rutin.tsx    → getRecommendation(...)
 *
 * Amaç: rankProductsForConcern() iki ekranda iki kez koşmasın. İlk
 * ekranda hesaplanan TieredMatchResults aynı (concern, profileSig)
 * altında 5 dakikalık TTL ile saklanır; ikinci ekran hit alırsa
 * recompute etmez. Miss/expire/sig-mismatch durumunda akilli-rutin
 * kendi mevcut path'iyle (rankProductsForConcern) devam eder.
 *
 * Design notes:
 *   - Zustand/Context değil — productStore.ts pattern'i (modül singleton).
 *   - Yalnızca tier objesi + matched IDs saklanır (Product objeleri DEĞİL,
 *     stale referans riski olmasın diye).
 *   - profileSig: skinType + sorted(specialConditions) + sorted(allergies)
 *     — engine'in gerçekten kullandığı alanlar. Bu üçünden biri
 *     değiştiğinde hit miss'e döner ve fresh recompute olur.
 */

import type { TieredMatchResults } from "./productMatchEngine";
import type {
  UserPreferences,
  SkinConcernKey,
} from "./userPreferences";

const TTL_MS = 5 * 60 * 1000; // 5 dakika

export interface RecommendationIntent {
  concern: SkinConcernKey;
  profileSig: string;
  ts: number;
}

export interface RecommendationResult {
  tiered: TieredMatchResults;
  allMatchedIds: string[];
}

interface StoreEntry {
  intent: RecommendationIntent;
  result: RecommendationResult;
}

let entry: StoreEntry | null = null;

/**
 * Stable scalar signature: aynı profile için aynı string döner. Eksik/null
 * alanlar güvenle "" / [] olarak ele alınır. Engine'in `buildProfileContext`
 * + `evaluateProductWarnings` içinde okuduğu alanlarla hizalı.
 */
export function buildRecommendationProfileSig(
  preferences: UserPreferences | null | undefined
): string {
  if (!preferences) return "skin=|sc=|al=";
  const skin = preferences.skinType ?? "";
  const sc = Array.isArray(preferences.specialConditions)
    ? [...preferences.specialConditions].filter(Boolean).sort().join(",")
    : "";
  const al = Array.isArray(preferences.allergies)
    ? [...preferences.allergies].filter(Boolean).sort().join(",")
    : "";
  return `skin=${skin}|sc=${sc}|al=${al}`;
}

export function setRecommendation(
  intent: RecommendationIntent,
  result: RecommendationResult
): void {
  entry = { intent, result };
}

export function getRecommendation(
  concern: SkinConcernKey,
  profileSig: string
): RecommendationResult | null {
  if (!entry) return null;
  if (entry.intent.concern !== concern) return null;
  if (entry.intent.profileSig !== profileSig) return null;
  if (Date.now() - entry.intent.ts > TTL_MS) {
    entry = null;
    return null;
  }
  return entry.result;
}

export function clearRecommendation(): void {
  entry = null;
}
