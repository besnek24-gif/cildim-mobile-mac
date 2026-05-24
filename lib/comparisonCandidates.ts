/**
 * comparisonCandidates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bir ürün için en uygun karşılaştırma adaylarını bulur.
 *
 * EH19 · Liste, detay ve aday ekranı TEK kaynak (pairKey + arePairsCompatible)
 * kullanır. Eski raw category/subcategory eşitliği kaldırıldı; aksi halde
 * isimden çıkarım gerektiren ürünler (şampuan, bebek bakımı, vb.) farklı
 * adaylar gösterirdi.
 *
 * Öncelik:
 *  1. Aynı alt kategori (raw subcategory eşit ve dolu)
 *  2. Aynı pairKey (subcategory > category > isimden çıkarım)
 *
 * Kural:
 *  - Aynı alt kategoride ≥ minSubCount ürün varsa yalnızca bunlar döner
 *  - Aksi hâlde aynı pairKey grubuna genişler
 *  - arePairsCompatible() filtresinden geçmeyen adaylar elenir
 *  - Maks maxCount (5) aday döner
 *  - Geçerli ürün listeye dahil edilmez
 */

import { arePairsCompatible, pairKey } from "./pairKey";
import { sameRawCategory, logCategoryGuardBlock } from "./sameRawCategory";

export type CandidateLabel = "Aynı alt kategori" | "Aynı kategori";

export interface ComparisonCandidate {
  product: any;
  label: CandidateLabel;
  priority: number;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

function getSubcategory(p: any): string {
  return norm(p.subcategory);
}

function hasName(p: any): boolean {
  const name = (p.name ?? p.isim ?? "").trim();
  const brand = (p.brand ?? p.marka ?? "").trim();
  return name.length > 0 && brand.length > 0;
}

/**
 * Verilen ürünle karşılaştırılabilir adayları döndürür.
 */
export function findComparisonCandidates(
  currentProduct: any,
  allProducts: any[],
  options: { maxCount?: number; minSubCount?: number } = {},
): ComparisonCandidate[] {
  const { maxCount = 5, minSubCount = 3 } = options;

  if (!currentProduct) return [];

  const curId = String(currentProduct?.id ?? "");
  const curSub = getSubcategory(currentProduct);
  const curKey = pairKey(currentProduct);

  // pairKey üretilemiyorsa (kategori/subcategory/isim hiç yok) aday gösterme.
  if (!curKey) return [];

  const sameSub: ComparisonCandidate[] = [];
  const sameCat: ComparisonCandidate[] = [];

  // DEV-only stage counters — boş aday havuzunda hangi adımda elendiğini
  // izlemek için. Üretimde tüm sayma blokları no-op'tur.
  let _afterSelf = 0;
  let _afterName = 0;
  let _afterPairKey = 0;
  let _afterCompat = 0;

  for (const p of allProducts) {
    if (String(p.id ?? "") === curId) continue;
    _afterSelf++;
    if (!hasName(p)) continue;
    _afterName++;

    // pairKey üzerinden eşleşmeli (raw category değil)
    const pKey = pairKey(p);
    if (!pKey || pKey !== curKey) continue;
    _afterPairKey++;

    // Aynı marka varyantı / aynı isim / concern çakışması elenir
    if (!arePairsCompatible(currentProduct, p)) continue;
    _afterCompat++;

    // HARD CATEGORY GUARD — pairKey aynı olsa bile raw kategori
    // farklıysa bridge etme (örn. "krem" isim-fallback'i treatment
    // ürünü ile makyaj ürününü "nemlendirici" havuzunda birleştirebilir).
    if (!sameRawCategory(currentProduct, p)) {
      logCategoryGuardBlock("findComparisonCandidates", currentProduct, p);
      continue;
    }

    const pSub = getSubcategory(p);
    if (curSub && pSub && curSub === pSub) {
      sameSub.push({ product: p, label: "Aynı alt kategori", priority: 1 });
    } else {
      sameCat.push({ product: p, label: "Aynı kategori", priority: 2 });
    }
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[COMPARE_DEBUG] stage counts", {
      currentName: (currentProduct as any)?.name ?? (currentProduct as any)?.isim,
      curKey,
      curSub,
      all: allProducts.length,
      afterSelfFilter: _afterSelf,
      afterHasName: _afterName,
      afterPairKey: _afterPairKey,
      afterCompatibility: _afterCompat,
      sameSub: sameSub.length,
      sameCat: sameCat.length,
    });
  }

  if (sameSub.length >= minSubCount) {
    return sameSub.slice(0, maxCount);
  }

  return [...sameSub, ...sameCat].slice(0, maxCount);
}
