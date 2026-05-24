import type { MultiAngleSkinResult } from "./skinAnalysisTypes";

const SORUN_TO_CONCERN: Record<string, string> = {
  akne: "acne",
  sivilce: "acne",
  kırışık: "aging",
  yaşlanma: "aging",
  kırışıklık: "aging",
  kızarıklık: "sensitivity",
  hassasiyet: "sensitivity",
  hassas: "sensitivity",
  kuruluk: "dryness",
  kuru: "dryness",
  yağlılık: "oiliness",
  yağlı: "oiliness",
  gözenek: "pores",
  "büyük gözenek": "pores",
  leke: "dark_spots",
  pigmentasyon: "dark_spots",
  "koyu leke": "dark_spots",
  "koyu halka": "dark_circles",
  "göz altı": "dark_circles",
  "güneş hasarı": "sun",
  "uv hasarı": "sun",
};

export function mapAnalysisToRoutineConcerns(result: MultiAngleSkinResult): string[] {
  const concerns = new Set<string>();

  for (const sorun of result.sorunlar ?? []) {
    const key = sorun.toLowerCase().trim();
    const direct = SORUN_TO_CONCERN[key];
    if (direct) {
      concerns.add(direct);
      continue;
    }
    for (const [k, v] of Object.entries(SORUN_TO_CONCERN)) {
      if (key.includes(k) || k.includes(key)) {
        concerns.add(v);
        break;
      }
    }
  }

  const ct = (result.cilt_tipi ?? "").toLowerCase();
  if (ct.includes("kuru") || (result.nem_seviyesi ?? 50) < 40) concerns.add("dryness");
  if (ct.includes("yağlı")) concerns.add("oiliness");
  if (ct.includes("hassas")) concerns.add("sensitivity");

  const uv = (result.uv_hasarı ?? "").toLowerCase();
  if (uv === "orta" || uv === "belirgin") concerns.add("sun");

  return Array.from(concerns);
}

export function mapAnalysisToIngredientAvoids(result: MultiAngleSkinResult): string[] {
  return result.kaçınılacak_maddeler ?? [];
}

export function mapAnalysisToConcernParam(result: MultiAngleSkinResult): string {
  return mapAnalysisToRoutineConcerns(result).join(",");
}
