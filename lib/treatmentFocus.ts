/**
 * treatmentFocus.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ürün "tedavi amacı / görev" çıkarımı (additive layer).
 *
 * Bu modül HİÇBİR mevcut mantığı değiştirmez. compareWithFocus.ts üzerinden
 * isteğe bağlı çağrılır; bir üründen primary + secondary treatment focus
 * listesi üretir. Skorlama:
 *   ingredient match → 3 puan
 *   text match       → 2 puan
 *   badge match      → 1 puan
 *
 * Bir ürün için hiçbir kural eşleşmezse `{ primary: null, secondary: [] }`
 * döner — çağıranın (compareWithFocus) güvenli geri-dönüş davranışını
 * tetikler. Mevcut karşılaştırma akışı asla bozulmaz.
 */

import type { Product } from "@/types/product";

export type TreatmentFocus =
  | "acne"
  | "pigmentation"
  | "hydration"
  | "barrier"
  | "dermatitis"
  | "anti_aging"
  | "sunscreen"
  | "hair_loss"
  | "dandruff"
  | "sensitive";

export type TreatmentResult = {
  primary: TreatmentFocus | null;
  secondary: TreatmentFocus[];
};

type Rule = { match: RegExp; foci: TreatmentFocus[] };

// ── İçerik (aktif madde) sinyalleri — yüksek ağırlık ─────────────────────────
// Not: `zinc` için negatif look-ahead — "zinc oxide" güneş koruyucudur,
// akne sinyali olarak sayılmamalı.
const INGREDIENT_RULES: Rule[] = [
  { match: /salicylic|salisilik/i,                       foci: ["acne"] },
  { match: /niacinamide|niasinamid/i,                    foci: ["acne", "pigmentation"] },
  { match: /\bzinc(?!\s*oxide)\b|\bçinko\b|\bzn\s*pca\b/i, foci: ["acne"] },
  { match: /retinol|retinaldehyde|\bretinal\b|retinoid/i, foci: ["anti_aging"] },
  { match: /vitamin\s*c\b|ascorb|askorb/i,               foci: ["pigmentation"] },
  { match: /hyaluron|hyalüron/i,                          foci: ["hydration"] },
  { match: /ceramide|seramid/i,                          foci: ["barrier"] },
  { match: /\burea\b|\büre\b/i,                          foci: ["dermatitis"] },
  { match: /ketoconazole|ketokonazol|piroctone|piroktone/i, foci: ["dandruff", "dermatitis"] },
];

// ── Metin (açıklama / faydalar) sinyalleri — orta ağırlık ────────────────────
const TEXT_RULES: Rule[] = [
  { match: /\b(akne|sivilce|acne)\b/i,                          foci: ["acne"] },
  { match: /\b(leke|melasma|hiperpigmentas|pigmentation)\b/i,   foci: ["pigmentation"] },
  { match: /\b(nem(?:lend)?|hydrat(?:ing|ion)|moistur)/i,       foci: ["hydration"] },
  { match: /\b(bariyer|barrier|repair|onarıcı|onarici)\b/i,     foci: ["barrier"] },
  { match: /\b(hassas|sensitiv)/i,                              foci: ["sensitive"] },
  { match: /\b(spf|güneş|gunes|sunscreen|uva|uvb)\b/i,          foci: ["sunscreen"] },
  { match: /\b(yaşlanma|anti[-\s]?aging|kırışık|kirisik|wrinkle)\b/i, foci: ["anti_aging"] },
  { match: /\b(kepek|dandruff|seboreik|seborrheic)\b/i,         foci: ["dandruff"] },
  { match: /\b(dökülme|hair\s*loss|saç\s*dökülm)\b/i,           foci: ["hair_loss"] },
  { match: /\b(egzama|eczema|dermatit)/i,                       foci: ["dermatitis"] },
];

// Badge sözlüğü TEXT_RULES ile aynıdır; ağırlık farkı çağırıcıda uygulanır.
const BADGE_RULES: Rule[] = TEXT_RULES;

const W_INGREDIENT = 3;
const W_TEXT       = 2;
const W_BADGE      = 1;

// ── Alan toplayıcılar ────────────────────────────────────────────────────────

function collectIngredients(p: Product): string {
  const parts: string[] = [];
  if (Array.isArray(p.ingredients))         parts.push(p.ingredients.join(" "));
  if (Array.isArray(p.active_ingredients))  parts.push(p.active_ingredients.join(" "));
  if (Array.isArray(p.ingredients_parsed)) {
    for (const ing of p.ingredients_parsed) {
      if (ing?.isim)     parts.push(ing.isim);
      if (ing?.inci_adi) parts.push(ing.inci_adi);
    }
  }
  return parts.join(" ");
}

function collectText(p: Product): string {
  const parts: (string | undefined)[] = [
    p.short_description,
    p.full_description,
    p.description,
    (p as any).aciklama,
  ];
  if (Array.isArray(p.benefits)) parts.push(p.benefits.join(" "));
  return parts.filter(Boolean).join(" ");
}

function collectBadges(p: Product): string {
  const parts: string[] = [];
  if (Array.isArray(p.badges))   parts.push(p.badges.join(" "));
  if (Array.isArray(p.features)) parts.push(p.features.join(" "));
  if (Array.isArray(p.tags))     parts.push(p.tags.join(" "));
  return parts.join(" ");
}

function applyRules(
  text: string,
  rules: Rule[],
  weight: number,
  scores: Map<TreatmentFocus, number>,
): void {
  if (!text) return;
  for (const r of rules) {
    if (r.match.test(text)) {
      for (const f of r.foci) {
        scores.set(f, (scores.get(f) ?? 0) + weight);
      }
    }
  }
}

// ── Ana API ──────────────────────────────────────────────────────────────────

/**
 * Bir üründen tedavi amacı (görev) çıkarır.
 *
 * Davranış garantileri:
 *  • Her zaman bir TreatmentResult döner (asla throw etmez)
 *  • Hiçbir kural eşleşmezse `{ primary: null, secondary: [] }` döner
 *  • Çağıran bu boş sonucu "sınıflandırılamadı" sinyali olarak kullanır
 */
export function extractTreatmentFocus(product: Product): TreatmentResult {
  const empty: TreatmentResult = { primary: null, secondary: [] };
  if (!product) return empty;

  const scores = new Map<TreatmentFocus, number>();

  try {
    applyRules(collectIngredients(product), INGREDIENT_RULES, W_INGREDIENT, scores);
    applyRules(collectText(product),        TEXT_RULES,       W_TEXT,       scores);
    applyRules(collectBadges(product),      BADGE_RULES,      W_BADGE,      scores);
  } catch {
    return empty;
  }

  if (scores.size === 0) return empty;

  // Skor desc; eşitlikte enum'daki ilk gelen kazanır (deterministik)
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const primary   = ranked[0][0];
  const secondary = ranked.slice(1, 3).map((e) => e[0]);
  return { primary, secondary };
}
