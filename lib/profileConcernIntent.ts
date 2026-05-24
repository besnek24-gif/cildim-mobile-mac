/**
 * profileConcernIntent.ts — Profil Eşleştirme · Free-Text Concern Resolver
 *
 * ECZ-4 DÖRTLÜ Step 4.
 *
 * Kullanıcının "Benim için ara" ekranına yazdığı doğal Türkçe metni,
 * mevcut canonical SkinConcernKey + UI alias setine eşler.
 *
 * KAPSAM SINIRI:
 *  - Bu modül global Search engine ile İLGİSİZDİR.
 *  - productMatchEngine / smartRoutineEngine / recommendationFlowStore'a
 *    HİÇ alias/free-text key sızdırmaz; sadece UI tarafında öneri üretir.
 *  - normalizeTR dışında dış engine import etmez.
 *  - Saf, yan-etkisiz; çağıran tarafta useMemo ile cache'lenir.
 */

import { normalizeTR } from "@/lib/concernSearchEngine";
import type { SkinConcernKey } from "@/lib/userPreferences";

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type ProfileConcernUIKey =
  | SkinConcernKey
  | "blackheads"
  | "dullness"
  | "texture"
  | "oiliness"
  | "sensitivity";

export type ConcernIntentConfidence = "high" | "medium";

export type ProfileConcernIntent = {
  uiKey:           ProfileConcernUIKey;
  canonical:       SkinConcernKey;
  confidence:      ConcernIntentConfidence;
  matchedKeywords: string[];
};

// ─── UI → Canonical eşleme (Step 3 ile birebir) ───────────────────────────────

const UI_TO_CANONICAL: Record<ProfileConcernUIKey, SkinConcernKey> = {
  acne:           "acne",
  spots:          "spots",
  redness:        "redness",
  dehydration:    "dehydration",
  barrier_repair: "barrier_repair",
  anti_aging:     "anti_aging",
  pore:           "pore",
  blackheads:     "pore",
  dullness:       "spots",
  texture:        "pore",
  oiliness:       "pore",
  sensitivity:    "redness",
};

// ─── Anahtar kelime tablosu ───────────────────────────────────────────────────
// strong=true → tek başına eşleşse bile "high" güven verir.
// Sıralama eşitlikte tie-break belirler (üstteki kazanır).

interface IntentEntry {
  uiKey: ProfileConcernUIKey;
  terms: string[];
  strong?: boolean;
}

const INTENT_TABLE: IntentEntry[] = [
  {
    uiKey: "acne",
    strong: true,
    terms: [
      "sivilce", "sivilcem", "sivilceler", "sivilceli",
      "akne", "pimple", "pimples",
      "iltihap", "iltihapli", "kistik",
    ],
  },
  {
    uiKey: "blackheads",
    strong: true,
    terms: [
      "siyah nokta", "siyah noktalar", "siyah noktam",
      "blackhead", "blackheads",
      "komedon", "komedonlar",
    ],
  },
  {
    uiKey: "pore",
    strong: true,
    terms: [
      "gozenek", "gozenekler", "gozenegim", "gozeneklerim",
      "buyuk gozenek", "belirgin gozenek", "genis gozenek",
    ],
  },
  {
    uiKey: "texture",
    terms: [
      "putur", "puturlu",
      "puruz", "puruzlu", "puruzsuzluk",
      "doku", "doku bozuklugu", "doku bozuk",
    ],
  },
  {
    uiKey: "oiliness",
    strong: true,
    terms: [
      "yaglanma", "yaglaniyor", "yaglaniyorum",
      "yagli cilt", "yagli",
      "parlama", "parliyor", "parlak cilt",
      "sebum", "asiri yaglanma",
    ],
  },
  {
    uiKey: "spots",
    strong: true,
    terms: [
      "leke", "lekem", "lekelerim", "lekeli",
      "iz", "sivilce izi", "akne izi",
      "ton esitsizligi", "ten esitsizligi",
      "hiperpigmentasyon", "pigmentasyon",
    ],
  },
  {
    uiKey: "dullness",
    terms: [
      "donuk", "donuk cilt", "donuklasma",
      "mat", "mat gorunum", "mat cilt",
      "cansiz", "soluk", "soluk cilt",
    ],
  },
  {
    uiKey: "sensitivity",
    strong: true,
    terms: [
      "yaniyor", "yanma", "yaniyor cilt",
      "batiyor", "batma",
      "hassas", "hassasiyet", "hassas cilt",
      "reaktif", "tepki veriyor",
    ],
  },
  {
    uiKey: "redness",
    strong: true,
    terms: [
      "kizariklik", "kizariyor", "kizariyorum", "kirmizilik",
      "rosacea", "rozasea", "rozase",
    ],
  },
  {
    uiKey: "dehydration",
    strong: true,
    terms: [
      "pul pul", "pulleniyor",
      "kuru", "kuruluk", "kuru cilt",
      "gergin", "gerginlik",
      "nemsiz", "susuz", "susuz cilt",
    ],
  },
  {
    uiKey: "barrier_repair",
    strong: true,
    terms: [
      "bariyer", "cilt bariyeri", "bariyerim",
      "tahris", "tahris oldu",
      "soyulma", "soyuluyor", "soyuldu",
      "yandi", "kabuk", "kabuklanma",
    ],
  },
  {
    uiKey: "anti_aging",
    strong: true,
    terms: [
      "kirisik", "kirisiklik", "kirisiklar",
      "yaslanma", "yaslandim",
      "ince cizgi", "ince cizgiler",
      "anti aging", "antiaging",
      "sikilik", "sarkma",
    ],
  },
];

// Tüm terimler tabloya alınırken normalize edilmiş kopyası önceden hesaplanır.
const NORMALIZED_TABLE: Array<{
  uiKey: ProfileConcernUIKey;
  strong: boolean;
  terms: Array<{ raw: string; norm: string; isMultiWord: boolean }>;
}> = INTENT_TABLE.map(entry => ({
  uiKey:  entry.uiKey,
  strong: !!entry.strong,
  terms:  entry.terms.map(t => {
    const norm = normalizeTR(t);
    return { raw: t, norm, isMultiWord: norm.includes(" ") };
  }),
}));

// ─── Resolver ─────────────────────────────────────────────────────────────────

export function resolveConcernFromText(input: string): ProfileConcernIntent | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const norm = normalizeTR(trimmed);
  if (norm.length < 3) return null;

  // Kelime sınırı eşleşmesi için boşlukla padlenmiş hali
  const padded = ` ${norm} `;

  let bestIndex = -1;
  let bestScore = 0;
  let bestEntry: typeof NORMALIZED_TABLE[number] | null = null;
  let bestMatched: string[] = [];

  for (let i = 0; i < NORMALIZED_TABLE.length; i++) {
    const entry = NORMALIZED_TABLE[i];
    const matched: string[] = [];
    let score = 0;

    for (const term of entry.terms) {
      let hit = false;
      if (term.isMultiWord) {
        // Çok kelimeli ifade: substring yeterli (norm zaten lowercase)
        if (norm.includes(term.norm)) hit = true;
      } else {
        // Tek kelime: kelime sınırına saygı (boşluk-padded içinde " term ")
        if (padded.includes(` ${term.norm} `)) hit = true;
        // Kullanıcı ek alabilir: "sivilcem", "lekem" — terim listesi zaten
        // bu varyantları içeriyor; ek olarak basit bir prefix eşleşmesi yapma
        // (false positive riskini önlemek için).
      }

      if (hit) {
        matched.push(term.raw);
        score += term.isMultiWord ? 3 : 1;
      }
    }

    if (score > bestScore) {
      bestScore   = score;
      bestIndex   = i;
      bestEntry   = entry;
      bestMatched = matched;
    }
    // Eşitlikte tie-break: tablo sırası öncelikli → sadece score > best.
  }

  if (!bestEntry || bestScore === 0) return null;

  // Güven hesabı:
  // - 2+ farklı eşleşme → high
  // - 1 eşleşme + entry strong → high
  // - 1 eşleşme + multi-word → high (uzun ifade kuvvetli sinyaldir)
  // - aksi → medium
  let confidence: ConcernIntentConfidence;
  if (bestMatched.length >= 2) {
    confidence = "high";
  } else if (bestEntry.strong) {
    confidence = "high";
  } else if (bestEntry.terms.find(t => t.raw === bestMatched[0])?.isMultiWord) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  // bestIndex tie-break referansı (lint için kullanım)
  void bestIndex;

  return {
    uiKey:           bestEntry.uiKey,
    canonical:       UI_TO_CANONICAL[bestEntry.uiKey],
    confidence,
    matchedKeywords: bestMatched,
  };
}
