/**
 * batchInsertLibraryGapsV3.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manual batch insert: top-10 highest-frequency unknown ingredients across the
 * 28 Supabase products, as reported by the aggregate unknown scan on 2026-04-13.
 *
 * All 10 candidates appeared in ≥ 2 distinct products (2× occurrence).
 * Candidates skipped for this batch (held for V4):
 *   - terephthalylidene dicamphor sulfonic acid (UV filter, complex risk profile)
 *   - di-c12-13 alkyl malate (low ambiguity, deferred)
 *
 * HOW TO RUN (from the ciltbakim-mobile directory):
 *
 *   set -a && source .env && set +a && \
 *   /home/runner/workspace/node_modules/.bin/tsx \
 *     --tsconfig tsconfig.json \
 *     lib/admin/scripts/batchInsertLibraryGapsV3.ts
 *
 * IDEMPOTENT — safe to re-run.
 *   reused_master_count  → canonical already in ingredients_master (no overwrite)
 *   skipped_alias_count  → normalized_alias already in ingredient_aliases
 *
 * WHAT THIS DOES NOT DO:
 *   - Does NOT touch the live score engine (V4 or any other)
 *   - Does NOT modify the local V4 registry (coreRegistry.ts or expansions)
 *   - Does NOT touch resolver/index.ts behaviour
 *   - Does NOT write to ingredient_unknown_queue
 *   - Does NOT remove or overwrite any existing row
 *   - Does NOT run automatically — manual execution only
 *
 * Sources: CosIng EU database, EWG Skin Deep, INCI official, published literature.
 */

import { createLeanSupabase }              from "../nodeResolver";
import { applyUnknownResolutionCandidates } from "../batchResolverNodeSafe";
import type { BatchResolutionCandidate }   from "../batchResolverNodeSafe";

// ── Lean Node.js Supabase client ──────────────────────────────────────────────

const sb = createLeanSupabase();

// ── 10 reviewed candidates (top-10 by frequency from 2026-04-13 report) ───────

const REVIEWED_CANDIDATES: BatchResolutionCandidate[] = [

  // ── 1. Lecithin ─────────────────────────────────────────────────────────────
  // Phospholipid emulsifier and skin-conditioning agent derived from soy or
  // sunflower.  One of the most widely-used cosmetic emulsifiers.  Generally
  // recognised as safe; rarely sensitising except in highly atopic individuals.
  // Seen in: Facial Sun Screen Cream with L-Glutathione | Heliocare 360 Gel Oil-Free SPF50
  {
    suggested_canonical_name: "lecithin",
    aliases: [
      "lecithin",
      "soy lecithin",
      "sunflower lecithin",
    ],
    risk_level:         "low",
    function_tags:      ["emulsifier", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 2. Rhamnose ─────────────────────────────────────────────────────────────
  // Naturally occurring deoxy-sugar.  Identified in Bioderma Ecobiologie line
  // as a prebiotic humectant that supports the cutaneous microbiome.  Topical
  // use: humectant and conditioning agent.  No known safety concerns.
  // Seen in: Bioderma Photoderm AR SPF50+ | Bioderma Photoderm Aquafluide SPF50+
  {
    suggested_canonical_name: "rhamnose",
    aliases: [
      "rhamnose",
      "l-rhamnose",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "prebiotic", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 3. Xylitol ──────────────────────────────────────────────────────────────
  // Sugar alcohol humectant.  Supports skin barrier via prebiotic effect on
  // S. epidermidis.  Used in sensitive- and dry-skin formulas.  No topical
  // safety concerns; extensively studied.
  // Seen in: Bioderma Photoderm AR SPF50+ | Bioderma Photoderm Aquafluide SPF50+
  {
    suggested_canonical_name: "xylitol",
    aliases: [
      "xylitol",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "prebiotic", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 4. Fructooligosaccharides ────────────────────────────────────────────────
  // Prebiotic oligosaccharides (inulin-type sugars).  Support cutaneous
  // microbiome and act as humectants.  Also used in Bioderma Ecobiologie line.
  // Well-tolerated; no known topical toxicity.
  // Seen in: Bioderma Photoderm AR SPF50+ | Bioderma Photoderm Spot SPF50+
  {
    suggested_canonical_name: "fructooligosaccharides",
    aliases: [
      "fructooligosaccharides",
      "fos",
      "oligofructose",
    ],
    risk_level:         "low",
    function_tags:      ["humectant", "prebiotic", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 5. Simethicone ──────────────────────────────────────────────────────────
  // Polydimethylsiloxane/silica compound.  Antifoaming agent and skin protectant.
  // Reduces surface tension and provides a smooth skin feel.  Considered safe
  // for topical use; minimal percutaneous absorption.
  // Seen in: Dermoskin Face Protection SPF50+ | Heliocare 360 Gel Oil-Free SPF50
  {
    suggested_canonical_name: "simethicone",
    aliases: [
      "simethicone",
    ],
    risk_level:         "low",
    function_tags:      ["antifoam", "skin_conditioning", "texture"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 6. Polymethyl Methacrylate ───────────────────────────────────────────────
  // Synthetic polymer microspheres (PMMA).  Used as a texture modifier, soft-
  // focus agent and film former.  Inert; not absorbed through intact skin.
  // No known systemic toxicity at cosmetic concentrations.
  // Seen in: Dermolife Leke Karşıtı SPF50+ | ISDIN Fusion Water SPF50
  {
    suggested_canonical_name: "polymethyl methacrylate",
    aliases: [
      "polymethyl methacrylate",
      "pmma",
    ],
    risk_level:         "low",
    function_tags:      ["film_forming", "texture", "opacifying"],
    concern_flags:      [],
    pregnancy_flag:     "unknown",
    breastfeeding_flag: "unknown",
    allergy_flag:       "low",
  },

  // ── 7. Laminaria Ochroleuca Extract ─────────────────────────────────────────
  // Brown kelp (Oarweed) extract from the Atlantic coast.  Rich in polyphenols,
  // fucoidans and phlorotannins; antioxidant, soothing, and skin-conditioning.
  // Used in Bioderma Photoderm line for its anti-oxidative UV-protection support.
  // Seen in: Bioderma Photoderm AR SPF50+ | Bioderma Photoderm Spot SPF50+
  {
    suggested_canonical_name: "laminaria ochroleuca extract",
    aliases: [
      "laminaria ochroleuca extract",
      "kelp extract",
      "oarweed extract",
    ],
    risk_level:         "low",
    function_tags:      ["antioxidant", "soothing", "botanical_extract"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 8. Chamomilla Recutita Flower Water ─────────────────────────────────────
  // Chamomile floral water (hydrosol) obtained by steam distillation of
  // Matricaria chamomilla flowers.  Soothing, anti-inflammatory, mild astringent.
  // Widely used in sensitive-skin formulations.
  // Seen in: Solante gold SPF50+ | Solante pigmenta SPF50+
  {
    suggested_canonical_name: "chamomilla recutita flower water",
    aliases: [
      "chamomilla recutita flower water",
      "chamomile flower water",
      "matricaria flower water",
    ],
    risk_level:         "low",
    function_tags:      ["soothing", "botanical_water", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 9. Mentha Piperita Leaf Water ────────────────────────────────────────────
  // Peppermint leaf floral water (hydrosol).  Cooling and refreshing; mildly
  // astringent and soothing.  Used in sun-care and toning products.  Contains
  // trace menthol — caution in infants (topical facial use); adults: safe.
  // Seen in: Solante gold SPF50+ | Solante pigmenta SPF50+
  {
    suggested_canonical_name: "mentha piperita leaf water",
    aliases: [
      "mentha piperita leaf water",
      "peppermint leaf water",
    ],
    risk_level:         "low",
    function_tags:      ["botanical_water", "soothing", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },

  // ── 10. C12-13 Alkyl Lactate ─────────────────────────────────────────────────
  // Lactic acid ester of C12-13 fatty alcohols.  Lightweight emollient with
  // excellent spreadability and a non-greasy skin feel.  Skin-conditioning and
  // barrier-supportive; well-tolerated.
  // Seen in: Dermolife Leke Karşıtı SPF50+ | Physiogel Daily Moisture Therapy Krem
  {
    suggested_canonical_name: "c12-13 alkyl lactate",
    aliases: [
      "c12-13 alkyl lactate",
    ],
    risk_level:         "low",
    function_tags:      ["emollient", "skin_conditioning"],
    concern_flags:      [],
    pregnancy_flag:     "safe",
    breastfeeding_flag: "safe",
    allergy_flag:       "low",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const HR  = "─".repeat(65);
  const HR2 = "═".repeat(65);

  console.log(HR);
  console.log(" batchInsertLibraryGapsV3 — Top-10 Unknown Ingredient Insert");
  console.log(` Supabase : ${process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(` Candidates: ${REVIEWED_CANDIDATES.length}`);
  console.log(" Source   : aggregate unknown scan — 2026-04-13 (28 products)");
  console.log(" Frequency: all candidates ≥ 2× across distinct products");
  console.log(" IDEMPOTENT — safe to re-run.");
  console.log(" Does NOT touch score engine, resolver, UI, or local registry.");
  console.log(HR);
  console.log();

  // ── Preview ────────────────────────────────────────────────────────────────

  console.log("Candidates:");
  for (const c of REVIEWED_CANDIDATES) {
    const aliasStr = c.aliases.join(", ");
    const tagStr   = (c.function_tags ?? []).join(", ");
    console.log(`  • "${c.suggested_canonical_name}"  [risk: ${c.risk_level ?? "?"}]`);
    console.log(`    aliases : ${aliasStr}`);
    console.log(`    tags    : ${tagStr}`);
    console.log(`    preg    : ${c.pregnancy_flag ?? "?"}  /  breast: ${c.breastfeeding_flag ?? "?"}`);
  }
  console.log();

  // ── Apply ──────────────────────────────────────────────────────────────────

  console.log("Applying …");
  const result = await applyUnknownResolutionCandidates(REVIEWED_CANDIDATES, sb);
  console.log();

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(HR2);
  console.log(" RESULT SUMMARY");
  console.log(HR2);
  console.log(`  inserted_master_count : ${result.inserted_master_count}`);
  console.log(`  reused_master_count   : ${result.reused_master_count}`);
  console.log(`  inserted_alias_count  : ${result.inserted_alias_count}`);
  console.log(`  skipped_alias_count   : ${result.skipped_alias_count}`);
  console.log(`  errors                : ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log();
    console.log("  ERRORS:");
    for (const e of result.errors) {
      const aliasHint = e.alias ? ` (alias: "${e.alias}")` : "";
      console.log(`    ✖ "${e.candidate_canonical}"${aliasHint}: ${e.message}`);
    }
  }

  console.log(HR2);

  if (result.errors.length === 0) {
    console.log();
    console.log(` ✅  Completed cleanly.`);
    console.log(`     ${result.inserted_master_count} new master row(s),`);
    console.log(`     ${result.inserted_alias_count} new alias row(s),`);
    console.log(`     ${result.skipped_alias_count} alias(es) already present (skipped).`);
    console.log();
    console.log(`     Next step: re-run the aggregate unknown scan to confirm`);
    console.log(`     these 10 no longer appear as unknowns.`);
  } else {
    console.log();
    console.log(` ⚠️   Completed with ${result.errors.length} error(s). Review above.`);
  }

  console.log();
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
