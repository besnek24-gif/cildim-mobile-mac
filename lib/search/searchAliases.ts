/**
 * searchAliases.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Marka alias sözlüğü. Buraya yeni marka veya alias eklemek
 * arama motorunun başka hiçbir parçasını değiştirmez.
 *
 * Anahtar    : Veri tabanındaki resmi marka adı
 * Değerler   : Kullanıcının yazabileceği tüm alternatif yazımlar
 *
 * Genişletme:  Sadece bu dosyaya yeni satır ekle → sistem otomatik öğrenir.
 */

// canonical brand name  →  alternate search forms
export const BRAND_ALIASES: Record<string, string[]> = {
  "Avène":            ["avene", "avene cilt", "avene skin"],
  "La Roche-Posay":   ["laroche", "larocheposay", "la roche", "la roche posay", "roche posay", "lrp"],
  "Alldermo":         ["aldermo", "all dermo", "allderm", "alderm", "alderma"],
  "Bioderma":         ["bioderm", "bioderrma", "bideorma", "bidrema", "biodermma"],
  "Photoderm":        ["photod", "fotoderm", "photoderm", "photderm"],
  "CeraVe":           ["cerave", "ceravee", "cera ve", "cerrave", "cerave cilt"],
  "Neutrogena":       ["neutrog", "neutrogina", "neotrogena", "neutr"],
  "Vichy":            ["vichi", "vici", "vichy cilt"],
  "Mustela":          ["mustella", "mustelaa", "mustela"],
  "Eucerin":          ["eucarin", "eucerine", "eucerın", "eucern"],
  "Solante":          ["solanta", "sollante", "solant"],
  "Bioxcin":          ["bioxsin", "bioxcin", "biocsin"],
  "Bionike":          ["bionikee", "bionike", "bio nike"],
  "Zigavus":          ["zigavus", "zigavüs", "zigavüss"],
};

// Reverse lookup: alias lowercase → canonical brand name (O(1) lookup)
export const ALIAS_TO_BRAND: Record<string, string> = {};
for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_BRAND[alias.toLowerCase().trim()] = brand;
  }
}
