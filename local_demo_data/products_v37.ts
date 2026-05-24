export type Segment = "EKO" | "PRO" | "SEC";
export type ProductCategory = "Nem" | "Koruma" | "Temizleme" | "Onarım" | "Serum" | "Göz";
export type Concern = "Kuruluk" | "Hassasiyet" | "Leke" | "Akne";

export type LocalProduct = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  segment: Segment;
  score: number;
  concern: Concern[];
  routineStep: string;
  shortBenefit: string;
  detail: string;
  usage: string;
};

export const PRODUCT_CATEGORIES: Array<"Tümü" | ProductCategory> = [
  "Tümü",
  "Nem",
  "Koruma",
  "Temizleme",
  "Onarım",
  "Serum",
  "Göz",
];

export const CONCERNS: Concern[] = ["Kuruluk", "Hassasiyet", "Leke", "Akne"];

export const LOCAL_PRODUCTS: LocalProduct[] = [
  {
    id: "barrier-cream",
    name: "Nem Bariyer Kremi",
    brand: "Demo Derm",
    category: "Nem",
    segment: "PRO",
    score: 88,
    concern: ["Kuruluk", "Hassasiyet"],
    routineStep: "Nemlendir",
    shortBenefit: "Kuru ve hassas görünümde bariyer desteği.",
    detail: "Bariyer hissini güçlendiren sade nem adımı olarak konumlanır.",
    usage: "Sabah ve akşam temiz cilde ince tabaka halinde anlatılır.",
  },
  {
    id: "spf-fluid",
    name: "Güneş Koruma Fluidi",
    brand: "Demo SPF",
    category: "Koruma",
    segment: "SEC",
    score: 91,
    concern: ["Leke", "Hassasiyet", "Akne"],
    routineStep: "Koruma",
    shortBenefit: "Gündüz rutini için hafif koruma adımı.",
    detail: "Koruma adımı özellikle leke görünümü ve gündüz maruziyetinde öne alınır.",
    usage: "Sabah rutininin son adımı olarak anlatılır.",
  },
  {
    id: "clean-gel",
    name: "Arındırıcı Jel",
    brand: "Demo Clean",
    category: "Temizleme",
    segment: "EKO",
    score: 84,
    concern: ["Akne", "Kuruluk"],
    routineStep: "Temizle",
    shortBenefit: "Sabah-akşam sade temizlik adımı.",
    detail: "Rutinin başlangıç adımıdır; karmaşık anlatıma gerek bırakmaz.",
    usage: "Sabah ve akşam kısa süreli masajla uygulanır, durulanır.",
  },
  {
    id: "repair-balm",
    name: "Onarıcı Bakım Balmı",
    brand: "Demo Repair",
    category: "Onarım",
    segment: "PRO",
    score: 86,
    concern: ["Kuruluk", "Hassasiyet"],
    routineStep: "Onar",
    shortBenefit: "Gece bakımında konfor ve destek hissi.",
    detail: "Akşam rutininde bariyer konforu anlatımı için güçlü demo seçenektir.",
    usage: "Akşam nem adımından sonra veya yerine öneri diliyle anlatılır.",
  },
  {
    id: "spot-serum",
    name: "Leke Görünümü Serumu",
    brand: "Demo Tone",
    category: "Serum",
    segment: "SEC",
    score: 82,
    concern: ["Leke"],
    routineStep: "Ton desteği",
    shortBenefit: "Leke görünümü için destekleyici bakım adımı.",
    detail: "Gündüz korumayla birlikte düşünülmesi gereken serum örneğidir.",
    usage: "Akşam rutininde düşük yoğunluklu başlangıç anlatımıyla konumlanır.",
  },
  {
    id: "calm-cream",
    name: "Yatıştırıcı Bakım Kremi",
    brand: "Demo Calm",
    category: "Nem",
    segment: "PRO",
    score: 89,
    concern: ["Hassasiyet", "Kuruluk"],
    routineStep: "Yatıştır",
    shortBenefit: "Hassas görünümde sade konfor desteği.",
    detail: "Kızarıklık/hassasiyet dili abartılmadan, konfor odağıyla anlatılır.",
    usage: "Gün içinde ihtiyaç halinde kısa ve sade kullanım diliyle önerilir.",
  },
  {
    id: "light-moist",
    name: "Hafif Nem Losyonu",
    brand: "Demo Light",
    category: "Nem",
    segment: "EKO",
    score: 80,
    concern: ["Akne", "Hassasiyet"],
    routineStep: "Hafif nem",
    shortBenefit: "Yağlı his istemeyenler için hafif nem desteği.",
    detail: "Akne eğilimli görünümde ağır his oluşturmayan demo nem adımıdır.",
    usage: "Temizlik sonrası az miktarda uygulanır.",
  },
  {
    id: "eye-gel",
    name: "Göz Çevresi Jeli",
    brand: "Demo Eye",
    category: "Göz",
    segment: "PRO",
    score: 83,
    concern: ["Hassasiyet"],
    routineStep: "Göz çevresi",
    shortBenefit: "Göz çevresinde hafif bakım hissi.",
    detail: "Rutin genişlediğinde göz çevresi adımının nasıl anlatılacağını gösterir.",
    usage: "Göz çevresine çok az miktarda, nazik uygulama diliyle anlatılır.",
  },
  {
    id: "night-cream",
    name: "Gece Nem Kremi",
    brand: "Demo Night",
    category: "Onarım",
    segment: "PRO",
    score: 87,
    concern: ["Kuruluk"],
    routineStep: "Gece nem",
    shortBenefit: "Akşam rutini için yoğun nem desteği.",
    detail: "Kuruluk baskınsa akşam rutininde ana ürün olarak öne çıkar.",
    usage: "Akşam temizlik sonrası nem adımı olarak anlatılır.",
  },
  {
    id: "daily-spf",
    name: "Günlük Koruma Kremi",
    brand: "Demo Daily",
    category: "Koruma",
    segment: "EKO",
    score: 79,
    concern: ["Leke", "Hassasiyet"],
    routineStep: "Gündüz koruma",
    shortBenefit: "Günlük kullanım için pratik koruma adımı.",
    detail: "Temel koruma ihtiyacını sade ve ekonomik dille temsil eder.",
    usage: "Sabah son adım olarak anlatılır.",
  },
  {
    id: "balance-serum",
    name: "Dengeleyici Serum",
    brand: "Demo Balance",
    category: "Serum",
    segment: "PRO",
    score: 85,
    concern: ["Akne"],
    routineStep: "Dengele",
    shortBenefit: "Akne eğilimli görünümde denge desteği.",
    detail: "Temizleme ve hafif nemle birlikte anlatılan destekleyici serum örneğidir.",
    usage: "Akşam rutininde yavaş başlangıç diliyle gösterilir.",
  },
  {
    id: "soft-cleanser",
    name: "Nazik Temizleme Sütü",
    brand: "Demo Soft",
    category: "Temizleme",
    segment: "SEC",
    score: 90,
    concern: ["Kuruluk", "Hassasiyet"],
    routineStep: "Nazik temizle",
    shortBenefit: "Kuruluk hissinde yumuşak temizlik seçeneği.",
    detail: "Bariyer hassasiyeti olan senaryolarda sert temizlik dilinden uzak durur.",
    usage: "Sabah veya akşam nazik temizleme adımı olarak anlatılır.",
  },
];

export function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

export function filterProducts(params: {
  query: string;
  category: "Tümü" | ProductCategory;
  concern: Concern;
}) {
  const q = normalizeText(params.query.trim());

  return LOCAL_PRODUCTS.filter((product) => {
    const categoryOk = params.category === "Tümü" || product.category === params.category;
    const concernOk = product.concern.includes(params.concern);
    const queryOk =
      q.length === 0 ||
      normalizeText(product.name).includes(q) ||
      normalizeText(product.brand).includes(q) ||
      normalizeText(product.shortBenefit).includes(q) ||
      normalizeText(product.category).includes(q);

    return categoryOk && concernOk && queryOk;
  }).sort((a, b) => b.score - a.score);
}

export function getRoutineForConcern(concern: Concern) {
  const pools = LOCAL_PRODUCTS.filter((product) => product.concern.includes(concern)).sort((a, b) => b.score - a.score);
  const morning = pools.filter((product) => product.category === "Temizleme" || product.category === "Nem" || product.category === "Koruma").slice(0, 3);
  const evening = pools.filter((product) => product.category === "Temizleme" || product.category === "Onarım" || product.category === "Serum" || product.category === "Nem").slice(0, 3);

  return {
    title: `${concern} odaklı demo rutin`,
    morning,
    evening,
  };
}

export function getProductById(id: string) {
  return LOCAL_PRODUCTS.find((product) => product.id === id) ?? LOCAL_PRODUCTS[0];
}
