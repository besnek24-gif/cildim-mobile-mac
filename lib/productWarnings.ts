/**
 * productWarnings.ts  —  v3 "Rehber Eczacı"
 *
 * Uyarı üretmekle kalmaz, kullanıcıyı nazikçe daha iyi bir seçime yönlendirir.
 * Her uyarı isteğe bağlı bir `suggestion` içerir:
 *   - "alternative" → benzer ama daha uyumlu ürünlere yönlendir
 *   - "category"    → ürün kategorisi/özellik ipucu ver
 *   - "none"        → öneri yok (tıbbi uyarılar vb.)
 */

import type { SmartWarning } from "@/lib/smartWarningEngine";
import type { UserPreferences } from "@/lib/userPreferences";
import {
  resolvePregnancyVerdict,
  resolveBreastfeedingVerdict,
  resolveAllergenMatch,
} from "@/lib/features/featureTruth";

// ─── Public types ─────────────────────────────────────────────────────────────

/** Uyarı altında görünen yönlendirici öneri */
export interface Suggestion {
  /** Öneri türü */
  suggestionType: "alternative" | "category" | "none";
  /**
   * Eczacı sesinde kısa yönlendirici cümle.
   * "Bu cilt tipine daha uygun seçenekler mevcut…" gibi.
   */
  message: string;
  /**
   * "alternative" → boş (benzerleri sayfası açılır)
   * "category"    → kullanıcıya ne araması gerektiğini söyler
   *                 örn: "mineral güneş koruyucu"
   */
  categoryHint?: string;
}

/** SmartWarning + isteğe bağlı yönlendirme önerisi */
export type SmartWarningWithSuggestion = SmartWarning & {
  suggestion?: Suggestion;
};

export interface ProductWarningResult {
  warnings:  SmartWarningWithSuggestion[];
  fitScore:  number;
}

// ─── İç tip: ham aday uyarı ──────────────────────────────────────────────────

interface Candidate {
  warning:  SmartWarningWithSuggestion;
  weight:   number;
  penalty:  number;
}

// ─── Sabit sinyal listeleri ───────────────────────────────────────────────────

const PREGNANCY_RISKY = [
  "retinol", "retinyl palmitate", "retinyl acetate", "tretinoin", "retinoic acid",
  "salicylic acid", "benzoyl peroxide", "hydroquinone", "formaldehyde",
  "beta hydroxy", "glycolic acid", "lactic acid", "mandelic acid",
];

const ALLERGY_SIGNALS: Record<string, string[]> = {
  fragrance:    ["parfum", "fragrance", "perfume", "aroma"],
  alcohol:      ["alcohol denat", "denatured alcohol", "sd alcohol", "isopropyl alcohol"],
  essential_oil:["lavandula", "melaleuca", "citrus aurantium", "eucalyptus", "tea tree",
                 "rosmarinus", "mentha piperita", "peppermint", "lemongrass", "cymbopogon"],
  paraben:      ["methylparaben", "propylparaben", "ethylparaben", "butylparaben", "isobutylparaben"],
  silicone:     ["dimethicone", "cyclomethicone", "cyclopentasiloxane", "cyclohexasiloxane", "siloxane"],
  sulfate:      ["sodium lauryl sulfate", "sls", "sodium laureth sulfate", "sles", "ammonium lauryl sulfate"],
  nut:          ["prunus amygdalus", "almond oil", "juglans regia", "walnut",
                 "corylus avellana", "hazelnut", "macadamia", "pistacia"],
  latex:        ["latex", "natural rubber", "hevea brasiliensis"],
  lanolin:      ["lanolin", "lanolin alcohol", "wool wax", "adeps lanae"],
  gluten:       ["triticum vulgare", "wheat", "hydrolyzed wheat", "avena sativa", "oat", "barley", "secale"],
  nickel:       ["nickel sulfate", "nickel"],
};

const ALLERGY_LABELS: Record<string, string> = {
  fragrance: "parfüm", alcohol: "alkol", essential_oil: "esansiyel yağ",
  paraben: "paraben", silicone: "silikon", sulfate: "sülfat",
  nut: "kuruyemiş yağı", latex: "lateks", lanolin: "lanolin",
  gluten: "gluten", nickel: "nikel",
};

const DRYING_ALCOHOL   = ["alcohol denat", "denatured alcohol", "sd alcohol", "isopropyl alcohol"];
const FRAGRANCE_SIGNALS = ["parfum", "fragrance", "perfume", "aroma", "lavandula", "melaleuca",
  "eucalyptus", "tea tree", "mentha piperita", "peppermint", "lemongrass", "cymbopogon"];
const PHOTOSENSITIZERS  = ["bergamot", "citrus bergamia", "lemon peel", "lime oil",
  "citrus limon", "citrus aurantifolia", "st. john", "hypericum"];

const SUNSCREEN_CAT = ["güneş", "sunscreen", "spf", "solar", "güneş koruma", "sun care"];
const CLEANSER_CAT  = ["temizleyici", "cleanser", "yıkama", "sabun", "tonic", "tonik", "misel"];

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function inCategory(cat: string, signals: string[]): boolean {
  const c = cat.toLowerCase();
  return signals.some(s => c.includes(s));
}

function hasIngredient(ingredients: string, signals: string[]): boolean {
  return signals.some(s => ingredients.includes(s));
}

function severityOrder(s: "high" | "medium" | "low"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

export function evaluateProductWarnings(
  product: Record<string, any>,
  prefs: Pick<
    UserPreferences,
    "allergies" | "specialConditions" | "allergyIngredients" | "avoidedIngredients" | "skinType"
  >,
): ProductWarningResult {

  // Veri normalizasyonu
  const _ingRaw = product.ingredients ?? product.icindekiler ?? "";
  const ingredients     = (Array.isArray(_ingRaw) ? _ingRaw.join(",") : String(_ingRaw)).toLowerCase();
  const allergy_info    = ((product.allergy_info     ?? product.alerji_bilgi ?? "") as string).toLowerCase();
  // NOT: pregnancy_use & breastfeeding_u FEATURE TRUTH LAYER tarafından
  //      gerektiğinde "caution"a yükseltilebilir (sadece ESCALATION; downgrade YOK).
  let pregnancy_use     = ((product.pregnancy_use   ?? product.hamilelik   ?? "") as string).toLowerCase();
  let breastfeeding_u   = ((product.breastfeeding_use ?? product.emzirme   ?? "") as string).toLowerCase();

  // ─── FEATURE TRUTH LAYER (additive top-injection) ─────────────────────────
  // Hamilelik: pregnancy_safe + pregnancy_use + ingredient → tek karar.
  // Emzirme : breastfeeding_use + ingredient → ayrı tek karar (audit
  //   2026-05-04 fix #3: önceden pregnancy avoid'tan piggyback ediliyordu;
  //   bu yüzden breastfeeding_use="Önerilmez" / "Uygun değildir" olan ürünler
  //   pregnancy temizse uyarı sessiz kalıyordu).
  const _truthPreg   = resolvePregnancyVerdict(product);
  const _truthBreast = resolveBreastfeedingVerdict(product);
  if (_truthPreg.status === "avoid" || _truthPreg.status === "caution") {
    if (pregnancy_use !== "caution") pregnancy_use = "caution";
  }
  if (_truthBreast.status === "avoid" || _truthBreast.status === "caution") {
    if (breastfeeding_u !== "caution") breastfeeding_u = "caution";
  }

  // Truth allergen eşleşmesi — mevcut allergyIngredients (alis) bloğuna ek
  // sinyal sağlar (lowercase/trim normalizasyonu, eksik girdileri yakalar).
  const _truthAllergen = resolveAllergenMatch(product, {
    allergyIngredients: prefs.allergyIngredients,
    avoidedIngredients: prefs.avoidedIngredients,
    allergies: prefs.allergies,
  });
  void _truthAllergen; // mevcut bloklarla çakışmaz; sticky liste zaten kapsıyor
  const category        = ((product.category        ?? product.kategori    ?? "") as string).toLowerCase();
  const features: string[] = Array.isArray(product.features)
    ? product.features : Array.isArray(product.ozellikler) ? product.ozellikler : [];

  const sc   = prefs.specialConditions ?? [];
  const al   = prefs.allergies ?? [];
  const alis = prefs.allergyIngredients ?? [];
  const avis = prefs.avoidedIngredients ?? [];
  const skin = prefs.skinType;

  const hasSensitiveCondition = sc.includes("sensitive_skin") || sc.includes("rosacea") || sc.includes("eczema");
  const isSunscreen           = inCategory(category, SUNSCREEN_CAT);
  const isCleanser            = inCategory(category, CLEANSER_CAT);

  const candidates: Candidate[] = [];
  let fitScore = 100;

  // ══════════════════════════════════════════════════════════════════════
  // GRUP 1 — GÜVENLİK
  // ══════════════════════════════════════════════════════════════════════

  // 1a. Hamilelik
  if (sc.includes("pregnancy")) {
    const markedCaution   = pregnancy_use === "caution";
    const riskyIngredient = ingredients ? hasIngredient(ingredients, PREGNANCY_RISKY) : false;
    if (markedCaution || riskyIngredient) {
      const penalty = markedCaution ? 28 : 22;
      fitScore -= penalty;
      candidates.push({
        weight: 100, penalty,
        warning: {
          id: "pw_pregnancy", type: "pregnancy", severity: "high",
          title:   "Hamilelik sürecinizde dikkat",
          message: markedCaution
            ? "Bu ürünü hamileliğiniz sırasında kullanmadan önce doktorunuza bir kez danışmanızı öneririm — ihtiyatlı olmak her zaman daha iyi."
            : "İçeriklerde hamilelik döneminde önerilmeyen aktifler tespit ettim. Uzman onayı almadan kullanmaktan kaçının.",
          premiumDetail: "A vitamini türevleri (retinol, tretinoin), yüksek doz BHA ve hidroquinon hamileliğin özellikle ilk trimesterinde en dikkatli olunan içerikler arasındadır.",
          suggestion: { suggestionType: "none", message: "" },
        },
      });
    }
  }

  // 1b. Emzirme
  if (sc.includes("breastfeeding")) {
    const markedCaution   = breastfeeding_u === "caution";
    const riskyIngredient = ingredients ? hasIngredient(ingredients, PREGNANCY_RISKY) : false;
    if (markedCaution || riskyIngredient) {
      fitScore -= 22;
      candidates.push({
        weight: 98, penalty: 22,
        warning: {
          id: "pw_breastfeeding", type: "pregnancy", severity: "high",
          title:   "Emzirme döneminde değerlendirin",
          message: "Bazı aktif içerikler deri yoluyla emilip anne sütüne geçebilir. Bu ürünü kullanmadan önce hekiminizin görüşünü almak iyi olur.",
          premiumDetail: "Emzirme sürecinde retinoller, yüksek konsantrasyonlu kimyasal peelingler ve hidroquinon özellikle gözden geçirilmesi gereken içeriklerdir.",
          suggestion: { suggestionType: "none", message: "" },
        },
      });
    }
  }

  // 1c. Alerji anahtar eşleşmesi
  if (al.length > 0) {
    const combined = `${ingredients} ${allergy_info}`;
    const matched  = al.filter(key => {
      const signals = ALLERGY_SIGNALS[key];
      return signals ? signals.some(s => combined.includes(s)) : false;
    });
    if (matched.length > 0) {
      const named   = matched.map(k => ALLERGY_LABELS[k] ?? k).join(", ");
      const penalty = Math.min(matched.length * 28, 45);
      fitScore -= penalty;
      candidates.push({
        weight: 95, penalty,
        warning: {
          id: "pw_allergy", type: "allergy", severity: "high",
          title:   "Duyarlı olduğunuz içerik",
          message: matched.length === 1
            ? `Profilinizde ${named} duyarlılığı belirtmişsiniz — bu üründe bu içerik grubu mevcut.`
            : `${named} duyarlılıklarını profilinize eklemiştiniz; bu üründe bunların bir kısmı yer alıyor.`,
          premiumDetail: "Alerjik temas dermatiti kümülatif maruziyetle şiddetlenebilir. Duyarlı olduğunuz içeriklere içerik listesinde dikkatle bakmaya devam etmenizi öneririm.",
          suggestion: {
            suggestionType: "alternative",
            message: "Duyarlılığınızı tetikleyebilecek bu içeriklerden arındırılmış benzer ürünler de mevcut olabilir.",
          },
        },
      });
    }
  }

  // 1d. Kişisel alerjen (serbest metin)
  if (ingredients && alis.length > 0) {
    const matched = alis.filter(ai => ingredients.includes(ai.toLowerCase()));
    if (matched.length > 0) {
      fitScore -= 30;
      candidates.push({
        weight: 93, penalty: 30,
        warning: {
          id: "pw_allergy_ingredient", type: "allergy", severity: "high",
          title:   "Daha önce reaksiyon yaşadığınız içerik",
          message: `"${matched.slice(0, 2).join('", "')}" — daha önce reaksiyon yaşadığınızı not almıştım. Bu üründe bu içerik bulunuyor.`,
          suggestion: {
            suggestionType: "alternative",
            message: "Bu içeriği barındırmayan benzer alternatifler arasından seçim yapabilirsiniz.",
          },
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // GRUP 2 — UYUMLULUK
  // ══════════════════════════════════════════════════════════════════════

  // 2a. Hassas cilt / Rosacea / Egzama + tahriş edici içerik
  if (hasSensitiveCondition && !features.includes("sensitive_skin_friendly") && ingredients) {
    const hasAlcohol    = hasIngredient(ingredients, DRYING_ALCOHOL);
    const hasFragrance  = hasIngredient(ingredients, FRAGRANCE_SIGNALS);
    const irritantFound = hasAlcohol || hasFragrance;
    const mitigated     = isSunscreen && hasAlcohol && !hasFragrance;

    if (irritantFound && !mitigated) {
      const severity = sc.includes("rosacea") ? "high" : "medium";
      const penalty  = severity === "high" ? 18 : 14;
      fitScore -= penalty;

      const contextDetail = sc.includes("rosacea")
        ? "Rozasealı ciltlerde bu tür bileşenler yüzün merkezinde kızarıklık ve yanma hissini kolayca tetikleyebilir."
        : sc.includes("eczema")
        ? "Egzama eğilimli ciltlerde tahriş edici içerikler bariyeri daha da zayıflatabilir — mümkünse fragrans-free alternatifler tercih edin."
        : "Hassas ciltler için tahriş edici içerikler içeren ürünleri ilk kullanımda boyun veya bilek içine küçük miktarda test etmenizi öneririm.";

      const suggestionMsg = isSunscreen
        ? "Hassas cildiniz için mineral filtreli güneş kremleri (çinko oksit, titanyum dioksit) genellikle çok daha yumuşak bir deneyim sunar."
        : "Daha sakin ve tahriş edici madde içermeyen bir formül, hassas cildiniz için çok daha konforlu olabilir.";

      const categoryHint = isSunscreen ? "mineral güneş koruyucu" : "hassas cilt uyumlu ürün";

      candidates.push({
        weight: severity === "high" ? 80 : 65, penalty,
        warning: {
          id: "pw_sensitive", type: "sensitivity", severity,
          title:   "Hassas cildinizdeki risk",
          message: hasAlcohol && hasFragrance
            ? "Hem alkol hem parfüm içeren bu formül, hassas cildinizde zaman zaman kızarıklık ya da kuruluk yaratabilir."
            : hasAlcohol
            ? "Bu üründeki alkol içeriği hassas cildinizde kuruluk ve gerginlik hissi oluşturabilir."
            : "Bu üründeki parfüm/koku bileşenleri hassas cildinizde tahriş riski taşıyabilir.",
          premiumDetail: contextDetail,
          suggestion: {
            suggestionType: "category",
            message: suggestionMsg,
            categoryHint,
          },
        },
      });
    }
  }

  // 2b. Kuru cilt + oil_control / matte_finish
  if (skin === "dry" && (features.includes("oil_control") || features.includes("matte_finish"))) {
    fitScore -= 13;
    candidates.push({
      weight: 55, penalty: 13,
      warning: {
        id: "pw_dry_oilcontrol", type: "combination", severity: "medium",
        title:   "Cilt tipinizle uyuşmuyor olabilir",
        message: "Mat bitiş ürünleri yağ üretimini azaltmak için formüle edilir; kuru cildinizde ek kuruluk ve sıkışma hissi yaratabilir.",
        premiumDetail: "Kuru ciltler için ceramide, hyaluronik asit veya şea yağı ağırlıklı nemlendirici bazlı ürünler çok daha destekleyici bir deneyim sunar.",
        suggestion: {
          suggestionType: "category",
          message: "Kuru cildinize daha destekleyici seçenekler çok daha konforlu hissettiriyor olabilir — ceramide ya da şea yağı içerenler iyi bir başlangıç.",
          categoryHint: "kuru cilt nemlendirici",
        },
      },
    });
  }

  // 2c. Yağlı cilt + ağır nemlendirici
  if (skin === "oily" && features.includes("hydrating") && !features.includes("oil_control") && !features.includes("light_texture")) {
    fitScore -= 8;
    candidates.push({
      weight: 42, penalty: 8,
      warning: {
        id: "pw_oily_heavy", type: "combination", severity: "low",
        title:   "Hafif bir not",
        message: "Yağlı ciltler için yoğun nemlendirici formüller bazen parlaklığı artırabilir. Jel ya da oil-free alternatifler daha rahat hissettiriyor olabilir.",
        premiumDetail: "Yağlı veya karma ciltlerde niacinamide, salisilik asit veya hafif hyaluronik asit bazlı serumlar hem nemi destekler hem de mat görünümü korur.",
        suggestion: {
          suggestionType: "category",
          message: "Jel ya da su bazlı hafif formüller yağlı ciltlerde hem nemi dengeler hem de parlak görünümü minimize eder.",
          categoryHint: "yağsız nemlendirici",
        },
      },
    });
  }

  // 2d. Akneye yatkın + comedogenic risk
  if (sc.includes("acne_prone") && !features.includes("non_comedogenic") && !features.includes("acne_prone_friendly")) {
    fitScore -= 12;
    candidates.push({
      weight: 58, penalty: 12,
      warning: {
        id: "pw_acne", type: "sensitivity", severity: "medium",
        title:   "Akneye yatkın ciltler için not",
        message: "Bu ürün özellikle akneli ciltler gözetilerek formüle edilmemiş. Gözenek tıkayıcı bileşenler açısından içerik listesini incelemenizi öneririm.",
        premiumDetail: "Hindistan cevizi yağı, kakao yağı, izopropil miristrat ve bazı bitki yağları yüksek komedojenik potansiyellidir. Non-comedogenic damgası olmayan ürünlerde bu içerikler gözenek tıkanmasına yol açabilir.",
        suggestion: {
          suggestionType: "alternative",
          message: "Akneye yatkın ciltler için gözenek dostu olduğu onaylı benzer ürünlere göz atmak isteyebilirsiniz.",
        },
      },
    });
  }

  // 2e. Çocuk için kullanım
  if (sc.includes("for_child") && !features.includes("baby_friendly")) {
    fitScore -= 18;
    candidates.push({
      weight: 72, penalty: 18,
      warning: {
        id: "pw_for_child", type: "sensitivity", severity: "medium",
        title:   "Çocuk cildine uygunluğu belirsiz",
        message: "Bu ürün bebek ya da çocuk cildi için özel olarak değerlendirilmemiş. Kullanmadan önce pediatri dermatoloğu görüşü almanız daha güvenli.",
        premiumDetail: "Çocuk cildindeki pH dengesi ve bariyer kalınlığı yetişkin cildinden farklıdır. Fragrans, alkol ve konservan maddeler hassas çocuk cildinde kolayca tahriş yaratabilir.",
        suggestion: {
          suggestionType: "category",
          message: "Bebek ve çocuk ciltleri için özel olarak formüle edilmiş seriler çok daha güvenli bir başlangıç noktası sunuyor.",
          categoryHint: "bebek bakım ürünü",
        },
      },
    });
  }

  // 2f. Sedef hastalığı + SLS
  if (sc.includes("psoriasis") && ingredients && !isCleanser) {
    const hasSLS = ingredients.includes("sodium lauryl sulfate") ||
                   ingredients.includes(",sls") || ingredients.includes(" sls");
    if (hasSLS) {
      fitScore -= 14;
      candidates.push({
        weight: 62, penalty: 14,
        warning: {
          id: "pw_psoriasis", type: "sensitivity", severity: "medium",
          title:   "Sedef dönemlerinde dikkat",
          message: "Bu üründeki güçlü yüzey aktif maddeler (SLS) sedef aktivasyonu sırasında deriyi daha fazla tahriş edebilir.",
          premiumDetail: "Aktif dönemlerde SLS yerine daha yumuşak kokamidopropil betain veya glukozit bazlı temizleyiciler öncelikli tercih edilmelidir.",
          suggestion: {
            suggestionType: "category",
            message: "Sülfatsız temizleyiciler, sedef dönemlerinde cilde karşı çok daha nazik davranır.",
            categoryHint: "sülfatsız temizleyici",
          },
        },
      });
    }
  }

  // 2g. Hiperpigmentasyon + fotosensitizörler
  if (sc.includes("hyperpigmentation") && ingredients) {
    const hasPhotoSens = hasIngredient(ingredients, PHOTOSENSITIZERS);
    if (hasPhotoSens) {
      fitScore -= 10;
      candidates.push({
        weight: 48, penalty: 10,
        warning: {
          id: "pw_pigmentation", type: "sensitivity", severity: "low",
          title:   "Gün içi kullanımda SPF önemi",
          message: "Bu üründeki bazı bitkisel bileşenler güneş ışığıyla birleştiğinde pigmentasyon riskini artırabilir. Gündüz kullanıyorsanız üstüne mutlaka SPF uygulayın.",
          premiumDetail: "Bergamot ve narenciye yağlarındaki furakumarinler fototoksik reaksiyona yol açabilir; bu özellikle hiperpigmentasyona yatkın ciltlerde lekelerin derinleşmesine neden olabilir.",
          suggestion: { suggestionType: "none", message: "" },
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // GRUP 3 — OPTİMİZASYON
  // ══════════════════════════════════════════════════════════════════════

  // 3a. Kaçınılan içerikler
  if (ingredients && avis.length > 0) {
    const matched = avis.filter(ai => ingredients.includes(ai.toLowerCase()));
    if (matched.length > 0) {
      const pen = Math.min(matched.length * 8, 18);
      fitScore -= pen;
      candidates.push({
        weight: 38, penalty: pen,
        warning: {
          id: "pw_avoided", type: "sensitivity", severity: "low",
          title:   "Kullanmak istemediğiniz içerik",
          message: `"${matched.slice(0, 2).join('", "')}" — tercihlerinize göre bu içerikleri kullanmak istemiyordunuz. Bu üründe yer alıyor.`,
          suggestion: {
            suggestionType: "alternative",
            message: "Bu içerikleri barındırmayan benzer seçeneklere bakmak isteyebilirsiniz.",
          },
        },
      });
    }
  }

  // 3b. Genel düşük uyum (başka uyarı yoksa)
  const preFit = Math.max(0, fitScore);
  if (preFit < 55 && candidates.length === 0) {
    candidates.push({
      weight: 30, penalty: 0,
      warning: {
        id: "pw_lowfit", type: "combination", severity: "low",
        title:   "Bu ürün sizin için ideal olmayabilir",
        message: "Cilt profiliniz ve bu ürünün özellik seti tam örtüşmüyor. Daha iyi uyumlu alternatifler bulabilirsiniz.",
        suggestion: {
          suggestionType: "alternative",
          message: "Cilt profilinizle daha iyi örtüşen alternatiflere göz atmak ister misiniz?",
        },
      },
    });
  }

  // ── Pozitif uyum bonusları ────────────────────────────────────────────────

  if (skin === "dry"  && (features.includes("hydrating")    || features.includes("barrier_support"))) fitScore += 5;
  if (skin === "oily" && (features.includes("oil_control")  || features.includes("matte_finish")))    fitScore += 5;
  if (skin === "sensitive" && features.includes("sensitive_skin_friendly"))                           fitScore += 6;
  if (sc.includes("acne_prone") && (features.includes("non_comedogenic") || features.includes("acne_prone_friendly"))) fitScore += 5;
  if (sc.includes("sensitive_skin") && features.includes("fragrance_free")) fitScore += 4;

  fitScore = Math.max(0, Math.min(100, Math.round(fitScore)));

  // ── Sıralama ve sayı sınırı ───────────────────────────────────────────────

  candidates.sort((a, b) => {
    const sd = severityOrder(b.warning.severity) - severityOrder(a.warning.severity);
    if (sd !== 0) return sd;
    return b.weight - a.weight;
  });

  const MAX_WARNINGS = 3;
  const warnings = candidates.slice(0, MAX_WARNINGS).map(c => c.warning);

  return { warnings, fitScore };
}

// ─── Yardımcı: fitScore → kısa etiket + renk ────────────────────────────────

export interface FitScoreLabel {
  label: string;
  color: string;
}

export function fitScoreLabel(score: number): FitScoreLabel {
  if (score >= 85) return { label: "Uyumlu",        color: "#6B7F5D" };
  if (score >= 70) return { label: "Makul uyumlu",  color: "#a16207" };
  if (score >= 50) return { label: "Dikkat",         color: "#c2410c" };
  return               { label: "Düşük uyum",     color: "#b91c1c" };
}
