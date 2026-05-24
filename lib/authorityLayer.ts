/**
 * Professional Authority Layer
 *
 * Dual-layer expertise system:
 *   PHARMACIST (primary)  — practical selection, routine guidance, daily usability
 *   PHYSICIAN  (secondary) — safety boundaries, risk awareness, calibrated caution
 *
 * Principle: Show, don't tell. Consistency over slogans.
 * Authority is felt through repeated subtle signals, not explicit badges.
 */

// ── Type definitions ──────────────────────────────────────────────────────────

export interface PhysicianOverlay {
  title: string;
  body: string;
}

export interface NasılDegerlendiriyoruzCard {
  title: string;
  body: string;
  subNote: string;
}

// ── 1. Pharmacist layer constants ─────────────────────────────────────────────

/**
 * Sub-label shown below the Eczacı Yorumu header.
 * Small, low-emphasis — not a marketing claim.
 */
export const ECZACI_SUB_LABEL = "Eczacı değerlendirmesi";

// ── 2. Physician layer — smart warning overlay ────────────────────────────────

/**
 * Maps warning severity context to physician-tone overlays.
 * Calm, protective, non-alarmist — never fear-based.
 */

interface WarningContext {
  highRiskCount: number;   // ingredients with high risk score
  hasFragrance: boolean;
  hasRetinol: boolean;
  hasAcid: boolean;
  hasSulfate: boolean;
}

const PHYSICIAN_OVERLAYS: Array<{
  test: (ctx: WarningContext) => boolean;
  overlay: PhysicianOverlay;
}> = [
  {
    test: (ctx) => ctx.highRiskCount >= 2,
    overlay: {
      title: "Burada denge önemli",
      body: "Bu formülde birden fazla dikkat gerektiren bileşen bir arada bulunuyor. Daha sade bir rutin veya alternatif bir ürün daha uygun olabilir.",
    },
  },
  {
    test: (ctx) => ctx.hasRetinol && ctx.hasAcid,
    overlay: {
      title: "Daha dikkatli yaklaşım",
      body: "Retinol ve asit içeren ürünler aynı rutinde kullanıldığında hassasiyeti artırabilir. Aralarına zaman bırakmak daha dengeli bir sonuç sağlar.",
    },
  },
  {
    test: (ctx) => ctx.hasRetinol,
    overlay: {
      title: "Daha dikkatli yaklaşım",
      body: "Bu cilt yapısında güçlü aktifler hassasiyeti artırabilir. Başlangıçta düşük konsantrasyon ve seyrek kullanım daha uygun olabilir.",
    },
  },
  {
    test: (ctx) => ctx.hasAcid && ctx.hasFragrance,
    overlay: {
      title: "Burada denge önemli",
      body: "Asit ve parfüm bir arada hassas ciltlerde tolerans sorununa yol açabilir. Daha sade ilerlemek genellikle daha güvenli bir başlangıç noktasıdır.",
    },
  },
  {
    test: (ctx) => ctx.highRiskCount === 1,
    overlay: {
      title: "Daha dikkatli yaklaşım",
      body: "Bu ürünü rutinine eklerken cilt tepkisini gözlemlemek faydalı olabilir. Hassas bölgede küçük bir test uygulaması önerilir.",
    },
  },
  {
    test: (ctx) => ctx.hasSulfate,
    overlay: {
      title: "Burada denge önemli",
      body: "SLS içeriği bazı ciltlerde kuruluk veya bariyer baskısına yol açabilir. Kuru ve hassas ciltlerde kullanım sıklığı göz önünde bulundurulabilir.",
    },
  },
];

/**
 * Returns a physician-tone overlay based on ingredient warning context.
 * Returns null if no meaningful warning exists (don't show it unnecessarily).
 */
export function getPhysicianOverlay(ctx: WarningContext): PhysicianOverlay | null {
  for (const { test, overlay } of PHYSICIAN_OVERLAYS) {
    if (test(ctx)) return overlay;
  }
  return null;
}

/**
 * Builds a WarningContext from parsed ingredients or product data.
 * Accepts a minimal shape to avoid tight coupling.
 */
export function buildWarningContext(opts: {
  highRiskCount?: number;
  ingredientNames?: string[];
  productWarnings?: string[];
}): WarningContext {
  const names = (opts.ingredientNames ?? []).filter((n): n is string => typeof n === "string").map((n) => n.toLowerCase());
  const warnings = (opts.productWarnings ?? []).filter((w): w is string => typeof w === "string").map((w) => w.toLowerCase());
  const all = [...names, ...warnings];

  return {
    highRiskCount: opts.highRiskCount ?? 0,
    hasFragrance:  all.some((s) => s.includes("parfum") || s.includes("fragrance")),
    hasRetinol:    all.some((s) => s.includes("retinol") || s.includes("retinoik") || s.includes("tretinoin")),
    hasAcid:       all.some((s) => ["glycolic", "glikolik", "lactic", "laktik", "salicylic", "salisilik", "aha", "bha"].some((k) => s.includes(k))),
    hasSulfate:    all.some((s) => s.includes("sodium lauryl sulfate") || s.includes("sls")),
  };
}

// ── 3. Article trust signals ──────────────────────────────────────────────────

/**
 * Short trust signal label for the article section header.
 * Low emphasis — appears as a sub-label, not a badge.
 */
export const ARTICLE_TRUST_LABEL = "Dermatolojik kaynaklara dayalı";

// ── 4. "Nasıl değerlendiriyoruz?" micro card ──────────────────────────────────

/**
 * Home screen micro card — mid/lower placement, not dominant.
 * Communicates the dual-layer approach without marketing language.
 */
export const NASIL_DEGERLENDIRIYORUZ: NasılDegerlendiriyoruzCard = {
  title: "Nasıl değerlendiriyoruz?",
  body: 'Eczacı tarafından kurulan "CİLDİM" uygulamasındaki ele alış ve değerlendirişler eczacı ve hekimlerden oluşan heyetle muhakeme edilmektedir.',
  subNote: "Amaç doğru ürünü değil, doğru yaklaşımı bulmaktır.",
};

// ── 5. Unified tone helpers ───────────────────────────────────────────────────

/**
 * Language rules for the authority voice.
 * Pharmacist tone: practical, structured, solution-oriented.
 * Physician tone: cautious, balanced, boundary-setting.
 */
export const AUTHORITY_TONE = {
  /** Preferred qualifiers — use these instead of absolute claims */
  softQualifiers: [
    "daha uygun olabilir",
    "öne çıkıyor",
    "daha dengeli",
    "burada dikkat önemli",
    "daha nazik bir seçenek",
    "genellikle daha iyi tolere edilir",
    "göz önünde bulundurulabilir",
  ],
  /** Words to avoid in authority-layer copy */
  avoid: [
    "kesinlikle", "mutlaka", "garantili", "en iyi", "tedavi",
    "iyileştirir", "tedavi eder", "tanı", "teşhis",
  ],
} as const;

/**
 * Reasoning-based decision output builder.
 * Returns a single-sentence explanation for a recommendation.
 * Used wherever key recommendations appear.
 */
export function buildReasoningSentence(
  trigger: "hassasiyet" | "bariyer" | "akne" | "kuruluk" | "leke" | "gunes" | "genel",
): string {
  const map: Record<string, string> = {
    hassasiyet: "Hassasiyet durumu göz önünde bulundurularak daha nazik bir yapı tercih edildi.",
    bariyer:    "Bariyer durumu göz önünde bulunduruldu.",
    akne:       "Akne eğilimli cilt yapısına göre değerlendirme yapıldı.",
    kuruluk:    "Nem dengesi ve kuruluk eğilimi dikkate alındı.",
    leke:       "Leke ve ton eşitsizliği önceliğine göre değerlendirme yapıldı.",
    gunes:      "Günlük güneş koruması önceliği gözetildi.",
    genel:      "Genel cilt profili ve olası uyumluluk göz önünde bulunduruldu.",
  };
  return map[trigger] ?? map["genel"]!;
}
