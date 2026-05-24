/**
 * suitabilityInsights.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Uygunluk sekmesi için merkezi yorum fonksiyonları.
 * Free → genel karar · Seçkin → tam analiz
 *
 * getSuitabilitySummary  — Genel uygunluk kararı (profil bazlı, kısa & net)
 * getSuitableFor         — Kimler için daha uygun (2-3 madde)
 * getCautionFor          — Kimler dikkatli olmalı (1-2 madde)
 * getUsageProfile        — Kullanım tipi yorumu (profil bazlı, tek-iki cümle)
 * getSuitabilityReasons  — Detaylı gerekçeler (PREMIUM)
 */

import type { IngredientSummary, ParsedIngredient } from "./ingredientAnalysis";
import {
  getConsultationText,
  withRiskFootnote,
  devCheckVoice,
  type ExpertRiskLevel,
} from "./expertVoice";

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface SuitabilitySummary {
  verdict: string;
  subline: string;
  color: string;
}

/** Profil dilimi — hem getSuitabilitySummary hem getUsageProfile için */
export interface InsightPreferences {
  skinType?: string | null;
  skinConcerns?: string[];
  specialConditions?: string[];
  allergies?: string[];
  texturePreferences?: string[];
  finishPreference?: string | null;
}

// ── İçerik yardımcıları ───────────────────────────────────────────────────────

function names(parsed: ParsedIngredient[]): string[] {
  return parsed.map(i => i.name.toLowerCase());
}

function hasAny(list: string[], keywords: string[]): boolean {
  return keywords.some(kw => list.some(n => n === kw || n.includes(kw)));
}

// ── 1. getSuitabilitySummary ─────────────────────────────────────────────────

/**
 * Genel uygunluk kararını döner.
 * `preferences` verilirse kullanıcı profiline göre sonuç değişir;
 * verilmezse içerik analizi bazlı genel karar üretilir.
 */
export function getSuitabilitySummary(
  summary: IngredientSummary,
  parsedIngredients: ParsedIngredient[],
  preferences?: InsightPreferences,
): SuitabilitySummary {
  if (summary.total === 0) {
    return {
      verdict: "Henüz değerlendirme yapılamadı.",
      subline: "İçerik verisi eklendikçe bu bölüm otomatik güncellenir.",
      color: "#6b7280",
    };
  }

  const ns = names(parsedIngredients);

  // ── İçerik bayrakları ──────────────────────────────────────────────────────
  const hasFragrance    = hasAny(ns, ["parfum", "fragrance", "perfume"]);
  const hasHarshAlcohol = hasAny(ns, ["alcohol denat", "denatured alcohol", "sd alcohol"]);
  const hasRetinoid     = hasAny(ns, ["retinol", "retinyl", "tretinoin", "retinal", "retinoic"]);
  const hasSalicylic    = hasAny(ns, ["salicylic acid"]);
  const hasHighAcid     = hasAny(ns, ["glycolic acid", "lactic acid", "mandelic acid"]);
  const hasComedogenic  = hasAny(ns, ["isopropyl myristate", "isopropyl palmitate", "acetylated lanolin", "coconut oil", "algae extract", "linseed oil", "flaxseed oil"]);
  const hasNiacinamide  = hasAny(ns, ["niacinamide"]);
  const hasHA           = hasAny(ns, ["hyaluronic acid", "sodium hyaluronate"]);
  const hasCeramide     = hasAny(ns, ["ceramide"]);
  const hasBHA          = hasSalicylic;
  const hasCentella     = hasAny(ns, ["centella asiatica", "cica", "madecassoside"]);

  // ── Profil bazlı kararlar (statik verdikten önce kontrol edilir) ───────────
  if (preferences) {
    const sc       = preferences.specialConditions ?? [];
    const concerns = preferences.skinConcerns      ?? [];
    const skin     = preferences.skinType          ?? null;
    const alg      = preferences.allergies         ?? [];

    const isPregnant    = sc.includes("pregnancy");
    const isBreastfeed  = sc.includes("breastfeeding");
    const isAcneProne   = sc.includes("acne_prone") || concerns.includes("acne");
    const hasRosacea    = sc.includes("rosacea");
    const isSensitive   = sc.includes("sensitive_skin") || skin === "sensitive";
    const isDry         = skin === "dry";
    const isOily        = skin === "oily" || skin === "combination";
    const wantsLight    = (preferences.texturePreferences ?? []).includes("light");
    const fragAllergy   = alg.includes("fragrance");
    const alcoholAllergy = alg.includes("alcohol");

    // 1 ─ Hamilelik: retinoid veya yüksek asit varsa uyarı
    if ((isPregnant || isBreastfeed) && (hasRetinoid || hasSalicylic || hasHighAcid)) {
      const period = isPregnant ? "Hamilelik" : "Emzirme";
      return {
        verdict: `${period} döneminde dikkat: retinoid veya yüksek asit içeriyor.`,
        subline: "Kullanmadan önce hekiminize danışın.",
        color: "#d97706",
      };
    }

    // 2 ─ Rozasea + parfüm / alkol
    if (hasRosacea && (hasFragrance || hasHarshAlcohol)) {
      return {
        verdict: "Rozasea eğilimi için parfüm veya alkol içeriği iritasyon riskini artırabilir.",
        subline: "Bu bileşenler rozasea ciltlerinde kızarıklık ve tahrişi tetikleyebilir.",
        color: "#d97706",
      };
    }

    // 3 ─ Parfüm alerjisi olan kullanıcı + parfüm var
    if (fragAllergy && hasFragrance) {
      return {
        verdict: "Belirttiğiniz parfüm alerjisiyle bu ürünün içeriği çakışıyor.",
        subline: "Kullanmadan önce bir dermatoloğa danışmanızı öneririz.",
        color: "#b91c1c",
      };
    }

    // 4 ─ Alkol alerjisi + sert alkol
    if (alcoholAllergy && hasHarshAlcohol) {
      return {
        verdict: "Sert alkol içeriği alkol hassasiyeti olanlar için risk oluşturabilir.",
        subline: "Kullanmadan önce bilek içine küçük uygulama ile toleransı kontrol edin.",
        color: "#d97706",
      };
    }

    // 5 ─ Hassas cilt + parfüm
    if (isSensitive && hasFragrance) {
      return {
        verdict: "Hassas cilde parfüm içeriği tahriş riski oluşturabilir.",
        subline: "Bilek içi veya kulak arkasına küçük uygulama ile önce toleransı kontrol edin.",
        color: "#d97706",
      };
    }

    // 6 ─ Akne + komedojenik var → uyarı
    if (isAcneProne && hasComedogenic && !hasBHA) {
      return {
        verdict: "Akne eğilimli cilt için bazı içerikler gözenek tıkama riski taşıyabilir.",
        subline: "Yüzü temizledikten hemen sonra uygulayın; yağ katmanı üstüne sürmeyin.",
        color: "#d97706",
      };
    }

    // 7 ─ Akne + BHA var → olumlu
    if (isAcneProne && hasBHA) {
      return {
        verdict: "Akne kaygınız için salisilik asit (BHA) içeriği olumlu.",
        subline: "BHA gözenek temizleme ve akne kontrolünde faydalı; gece rutinine uygundur.",
        color: "#16a34a",
      };
    }

    // 8 ─ Kuru cilt + sert alkol → uyarı
    if (isDry && hasHarshAlcohol) {
      return {
        verdict: "Kuru cilt için sert alkol içeriği bariyer kurumasını artırabilir.",
        subline: "Kullanım sonrasında yoğun nemlendirici ile desteklemeyi değerlendirin.",
        color: "#d97706",
      };
    }

    // 9 ─ Kuru cilt + nem/bariyer desteği var → olumlu
    if (isDry && (hasHA || hasCeramide)) {
      return {
        verdict: "Kuru cilde uygun: seramid ve nem tutucu içerik profili güçlü.",
        subline: hasCeramide
          ? "Seramid bariyer onarımını, hyalüronik asit nem tutumunu destekler."
          : "Hyalüronik asit nem ihtiyacınızı karşılamaya yardımcı olur.",
        color: "#15803d",
      };
    }

    // 10 ─ Yağlı / karma cilt + niasinamid → olumlu
    if (isOily && hasNiacinamide && !hasComedogenic) {
      return {
        verdict: "Yağlı cilt için niasinamid içeren dengeli bir formül.",
        subline: "Gözenek görünümü ve sebum dengesi için faydalı aktifler içeriyor.",
        color: "#15803d",
      };
    }

    // 11 ─ Rozasea + centella var → olumlu
    if (hasRosacea && hasCentella && !hasFragrance && !hasHarshAlcohol) {
      return {
        verdict: "Rozasea eğilimi için yatıştırıcı formül — parfüm ve alkol içermiyor.",
        subline: "Centella / Cica bileşenleri kızarıklık ve tahriş eğilimli ciltlerde destekleyicidir.",
        color: "#15803d",
      };
    }

    // 12 ─ Hassas cilt + parfüm yok, sert alkol yok → olumlu
    if (isSensitive && !hasFragrance && !hasHarshAlcohol) {
      return {
        verdict: "Hassas cilt profilinizle uyumlu: parfüm ve sert alkol içermiyor.",
        subline: "Temiz içerik profili hassas ciltler için düşük iritasyon riski anlamına gelir.",
        color: "#15803d",
      };
    }

    // 13 ─ Hafif doku tercihi + ağır formül değil → nötr olumlu
    if (wantsLight && !hasComedogenic) {
      return {
        verdict: "Hafif formül tercihinize uygun — tıkayıcı bileşen saptanmadı.",
        subline: "Katmanlı rutin için uygun; diğer ürünlerle birlikte rahatça kullanılabilir.",
        color: "#16a34a",
      };
    }
  }

  // ── Genel karar (profil yoksa veya eşleşme yoksa) ─────────────────────────
  switch (summary.rating) {
    case "cok_iyi":
      return {
        verdict: "Çoğu cilt tipi için uygun, temiz bir içerik profili.",
        subline: "Belirgin hassasiyet sinyali saptanmadı.",
        color: "#15803d",
      };
    case "iyi":
      return {
        verdict: hasFragrance
          ? "Dengeli formül; parfüm hassasiyeti olanlar dikkat etmeli."
          : "Dengeli ve günlük kullanıma uygun bir formül.",
        subline: "Belirgin hassasiyet sinyali saptanmadı.",
        color: "#16a34a",
      };
    case "orta":
      return {
        verdict: "Genel ciltler için uygun; hassas ciltler önce test etmeli.",
        subline: hasHarshAlcohol
          ? "Alkol içeriği kuru ve hassas ciltlerde temkinli kullanım gerektirir."
          : "Bazı bileşenler hassas profillerde dikkat gerektirebilir.",
        color: "#d97706",
      };
    case "dikkat":
      return {
        verdict: "Hassas ciltler için dikkat gerektiren bileşenler içeriyor.",
        subline: "Kullanmadan önce bir dermatoloğa danışmayı değerlendirin.",
        color: "#ea580c",
      };
    case "riskli":
    default:
      return {
        verdict: "Birden fazla yüksek risk bileşeni saptandı — dikkatli değerlendirin.",
        subline: "Kullanmadan önce dermatoloğunuza danışmanızı öneririz.",
        color: "#dc2626",
      };
  }
}

// ── 2. getSuitableFor ─────────────────────────────────────────────────────────

export function getSuitableFor(
  product: any,
  parsedIngredients: ParsedIngredient[],
  badges?: Array<{ key: string; status: string }>,
): string[] {
  const results: string[] = [];
  const ns = names(parsedIngredients);
  const category = ((product?.category ?? product?.kategori ?? "") as string).toLowerCase();

  const fragFree = badges
    ? badges.find(b => b.key === "fragrance")?.status === "positive"
    : !hasAny(ns, ["parfum", "fragrance"]);

  const parabenFree = badges
    ? badges.find(b => b.key === "paraben")?.status === "positive"
    : !hasAny(ns, ["paraben"]);

  const sulfateFree = badges
    ? badges.find(b => b.key === "sulfate")?.status === "positive"
    : !hasAny(ns, ["sodium lauryl sulfate", "sodium laureth sulfate"]);

  const hasNiacinamide  = hasAny(ns, ["niacinamide"]);
  const hasHA           = hasAny(ns, ["hyaluronic acid", "sodium hyaluronate"]);
  const hasCeramide     = hasAny(ns, ["ceramide"]);
  const hasSalicylic    = hasAny(ns, ["salicylic acid"]);
  const hasCentella     = hasAny(ns, ["centella asiatica", "cica"]);
  const hasRetinol      = hasAny(ns, ["retinol", "retinyl"]);
  const hasZincOxide    = hasAny(ns, ["zinc oxide"]);
  const hasTitanium     = hasAny(ns, ["titanium dioxide"]);

  if (category.includes("güneş") || hasZincOxide || hasTitanium) {
    results.push("Dış ortamda aktif vakit geçirenler");
  }
  if (fragFree && sulfateFree) {
    results.push("Hassas ve reaktif cilt tipleri");
  } else if (fragFree) {
    results.push("Koku hassasiyeti olanlar");
  }
  if (hasHA || hasCeramide) {
    results.push(hasCeramide ? "Bariyer onarımı ve nem ihtiyacı yüksek ciltler" : "Nem ihtiyacı yüksek ve kurumaya eğilimli ciltler");
  }
  if (hasNiacinamide && hasSalicylic) {
    results.push("Leke ve akne sorunuyla birlikte ilgilenenler");
  } else if (hasNiacinamide) {
    results.push("Leke karşıtı bakım arayanlar");
  } else if (hasSalicylic) {
    results.push("Akne eğilimli ve yağlı cilt tipleri");
  }
  if (hasRetinol) {
    results.push("Yaşlanma karşıtı gece bakımı önceliklendirenler");
  }
  if (hasCentella) {
    results.push("Kızarıklık ve tahriş eğilimli ciltler");
  }
  if (category.includes("temizleyici") || category.includes("clean")) {
    results.push("Günlük nazik temizleme rutini arayanlar");
  }
  const segment = ((product?.segment ?? "") as string).toLowerCase();
  if (segment === "ekonomik" && results.length < 2) {
    results.push("Sade ve ekonomik günlük bakım arayanlar");
  }

  return results.slice(0, 3);
}

// ── 3. getCautionFor ─────────────────────────────────────────────────────────

export function getCautionFor(
  product: any,
  parsedIngredients: ParsedIngredient[],
): string[] {
  const results: string[] = [];
  const ns = names(parsedIngredients);

  const hasFragrance    = hasAny(ns, ["parfum", "fragrance", "perfume"]);
  const hasHarshAlcohol = hasAny(ns, ["alcohol denat", "denatured alcohol", "sd alcohol", "isopropyl alcohol"]);
  const hasParaben      = hasAny(ns, ["paraben"]);
  const hasSulfate      = hasAny(ns, ["sodium lauryl sulfate"]);
  const hasRetinol      = hasAny(ns, ["retinol", "retinyl"]);
  const hasSalicylic    = hasAny(ns, ["salicylic acid"]);
  const hasMit          = hasAny(ns, ["isothiazolinone"]);

  if (hasFragrance)                    results.push("Parfüm ve koku alerjisi olanlar");
  if (hasHarshAlcohol)                 results.push("Kuru cilt ve bariyer hassasiyeti olanlar");
  if (hasRetinol || hasSalicylic)      results.push("Hamilelik ve emzirme dönemindekiler");
  if (hasParaben)                      results.push("Hormonal hassasiyeti olan bireyler");
  if (hasSulfate)                      results.push("Cilt bariyeri hassas kişiler");
  if (hasMit)                          results.push("Kontakt alerji eğilimli ciltler");

  return results.slice(0, 2);
}

// ── 4. getUsageProfile ────────────────────────────────────────────────────────

/**
 * Kullanım profili metnini döner.
 * `preferences` verilirse kullanıcıya özel kullanım tavsiyesi eklenir.
 */
export function getUsageProfile(
  product: any,
  parsedIngredients: ParsedIngredient[],
  summary: IngredientSummary,
  preferences?: InsightPreferences,
): string {
  const ns       = names(parsedIngredients);
  const category = ((product?.category ?? product?.kategori ?? "") as string).toLowerCase();
  const segment  = ((product?.segment ?? "") as string).toLowerCase();

  const hasActives  = hasAny(ns, ["niacinamide", "salicylic acid", "retinol", "glycolic acid", "lactic acid", "vitamin c", "ascorbic acid"]);
  const hasHA       = hasAny(ns, ["hyaluronic acid", "sodium hyaluronate"]);
  const hasCeramide = hasAny(ns, ["ceramide"]);
  const hasSPF      = hasAny(ns, ["zinc oxide", "titanium dioxide", "avobenzone", "octinoxate"]);
  const hasRetinol  = hasAny(ns, ["retinol", "retinyl"]);
  const hasBHA      = hasAny(ns, ["salicylic acid"]);

  // ── Temel kullanım zamanı ─────────────────────────────────────────────────
  let base: string;
  if (category.includes("güneş") || hasSPF) {
    base = "Sabah rutininde, güneşe çıkmadan önce uygulanmaya uygun.";
  } else if (hasRetinol) {
    base = "Retinol içeriği nedeniyle yalnızca gece rutininde kullanılmalı; ilk haftalarda haftada 2-3 kez ile başlanabilir.";
  } else if (category.includes("gece") || (hasActives && !hasSPF)) {
    base = "Aktif içerik profili nedeniyle gece rutininde daha verimli.";
  } else if (category.includes("temizleyici") || category.includes("clean")) {
    base = "Sabah ve akşam rutin temizleme adımı olarak kullanılabilir.";
  } else if (hasCeramide && hasHA) {
    base = "Sabah & akşam kullanıma uygun; bariyer onarımı için süreklilik önemli.";
  } else if (hasActives && segment === "seçkin") {
    base = "Yoğun aktif içerik yapısı; yeni başlayanlar için haftada birkaç gün önerilir.";
  } else if (summary.rating === "cok_iyi" || summary.rating === "iyi") {
    base = "Günlük kullanım için dengeli ve süreklilik gerektiren bir formül.";
  } else {
    base = "Günlük bakım rutinine kolayca eklenebilir.";
  }

  // ── Profil bazlı ek öneri ─────────────────────────────────────────────────
  if (!preferences) return base;

  const sc       = preferences.specialConditions ?? [];
  const concerns = preferences.skinConcerns      ?? [];
  const skin     = preferences.skinType          ?? null;
  const textures = preferences.texturePreferences ?? [];

  const isAcneProne  = sc.includes("acne_prone") || concerns.includes("acne");
  const isRosacea    = sc.includes("rosacea");
  const isSensitive  = sc.includes("sensitive_skin") || skin === "sensitive";
  const isDry        = skin === "dry";
  const isOily       = skin === "oily";
  const isPregnant   = sc.includes("pregnancy") || sc.includes("breastfeeding");
  const wantsLight   = textures.includes("light");

  if (isPregnant && (hasRetinol || hasBHA)) {
    return base + " Hamilelik/emzirme döneminde bu aktifler için kullanım öncesi hekiminize danışmanızı öneririz.";
  }
  if (isRosacea) {
    return base + " Rozasea profiliniz için düşük sıklıkta başlayıp toleransı izleyin.";
  }
  if (isSensitive && !isRosacea) {
    return base + " Hassas cilt profiliniz için ilk kullanımda bilek içi tolerans testi önerilir.";
  }
  if (isAcneProne && hasBHA) {
    return base + " Akne eğiliminiz için gece kullanımı daha uygun; gündüz SPF ile tamamlayın.";
  }
  if (isAcneProne && !hasBHA) {
    return base + " Akne eğiliminiz için hafif, gözenek tıkamayan SPF ile birlikte kullanmayı değerlendirin.";
  }
  if (isDry && hasCeramide) {
    return base + " Kuru cilt profiliniz için seramid içeriği uzun vadeli nem desteği sağlar; sabah ve akşam sürekli kullanım önerilir.";
  }
  if (isDry) {
    return base + " Kuru cilt profiliniz için nem dengesini destekleyecek bir nemlendirici ile katmanlayabilirsiniz.";
  }
  if (isOily && wantsLight) {
    return base + " Yağlı cilt ve hafif formül tercihiniz için tek katman yeterli; matlaştırıcı SPF ile tamamlanabilir.";
  }

  return base;
}

// ── 5. getSuitabilityReasons — PREMIUM ──────────────────────────────────────

export function getSuitabilityReasons(
  product: any,
  summary: IngredientSummary,
  parsedIngredients: ParsedIngredient[],
  preferences?: { skinType?: string; skinConcerns: string[]; allergies: string[] },
): string[] {
  const reasons: Array<{ text: string; priority: number }> = [];
  const ns = names(parsedIngredients);

  if (preferences?.allergies?.length) {
    const allergyHits = preferences.allergies.filter(a =>
      ns.some(n => n.includes(a.toLowerCase()))
    );
    if (allergyHits.length === 0) {
      reasons.push({ text: "Seçtiğin alerjen listesiyle içerik çakışması saptanmadı.", priority: 10 });
    } else {
      reasons.push({ text: `Dikkat: seçtiğin alerjenlere (${allergyHits.join(", ")}) benzer içerik tespit edildi.`, priority: 10 });
    }
  }

  if (preferences?.skinType) {
    const fragFree    = !hasAny(ns, ["parfum", "fragrance"]);
    const sulfateFree = !hasAny(ns, ["sodium lauryl sulfate"]);
    if (preferences.skinType === "sensitive" && fragFree && sulfateFree) {
      reasons.push({ text: "Parfüm ve sülfat içermediği için hassas cilt profilinle uyumlu.", priority: 9 });
    } else if (preferences.skinType === "oily" && hasAny(ns, ["salicylic acid", "niacinamide"])) {
      reasons.push({ text: "Yağlı cilt için faydalı aktifler (salisilik asit / niasinamid) içeriyor.", priority: 9 });
    } else if (preferences.skinType === "dry" && hasAny(ns, ["ceramide", "hyaluronic acid", "sodium hyaluronate"])) {
      reasons.push({ text: "Kuru cilt için bariyer destekleyici ve nem tutucu içerikler var.", priority: 9 });
    }
  }

  if (preferences?.skinConcerns?.length) {
    if (preferences.skinConcerns.includes("acne") && hasAny(ns, ["salicylic acid", "niacinamide"])) {
      reasons.push({ text: "Akne kaygınla uyumlu: BHA veya niasinamid içeriyor.", priority: 8 });
    }
    if (preferences.skinConcerns.includes("dehydration") && hasAny(ns, ["hyaluronic acid", "sodium hyaluronate"])) {
      reasons.push({ text: "Nem ihtiyacın için hyalüronik asit formülde mevcut.", priority: 8 });
    }
    if (preferences.skinConcerns.includes("spots") && hasAny(ns, ["niacinamide", "alpha arbutin", "kojic acid", "tranexamic acid"])) {
      reasons.push({ text: "Leke kaygın için uygun aydınlatıcı aktifler içeriyor.", priority: 8 });
    }
    if (preferences.skinConcerns.includes("redness") && hasAny(ns, ["centella asiatica", "cica", "allantoin", "panthenol"])) {
      reasons.push({ text: "Kızarıklık eğilimine karşı yatıştırıcı bileşenler formülde var.", priority: 8 });
    }
  }

  const hasFragrance = hasAny(ns, ["parfum", "fragrance"]);
  const hasAlcohol   = hasAny(ns, ["alcohol denat", "denatured alcohol", "sd alcohol"]);
  const hasSulfate   = hasAny(ns, ["sodium lauryl sulfate"]);

  if (!hasFragrance && !hasAlcohol && !hasSulfate) {
    reasons.push({ text: "Parfüm, sert alkol ve sülfat içermiyor — hassas formül profili.", priority: 7 });
  } else {
    if (hasFragrance) reasons.push({ text: "Parfüm içeriği nedeniyle koku hassasiyeti olan bireyler temkinli olmalı.", priority: 6 });
    if (hasAlcohol)   reasons.push({ text: "Sert alkol formülde mevcut; kuru ve hassas ciltlerde uzun vadeli etkiyi izleyin.", priority: 6 });
  }

  const score = product?.score ?? product?.dermo_score ?? null;
  if (score != null && score >= 80) {
    reasons.push({ text: `Güven puanı yüksek (${score}/100); içerik dengesi güçlü.`, priority: 5 });
  } else if (score != null && score >= 60) {
    reasons.push({ text: `İçerik profili dengeli (${score}/100); büyük çoğunluk için sorunsuz.`, priority: 4 });
  }

  const segment = ((product?.segment ?? "") as string).toLowerCase();
  if (segment === "seçkin") {
    reasons.push({ text: "Formül kalitesi ve içerik yoğunluğu üst segmenti yansıtıyor.", priority: 3 });
  } else if (segment === "ekonomik" && summary.rating !== "riskli") {
    reasons.push({ text: "Erişilebilir fiyat aralığına kıyasla içerik profili dengeli.", priority: 3 });
  }

  return reasons
    .sort((a, b) => b.priority - a.priority)
    .map(r => r.text)
    .slice(0, 4);
}

// ── 6. getSeckinDepthNotes — SADECE SEÇKİN ───────────────────────────────────
/**
 * Seçkin katman için "neden + nasıl + alternatif" üçlü derinlik notları.
 * Her not bir yeni bilgi katmanı — mevcut gerekçelerin uzatması değil.
 */

export interface SeckinDepthNote {
  category: "kullanım" | "alternatif" | "içerik";
  icon: string;
  text: string;
}

export function getSeckinDepthNotes(
  parsedIngredients: ParsedIngredient[],
  preferences?: { skinType?: string; skinConcerns?: string[]; specialConditions?: string[] },
): SeckinDepthNote[] {
  const notes: SeckinDepthNote[] = [];
  const ns = names(parsedIngredients);

  const hasRetinol     = hasAny(ns, ["retinol", "retinyl"]);
  const hasBHA         = hasAny(ns, ["salicylic acid"]);
  const hasAHA         = hasAny(ns, ["glycolic acid", "lactic acid", "mandelic acid"]);
  const hasHA          = hasAny(ns, ["hyaluronic acid", "sodium hyaluronate"]);
  const hasCeramide    = hasAny(ns, ["ceramide"]);
  const hasVitC        = hasAny(ns, ["ascorbic acid", "vitamin c", "l-ascorbic acid"]);
  const hasFragrance   = hasAny(ns, ["parfum", "fragrance"]);
  const hasAlcohol     = hasAny(ns, ["alcohol denat", "denatured alcohol", "sd alcohol"]);
  const hasSPF         = hasAny(ns, ["zinc oxide", "titanium dioxide", "avobenzone", "octinoxate"]);
  const hasNiacinamide = hasAny(ns, ["niacinamide"]);

  const sc       = preferences?.specialConditions ?? [];
  const skin     = preferences?.skinType          ?? null;
  const concerns = preferences?.skinConcerns      ?? [];

  const isSensitive = sc.includes("sensitive_skin") || skin === "sensitive";
  const isDry       = skin === "dry";
  const isAcneProne = sc.includes("acne_prone") || concerns.includes("acne");
  const isPregnant  = sc.includes("pregnancy") || sc.includes("breastfeeding");

  // ── Retinol ──────────────────────────────────────────────────────────────
  if (hasRetinol) {
    notes.push({
      category: "kullanım",
      icon: "moon",
      text: "Retinol: Başlangıçta haftada 2 gece, 4-6 haftadan sonra her geceye çıkılabilir. Gündüz SPF zorunlu.",
    });
    if (hasVitC) {
      notes.push({
        category: "içerik",
        icon: "info",
        text: "Retinol + C vitamini aynı anda sürülmez. C vitamini sabah, retinol gece tercih edilmeli.",
      });
    }
    if (isPregnant) {
      notes.push({
        category: "alternatif",
        icon: "shield",
        text: "Hamilelik / emzirme döneminde retinol yerine bakuchiol içeren alternatifler değerlendirilebilir.",
      });
    }
  }

  // ── BHA ──────────────────────────────────────────────────────────────────
  if (hasBHA) {
    notes.push({
      category: "kullanım",
      icon: "clock",
      text: "Salisilik asit (BHA): Haftada 2-3 geceden başlayın. Kuruluğa neden oluyorsa sıklığı düşürün; gece daha uygundur.",
    });
    if (isAcneProne && hasNiacinamide) {
      notes.push({
        category: "içerik",
        icon: "check-circle",
        text: "BHA + niasinamid kombinasyonu akne eğilimli ciltlerde hem gözenek temizleme hem kızarıklık kontrolü için güçlüdür.",
      });
    }
  }

  // ── AHA + hassas ─────────────────────────────────────────────────────────
  if (hasAHA && isSensitive) {
    notes.push({
      category: "kullanım",
      icon: "alert-circle",
      text: "AHA asit hassas ciltlerde ilk 2 haftada haftada 1 gece kullanılmalı; tahriş varsa sıklığı azaltın.",
    });
    notes.push({
      category: "alternatif",
      icon: "arrow-right",
      text: "Hassas cilt için glikolik asit yerine laktik asit daha nazik bir başlangıç alternatifidir.",
    });
  }

  // ── C vitamini ───────────────────────────────────────────────────────────
  if (hasVitC && !hasRetinol) {
    notes.push({
      category: "kullanım",
      icon: "sun",
      text: "C vitamini sabah SPF'den önce uygulandığında antioksidan koruma etkisi en yüksektir.",
    });
  }

  // ── Ceramide + HA ────────────────────────────────────────────────────────
  if (hasCeramide && hasHA) {
    notes.push({
      category: "kullanım",
      icon: "droplet",
      text: "Seramid + hyalüronik asit: Hafif nemliyken uygulamak nem kapatma etkisini belirgin biçimde artırır.",
    });
  }

  // ── Parfüm + hassas ──────────────────────────────────────────────────────
  if (hasFragrance && isSensitive) {
    notes.push({
      category: "alternatif",
      icon: "arrow-right",
      text: "Hassas cilt için uzun vadede parfümsüz (fragrance-free) bir alternatife geçiş tolerans açısından daha güvenlidir.",
    });
  }

  // ── Alkol + kuru ─────────────────────────────────────────────────────────
  if (hasAlcohol && isDry) {
    notes.push({
      category: "alternatif",
      icon: "arrow-right",
      text: "Kuru cilt için alkol içermeyen bir alternatif uzun vadeli bariyer bütünlüğü açısından daha uygundur.",
    });
  }

  // ── SPF ──────────────────────────────────────────────────────────────────
  if (hasSPF) {
    notes.push({
      category: "kullanım",
      icon: "sun",
      text: "Güneş filtreleri güneşe çıkmadan 15-20 dakika önce uygulanmalı; 2-3 saatte bir yenilenmeli.",
    });
  }

  return notes.slice(0, 4);
}
