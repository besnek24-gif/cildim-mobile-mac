/**
 * concernRoutineBridge.ts
 * 6 concern flow → normalize edilmiş RoutineProfile → rutin motoru girişi
 */

import { buildIndicationRoutine } from "./indicationRoutineEngine";

// ─── Tip tanımları ─────────────────────────────────────────────────────────────

/**
 * ECZ4 Multi-Care Profile Step 1 — opsiyonel domain/source metadata.
 * Mevcut consumer'ların hiçbirine etkisi yok; sadece tip şemasında alan açar.
 * Gelecek adımlarda Rutin Dashboard, AsyncStorage backing ve Akıllı Seçim
 * profil entegrasyonu bu alanları okuyacak.
 */
export type CareDomain = "skin" | "hair" | "sun" | "body" | "oral";

export type RoutineProfileSource =
  | "rehber"
  | "akilli_secim"
  | "cilt_analizi"
  | "manual"
  // ECZ4 Step B — Cilt Anketi flow (Profil veya Rutinim EmptyState'ten erişilir).
  // Mevcut consumer'lar `source`'u sadece okuduğu için additive bir union üyesi
  // riski yoktur; serileştirme/persist/karşılaştırma kodları string eşitliği
  // bekler (rehber/akilli_secim/cilt_analizi/manual). Yeni kayıtlar için ayrı
  // namespace.
  | "anket";

export interface RoutineProfile {
  // ECZ4 Step 12 — Body/Oral type foundation (additive). Generator henüz bu
  // değerleri özel olarak ele almıyor → mevcut switch'lerin default dalına
  // düşer (cilt benzeri çıktı). UI tarafında AUTO_ROUTINE_SAFE_DOMAINS hâlâ
  // body/oral'ı dışarıda tutar, kullanıcı görünür bir değişiklik yaşamaz.
  // Step 13'te free generator + UI label güncellemesi gelecek.
  concern:
    | "acne" | "sensitivity" | "dark_spots" | "dryness" | "sun" | "hair_loss"
    | "body_care" | "body_firming" | "body_cellulite"
    | "oral_daily" | "oral_whitening" | "oral_gum";
  severity: "low" | "medium" | "high" | "unknown";
  sensitivityLevel: "low" | "medium" | "high" | "unknown";
  barrierStatus: "normal" | "partial" | "weak" | "unknown";
  oilBalance: "dry" | "combination" | "oily" | "unknown";
  hydrationNeed: "low" | "medium" | "high" | "unknown";
  protectionNeed: "low" | "medium" | "high" | "unknown";
  routineGoal: string;
  preferredTexture: "light" | "balanced" | "rich" | "unknown";
  activeTolerance: "low" | "medium" | "high" | "unknown";
  scalpType: "oily" | "dry" | "sensitive" | "normal" | "unknown";
  notes: string[];
  /** ECZ4 Multi-Care Profile — opsiyonel, geriye uyumlu. */
  domain?: CareDomain;
  /** ECZ4 Multi-Care Profile — opsiyonel, geriye uyumlu. */
  source?: RoutineProfileSource;
}

export interface RoutineInput {
  concern: RoutineProfile["concern"];
  routineGoal: string;
  barrierStatus: RoutineProfile["barrierStatus"];
  sensitivityLevel: RoutineProfile["sensitivityLevel"];
  hydrationNeed: RoutineProfile["hydrationNeed"];
  protectionNeed: RoutineProfile["protectionNeed"];
  activeTolerance: RoutineProfile["activeTolerance"];
  preferredTexture: RoutineProfile["preferredTexture"];
  scalpType: RoutineProfile["scalpType"];
  oilBalance: RoutineProfile["oilBalance"];
}

export interface RoutineStep {
  slot:       string;
  category:   string;
  reason:     string;
  note?:      string;
  howTo?:     string;
  frequency?: string;
  caution?:   string;
  /** Endikasyon bazlı dinamik rol — "Esas" | "Destek" | "İsteğe bağlı" */
  roleLabel?: string;
}

// ─── Concern → Beklenti Zaman Çizelgesi ──────────────────────────────────────

export interface ConcernTimeline {
  concern: string;
  phase1: { range: string; label: string };
  phase2: { range: string; label: string };
  phase3: { range: string; label: string };
  note: string;
}

export const CONCERN_TIMELINES: Record<string, ConcernTimeline> = {
  acne: {
    concern: "Akne",
    phase1: { range: "1–2 hafta", label: "Cilt düzeni başlıyor" },
    phase2: { range: "4–6 hafta", label: "Yeni oluşumlar azalıyor" },
    phase3: { range: "8–12 hafta", label: "Görünür iyileşme" },
    note: "Akne bakımında ilk haftalarda hafif bir kötüleşme görülebilir — bu normaldir ve genellikle geçicidir.",
  },
  sensitivity: {
    concern: "Hassasiyet",
    phase1: { range: "3–7 gün", label: "Tahriş azalması" },
    phase2: { range: "2–4 hafta", label: "Bariyer güçleniyor" },
    phase3: { range: "4–8 hafta", label: "Daha dayanıklı cilt" },
    note: "Hassas cilt için sabır en önemli faktördür. Yeni ürün eklemek için bariyer güçlenmesini bekleyin.",
  },
  dark_spots: {
    concern: "Leke",
    phase1: { range: "2–4 hafta", label: "Cilt tonu dengeleniyor" },
    phase2: { range: "6–10 hafta", label: "Leke görünümü hafifliyor" },
    phase3: { range: "10–16 hafta", label: "Belirgin aydınlanma" },
    note: "Leke bakımında en kritik adım günlük SPF kullanımıdır. SPF olmadan aktifler istenilen etkiyi veremez.",
  },
  dryness: {
    concern: "Kuruluk",
    phase1: { range: "7–14 gün", label: "Nem dengesi oturuyor" },
    phase2: { range: "2–4 hafta", label: "Gerginlik ve soyulma azalıyor" },
    phase3: { range: "4–6 hafta", label: "Elastikiyet geri geliyor" },
    note: "Nem ihtiyacı yüksek ciltlerde katmanlı nem uygulaması (serum + krem) tek ürüne göre çok daha etkilidir.",
  },
  sun: {
    concern: "Güneş Koruması",
    phase1: { range: "1. günden itibaren", label: "Anlık koruma başladı" },
    phase2: { range: "4–8 hafta", label: "Leke oluşumu yavaşlıyor" },
    phase3: { range: "3–6 ay", label: "Cilt tonu eşitleniyor" },
    note: "Güneş koruyucunun etkisi düzenli kullanımla katlanarak artar. Bulutlu günlerde de uygulamaya devam edilmeli.",
  },
  hair_loss: {
    concern: "Saç Dökülmesi",
    phase1: { range: "2–4 hafta", label: "Dökülme hızı yavaşlıyor" },
    phase2: { range: "6–10 hafta", label: "Saç derisi güçleniyor" },
    phase3: { range: "3–6 ay", label: "Yeni oluşumlar destekleniyor" },
    note: "Saç dökülmesinde sonuçlar yavaş gelir. Telli saç büyümesi 3–6 ay sürebilir; sabır bu bakımın ayrılmaz parçasıdır.",
  },
};

// ─── Adım detay katmanı (kategori → nasıl kullanılır / sıklık / dikkat) ───────

interface StepDetail {
  howTo: string;
  frequency: string;
  caution?: string;
}

const STEP_DETAILS: Record<string, StepDetail> = {
  "Temizleyici": {
    howTo: "Nemli yüze küçük miktarda uygulayın, 20–30 saniye nazikçe masaj yapın ve bol suyla durulayın.",
    frequency: "Sabah ve akşam, her gün",
    caution: "Tahriş hissedilirse köpük miktarını azaltın veya daha nazif bir formula'ya geçin.",
  },
  "Nazik Temizleyici": {
    howTo: "Nemli yüze uygulayın, hafif bir hareketle masaj yapın ve su ile durulayın. Ovuşturmayın.",
    frequency: "Sabah ve akşam, her gün",
    caution: "İkinci kez temizleme (double cleanse) gerekiyorsa önce misel suyu veya yağ temizleyici kullanın.",
  },
  "Nem Serumu": {
    howTo: "Temiz, hafif nemli cilde 3–4 damla uygulayın, hafifçe baskı uygulayarak sindirin.",
    frequency: "Sabah ve/veya akşam, her gün",
    caution: "Serum kullandıktan hemen sonra nemlendiriciye geçin — serumun kilit görevini nemlendiricinin tamamlaması gerekir.",
  },
  "Hafif Serum": {
    howTo: "Temizleme sonrası 3–4 damla cilde yayın, emilmesini bekleyin.",
    frequency: "Sabah ve/veya akşam",
  },
  "Nemlendirici": {
    howTo: "Serum üzerine cömertçe uygulayın, nemin kapanmasını sağlamak için yukarı yönlü hafif baskıyla yedirin.",
    frequency: "Sabah ve akşam, her gün",
  },
  "Güneş Koruyucu": {
    howTo: "Son adım olarak uygulayın. Yüze 1/4 çay kaşığı kadar ve boyuna yayın.",
    frequency: "Her sabah — güneşli ya da değil",
    caution: "2 saatte bir yenileme önerilir. Nemlendirici üzerine uygulanmalı, altına değil.",
  },
  "Bariyer Onarım Serumu": {
    howTo: "Temizleme sonrası 3–5 damla cilde yavaşça yedirin. Acele etmeyin.",
    frequency: "Akşam, her gün",
    caution: "Güçlü aktif içeriklerle (retinol, AHA) aynı gece karıştırmaktan kaçının.",
  },
  "Bariyer Kremi": {
    howTo: "Akşam rutininin son adımı olarak cömertçe uygulayın. Özellikle kuru alanlara ekstra katman ekleyin.",
    frequency: "Her akşam",
  },
  "Akne Odaklı Serum": {
    howTo: "Parmak uçlarıyla ince katman uygulayın. Göz çevresine yaklaştırmayın.",
    frequency: "Akşam, haftada 3–5 gece (başlangıçta haftada 3 ile başlayın)",
    caution: "İlk kullanımlarda hafif kuruluk veya soyulma görülebilir — bu normal adaptasyon sürecidir.",
  },
  "Aydınlatıcı Serum": {
    howTo: "Temiz cilde uygulayın. Sabah kullananlar için üzerine SPF kesinlikle şart.",
    frequency: "Akşam, her gün ya da gün aşırı",
    caution: "Güneş hassasiyeti artabilir — SPF kullanmadan sabah rutinine dahil etmeyin.",
  },
  "Yatıştırıcı Serum": {
    howTo: "İnce katman uygulayın, sindirmesi için 30 saniye bekleyin.",
    frequency: "Akşam, her gün",
    caution: "İçerik değişikliği yaparken tek tek test edin — hassas cilt yeni ürünlere öngörülemeyen tepkiler verebilir.",
  },
  "Onarım Serumu": {
    howTo: "Temiz cilde 3–4 damla yedirin, sindirilmesini bekleyerek nemlendirici uygulayın.",
    frequency: "Akşam, her gün",
  },
  "Şampuan": {
    howTo: "Saç derisine odaklanın, uzunlukları yıkarken hafifçe köpürtün. 1–2 dakika bırakıp durulayın.",
    frequency: "Saç tipinize göre haftada 2–4 kez",
    caution: "Saç derisinde yoğun ovalama yapmayın — bu mikro hasar yaratabilir.",
  },
  "Saç Derisi Serumu": {
    howTo: "Bölümlere ayırarak saç derisine direkt uygulayın, parmak uçlarıyla 2–3 dakika masaj yapın.",
    frequency: "Akşam, haftada 4–7 gece",
    caution: "Durulama gerekmez — gecelik bırakabilirsiniz.",
  },
  "Bakım Spreyi veya Yağ": {
    howTo: "Saç derisine veya uzunluklara uygulayın, hafifçe masaj yapın.",
    frequency: "Akşam, haftada 3–5 gece",
  },
  "Saç Maskesi": {
    howTo: "Şampuan sonrası nemli saça uygulayın, 10–20 dakika beklettikten sonra iyice durulayın.",
    frequency: "Haftada 1 kez",
  },

  // ─── ECZ4 Step 18 — Hair/Body/Oral kategorileri için detay eklemeleri ───
  // Eski cilt-eksen STEP_DETAILS girdileri korunur; aşağıdakiler additive.
  // Generator (generateFreeRoutineStructure) tarafından üretilen kategori
  // string'leriyle birebir eşleşir. Mevcut "Bakım Spreyi veya Yağ" ve
  // "Saç Maskesi" anahtarları legacy `_buildFullRoutine` yolu için aynen
  // bırakıldı; aşağıdaki yeni anahtarlar Step 13/15 safe path çıktısını
  // hedefler. Tüm metinler eczacı tonlu; tedavi vaadi yok.

  // Hair
  "Bakım Spreyi": {
    howTo: "Saç derisine veya uzunluklara hafifçe sıkın, parmak uçlarıyla yedirin.",
    frequency: "Haftada 3–5 gün",
    caution: "Sprey saç derisinde yoğun yağlanma yapıyorsa sıklığı azaltın.",
  },
  "Saç Maskesi / Yağ": {
    howTo: "Şampuan sonrası nemli saça uygulayın, 10–20 dakika bekletin ve iyice durulayın. Yağ formları kuru saça da uygulanabilir.",
    frequency: "Haftada 1 kez",
    caution: "Saç derisinde kaşıntı, kepek veya yara varsa uzman görüşü alın.",
  },

  // Body
  "Vücut Temizleyici": {
    howTo: "Nemli cilde uygulayın, lif veya elle nazikçe köpürtün ve bol suyla durulayın.",
    frequency: "Günlük duş ya da banyoda",
    caution: "Cildi kurutan sert sabunlardan kaçının; tahriş hissedilirse pH dengeli formüllere geçin.",
  },
  "Vücut Nemlendirici": {
    howTo: "Duş sonrası nemli cilde uygulayın; kuru bölgelerde fazladan katman ekleyin.",
    frequency: "Sabah ve akşam, her gün",
    caution: "Yoğun kuruluk veya kaşıntı sürerse bir uzmana danışın.",
  },
  "Vücut Bakım Kremi": {
    howTo: "Hedef bölgeye (kalça, karın, bacak vb.) ince katman uygulayın ve 1–2 dakika dairesel masaj yapın.",
    frequency: "Akşam, her gün",
    caution: "Hamilelik veya emzirme döneminde kafein/retinol içerikli sıkılaştırıcı ürünleri kullanmadan önce hekiminize danışın.",
  },
  "Vücut Peelingi": {
    howTo: "Nemli cilde dairesel hareketlerle uygulayın, 1–2 dakika masaj sonrası durulayın.",
    frequency: "Haftada 1 kez",
    caution: "Tahriş, çatlak veya açık yara olan bölgelerde kullanmayın.",
  },

  // Oral
  "Diş Macunu": {
    howTo: "Bezelye tanesi kadar ürünle dişleri en az 2 dakika fırçalayın; iyice tükürüp ağzı su ile çalkalayın.",
    frequency: "Sabah ve akşam, her gün",
    caution: "Diş eti kanaması, hassasiyet veya ağrı sürerse diş hekimine danışın.",
  },
  "Ağız Çalkalama Suyu": {
    howTo: "30–60 ml ürünü ağızda 30 saniye dolaştırın, ardından tükürün. Sonrasında 30 dakika bir şey yiyip içmemeniz önerilir.",
    frequency: "Sabah ve akşam, fırçalama sonrası",
    caution: "Alkollü gargaralar ağız kuruluğu yapabilir; alkolsüz formüller daha rahattır.",
  },
  "Diş İpi": {
    howTo: "Yaklaşık 40 cm ip kullanın; her dişin iki yüzünü C şeklinde sarıp nazikçe gezdirin. Diş eti kenarına bastırmayın.",
    frequency: "Akşam, her gün",
    caution: "İlk günlerde hafif kanama görülebilir; bir hafta sonra geçmezse diş hekimine danışın.",
  },
  "Beyazlatma Desteği": {
    howTo: "Üretici talimatına uygun süreyle uygulayın. Bant veya jeli temiz, kuru dişlere yerleştirin.",
    frequency: "Haftada 2–3 kez (üretici önerisine göre)",
    caution: "Hassas dişlerde önce diş hekiminize danışın; uygulama sırasında diş eti irritasyonu olursa kullanımı durdurun.",
  },
};

export function getStepDetail(category: string): StepDetail | undefined {
  return STEP_DETAILS[category];
}

export interface Routine {
  morning: RoutineStep[];
  evening: RoutineStep[];
  weekly?: RoutineStep[];
  warnings: string[];
  notes: string[];
}

export interface CompatibilityResult {
  routine: Routine;
  warnings: string[];
  simplified: boolean;
}

export interface FreeRoutineStructure {
  morning: { category: string; suggestion: string }[];
  evening: { category: string; suggestion: string }[];
  weekly?: { category: string; suggestion: string }[];
  notes: string[];
}

// ─── 1. Her flow'u RoutineProfile'a normalize et ─────────────────────────────

/**
 * ECZ4 Multi-Care Profile Step 2 — flowId → CareDomain eşleşmesi.
 * Bilinmeyen flowId'ler için güvenli fallback: "skin".
 * Bu tablo additive; mevcut normalizer çıktıları değişmiyor, sadece
 * dispatcher tarafından metadata olarak ekleniyor.
 */
const FLOW_DOMAIN_MAP: Record<string, CareDomain> = {
  akne:       "skin",
  hassasiyet: "skin",
  leke:       "skin",
  kuruluk:    "skin",
  gunes:      "sun",
  sac:        "hair",
};

export function normalizeConcernToRoutineProfile(
  flowId: string,
  profile: Record<string, unknown>
): RoutineProfile {
  const base: RoutineProfile = (() => {
    switch (flowId) {
      case "akne":       return _normalizeAkne(profile);
      case "hassasiyet": return _normalizeHassasiyet(profile);
      case "leke":       return _normalizeLeke(profile);
      case "kuruluk":    return _normalizeKuruluk(profile);
      case "gunes":      return _normalizeGunes(profile);
      case "sac":        return _normalizeSac(profile);
      default:           return _defaultProfile("acne");
    }
  })();
  // Mevcut alanlara dokunma; sadece opsiyonel metadata ekle.
  return {
    ...base,
    domain: FLOW_DOMAIN_MAP[flowId] ?? "skin",
    source: "rehber",
  };
}

function _defaultProfile(concern: RoutineProfile["concern"]): RoutineProfile {
  return {
    concern,
    severity: "unknown",
    sensitivityLevel: "unknown",
    barrierStatus: "unknown",
    oilBalance: "unknown",
    hydrationNeed: "medium",
    protectionNeed: "medium",
    routineGoal: "Genel bakım",
    preferredTexture: "balanced",
    activeTolerance: "medium",
    scalpType: "unknown",
    notes: [],
  };
}

function _normalizeAkne(p: Record<string, unknown>): RoutineProfile {
  const barrier    = (p.barrier    as string) ?? "unknown";
  const oilLevel   = (p.oilLevel   as string) ?? "unknown";
  const sensitive  = (p.sensitive  as boolean) ?? false;
  const severity   = (p.severity   as string) ?? "mild";
  const goal       = (p.goal       as string) ?? "prevention";

  return {
    concern: "acne",
    severity: severity === "widespread" ? "high" : severity === "moderate" ? "medium" : "low",
    sensitivityLevel: sensitive ? "high" : "low",
    barrierStatus: barrier === "weak" ? "weak" : barrier === "partial" ? "partial" : barrier === "normal" ? "normal" : "unknown",
    oilBalance: oilLevel === "oily" ? "oily" : oilLevel === "combination" ? "combination" : oilLevel === "non_oily" ? "dry" : "unknown",
    hydrationNeed: barrier === "weak" ? "high" : "medium",
    protectionNeed: goal === "marks" ? "high" : "medium",
    routineGoal:
      goal === "prevention"  ? "Yeni sivilce oluşumunu azaltmak" :
      goal === "oil_control" ? "Yağlanmayı dengelemek" :
      goal === "marks"       ? "İz ve görünümü toparlamak" :
                               "Cildi tahriş etmeden bakım yapmak",
    preferredTexture: oilLevel === "oily" ? "light" : "balanced",
    activeTolerance: (sensitive || barrier === "weak") ? "low" : severity === "widespread" ? "high" : "medium",
    scalpType: "unknown",
    notes: [
      ...(sensitive        ? ["Hassasiyet durumuna göre seçildi."] : []),
      ...(barrier === "weak" ? ["Önce denge, sonra yoğun bakım yaklaşımı daha uygun olabilir."] : []),
    ],
  };
}

function _normalizeHassasiyet(p: Record<string, unknown>): RoutineProfile {
  const sensitivity = (p.sensitivity as string) ?? "medium";
  const reactivity  = (p.reactivity  as string) ?? "medium";
  const skinType    = (p.skinType    as string) ?? "unknown";
  const barrier     = (p.barrier     as string) ?? "unknown";
  const goal        = (p.goal        as string) ?? "calm";
  const isHigh      = sensitivity === "high" || reactivity === "high";

  return {
    concern: "sensitivity",
    severity: isHigh ? "high" : "medium",
    sensitivityLevel: isHigh ? "high" : "medium",
    barrierStatus: barrier === "weak" ? "weak" : barrier === "partial" ? "partial" : barrier === "normal" ? "normal" : "unknown",
    oilBalance: skinType === "oily" ? "oily" : skinType === "dry" ? "dry" : "unknown",
    hydrationNeed: (skinType === "dry" || barrier === "weak") ? "high" : "medium",
    protectionNeed: "medium",
    routineGoal:
      goal === "calm"               ? "Cildi yatıştırmak ve rahatsız etmemek" :
      goal === "reduce_redness"     ? "Kızarıklığı azaltmak" :
      goal === "prevent_irritation" ? "Tahrişi önlemek" :
                                      "Daha dayanıklı bir cilt oluşturmak",
    preferredTexture: skinType === "dry" ? "rich" : skinType === "oily" ? "light" : "balanced",
    activeTolerance: isHigh ? "low" : "medium",
    scalpType: "unknown",
    notes: [
      "Parfümsüz ve hipoalerjenik formüller öncelikli.",
      ...(barrier === "weak" ? ["Bu cilt yapısında fazla aktif içerik tahrişi artırabilir."] : []),
    ],
  };
}

function _normalizeLeke(p: Record<string, unknown>): RoutineProfile {
  const sensitivity = (p.sensitivity as string) ?? "low";
  const spfHabit    = (p.spfHabit    as string) ?? "inconsistent";
  const barrier     = (p.barrier     as string) ?? "unknown";
  const goal        = (p.goal        as string) ?? "reduce_spots";
  const poorSpf     = spfHabit === "poor" || spfHabit === "none";

  return {
    concern: "dark_spots",
    severity: "medium",
    sensitivityLevel: sensitivity === "high" ? "high" : sensitivity === "medium" ? "medium" : "low",
    barrierStatus: barrier === "weak" ? "weak" : barrier === "partial" ? "partial" : "normal",
    oilBalance: "unknown",
    hydrationNeed: barrier === "weak" ? "high" : "medium",
    protectionNeed: poorSpf ? "high" : "medium",
    routineGoal:
      goal === "reduce_spots"      ? "Leke görünümünü azaltmak" :
      goal === "even_tone"         ? "Cilt tonunu eşitlemek" :
      goal === "radiance"          ? "Aydınlık görünüm kazanmak" :
                                     "Tahriş etmeden leke bakımı",
    preferredTexture: "balanced",
    activeTolerance: sensitivity === "high" ? "low" : "medium",
    scalpType: "unknown",
    notes: [
      ...(poorSpf ? ["Koruma ihtiyacı öne çıktığı için günlük SPF kullanımı kritik."] : []),
      ...(barrier === "weak" ? ["Önce denge, sonra yoğun bakım yaklaşımı daha uygun olabilir."] : []),
    ],
  };
}

function _normalizeKuruluk(p: Record<string, unknown>): RoutineProfile {
  const dryness    = (p.dryness    as string)  ?? "medium";
  const barrier    = (p.barrier    as string)  ?? "unknown";
  const sensitivity= (p.sensitivity as boolean) ?? false;
  const oilBalance = (p.oilBalance  as string)  ?? "unknown";
  const goal       = (p.goal        as string)  ?? "hydration";

  return {
    concern: "dryness",
    severity: dryness === "high" ? "high" : dryness === "medium" ? "medium" : "low",
    sensitivityLevel: sensitivity ? "medium" : "low",
    barrierStatus: barrier === "weak" ? "weak" : barrier === "partial" ? "partial" : barrier === "normal" ? "normal" : "unknown",
    oilBalance: oilBalance === "dry" ? "dry" : (oilBalance === "combo" || oilBalance === "oily_dry") ? "combination" : "unknown",
    hydrationNeed: dryness === "high" ? "high" : "medium",
    protectionNeed: "low",
    routineGoal:
      goal === "hydration"      ? "Nem kazanmak ve korumak" :
      goal === "repair"         ? "Bariyer ve cildi güçlendirmek" :
      goal === "calm"           ? "Tahrişi azaltmak" :
                                  "Daha sağlıklı cilt görünümü",
    preferredTexture: dryness === "high" ? "rich" : "balanced",
    activeTolerance: (sensitivity || barrier === "weak") ? "low" : "medium",
    scalpType: "unknown",
    notes: [
      ...(barrier === "weak" ? ["Bariyeri yormadan ilerlemek için nazif temizleyici tercih edilmeli."] : []),
      ...(sensitivity ? ["Hassasiyet durumuna göre seçildi."] : []),
    ],
  };
}

function _normalizeGunes(p: Record<string, unknown>): RoutineProfile {
  const usage     = (p.usage     as string) ?? "inconsistent";
  const issue     = (p.issue     as string) ?? "none";
  const skinType  = (p.skinType  as string) ?? "combination";
  const exposure  = (p.exposure  as string) ?? "medium";
  const goal      = (p.goal      as string) ?? "comfort";
  const poorUsage = usage === "none" || usage === "seasonal";
  const isSens    = issue === "irritation" || skinType === "sensitive";

  return {
    concern: "sun",
    severity: exposure === "high" ? "high" : "medium",
    sensitivityLevel: isSens ? "high" : "medium",
    barrierStatus: "normal",
    oilBalance: skinType === "oily" ? "oily" : skinType === "dry" ? "dry" : skinType === "combination" ? "combination" : "unknown",
    hydrationNeed: skinType === "dry" ? "high" : "medium",
    protectionNeed: (poorUsage || exposure === "high") ? "high" : "medium",
    routineGoal:
      goal === "invisible"         ? "Hafif ve görünmez koruma" :
      goal === "strong_protection" ? "Güçlü güneş koruması" :
      goal === "comfort"           ? "Rahat, tahriş etmeyen koruma" :
                                     "Leke oluşumunu önleyen koruma",
    preferredTexture: skinType === "oily" ? "light" : skinType === "dry" ? "rich" : "balanced",
    activeTolerance: isSens ? "low" : "medium",
    scalpType: "unknown",
    notes: [
      ...(poorUsage ? ["Güneş koruması henüz rutine tam girmemiş; sabah rutin son adımı olmalı."] : []),
      ...(goal === "anti_spot" ? ["Leke hedefiyle birlikte SPF her gün sabah rutininde yer almalı."] : []),
    ],
  };
}

function _normalizeSac(p: Record<string, unknown>): RoutineProfile {
  const severity = (p.severity as string) ?? "mild";
  const scalp    = (p.scalp    as string) ?? "normal";
  const trigger  = (p.trigger  as string) ?? "none";
  const goal     = (p.goal     as string) ?? "strengthen";

  return {
    concern: "hair_loss",
    severity: severity === "severe" ? "high" : severity === "moderate" ? "medium" : "low",
    sensitivityLevel: scalp === "sensitive" ? "high" : "low",
    barrierStatus: "unknown",
    oilBalance: scalp === "oily" ? "oily" : scalp === "dry" ? "dry" : "unknown",
    hydrationNeed: scalp === "dry" ? "high" : "low",
    protectionNeed: "low",
    routineGoal:
      goal === "reduce_loss"      ? "Dökülmeyi azaltmak" :
      goal === "strengthen"       ? "Saçı güçlendirmek" :
      goal === "regrowth_support" ? "Yeni saç çıkışını desteklemek" :
                                    "Saç kalitesini artırmak",
    preferredTexture: scalp === "oily" ? "light" : scalp === "dry" ? "rich" : "balanced",
    activeTolerance: scalp === "sensitive" ? "low" : "medium",
    scalpType: (scalp === "oily" || scalp === "dry" || scalp === "sensitive" || scalp === "normal") ? scalp : "unknown",
    notes: [
      ...(trigger === "stress"   ? ["Stres ve dönemsel faktörler dökülmeyi artırabilir."] : []),
      ...(trigger === "medical"  ? ["Hastalık veya ilaç kaynaklı dökülmede dermatoloji uzmanına başvurulması önerilir."] : []),
      ...(scalp === "sensitive"  ? ["Kepekli/hassas saç derisi için parfümsüz formüller tercih edilmeli."] : []),
    ],
  };
}

// ─── 2. RoutineInput builder ──────────────────────────────────────────────────

export function buildRoutineInputFromConcernProfile(rp: RoutineProfile): RoutineInput {
  return {
    concern:         rp.concern,
    routineGoal:     rp.routineGoal,
    barrierStatus:   rp.barrierStatus,
    sensitivityLevel:rp.sensitivityLevel,
    hydrationNeed:   rp.hydrationNeed,
    protectionNeed:  rp.protectionNeed,
    activeTolerance: rp.activeTolerance,
    preferredTexture:rp.preferredTexture,
    scalpType:       rp.scalpType,
    oilBalance:      rp.oilBalance,
  };
}

// ─── 3. Ücretsiz rutin iskeleti ───────────────────────────────────────────────

// ECZ4 Step 13 — Body/Oral concern union üyeleri için yardımcı predicate'ler.
// generateFreeRoutineStructure ve generatePremiumRoutine içinde erken-return
// dallarını gate'lemek için kullanılır.
export function isBodyConcern(c: RoutineProfile["concern"]): boolean {
  return c === "body_care" || c === "body_firming" || c === "body_cellulite";
}
export function isOralConcern(c: RoutineProfile["concern"]): boolean {
  return c === "oral_daily" || c === "oral_whitening" || c === "oral_gum";
}

export function generateFreeRoutineStructure(rp: RoutineProfile): FreeRoutineStructure {
  const isHair = rp.concern === "hair_loss";

  // ECZ4 Step 13 — Body branch. Cilt rutini şablonuna düşmeden vücut bakımı
  // için sade bir iskelet döner. Concern'e göre akşam ürünü ipucu değişir.
  if (isBodyConcern(rp.concern)) {
    const eveningSuggestion =
      rp.concern === "body_firming"   ? "Sıkılaştırıcı vücut bakım kremi (kafein/peptit içerikli olabilir)" :
      rp.concern === "body_cellulite" ? "Selülit görünümüne destek vücut bakım ürünü" :
                                        "Yoğun nemlendirici vücut bakım kremi";
    return {
      morning: [
        { category: "Vücut Temizleyici", suggestion: "pH dengeli, nazik vücut temizleyici" },
        { category: "Vücut Nemlendirici", suggestion: "Günlük vücut losyonu veya kremi" },
      ],
      evening: [
        { category: "Vücut Bakım Kremi", suggestion: eveningSuggestion },
      ],
      weekly: [
        { category: "Vücut Peelingi", suggestion: "Haftalık nazik vücut peelingi (fiziksel veya kimyasal)" },
      ],
      notes: rp.notes,
    };
  }

  // ECZ4 Step 13 — Oral branch. Diş ve diş eti bakımı için sade iskelet.
  if (isOralConcern(rp.concern)) {
    const pasteSuggestion =
      rp.concern === "oral_whitening" ? "Beyazlatma destekli diş macunu" :
      rp.concern === "oral_gum"       ? "Diş eti destekli diş macunu" :
                                        "Florürlü günlük diş macunu";
    const weekly =
      rp.concern === "oral_whitening"
        ? [{ category: "Beyazlatma Desteği", suggestion: "Haftalık beyazlatma bandı veya jeli" }]
        : undefined;
    return {
      morning: [
        { category: "Diş Macunu",          suggestion: pasteSuggestion },
        { category: "Ağız Çalkalama Suyu", suggestion: "Alkolsüz günlük gargara" },
      ],
      evening: [
        { category: "Diş Macunu", suggestion: pasteSuggestion },
        { category: "Diş İpi",    suggestion: "Günde 1 kez diş ipi" },
      ],
      ...(weekly ? { weekly } : {}),
      notes: rp.notes,
    };
  }

  if (isHair) {
    return {
      morning: [
        { category: "Şampuan",        suggestion: rp.scalpType === "oily" ? "Yağlı saç derisi için hafif şampuan" : rp.scalpType === "dry" ? "Nemlendirici şampuan" : "Dengeleyici şampuan" },
        { category: "Bakım Spreyi",   suggestion: "Koruyucu veya güçlendirici sprey" },
      ],
      evening: [
        { category: "Saç Derisi Serumu", suggestion: "Kafein veya biotin içerikli serum" },
      ],
      weekly: [
        { category: "Saç Maskesi / Yağ", suggestion: "Haftalık derin nem ve güçlendirme bakımı" },
      ],
      notes: rp.notes,
    };
  }

  const morning: FreeRoutineStructure["morning"] = [];
  const evening: FreeRoutineStructure["evening"] = [];

  const cleanserHint =
    rp.sensitivityLevel === "high" ? "Nazik / köpüksüz temizleyici" :
    rp.oilBalance === "oily"       ? "Jel veya köpük temizleyici" :
                                     "Nazik günlük temizleyici";

  morning.push({ category: "Temizleyici",    suggestion: cleanserHint });
  evening.push({ category: "Temizleyici",    suggestion: cleanserHint });

  if (rp.concern === "dryness") {
    morning.push({ category: "Nem Serumu",   suggestion: "Hyalüronik asit veya gliserin içerikli" });
    evening.push({ category: "Onarım Serumu", suggestion: "Peptit veya seramid içerikli" });
  } else if (rp.concern === "acne") {
    evening.push({ category: "Akne Serumu",  suggestion: "Niasinamid veya salisilik asit içerikli" });
  } else if (rp.concern === "dark_spots") {
    evening.push({ category: "Aydınlatıcı Serum", suggestion: "C vitamini veya alfa arbutin içerikli" });
  } else if (rp.concern === "sensitivity") {
    evening.push({ category: "Yatıştırıcı Serum", suggestion: "Centella, aloe vera veya bisabolol içerikli" });
  } else if (rp.concern === "sun") {
    evening.push({ category: "Nem Serumu",   suggestion: "Hyalüronik asit bazlı, hafif ve nemlendirici" });
  }

  const moistHint =
    rp.preferredTexture === "light" ? "Hafif, jel bazlı nemlendirici" :
    rp.preferredTexture === "rich"  ? "Yoğun, besleyici nemlendirici" :
                                      "Günlük nemlendirici";

  morning.push({ category: "Nemlendirici",   suggestion: moistHint });
  evening.push({ category: "Nemlendirici",   suggestion: rp.barrierStatus === "weak" ? "Bariyer onarım kremi" : moistHint });

  morning.push({
    category: "Güneş Koruyucu",
    suggestion: rp.protectionNeed === "high" ? "SPF 50+ güneş koruyucu" : "SPF 50+ güneş koruyucu",
  });

  return { morning, evening, notes: rp.notes };
}

// ─── 4. Premium rutin üretici ─────────────────────────────────────────────────

/**
 * ECZ4 Step 16 — Hair/Body/Oral safe-path için statik rol etiketi map'i.
 * Anahtarlar `generateFreeRoutineStructure` body/oral/hair branch'lerinde
 * üretilen `category` string'leriyle birebir eşleşir. Eksik kategoriler
 * `undefined` döner → StepRow chip'i render etmez (kırılma yok).
 *
 * Skin/sun premium yolu `buildIndicationRoutine` içinden zaten kendi
 * RoleLabel atamasını yapar; bu map oraya dokunmaz.
 *
 * Tek truth katmanı: kategori string'i. Map salt-okur, hot path dışı.
 */
const DOMAIN_ROLE_LABEL_HAIR_BODY_ORAL: Record<string, RoutineStep["roleLabel"]> = {
  // Hair (saç)
  "Şampuan":             "Esas",
  "Saç Derisi Serumu":   "Esas",
  "Bakım Spreyi":        "Destek",
  "Saç Maskesi / Yağ":   "İsteğe bağlı",

  // Body (vücut) — concern variant'lardan bağımsız sabit kategori adları
  "Vücut Temizleyici":   "Esas",
  "Vücut Nemlendirici":  "Esas",
  "Vücut Bakım Kremi":   "Destek",
  "Vücut Peelingi":      "İsteğe bağlı",

  // Oral (ağız)
  "Diş Macunu":          "Esas",
  "Diş İpi":             "Esas",
  "Ağız Çalkalama Suyu": "Destek",
  "Beyazlatma Desteği":  "İsteğe bağlı",
};

export function generatePremiumRoutine(rp: RoutineProfile): CompatibilityResult {
  // ECZ4 Step 13 + Step 15 — Body/Oral/Hair safe path. indicationRoutineEngine
  // tamamen cilt-eksen kategorilerle çalıştığından (Bariyer Onarım Serumu,
  // Akne Serumu, SPF, Aydınlatıcı Serum, vb.) body/oral/hair profillerinde
  // yanıltıcı bir CİLT rutini üretir. Bu üç concern grubu için premium=free
  // kabul ediyoruz: generateFreeRoutineStructure çıktısı CompatibilityResult
  // shape'ine sarılır, buildIndicationRoutine çağrısı yapılmaz.
  //   - Step 13: body_*/oral_* erken-return eklendi.
  //   - Step 15: hair_loss aynı pattern'e dahil edildi (Step 14 audit F-01).
  // Step 16+ ayrı bir hairRoutineEngine / bodyOralRoutineEngine ile
  // zenginleştirilebilir; bu ara sürede içerik free seviyesinde fakat
  // domain-uygun ve güvenli.
  if (
    isBodyConcern(rp.concern) ||
    isOralConcern(rp.concern) ||
    rp.concern === "hair_loss"
  ) {
    const free = generateFreeRoutineStructure(rp);
    const toSteps = (
      list: ReadonlyArray<{ category: string; suggestion: string }>,
    ): RoutineStep[] =>
      list.map((s, i) => ({
        slot:      String(i + 1),
        category:  s.category,
        reason:    s.suggestion,
        // ECZ4 Step 16 — Premium hair/body/oral algı zenginleştirmesi.
        // DOMAIN_ROLE_LABEL_HAIR_BODY_ORAL map'inden statik rol etiketi
        // okunur; eksik kategorilerde undefined döner, StepRow chip'i
        // render etmez (graceful degradation). Free output ve
        // skin/sun premium yolu bu eklentiden etkilenmez.
        roleLabel: DOMAIN_ROLE_LABEL_HAIR_BODY_ORAL[s.category],
      }));
    const routine: Routine = {
      morning:  toSteps(free.morning),
      evening:  toSteps(free.evening),
      weekly:   free.weekly ? toSteps(free.weekly) : undefined,
      warnings: [],
      notes:    free.notes,
    };
    return { routine, warnings: [], simplified: false };
  }

  // Endikasyon önce motor — dinamik rol etiketli
  const indication = buildIndicationRoutine(rp, {
    isPregnant:          false,             // Hamilelik bilgisi RoutineProfile'da yok; aşağıdaki warnings'ta notes ile gelir
    retinoidIntolerant:  rp.activeTolerance === "low",
  });

  // IndicationStep → RoutineStep uyumu (reason = roleReason; roleLabel korunur)
  const mapSteps = (steps: any[]): RoutineStep[] =>
    steps.map((s: any) => ({
      slot:      s.slot,
      category:  s.category,
      reason:    s.roleReason,   // eski reason alanı olarak serv
      roleLabel: s.roleLabel,   // ek alan — UI'da chip olarak gösterilir
      note:      s.note,
      howTo:     s.howTo,
      frequency: s.frequency,
      caution:   s.caution,
    }));

  const routine: Routine = {
    morning:  mapSteps(indication.morning),
    evening:  mapSteps(indication.evening),
    weekly:   indication.weekly ? mapSteps(indication.weekly) : undefined,
    warnings: indication.warnings,
    notes:    indication.notes,
  };

  return {
    routine,
    warnings:   indication.warnings,
    simplified: indication.simplified,
  };
}

function _buildFullRoutine(input: RoutineInput): Routine {
  const morning: RoutineStep[] = [];
  const evening: RoutineStep[] = [];
  const weekly:  RoutineStep[] = [];
  const warnings: string[] = [];
  const notes:   string[] = [];

  if (input.concern === "hair_loss") {
    morning.push({ slot: "1", category: "Şampuan", reason: "Yağ dengesine göre seçildi" });
    morning.push({ slot: "2", category: "Saç Derisi Serumu", reason: "Kafein / biotin ile kök desteği" });
    evening.push({ slot: "1", category: "Bakım Spreyi veya Yağ", reason: "Gece besleyici bakım" });
    weekly.push ({ slot: "1", category: "Saç Maskesi", reason: "Haftalık derin nem ve güçlendirme" });
    if (input.scalpType === "sensitive") warnings.push("Kepekli/hassas saç derisi için parfümsüz formüller tercih edilmeli.");
    return { morning, evening, weekly, warnings, notes };
  }

  morning.push({
    slot: "1", category: "Temizleyici",
    reason: input.sensitivityLevel === "high" ? "Hassasiyet durumuna göre seçildi" : "Yağ dengesine daha uygun",
  });

  if (input.concern === "dryness" || input.hydrationNeed === "high") {
    morning.push({ slot: "2", category: "Nem Serumu", reason: "Gün boyu nem desteği için" });
  } else if (input.concern !== "sun") {
    morning.push({ slot: "2", category: "Hafif Serum", reason: "Bariyeri yormadan ilerlemek için" });
  }

  morning.push({
    slot: "3", category: "Nemlendirici",
    reason: input.preferredTexture === "rich" ? "Yoğun nem ihtiyacına uygun" : "Yağ dengesine daha uygun",
  });
  morning.push({
    slot: "4", category: "Güneş Koruyucu",
    reason: input.protectionNeed === "high" ? "Koruma ihtiyacı öne çıktığı için" : "Günlük temel koruma",
  });

  evening.push({
    slot: "1",
    category: input.sensitivityLevel === "high" ? "Nazik Temizleyici" : "Temizleyici",
    reason: "Gün sonu temizliği",
  });

  if (input.barrierStatus === "weak") {
    evening.push({ slot: "2", category: "Bariyer Onarım Serumu", reason: "Önce denge, sonra aktif bakım" });
  } else if (input.concern === "acne") {
    if (input.activeTolerance !== "low") {
      evening.push({ slot: "2", category: "Akne Odaklı Serum", reason: "Gece onarım döngüsünde etkili" });
    }
  } else if (input.concern === "dark_spots") {
    evening.push({ slot: "2", category: "Aydınlatıcı Serum", reason: "Gece yenilenme sürecine uygun" });
  } else if (input.concern === "sensitivity") {
    evening.push({ slot: "2", category: "Yatıştırıcı Serum", reason: "Hassasiyet durumuna göre seçildi" });
  } else if (input.concern === "dryness") {
    evening.push({ slot: "2", category: "Onarım Serumu", reason: "Gece bariyer ve nem desteği" });
  } else if (input.concern === "sun") {
    evening.push({ slot: "2", category: "Nem Serumu", reason: "Güneş koruması sonrası nem takviyesi" });
  }

  evening.push({
    slot: "3",
    category: input.barrierStatus === "weak" ? "Bariyer Kremi" : "Nemlendirici",
    reason: input.barrierStatus === "weak" ? "Bariyeri yormadan ilerlemek için" : "Gece nem kapama",
  });

  return { morning, evening, weekly: weekly.length ? weekly : undefined, warnings, notes };
}

// ─── 5. Uyumluluk / güvenlik katmanı ────────────────────────────────────────

export function checkRoutineCompatibility(routine: Routine, rp: RoutineProfile): CompatibilityResult {
  const warnings: string[] = [...routine.warnings];
  let simplified = false;

  if (rp.sensitivityLevel === "high") {
    warnings.push("Bu cilt yapısında fazla aktif içerik tahrişi artırabilir.");
    if (routine.evening.length > 3) simplified = true;
  }

  if (rp.barrierStatus === "weak") {
    warnings.push("Önce denge, sonra yoğun bakım yaklaşımı daha uygun olabilir.");
    simplified = true;
  }

  if (rp.activeTolerance === "low" && routine.evening.length > 3) {
    simplified = true;
  }

  return { routine, warnings, simplified };
}
