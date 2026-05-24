import type { Product } from "@/types/product";
import { getConcernProfile } from "./concernFlowStore";

// ─── Types ─────────────────────────────────────────────────────────────────

export type RoutineRole =
  | "cleanser"
  | "treatment"
  | "moisturizer"
  | "sunscreen"
  | "hair_care"
  | "support";

export type TextureStyle = "light" | "balanced" | "rich";
export type FitLevel = "low" | "medium" | "high";

export interface ProductPurposeProfile {
  primaryUse: string;
  secondaryUse?: string;
  betterFor: string[];
  lessIdealFor?: string[];
  routineRole: RoutineRole;
  routineStep: string;
  textureStyle: TextureStyle;
  skinContextTags: string[];
  concernTags: string[];
  sensitivityFit: FitLevel;
  barrierFit: FitLevel;
  whoIsItFor: string;
}

export interface ComparisonInsight {
  coreDifference: string;
  whoA: string;
  whoB: string;
  routineStepA: string;
  routineStepB: string;
  decisionSummary: string;
  decisionWinner: "A" | "B" | "tie" | null;
  concernNote: string | null;
  warningNote: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function norm(p: Product): {
  name: string; brand: string; category: string; subcategory: string;
  desc: string; features: string[]; ingredients: string[];
} {
  const name = (p.name ?? (p as any).isim ?? "").toLowerCase();
  const brand = (p.brand ?? (p as any).marka ?? "").toLowerCase();
  const category = (p.category ?? (p as any).kategori ?? "").toLowerCase().trim();
  const subcategory = (p.subcategory ?? "").toLowerCase().trim();
  const desc = (
    (p as any).short_description ?? (p as any).kisa_aciklama ??
    (p as any).description ?? (p as any).aciklama ?? ""
  ).toLowerCase();
  const featuresRaw = (p as any).features ?? (p as any).ozellikler ?? "";
  const features: string[] = Array.isArray(featuresRaw)
    ? featuresRaw.map((f: any) => String(f).toLowerCase())
    : typeof featuresRaw === "string"
      ? featuresRaw.split(",").map((s: string) => s.trim().toLowerCase())
      : [];
  const ingRaw = (p as any).ingredients ?? (p as any).icerik_listesi ?? "";
  const ingredients: string[] = Array.isArray(ingRaw)
    ? ingRaw.map((i: any) => String(i).toLowerCase())
    : typeof ingRaw === "string"
      ? ingRaw.split(",").map((s: string) => s.trim().toLowerCase())
      : [];
  return { name, brand, category, subcategory, desc, features, ingredients };
}

function hasAny(haystack: string[], needles: string[]): boolean {
  return needles.some(n => haystack.some(h => h.includes(n)));
}

function hasAnyInText(text: string, needles: string[]): boolean {
  return needles.some(n => text.includes(n));
}

// ─── Role Detection ────────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<RoutineRole, string[]> = {
  sunscreen: ["güneş", "spf", "sunscreen", "sun care", "uv", "pa+"],
  cleanser:  ["temizleyici", "cleanser", "yüz yıkama", "misel", "yıkama"],
  treatment: ["serum", "asit", "retinol", "azelaic", "c vitamini", "niacinamide", "peptide", "ampul", "essence", "tonik"],
  moisturizer: ["nemlendirici", "krem", "moisturizer", "bariyer", "hidrat"],
  hair_care:  ["saç", "şampuan", "saçlar", "scalp", "hair"],
  support:    [],
};

function detectRoutineRole(n: ReturnType<typeof norm>): RoutineRole {
  const full = `${n.category} ${n.subcategory} ${n.desc} ${n.features.join(" ")}`;
  for (const [role, keys] of Object.entries(ROLE_KEYWORDS) as [RoutineRole, string[]][]) {
    if (role === "support") continue;
    if (hasAnyInText(full, keys)) return role;
  }
  return "support";
}

// ─── Texture Detection ─────────────────────────────────────────────────────

function detectTexture(n: ReturnType<typeof norm>): TextureStyle {
  const full = `${n.name} ${n.category} ${n.subcategory} ${n.desc}`;
  if (hasAnyInText(full, ["jel", "gel", "hafif", "light", "fluid", "sıvı", "aqua", "mist"])) return "light";
  if (hasAnyInText(full, ["yoğun", "zengin", "rich", "balm", "krem", "cream", "butter", "yağ", "oil"])) return "rich";
  return "balanced";
}

// ─── Sensitivity / Barrier Fit ─────────────────────────────────────────────

function detectSensitivityFit(n: ReturnType<typeof norm>): FitLevel {
  const full = `${n.desc} ${n.features.join(" ")}`;
  const ingredients = n.ingredients;

  const GENTLE_SIGNALS = ["hassas", "sensitive", "gentle", "calming", "yatıştır", "alkol içermez", "parfümsüz", "fragrance-free", "hypoallergenic"];
  const HARSH_SIGNALS  = ["retinol", "tretinoin", "glycolic", "salicylic", "aha", "bha", "benzoyl", "peeling", "scrub", "alcohol denat"];

  const gentleScore = GENTLE_SIGNALS.filter(s => hasAnyInText(full, [s]) || hasAny(ingredients, [s])).length;
  const harshScore  = HARSH_SIGNALS.filter(s => hasAnyInText(full, [s]) || hasAny(ingredients, [s])).length;

  if (harshScore >= 2) return "low";
  if (harshScore === 1 && gentleScore === 0) return "low";
  if (gentleScore >= 2 || (gentleScore >= 1 && harshScore === 0)) return "high";
  return "medium";
}

function detectBarrierFit(n: ReturnType<typeof norm>): FitLevel {
  const full = `${n.desc} ${n.features.join(" ")}`;
  const ingredients = n.ingredients;

  const BARRIER_POSITIVE = ["ceramide", "seramid", "bariyer", "barrier", "lipid", "cholesterol", "fatty acid", "madecassoside", "centella", "panthenol"];
  const BARRIER_NEGATIVE = ["scrub", "peeling", "glycolic", "exfoliant"];

  const pos = BARRIER_POSITIVE.filter(s => hasAnyInText(full, [s]) || hasAny(ingredients, [s])).length;
  const neg = BARRIER_NEGATIVE.filter(s => hasAnyInText(full, [s]) || hasAny(ingredients, [s])).length;

  if (pos >= 2) return "high";
  if (neg >= 1) return "low";
  if (pos === 1) return "medium";
  return "medium";
}

// ─── Concern Tags ──────────────────────────────────────────────────────────

function detectConcernTags(n: ReturnType<typeof norm>): string[] {
  const full = `${n.desc} ${n.features.join(" ")} ${n.name} ${n.category}`;
  const tags: string[] = [];

  if (hasAnyInText(full, ["akne", "sivilce", "bha", "salicylic", "benzoyl", "gözenek", "yağlı", "comedogenic"])) tags.push("akne");
  if (hasAnyInText(full, ["leke", "niacinamide", "azelaic", "c vitamini", "kojic", "arbutin", "ton", "brightening", "aydınlatma"])) tags.push("leke");
  if (hasAnyInText(full, ["hassasiyet", "sensitive", "kızarıklık", "rosacea", "calming", "yatıştır"])) tags.push("hassasiyet");
  if (hasAnyInText(full, ["kuruluk", "dry", "nemlendirici", "hyaluronic", "ceramide", "hidrat", "bariyer"])) tags.push("kuruluk");
  if (hasAnyInText(full, ["güneş", "spf", "uv", "leke koruma", "koruma"])) tags.push("gunes");
  if (hasAnyInText(full, ["saç", "hair", "scalp", "dökülme"])) tags.push("sac");

  return [...new Set(tags)];
}

// ─── Skin Context Tags ─────────────────────────────────────────────────────

function detectSkinContextTags(n: ReturnType<typeof norm>): string[] {
  const full = `${n.desc} ${n.features.join(" ")}`;
  const tags: string[] = [];
  if (hasAnyInText(full, ["yağlı", "oily", "parlama", "matlaştır"])) tags.push("yağlı cilt");
  if (hasAnyInText(full, ["kuru", "dry", "çeken", "sıkışan"])) tags.push("kuru cilt");
  if (hasAnyInText(full, ["karma", "combination", "T-bölgesi"])) tags.push("karma cilt");
  if (hasAnyInText(full, ["hassas", "sensitive", "reaktif"])) tags.push("hassas cilt");
  if (hasAnyInText(full, ["normal", "tüm cilt"])) tags.push("normal cilt");
  if (hasAnyInText(full, ["yaşlanma", "anti-aging", "kırışık", "retinol", "peptide", "lifting"])) tags.push("olgunlaşan cilt");
  return tags;
}

// ─── Routine Step Text ─────────────────────────────────────────────────────

function detectRoutineStep(role: RoutineRole, n: ReturnType<typeof norm>): string {
  const full = `${n.desc} ${n.features.join(" ")}`;
  switch (role) {
    case "sunscreen":  return "Sabah son adım — güneş koruması için ideal";
    case "cleanser":   return hasAnyInText(full, ["gece", "make-up", "makyaj"])
      ? "Akşam rutininin ilk adımı"
      : "Sabah veya akşam ilk adım olarak kullanılabilir";
    case "treatment":
      if (hasAnyInText(full, ["retinol", "tretinoin", "aha", "glikolik"])) return "Akşam bakımında — aktif içerik nedeniyle";
      if (hasAnyInText(full, ["vitamin c", "c vitamini"])) return "Sabah rutininde — antioksidan destek";
      return "Serum adımında — temizleyici sonrası, nemlendirici öncesi";
    case "moisturizer":
      if (hasAnyInText(full, ["spf", "güneş"])) return "Sabah — hem nem hem koruma sağlar";
      return "Sabah veya akşam son nem adımı";
    case "hair_care":  return "Saç bakım rutininde — yıkama veya yıkama sonrası";
    default:           return "Destekleyici adım olarak rutine eklenebilir";
  }
}

// ─── Primary Use & Who Is It For ──────────────────────────────────────────

function buildPrimaryUse(role: RoutineRole, n: ReturnType<typeof norm>): string {
  const full = `${n.desc} ${n.name} ${n.category}`;
  switch (role) {
    case "sunscreen":
      if (hasAnyInText(full, ["yağlı", "mat", "jel"])) return "Günlük geniş spektrum UV koruması — yağlı cilt dostu formül";
      if (hasAnyInText(full, ["kuru", "nemlendirici", "cream"])) return "Günlük UV koruması — kuru/karma cilt konforu";
      return "Günlük SPF koruması";
    case "cleanser":
      if (hasAnyInText(full, ["yağ", "oil", "çift"])) return "Makyaj ve kir çözme — çift temizleme sistemi";
      if (hasAnyInText(full, ["köpük", "foam"])) return "Derin temizlik — gözenek temizleyici köpük";
      if (hasAnyInText(full, ["misel", "micellar"])) return "Nazik temizlik — misel teknolojisiyle hafif kullanım";
      return "Yüz temizleme";
    case "treatment":
      if (hasAnyInText(full, ["retinol"])) return "Cilt yenileme — retinol destekli gece bakımı";
      if (hasAnyInText(full, ["niacinamide", "leke"])) return "Ton eşitleme — niacinamide bazlı leke karşıtı bakım";
      if (hasAnyInText(full, ["hyaluronic", "nem"])) return "Yoğun nem desteği — çok kademeli nemlendirme";
      if (hasAnyInText(full, ["ceramide", "bariyer"])) return "Bariyer onarımı — seramid bazlı cilt onarımı";
      return "Aktif bakım serumu";
    case "moisturizer":
      if (hasAnyInText(full, ["hafif", "jel", "light"])) return "Hafif günlük nemlendirici — yağlı cilt uyumlu";
      if (hasAnyInText(full, ["zengin", "yoğun", "rich"])) return "Yoğun nemlendirme — kuru cilt besleyici krem";
      return "Günlük nemlendirici krem";
    case "hair_care":
      return "Saç bakım desteği";
    default:
      return "Cilt bakım desteği";
  }
}

function buildWhoIsItFor(role: RoutineRole, n: ReturnType<typeof norm>, sensitivityFit: FitLevel, barrierFit: FitLevel): string {
  const concernTags = detectConcernTags(n);
  const ctags = detectSkinContextTags(n);
  const full = `${n.desc} ${n.features.join(" ")}`;

  if (role === "sunscreen") {
    if (hasAnyInText(full, ["yağlı", "mat", "jel", "fluid", "hafif"])) return "Yağlı ve karma cilt — hafif his arayanlar";
    if (hasAnyInText(full, ["kuru", "nemlendirici", "comfort"])) return "Kuru ve hassas cilt — konfor odaklı koruma";
    if (hasAnyInText(full, ["leke", "pigment", "tinted"])) return "Leke eğilimi olan cilt — renk dengeleme arayanlar";
    return "Günlük koruma arayan her cilt tipi";
  }
  if (role === "cleanser") {
    if (hasAnyInText(full, ["yağlı", "akne", "salicylic", "bha"])) return "Yağlı ve akneye eğilimli cilt";
    if (hasAnyInText(full, ["nazik", "gentle", "sensitive", "hassas"])) return "Hassas ve kuru cilt — nazik temizlik arayanlar";
    return "Günlük temizlik rutini olan her cilt tipi";
  }
  if (role === "treatment") {
    if (concernTags.includes("leke")) return "Leke ve ton eşitsizliğiyle uğraşan cilt";
    if (concernTags.includes("akne")) return "Akne eğilimli, gözenek sorunları olan cilt";
    if (barrierFit === "high") return "Bariyeri zayıf, onarım ihtiyacı duyan cilt";
    if (sensitivityFit === "high") return "Hassas ve reaktif cilt yapısı";
    return "Yoğun bakım ve aktif içerik arayanlar";
  }
  if (role === "moisturizer") {
    if (hasAnyInText(full, ["hafif", "jel", "light"])) return "Yağlı ve karma cilt — ağır his istemeyenler";
    if (hasAnyInText(full, ["zengin", "yoğun"])) return "Kuru ve çok kuru cilt — derin nem arayanlar";
    if (sensitivityFit === "high") return "Hassas cilt — minimal formül tercih edenler";
    return "Nem dengesi arayan normal veya karma cilt";
  }
  if (ctags.length > 0) return ctags.slice(0, 2).join(" ve ") + " olanlar";
  return "Genel cilt bakımına önem veren kullanıcılar";
}

// ─── Core Purpose Builder ──────────────────────────────────────────────────

export function buildProductPurposeProfile(p: Product): ProductPurposeProfile {
  const n = norm(p);
  const role = detectRoutineRole(n);
  const texture = detectTexture(n);
  const sensitivityFit = detectSensitivityFit(n);
  const barrierFit = detectBarrierFit(n);
  const concernTags = detectConcernTags(n);
  const skinContextTags = detectSkinContextTags(n);
  const primaryUse = buildPrimaryUse(role, n);
  const whoIsItFor = buildWhoIsItFor(role, n, sensitivityFit, barrierFit);
  const routineStep = detectRoutineStep(role, n);

  const betterFor: string[] = [];
  if (sensitivityFit === "high") betterFor.push("hassas cilt");
  if (barrierFit === "high") betterFor.push("bariyer güçlendirme");
  if (texture === "light") betterFor.push("yağlı / karma cilt");
  if (texture === "rich") betterFor.push("kuru cilt");
  concernTags.slice(0, 2).forEach(t => betterFor.push(t + " endişesi"));

  const lessIdealFor: string[] = [];
  if (sensitivityFit === "low") lessIdealFor.push("hassas cilt");
  if (texture === "rich") lessIdealFor.push("çok yağlı cilt");
  if (texture === "light") lessIdealFor.push("çok kuru cilt");

  return {
    primaryUse,
    routineRole: role,
    routineStep,
    textureStyle: texture,
    skinContextTags,
    concernTags,
    sensitivityFit,
    barrierFit,
    betterFor,
    lessIdealFor,
    whoIsItFor,
  };
}

// ─── Core Difference Explanation ──────────────────────────────────────────

export function explainComparisonDifference(
  pA: Product,
  pB: Product,
  purposeA: ProductPurposeProfile,
  purposeB: ProductPurposeProfile,
): string {
  const nA = norm(pA);
  const nB = norm(pB);
  const sameBrand = nA.brand.length > 0 && nA.brand === nB.brand;

  // Texture dimension
  const textureDiff = purposeA.textureStyle !== purposeB.textureStyle;
  const lightSide  = purposeA.textureStyle === "light" ? "A" : purposeB.textureStyle === "light" ? "B" : null;
  const richSide   = purposeA.textureStyle === "rich"  ? "A" : purposeB.textureStyle === "rich"  ? "B" : null;

  // Sensitivity dimension
  const sensHigh = purposeA.sensitivityFit === "high" ? "A" : purposeB.sensitivityFit === "high" ? "B" : null;
  const sensLow  = purposeA.sensitivityFit === "low"  ? "A" : purposeB.sensitivityFit === "low"  ? "B" : null;

  // Barrier dimension
  const barrierHigh = purposeA.barrierFit === "high" ? "A" : purposeB.barrierFit === "high" ? "B" : null;

  // Concern dimension
  const onlyAConcerns = purposeA.concernTags.filter(t => !purposeB.concernTags.includes(t));
  const onlyBConcerns = purposeB.concernTags.filter(t => !purposeA.concernTags.includes(t));

  const nameA = (pA.name ?? (pA as any).isim ?? "A ürünü").trim();
  const nameB = (pB.name ?? (pB as any).isim ?? "B ürünü").trim();
  const shortA = nameA.split(" ").slice(0, 2).join(" ");
  const shortB = nameB.split(" ").slice(0, 2).join(" ");

  // Same-brand handling — force a distinction
  if (sameBrand) {
    if (textureDiff && lightSide && richSide) {
      return `Aynı markadan iki seçenek; aradaki fark kullanım hissinde. ${lightSide === "A" ? shortA : shortB} daha hafif ve yağlı ciltlere uygunken, ${lightSide === "A" ? shortB : shortA} daha besleyici ve kuru ciltlere yakın duruyor.`;
    }
    if (sensHigh) {
      const safeSide = sensHigh === "A" ? shortA : shortB;
      const otherSide = sensHigh === "A" ? shortB : shortA;
      return `Aynı markanın iki ürünü; temel ayrım hassas cilt uyumunda. ${safeSide} daha nazik formülüyle öne çıkarken, ${otherSide} daha aktif içerik ağırlıklı bir bakım sunuyor.`;
    }
    if (onlyAConcerns.length > 0 || onlyBConcerns.length > 0) {
      const aFocus = onlyAConcerns[0] ?? purposeA.concernTags[0] ?? "genel bakım";
      const bFocus = onlyBConcerns[0] ?? purposeB.concernTags[0] ?? "genel bakım";
      return `İkisi de aynı markadan; fark hedefledikleri cilt sorununda. ${shortA} daha çok ${aFocus} odaklıyken, ${shortB} ${bFocus} için daha uygun konumlanıyor.`;
    }
    return `Benzer yapıda iki ürün; fark daha çok formülasyon detayı ve kullanım hissinde ortaya çıkıyor. Tercih şahsi cilt ihtiyacına göre şekillenebilir.`;
  }

  // Texture + sensitivity combo
  if (textureDiff && (sensHigh || sensLow)) {
    if (lightSide && sensHigh === lightSide) {
      const lightName = lightSide === "A" ? shortA : shortB;
      const richName  = lightSide === "A" ? shortB : shortA;
      return `${lightName} daha hafif yapısı ve hassas cilt uyumuyla öne çıkıyor. ${richName} ise daha besleyici formülüyle kuru ve daha sağlam cilt yapısına hitap ediyor.`;
    }
  }

  // Texture only
  if (textureDiff && lightSide && richSide) {
    const lightName = lightSide === "A" ? shortA : shortB;
    const richName  = lightSide === "A" ? shortB : shortA;
    return `İki ürünün içerik yapısı benzer görünse de kullanım karakteri farklı. ${lightName} daha hafif ve yüzeysel nem sağlarken, ${richName} daha yoğun ve kuruyan cilt dokusuna daha yakın.`;
  }

  // Barrier vs actives distinction
  if (barrierHigh && (onlyAConcerns.length > 0 || onlyBConcerns.length > 0)) {
    const barrierName = barrierHigh === "A" ? shortA : shortB;
    const activeName  = barrierHigh === "A" ? shortB : shortA;
    return `${barrierName} bariyer onarımı ve koruyucu destekte öne çıkarken, ${activeName} daha aktif içerik odaklı hedefli bir bakım sunuyor.`;
  }

  // Concern tags only
  if (onlyAConcerns.length > 0 && onlyBConcerns.length > 0) {
    return `Her ikisi de değerli seçenekler; ${shortA} daha çok ${onlyAConcerns[0]} için güçlüyken, ${shortB} ${onlyBConcerns[0]} odağında daha etkili.`;
  }
  if (onlyAConcerns.length > 0) {
    return `${shortA} ${onlyAConcerns[0]} hedefli içeriğiyle öne çıkıyor. ${shortB} ise daha dengeli ve genel amaçlı bir kullanım sunuyor.`;
  }
  if (onlyBConcerns.length > 0) {
    return `${shortB} ${onlyBConcerns[0]} hedefli içeriğiyle daha spesifik bir bakım sunuyor. ${shortA} ise daha geniş kullanım yelpazesiyle dengeli bir seçenek.`;
  }

  // Sensitivity only
  if (sensHigh) {
    const safeName  = sensHigh === "A" ? shortA : shortB;
    const otherName = sensHigh === "A" ? shortB : shortA;
    return `${safeName} hassas cilt uyumlu formülüyle güvenli tercih konumunda. ${otherName} ise daha güçlü içerik yapısıyla aktif bakım arayanlar için daha yakın.`;
  }

  // High similarity fallback
  return `İkisi de benzer kategoride güçlü seçenekler. Aradaki fark içerik listesinden çok kullanım hissi ve cilt tipine uyum noktasında beliriyor.`;
}

// ─── Concern-Aware Note ────────────────────────────────────────────────────

export function buildConcernAwareNote(
  pA: Product,
  pB: Product,
  purposeA: ProductPurposeProfile,
  purposeB: ProductPurposeProfile,
): string | null {
  // Try last used concern flows
  const flows = ["akne", "hassasiyet", "leke", "kuruluk", "gunes", "sac"];
  let activeConcern: string | null = null;
  let concernProfile: any = null;
  for (const f of flows) {
    const profile = getConcernProfile(f);
    if (profile) { activeConcern = f; concernProfile = profile; break; }
  }
  if (!activeConcern) return null;

  const nameA = (pA.name ?? (pA as any).isim ?? "A ürünü").trim();
  const nameB = (pB.name ?? (pB as any).isim ?? "B ürünü").trim();
  const shortA = nameA.split(" ").slice(0, 2).join(" ");
  const shortB = nameB.split(" ").slice(0, 2).join(" ");

  const aMatchesConcern = purposeA.concernTags.includes(activeConcern);
  const bMatchesConcern = purposeB.concernTags.includes(activeConcern);

  if (activeConcern === "akne") {
    if (aMatchesConcern && !bMatchesConcern) return `Akne endişeniz göz önüne alındığında ${shortA} daha hedefe yönelik görünüyor.`;
    if (bMatchesConcern && !aMatchesConcern) return `Akne endişeniz göz önüne alındığında ${shortB} daha hedefe yönelik görünüyor.`;
    if (purposeA.sensitivityFit === "high" || purposeB.sensitivityFit === "high") {
      const safe = purposeA.sensitivityFit === "high" ? shortA : shortB;
      return `Akne bakımında hassas yaklaşım önemliyse ${safe} daha nazik bir başlangıç noktası olabilir.`;
    }
  }
  if (activeConcern === "leke") {
    if (aMatchesConcern && !bMatchesConcern) return `Leke endişenizle ${shortA} daha doğrudan örtüşüyor.`;
    if (bMatchesConcern && !aMatchesConcern) return `Leke endişenizle ${shortB} daha doğrudan örtüşüyor.`;
  }
  if (activeConcern === "hassasiyet") {
    const safeSide = purposeA.sensitivityFit === "high" ? shortA : purposeB.sensitivityFit === "high" ? shortB : null;
    if (safeSide) return `Hassas cilt profiliniz için ${safeSide} daha güvenli bir tercih olarak öne çıkıyor.`;
  }
  if (activeConcern === "kuruluk") {
    const richSide = purposeA.textureStyle === "rich" ? shortA : purposeB.textureStyle === "rich" ? shortB : null;
    const barrierSide = purposeA.barrierFit === "high" ? shortA : purposeB.barrierFit === "high" ? shortB : null;
    if (richSide || barrierSide) {
      const pick = barrierSide ?? richSide;
      return `Kuruluk endişenizle ${pick} bariyer desteği veya besleyici formülü açısından daha uyumlu görünüyor.`;
    }
  }
  if (activeConcern === "gunes") {
    if (purposeA.routineRole === "sunscreen" && purposeB.routineRole !== "sunscreen")
      return `Güneş koruması arayışınız için ${shortA} bu karşılaştırmada daha doğrudan cevap veriyor.`;
    if (purposeB.routineRole === "sunscreen" && purposeA.routineRole !== "sunscreen")
      return `Güneş koruması arayışınız için ${shortB} bu karşılaştırmada daha doğrudan cevap veriyor.`;
  }
  return null;
}

// ─── Warning Note ──────────────────────────────────────────────────────────

export function buildWarningNote(
  purposeA: ProductPurposeProfile,
  purposeB: ProductPurposeProfile,
  nameA: string,
  nameB: string,
): string | null {
  const shortA = nameA.split(" ").slice(0, 2).join(" ");
  const shortB = nameB.split(" ").slice(0, 2).join(" ");

  // One is harsh, one is gentle → surface a note
  if (purposeA.sensitivityFit === "low" && purposeB.sensitivityFit === "high") {
    return `${shortA} aktif içerik yoğunluğu nedeniyle hassas ciltlerde daha dikkatli kullanılmalı.`;
  }
  if (purposeB.sensitivityFit === "low" && purposeA.sensitivityFit === "high") {
    return `${shortB} aktif içerik yoğunluğu nedeniyle hassas ciltlerde daha dikkatli kullanılmalı.`;
  }
  // Both harsh
  if (purposeA.sensitivityFit === "low" && purposeB.sensitivityFit === "low") {
    return `Her iki ürün de aktif içerik barındırıyor. Hassas cilt yapısında yavaş başlamak daha uygun olabilir.`;
  }
  // Barrier concern
  if (purposeA.barrierFit === "low" && purposeB.barrierFit === "high") {
    return `Bariyer desteğine ihtiyaç varsa ${shortB} bu karşılaştırmada daha nazik bir tercih.`;
  }
  if (purposeB.barrierFit === "low" && purposeA.barrierFit === "high") {
    return `Bariyer desteğine ihtiyaç varsa ${shortA} bu karşılaştırmada daha nazik bir tercih.`;
  }
  return null;
}

// ─── Decision Summary ──────────────────────────────────────────────────────

export function buildDecisionSummary(
  pA: Product,
  pB: Product,
  purposeA: ProductPurposeProfile,
  purposeB: ProductPurposeProfile,
  finalScoreA: number,
  finalScoreB: number,
): { text: string; winner: "A" | "B" | "tie" | null } {
  const nameA = (pA.name ?? (pA as any).isim ?? "A ürünü").trim();
  const nameB = (pB.name ?? (pB as any).isim ?? "B ürünü").trim();
  const shortA = nameA.split(" ").slice(0, 2).join(" ");
  const shortB = nameB.split(" ").slice(0, 2).join(" ");

  const scoreDiff = Math.abs(finalScoreA - finalScoreB);
  const scoreWinner: "A" | "B" | null = scoreDiff >= 5 ? (finalScoreA > finalScoreB ? "A" : "B") : null;

  // High sensitivity fit → prefer
  if (purposeA.sensitivityFit === "high" && purposeB.sensitivityFit !== "high") {
    return { text: `Daha hassas cilt dostu seçim: ${shortA}`, winner: "A" };
  }
  if (purposeB.sensitivityFit === "high" && purposeA.sensitivityFit !== "high") {
    return { text: `Daha hassas cilt dostu seçim: ${shortB}`, winner: "B" };
  }

  // Light texture priority for oily concern
  if (purposeA.textureStyle === "light" && purposeB.textureStyle === "rich") {
    return { text: `Daha hafif ve günlük kullanım odaklı: ${shortA} — yoğun nem arayanlar için: ${shortB}`, winner: null };
  }
  if (purposeB.textureStyle === "light" && purposeA.textureStyle === "rich") {
    return { text: `Daha hafif ve günlük kullanım odaklı: ${shortB} — yoğun nem arayanlar için: ${shortA}`, winner: null };
  }

  // Barrier focus
  if (purposeA.barrierFit === "high" && purposeB.barrierFit !== "high") {
    return { text: `Bariyer onarımı önceliğindeyse ${shortA} daha odaklı bir seçenek.`, winner: "A" };
  }
  if (purposeB.barrierFit === "high" && purposeA.barrierFit !== "high") {
    return { text: `Bariyer onarımı önceliğindeyse ${shortB} daha odaklı bir seçenek.`, winner: "B" };
  }

  // Score-driven
  if (scoreWinner === "A") return { text: `Genel değerlendirmede ${shortA} bir adım önde.`, winner: "A" };
  if (scoreWinner === "B") return { text: `Genel değerlendirmede ${shortB} bir adım önde.`, winner: "B" };

  // Very close
  return {
    text: `İkisi de güçlü seçenek; fark daha çok cilt yapısı ve kullanım hissinde ortaya çıkıyor.`,
    winner: "tie",
  };
}

// ─── Full Insight Builder ──────────────────────────────────────────────────

export function buildComparisonInsight(
  pA: Product,
  pB: Product,
  finalScoreA: number,
  finalScoreB: number,
): ComparisonInsight {
  const purposeA = buildProductPurposeProfile(pA);
  const purposeB = buildProductPurposeProfile(pB);

  const nameA = (pA.name ?? (pA as any).isim ?? "A ürünü").trim();
  const nameB = (pB.name ?? (pB as any).isim ?? "B ürünü").trim();

  const coreDifference = explainComparisonDifference(pA, pB, purposeA, purposeB);
  const concernNote = buildConcernAwareNote(pA, pB, purposeA, purposeB);
  const warningNote = buildWarningNote(purposeA, purposeB, nameA, nameB);
  const decision = buildDecisionSummary(pA, pB, purposeA, purposeB, finalScoreA, finalScoreB);

  return {
    coreDifference,
    whoA: purposeA.whoIsItFor,
    whoB: purposeB.whoIsItFor,
    routineStepA: purposeA.routineStep,
    routineStepB: purposeB.routineStep,
    decisionSummary: decision.text,
    decisionWinner: decision.winner,
    concernNote,
    warningNote,
  };
}
