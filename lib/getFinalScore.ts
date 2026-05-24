/**
 * getFinalScore.ts — TEK KAYNAK GERÇEĞİ
 *
 * Tüm ekranlarda ürün skoru için SADECE getFinalProductScore() kullanılır.
 * Başka hiçbir alan (score, dermatologicalScore vb.) UI'da doğrudan
 * gösterilmez — bu fonksiyon üzerinden erişilir.
 *
 * Öncelik sırası (değiştirilmez):
 *  1. dermo_score                  — 0-100, DB'den doğrudan
 *  2. scores.system_total_score    — 0-10 ölçek → ×10
 *  3. scores.sistem_toplam_puani   — 0-10 → ×10
 *  4. sistem_toplam_puani          — 0-10 → ×10 (düz kolon)
 *  5. scores.overall               — 0-10 → ×10 veya 0-100 doğrudan
 *  6. score                        — 0-10 → ×10 veya 0-100 doğrudan
 *  7. İçerik listesinden hesaplama (calcDermoScore) — detay sayfası ile tutarlı
 *  8. rating                       — 0-5 yıldız → ×20 (son çare; veritabanında
 *                                    daha zengin skor alanı yoksa kullanılır)
 *
 * Bu sıra sayesinde kartlar ve detay ekranı HER ZAMAN aynı değeri görür.
 */
import { calcDermoScore, extractIngredientNames } from "@/lib/dermoScore";

/**
 * Bir kaynak değeri 0-100 ölçeğine normalize eder.
 *  - >10 ise olduğu gibi (zaten 0-100 ölçek) yuvarlanır.
 *  - ≤10 ise 0-10 ölçeğindendir, ×10 ile 0-100 ölçeğine taşınır.
 *  - Sayısal olmayan / sonsuz değerler null döner.
 *  - Çıktı 0-100 aralığına KESİLİR (clamp).
 */
function normalizeTo100(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const scaled = n > 10 ? n : n * 10;
  const rounded = Math.round(scaled);
  // 0-100 dışına taşmayı engelle (örn. bozuk veri)
  return Math.max(0, Math.min(100, rounded));
}

/**
 * EH19.1 · Tek kaynak skor fonksiyonu — DAİMA 0-100 tam sayı veya null döner.
 * UI tarafı ek normalizasyon/bölme yapmamalı; sadece `Math.round` veya
 * doğrudan değeri kullanmalı.
 */
export function getFinalProductScore(
  product: Record<string, any> | null | undefined,
): number | null {
  if (!product) return null;
  const p = product as any;

  // 1. dermo_score (DB sözleşmesi: DAİMA 0-100 doğrudan; ≤10 olsa bile
  // ×10 ile şişirilmez — gerçek düşük skoru korumak için).
  if (p.dermo_score != null) {
    const n = Number(p.dermo_score);
    if (Number.isFinite(n)) {
      return Math.max(0, Math.min(100, Math.round(n)));
    }
  }

  // 2-3. scores JSONB içindeki toplam puan (0-10)
  const v2 = normalizeTo100(p.scores?.system_total_score);
  if (v2 != null) return v2;
  const v3 = normalizeTo100(p.scores?.sistem_toplam_puani);
  if (v3 != null) return v3;

  // 4. Düz kolon: sistem_toplam_puani (0-10)
  const v4 = normalizeTo100(p.sistem_toplam_puani);
  if (v4 != null) return v4;

  // 5. Eski alan: scores.overall (0-10 veya 0-100)
  const v5 = normalizeTo100(p.scores?.overall);
  if (v5 != null) return v5;

  // 6. Eski alan: doğrudan p.score (0-10 veya 0-100)
  const v6 = normalizeTo100(p.score);
  if (v6 != null) return v6;

  // 7. İçerik listesinden hesapla (detay sayfası ile tutarlı fallback)
  const names = extractIngredientNames(p);
  if (names.length > 0) {
    const result = calcDermoScore(names);
    if (result) {
      // calcDermoScore zaten 0-100 üretir; yine de sınırı garanti edelim.
      return Math.max(0, Math.min(100, Math.round(result.total)));
    }
  }

  // 8. rating (0-5 → 0-100) — son çare
  if (p.rating != null) {
    const n = Number(p.rating);
    if (Number.isFinite(n)) {
      return Math.max(0, Math.min(100, Math.round(n * 20)));
    }
  }

  return null;
}

/**
 * UI chip'leri için sade puan döner (0-100 tam sayı veya null).
 *
 * EH19 · Tüm ekranlar aynı değeri görsün diye getFinalProductScore'un
 * ince bir sarmalayıcısıdır. Eski ayrık fallback listesi kaldırıldı;
 * tüm fallback mantığı getFinalProductScore'da merkezleştirildi.
 */
export function getDisplayScore(
  product: Record<string, any> | null | undefined,
): number | null {
  return getFinalProductScore(product);
}
