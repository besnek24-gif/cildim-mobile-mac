import { type Concern, type LocalProduct } from "./products_v37";
import { getRoutineBlocksV38 } from "./decision_v38";

export type RoutinePlanBlockV45 = {
  title: "Sabah" | "Akşam";
  purpose: string;
  products: LocalProduct[];
  tips: string[];
};

export type RoutinePlanV45 = {
  concern: Concern;
  headline: string;
  summary: string;
  blocks: RoutinePlanBlockV45[];
  totalProducts: number;
  totalSteps: number;
};

export function buildRoutinePlanV45(concern: Concern): RoutinePlanV45 {
  const rawBlocks = getRoutineBlocksV38(concern);

  const blocks: RoutinePlanBlockV45[] = rawBlocks.map((block) => ({
    title: block.title,
    purpose: block.purpose,
    products: block.products,
    tips: buildTips(concern, block.title),
  }));

  const totalProducts = blocks.reduce((sum, block) => sum + block.products.length, 0);

  return {
    concern,
    headline: `${concern} için sabah-akşam bakım planı`,
    summary: buildSummary(concern),
    blocks,
    totalProducts,
    totalSteps: totalProducts,
  };
}

function buildSummary(concern: Concern) {
  if (concern === "Kuruluk") {
    return "Kuruluk odağında rutin; nazik temizlik, bariyer desteği ve düzenli nem anlatımıyla kurulmalı.";
  }

  if (concern === "Hassasiyet") {
    return "Hassasiyet odağında rutin kısa tutulur; fazla ürün yerine anlaşılır ve sakin adımlar öne çıkar.";
  }

  if (concern === "Leke") {
    return "Leke görünümünde gündüz koruma adımı rutinin merkezinde tutulur; akşam destek adımı sade anlatılır.";
  }

  return "Akne eğiliminde temizlik, hafif nem ve dengeleyici destek beraber düşünülür; ağır his oluşturmayan anlatım seçilir.";
}

function buildTips(concern: Concern, title: "Sabah" | "Akşam") {
  if (title === "Sabah") {
    if (concern === "Leke") return ["Koruma adımı atlanmaz.", "Ürün dili gündüz düzenine bağlanır."];
    if (concern === "Akne") return ["Hafif yapı vurgulanır.", "Temizlik sertleştirilmez."];
    return ["Rutin kısa tutulur.", "Koruma ve nem dengesi anlatılır."];
  }

  if (concern === "Kuruluk") return ["Akşam konforu öne alınır.", "Bariyer desteği sade anlatılır."];
  if (concern === "Hassasiyet") return ["Az ürün, net kullanım.", "Yatıştırıcı dil tercih edilir."];
  return ["Akşam destek adımı abartılmaz.", "Düzenli kullanım vurgulanır."];
}
