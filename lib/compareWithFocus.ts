/**
 * compareWithFocus.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Aday listesini "tedavi amacı / görev" üzerinden ikiye böler:
 *
 *   • samePurpose        → mevcut ürünle ortak primary VEYA secondary focus
 *   • alternativePurpose → focus'u sınıflandırılabilen ama overlap olmayan
 *                          ya da hiç sınıflandırılamayan adaylar
 *
 * GÜVENLİK GARANTİLERİ (kullanıcı kuralı: "never block user, never empty"):
 *  1. Mevcut ürünün focus'u çıkarılamazsa → mevcut listeyi olduğu gibi
 *     samePurpose olarak döner. Mevcut karşılaştırma akışı bozulmaz.
 *  2. Adayın focus'u çıkarılamazsa → drop ETMEZ; alternativePurpose'a koyar.
 *  3. Hesaplama sırasında istisna olursa → mevcut listeyi olduğu gibi
 *     samePurpose olarak döner.
 *  4. Sonuç tamamen boş çıkarsa → fallback: mevcut listeyi samePurpose olarak
 *     döner (boş ekran gösterilmez).
 *
 * Bu modül findComparisonCandidates'ı VEYA pairKey'i çağırmaz, değiştirmez.
 * Tamamen post-processing additive katmandır.
 */

import type { Product } from "@/types/product";
import { extractTreatmentFocus, type TreatmentFocus } from "./treatmentFocus";

export interface FocusFilterResult {
  samePurpose: Product[];
  alternativePurpose: Product[];
}

export function filterByTreatmentFocus(
  current: Product,
  candidates: Product[],
): FocusFilterResult {
  // Boş giriş → boş çıkış (çağıran için en mantıklısı)
  if (!current || !Array.isArray(candidates) || candidates.length === 0) {
    return { samePurpose: [], alternativePurpose: [] };
  }

  // Fallback: mevcut listeyi olduğu gibi samePurpose'a koyar.
  const passthrough: FocusFilterResult = {
    samePurpose: candidates.slice(),
    alternativePurpose: [],
  };

  let curFocus;
  try {
    curFocus = extractTreatmentFocus(current);
  } catch {
    return passthrough;
  }

  // Mevcut ürün sınıflandırılamadı → filtreleme yapma, mevcut akışa dön.
  if (!curFocus.primary && curFocus.secondary.length === 0) {
    return passthrough;
  }

  const curSet = new Set<TreatmentFocus>([
    ...(curFocus.primary ? [curFocus.primary] : []),
    ...curFocus.secondary,
  ]);

  const samePurpose: Product[] = [];
  const alternativePurpose: Product[] = [];

  for (const c of candidates) {
    let f;
    try {
      f = extractTreatmentFocus(c);
    } catch {
      // Sınıflandırılamayan adayı drop ETME — alternatife düşür.
      alternativePurpose.push(c);
      continue;
    }

    const candSet = new Set<TreatmentFocus>([
      ...(f.primary ? [f.primary] : []),
      ...f.secondary,
    ]);

    if (candSet.size === 0) {
      // Aday hiç sınıflandırılamadı → alternatife düşür (drop yok).
      alternativePurpose.push(c);
      continue;
    }

    let overlap = false;
    for (const v of candSet) {
      if (curSet.has(v)) { overlap = true; break; }
    }

    if (overlap) samePurpose.push(c);
    else         alternativePurpose.push(c);
  }

  // Güvenlik: ikisi de boşsa (teorik olarak buraya düşmez ama yine de) →
  // mevcut listeyi olduğu gibi göster.
  if (samePurpose.length === 0 && alternativePurpose.length === 0) {
    return passthrough;
  }

  return { samePurpose, alternativePurpose };
}
