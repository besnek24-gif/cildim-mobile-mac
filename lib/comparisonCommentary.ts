/**
 * comparisonCommentary.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * İki ürünün features (paraben/sulfate/fragrance/alcohol/silicone) alanlarını
 * karşılaştırarak eczacı tarzı, sıcak tonlu 2-3 Türkçe yorum üretir.
 *
 * Kurallar:
 *  - Anlamlı farklılıkları önceliklendir (priority sırası)
 *  - Maks 3 yorum döndür
 *  - Her iki ürün de benzer ise "benzer profil" fallback'i yap
 *  - İsim bazlı: "A" / "B" yerine gerçek ürün adını kullan
 */

export type ProductFeatureFlags = {
  paraben?:   boolean | null;
  sulfate?:   boolean | null;
  fragrance?: boolean | null;
  alcohol?:   boolean | null;
  silicone?:  boolean | null;
  vegan?:     boolean | null;
};

/** Bir ürünün features alanını güvenle çek */
function extractFlags(product: any): ProductFeatureFlags {
  const raw = product?.features;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ProductFeatureFlags;
}

type Insight = { text: string; priority: number };

/**
 * İki ürünün features alanlarını karşılaştırır; eczacı üslubuyla 2-3 yorum döner.
 */
export function buildComparisonCommentary(
  pA: any,
  pB: any,
  nameA: string,
  nameB: string,
): string[] {
  const a = extractFlags(pA);
  const b = extractFlags(pB);

  const insights: Insight[] = [];

  // ── 1. Fragrance (öncelik: 1) ─────────────────────────────────────────────
  const aFrag = !!a.fragrance;
  const bFrag = !!b.fragrance;
  if (aFrag !== bFrag) {
    const safer = aFrag ? nameB : nameA;
    insights.push({
      text: `Hassas ve koku reaksiyonu olan ciltler için ${safer} daha güvenli bir tercih.`,
      priority: 1,
    });
  }

  // ── 2. Alcohol (öncelik: 2) ───────────────────────────────────────────────
  const aAlc = !!a.alcohol;
  const bAlc = !!b.alcohol;
  if (aAlc !== bAlc) {
    const withAlc = aAlc ? nameA : nameB;
    insights.push({
      text: `${withAlc} içindeki alkol, hassas ve kuru ciltlerde kurutucu etki oluşturabilir.`,
      priority: 2,
    });
  }

  // ── 3. Paraben (öncelik: 3) ───────────────────────────────────────────────
  const aPar = !!a.paraben;
  const bPar = !!b.paraben;
  if (aPar !== bPar) {
    const withPar = aPar ? nameA : nameB;
    insights.push({
      text: `${withPar} paraben içeriyor; uzun süreli kullanımda hassas ciltte dikkatli olmak gerekebilir.`,
      priority: 3,
    });
  }

  // ── 4. Sulfate (öncelik: 4) ───────────────────────────────────────────────
  const aSulf = !!a.sulfate;
  const bSulf = !!b.sulfate;
  if (aSulf !== bSulf) {
    const withSulf = aSulf ? nameA : nameB;
    insights.push({
      text: `${withSulf} sülfat içeriyor — güçlü temizleyici etki sağlar, ancak bariyer hassasiyetini artırabilir.`,
      priority: 4,
    });
  }

  // ── 5. Silicone (öncelik: 5) ──────────────────────────────────────────────
  const aSil = !!a.silicone;
  const bSil = !!b.silicone;
  if (aSil !== bSil) {
    const withSil = aSil ? nameA : nameB;
    const withoutSil = aSil ? nameB : nameA;
    insights.push({
      text: `${withSil} silikon bazlı pürüzsüzlük sağlar; gözenek duyarlılığı olanlarda ${withoutSil} daha nötr kalır.`,
      priority: 5,
    });
  }

  // ── Sıralama ve kırp ──────────────────────────────────────────────────────
  insights.sort((x, y) => x.priority - y.priority);
  const results = insights.slice(0, 3).map((i) => i.text);

  // ── Fallback ──────────────────────────────────────────────────────────────
  if (results.length === 0) {
    results.push(
      "Her iki ürün de benzer bir içerik profili sunuyor; seçimi cilt tipinize ve bütçenize göre yapabilirsiniz."
    );
  }

  return results;
}
