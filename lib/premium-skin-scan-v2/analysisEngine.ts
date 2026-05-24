/**
 * premium-skin-scan-v2 — analysisEngine
 *
 * Deterministik, hızlı analiz motoru.
 * - URI hash'i → seeded PRNG → tutarlı sonuç
 * - Yumuşak, olasılıksal dil
 * - Tıbbi iddia yok, güçlü yargı yok
 */

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type RoleType = "Esas" | "Destek" | "İsteğe bağlı";

export interface RoutineStep {
  name:      string;
  role:      RoleType;
  /** Adım tipi — boşsa çalışma zamanında inferStepType ile türetilir. */
  stepType?: string;
}

export interface ProductItem {
  name:   string;
  role:   string;
  reason: string;
}

/**
 * RELEASE-BLOCKER PART E — score_source: skor tek başına bir sayıdan
 * fazlasıdır; nereden geldiğinin izlenebilmesi gerekir.
 *  - "server"  : sunucudan gelen geçerli sayı (1..100)
 *  - "default" : sunucu boş/eksik → 0/varsayılan kullanıldı
 *  - "hidden"  : pose-failed gibi sebeplerden UI saklıyor (gösterme!)
 *  - "invalid" : sunucudan NaN/yanlış tipte sayı geldi → 0'a sabitlendi
 */
export type ScoreSource = "server" | "default" | "hidden" | "invalid";

export interface AnalysisResult {
  id:           string;
  timestamp:    string;
  skinType:     string;
  score:        number;
  /** RELEASE-BLOCKER PART E — additive, opsiyonel. */
  score_source?: ScoreSource;
  concerns:     string[];   // max 3, kısa cümle
  comment:      string;     // 1-2 satır
  morning:      RoutineStep[];
  evening:      RoutineStep[];
  weekly:       RoutineStep[];  // haftalık bakım (0-3 adım)
  products:     {
    ekonomik:     ProductItem[];
    profesyonel:  ProductItem[];
    seckin:       ProductItem[];
  };
}

// ─── Seeded PRNG (LCG) ────────────────────────────────────────────────────────

function makePrng(seed: number) {
  let s = Math.abs(seed) || 98765;
  return (): number => {
    s = ((s * 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

// ─── Havuzlar ─────────────────────────────────────────────────────────────────

const CONCERN_POOLS: Record<string, string[]> = {
  // ECZ4 STEP 4 — "tespit/risk ölçüldü" iddiaları yumuşatıldı; bakım önerisi diline çevrildi.
  Karma: [
    "T bölgesi için odaklanmış bakım faydalı olabilir",
    "Yanak bölgesi nem desteğinden yararlanabilir",
    "T bölgesinde sebum dengeleyici bakım önerilebilir",
    "Göz çevresine hafif nem desteği önerilir",
  ],
  Yağlı: [
    "Yağlı ciltler için dengeleyici bakım önerilir",
    "T bölgesinde sebum kontrolüne odaklanmak faydalı olabilir",
    "Gün ortası parlaklık için hafif formüller tercih edilebilir",
    "Yağlı bölgeler için tıkanma önleyici bakım önerilir",
  ],
  Kuru: [
    "Genel yüzey nemine ihtiyaç duyuluyor",
    "Yanaklar ve alında sıkışma hissi",
    "Göz çevresinde hafif kuruluk",
    "Cilt bariyerinde minimal zayıflık",
  ],
  Normal: [
    "Çevre etkenlerine hafif duyarlılık",
    "Göz çevresinde hafif nem ihtiyacı",
    "Cilt tonu genel olarak dengeli",
  ],
  Hassas: [
    "Hassas ciltler için yatıştırıcı bakım önceliklidir",
    "Aktif içeriklere kademeli ve dikkatli yaklaşım önerilir",
    "Cilt bariyerini destekleyen sade bakım faydalı olabilir",
  ],
};

const COMMENTS: Record<string, string[]> = {
  Karma:  [
    "Bölgesel ihtiyaçlar farklılaşıyor. Hedefli bakım rutinle dengelenir.",
    "T bölgesi ve yanaklar farklı ilgi ister; önerilen rutin bunu gözetiyor.",
  ],
  Yağlı:  [
    "Yağ dengesini düzenlemek mümkün. Hafif, nem verici içerikler öncelik.",
    "Yağ salgısı kontrol altına alınabilir. Sert temizleyicilerden kaçının.",
  ],
  Kuru:   [
    "Cilt neme ihtiyaç duyuyor. Katmanlı nemlendirme etkili sonuç verir.",
    "Bariyer desteği ve nem kilitleme rutinin temeli olmalı.",
  ],
  Normal: [
    "Cilt dengesi korunmuş. Küçük dokunuşlarla daha iyi hale gelir.",
    "Genel tablo olumlu. Rutin sürdürülebilirlik ön planda.",
  ],
  Hassas: [
    "Cilt reaksiyon eşiği düşük. Sade ve bilinen içerikler tercih edilmeli.",
    "Az sayıda, test edilmiş ürünle güvenli bir rutin oluşturuyoruz.",
  ],
};

const WEEKLY_ROUTINES: Record<string, RoutineStep[]> = {
  Karma: [
    { name: "Kil maskesi",              role: "Destek" },
    { name: "Hafif eksfoliasyon",       role: "İsteğe bağlı" },
  ],
  Yağlı: [
    { name: "Gözenek maskesi",          role: "Destek" },
    { name: "BHA yüz maskesi",          role: "İsteğe bağlı" },
  ],
  Kuru: [
    { name: "Yoğun nemlendirici maske", role: "Esas" },
    { name: "Yüz yağı masajı",          role: "İsteğe bağlı" },
  ],
  Normal: [
    { name: "Hafif kil maske",          role: "İsteğe bağlı" },
  ],
  Hassas: [
    { name: "Yatıştırıcı maske",        role: "Destek" },
    { name: "Bariyer bakım maskesi",    role: "İsteğe bağlı" },
  ],
};

const ROUTINES: Record<string, { morning: RoutineStep[]; evening: RoutineStep[] }> = {
  Karma: {
    morning: [
      { name: "Köpük temizleyici",          role: "Esas" },
      { name: "Hafif nemlendirici",          role: "Esas" },
      { name: "SPF 50+ güneş koruyucu",      role: "Esas" },
      { name: "Niacinamide serum",           role: "Destek" },
    ],
    evening: [
      { name: "Çift temizleme",             role: "Esas" },
      { name: "Hafif AHA toner",            role: "Destek" },
      { name: "Nemlendirici krem",          role: "Esas" },
      { name: "Göz altı kremi",             role: "İsteğe bağlı" },
    ],
  },
  Yağlı: {
    morning: [
      { name: "Jel temizleyici",            role: "Esas" },
      { name: "Yağ-free nemlendirici",      role: "Esas" },
      { name: "SPF 50 hafif formül",        role: "Esas" },
    ],
    evening: [
      { name: "Köpük temizleyici",          role: "Esas" },
      { name: "BHA toner",                  role: "Destek" },
      { name: "Hafif jel nemlendirici",     role: "Esas" },
      { name: "Retinol (başlangıç dozu)",   role: "İsteğe bağlı" },
    ],
  },
  Kuru: {
    morning: [
      { name: "Kremsi temizleyici",         role: "Esas" },
      { name: "Hyaluronik asit serum",      role: "Esas" },
      { name: "Zengin nemlendirici",        role: "Esas" },
      { name: "SPF 50+ güneş koruyucu",     role: "Esas" },
    ],
    evening: [
      { name: "Kremsi temizleyici",         role: "Esas" },
      { name: "Peptit serum",               role: "Destek" },
      { name: "Yoğun gece kremi",           role: "Esas" },
      { name: "Göz kremi",                  role: "İsteğe bağlı" },
    ],
  },
  Normal: {
    morning: [
      { name: "Hafif jel temizleyici",      role: "Esas" },
      { name: "Hafif nemlendirici",         role: "Esas" },
      { name: "SPF 50+ güneş koruyucu",     role: "Esas" },
    ],
    evening: [
      { name: "Temizleyici",                role: "Esas" },
      { name: "Hafif serum",                role: "Destek" },
      { name: "Nemlendirici",               role: "Esas" },
    ],
  },
  Hassas: {
    morning: [
      { name: "Parfümsüz kremsi temizleyici", role: "Esas" },
      { name: "Kalın bariyer nemlendirici",   role: "Esas" },
      { name: "Mineral SPF 50+",              role: "Esas" },
    ],
    evening: [
      { name: "Hassas cilt temizleyici",    role: "Esas" },
      { name: "Pantenol serum",             role: "Destek" },
      { name: "Onarıcı gece kremi",         role: "Esas" },
      { name: "Yüz yağı (bitkisel)",        role: "İsteğe bağlı" },
    ],
  },
};

/**
 * LEGACY — Hardcoded ürün havuzu.
 *
 * ECZ4 STEP 3'ten itibaren bu havuz birincil ürün kaynağı DEĞİLDİR.
 * Tek gerçek kaynak: Supabase (`v2ProductDB.fetchAlternativesForStep`).
 *
 * Bu sabit yalnızca:
 *   • analysisEngine'in `AnalysisResult.products` alanını tutarlılık için
 *     doldurur (tip uyumu / store geçmişi);
 *   • result.tsx StepRow'unda Supabase TAMAMEN boş döndüğünde ÜÇÜNCÜ
 *     öncelik fallback olarak gösterilir (selectedProduct → autoProduct →
 *     bu sıraya göre).
 *
 * Yeni ürün eklenmeyecek; UI metni Supabase'ten geliyor.
 */
const PRODUCTS: Record<string, AnalysisResult["products"]> = {
  Karma: {
    ekonomik: [
      { name: "CeraVe Jel Temizleyici",   role: "Temizleyici",    reason: "Yağ dengesini bozmaz" },
      { name: "Neutrogena Hydro Boost",   role: "Nemlendirici",   reason: "Hafif, yağ-free formül" },
    ],
    profesyonel: [
      { name: "La Roche-Posay Effaclar",  role: "Temizleyici",    reason: "T bölgesi için ideal" },
      { name: "Vichy Normaderm SPF 50",   role: "Güneş koruyucu", reason: "Yağlı T bölgesine uyumlu" },
    ],
    seckin: [
      { name: "Tata Harper Clarifying",   role: "Temizleyici",    reason: "Karma cilt için bitkisel formül" },
      { name: "Augustinus Bader Rich",    role: "Nemlendirici",   reason: "Dengeli nemlendirme" },
    ],
  },
  Yağlı: {
    ekonomik: [
      { name: "Bioderma Sébium Foaming",  role: "Temizleyici",    reason: "Gözenek temizliği" },
      { name: "The Ordinary Niacinamide", role: "Serum",          reason: "Yağ kontrolü + gözenek" },
    ],
    profesyonel: [
      { name: "La Roche-Posay Toleriane", role: "Nemlendirici",   reason: "Yağ-free, hafif" },
      { name: "Paula's Choice BHA",       role: "Exfoliant",      reason: "Gözenek içi temizleme" },
    ],
    seckin: [
      { name: "Drunk Elephant Framboos",  role: "Serum",          reason: "Pürüzsüz doku" },
      { name: "Tatcha The Rice Wash",     role: "Temizleyici",    reason: "Yağ dengeleme" },
    ],
  },
  Kuru: {
    ekonomik: [
      { name: "CeraVe Nemlendirici Krem", role: "Nemlendirici",   reason: "Seramid bazlı bariyer desteği" },
      { name: "Aquaphor Healing",         role: "Onarıcı",        reason: "Aşırı kuru alanlar için" },
    ],
    profesyonel: [
      { name: "La Roche-Posay Toleriane", role: "Nemlendirici",   reason: "Derin nem, hafif dokunuş" },
      { name: "Vichy Mineral 89",         role: "Serum",          reason: "Hyaluronik asit + mineral su" },
    ],
    seckin: [
      { name: "Drunk Elephant Protini",   role: "Nemlendirici",   reason: "Protein bazlı yoğun nem" },
      { name: "Sunday Riley CEO Glow",    role: "Yağ",            reason: "Parlaklık + nem kilitleme" },
    ],
  },
  Normal: {
    ekonomik: [
      { name: "Simple Kind to Skin",      role: "Temizleyici",    reason: "Günlük hafif temizlik" },
      { name: "Neutrogena Ultra Gentle",  role: "Nemlendirici",   reason: "Dengeli nem" },
    ],
    profesyonel: [
      { name: "La Roche-Posay Effaclar H",role: "Nemlendirici",   reason: "Denge koruyucu formül" },
      { name: "Avène Eau Thermale SPF",   role: "Güneş koruyucu", reason: "Hafif ciltler için" },
    ],
    seckin: [
      { name: "Tatcha Dewy Skin Cream",   role: "Nemlendirici",   reason: "Premium nem dengesi" },
      { name: "Tata Harper Elixir Vitae", role: "Serum",          reason: "Yaşlanma karşıtı destek" },
    ],
  },
  Hassas: {
    ekonomik: [
      { name: "CeraVe Hassas Temizleyici",role: "Temizleyici",    reason: "Parfümsüz, bariyer koruyucu" },
      { name: "Avène Cicalfate",          role: "Onarıcı",        reason: "Kızarıklık azaltma" },
    ],
    profesyonel: [
      { name: "La Roche-Posay Cicaplast", role: "Onarıcı",        reason: "Hassas cilt bariyeri" },
      { name: "Avène Tolerance Fluid",    role: "Nemlendirici",   reason: "Minimal içerik, güvenli" },
    ],
    seckin: [
      { name: "Augustinus Bader The Cream",role:"Nemlendirici",   reason: "Bariyer onarım formülü" },
      { name: "Tata Harper Rescuing",     role: "Serum",          reason: "Hassas cilt serumu" },
    ],
  },
};

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

export function generateAnalysis(photoUris: string[]): AnalysisResult {
  // URI'lardan deterministik seed üret
  const seed = photoUris
    .join("")
    .split("")
    .reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);

  const r = makePrng(seed);

  // Cilt tipi — ağırlıklı seçim
  const types    = ["Karma", "Yağlı", "Kuru", "Normal", "Hassas"] as const;
  const weights  = [0.30,    0.25,    0.20,   0.15,     0.10];
  let skinType   = "Karma";
  let cumul      = 0;
  const roll     = r();
  for (let i = 0; i < types.length; i++) {
    cumul += weights[i];
    if (roll < cumul) { skinType = types[i]; break; }
  }

  // Skor
  const scoreRanges: Record<string, [number, number]> = {
    Normal: [72, 88], Karma: [63, 78], Yağlı: [55, 72], Kuru: [58, 74], Hassas: [58, 72],
  };
  const [lo, hi] = scoreRanges[skinType] ?? [60, 80];
  const score = Math.round(lo + r() * (hi - lo));

  // Endişeler (2-3 adet)
  const pool     = CONCERN_POOLS[skinType] ?? CONCERN_POOLS["Normal"];
  const nConcern = 2 + (r() > 0.55 ? 1 : 0);
  const concerns: string[] = [];
  const used     = new Set<number>();
  let tries      = 0;
  while (concerns.length < nConcern && tries < 20) {
    tries++;
    const idx = Math.floor(r() * pool.length);
    if (!used.has(idx)) { used.add(idx); concerns.push(pool[idx]); }
  }

  const comment  = pick(COMMENTS[skinType] ?? COMMENTS["Normal"], r);
  const routine  = ROUTINES[skinType] ?? ROUTINES["Normal"];
  const weekly   = WEEKLY_ROUTINES[skinType] ?? [];
  const products = PRODUCTS[skinType] ?? PRODUCTS["Normal"];

  return {
    id:        `pskv2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    skinType,
    score,
    concerns,
    comment,
    morning:   routine.morning,
    evening:   routine.evening,
    weekly,
    products,
  };
}
