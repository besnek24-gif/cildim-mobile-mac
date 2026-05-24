/**
 * anketToRoutineProfile.ts
 *
 * ECZ4 Step B — Saf (pure) mapper.
 *
 * Cilt Anketi (questionnaire.tsx) form yanıtlarını mevcut RoutineProfile
 * şemasına dönüştürür. Hiçbir yan etki yoktur:
 *   • saveConcernRoutineProfile çağırmaz
 *   • AsyncStorage'a yazmaz
 *   • router'a / hook'lara dokunmaz
 *   • Supabase / scoring / ingredient engine okumaz
 *   • Input objesini mutate etmez
 *
 * Persist + navigate sorumluluğu çağıranındır (questionnaire.tsx).
 *
 * Sadece "lib/concernRoutineBridge" dosyasından type-only import yapılır.
 */

import type { RoutineProfile } from "./concernRoutineBridge";

// ─── Public input shape ──────────────────────────────────────────────────────

export type AnketInput = {
  age_range?: string;
  skin_type?: string;
  primary_concerns: ReadonlyArray<string>;
  current_actives:  ReadonlyArray<string>;
  lifestyle:        ReadonlyArray<string>;
};

// ─── Sabit eşleştirmeler ─────────────────────────────────────────────────────

// questionnaire.tsx primary_concerns id'leri → RoutineProfile.concern union.
// "daily_care" / "none" → null (skin_type fallback'e devredilir).
// Concern union şu anki haliyle anti-aging içermediğinden kırışıklık ve
// halkalar gibi kuruluk-temelli concern'ler "dryness"e map edilir.
const ANKET_CONCERN_MAP: Record<string, RoutineProfile["concern"] | null> = {
  akne:        "acne",
  hassasiyet:  "sensitivity",
  leke:        "dark_spots",
  parlaklık:   "dark_spots",
  kuruluğu:    "dryness",
  kırışıklık:  "dryness",
  halkalar:    "dryness",
  gözenek:     "acne",
  daily_care:  null,
  none:        null,
};

const SKIN_TYPE_TO_OIL: Record<string, RoutineProfile["oilBalance"]> = {
  kuru:    "dry",
  yağlı:   "oily",
  karma:   "combination",
  normal:  "unknown",
  hassas:  "unknown",
};

// ─── Yardımcı seçiciler ──────────────────────────────────────────────────────

function pickConcern(input: AnketInput): RoutineProfile["concern"] {
  // Birincil concern: ilk eşleşen non-null değer.
  for (const id of input.primary_concerns) {
    const mapped = ANKET_CONCERN_MAP[id];
    if (mapped) return mapped;
  }
  // Hepsi "daily_care" / "none" / bilinmeyen → skin_type fallback.
  switch (input.skin_type) {
    case "hassas": return "sensitivity";
    case "yağlı":  return "acne";       // Yağ kontrolü odaklı bakım
    case "kuru":   return "dryness";
    default:       return "dryness";    // Genel günlük bakım iskeletine en yakın
  }
}

function pickActiveTolerance(input: AnketInput): RoutineProfile["activeTolerance"] {
  const has = (k: string) => input.current_actives.includes(k);
  if (has("hic-biri")) return "low";
  if (has("retinol") || has("aha-bha") || has("vitamin-c") || has("peptides")) return "high";
  if (has("niacinamide") || has("hyaluronic")) return "medium";
  return "medium";
}

function pickSensitivity(input: AnketInput): RoutineProfile["sensitivityLevel"] {
  if (input.skin_type === "hassas") return "high";
  if (input.primary_concerns.includes("hassasiyet")) return "high";
  return "low";
}

function pickHydrationNeed(input: AnketInput): RoutineProfile["hydrationNeed"] {
  if (input.skin_type === "kuru") return "high";
  if (input.primary_concerns.includes("kuruluğu") || input.primary_concerns.includes("kırışıklık")) return "high";
  return "medium";
}

function pickProtectionNeed(input: AnketInput): RoutineProfile["protectionNeed"] {
  const c = input.primary_concerns;
  if (c.includes("leke") || c.includes("parlaklık") || c.includes("halkalar")) return "high";
  return "medium";
}

function pickPreferredTexture(input: AnketInput): RoutineProfile["preferredTexture"] {
  if (input.skin_type === "yağlı") return "light";
  if (input.skin_type === "kuru")  return "rich";
  return "balanced";
}

function pickRoutineGoal(concern: RoutineProfile["concern"], hasOnlyDailyCare: boolean): string {
  if (hasOnlyDailyCare) return "Günlük temel bakımı sürdürmek";
  switch (concern) {
    case "acne":       return "Yeni sivilce oluşumunu azaltmak";
    case "sensitivity":return "Cildi yatıştırmak ve rahatsız etmemek";
    case "dark_spots": return "Leke görünümünü azaltmak";
    case "dryness":    return "Nem dengesini desteklemek";
    default:           return "Cilde uygun temel bakım";
  }
}

function buildNotes(input: AnketInput): string[] {
  const notes: string[] = [];
  if (input.lifestyle.includes("gebe")) {
    notes.push("Hamilelik / emzirme döneminde retinol, salisilik asit ve yüksek doz C vitamini gibi içeriklerden kaçınmanız önerilir.");
  }
  if (input.lifestyle.includes("az-uyku")) {
    notes.push("Az uyku cilt yenilenmesini etkiler — gece bakımına önem verin.");
  }
  if (input.lifestyle.includes("sigara")) {
    notes.push("Sigara cilt elastikiyetini ve canlılığını düşürür.");
  }
  if (input.lifestyle.includes("güneş-koruması") === false && input.lifestyle.length > 0 && !input.lifestyle.includes("none")) {
    notes.push("Günlük SPF kullanımı bakımın temel adımıdır.");
  }
  return notes;
}

// ─── Ana mapper ──────────────────────────────────────────────────────────────

/**
 * AnketInput → RoutineProfile (deterministic, side-effect-free).
 *
 * `domain` her zaman "skin" (anket yalnız cilt sorularını kapsar).
 * `source` "anket" — RoutineProfileSource union'a Step B'de eklendi.
 */
export function anketToRoutineProfile(input: AnketInput): RoutineProfile {
  const onlyDailyCare =
    input.primary_concerns.length === 0 ||
    input.primary_concerns.every((c) => c === "daily_care" || c === "none" || !ANKET_CONCERN_MAP[c]);

  const concern = pickConcern(input);

  return {
    concern,
    severity: input.primary_concerns.length >= 3 ? "high" : input.primary_concerns.length >= 2 ? "medium" : "low",
    sensitivityLevel: pickSensitivity(input),
    barrierStatus: input.skin_type === "hassas" ? "partial" : "normal",
    oilBalance: SKIN_TYPE_TO_OIL[input.skin_type ?? ""] ?? "unknown",
    hydrationNeed: pickHydrationNeed(input),
    protectionNeed: pickProtectionNeed(input),
    routineGoal: pickRoutineGoal(concern, onlyDailyCare),
    preferredTexture: pickPreferredTexture(input),
    activeTolerance: pickActiveTolerance(input),
    scalpType: "unknown",
    notes: buildNotes(input),
    domain: "skin",
    source: "anket",
  };
}
