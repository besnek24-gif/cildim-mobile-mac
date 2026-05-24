/**
 * ingredientAliases.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * İçerik alias / synonym eşleştirme config dosyası.
 *
 * Her grup bir "canonical" (ana) isim + aliases (tüm varyasyonlar) içerir.
 * Modüler yapı: ileride grup eklemek kolaydır.
 */

export interface AliasGroup {
  /** Kanonik (ana) grup adı — dahili kullanım */
  canonical: string;
  /** Türkçe açıklama */
  description: string;
  /** Eşleşme için kullanılacak tüm varyasyonlar (lowercase) */
  aliases: string[];
}

export const ALIAS_GROUPS: AliasGroup[] = [
  {
    canonical: "fragrance",
    description: "Parfüm / Koku bileşenleri",
    aliases: [
      "parfum", "fragrance", "perfume", "aroma", "fragrance mix",
      "limonene", "linalool", "eugenol", "citronellol", "geraniol",
      "benzyl benzoate", "cinnamal", "isoeugenol", "coumarin",
      "cinnamyl alcohol", "farnesol", "hexyl cinnamal", "benzyl alcohol",
      "alpha-isomethyl ionone", "hydroxycitronellal", "amyl cinnamal",
      "butylphenyl methylpropional",
    ],
  },
  {
    canonical: "retinoid",
    description: "Retinoid türevleri",
    aliases: [
      "retinol", "retinyl palmitate", "retinyl acetate", "retinyl propionate",
      "retinal", "retinaldehyde", "tretinoin", "retinoic acid",
      "retinoid", "retinyl linoleate", "hydroxypinacolone retinoate",
      "granactive retinoid",
    ],
  },
  {
    canonical: "salicylate",
    description: "Salisilik asit / BHA türevleri",
    aliases: [
      "salicylic acid", "salicylate", "bha", "beta hydroxy acid",
      "willow bark extract", "salix alba bark extract",
      "methyl salicylate", "sodium salicylate",
    ],
  },
  {
    canonical: "essential_oil",
    description: "Esansiyel yağlar",
    aliases: [
      "lavandula angustifolia oil", "lavandula angustifolia flower oil",
      "lavender oil", "tea tree oil", "melaleuca alternifolia leaf oil",
      "melaleuca alternifolia oil", "citrus aurantium bergamia peel oil",
      "bergamot oil", "lemon oil", "citrus limon peel oil",
      "eucalyptus oil", "eucalyptus globulus leaf oil",
      "peppermint oil", "mentha piperita oil", "mentha piperita leaf oil",
      "rosemary oil", "rosmarinus officinalis leaf oil",
      "orange oil", "citrus sinensis peel oil",
      "clove oil", "syzygium aromaticum leaf oil",
      "cinnamon oil", "cinnamomum zeylanicum bark oil",
      "jasmine oil", "jasminum officinale oil",
      "ylang ylang oil", "cananga odorata flower oil",
      "geranium oil", "pelargonium graveolens flower oil",
      "frankincense oil", "boswellia carterii oil",
      "chamomile oil", "matricaria flower oil",
    ],
  },
  {
    canonical: "alcohol",
    description: "Sert alkol türevleri",
    aliases: [
      "alcohol denat", "denatured alcohol", "sd alcohol",
      "isopropyl alcohol", "ethyl alcohol", "sd alcohol 40",
      "alcohol (denat.)", "alcohol (sd-40)",
    ],
  },
  {
    canonical: "paraben",
    description: "Paraben koruyucular",
    aliases: [
      "methylparaben", "ethylparaben", "propylparaben", "butylparaben",
      "isobutylparaben", "isopropylparaben", "benzylparaben",
    ],
  },
  {
    canonical: "formaldehyde_releaser",
    description: "Formaldehit salıcılar",
    aliases: [
      "formaldehyde", "dmdm hydantoin", "imidazolidinyl urea",
      "diazolidinyl urea", "quaternium-15", "2-bromo-2-nitropropane-1,3-diol",
      "bronopol", "sodium hydroxymethylglycinate",
    ],
  },
  {
    canonical: "sulfate",
    description: "Sülfat yüzey aktif maddeler",
    aliases: [
      "sodium lauryl sulfate", "sls", "sodium laureth sulfate", "sles",
      "ammonium lauryl sulfate", "ammonium laureth sulfate",
    ],
  },
  {
    canonical: "silicone",
    description: "Silikon türevleri",
    aliases: [
      "dimethicone", "cyclomethicone", "cyclopentasiloxane",
      "cyclohexasiloxane", "trimethylsiloxysilicate", "amodimethicone",
      "phenyl trimethicone", "siloxane",
    ],
  },
  {
    canonical: "niacinamide",
    description: "Niasinamid / B3 vitamini",
    aliases: [
      "niacinamide", "nicotinamide", "vitamin b3",
    ],
  },
  {
    canonical: "vitamin_c",
    description: "C vitamini türevleri",
    aliases: [
      "ascorbic acid", "vitamin c", "ascorbyl glucoside", "sodium ascorbyl phosphate",
      "magnesium ascorbyl phosphate", "ascorbyl palmitate", "3-o-ethyl ascorbic acid",
      "tetrahexyldecyl ascorbate",
    ],
  },
  {
    canonical: "aha",
    description: "AHA (Alfa Hidroksi Asit) türevleri",
    aliases: [
      "glycolic acid", "lactic acid", "mandelic acid", "malic acid",
      "tartaric acid", "citric acid", "alpha hydroxy acid", "aha",
    ],
  },
];

// ── Eşleştirme fonksiyonları ─────────────────────────────────────────────────

/** Verilen içerik adını normalize eder (küçük harf, trim) */
export function normalizeIngredient(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Bir içerik adının hangi alias grubuna ait olduğunu döner.
 * Eşleşme yoksa null.
 */
export function resolveAliasGroup(ingredientName: string): AliasGroup | null {
  const norm = normalizeIngredient(ingredientName);
  for (const group of ALIAS_GROUPS) {
    if (group.aliases.some((a) => norm === a || norm.includes(a) || a.includes(norm))) {
      return group;
    }
  }
  return null;
}

/**
 * Kullanıcının girdiği serbest metin ingredienti ile ürün içerik listesi
 * arasında alias-aware eşleşme yapar.
 *
 * @param userEntry   Kullanıcının girdiği içerik adı (avoidedIngredients veya allergyIngredients)
 * @param productIngredients  Ürün ingredientlerinin normalize edilmiş adları
 * @returns Eşleşen ürün içerik adı veya null
 */
export function findIngredientMatch(
  userEntry: string,
  productIngredients: string[],
): string | null {
  const userNorm = normalizeIngredient(userEntry);

  // 1. Direkt birebir veya içerme eşleşmesi
  const direct = productIngredients.find(
    (p) => p === userNorm || p.includes(userNorm) || userNorm.includes(p),
  );
  if (direct) return direct;

  // 2. Alias grubu üzerinden eşleşme
  const userGroup = resolveAliasGroup(userEntry);
  if (!userGroup) return null;

  const viaAlias = productIngredients.find((p) =>
    userGroup.aliases.some((a) => p === a || p.includes(a) || a.includes(p)),
  );
  return viaAlias ?? null;
}
