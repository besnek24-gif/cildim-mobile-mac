/**
 * CiltBakımım — Akıllı Arama Motoru
 *
 * Üç arama modu:
 *  1. CONCERN  → endişe/sorun bazlı, kategoriye göre ürün filtrele
 *  2. PRODUCT  → isim / marka / barkod / içerik bazlı ürün ara
 *  3. FALLBACK → hiç eşleşme yok → en yakın endişeleri öner
 *
 * Kullanım: runSmartSearch(query, allProducts) → SmartSearchResult
 */

import type { Product } from "@/types/product";
import {
  searchConcern,
  normalizeTR,
  type SearchResult as ConcernEngineResult,
} from "./concernSearchEngine";
import {
  CONCERN_DICTIONARY,
  type ConcernEntry,
  getConcernEntryByFlowId,
  matchConcernEntry,
  getTopConcerns,
} from "./concernDictionary";

// ─── Sonuç türleri ────────────────────────────────────────────────────────────

export type SearchType = "product" | "concern" | "fallback";

export interface SmartSearchResult {
  type: SearchType;
  /** Eşleşen endişe (concern tipinde) */
  concern?: ConcernEntry;
  /** Endişe motor güveni (0-100) */
  concernConfidence?: number;
  /** Filtrelenmiş / sıralanmış ürünler */
  products: Product[];
  /** Fallback durumunda önerilen endişeler */
  fallbackConcerns?: ConcernEntry[];
  /** Orijinal sorgu */
  query: string;
}

// ─── Türkçe karakter güvenli normalize ───────────────────────────────────────

function n(s: string): string {
  return normalizeTR(s ?? "");
}

// ─── Ürün metin araması (sıralı) ─────────────────────────────────────────────

interface ScoredProduct {
  product: Product;
  score: number;
}

function textScore(product: Product, q: string): number {
  const pName  = n(product.name  ?? product.isim   ?? "");
  const pBrand = n(product.brand ?? product.marka  ?? "");
  const pCat   = n(product.category ?? product.kategori ?? "");
  const pSub   = n(product.subcategory ?? "");
  const pDesc  = n(product.description ?? product.short_description ?? product.aciklama ?? "");
  const pBarc  = (product.barcode ?? "").trim();

  // Barkod tam eşleşme
  if (pBarc === q) return 100;

  // İsim tam eşleşme
  if (pName === q) return 99;

  // İsim başlangıcı
  if (pName.startsWith(q) && q.length >= 3) return 92;

  // Marka tam
  if (pBrand === q) return 88;

  // İsim içeriyor
  if (pName.includes(q) && q.length >= 2) return 82;

  // Marka başlangıcı
  if (pBrand.startsWith(q) && q.length >= 3) return 78;

  // Marka içeriyor
  if (pBrand.includes(q) && q.length >= 3) return 72;

  // Kategori tam
  if (pCat === q) return 68;

  // Kategori içeriyor
  if (pCat.includes(q) && q.length >= 3) return 62;

  // Alt kategori
  if (pSub.includes(q) && q.length >= 3) return 58;

  // Açıklama
  if (pDesc.includes(q) && q.length >= 4) return 45;

  // İçerikler
  const ingredients = product.ingredients ?? product.active_ingredients ?? [];
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) {
      if (n(String(ing)).includes(q) && q.length >= 4) return 55;
    }
  }

  // Çok kelimeli sorgu: her kelimeyi ayrı test et
  const words = q.split(/\s+/).filter(w => w.length >= 3);
  if (words.length > 1) {
    let hits = 0;
    for (const word of words) {
      if (pName.includes(word) || pBrand.includes(word) || pCat.includes(word)) hits++;
    }
    if (hits === words.length) return 75;
    if (hits > 0) return 40 + hits * 10;
  }

  return 0;
}

function searchProductsByText(query: string, products: Product[]): Product[] {
  const q = n(query);
  const scored: ScoredProduct[] = [];

  for (const p of products) {
    const s = textScore(p, q);
    if (s > 0) scored.push({ product: p, score: s });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map(sp => sp.product);
}

// ─── Endişe bazlı ürün filtreleme ────────────────────────────────────────────

function productMatchesConcern(product: Product, entry: ConcernEntry): boolean {
  const pCat  = n(product.category ?? product.kategori ?? "");
  const pSub  = n(product.subcategory ?? "");
  const pName = n(product.name ?? product.isim ?? "");
  const pDesc = n(product.description ?? product.short_description ?? product.aciklama ?? "");

  // Hariç tutulan kategorileri kontrol et
  if (entry.excludeCategories) {
    for (const ex of entry.excludeCategories) {
      const exN = n(ex);
      if (pCat.includes(exN) || pName.includes(exN)) return false;
    }
  }

  // Kategori eşleşme
  for (const cat of entry.categories) {
    const catN = n(cat);
    if (pCat.includes(catN) || pSub.includes(catN) || pName.includes(catN)) return true;
  }

  // Alt kategori eşleşme
  if (entry.subcategories) {
    for (const sub of entry.subcategories) {
      const subN = n(sub);
      if (pSub.includes(subN) || pCat.includes(subN)) return true;
    }
  }

  // product.concerns veya product.tags içinde eşleşme
  const pConcerns = [
    ...(product.concerns ?? []),
    ...(product.concerns_supported ?? []),
    ...(product.tags ?? []),
  ].map(c => n(String(c)));

  if (entry.concernKeywords) {
    for (const kw of entry.concernKeywords) {
      const kwN = n(kw);
      if (pConcerns.some(c => c.includes(kwN))) return true;
    }
  }

  // İçerik sinyalleri (boost değil, eşleşme sayılır)
  if (entry.ingredientSignals) {
    const ingredients = [
      ...(product.ingredients ?? []),
      ...(product.active_ingredients ?? []),
    ].map(i => n(String(i)));
    const pDescN = pDesc;

    for (const sig of entry.ingredientSignals) {
      const sigN = n(sig);
      if (
        ingredients.some(i => i.includes(sigN)) ||
        pDescN.includes(sigN)
      ) return true;
    }
  }

  return false;
}

function filterProductsByConcern(products: Product[], entry: ConcernEntry): Product[] {
  return products.filter(p => productMatchesConcern(p, entry));
}

// ─── Ana Arama Fonksiyonu ─────────────────────────────────────────────────────

/** Concern arama için minimum güven eşiği */
const CONCERN_CONFIDENCE_THRESHOLD = 58;

export function runSmartSearch(query: string, allProducts: Product[]): SmartSearchResult {
  const q = query.trim();

  if (!q || q.length < 2) {
    return { type: "product", products: [], query };
  }

  // ── 1. Endişe tespiti: iki katmanlı eşleşme ─────────────────────────────────
  // Katman A: concernSearchEngine (6 ana akış)
  const engineResult: ConcernEngineResult = searchConcern(q);
  let bestConcernEntry: ConcernEntry | undefined;
  let bestConfidence = 0;

  if (engineResult.hasResults && engineResult.matches.length > 0) {
    const topMatch = engineResult.matches[0];
    if (topMatch.confidence >= CONCERN_CONFIDENCE_THRESHOLD) {
      bestConcernEntry = getConcernEntryByFlowId(topMatch.flowId);
      bestConfidence = topMatch.confidence;
    }
  }

  // Katman B: Sözlük alias eşleşmesi (30+ endişe)
  if (!bestConcernEntry || bestConfidence < 80) {
    const dictMatch = matchConcernEntry(q);
    if (dictMatch && dictMatch.score > bestConfidence) {
      bestConcernEntry = dictMatch.entry;
      bestConfidence = dictMatch.score;
    }
  }

  // ── 2. Endişe eşleşmesi varsa → kategori bazlı filtrele ────────────────────
  if (bestConcernEntry && bestConfidence >= CONCERN_CONFIDENCE_THRESHOLD) {
    const concernFiltered = filterProductsByConcern(allProducts, bestConcernEntry);

    if (concernFiltered.length > 0) {
      return {
        type: "concern",
        concern: bestConcernEntry,
        concernConfidence: bestConfidence,
        products: concernFiltered,
        query,
      };
    }

    // Concern eşleşti ama DB'de o kategoride ürün yok → metin aramasına geç
  }

  // ── 3. Metin tabanlı ürün araması ────────────────────────────────────────────
  const textHits = searchProductsByText(q, allProducts);
  if (textHits.length > 0) {
    return {
      type: "product",
      products: textHits,
      query,
    };
  }

  // ── 4. Fallback: en yakın endişeleri öner ───────────────────────────────────
  const fallbackList: ConcernEntry[] = [];

  // Concern engine'den gelen zayıf eşleşmeleri fallback'e ekle
  if (engineResult.hasResults) {
    for (const match of engineResult.matches.slice(0, 3)) {
      const entry = getConcernEntryByFlowId(match.flowId);
      if (entry && !fallbackList.find(e => e.id === entry.id)) {
        fallbackList.push(entry);
      }
    }
  }

  // Dict match fallback
  const dictMatch = matchConcernEntry(q);
  if (dictMatch && !fallbackList.find(e => e.id === dictMatch.entry.id)) {
    fallbackList.splice(0, 0, dictMatch.entry); // başa ekle
  }

  // Yeterli fallback yoksa popüler endişelerle tamamla
  const tops = getTopConcerns(5);
  for (const t of tops) {
    if (fallbackList.length >= 5) break;
    if (!fallbackList.find(e => e.id === t.id)) fallbackList.push(t);
  }

  return {
    type: "fallback",
    concern: bestConcernEntry,
    concernConfidence: bestConfidence,
    products: [],
    fallbackConcerns: fallbackList.slice(0, 5),
    query,
  };
}

// ─── Supabase kategori araması için yardımcı ─────────────────────────────────
// home/index.tsx'deki doSearch, bu listeyi Supabase sorgusuna paslar.

export function buildConcernCategoryFilter(entry: ConcernEntry): string[] {
  return entry.categories;
}

// ─── Sonuç başlığı metni üretici ─────────────────────────────────────────────

export function buildResultLabel(result: SmartSearchResult): string {
  if (result.type === "concern" && result.concern) {
    return `${result.concern.label_tr} ile ilgili ürünler`;
  }
  if (result.type === "product") {
    return `${result.products.length} ürün bulundu`;
  }
  return "";
}
