/**
 * premium-skin-scan-v2 — captureStore
 * Session-level basit modül değişkeni. Zustand DEĞİL.
 * Uygulama içinde tek sayfa geçişlerinde veri tutmak için.
 *
 * ECZ-CAP-1 (additive):
 *   - AngleCapture'a opsiyonel quality/safety metadata alanları eklendi.
 *   - Eski tüketiciler (id/label/uri okuyanlar) etkilenmez; tüm yeni alanlar
 *     opsiyonel, set edilmediğinde undefined döner.
 *   - Tara öznesi yaş grubu (bebek/çocuk vb.) ekran-seviyesi state olarak
 *     ayrı tutulur — açı başına değil, oturuma bağlıdır.
 */

export type QualityLabel = "good" | "fair" | "poor" | "failed";

export type ScanSubjectAgeGroup =
  | "baby"
  | "child"
  | "teen"
  | "adult"
  | "unknown";

export interface AngleCapture {
  id:    "front" | "left" | "right" | "up" | "down";
  label: string;
  uri:   string;

  // ─── ECZ-CAP-1 additive safety metadata (hepsi opsiyonel) ─────────────────
  qualityScore?:     number;        // 0-100 composite
  qualityLabel?:     QualityLabel;
  brightnessScore?:  number;        // 0-100 normalize edilmiş
  sharpnessScore?:   number;        // 0-100 (Laplacian variance türevi)
  poseAngleOk?:      boolean;       // çekim anında gyroscope-stable mi
  faceDetected?:     boolean;       // bilinmiyorsa undefined
  faceCount?:        number;        // bilinmiyorsa undefined
  captureWarnings?:  string[];      // ör. ["face_detection_unavailable","low_brightness"]

  // ─── ECZ-FINAL-QA-FIX-5: Perceptual hash (dHash, 16 hex char = 64 bit) ───
  // Aynı sahne/açıdan tekrar çekimleri yakalamak için piksel-bazlı imza.
  // Hesaplanamadıysa (decode hatası) undefined kalır — ardışık aşamalar
  // hash yokluğunu "kanıt yok" sayıp hard-block'tan kaçınır.
  perceptualHash?:   string;
}

const _angles: AngleCapture[] = [];

let _scanSubjectAgeGroup: ScanSubjectAgeGroup = "unknown";

export const captureStore = {
  reset: () => {
    _angles.length = 0;
    _scanSubjectAgeGroup = "unknown";
  },
  add: (item: AngleCapture) => {
    // Aynı id varsa güncelle
    const idx = _angles.findIndex((a) => a.id === item.id);
    if (idx >= 0) _angles[idx] = item;
    else _angles.push(item);
  },
  get: (): AngleCapture[] => [..._angles],
  count: () => _angles.length,
  /** index'e kadar (hariç) koru, geri kalanı sil */
  truncateTo: (n: number) => {
    _angles.length = Math.max(0, n);
  },

  // ─── ECZ-CAP-1: yaş grubu safety flag ─────────────────────────────────────
  setScanSubjectAgeGroup: (g: ScanSubjectAgeGroup) => {
    _scanSubjectAgeGroup = g;
  },
  getScanSubjectAgeGroup: (): ScanSubjectAgeGroup => _scanSubjectAgeGroup,
};
