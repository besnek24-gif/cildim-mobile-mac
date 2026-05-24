/**
 * akilliSecimMapper.ts
 *
 * ECZ4 Multi-Care Profile · Step 7a — Saf (pure) mapper.
 *
 * Akıllı Seçim ekranının seçimlerini, mevcut RoutineProfile şemasına
 * uyumlu bir profile dönüştürür. Bu fonksiyon yalnızca dönüşüm sözleşmesi
 * sunar; hiçbir tüketici tarafından çağrılmaz.
 *
 * Yan etki YOKTUR:
 *   • saveConcernRoutineProfile çağırmaz
 *   • AsyncStorage'a yazmaz
 *   • router'a dokunmaz
 *   • hook çağırmaz
 *   • Supabase / products okumaz
 *   • Auth / kullanıcı durumu okumaz
 *   • Input dizisini mutate etmez
 *   • UI modülü import etmez
 *
 * Sadece "lib/concernRoutineBridge" dosyasından type-only import yapılır.
 */

import type { CareDomain, RoutineProfile } from "./concernRoutineBridge";

// ─── Public input shape ──────────────────────────────────────────────────────

export type AkilliSecimProfileInput = {
  selectedArea: string | null;
  selectedPurpose: string | null;
  selectedConditions: ReadonlyArray<string>;
  selectedLevel: string | null;
};

// ─── Area → Domain (5/5 birebir) ─────────────────────────────────────────────

export const AKILLI_AREA_TO_DOMAIN: Record<string, CareDomain> = {
  cilt: "skin",
  sac: "hair",
  gunes: "sun",
  vucut: "body",
  agiz: "oral",
};

// ─── Purpose → Concern (canonical) ───────────────────────────────────────────
// ECZ4 Step 12 — Body/Oral concern type foundation kullanıma alındı.
// vucut/agiz purpose'ları artık domain-spesifik concern değerlerine eşlenir
// (body_care, body_firming, body_cellulite, oral_daily, oral_whitening,
// oral_gum). Bilinmeyen purpose için domain-içi nötr fallback (body_care /
// oral_daily) kullanılır — eski "dryness" fallback'i terk edildi.
//
// NOT: Step 13'e kadar generateFreeRoutineStructure ve UI label haritası bu
// yeni concern'leri özel olarak ele almaz; ancak AUTO_ROUTINE_SAFE_DOMAINS
// hâlâ body/oral'ı dışarıda tuttuğu için kullanıcı CTA'yı göremez ve
// dolayısıyla yanıltıcı bir auto routine de oluşamaz.

const CILT_PURPOSE_TO_CONCERN: Record<string, RoutineProfile["concern"]> = {
  akne:        "acne",
  hassasiyet:  "sensitivity",
  leke:        "dark_spots",
  nemlendirme: "dryness",
  bariyer:     "dryness",
  temizleme:   "dryness",
};

const VUCUT_PURPOSE_TO_CONCERN: Record<string, RoutineProfile["concern"]> = {
  nemlendirme: "body_care",
  sikilas:     "body_firming",
  selulit:     "body_cellulite",
  hassas:      "body_care",
};

const AGIZ_PURPOSE_TO_CONCERN: Record<string, RoutineProfile["concern"]> = {
  gunluk:     "oral_daily",
  beyazlatma: "oral_whitening",
  disheti:    "oral_gum",
};

function resolveConcern(area: string, purpose: string): RoutineProfile["concern"] {
  if (area === "cilt")  return CILT_PURPOSE_TO_CONCERN[purpose]  ?? "dryness";
  if (area === "vucut") return VUCUT_PURPOSE_TO_CONCERN[purpose] ?? "body_care";
  if (area === "agiz")  return AGIZ_PURPOSE_TO_CONCERN[purpose]  ?? "oral_daily";
  if (area === "sac")   return "hair_loss";
  if (area === "gunes") return "sun";
  // Bilinmeyen area: type-safe son nötr fallback.
  return "dryness";
}

// ─── Purpose → routineGoal (Türkçe kısa açıklama) ────────────────────────────

const PURPOSE_GOALS: Record<string, Record<string, string>> = {
  cilt: {
    temizleme:   "Cildi nazikçe temizlemek",
    nemlendirme: "Nem dengesini korumak",
    leke:        "Leke görünümünü azaltmak",
    akne:        "Akne eğilimini dengelemek",
    hassasiyet:  "Hassasiyeti yatıştırmak",
    bariyer:     "Cilt bariyerini güçlendirmek",
  },
  sac: {
    yikama:   "Saç derisini dengelemek",
    beslenme: "Saçı beslemek ve onarmak",
    nem:      "Saçta nem dengesi kurmak",
    dokulum:  "Dökülmeye karşı destek",
    kepek:    "Kepeğe karşı bakım",
  },
  gunes: {
    yuz:      "Yüz için günlük güneş koruması",
    vucut:    "Vücut için güneş koruması",
    su:       "Suya dayanıklı güneş koruması",
    isiltili: "Işıltılı görünüm ile koruma",
  },
  vucut: {
    nemlendirme: "Vücut için günlük nemlendirme",
    sikilas:     "Sıkılaştırma desteği",
    selulit:     "Selülit görünümüne destek",
    hassas:      "Hassas bölgelere nazik bakım",
  },
  agiz: {
    beyazlatma: "Ağız bakımında beyazlatma desteği",
    disheti:    "Diş eti bakımı",
    gunluk:     "Günlük ağız bakımı",
  },
};

function resolveRoutineGoal(area: string, purpose: string): string {
  return PURPOSE_GOALS[area]?.[purpose] ?? "Akıllı Seçim profili";
}

// ─── Pure mapper ─────────────────────────────────────────────────────────────

export function akilliSecimToRoutineProfile(
  input: AkilliSecimProfileInput,
): RoutineProfile | null {
  const { selectedArea, selectedPurpose, selectedConditions, selectedLevel } = input;

  // Eksik veya bilinmeyen seçim → null. Yarım profil persist edilemesin.
  if (!selectedArea || !selectedPurpose || !selectedLevel) return null;
  const domain = AKILLI_AREA_TO_DOMAIN[selectedArea];
  if (!domain) return null;

  const concern     = resolveConcern(selectedArea, selectedPurpose);
  const routineGoal = resolveRoutineGoal(selectedArea, selectedPurpose);

  // ── Güvenli nötr varsayılanlar ─────────────────────────────────────────────
  let sensitivityLevel: RoutineProfile["sensitivityLevel"] = "medium";
  let activeTolerance:  RoutineProfile["activeTolerance"]  = "medium";
  let oilBalance:       RoutineProfile["oilBalance"]       = "unknown";
  let hydrationNeed:    RoutineProfile["hydrationNeed"]    = "medium";
  let preferredTexture: RoutineProfile["preferredTexture"] = "balanced";

  const protectionNeed: RoutineProfile["protectionNeed"] = domain === "sun" ? "high" : "medium";
  // RoutineProfile.scalpType union'ı undefined kabul etmiyor → tüm domain'ler için "unknown".
  const scalpType: RoutineProfile["scalpType"] = "unknown";

  const notes: string[] = [];

  // ── Conditions (input dizisine dokunulmaz; sadece read) ────────────────────
  if (selectedConditions.includes("hassas")) {
    sensitivityLevel = "high";
    activeTolerance  = "low";
  }
  if (selectedConditions.includes("yagli")) {
    oilBalance       = "oily";
    hydrationNeed    = "low";
    preferredTexture = "light";
  }
  if (selectedConditions.includes("gebelik")) {
    activeTolerance = "low";
    notes.push("Gebelik döneminde dikkat seçimi yapıldı.");
  }
  if (selectedConditions.includes("emzirme")) {
    activeTolerance = "low";
    notes.push("Emzirme döneminde dikkat seçimi yapıldı.");
  }
  if (selectedConditions.includes("parfums")) {
    notes.push("Parfümsüz formüller tercih edildi.");
  }
  if (selectedConditions.includes("alkols")) {
    notes.push("Alkolsüz formüller tercih edildi.");
  }
  if (selectedConditions.includes("vegan")) {
    notes.push("Vegan formüller tercih edildi.");
  }

  // ── selectedLevel: yeni RoutineProfile alanı eklenmez; notes'a yazılır ────
  notes.push(`Akıllı Seçim seviyesi: ${selectedLevel}`);

  return {
    concern,
    severity: "unknown",
    sensitivityLevel,
    barrierStatus: "unknown",
    oilBalance,
    hydrationNeed,
    protectionNeed,
    routineGoal,
    preferredTexture,
    activeTolerance,
    scalpType,
    notes,
    domain,
    source: "akilli_secim",
  };
}
