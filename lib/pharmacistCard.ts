/**
 * pharmacistCard.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Eczacı tarzı güven tabanlı ürün tavsiye formatı.
 *
 * 3 kısa cümle üretir:
 *   1. Uyumluluk  — kullanıcıya odak, ürüne değil
 *   2. Fayda      — ne yapar, sade
 *   3. Dürüst Not — küçük bir sınırlama veya dikkat
 *
 * Ton kuralları (copyToneGuide.ts ile uyumlu):
 *   - Max 2 cümle per alan
 *   - Klinik değil, sıcak
 *   - Hype yok, abartı yok, pazarlama dili yok
 *   - Önce gözlem, sonra yönlendirme
 */

import type { ParsedIngredient } from "./ingredientAnalysis";
import type { InsightPreferences } from "./suitabilityInsights";

// ── Dönüş tipi ────────────────────────────────────────────────────────────────

export interface PharmacistCard {
  compatibility: string;   // Kullanıcı uyumu
  benefit:       string;   // Temel fayda
  honestNote:    string;   // Dürüst not (sınırlama / dikkat)
}

// ── İçerik tarayıcı ───────────────────────────────────────────────────────────

function names(parsed: ParsedIngredient[]): string[] {
  return parsed.map(i => i.name.toLowerCase());
}

function has(ns: string[], kws: string[]): boolean {
  return kws.some(kw => ns.some(n => n === kw || n.includes(kw)));
}

function hasBadge(product: any, key: string, status: "positive" | "negative"): boolean {
  return (product.badges ?? []).some((b: any) => b.key === key && b.status === status);
}

function haystack(product: any): string {
  return [
    product.name ?? "", product.isim ?? "",
    product.category ?? "", product.kategori ?? "",
    product.short_benefit ?? "", product.shortBenefit ?? "",
    ...(product.skin_types ?? []),
    ...(product.concerns_supported ?? []),
    ...(product.tags ?? []),
    product.about ?? "", product.description ?? "",
  ].join(" ").toLowerCase();
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────

export function getPharmacistCard(
  product: any,
  parsedIngredients: ParsedIngredient[],
  preferences?: InsightPreferences,
): PharmacistCard {
  const ns  = names(parsedIngredients);
  const hs  = haystack(product);
  const cat = ((product.category ?? product.kategori ?? "") as string).toLowerCase();

  // Rozet sinyalleri
  const isFragFree    = hasBadge(product, "fragrance", "negative") || !has(ns, ["parfum", "fragrance", "perfume"]);
  const isAlcFree     = hasBadge(product, "alcohol",   "negative");
  const isSulfateFree = hasBadge(product, "sulfate",   "negative");

  // İçerik sinyalleri
  const hasRetinol    = has(ns, ["retinol", "retinyl", "retinoic", "tretinoin"]);
  const hasAHA        = has(ns, ["glycolic acid", "lactic acid", "mandelic acid"]);
  const hasBHA        = has(ns, ["salicylic acid"]);
  const hasHA         = has(ns, ["hyaluronic acid", "sodium hyaluronate"]);
  const hasCeramide   = has(ns, ["ceramide"]);
  const hasNiacinamide= has(ns, ["niacinamide"]);
  const hasCentella   = has(ns, ["centella asiatica", "cica", "madecassoside"]);
  const hasVitC       = has(ns, ["ascorbic acid", "vitamin c", "ascorbyl", "3-o-ethyl ascorbic"]);
  const hasPeptide    = has(ns, ["peptide", "matrixyl", "argireline", "hexapeptide"]);
  const hasSPF        = has(ns, ["zinc oxide", "titanium dioxide", "avobenzone", "octinoxate", "uvinul"]);
  const hasFragrance  = has(ns, ["parfum", "fragrance", "perfume"]);
  const hasHarshAlc   = has(ns, ["alcohol denat", "denatured alcohol", "sd alcohol"]);
  const hasComedogenic= has(ns, ["isopropyl myristate", "isopropyl palmitate", "coconut oil"]);
  const hasAllantoin  = has(ns, ["allantoin", "panthenol"]);
  const hasCaffeine   = has(ns, ["caffeine"]);
  const isOilFree     = hs.includes("oil-free") || hs.includes("yağsız");
  const isMatte       = hs.includes("mat") || hs.includes("matte");

  // Kullanıcı profili
  const skinType       = preferences?.skinType ?? null;
  const concerns       = preferences?.skinConcerns ?? [];
  const specialConds   = preferences?.specialConditions ?? [];
  const allergies      = preferences?.allergies ?? [];
  const isPregnant     = specialConds.includes("pregnancy") || specialConds.includes("breastfeeding");
  const isOily         = skinType === "oily" || skinType === "combination";
  const isDry          = skinType === "dry";
  const isSensitive    = skinType === "sensitive" || specialConds.includes("sensitive_skin");
  const hasRosacea     = specialConds.includes("rosacea");
  const fragAllergyUser= allergies.some(a => ["parfüm", "parfum", "fragrance", "koku"].includes(a.toLowerCase()));

  // ── 1. UYUMLULUk ─────────────────────────────────────────────────────────

  let compatibility = "Çoğu cilt tipiyle uyumlu bir formül.";

  // Profil bazlı uyum (en spesifik önce)
  if (isSensitive && isFragFree && !hasHarshAlc) {
    compatibility = "Hassas ciltte sakin kalır.";
  } else if (isSensitive && hasFragrance) {
    compatibility = "Hassas ciltlerde koku içeriği küçük bir risk taşıyabilir.";
  } else if (isOily && isOilFree) {
    compatibility = "Yağlı ciltte ağırlaşmaz.";
  } else if (isOily && isMatte) {
    compatibility = "Yağlı ciltte matlaştırıcı etki yapar.";
  } else if (isOily && hasComedogenic) {
    compatibility = "Yağlı cilt için bazı içerikler gözenek tıkama riski taşıyabilir.";
  } else if (isDry && (hasHA || hasCeramide)) {
    compatibility = "Kuru ciltte nem tutumunu uzun süre destekler.";
  } else if (isDry && hasHarshAlc) {
    compatibility = "Kuru ciltte alkol içeriği kuruluğu biraz artırabilir.";
  } else if (hasRosacea && hasCentella && isFragFree) {
    compatibility = "Kızarıklık eğilimli ciltte yatıştırıcı etki yapar.";
  } else if (hasRosacea && hasFragrance) {
    compatibility = "Rozasea eğiliminde parfüm içeriği tahriş riskini artırabilir.";
  } else if (fragAllergyUser && hasFragrance) {
    compatibility = "Parfüm alerjisi olan ciltler için uygun olmayabilir.";
  } else if (fragAllergyUser && isFragFree) {
    compatibility = "Parfüm içermediği için koku hassasiyeti olanlara uygun.";
  } else if (isFragFree && !hasHarshAlc) {
    compatibility = "Hassas ciltle de uyumlu temiz içerik profili.";
  } else if (isOilFree) {
    compatibility = "Yağlı ciltte ağırlaşmaz.";
  }

  // ── 2. FAYDA ─────────────────────────────────────────────────────────────

  let benefit = "Günlük bakım rutinini destekler.";

  if (hasSPF && isOilFree) {
    benefit = "Gözenekleri tıkamadan korur.";
  } else if (hasSPF) {
    benefit = "Güneşe karşı gün boyu koruma sağlar.";
  } else if (hasRetinol) {
    benefit = "Hücre yenilenmesini hızlandırır, zamanla kırışık görünümünü azaltır.";
  } else if (hasBHA && hasNiacinamide) {
    benefit = "Gözenekleri temizler, leke oluşumunu yavaşlatır.";
  } else if (hasBHA) {
    benefit = "Akneye eğilimli gözenekleri içten temizler.";
  } else if (hasVitC && hasNiacinamide) {
    benefit = "Leke ve tonu eş zamanlı düzeltir.";
  } else if (hasVitC) {
    benefit = "Cilt tonunu aydınlatır, antioksidan koruma sağlar.";
  } else if (hasNiacinamide) {
    benefit = "Leke görünümünü azaltır, gözenekleri sıkılaştırır.";
  } else if (hasCeramide && hasHA) {
    benefit = "Bariyer onarırken nem tutumunu güçlendirir.";
  } else if (hasCeramide) {
    benefit = "Cilt bariyerini onarır ve nemliliği korur.";
  } else if (hasHA) {
    benefit = "Nem dengesini güçlendirir, dolgun bir his bırakır.";
  } else if (hasPeptide) {
    benefit = "Cilt sıkılığını destekler, doku kalitesinin desteklenmesine katkı sağlar.";
  } else if (hasCentella) {
    benefit = "Kızarıklık ve tahriş eğilimini yatıştırır.";
  } else if (hasAllantoin) {
    benefit = "Cilt yüzeyini sakinleştirir ve nemli tutar.";
  } else if (hasCaffeine) {
    benefit = "Göz altı şişliği ve morluğu için destekleyici etki yapar.";
  } else if (hasAHA) {
    benefit = "Yüzey ölü hücreleri soyar, tonu düzeltir.";
  } else if (cat.includes("temizleyici") || cat.includes("clean")) {
    benefit = "Cildi nazikçe temizler, doğal nem dengesini bozmaz.";
  } else if (isSulfateFree) {
    benefit = "Sülfatsız yapısıyla bariyer hasarı riski düşük.";
  }

  // ── 3. DÜRÜST NOT ─────────────────────────────────────────────────────────

  let honestNote = "Süreklilik, tek bir uygulamadan çok daha fazlasını verir.";

  if (isPregnant && (hasRetinol || hasBHA || hasAHA)) {
    honestNote = "Hamilelik ve emzirme döneminde kullanmadan önce doktora danışmak gerekir.";
  } else if (hasRetinol) {
    honestNote = "Güneş hassasiyeti yaratır; gece rutinine almak daha uygun.";
  } else if (hasAHA) {
    honestNote = "Hafif güneş hassasiyeti yapabilir, gündüz SPF şart.";
  } else if (hasFragrance && isSensitive) {
    honestNote = "Koku içeriği reaktif ciltlerde tahriş edebilir; önce bilek içine test edin.";
  } else if (hasFragrance) {
    honestNote = "Koku hassasiyeti olanlarda tahriş ihtimali var.";
  } else if (hasHarshAlc) {
    honestNote = "Çok kuru ciltte düzenli kullanımda kuruluğu artırabilir.";
  } else if (hasComedogenic && (isOily || concerns.includes("acne"))) {
    honestNote = "Akne eğilimli ciltlerde bazı içerikler gözenek tıkayabilir.";
  } else if (hasBHA || hasAHA) {
    honestNote = "Başlangıçta haftada birkaç gün deneyerek alışmak daha güvenli.";
  } else if (isDry && isOilFree) {
    honestNote = "Çok kuru ciltte tek başına yeterli gelmeyebilir.";
  } else if (hasPeptide || hasRetinol) {
    honestNote = "Etkinin belirginleşmesi birkaç hafta sürer.";
  } else if (isFragFree && isSulfateFree && !hasHarshAlc) {
    honestNote = "Temiz formülü nedeniyle hassas ciltlerde dahi genellikle tolere edilir.";
  } else if (hasSPF) {
    honestNote = "En yüksek koruma için 2 saatte bir yenilemek önerilir.";
  }

  return { compatibility, benefit, honestNote };
}
