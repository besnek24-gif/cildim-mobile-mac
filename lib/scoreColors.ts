/**
 * scoreColors.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Global skor renk sistemi — uygulamanın TÜM skor göstergelerinde kullanılır.
 * Bu dosyayı değiştirdiğinizde renk değişikliği tüm uygulamaya yansır.
 *
 * Skor aralıkları (KESİN, 4 bant):
 *  75–100 → Yeşil  (#2E7D32) — Güvenli / Yüksek kalite
 *  50–74  → Amber  (#F9A825) — Dikkatli / Orta kalite
 *  25–49  → Turuncu (#EF6C00) — Riskli / Düşük kalite
 *   0–24  → Kırmızı (#C62828) — Kaçınılmalı / Çok düşük
 *   null  → Gri    — Veri yok
 */

export interface ScoreColors {
  /** Ana vurgu rengi: text, ikon, progress fill, badge text */
  main:   string;
  /** Hafif arkaplan tonu: kart bg, badge bg, progress track */
  bg:     string;
  /** Kenarlık: badge border, kart border */
  border: string;
}

// ── 4-bant tanımları ──────────────────────────────────────────────────────────

const BANDS: ReadonlyArray<{ min: number } & ScoreColors> = [
  { min: 75, main: "#7A8F6B", bg: "#EEF2EA", border: "#B8C9A8" }, // sage     75–100
  { min: 50, main: "#F9A825", bg: "#FFF8E1", border: "#FFECB3" }, // amber    50–74
  { min: 25, main: "#8D6E63", bg: "#EFEBE9", border: "#D7CCC8" }, // kahve    25–49
  { min:  0, main: "#C62828", bg: "#FFEBEE", border: "#EF9A9A" }, // kırmızı   0–24
];

const NULL_BAND: ScoreColors = {
  main:   "#9CA3AF",
  bg:     "rgba(156,163,175,0.08)",
  border: "rgba(156,163,175,0.20)",
};

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Skor için tam renk seti döner (main + bg + border).
 * null, undefined veya negatif girdi → gri nötr
 */
export function getScoreColors(score: number | null | undefined): ScoreColors {
  if (score == null || score < 0) return NULL_BAND;
  const clamped = Math.min(100, Math.max(0, score));
  return BANDS.find(b => clamped >= b.min) ?? BANDS[BANDS.length - 1];
}

/**
 * Sadece ana rengi döner (text, ikon, progress bar fill için).
 */
export function getScoreColor(score: number | null | undefined): string {
  return getScoreColors(score).main;
}

/**
 * Kullanıcıya gösterilen Türkçe etiket.
 */
export function getScoreLabel(score: number | null | undefined): string {
  if (score == null) return "Bilgi yok";
  if (score >= 75)   return "Güvenli";
  if (score >= 50)   return "Dikkatli";
  if (score >= 25)   return "Riskli";
  return "Kaçınılmalı";
}
