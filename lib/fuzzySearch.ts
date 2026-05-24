/**
 * fuzzySearch.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Evrensel, yazım hatası toleranslı akıllı arama motoru.
 *
 * Katmanlar (öncelik sırasıyla):
 *  A. Exact normalized contains (brand / name / full searchable text)
 *  B. Token match — tüm kelimeler eşleşmeli
 *  C. Compact match — bitişik yazım ("larocheposay", "ceravenemlendirici")
 *  D. Fuzzy match — Levenshtein benzerliği (yalnızca zayıf sonuçta)
 *
 * Öneriler:
 *  · findSuggestions(query, products) → up to 3 SearchSuggestion[]
 *  · findSuggestion(query, products)  → SearchSuggestion | null (geriye dönük uyumluluk)
 *
 * Filtreleme:
 *  · smartFilter(query, products)     → Product[] (katmanlı, puanlı)
 *  · filterByQuery(query, products)   → Product[] (eski exact-match, geriye dönük)
 */

import type { Product } from "@/types/product";

// ─── Türkçe Karakter Normalizasyonu ─────────────────────────────────────────

const TR_MAP: Record<string, string> = {
  ğ: "g", Ğ: "g",
  ü: "u", Ü: "u",
  ş: "s", Ş: "s",
  ı: "i", İ: "i",
  ö: "o", Ö: "o",
  ç: "c", Ç: "c",
};

/** Normalize: küçük harf + TR karakterler + tire/boşluk birleştir */
export function normTR(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (c) => TR_MAP[c] ?? c)
    .replace(/[-\s]+/g, " ")
    .trim();
}

/** Compact: TÜM boşluk ve noktalama kaldırılır — bitişik yazım eşleşmesi için */
export function normCompact(s: string): string {
  return normTR(s).replace(/[\s\-_.,:;'"!?()/\\]+/g, "");
}

// ─── Levenshtein Mesafesi ────────────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

/** 0-100 benzerlik skoru */
function similarity(a: string, b: string): number {
  const na = normTR(a);
  const nb = normTR(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 85;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return Math.max(0, Math.round((1 - dist / maxLen) * 100));
}

// ─── Aranabilir Metin İndeksi ────────────────────────────────────────────────

/**
 * Ürünün tüm aranabilir alanlarını birleştirir.
 * Marka, isim, kategori, alt kategori, açıklama, kaygılar, etiketler.
 * Herhangi bir ürün için çalışır — sabit listelerden bağımsız.
 */
export function buildSearchableText(p: Product): string {
  const parts: string[] = [
    (p as any).brand         ?? "",
    p.name                   ?? "",
    (p as any).category      ?? "",
    (p as any).subcategory   ?? "",
    (p as any).short_description ?? "",
  ];
  const concerns = (p as any).concerns;
  if (Array.isArray(concerns)) parts.push(concerns.join(" "));
  const tags = (p as any).tags;
  if (Array.isArray(tags)) parts.push(tags.join(" "));
  return parts.filter(Boolean).join(" ");
}

// ─── Marka Alias Haritası (yazım hatası hızlandırıcı) ────────────────────────
// Fuzzy motor katalogdan öğrenir — bu harita sadece yaygın kısaltmalar içindir.

const BRAND_ALIASES: Record<string, string[]> = {
  "la roche-posay": ["laroche", "la roche", "laros", "laroche posay", "larocheposay"],
  "bioderma":       ["biyoderma", "bioder", "bioderm"],
  "cerave":         ["ceravee", "serave", "cerav"],
  "vichy":          ["visi", "vicy", "vishi"],
  "avene":          ["avenee", "avenn", "aven"],
  "the ordinary":   ["ordinary", "theordinary", "ordi nary"],
  "bioxcin":        ["bioksin", "bioxin", "biyoksin"],
  "alldermo":       ["aldermo", "all dermo", "allderm"],
  "sebamed":        ["sebamedd", "seba med"],
  "mustela":        ["mustella", "mustel"],
  "nivea":          ["niveaa", "nivya"],
  "loreal":         ["loreyal", "loryal", "l oreal"],
  "garnier":        ["garniyer", "garnie"],
  "neutrogena":     ["nutrogena", "neutrojena", "neutro"],
  "ducray":         ["dukrey", "dukray"],
  "uriage":         ["uriagee", "uryaj"],
  "cosrx":          ["cos r x", "kosrx"],
  "round lab":      ["roundlab", "round labb"],
  "dr. jart":       ["dr jart", "drjart"],
  "skin1004":       ["skin 1004", "skin thousand"],
  "etude house":    ["etude", "etudehouse"],
  "some by mi":     ["somebymi", "some bymi"],
  "beauty of joseon": ["boj", "joseon", "beauty joseon"],
  "solante":        ["solantee", "solant"],
  "heliocare":      ["helio care", "heliokare"],
  "isdin":          ["isdinn", "is din"],
  "svr":            ["esvear"],
};

const ALIAS_LOOKUP: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(normTR(alias), canonical);
    ALIAS_LOOKUP.set(normCompact(alias), canonical);
  }
  ALIAS_LOOKUP.set(normTR(canonical), canonical);
  ALIAS_LOOKUP.set(normCompact(canonical), canonical);
}

// ─── Öneri Tipi ─────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  display:        string;
  correctedQuery: string;
  confidence:     number;
  source:         "alias" | "fuzzy";
}

// ─── Akıllı Filtre — Katmanlı Eşleşme ───────────────────────────────────────

/**
 * Tüm ürünleri katmanlı stratejiyle filtreler ve puanlar.
 * Exact sonuç yoksa fuzzy'e geçer. Tüm katalog için çalışır.
 */
export function smartFilter(query: string, products: Product[]): Product[] {
  const raw = query.trim();
  if (!raw) return products;

  const q        = normTR(raw);
  const qCompact = normCompact(raw);
  const qTokens  = q.split(/\s+/).filter((t) => t.length >= 2);

  const scored: Array<{ product: Product; score: number }> = [];

  for (const p of products) {
    const brand      = (p as any).brand ?? "";
    const name       = p.name ?? "";
    const brandNorm  = normTR(brand);
    const nameNorm   = normTR(name);
    const fullText   = normTR(buildSearchableText(p));
    const fullCompact = normCompact(buildSearchableText(p));

    let score = 0;

    // A. Exact normalized contains — yüksek ağırlık
    if (brandNorm === q || nameNorm === q) {
      score = 110;
    } else if (brandNorm.startsWith(q) || nameNorm.startsWith(q)) {
      score = Math.max(score, 105);
    } else if (brandNorm.includes(q) || nameNorm.includes(q)) {
      score = Math.max(score, 100);
    } else if (fullText.includes(q)) {
      score = Math.max(score, 80);
    }

    // B. Token match — her kelime ayrı aranır
    if (score < 80 && qTokens.length >= 2) {
      const allMatch = qTokens.every((t) => fullText.includes(t));
      if (allMatch) score = Math.max(score, 75);
      else {
        const matchCount = qTokens.filter((t) => fullText.includes(t)).length;
        if (matchCount > 0) score = Math.max(score, Math.round((matchCount / qTokens.length) * 60));
      }
    }

    // C. Compact match — bitişik yazım ("larocheposay", "ceravenemlendirici")
    if (score < 60 && qCompact.length >= 4) {
      if (fullCompact.includes(qCompact)) score = Math.max(score, 70);
    }

    // D. Fuzzy — yalnızca zayıf sonuçta, sadece brand+name üzerinde
    if (score < 50 && q.length >= 4) {
      const bSim = similarity(q, brandNorm);
      const nSim = similarity(q, nameNorm);
      const best = Math.max(bSim, nSim);
      if (best >= 72) score = Math.max(score, Math.round(best * 0.62));
    }

    if (score > 0) scored.push({ product: p, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.product);
}

/** Mevcut exact-match (geriye dönük uyumluluk) */
export function filterByQuery(query: string, products: Product[]): Product[] {
  if (!query.trim()) return products;
  const q = normTR(query);
  return products.filter((p) =>
    normTR(p.name            ?? "").includes(q) ||
    normTR((p as any).brand  ?? "").includes(q) ||
    normTR((p as any).category ?? "").includes(q) ||
    normTR((p as any).barcode ?? "").includes(q),
  );
}

// ─── Öneri Motoru — Top 3 ────────────────────────────────────────────────────

/**
 * Sorgu için en iyi 3 düzeltilmiş öneriyi döner.
 * Alias haritası → katalogdaki markalar → katalogdaki ürün adları sırasıyla.
 */
export function findSuggestions(
  query: string,
  products: Product[],
): SearchSuggestion[] {
  const raw = query.trim();
  if (raw.length < 2) return [];

  const normed  = normTR(raw);
  const compact = normCompact(raw);
  const results: SearchSuggestion[] = [];
  const seen    = new Set<string>();

  const add = (s: SearchSuggestion) => {
    const key = normTR(s.correctedQuery);
    if (!seen.has(key) && key !== normed && results.length < 3) {
      seen.add(key);
      results.push(s);
    }
  };

  // Layer 1 — Alias exact
  const aliasHit = ALIAS_LOOKUP.get(normed) ?? ALIAS_LOOKUP.get(compact);
  if (aliasHit) {
    add({ display: aliasHit, correctedQuery: aliasHit, confidence: 96, source: "alias" });
  }

  // Layer 2 — Alias partial (normed içerme)
  for (const [alias, canonical] of ALIAS_LOOKUP.entries()) {
    if (alias.length >= 3 && normed.includes(alias)) {
      add({ display: canonical, correctedQuery: canonical, confidence: 90, source: "alias" });
    }
  }

  // Layer 3 — Fuzzy brand match (katalogdan dinamik)
  const brands = [...new Set(
    products.map((p) => (p as any).brand ?? "").filter((b: string) => b.length > 1),
  )] as string[];

  const brandHits: Array<{ brand: string; score: number }> = [];
  for (const brand of brands) {
    const nb = normTR(brand);
    const cb = normCompact(brand);
    let score = similarity(normed, nb);
    if (cb === compact) score = Math.max(score, 92);
    if (nb.startsWith(normed.slice(0, Math.min(4, normed.length)))) score += 5;
    if (normed.startsWith(nb.slice(0, Math.min(4, nb.length)))) score += 3;
    if (score >= 68 && nb !== normed) brandHits.push({ brand, score });
  }
  brandHits.sort((a, b) => b.score - a.score);
  for (const { brand, score } of brandHits.slice(0, 2)) {
    add({ display: brand, correctedQuery: brand, confidence: score, source: "fuzzy" });
  }

  // Layer 4 — Fuzzy product name (katalogdan dinamik)
  if (results.length < 3) {
    const nameHits: Array<{ name: string; score: number }> = [];
    for (const p of products) {
      const name = p.name ?? "";
      if (!name) continue;
      const nn = normTR(name);
      let score = similarity(normed, nn);
      if (nn.startsWith(normed.slice(0, Math.min(5, normed.length)))) score += 8;
      if (score >= 74 && nn !== normed) nameHits.push({ name, score });
    }
    nameHits.sort((a, b) => b.score - a.score);
    for (const { name, score } of nameHits.slice(0, 2)) {
      add({ display: name, correctedQuery: name, confidence: score, source: "fuzzy" });
    }
  }

  return results;
}

/** Geriye dönük uyumluluk — ilk öneriyi döner */
export function findSuggestion(
  query: string,
  products: Product[],
): SearchSuggestion | null {
  return findSuggestions(query, products)[0] ?? null;
}
