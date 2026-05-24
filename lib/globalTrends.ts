/**
 * globalTrends.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Yerel event verilerinden trend hesaplama.
 *
 * "Global" burada cihaz genelindeki kullanıcı davranışını ifade eder —
 * sunucuya veri gönderilmez, tüm hesaplama cihazda yapılır.
 *
 * Trend skoru:
 *   view_count × 1 + compare_count × 2 + save_count × 4 + rec_click × 2
 *   (Son 30 gün içindeki eventlere ağırlık verilir)
 *
 * Çıktılar:
 *   getTrendingProducts() — "Popüler Seçimler" listesi
 *   getMostComparedPairs() — "En Çok Karşılaştırılanlar" (future use)
 *   getTopSearchTerms()   — trend arama terimleri (future use)
 */

import type { UserEvent } from "./userEvents";
import type { Product } from "@/types/product";

// ── Zaman sınırları ───────────────────────────────────────────────────────────

const DAY_MS  = 1000 * 60 * 60 * 24;
const WEEK_MS = 7 * DAY_MS;

// ── Trend skoru ağırlıkları ───────────────────────────────────────────────────

const TREND_WEIGHTS: Partial<Record<string, number>> = {
  product_view:          1,
  product_click:         2,
  repeat_view:           3,
  tab_view:              1,
  compare_open:          2,
  compare_winner_click:  4,
  favorite_add:          4,
  share_product:         3,
  recommendation_click:  2,
  decision_guide_open:   1,
};

// ── Ürün trend skoru hesapla ──────────────────────────────────────────────────

export interface ProductTrendScore {
  productId:  string;
  trendScore: number;
  viewCount:  number;
  saveCount:  number;
  compareCount: number;
}

/**
 * Event listesinden ürün bazlı trend skorlarını hesapla.
 * Senkron, saf fonksiyon.
 */
export function computeProductTrendScores(
  events:    UserEvent[],
  windowMs?: number,            // Varsayılan: son 30 gün
): ProductTrendScore[] {
  const cutoff = windowMs
    ? Date.now() - windowMs
    : Date.now() - 30 * DAY_MS;

  const recent = events.filter(e => e.timestamp >= cutoff && e.productId);

  const scoreMap: Record<string, ProductTrendScore> = {};

  for (const e of recent) {
    const pid = e.productId!;

    if (!scoreMap[pid]) {
      scoreMap[pid] = { productId: pid, trendScore: 0, viewCount: 0, saveCount: 0, compareCount: 0 };
    }

    const s = scoreMap[pid];
    const w = TREND_WEIGHTS[e.eventType] ?? 0;

    // Son 7 gün 2× ağırlık — daha taze sinyaller güçlü
    const recency = e.timestamp >= Date.now() - WEEK_MS ? 2 : 1;
    s.trendScore += w * recency;

    if (e.eventType === "product_view" || e.eventType === "product_click") s.viewCount++;
    if (e.eventType === "favorite_add") s.saveCount++;
    if (e.eventType === "compare_open" || e.eventType === "compare_winner_click") s.compareCount++;
  }

  return Object.values(scoreMap).sort((a, b) => b.trendScore - a.trendScore);
}

/**
 * Trend skorlarına göre sıralanmış ürün listesi döndür.
 * "Popüler Seçimler" bölümü için kullanılır.
 */
export function getTrendingProducts(
  allProducts: Product[],
  events:      UserEvent[],
  options?: {
    limit?:    number;
    windowMs?: number;
    excludeIds?: Set<string>;
  },
): Product[] {
  const {
    limit      = 6,
    windowMs,
    excludeIds = new Set<string>(),
  } = options ?? {};

  // ── Ecz4 — Cold-Start Fallback (daily-rotation aware) ────────────────────
  // Yeni kullanıcılarda (event log boş) veya hiçbir event skor üretmediğinde
  // "Popüler Seçimler" boş kalmasın diye dermo_score güçlü havuzdan günlük
  // deterministik rotasyon ile doldurulur. Event-driven path birebir korunur
  // — fallback sadece veri olmayan iki dış uçta devreye girer. excludeIds
  // yine onurlanır.
  //
  // Strateji:
  //   1) dermo_score numeric olan + excludeIds dışındaki ürünleri al, skora
  //      göre azalan sırala
  //   2) ≥70 puanlı güçlü havuz limit'i karşılıyorsa onu kullan; yoksa tüm
  //      scored havuza düş (kalite koruyucu fallback'in fallback'i)
  //   3) Session seed (10dk bucket) ile rotate → aynı gün içinde uygulamayı
  //      kapatıp açma / Home reload arasında liste tazelenir, ama 10 dk
  //      içinde sabit kalır (jitter önlenir, hesap stabil)
  const getSessionSeed = (): number => {
    return Math.floor(Date.now() / (1000 * 60 * 10));
  };

  const rotate = <T,>(arr: T[], seed: number): T[] => {
    if (arr.length === 0) return arr;
    const offset = ((seed % arr.length) + arr.length) % arr.length;
    return [...arr.slice(offset), ...arr.slice(0, offset)];
  };

  const dermoFallback = (): Product[] => {
    const scored = allProducts
      .filter(p => !excludeIds.has(String(p.id)) && typeof (p as any).dermo_score === "number")
      .sort((a, b) => ((b as any).dermo_score ?? 0) - ((a as any).dermo_score ?? 0));

    const strongPool = scored.filter(p => ((p as any).dermo_score ?? 0) >= 70);
    const pool = strongPool.length >= limit ? strongPool : scored;

    return rotate(pool, getSessionSeed()).slice(0, limit);
  };

  if (events.length === 0) return dermoFallback();

  const scores = computeProductTrendScores(events, windowMs);

  if (scores.length === 0) return dermoFallback();

  // Ürün ID → ürün haritası
  const productMap = new Map<string, Product>();
  for (const p of allProducts) {
    productMap.set(String(p.id), p);
  }

  const out: Product[] = [];

  for (const s of scores) {
    if (excludeIds.has(s.productId)) continue;
    const p = productMap.get(s.productId);
    if (!p) continue;
    if (s.trendScore < 1) continue; // Minimum 1 puan
    out.push(p);
    if (out.length >= limit) break;
  }

  return out;
}

// ── En çok karşılaştırılan çiftler ───────────────────────────────────────────

export interface ComparedPair {
  productAId: string;
  productBId: string;
  count:      number;
}

/**
 * compare_open + compare_winner_click eventlerinden çift skoru hesapla.
 * Çiftleri bulmak için productId ve yakın zaman damgası kullanılır.
 * (Exact pair tracking olmadığı için yaklaşık bir yöntem)
 */
export function getMostComparedPairs(events: UserEvent[]): ComparedPair[] {
  const compareEvents = events.filter(
    e => (e.eventType === "compare_open" || e.eventType === "compare_winner_click") && e.productId,
  );

  // Yakın zamanda (5dk içinde) yapılan compare eventlerini çift say
  const WINDOW = 5 * 60 * 1000;
  const pairCounts: Record<string, number> = {};

  for (let i = 0; i < compareEvents.length; i++) {
    for (let j = i + 1; j < compareEvents.length; j++) {
      const a = compareEvents[i];
      const b = compareEvents[j];
      if (Math.abs(a.timestamp - b.timestamp) > WINDOW) break;
      if (a.productId === b.productId) continue;
      const key = [a.productId!, b.productId!].sort().join("::");
      pairCounts[key] = (pairCounts[key] ?? 0) + 1;
    }
  }

  return Object.entries(pairCounts)
    .map(([key, count]) => {
      const [productAId, productBId] = key.split("::");
      return { productAId, productBId, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ── En çok aranan terimler ────────────────────────────────────────────────────

export interface TopSearchTerm {
  query: string;
  count: number;
}

/**
 * search_query eventlerinden en çok aranan terimleri hesapla.
 */
export function getTopSearchTerms(events: UserEvent[], limit = 10): TopSearchTerm[] {
  const counts: Record<string, number> = {};

  for (const e of events) {
    if (e.eventType !== "search_query" || !e.query) continue;
    const q = e.query.toLowerCase().trim();
    if (q.length < 2) continue;
    counts[q] = (counts[q] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── Trend etiketi ─────────────────────────────────────────────────────────────

/**
 * Trend skoruna göre insan okunur etiket döndür.
 * Kart üzerinde gösterilebilir.
 */
export function getTrendLabel(score: ProductTrendScore): string | null {
  if (score.saveCount >= 3)    return "Sık favorilenen";
  if (score.compareCount >= 3) return "Sık karşılaştırılan";
  if (score.viewCount >= 5)    return "Çok incelenen";
  return null;
}
