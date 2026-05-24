import { type Concern, type LocalProduct } from "./products_v37";
import { getBestProductsForConcern, getRoutineBlocksV38 } from "./decision_v38";

export type SkinFeel = "Kuru" | "Hassas" | "Parlama" | "Donuk";
export type RoutineLevel = "Sade" | "Dengeli" | "Geniş";

export type AnalysisResultV39 = {
  title: string;
  summary: string;
  priorities: string[];
  products: LocalProduct[];
  routineTitle: string;
  routineLines: string[];
};

export const SKIN_FEELS: SkinFeel[] = ["Kuru", "Hassas", "Parlama", "Donuk"];
export const ROUTINE_LEVELS: RoutineLevel[] = ["Sade", "Dengeli", "Geniş"];

export function buildAnalysisResultV39(params: {
  concern: Concern;
  feel: SkinFeel;
  level: RoutineLevel;
}): AnalysisResultV39 {
  const products = getBestProductsForConcern(params.concern).slice(0, params.level === "Sade" ? 3 : params.level === "Dengeli" ? 4 : 5);
  const routine = getRoutineBlocksV38(params.concern);

  const title = `${params.concern} odaklı demo analiz`;
  const summary = getSummary(params.concern, params.feel, params.level);
  const priorities = getPriorities(params.concern, params.feel, params.level);
  const routineLines = routine.flatMap((block) =>
    block.products.slice(0, params.level === "Sade" ? 2 : 3).map((product) => `${block.title}: ${product.routineStep} — ${product.name}`),
  );

  return {
    title,
    summary,
    priorities,
    products,
    routineTitle: `${params.level} bakım planı`,
    routineLines,
  };
}

function getSummary(concern: Concern, feel: SkinFeel, level: RoutineLevel) {
  if (concern === "Kuruluk") {
    return `${feel} hissiyle birlikte kuruluk öne çıkıyor. ${level} akışta bariyer ve nem dili sade kurulmalı.`;
  }

  if (concern === "Hassasiyet") {
    return `${feel} hissi hassasiyet anlatımını güçlendiriyor. Önce kısa, sakin ve anlaşılır bakım dili seçilmeli.`;
  }

  if (concern === "Leke") {
    return `${feel} görünümde leke odağı varsa gündüz koruma adımı merkezde tutulmalı.`;
  }

  return `${feel} hissiyle birlikte akne eğilimi okunuyorsa temizlik, hafif nem ve denge odağı birlikte kurulmalı.`;
}

function getPriorities(concern: Concern, feel: SkinFeel, level: RoutineLevel) {
  const base = [`Ana endişe: ${concern}`, `Cilt hissi: ${feel}`, `Rutin seviyesi: ${level}`];

  if (concern === "Kuruluk") return [...base, "Bariyer desteği", "Akşam konforu"];
  if (concern === "Hassasiyet") return [...base, "Sade içerik dili", "Kısa rutin"];
  if (concern === "Leke") return [...base, "Gündüz koruma", "Düzenli kullanım"];
  return [...base, "Nazik temizlik", "Hafif nem"];
}
