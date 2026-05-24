/**
 * CiltBakımım — Brand Voice, Tone & Microcopy System
 *
 * Uygulama genelinde tutarlı bir marka sesi. Her ekran, her mesaj,
 * her uyarı ve her premium prompt aynı zekil, sakin, güvenilir
 * kişilikten konuşur.
 *
 * Bu dosya:
 *  - Marka kişilik ilkeleri
 *  - Bağlama göre ton kuralları
 *  - Yeniden kullanılabilir microcopy kütüphanesi
 *  - Dil kuralları & anti-pattern listesi
 *  - validateMicrocopyTone() doğrulama fonksiyonu
 */

// ─── Eczacı Sesi (Pharmacist Voice) ──────────────────────────────────────────
//
// Uygulamanın konuşma kişiliği: deneyimli bir eczacı gibi.
// Gözlemler, sessizce yönlendirir, yargılamaz.
//
// KURALLAR:
//   - Max 2 cümle
//   - "zorunlu / mecburi / kesinlikle" kullanma
//   - Klinik değil, sıcak
//   - Önce durumu gözlemle, sonra hafifçe yönlendir
//
// YANLIŞ:  "Rutin bağlılığınız düşük. Düzeltmeniz gerekmektedir."
// DOĞRU:   "Son günler aksadı. Küçük başlayalım, devamı gelir."
//
// YANLIŞ:  "Bu ürünü yağlı ciltler için kesinlikle kullanmalısınız."
// DOĞRU:   "Bu ürün yağlı ciltte daha rahat gider."

export const PHARMACIST_VOICE = {
  observe_then_guide: true,
  max_sentences: 2,
  tone: ["sakin", "sıcak", "güvenli", "insan"],
  avoid: ["zorunlu", "mecburi", "kesinlikle", "mutlaka", "hemen"],
  examples: {
    lowAdherence:   "Son günler aksadı. Küçük başlayalım, devamı gelir.",
    highSensitivity:"Hassasiyet biraz artmış. Nazik ürünlere yönelmek daha iyi olabilir.",
    sunscreen:      "Güneş korumasını atlamasak iyi olur.",
    goodProgress:   "Genel tablo iyi gidiyor. Mevcut rutini sürdürmek en doğrusu.",
    streakBreak:    "Son günler aksadı. Bugün yeniden başlamak için iyi bir gün.",
    firstStep:      "İlk adım hep en önemli olanı.",
    allDone:        "Bugün tamam. Devam ediyorsun.",
    cumulative:     "Cilt bakımı birikimli çalışır. Yarın da buradayım.",
  },
} as const;

// ─── Marka Kişiliği ───────────────────────────────────────────────────────────

export const BRAND_PERSONALITY = {
  calm:        "Asla bağırmaz, acele ettirmez, kargaşa yaratmaz.",
  intelligent: "Bağlamı anlar, net açıklar, robotik konuşmaz.",
  protective:  "Uyarıları nazikçe verir, panik yaratmaz.",
  refined:     "Premium bir his verir, çocuksu UX kopyasından kaçınır.",
  supportive:  "Kullanıcıyı yönlendirir, yargılamaz, aşağılamaz.",
} as const;

// ─── Ton Bağlamları ───────────────────────────────────────────────────────────

export const TONE_CONTEXTS = {
  concernFlow: {
    adjectives: ["davet edici", "sade", "güven veren"],
    examples: [
      "Cildine daha uygun yolu birlikte bulalım.",
      "Birkaç kısa soruyla daha doğru ilerleyebiliriz.",
      "Buradan başlamak en kolay yol.",
    ],
  },
  productGuidance: {
    adjectives: ["pratik", "güvenli", "net"],
    examples: [
      "Bu ürün daha hafif yapısıyla öne çıkıyor.",
      "Hassas ciltte daha dengeli bir başlangıç olabilir.",
      "Bu seçim sana daha yakın duruyor.",
    ],
  },
  smartWarning: {
    adjectives: ["nazik", "koruyucu", "sakin"],
    examples: [
      "Bu cilt yapısında daha sade ilerlemek daha uygun olabilir.",
      "Fazla aktif içerik cildi yorabilir.",
      "Burada denge biraz daha önemli.",
    ],
  },
  routineGuidance: {
    adjectives: ["yapılandırılmış", "yardımsever", "dengeli"],
    examples: [
      "Sabah bakımını daha sade tutmak burada daha iyi olabilir.",
      "Akşam rutini biraz sadeleştirilebilir.",
      "Dengeli ilerliyorsun.",
    ],
  },
  premiumHook: {
    adjectives: ["merak uyandırıcı", "zekice", "satışçı olmayan"],
    examples: [
      "Daha derin değerlendirmeyi aç.",
      "Bu seçim neden sana daha yakın? Birlikte bakalım.",
      "Cildin için daha şahsi bir analiz mümkün.",
      "Akıllı analizi görüntüle.",
    ],
  },
  emptyState: {
    adjectives: ["sakin", "suçlamayan", "yardımsever"],
    examples: [
      "Henüz burada bir içerik görünmüyor.",
      "İstersen birlikte başlayabiliriz.",
      "Kaldığın yerden devam edebilirsin.",
    ],
  },
  proactiveSuggestion: {
    adjectives: ["gözlemci", "kesin", "nazik"],
    examples: [
      "Son günlerde daha sade bir yapı cildine iyi gelebilir.",
      "Akşam rutini biraz ağır geliyor olabilir.",
      "Koruma adımı burada daha belirleyici görünüyor.",
    ],
  },
} as const;

// ─── Microcopy Kütüphanesi ────────────────────────────────────────────────────

export const COPY = {
  // CTA Butonları
  cta: {
    continue:         "Devam et",
    resume:           "Kaldığın yerden devam et",
    showProducts:     "Uygun ürünleri göster",
    editRoutine:      "Rutini düzenle",
    deeperLook:       "Daha derin bak",
    compare:          "Karşılaştır",
    startFlow:        "Değerlendirmeyi başlat",
    openAnalysis:     "Akıllı analizi aç",
    seeResult:        "Sonucunu gör",
    notNow:           "Şimdi değil",
    dismiss:          "Kapat",
    goToRoutine:      "Rutine git",
    learnMore:        "İncele",
  },

  // Bölüm Başlıkları
  sectionTitle: {
    forYou:           "Cildine yakın tablo",
    keyDiff:          "Temel fark",
    inRoutine:        "Rutinde yeri",
    pharmacistNote:   "Eczacı Yorumu",
    whyMatters:       "Bu neden önemli?",
    concerns:         "Cilt Endişesi Seç",
    todayInsight:     "Günün Notu",
    articles:         "Makaleler",
    personalRec:      "Sana Özel",
    weekProgress:     "Bu Hafta",
  },

  // Uyarı Başlıkları
  warningTitle: {
    slowDown:         "Nazik ilerlemek daha uygun",
    balance:          "Burada denge önemli",
    combination:      "Bu kombinasyonda dikkat",
    sunProtection:    "Koruma adımı öne çıkıyor",
    barrierSupport:   "Bariyer desteği önemli",
    simplify:         "Daha sade bir rutin düşünülebilir",
  },

  // İlerleme & Durum
  status: {
    todayDone:        "Bugün tamamlandı",
    eveningPending:   "Akşam rutini bekliyor",
    morningPending:   "Sabah rutini bekliyor",
    onTrack:          "Dengeli ilerliyorsun",
    slipping:         "Son günlerde biraz aksadı",
    streakText:       (n: number) => `${n} gün kesintisiz`,
    progressPct:      (pct: number) => `%${pct} tamamlandı`,
    stepCount:        (done: number, total: number) => `${done}/${total} adım`,
  },

  // Premium Hooklar
  premium: {
    deepAnalysis:     "Cildin için daha şahsi bir analiz mümkün.",
    whyBetter:        "Bu seçimin neden daha uygun olduğunu incele.",
    smartRoutine:     "Cilt profiline göre akıllı rutin oluştur.",
    preciseWarning:   "Daha kesin uyarıları görmek için analizi aç.",
    unlockInsight:    "Daha derin değerlendirmeyi görüntüle.",
  },

  // Boş Durumlar
  empty: {
    noContent:        "Henüz burada bir içerik görünmüyor.",
    startTogether:    "İstersen birlikte başlayabiliriz.",
    resumeAnytime:    "Kaldığın yerden devam edebilirsin.",
    noProducts:       "Henüz ürün eklenmemiş.",
    noRoutine:        "Rutin henüz oluşturulmamış.",
    noFlow:           "Henüz bir değerlendirme yapılmamış.",
  },

  // Recovery Kart
  recovery: {
    cardTitle:        "Kaldığın yerden devam et",
    subtitle:         (flowTitle: string) => `${flowTitle} değerlendirmesi henüz tamamlanmadı.`,
    progressHint:     (step: number, total: number) => `${step} / ${total} soru cevaplandı`,
    cta:              "Devam et",
    dismiss:          "Şimdi değil",
  },

  // Proaktif Öneri
  proactive: {
    dismissLabel:     "Şimdi değil",
    openFlow:         "Değerlendirmeyi başlat",
    goRoutine:        "Rutine git",
  },

  // Flow Ekranı
  flow: {
    back:             "Geri",
    seeResults:       "Sonuçları gör",
    multiSelect:      "Birden fazla seçebilirsin",
  },
} as const;

// ─── Dil Kuralları ────────────────────────────────────────────────────────────

export const LANGUAGE_RULES = {
  avoid: {
    robotic: [
      "sistem tarafından",
      "önerilmektedir",
      "oluşturulmuştur",
      "sizin için uygundur",
      "sonuçlarınız",
      "kullanıcı",
    ],
    overMarketing: [
      "harika fırsat",
      "mükemmel çözüm",
      "en iyi ürün",
      "hemen satın al",
      "sınırsız erişim",
    ],
    medicalOverclaim: [
      "tedavi eder",
      "kesinlikle",
      "garantili",
      "kanıtlanmış",
      "şifa",
      "iyileşir",
    ],
    harshCommands: [
      "hemen yap",
      "hemen başla",
      "şimdi satın al",
      "kaçırma",
      "zorunlu",
      "mecburi",
      "mutlaka yapmalısın",
      "yapmanız gerekmektedir",
    ],
    creepy: [
      "seni izliyoruz",
      "davranışını fark ettik",
      "her hareketini",
    ],
    dramatic: [
      "tehlikeli",
      "acilen",
      "çok kötü",
      "felaket",
    ],
  },
  prefer: {
    softQualifiers: [
      "öne çıkıyor",
      "uygun olabilir",
      "daha yakın duruyor",
      "daha dengeli olabilir",
      "iyi gelebilir",
      "düşünülebilir",
    ],
    gentleInvites: [
      "istersen göz atalım",
      "buradan devam edebilirsin",
      "birlikte bakabiliriz",
      "istersen açabiliriz",
    ],
    naturalSecondPerson: [
      "sana",
      "cildin",
      "senin için",
    ],
  },
} as const;

// ─── Microcopy Doğrulama ──────────────────────────────────────────────────────

export interface ToneViolation {
  rule: string;
  matched: string;
  severity: "error" | "warning";
}

/**
 * UI metnini marka sesi kurallarına göre doğrular.
 * Geliştirme sürecinde yeni metinleri test etmek için kullanılır.
 *
 * @example
 *   const issues = validateMicrocopyTone("Bu ürün kesinlikle en iyi seçimdir.");
 *   // [{ rule: "medicalOverclaim", matched: "kesinlikle", severity: "error" }, ...]
 */
export function validateMicrocopyTone(text: string): ToneViolation[] {
  const violations: ToneViolation[] = [];
  const lower = text.toLowerCase();

  for (const phrase of LANGUAGE_RULES.avoid.robotic) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({ rule: "robotic", matched: phrase, severity: "error" });
    }
  }
  for (const phrase of LANGUAGE_RULES.avoid.overMarketing) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({ rule: "overMarketing", matched: phrase, severity: "error" });
    }
  }
  for (const phrase of LANGUAGE_RULES.avoid.medicalOverclaim) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({ rule: "medicalOverclaim", matched: phrase, severity: "error" });
    }
  }
  for (const phrase of LANGUAGE_RULES.avoid.harshCommands) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({ rule: "harshCommand", matched: phrase, severity: "warning" });
    }
  }
  for (const phrase of LANGUAGE_RULES.avoid.creepy) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({ rule: "creepy", matched: phrase, severity: "error" });
    }
  }
  for (const phrase of LANGUAGE_RULES.avoid.dramatic) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({ rule: "dramatic", matched: phrase, severity: "warning" });
    }
  }

  // Uzunluk uyarısı (140 karakterden uzunsa kısa cümle önerisi)
  if (text.length > 140) {
    violations.push({ rule: "tooLong", matched: `${text.length} karakter`, severity: "warning" });
  }

  return violations;
}

/**
 * Birden fazla metni toplu doğrular.
 * proactiveEngine veya articleSystem içindeki tüm metinleri test etmek için.
 */
export function auditCopyBatch(entries: Record<string, string>): Record<string, ToneViolation[]> {
  const result: Record<string, ToneViolation[]> = {};
  for (const [key, text] of Object.entries(entries)) {
    const violations = validateMicrocopyTone(text);
    if (violations.length > 0) result[key] = violations;
  }
  return result;
}

// ─── Premium Dil Stratejisi ───────────────────────────────────────────────────

/**
 * Premium içeriği sergilerken kullanılacak metin çerçevesi.
 * Satış baskısı hissi OLMADAN zekaya dayalı arzu yaratır.
 */
export const PREMIUM_LANGUAGE_STRATEGY = {
  principle: "Premium; baskıyla değil, zekayla arzu edilir kılınır.",
  doNot: [
    "Şimdi yükselt",
    "Kilidi aç",
    "Ödeme yap",
    "Sınırlı erişim",
  ],
  prefer: [
    "Akıllı analizi aç",
    "Daha şahsi değerlendirmeyi gör",
    "Bu seçimin neden daha uygun olduğunu incele",
    "Cildine göre daha derin bak",
    "Şahsi rutin oluştur",
  ],
  feeling: "Seçici. Değerli. İçine girmek istenen bir kulüp.",
} as const;

// ─── Duygusal Ton Sınırları ───────────────────────────────────────────────────

export const EMOTIONAL_TONE_BOUNDARIES = {
  never: ["dramatik", "çocuksu", "paniğe sürükleyen", "soğuk klinik", "sahte samimi", "satış agresif"],
  always: ["sessizce güvenli", "sıcak", "sakin", "düşünceli"],
} as const;
