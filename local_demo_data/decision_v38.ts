import { LOCAL_PRODUCTS, type Concern, type LocalProduct } from "./products_v37";

export type RoutineBlock = {
  title: "Sabah" | "Akşam";
  purpose: string;
  products: LocalProduct[];
};

export type DecisionSummary = {
  winner: LocalProduct;
  other: LocalProduct;
  scoreGap: number;
  sentence: string;
  reasons: string[];
};

export function getBestProductsForConcern(concern: Concern) {
  return LOCAL_PRODUCTS
    .filter((product) => product.concern.includes(concern))
    .sort((a, b) => b.score - a.score);
}

export function getRoutineBlocksV38(concern: Concern): RoutineBlock[] {
  const pool = getBestProductsForConcern(concern);

  const morning = [
    pool.find((item) => item.category === "Temizleme"),
    pool.find((item) => item.category === "Nem"),
    pool.find((item) => item.category === "Koruma"),
  ].filter(Boolean) as LocalProduct[];

  const evening = [
    pool.find((item) => item.category === "Temizleme"),
    pool.find((item) => item.category === "Serum" || item.category === "Onarım"),
    pool.find((item) => item.category === "Nem" || item.category === "Onarım"),
  ].filter(Boolean) as LocalProduct[];

  return [
    {
      title: "Sabah",
      purpose: "Günü sade başlatır; temizlik, nem ve koruma odağı kurar.",
      products: uniqueById(morning.length ? morning : pool.slice(0, 3)),
    },
    {
      title: "Akşam",
      purpose: "Gün sonu temizlik ve destekleyici bakım dilini kurar.",
      products: uniqueById(evening.length ? evening : pool.slice(0, 3)),
    },
  ];
}

export function compareProductsV38(left: LocalProduct, right: LocalProduct): DecisionSummary {
  const winner = left.score >= right.score ? left : right;
  const other = winner.id === left.id ? right : left;
  const scoreGap = Math.abs(left.score - right.score);

  const reasons = [
    `${winner.name} skor tarafında ${scoreGap === 0 ? "eşit seviyede" : `${scoreGap} puan önde`} görünüyor.`,
    `${winner.category} kategorisi, bu demo kararda ana ihtiyaç olarak okunuyor.`,
    `${winner.segment} segmentiyle danışma dilinde farklı fiyat/konum anlatımı yapılabilir.`,
  ];

  const sentence =
    scoreGap === 0
      ? `${left.name} ve ${right.name} birbirine yakın. Kararı kategori ihtiyacı belirler.`
      : `${winner.name}, bu karşılaştırmada ${other.name} karşısında daha uygun demo seçenek olarak öne çıkar.`;

  return { winner, other, scoreGap, sentence, reasons };
}

export function buildAnalysisText(concern: Concern, count: number) {
  if (count === 0) {
    return `${concern} için bu yerel katalogda uygun demo ürün bulunamadı. Filtre genişletilmeli.`;
  }

  if (concern === "Kuruluk") {
    return "Kuruluk odağında önce bariyer desteği, sonra akşam konforu anlatılır.";
  }

  if (concern === "Hassasiyet") {
    return "Hassasiyet odağında kısa, sakin ve düşük karmaşıklıklı rutin dili kullanılmalı.";
  }

  if (concern === "Leke") {
    return "Leke görünümünde gündüz koruma adımı kararın merkezine alınmalı.";
  }

  return "Akne eğiliminde temizlik, hafif nem ve dengeleyici destek birlikte düşünülmeli.";
}

function uniqueById(products: LocalProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}
