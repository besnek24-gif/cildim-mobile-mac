type RiskLevel = "low" | "medium" | "high" | "unknown";
type RiskBucket = "safe" | "low_risk" | "medium_risk" | "high_risk" | "unknown";

interface IngredientRiskInput {
  canonical_name: string;
  category?: string;
  flags?: string[];
}

interface IngredientRiskOutput {
  risk_level: RiskLevel;
  bucket: RiskBucket;
  reasons: string[];
}

const CATEGORY_NORM_MAP: Record<string, string> = {
  sunfilter:   "uv_filter",
  sunscreen:   "uv_filter",
  uvfilter:    "uv_filter",
  solvent:     "solvent",
  emulsifier:  "emulsifier",
  thickener:   "thickener",
  absorbent:   "absorbent",
  ph_adjuster: "ph_adjuster",
  preservative:"preservative",
};

function normalizeCategory(cat?: string): string | null {
  if (!cat) return null;
  return CATEGORY_NORM_MAP[cat] ?? cat;
}

const SAFE_CATEGORIES     = new Set(["humectant", "soothing", "antioxidant", "ph_adjuster"]);
const LOW_RISK_CATEGORIES = new Set(["solvent", "emulsifier", "thickener", "absorbent"]);

export function getIngredientRiskV2(input: IngredientRiskInput): IngredientRiskOutput {
  const { canonical_name, category: rawCategory, flags = [] } = input;
  const category = normalizeCategory(rawCategory);

  if (!canonical_name || canonical_name.trim() === "") {
    return {
      risk_level: "unknown",
      bucket: "unknown",
      reasons: ["No canonical name provided"],
    };
  }

  // ── Priority overrides ────────────────────────────────────────────────────
  if (flags.includes("force_high")) {
    return {
      risk_level: "high",
      bucket: "high_risk",
      reasons: ["Force-flagged as high risk"],
    };
  }

  if (flags.includes("force_medium")) {
    return {
      risk_level: "medium",
      bucket: "medium_risk",
      reasons: ["Force-flagged as medium risk"],
    };
  }

  // ── High-risk flags ───────────────────────────────────────────────────────
  if (flags.includes("fragrance") || flags.includes("allergen")) {
    return {
      risk_level: "high",
      bucket: "high_risk",
      reasons: ["Flagged as fragrance or known allergen"],
    };
  }

  if (flags.includes("drying_alcohol")) {
    return {
      risk_level: "high",
      bucket: "high_risk",
      reasons: ["Flagged as drying alcohol"],
    };
  }

  // ── UV filter (normalized from sunfilter / sunscreen / uvfilter) ──────────
  if (category === "uv_filter") {
    return {
      risk_level: "medium",
      bucket: "medium_risk",
      reasons: [`UV filter (raw: "${rawCategory}") — potential sensitizer at high concentrations`],
    };
  }

  // ── Medium-risk flags ─────────────────────────────────────────────────────
  if (flags.includes("preservative")) {
    return {
      risk_level: "medium",
      bucket: "medium_risk",
      reasons: ["Flagged as preservative — may cause sensitivity"],
    };
  }

  if (flags.includes("surfactant")) {
    return {
      risk_level: "medium",
      bucket: "medium_risk",
      reasons: ["Flagged as surfactant — potential skin barrier disruption"],
    };
  }

  if (flags.includes("active")) {
    return {
      risk_level: "medium",
      bucket: "medium_risk",
      reasons: ["Flagged as active — efficacious but may irritate sensitive skin"],
    };
  }

  // ── Low / safe flags ──────────────────────────────────────────────────────
  if (flags.includes("barrier_support")) {
    return {
      risk_level: "low",
      bucket: "safe",
      reasons: ["Flagged as barrier support — generally well tolerated"],
    };
  }

  // ── Emollient — safe only when NOT remapped from a different category ──────
  if (category === "emollient" && rawCategory === "emollient") {
    return {
      risk_level: "low",
      bucket: "safe",
      reasons: ["Category \"emollient\" — skin-barrier compatible, low risk"],
    };
  }

  // ── Other safe categories (humectant / soothing / antioxidant / ph_adjuster)
  if (category && SAFE_CATEGORIES.has(category)) {
    return {
      risk_level: "low",
      bucket: "safe",
      reasons: [`Category "${category}" is considered low risk`],
    };
  }

  // ── Functional categories — low concern, medium level ────────────────────
  if (category && LOW_RISK_CATEGORIES.has(category)) {
    return {
      risk_level: "medium",
      bucket: "low_risk",
      reasons: [`Category "${category}" — functional ingredient, low concern`],
    };
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    risk_level: "unknown",
    bucket: "unknown",
    reasons: ["No matching rule — risk level undetermined"],
  };
}
