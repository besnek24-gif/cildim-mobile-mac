/**
 * CiltBakımım — Cilt Kaygısı Karar Akışları
 * Akne | Hassasiyet | Leke | Kuruluk
 */

// ─── Ortak tipler ────────────────────────────────────────────────────────────

export interface FlowOption {
  id: string;
  label: string;
}

export interface FlowStep {
  id: string;
  question: string;
  subtitle?: string;
  allowMultiple?: boolean;
  options: FlowOption[];
}

export interface FlowConfig {
  id: string;
  title: string;
  subtitle: string;
  accentColor: string;
  steps: FlowStep[];
  buildProfile: (answers: Record<string, string[]>) => Record<string, unknown>;
  generateSummary: (profile: Record<string, unknown>) => string;
  scoreProduct: (product: Record<string, unknown>, profile: Record<string, unknown>) => number;
  getProductReason: (product: Record<string, unknown>, profile: Record<string, unknown>) => string;
}

// ─── Yardımcı: ürün metin birleştirici ───────────────────────────────────────

function productText(p: Record<string, unknown>): string {
  const arr = [
    p.name, p.isim, p.category, p.kategori,
    p.description, p.aciklama, p.short_benefit,
    ...(Array.isArray(p.concerns) ? p.concerns : []),
    ...(Array.isArray(p.concerns_supported) ? p.concerns_supported : []),
    ...(Array.isArray(p.tags) ? p.tags : []),
    ...(Array.isArray(p.ingredients) ? p.ingredients : []),
    ...(Array.isArray(p.active_ingredients) ? p.active_ingredients : []),
    ...(Array.isArray(p.skin_types) ? p.skin_types : []),
    ...(Array.isArray(p.benefits) ? p.benefits : []),
  ];
  return arr.filter(Boolean).join(" ").toLowerCase();
}

// ─── Ürün kategorisi (bucket) ─────────────────────────────────────────────────

export type ProductBucket = "cleanser" | "serum" | "moisturizer" | "sunscreen" | "other";

export const BUCKET_META: Record<ProductBucket, { title: string; icon: string }> = {
  cleanser:    { title: "Temizleyici",    icon: "droplet"    },
  serum:       { title: "Serum & Aktif",  icon: "zap"        },
  moisturizer: { title: "Nemlendirici",   icon: "cloud"      },
  sunscreen:   { title: "Güneş Koruma",   icon: "sun"        },
  other:       { title: "Diğer Ürünler",  icon: "grid"       },
};

/**
 * classifyBucket — Ürünün bakım kategorisini belirler.
 *
 * Öncelik sırası (katı → geniş):
 *   1. category / kategori alanı (DB'den gelen, en güvenilir)
 *   2. subcategory alanı
 *   3. Ürün adı — SADECE net terimler; "acid/asit/aktif" gibi
 *      ham madde/özellik kelimeleri serum olarak sınıflandırılmaz.
 *
 * Kurallar:
 *   · Nemlendirici/krem sinyalleri her zaman serum'dan önce kontrol edilir
 *     (bir "hyaluronic acid cream" → moisturizer, serum değil)
 *   · "Hydrating", "repair", "acid" kelimeleri tek başına
 *     hiçbir kategori belirleyemez
 */
export function classifyBucket(p: Record<string, unknown>): ProductBucket {
  // ── Öncelik 1: category / kategori alanı ────────────────────────────────────
  const catRaw = [
    String(p.category  ?? ""),
    String(p.kategori  ?? ""),
  ].filter((s) => s && s !== "undefined").join(" ").toLowerCase().trim();

  if (catRaw.length > 0) {
    if (/temizley|cleanser|cleansing|micel|face\s*wash|yüz\s*yıka/.test(catRaw)) return "cleanser";
    if (/güneş|sunscreen|sun\s*(screen|protect|block|cream)|spf/.test(catRaw))    return "sunscreen";
    // Nemlendirici/krem/bariyer, serum'dan ÖNCE
    // "hyaluronic acid cream" → moisturizer; "bariyer krem" → moisturizer
    // Not: "bariyer" ve "onarıcı" tek başına da moisturizer bucket'a girer (repair slot)
    if (/nemlendirici|moisturizer|\bkrem\b|\bcream\b|\blosyon\b|lotion|bariyer|onarıcı|ceramid|seramid|gece\s*krem/.test(catRaw)) return "moisturizer";
    // Serum: SADECE "serum", "ampul", "tonik", "toner" — asit/aktif/esans değil
    if (/\bserum\b|ampul|ampoule|\btonik\b|\btoner\b/.test(catRaw)) return "serum";
  }

  // ── Öncelik 2: subcategory alanı ────────────────────────────────────────────
  const subRaw = String(p.subcategory ?? "").toLowerCase();
  if (subRaw && subRaw !== "undefined") {
    if (/temizley|cleanser/.test(subRaw))          return "cleanser";
    if (/güneş|sunscreen|spf/.test(subRaw))        return "sunscreen";
    if (/nemlendirici|\bkrem\b|\bcream\b|losyon/.test(subRaw)) return "moisturizer";
    if (/\bserum\b|\btonik\b|\btoner\b/.test(subRaw)) return "serum";
  }

  // ── Öncelik 3: Ürün adı — yalnızca belirleyici terimler ────────────────────
  const name = [String(p.name ?? ""), String(p.isim ?? "")].join(" ").toLowerCase();
  if (/temizley|cleanser|köpük\s*temiz|jel\s*temiz/.test(name)) return "cleanser";
  if (/güneş\s*koruy|sunscreen|spf\s*\d+/.test(name))           return "sunscreen";
  if (/\bnemlendirici\b|\bcream\b|\bkrem\b|\blosyon\b/.test(name)) return "moisturizer";
  // Serum: "serum" veya "tonik" kelimesi — "acid/asit/aktif/esans" değil
  if (/\bserum\b|\btonik\b/.test(name)) return "serum";

  return "other";
}

// ═══════════════════════════════════════════════════════════════════════════════
// AKNE AKIŞI
// ═══════════════════════════════════════════════════════════════════════════════

const AKNE_STEPS: FlowStep[] = [
  {
    id: "texture",
    question: "Sivilcelerin daha çok nasıl görünüyor?",
    options: [
      { id: "comedonal",    label: "Küçük pütürler ve siyah noktalar" },
      { id: "inflammatory", label: "Kızarık ve iltihaplı sivilceler" },
      { id: "mixed",        label: "Hem pütür hem iltihaplı sivilceler" },
      { id: "unsure",       label: "Emin değilim" },
    ],
  },
  {
    id: "oiliness",
    question: "Cildin gün içinde nasıl davranıyor?",
    options: [
      { id: "oily",       label: "Çok hızlı yağlanıyor" },
      { id: "combo",      label: "T bölgesi yağlı, bazı yerler normal" },
      { id: "non_oily",   label: "Yağlı değil ama yine de sivilce oluyor" },
      { id: "unknown",    label: "Emin değilim" },
    ],
  },
  {
    id: "sensitivity",
    question: "Cildinde bunlardan biri oluyor mu?",
    subtitle: "Birden fazla seçebilirsin",
    allowMultiple: true,
    options: [
      { id: "redness",    label: "Kolay kızarma" },
      { id: "burning",    label: "Yanma / batma" },
      { id: "irritation", label: "Çabuk tahriş olma" },
      { id: "none",       label: "Bunlar olmuyor" },
    ],
  },
  {
    id: "severity",
    question: "Akne durumu ne kadar yaygın?",
    options: [
      { id: "mild",          label: "Ara sıra birkaç tane çıkıyor" },
      { id: "moderate",      label: "Sık sık çıkıyor" },
      { id: "widespread",    label: "Yüzümde geniş alana yayılıyor" },
      { id: "hormonal_hint", label: "Dönemsel artıyor" },
    ],
  },
  {
    id: "barrier",
    question: "Akneye rağmen cildinde kuruluk veya gerilme oluyor mu?",
    options: [
      { id: "weak",    label: "Evet, sık oluyor" },
      { id: "partial", label: "Bazen oluyor" },
      { id: "normal",  label: "Hayır" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "goal",
    question: "Şu an en çok neyi düzeltmek istiyorsun?",
    options: [
      { id: "prevention",  label: "Yeni sivilce oluşumunu azaltmak" },
      { id: "oil_control", label: "Yağlanmayı dengelemek" },
      { id: "marks",       label: "İz ve görünümü toparlamak" },
      { id: "gentle_care", label: "Cildi tahriş etmeden bakım yapmak" },
    ],
  },
];

const akneFlow: FlowConfig = {
  id: "akne",
  title: "Akneye uygun yolu bulalım",
  subtitle: "Birkaç kısa soruyla cildine daha uygun ürünleri seçelim.",
  accentColor: "#15803D",
  steps: AKNE_STEPS,
  buildProfile(answers) {
    const texture = answers.texture?.[0] ?? "unsure";
    const acneType = texture === "unsure" ? "generic" : texture;
    const oilRaw = answers.oiliness?.[0] ?? "unknown";
    const oilLevel = oilRaw === "combo" ? "combination" : oilRaw;
    const sens = answers.sensitivity ?? [];
    const sensitive = sens.includes("redness") || sens.includes("burning") || sens.includes("irritation");
    const severity = answers.severity?.[0] ?? "mild";
    const barrier = answers.barrier?.[0] ?? "unknown";
    const goal = answers.goal?.[0] ?? "prevention";
    return { acneType, oilLevel, sensitive, severity, barrier, goal };
  },
  generateSummary(p) {
    const lines: string[] = [];
    if (p.acneType === "comedonal") lines.push("Cildin gözenek tıkanmasına ve siyah nokta oluşumuna eğilimli görünüyor.");
    else if (p.acneType === "inflammatory") lines.push("Kızarık, iltihaplı sivilce türünde bir tablo öne çıkıyor.");
    else if (p.acneType === "mixed") lines.push("Hem gözenek tıkanması hem iltihaplı sivilce bir arada görünüyor.");
    else lines.push("Genel akne eğilimli bir cilt tablosu öne çıkıyor.");

    if (p.sensitive && p.barrier === "weak") lines.push("Hassasiyet ve bariyer zayıflığı birlikte görülüyor. Arındırma kadar yatıştırma da önemli.");
    else if (p.sensitive) lines.push("Akneyle birlikte hassasiyet de öne çıkıyor. Dengeli ürünler daha uygun olabilir.");
    else if (p.barrier === "weak") lines.push("Akneye rağmen bariyer zayıflığı işareti var. Nemlendirme rutinden çıkarılmamalı.");

    if (p.oilLevel === "oily") lines.push("Yağlanmaya eğilimli bir yapı; yağ dengesi ürün seçiminde öncelikli kriter olabilir.");
    if (p.severity === "widespread") lines.push("Yaygın akne tablosunda bir dermatoloji uzmanına başvurmanı öneririz.");
    return lines.slice(0, 3).join(" ");
  },
  scoreProduct(p, profile) {
    const t = productText(p);
    let s = 50;
    if (/akne|acne|sivilce|blemish|breakout/.test(t)) s += 20;
    if (profile.acneType === "comedonal") {
      if (/salisilik|salicylic|bha|gözenek|pore|blackhead/.test(t)) s += 20;
      if (/ağır|heavy|yoğun|occlusive/.test(t)) s -= 10;
    }
    if (profile.acneType === "inflammatory") {
      if (/sakinleştir|soothing|yatıştır|niacinamide|niasinamid|azelaic|centella|cica/.test(t)) s += 20;
    }
    if (profile.oilLevel === "oily" || profile.oilLevel === "combination") {
      if (/mat|matte|oil.control|gel|hafif|light/.test(t)) s += 15;
      if (/ağır|heavy|yoğun|rich/.test(t)) s -= 10;
    }
    if (profile.sensitive) {
      if (/hassas|sensitive|sakinleştir|gentle|nazik|parfümsüz/.test(t)) s += 15;
      if (/alkol|alcohol|parfüm|fragrance|agresif|harsh/.test(t)) s -= 10;
    }
    if ((profile.barrier === "weak" || profile.barrier === "partial") &&
        /seramid|ceramide|hyalüron|hyaluronic|bariyer|barrier|onarım|repair/.test(t)) s += 12;
    if (profile.goal === "marks" && /niasinamid|leke|vitamin.c|iz|hiperpig/.test(t)) s += 10;
    return Math.max(0, Math.min(100, s));
  },
  getProductReason(p, profile) {
    const t = productText(p);
    if (profile.sensitive && /hassas|sensitive|sakinleştir|gentle/.test(t)) return "Hassas aknede daha dengeli";
    if (profile.acneType === "comedonal" && /salisilik|salicylic|gözenek|blackhead/.test(t)) return "Gözenek ve pütür odaklı";
    if (profile.acneType === "inflammatory" && /cica|centella|niacinamide|azelaic/.test(t)) return "İltihaplı görünümde daha nazik";
    if ((profile.barrier === "weak" || profile.barrier === "partial") && /seramid|ceramide|barrier|onarım/.test(t)) return "Bariyeri yormadan destekler";
    if ((profile.oilLevel === "oily" || profile.oilLevel === "combination") && /mat|oil.control|gel|hafif/.test(t)) return "Yağlı akneye daha uygun";
    if (profile.goal === "marks" && /niasinamid|leke|vitamin.c|iz/.test(t)) return "İz görünümünü de destekler";
    return "Akne eğilimli ciltlere uygun";
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HASSASİYET AKIŞI
// ═══════════════════════════════════════════════════════════════════════════════

const HASSASIYET_STEPS: FlowStep[] = [
  {
    id: "symptoms",
    question: "Cildinde en çok hangisi oluyor?",
    options: [
      { id: "redness",    label: "Kızarıklık" },
      { id: "burning",    label: "Yanma / batma hissi" },
      { id: "irritation", label: "Çabuk tahriş olma" },
      { id: "all",        label: "Hepsi" },
      { id: "unsure",     label: "Emin değilim" },
    ],
  },
  {
    id: "reactivity",
    question: "Yeni bir ürün kullandığında ne olur?",
    options: [
      { id: "high",    label: "Hemen tepki verir" },
      { id: "medium",  label: "Bazen sorun çıkarır" },
      { id: "low",     label: "Genelde sorun olmaz" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "base_skin",
    question: "Cildin genel olarak nasıl?",
    options: [
      { id: "dry",     label: "Kuru ve hassas" },
      { id: "oily",    label: "Yağlı ama hassas" },
      { id: "normal",  label: "Normal ama hassas" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "barrier",
    question: "Cildinde gerginlik veya kuruluk hissi var mı?",
    options: [
      { id: "weak",    label: "Sık sık" },
      { id: "partial", label: "Bazen" },
      { id: "normal",  label: "Hayır" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "goal",
    question: "Şu an en çok neyi düzeltmek istiyorsun?",
    options: [
      { id: "calm",              label: "Cildi yatıştırmak" },
      { id: "reduce_redness",    label: "Kızarıklığı azaltmak" },
      { id: "prevent_irritation",label: "Tahrişi önlemek" },
      { id: "strengthen",        label: "Daha dayanıklı bir cilt" },
    ],
  },
];

const hassasiyetFlow: FlowConfig = {
  id: "hassasiyet",
  title: "Hassas cilt için doğru yolu bulalım",
  subtitle: "Cildini yormadan uygun ürünleri seçelim.",
  accentColor: "#BE123C",
  steps: HASSASIYET_STEPS,
  buildProfile(answers) {
    const sym = answers.symptoms?.[0] ?? "unsure";
    const sensitivity = sym === "all" || sym === "irritation" ? "high" : sym === "unsure" ? "low" : "medium";
    const reactivity = answers.reactivity?.[0] ?? "unknown";
    const skinType = answers.base_skin?.[0] ?? "unknown";
    const barrier = answers.barrier?.[0] ?? "unknown";
    const goal = answers.goal?.[0] ?? "calm";
    return { sensitivity, reactivity, skinType, barrier, goal };
  },
  generateSummary(p) {
    const lines: string[] = [];
    if (p.sensitivity === "high" || p.reactivity === "high") lines.push("Cildin hassas ve kolay tepki veren bir yapıda görünüyor.");
    else lines.push("Orta düzeyde hassasiyet eğilimi öne çıkıyor.");
    if (p.barrier === "weak") lines.push("Bariyer zayıflığı da öne çıkıyor. Güçlü içerikler yerine dengeleyici ürünler daha uygun olabilir.");
    if (p.skinType === "dry") lines.push("Kuru ve hassas cilt için yatıştırıcı ve nem destekli ürünler ön planda olmalı.");
    if (p.skinType === "oily") lines.push("Yağlı ama hassas yapı için hafif, sakinleştirici formulasyonlar tercih edilmeli.");
    return lines.slice(0, 3).join(" ");
  },
  scoreProduct(p, profile) {
    const t = productText(p);
    let s = 50;
    if (/hassas|sensitive|sakinleştir|soothing|yatıştır|calming|gentle/.test(t)) s += 20;
    if (profile.sensitivity === "high" || profile.reactivity === "high") {
      if (/parfümsüz|fragrance.free|hipoalerjenik|hypoallergenic/.test(t)) s += 15;
      if (/alkol|alcohol|parfüm|agresif|harsh|asit|acid|retinol/.test(t)) s -= 15;
    }
    if (profile.barrier === "weak") {
      if (/seramid|ceramide|bariyer|barrier|onarım|repair|hyalüron/.test(t)) s += 15;
    }
    if (profile.skinType === "dry" && /nemlendirici|moisturizer|nem|krem|cream/.test(t)) s += 10;
    if (profile.skinType === "oily" && /hafif|light|gel|mat/.test(t)) s += 10;
    return Math.max(0, Math.min(100, s));
  },
  getProductReason(p, profile) {
    const t = productText(p);
    if (/parfümsüz|fragrance.free|hipoalerjenik/.test(t)) return "Tahriş riskini azaltır";
    if (/seramid|ceramide|barrier|bariyer/.test(t)) return "Bariyeri destekler";
    if (/sakinleştir|soothing|calming|cica|centella/.test(t)) return "Kızarıklık eğiliminde nazik seçenek";
    if (profile.skinType === "dry" && /nem|moisturizer|hyalüron/.test(t)) return "Kuru hassas cilde uygun";
    return "Hassas cilt için daha uygun";
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEKE AKIŞI
// ═══════════════════════════════════════════════════════════════════════════════

const LEKE_STEPS: FlowStep[] = [
  {
    id: "concern_type",
    question: "En çok hangi görünüm seni rahatsız ediyor?",
    options: [
      { id: "post_acne",   label: "Sivilce sonrası iz ve ton farkı" },
      { id: "sun_spots",   label: "Güneşle artan lekeler" },
      { id: "uneven_tone", label: "Genel ton eşitsizliği ve mat görünüm" },
      { id: "generic",     label: "Emin değilim" },
    ],
  },
  {
    id: "sensitivity",
    question: "Cildin leke ürünlerine karşı nasıl davranıyor?",
    options: [
      { id: "high",    label: "Kolay tahriş oluyor" },
      { id: "medium",  label: "Bazen hassasiyet oluyor" },
      { id: "low",     label: "Genelde sorun olmuyor" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "spf_habit",
    question: "Güneş koruyucu kullanma düzenin nasıl?",
    options: [
      { id: "strong",       label: "Her gün düzenli kullanıyorum" },
      { id: "inconsistent", label: "Bazen kullanıyorum" },
      { id: "poor",         label: "Nadiren kullanıyorum" },
      { id: "none",         label: "Hiç kullanmıyorum" },
    ],
  },
  {
    id: "barrier",
    question: "Cildinde kuruluk veya hassasiyet eşlik ediyor mu?",
    options: [
      { id: "weak",    label: "Evet, belirgin şekilde" },
      { id: "partial", label: "Bazen oluyor" },
      { id: "ok",      label: "Hayır" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "goal",
    question: "Şu an en çok neyi istiyorsun?",
    options: [
      { id: "reduce_spots",     label: "Leke görünümünü azaltmak" },
      { id: "even_tone",        label: "Cilt tonunu daha eşit göstermek" },
      { id: "radiance",         label: "Daha aydınlık görünüm" },
      { id: "gentle_correction",label: "Tahriş etmeden ilerlemek" },
    ],
  },
];

const lekeFlow: FlowConfig = {
  id: "leke",
  title: "Leke için doğru yolu bulalım",
  subtitle: "Cilt tonuna daha uygun bakımı birlikte seçelim.",
  accentColor: "#7C3AED",
  steps: LEKE_STEPS,
  buildProfile(answers) {
    const concernType = answers.concern_type?.[0] ?? "generic";
    const sensitivity = answers.sensitivity?.[0] ?? "unknown";
    const spfHabit = answers.spf_habit?.[0] ?? "inconsistent";
    const barrier = answers.barrier?.[0] ?? "unknown";
    const goal = answers.goal?.[0] ?? "reduce_spots";
    return { concernType, sensitivity, spfHabit, barrier, goal };
  },
  generateSummary(p) {
    const lines: string[] = [];
    if (p.concernType === "post_acne") lines.push("Sivilce sonrası iz ve ton farkı öne çıkıyor.");
    else if (p.concernType === "sun_spots") lines.push("Güneşle bağlantılı leke görünümü öne çıkıyor.");
    else if (p.concernType === "uneven_tone") lines.push("Leke görünümünün yanında ton eşitsizliği de öne çıkıyor.");
    else lines.push("Genel leke ve ton eşitsizliği tablosu öne çıkıyor.");
    if (p.sensitivity === "high") lines.push("Cildin leke bakımında hassasiyete açık görünüyor. Daha dengeli ürünler uygun olabilir.");
    if (p.spfHabit === "poor" || p.spfHabit === "none") lines.push("Güneş koruması düzenli olmadığında leke görünümünü toparlamak zorlaşabilir.");
    if (p.barrier === "weak") lines.push("Bariyer desteğiyle birlikte leke bakımına yaklaşmak daha güvenli olabilir.");
    return lines.slice(0, 3).join(" ");
  },
  scoreProduct(p, profile) {
    const t = productText(p);
    let s = 50;
    if (/leke|hiperpig|ton.eşit|brightening|aydınlat|spot|pigment/.test(t)) s += 20;
    if (profile.concernType === "post_acne" && /niasinamid|niacinamide|azelaic|vitamin.c|iz/.test(t)) s += 15;
    if (profile.concernType === "sun_spots" && /güneş|spf|sunscreen|ton.eşit/.test(t)) s += 15;
    if ((profile.spfHabit === "poor" || profile.spfHabit === "none") && /güneş|spf|sunscreen/.test(t)) s += 20;
    if (profile.sensitivity === "high") {
      if (/hassas|gentle|nazik|sakinleştir/.test(t)) s += 12;
      if (/kuvvetli|strong|harsh|agresif/.test(t)) s -= 12;
    }
    if (profile.barrier === "weak" && /seramid|ceramide|barrier|onarım/.test(t)) s += 10;
    return Math.max(0, Math.min(100, s));
  },
  getProductReason(p, profile) {
    const t = productText(p);
    if ((profile.spfHabit === "poor" || profile.spfHabit === "none") && /güneş|spf|sunscreen/.test(t)) return "Güneş korumasıyla birlikte daha anlamlı";
    if (profile.sensitivity === "high" && /hassas|gentle|sakinleştir/.test(t)) return "Hassas ciltte daha nazik";
    if (profile.concernType === "post_acne" && /niasinamid|niacinamide|azelaic/.test(t)) return "İz görünümüne daha uygun";
    if (/leke|ton.eşit|brightening|aydınlat/.test(t)) return "Ton eşitlemeye daha uygun";
    if (/seramid|ceramide|barrier/.test(t)) return "Bariyeri yormadan destekler";
    return "Leke eğilimli ciltlere uygun";
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// KURULUK AKIŞI
// ═══════════════════════════════════════════════════════════════════════════════

const KURULUK_STEPS: FlowStep[] = [
  {
    id: "dryness_feel",
    question: "Cildin en çok nasıl hissediliyor?",
    options: [
      { id: "high",    label: "Gergin ve kuru" },
      { id: "flaky",   label: "Pul pul dökülüyor" },
      { id: "medium",  label: "Bazen kuruyor" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "barrier_response",
    question: "Yüzünü yıkadıktan sonra ne olur?",
    options: [
      { id: "tight",   label: "Hemen gerilir" },
      { id: "delayed", label: "Bir süre sonra kurur" },
      { id: "normal",  label: "Normal kalır" },
      { id: "unknown", label: "Emin değilim" },
    ],
  },
  {
    id: "sensitivity",
    question: "Kurulukla birlikte bunlar oluyor mu?",
    subtitle: "Birden fazla seçebilirsin",
    allowMultiple: true,
    options: [
      { id: "redness",    label: "Kızarıklık" },
      { id: "burning",    label: "Yanma" },
      { id: "irritation", label: "Tahriş" },
      { id: "none",       label: "Olmuyor" },
    ],
  },
  {
    id: "oil_balance",
    question: "Cildin yağlanma durumu nasıl?",
    options: [
      { id: "dry",      label: "Hiç yağlanmaz" },
      { id: "combo",    label: "Bölgesel yağlanır" },
      { id: "oily_dry", label: "Yağlı ama yine de kuruyor" },
      { id: "unknown",  label: "Emin değilim" },
    ],
  },
  {
    id: "goal",
    question: "En çok neyi düzeltmek istiyorsun?",
    options: [
      { id: "hydration",       label: "Nem kazanmak" },
      { id: "repair",          label: "Cildi güçlendirmek" },
      { id: "calm",            label: "Tahrişi azaltmak" },
      { id: "overall_health",  label: "Daha sağlıklı görünüm" },
    ],
  },
];

const kurulukFlow: FlowConfig = {
  id: "kuruluk",
  title: "Cildini yeniden dengeleyelim",
  subtitle: "Nem ve bariyer desteğini doğru kuralım.",
  accentColor: "#1D4ED8",
  steps: KURULUK_STEPS,
  buildProfile(answers) {
    const drynessRaw = answers.dryness_feel?.[0] ?? "unknown";
    const dryness = drynessRaw === "flaky" || drynessRaw === "high" ? "high" : drynessRaw === "medium" ? "medium" : "low";
    const barrierRaw = answers.barrier_response?.[0] ?? "unknown";
    const barrier = barrierRaw === "tight" ? "weak" : barrierRaw === "delayed" ? "partial" : barrierRaw === "normal" ? "normal" : "unknown";
    const sens = answers.sensitivity ?? [];
    const sensitivity = sens.includes("redness") || sens.includes("burning") || sens.includes("irritation");
    const oilBalance = answers.oil_balance?.[0] ?? "unknown";
    const goal = answers.goal?.[0] ?? "hydration";
    return { dryness, barrier, sensitivity, oilBalance, goal };
  },
  generateSummary(p) {
    const lines: string[] = [];
    if (p.dryness === "high") lines.push("Cildin nem kaybına açık ve bariyer desteğine ihtiyaç duyuyor.");
    else lines.push("Orta düzeyde kuruluk eğilimi öne çıkıyor.");
    if (p.sensitivity) lines.push("Kurulukla birlikte hassasiyet de öne çıkıyor. Yatıştırıcı içerikler öncelikli olabilir.");
    if (p.oilBalance === "oily_dry") lines.push("Yağ dengesi bozulmuş olabilir; hem nem hem denge aynı anda önemli.");
    if (p.barrier === "weak") lines.push("Bariyer onarımı öncelikli; güçlü arındırıcılardan uzak durulması önerilir.");
    return lines.slice(0, 3).join(" ");
  },
  scoreProduct(p, profile) {
    const t = productText(p);
    let s = 50;
    if (/nemlendirici|moisturizer|nem|hydrating|hyalüron|hyaluronic|seramid|ceramide/.test(t)) s += 20;
    if (profile.dryness === "high" && /yoğun|rich|krem|cream|intense|derin nem/.test(t)) s += 15;
    if (profile.barrier === "weak" && /seramid|ceramide|bariyer|barrier|onarım|repair/.test(t)) s += 20;
    if (profile.sensitivity && /hassas|gentle|sakinleştir|soothing|nazik/.test(t)) s += 12;
    if (profile.oilBalance === "oily_dry") {
      if (/hafif|light|gel|jel/.test(t)) s += 10;
      if (/ağır|heavy|yoğun/.test(t)) s -= 8;
    }
    return Math.max(0, Math.min(100, s));
  },
  getProductReason(p, profile) {
    const t = productText(p);
    if (/seramid|ceramide|bariyer|barrier/.test(t)) return "Bariyer desteği";
    if (profile.dryness === "high" && /yoğun|rich|intense/.test(t)) return "Yoğun nem";
    if (profile.sensitivity && /sakinleştir|soothing|gentle/.test(t)) return "Nazik onarım";
    if (profile.oilBalance === "oily_dry" && /hafif|light|gel/.test(t)) return "Dengeleyici yapı";
    if (/hyalüron|hyaluronic|nem/.test(t)) return "Nem desteği";
    return "Kuruluk eğilimli ciltlere uygun";
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GÜNEŞ KORUMA AKIŞI
// ═══════════════════════════════════════════════════════════════════════════════

const GUNES_STEPS: FlowStep[] = [
  {
    id: "usage",
    question: "Güneş koruyucu kullanımın nasıl?",
    options: [
      { id: "regular",      label: "Her gün düzenli kullanıyorum" },
      { id: "inconsistent", label: "Bazen kullanıyorum" },
      { id: "seasonal",     label: "Sadece yazın kullanıyorum" },
      { id: "none",         label: "Hiç kullanmıyorum" },
    ],
  },
  {
    id: "issue",
    question: "Güneş kreminde en çok ne sorun oluyor?",
    options: [
      { id: "oily",       label: "Yağlı his bırakıyor" },
      { id: "irritation", label: "Cildimi yakıyor / rahatsız ediyor" },
      { id: "white_cast", label: "Beyaz iz bırakıyor" },
      { id: "none",       label: "Sorun yaşamıyorum" },
    ],
  },
  {
    id: "skin_type",
    question: "Cildin genel olarak nasıl?",
    options: [
      { id: "oily",        label: "Yağlı" },
      { id: "dry",         label: "Kuru" },
      { id: "combination", label: "Karma" },
      { id: "sensitive",   label: "Hassas" },
    ],
  },
  {
    id: "exposure",
    question: "Gün içinde güneşe ne kadar maruz kalıyorsun?",
    options: [
      { id: "high",   label: "Uzun süre dışarıdayım" },
      { id: "medium", label: "Ara ara çıkıyorum" },
      { id: "low",    label: "Çoğunlukla kapalı ortamdayım" },
    ],
  },
  {
    id: "goal",
    question: "Senin için en önemli olan ne?",
    options: [
      { id: "invisible",        label: "Hafif ve görünmez olsun" },
      { id: "strong_protection",label: "Güçlü koruma sağlasın" },
      { id: "comfort",          label: "Cildi rahatsız etmesin" },
      { id: "anti_spot",        label: "Leke oluşumunu önlesin" },
    ],
  },
];

const gunesFlow: FlowConfig = {
  id: "gunes",
  title: "Cildini güneşten doğru koruyalım",
  subtitle: "Doğru koruma, tüm bakımın temelidir.",
  accentColor: "#B45309",
  steps: GUNES_STEPS,
  buildProfile(answers) {
    const usage    = answers.usage?.[0]     ?? "inconsistent";
    const issue    = answers.issue?.[0]     ?? "none";
    const skinType = answers.skin_type?.[0] ?? "combination";
    const exposure = answers.exposure?.[0]  ?? "medium";
    const goal     = answers.goal?.[0]      ?? "comfort";
    const poorUsage = usage === "none" || usage === "seasonal";
    return { usage, issue, skinType, exposure, goal, poorUsage };
  },
  generateSummary(p) {
    const lines: string[] = [];
    if (p.poorUsage) lines.push("Güneş koruyucu kullanımın düzensiz görünüyor. Bu durum cilt bakımının etkisini azaltabilir.");
    else lines.push("Düzenli güneş koruyucu kullanımı cilt sağlığının en temel adımlarından biri.");

    if (p.issue === "oily") lines.push("Cildin daha hafif ve mat biten formüllere daha uygun görünüyor.");
    else if (p.issue === "irritation") lines.push("Hassas dokunun tahriş yaşaması için mineral ya da parfümsüz formüller daha uygun olabilir.");
    else if (p.issue === "white_cast") lines.push("Beyaz iz sorunu için transparan veya tinted formüller öne çıkabilir.");

    if (p.goal === "anti_spot") lines.push("Leke eğilimi varsa düzenli koruma daha kritik hale gelir.");
    if (p.exposure === "high") lines.push("Yoğun güneş maruziyeti için SPF 50+ tercih edilmesi önerilir.");
    return lines.slice(0, 3).join(" ");
  },
  scoreProduct(p, profile) {
    const t = productText(p);
    let s = 50;
    if (/güneş|spf|sunscreen|sun.prot|solar/.test(t)) s += 25;
    if (profile.exposure === "high" && /spf.5[0-9]|50\+/.test(t)) s += 15;
    if (profile.skinType === "oily" && /mat|matte|oil.control|hafif|light|gel/.test(t)) s += 12;
    if (profile.skinType === "dry" && /nemlendirici|moisturizing|besleyici|krem|cream/.test(t)) s += 12;
    if ((profile.skinType === "sensitive" || profile.issue === "irritation") && /mineral|çinko|zinc|parfümsüz|fragrance.free|hassas|sensitive/.test(t)) s += 15;
    if (profile.issue === "white_cast" && /tinted|transparan|invisible|görünmez/.test(t)) s += 12;
    if (profile.issue === "oily" && /mat|matte|oil.free/.test(t)) s += 10;
    if (profile.goal === "anti_spot" && /leke|hiperpig|ton|brightening/.test(t)) s += 8;
    if (profile.poorUsage && /günlük|daily|hafif|easy/.test(t)) s += 8;
    return Math.max(0, Math.min(100, s));
  },
  getProductReason(p, profile) {
    const t = productText(p);
    if ((profile.skinType === "sensitive" || profile.issue === "irritation") && /mineral|parfümsüz|fragrance.free/.test(t)) return "Hassas cilt uyumlu";
    if (profile.issue === "white_cast" && /tinted|transparan|invisible/.test(t)) return "Görünmez bitiş";
    if ((profile.skinType === "oily" || profile.issue === "oily") && /mat|matte|hafif/.test(t)) return "Hafif yapı";
    if (profile.exposure === "high" && /spf.5[0-9]|50\+/.test(t)) return "Yüksek koruma";
    if (/günlük|daily/.test(t)) return "Günlük kullanım için uygun";
    return "Güneş koruması için uygun";
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SAÇ DÖKÜLMESI AKIŞI
// ═══════════════════════════════════════════════════════════════════════════════

const SAC_STEPS: FlowStep[] = [
  {
    id: "pattern",
    question: "Dökülme nasıl ilerliyor?",
    options: [
      { id: "diffuse",   label: "Genel incelme" },
      { id: "localized", label: "Belirli bölgelerde açılma" },
      { id: "seasonal",  label: "Mevsimsel / dönemsel artış" },
      { id: "unknown",   label: "Emin değilim" },
    ],
  },
  {
    id: "severity",
    question: "Günlük dökülme nasıl?",
    options: [
      { id: "mild",     label: "Normalden biraz fazla" },
      { id: "moderate", label: "Belirgin şekilde fazla" },
      { id: "severe",   label: "Avuç avuç geliyor" },
      { id: "unknown",  label: "Emin değilim" },
    ],
  },
  {
    id: "scalp",
    question: "Saç derin nasıl?",
    options: [
      { id: "oily",      label: "Yağlı" },
      { id: "dry",       label: "Kuru" },
      { id: "sensitive", label: "Kepekli / hassas" },
      { id: "normal",    label: "Normal" },
    ],
  },
  {
    id: "trigger",
    question: "Son dönemde bunlardan biri oldu mu?",
    options: [
      { id: "stress",   label: "Stres" },
      { id: "medical",  label: "Hastalık / ilaç kullanımı" },
      { id: "seasonal", label: "Mevsim değişimi" },
      { id: "none",     label: "Hiçbiri" },
    ],
  },
  {
    id: "goal",
    question: "En çok neyi istiyorsun?",
    options: [
      { id: "reduce_loss",      label: "Dökülmeyi azaltmak" },
      { id: "strengthen",       label: "Saçı güçlendirmek" },
      { id: "regrowth_support", label: "Yeni saç çıkışını desteklemek" },
      { id: "quality",          label: "Saç kalitesini artırmak" },
    ],
  },
];

const sacFlow: FlowConfig = {
  id: "sac",
  title: "Saç dökülmesini doğru anlayalım",
  subtitle: "Saçının ihtiyacına göre bakımını belirleyelim.",
  accentColor: "#C2410C",
  steps: SAC_STEPS,
  buildProfile(answers) {
    const pattern  = answers.pattern?.[0]  ?? "unknown";
    const severity = answers.severity?.[0] ?? "mild";
    const scalp    = answers.scalp?.[0]    ?? "normal";
    const trigger  = answers.trigger?.[0]  ?? "none";
    const goal     = answers.goal?.[0]     ?? "strengthen";
    return { pattern, severity, scalp, trigger, goal };
  },
  generateSummary(p) {
    const lines: string[] = [];
    if (p.pattern === "diffuse")   lines.push("Dökülme yaygın incelme şeklinde görünüyor.");
    else if (p.pattern === "localized") lines.push("Belirli bölgelerde yoğunlaşan bir dökülme tablosu öne çıkıyor.");
    else if (p.pattern === "seasonal") lines.push("Mevsimsel dökülme eğilimi görülüyor; bu dönemde destekleyici bakım fark yaratabilir.");
    else lines.push("Saç dökülmesinde destekleyici bir bakım tablosu öne çıkıyor.");

    if (p.scalp === "oily") lines.push("Saç derisi dengesi de bu süreci etkiliyor olabilir.");
    if (p.trigger === "stress" || p.trigger === "seasonal") lines.push("Stres ve dönemsel faktörler dökülmeyi artırabilir.");
    if (p.trigger === "medical") lines.push("Hastalık veya ilaç kullanımı kaynaklı dökülmede bir uzmana danışılması önerilir.");
    if (p.severity === "severe") lines.push("Belirgin dökülme tablolarında dermatoloji uzmanına başvurmak faydalı olabilir.");
    return lines.slice(0, 3).join(" ");
  },
  scoreProduct(p, profile) {
    const t = productText(p);
    let s = 50;
    if (/saç|hair|trichol|keratin|biotin|kafein|caffeine|dökülme|shedding/.test(t)) s += 22;
    if (profile.goal === "reduce_loss" && /dökülme|shedding|anti.hair.loss|saç.güçlendirici/.test(t)) s += 18;
    if (profile.goal === "strengthen" && /güçlendirici|strengthen|keratin|protein|biotin/.test(t)) s += 15;
    if (profile.goal === "regrowth_support" && /yeni.saç|regrowth|kafein|caffeine|saç.kökü|follicle/.test(t)) s += 18;
    if (profile.goal === "quality" && /parlaklık|shine|yumuşaklık|softness|onarım|repair/.test(t)) s += 12;
    if (profile.scalp === "oily" && /yağlı|oil.control|dengeley|balancing|hafif|light/.test(t)) s += 10;
    if (profile.scalp === "dry" && /nem|moisturizing|kuru|argan|avokado/.test(t)) s += 10;
    if (profile.scalp === "sensitive" && /sakinleştir|soothing|hassas|gentle|kepek|dandruff/.test(t)) s += 12;
    return Math.max(0, Math.min(100, s));
  },
  getProductReason(p, profile) {
    const t = productText(p);
    if (/biotin|kafein|caffeine|dökülme|anti.hair.loss/.test(t)) return "Saç köklerini destekler";
    if (profile.scalp === "sensitive" && /sakinleştir|soothing|gentle/.test(t)) return "Nazik saç derisi bakımı";
    if (profile.scalp === "oily" && /hafif|oil.control|dengeley/.test(t)) return "Dengeleyici formül";
    if (profile.goal === "regrowth_support" && /kafein|caffeine|regrowth/.test(t)) return "Yeni saç çıkışını destekler";
    if (/günlük|daily/.test(t)) return "Günlük kullanım için uygun";
    return "Saç dökülmesine yönelik destek";
  },
};

// ─── Akış haritası ───────────────────────────────────────────────────────────

export const FLOW_CONFIGS: Record<string, FlowConfig> = {
  akne: akneFlow,
  hassasiyet: hassasiyetFlow,
  leke: lekeFlow,
  kuruluk: kurulukFlow,
  gunes: gunesFlow,
  sac: sacFlow,
};
