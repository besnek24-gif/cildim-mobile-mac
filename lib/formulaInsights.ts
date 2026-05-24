/**
 * formulaInsights.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Muhteva sekmesi için merkezi akıllı yorum fonksiyonları.
 *
 * getFormulaSummary        — Formülün genel profili (başlık + destek maddeleri)
 * getHighlightedIngredients — En kritik 4-6 içerik (aktif → risk → karakteristik)
 * getCautionNotes          — Dikkat noktaları (eczacı tonu, alarm dili YOK)
 * getPharmacistComment     — 2-3 cümlelik uzman yorumu
 */

import type { IngredientSummary, ParsedIngredient, RiskLevel } from "./ingredientAnalysis";

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface FormulaSummary {
  headline: string;
  points: string[];
}

export interface HighlightedIngredient {
  name: string;
  nameTr: string;
  desc: string;
  level: RiskLevel;
  priority: "active" | "beneficial" | "caution" | "characteristic";
}

// ── Aktif / yıldız bileşen tespiti ───────────────────────────────────────────

const ACTIVE_INGREDIENTS: Record<string, { nameTr: string; role: string }> = {
  niacinamide:        { nameTr: "Niasinamid",        role: "Leke karşıtı, gözenek sıkılaştırıcı aktif" },
  "hyaluronic acid":  { nameTr: "Hyalüronik Asit",   role: "Güçlü nem bağlayıcı aktif" },
  "sodium hyaluronate":{ nameTr: "Sodyum Hyalüronat", role: "Derin nem bağlayıcı, düşük mol ağırlığı" },
  "salicylic acid":   { nameTr: "Salisilik Asit",    role: "BHA – gözenek temizleyici, akne karşıtı" },
  "glycolic acid":    { nameTr: "Glikolik Asit",     role: "AHA – yüzey yenileyici eksfoliant" },
  "lactic acid":      { nameTr: "Laktik Asit",       role: "AHA – nazik eksfoliant, nem bağlayıcı" },
  retinol:            { nameTr: "Retinol",            role: "A vitamini – hücre yenileme, yaşlanma karşıtı" },
  retinyl:            { nameTr: "Retinol türevi",     role: "A vitamini türevi, daha nazik etki" },
  "vitamin c":        { nameTr: "C Vitamini",         role: "Antioksidan, aydınlatıcı aktif" },
  "ascorbic acid":    { nameTr: "Askorbik Asit",      role: "C Vitamini – güçlü antioksidan" },
  "ascorbyl glucoside":{ nameTr: "C Vitamini türevi", role: "Kararlı C Vitamini, aydınlatıcı" },
  ceramide:           { nameTr: "Seramid",            role: "Bariyer onarıcı, nem koruyucu lipid" },
  "centella asiatica": { nameTr: "Centella",           role: "Yatıştırıcı, bariyer destekleyici bitki özü" },
  "cica":             { nameTr: "Cica",               role: "Yatıştırıcı bitkisel aktif" },
  "azelaic acid":     { nameTr: "Azelaik Asit",       role: "Akne ve leke karşıtı, anti-inflamatuar" },
  peptide:            { nameTr: "Peptid",             role: "Cilt sıkılaştırıcı, yaşlanma karşıtı aktif" },
  "matrixyl":         { nameTr: "Matrixyl",           role: "Kırışıklık karşıtı peptid bileşimi" },
  "zinc oxide":       { nameTr: "Çinko Oksit",        role: "Fiziksel UVA/UVB filtresi" },
  "titanium dioxide": { nameTr: "Titanyum Dioksit",   role: "Fiziksel UV filtresi" },
  "avobenzone":       { nameTr: "Avobenzoon",          role: "Kimyasal UVA filtresi" },
  "octinoxate":       { nameTr: "Oktinoksat",          role: "Kimyasal UVB filtresi" },
  "adenosine":        { nameTr: "Adenozin",            role: "Kırışıklık karşıtı, sıkılaştırıcı" },
  "panthenol":        { nameTr: "Panthenol",           role: "B5 provitamini – yatıştırıcı, nemli tutucu" },
  "allantoin":        { nameTr: "Allantoin",           role: "Yatıştırıcı, iyileştirici etken" },
  "caffeine":         { nameTr: "Kafein",              role: "Antioksidan, can alıcı damar daraltıcı" },
  "licorice root":    { nameTr: "Meyan Kökü",          role: "Aydınlatıcı, anti-inflamatuar özü" },
  "kojic acid":       { nameTr: "Kojik Asit",          role: "Leke karşıtı, melanin üretimini yavaşlatır" },
  "alpha arbutin":    { nameTr: "Alfa Arbutin",        role: "Leke karşıtı, nazik aydınlatıcı" },
  "tranexamic acid":  { nameTr: "Traneksamik Asit",    role: "Pigmentasyon karşıtı aktif" },
  "bakuchiol":        { nameTr: "Bakuchiol",           role: "Bitkisel retinol alternatifi" },
};

// Sıradan taşıyıcı / dolgu bileşenler — öne çıkarma
const CARRIER_KEYWORDS = [
  "water", "aqua", "butylene glycol", "carbomer", "xanthan gum",
  "sodium hydroxide", "tetrasodium edta", "disodium edta", "edta",
  "polyacrylate", "acrylate", "triethanolamine", "citric acid",
  "potassium hydroxide", "methylpropanediol", "1,2-hexanediol",
  "caprylyl glycol", "disodium", "trisodium", "ethylhexylglycerin",
];

function isCarrier(name: string): boolean {
  const lc = name.toLowerCase();
  return CARRIER_KEYWORDS.some(k => lc === k || lc.startsWith(k + " "));
}

function matchActive(name: string): { nameTr: string; role: string } | null {
  const lc = name.toLowerCase();
  for (const [key, val] of Object.entries(ACTIVE_INGREDIENTS)) {
    if (lc === key || lc.includes(key)) return val;
  }
  return null;
}

// ── 1. getFormulaSummary ──────────────────────────────────────────────────────

export function getFormulaSummary(
  summary: IngredientSummary,
  badges?: Array<{ key: string; status: string }>,
): FormulaSummary {
  if (summary.total === 0) {
    return {
      headline: "İçerik verisi henüz eklenmemiş.",
      points: [],
    };
  }

  // Başlık: rating'e göre
  const headlineMap: Record<string, string> = {
    cok_iyi: "Formül güvenli ve temiz bir profil sergiliyor.",
    iyi:     "Formül genel olarak dengeli ve günlük kullanıma uygun.",
    orta:    "Formülde bazı dikkat gerektiren bileşenler yer alıyor.",
    dikkat:  "Formülde hassas içerikler öne çıkıyor; kullanım tipi önemli.",
    riskli:  "Formülde risk sinyali taşıyan bileşenler tespit edildi.",
  };
  const headline = headlineMap[summary.rating] ?? "Formül analiz edildi.";

  // Destek maddeleri
  const points: string[] = [];
  const knownTotal = summary.safe + summary.low + summary.medium + summary.high;
  const knownRatio = summary.total > 0 ? knownTotal / summary.total : 0;

  if (summary.high === 0 && summary.medium <= 1) {
    points.push("Belirgin risk sinyali düşük.");
  } else if (summary.high > 0) {
    points.push(`${summary.high} içerik daha yakından inceleme gerektirebilir.`);
  }

  if (summary.unknown > summary.total * 0.5) {
    points.push("Birçok bileşen henüz veri tabanımızda yer almıyor; analiz kısmi.");
  } else if (knownRatio > 0.7) {
    points.push("İçeriklerin büyük çoğunluğu değerlendirilebildi.");
  }

  // Badge ipuçları
  if (badges) {
    const fragFree = badges.find(b => b.key === "fragrance")?.status === "positive";
    const parabenFree = badges.find(b => b.key === "paraben")?.status === "positive";
    if (fragFree && parabenFree) {
      points.push("Parfüm ve paraben içermiyor — hassas ciltler için daha güvenli seçenek.");
    } else if (fragFree) {
      points.push("Parfüm içermiyor — koku hassasiyeti olanlara daha uygun.");
    }
  }

  return { headline, points: points.slice(0, 2) };
}

// ── 2. getHighlightedIngredients ─────────────────────────────────────────────

export function getHighlightedIngredients(
  parsedIngredients: ParsedIngredient[],
  icerikAnalizi: any[] = [],
  maxCount = 6,
): HighlightedIngredient[] {
  const results: HighlightedIngredient[] = [];
  const seen = new Set<string>();

  // Önce EWG/CIR veritabanından gelen analiz edilen içerikler (beneficial/high_concern)
  for (const ing of icerikAnalizi) {
    const name: string = ing.isim ?? ing.inci_adi ?? "";
    if (!name || seen.has(name.toLowerCase())) continue;
    const lc = name.toLowerCase();
    // Sadece önemli olanları al
    const active = matchActive(lc);
    if (active || (ing.guvenlik_skoru != null && (ing.guvenlik_skoru < 50 || ing.guvenlik_skoru >= 80))) {
      seen.add(lc);
      const score = ing.guvenlik_skoru ?? 60;
      const level: RiskLevel = score >= 70 ? "safe" : score >= 40 ? "medium_risk" : "high_risk";
      results.push({
        name,
        nameTr: active?.nameTr ?? ing.inci_adi ?? name,
        desc: active?.role ?? ing.aciklama ?? ing.uyari ?? "",
        level,
        priority: active ? "active" : score < 50 ? "caution" : "beneficial",
      });
    }
  }

  // Sonra kural tabanlı parsed ingredients
  for (const ing of parsedIngredients) {
    if (results.length >= maxCount) break;
    const lc = ing.name.toLowerCase();
    if (seen.has(lc) || isCarrier(lc)) continue;

    const active = matchActive(lc);
    if (active) {
      seen.add(lc);
      results.push({
        name: ing.name,
        nameTr: active.nameTr,
        desc: active.role,
        level: ing.level === "unknown" ? "safe" : ing.level,
        priority: "active",
      });
      continue;
    }

    if (ing.level === "high_risk") {
      seen.add(lc);
      results.push({
        name: ing.name,
        nameTr: ing.nameTr !== ing.name ? ing.nameTr : ing.name,
        desc: ing.desc,
        level: ing.level,
        priority: "caution",
      });
      continue;
    }

    if (ing.level === "medium_risk") {
      seen.add(lc);
      results.push({
        name: ing.name,
        nameTr: ing.nameTr !== ing.name ? ing.nameTr : ing.name,
        desc: ing.desc,
        level: ing.level,
        priority: "caution",
      });
    }
  }

  // Eğer hâlâ az içerik varsa: ilk birkaç non-carrier ingredient'ı ekle
  if (results.length < 3) {
    for (const ing of parsedIngredients) {
      if (results.length >= maxCount) break;
      const lc = ing.name.toLowerCase();
      if (seen.has(lc) || isCarrier(lc)) continue;
      seen.add(lc);
      results.push({
        name: ing.name,
        nameTr: ing.nameTr !== ing.name ? ing.nameTr : ing.name,
        desc: ing.desc,
        level: ing.level,
        priority: "characteristic",
      });
    }
  }

  // Sıralama: aktif > dikkat > faydalı > karakteristik
  const ORDER = { active: 0, caution: 1, beneficial: 2, characteristic: 3 };
  return results
    .sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
    .slice(0, maxCount);
}

// ── 3. getCautionNotes ───────────────────────────────────────────────────────

export function getCautionNotes(
  summary: IngredientSummary,
  parsedIngredients: ParsedIngredient[],
): string[] {
  if (summary.total === 0) return [];

  const notes: string[] = [];
  const names = parsedIngredients.map(i => i.name.toLowerCase());

  const hasFragrance = names.some(n => ["parfum", "fragrance", "perfume"].some(k => n === k || n.includes(k)));
  const hasAlcohol   = names.some(n => ["alcohol denat", "denatured alcohol", "sd alcohol", "isopropyl alcohol"].some(k => n === k || n.includes(k)));
  const hasParaben   = names.some(n => n.includes("paraben"));
  const hasSulfate   = names.some(n => ["sodium lauryl sulfate", "sls", "sodium laureth sulfate"].some(k => n === k || n.includes(k)));
  const hasMit       = names.some(n => n.includes("isothiazolinone"));

  if (hasFragrance) notes.push("Parfüm içerdiği için hassas ve alerjik ciltlerde dikkat gerektirebilir.");
  if (hasAlcohol)   notes.push("Kurutucu alkol içeriyor; cilt kuruluğu eğiliminde olanlarda miktarı göz önünde bulundurulmalı.");
  if (hasSulfate)   notes.push("Sülfat bileşeni cilt bariyerini zayıflatabilir; sık ve uzun süreli kullanımda dikkat edilmeli.");
  if (hasParaben)   notes.push("Paraben koruyucu içeriyor; hormonal hassasiyeti olanlar tercih dışı bırakabilir.");
  if (hasMit)       notes.push("Metilizotiyazolinon (MIT) alerjik kontakt dermatite yol açabilecek güçlü bir koruyucudur.");

  if (notes.length === 0) {
    notes.push("Belirgin bir hassasiyet uyarısı öne çıkmıyor.");
  }

  return notes.slice(0, 3);
}

// ── 4. getPharmacistComment ──────────────────────────────────────────────────

export function getPharmacistComment(
  product: any,
  summary: IngredientSummary,
  parsedIngredients: ParsedIngredient[],
): string {
  if (summary.total === 0) return "";

  const category  = ((product?.category ?? product?.kategori ?? "") as string).toLowerCase();
  const segment   = ((product?.segment ?? "") as string).toLowerCase();
  const score     = product?.score ?? product?.dermo_score ?? null;
  const names     = parsedIngredients.map(i => i.name.toLowerCase());

  // Cümle 1: Formül güç değerlendirmesi
  let s1 = "";
  if (summary.rating === "cok_iyi" || summary.rating === "iyi") {
    s1 = "Formül genel olarak dengeli ve günlük kullanıma uygun bir içerik yapısı sunuyor.";
  } else if (summary.rating === "orta") {
    s1 = "Formülde dikkat gerektiren birkaç bileşen yer alıyor; ancak genel profil ortalama bir dengede.";
  } else {
    s1 = "Formül bazı bileşenler açısından daha dikkatli bir kullanım gerektiriyor.";
  }

  // Cümle 2: Kime hitap ediyor
  let s2 = "";
  const hasActives = parsedIngredients.some(i => {
    const lc = i.name.toLowerCase();
    return Object.keys(ACTIVE_INGREDIENTS).some(k => lc.includes(k));
  });

  if (category.includes("güneş") || category.includes("sun")) {
    s2 = "Güneş koruma kategorisinde, UV filtre yapısı ön planda tutuluyor.";
  } else if (category.includes("nemlendirici") || category.includes("moistur")) {
    s2 = "Nemlendirici formül; bariyer desteği ve uzun süreli nem tutma önceliklendiriliyor.";
  } else if (category.includes("temizleyici") || category.includes("clean")) {
    s2 = "Temizleyici formülü nazik kullanım için optimize edilmiş görünüyor.";
  } else if (hasActives && segment === "seçkin") {
    s2 = "Aktif içerikleri güçlü ve formül kalitesi üst segmenti yansıtıyor.";
  } else if (hasActives) {
    s2 = "Aktif içerik profili var; hedefli bakım arayanlar için uygun bir seçenek.";
  } else if (segment === "ekonomik") {
    s2 = "Temel bakım ihtiyacını karşılamaya yönelik sade bir formül profili sunuyor.";
  }

  // Cümle 3: Kritik uyarı (varsa)
  let s3 = "";
  const hasFragrance = names.some(n => ["parfum", "fragrance"].some(k => n === k || n.includes(k)));
  const hasAlcohol   = names.some(n => ["alcohol denat", "denatured alcohol", "sd alcohol"].some(k => n === k || n.includes(k)));
  const hasSulfate   = names.some(n => ["sodium lauryl sulfate"].some(k => n.includes(k)));

  if (summary.high >= 2) {
    s3 = "Birden fazla yüksek riskli içerik içerdiği için özellikle hassas ve kuru ciltlerde temkinli yaklaşılması önerilir.";
  } else if (hasFragrance && hasAlcohol) {
    s3 = "Parfüm ve alkol içeriği nedeniyle hassas ciltlerde dikkatli kullanılmalı.";
  } else if (hasFragrance) {
    s3 = "Parfüm içeriği nedeniyle çok hassas ciltlerde temkinli kullanılabilir.";
  } else if (hasAlcohol) {
    s3 = "Alkol içeriği nedeniyle kuru ve hassas ciltlerde kullanım sıklığı göz önünde bulundurulmalı.";
  } else if (hasSulfate) {
    s3 = "SLS içeriği nedeniyle cilt bariyeri hassas kişilerde dikkatli kullanım önerilebilir.";
  }

  const parts = [s1, s2, s3].filter(Boolean);
  return parts.join(" ");
}
