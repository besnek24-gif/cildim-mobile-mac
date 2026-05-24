/**
 * autocomplete.ts — v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Gerçek zamanlı otomatik tamamlama motoru.
 *
 * Eşleştirme katmanları (skorlama önceliğine göre):
 *  1. norm.startsWith(q)          → 100   "cera" → "CeraVe"
 *  2. compact.startsWith(qc)      →  95   "lar"  → "larocheposay" → La Roche-Posay
 *  3. norm.includes(q)            →  80   normal substring
 *  4. compact.includes(qc)        →  75   bitişik yazım içerme
 *  5. token match (çok kelimeli)  →  65
 *  6. Fuzzy Levenshtein (≥4 harf) →  ≥35  "alder" → "alldermo"
 *
 * Güvenlik: hata atarsa [] döndürür — mevcut arama etkilenmez.
 */

import type { Product } from "@/types/product";

// ── TR Normalizasyon ─────────────────────────────────────────────────────────

const TR: Record<string, string> = {
  ğ: "g", Ğ: "g",
  ü: "u", Ü: "u",
  ş: "s", Ş: "s",
  ı: "i", İ: "i",
  ö: "o", Ö: "o",
  ç: "c", Ç: "c",
};

function norm(s: string): string {
  return s
    .split("")
    .map((c) => TR[c] ?? c)
    .join("")
    .toLowerCase()
    .trim();
}

/** Boşluk, tire, noktalama sil → "La Roche-Posay" → "larocheposay" */
function compact(s: string): string {
  return norm(s).replace(/[\s\-_.,()/:;'"+*&%]+/g, "");
}

// ── Levenshtein Benzerliği ───────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const val =
        a[i - 1] === b[j - 1]
          ? row[j - 1]
          : 1 + Math.min(row[j - 1], row[j], prev);
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }
  return row[n];
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 100;
  return Math.round((1 - levenshtein(a, b) / max) * 100);
}

// ── Tip tanımları ────────────────────────────────────────────────────────────

export type SuggestionType = "brand" | "product" | "category" | "subcategory";

export interface AutocompleteSuggestion {
  type: SuggestionType;
  text: string;
}

// Marka önce, ürün ikinci, kategori/sub en son
const TYPE_PRIORITY: Record<SuggestionType, number> = {
  brand: 4,
  product: 3,
  category: 2,
  subcategory: 1,
};

// ── Temel Skor Fonksiyonu ────────────────────────────────────────────────────

function scoreText(qNorm: string, qCompact: string, text: string): number {
  const tn = norm(text);
  const tc = compact(text);

  // 1. Normalize edilmiş text doğrudan başlıyorsa
  if (tn.startsWith(qNorm)) return 100;

  // 2. Compact text başlıyorsa (boşluksuz yazım, "lar" → "larocheposay")
  if (qCompact.length >= 2 && tc.startsWith(qCompact)) return 95;

  // 3. Normalize edilmiş içerme
  if (tn.includes(qNorm)) return 80;

  // 4. Compact içerme
  if (qCompact.length >= 3 && tc.includes(qCompact)) return 75;

  // 5. Token match (birden fazla kelimeli sorgu)
  if (qNorm.includes(" ")) {
    const tokens = qNorm.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2 && tokens.every((t) => tn.includes(t))) return 65;
  }

  // 6. Fuzzy fallback — yalnızca 4+ harf sorgularda, pahalı hesaplama değil
  if (qCompact.length >= 4) {
    const simC = similarity(qCompact, tc);
    const simN = similarity(qNorm, tn);
    const best = Math.max(simC, simN);
    if (best >= 58) return Math.round(best * 0.75); // 58% → ~43 puan, 75% → ~56 puan
  }

  return 0;
}

// ── Ana Fonksiyon ────────────────────────────────────────────────────────────

export function getAutocompleteSuggestions(
  query: string,
  products: Product[],
): AutocompleteSuggestion[] {
  try {
    const q = query?.trim() ?? "";
    if (q.length < 2) return [];

    const qNorm    = norm(q);
    const qCompact = compact(q);

    // Katalogdan benzersiz değerleri topla
    const brands     = new Set<string>();
    const categories = new Set<string>();
    const subcats    = new Set<string>();
    const names: string[] = [];

    for (const p of products) {
      if (p.brand)              brands.add(p.brand);
      if (p.category)           categories.add(p.category);
      if ((p as any).subcategory) subcats.add((p as any).subcategory);
      if (p.name)               names.push(p.name);
    }

    type Scored = { s: AutocompleteSuggestion; score: number; priority: number };
    const scored: Scored[] = [];

    const add = (type: SuggestionType, text: string) => {
      const score = scoreText(qNorm, qCompact, text);
      if (score > 0) {
        scored.push({ s: { type, text }, score, priority: TYPE_PRIORITY[type] });
      }
    };

    // Markalar ve kategoriler önce (daha az item, daha hızlı)
    brands.forEach((b) => add("brand", b));
    categories.forEach((c) => add("category", c));
    subcats.forEach((s) => add("subcategory", s));
    names.forEach((n) => add("product", n));

    // Skora göre azalan, aynı skorda tip önceliğine göre
    scored.sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : b.priority - a.priority,
    );

    // Duplicate text metinlerini filtrele, top 5 döndür
    const seen   = new Set<string>();
    const result: AutocompleteSuggestion[] = [];

    for (const { s } of scored) {
      const key = compact(s.text);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s);
        if (result.length >= 5) break;
      }
    }

    return result;
  } catch {
    // Sessizce başarısız — mevcut arama bu hatayla etkilenmez
    return [];
  }
}
