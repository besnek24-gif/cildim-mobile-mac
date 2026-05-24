/**
 * recommendations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Akıllı ürün öneri motoru — "eczacı gibi düşün"
 *
 * Puanlama faktörleri:
 *  1. Kategori / alt-kategori eşleşmesi
 *  2. Dermatolojik skor karşılaştırması   → better_score tipi
 *  3. Segment basamağı (bütçe merdiveni)  → budget_up / budget_down tipi
 *  4. Kullanım amacı metin örtüşmesi      → similar_func tipi
 *  5. İçerik rozeti örtüşmesi (vegan vb.) → bonus
 *  6. Cilt tipi örtüşmesi                 → bonus
 *  7. Endişe eşleşmesi (cross-category)   → concern tipi
 *
 * Öneri tipleri (öncelik sırası):
 *  better_score  — Aynı kategoride belirgin şekilde daha yüksek skor
 *  budget_up     — Bir üst segment alternatif (daha güçlü formül)
 *  budget_down   — Daha ekonomik aynı-kategori alternatif
 *  concern       — Aynı endişeye yönelik farklı kategori (cross-category)
 *  similar_func  — Benzer işlev / yüksek örtüşme, aynı kategori
 *
 * Kurallar:
 *  - Mevcut ürün çıktıya dahil edilmez
 *  - excludeIds ile zaten gösterilen ürünler dışlanır (similar section)
 *  - Her tipten maksimum 2 ürün — çeşitlilik sağlanır
 *  - Minimum relevance eşiği: 40 puan
 *  - Döndürülen maksimum: limit (default 6)
 */

import { normalizeProductData, type NormalizedProduct } from "./normalizeProduct";
import type { Product } from "@/types/product";
import { getFinalProductScore } from "@/lib/getFinalScore";

// ── Segment sıralaması ────────────────────────────────────────────────────────

const SEG_RANK: Record<string, number> = {
  ekonomik:    0,
  profesyonel: 1,
  "seçkin":    2,
};

// ── Öneri tipleri ─────────────────────────────────────────────────────────────

export type RecommendationType =
  | "better_score"
  | "budget_up"
  | "budget_down"
  | "concern"
  | "similar_func";

// ── Çıkış tipi ────────────────────────────────────────────────────────────────

export interface RecommendationResult {
  product:     Product;
  normalized:  NormalizedProduct;
  relevance:   number;
  type:        RecommendationType;
  reasonLabel: string;
  reasonIcon:  string;
  reasonBg:    string;
  reasonColor: string;
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function normCat(s: string | null): string {
  return (s ?? "").toLowerCase().trim();
}

function wordOverlap(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const hits  = b.toLowerCase().split(/\W+/).filter(w => w.length > 3 && setA.has(w)).length;
  return Math.min(hits * 8, 24);
}

function arrayOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a.map(s => s.toLowerCase()));
  return b.filter(s => setA.has(s.toLowerCase())).length;
}

function badgeBonus(a: NormalizedProduct, b: NormalizedProduct): number {
  const aKeys = a.quickBadges.filter(bd => bd.present).map(bd => bd.key);
  const bKeys = new Set(b.quickBadges.filter(bd => bd.present).map(bd => bd.key));
  return Math.min(aKeys.filter(k => bKeys.has(k)).length * 6, 12);
}

// ── Neden etiketi ──────────────────────────────────────────────────────────────

function resolveReason(
  type: RecommendationType,
  segRankDiff: number,
  scoreDiff: number,
): { reasonLabel: string; reasonIcon: string; reasonBg: string; reasonColor: string } {
  switch (type) {
    case "better_score":
      return {
        reasonLabel: `+${scoreDiff} puan daha iyi`,
        reasonIcon:  "trending-up",
        reasonBg:    "#F0FDF4",
        reasonColor: "#15803D",
      };
    case "budget_up":
      return {
        reasonLabel: segRankDiff > 1 ? "Üst segment" : "Daha güçlü formül",
        reasonIcon:  "chevrons-up",
        reasonBg:    "#F5F3FF",
        reasonColor: "#6D28D9",
      };
    case "budget_down":
      return {
        reasonLabel: segRankDiff < -1 ? "Çok daha ekonomik" : "Daha uygun fiyat",
        reasonIcon:  "chevrons-down",
        reasonBg:    "#F0FDF4",
        reasonColor: "#15803D",
      };
    case "concern":
      return {
        reasonLabel: "Aynı endişe için",
        reasonIcon:  "target",
        reasonBg:    "#FFF7ED",
        reasonColor: "#C2410C",
      };
    case "similar_func":
    default:
      return {
        reasonLabel: "Benzer işlev",
        reasonIcon:  "layers",
        reasonBg:    "#EFF6FF",
        reasonColor: "#1D4ED8",
      };
  }
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────

export function getRecommendedProducts(
  current:    NormalizedProduct,
  allProducts: Product[],
  excludeIds:  Set<string> = new Set(),
  limit = 6,
): RecommendationResult[] {
  const curCat   = normCat(current.category);
  const curRank  = SEG_RANK[current.segment ?? ""] ?? -1;
  const curScore = getFinalProductScore(current._raw) ?? current.score ?? 0;

  const raw: RecommendationResult[] = [];

  for (const p of allProducts) {
    const candId = String(p.id);
    if (candId === current.id)    continue;
    if (excludeIds.has(candId))   continue;

    const norm         = normalizeProductData(p);
    const candCat      = normCat(norm.category);
    const candRank     = SEG_RANK[norm.segment ?? ""] ?? -1;
    const candScore    = getFinalProductScore(p) ?? norm.score ?? 0;
    const sameCategory = curCat !== "" && candCat !== "" && curCat === candCat;
    const scoreDiff    = candScore - curScore;
    const segRankDiff  = candRank - curRank;
    const concernHits  = arrayOverlap(current.concerns, norm.concerns);

    // ── Relevance hesaplama ────────────────────────────────────────
    let relevance = 0;

    if (sameCategory) {
      relevance += 50;
      if (
        current.subcategory && norm.subcategory &&
        current.subcategory.toLowerCase() === norm.subcategory.toLowerCase()
      ) relevance += 15;
    }

    relevance += wordOverlap(current.shortBenefit, norm.shortBenefit);
    relevance += badgeBonus(current, norm);
    relevance += concernHits * 18;
    relevance += arrayOverlap(current.skinTypes, norm.skinTypes) * 8;

    if (scoreDiff >= 10) relevance += 15;
    if (scoreDiff >= 20) relevance += 10;

    // Zayıf aday → atla
    if (relevance < 40) continue;

    // ── Tip belirleme (öncelik sırasıyla) ─────────────────────────
    let type: RecommendationType | null = null;

    if (sameCategory && scoreDiff >= 12 && curScore < 82) {
      type = "better_score";
    } else if (sameCategory && curRank !== -1 && candRank !== -1 && segRankDiff > 0) {
      type = "budget_up";
    } else if (sameCategory && curRank !== -1 && candRank !== -1 && segRankDiff < 0) {
      type = "budget_down";
    } else if (concernHits > 0 && !sameCategory) {
      type = "concern";
    } else if (sameCategory) {
      type = "similar_func";
    } else {
      continue; // Kategori yoksa endişe eşleşmesi gerekir
    }

    const reason = resolveReason(type, segRankDiff, Math.round(scoreDiff));

    raw.push({ product: p, normalized: norm, relevance, type, ...reason });
  }

  // ── Sıralama: tip önceliği, sonra relevance DESC ──────────────────────────
  const TYPE_PRIORITY: Record<RecommendationType, number> = {
    better_score: 0,
    budget_up:    1,
    budget_down:  2,
    concern:      3,
    similar_func: 4,
  };

  raw.sort((a, b) => {
    if (TYPE_PRIORITY[a.type] !== TYPE_PRIORITY[b.type])
      return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
    return b.relevance - a.relevance;
  });

  // Her tipten max 2 — çeşitlilik
  const typeCount: Partial<Record<RecommendationType, number>> = {};
  const out: RecommendationResult[] = [];
  for (const r of raw) {
    const n = typeCount[r.type] ?? 0;
    if (n >= 2) continue;
    typeCount[r.type] = n + 1;
    out.push(r);
    if (out.length >= limit) break;
  }

  return out;
}
