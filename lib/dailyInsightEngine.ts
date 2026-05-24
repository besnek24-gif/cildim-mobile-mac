/**
 * dailyInsightEngine.ts
 * "Günün Notu" — Akıllı, bağlama duyarlı günlük mesaj motoru
 *
 * Öncelik sırası (tek mesaj, en yüksek öncelikli):
 *   1. Güvenlik uyarısı  2. Rutin hatası  3. Davranış yönlendirme
 *   4. Eğitici içerik    5. Motivasyon
 *
 * Rotasyon: günlük (24s) deterministik — aynı gün hep aynı sonuç
 * Premium: daha şahsileştirilmiş ve bağlamsal dil
 */

// ─── Tip sistemi ──────────────────────────────────────────────────────────────

export type InsightType = "safety" | "routine_mistake" | "behavior" | "educational" | "encouraging";

export interface InsightContext {
  /** Son tamamlanan endişe akışı */
  lastConcern?: "akne" | "hassasiyet" | "leke" | "kuruluk" | "gunes" | "sac" | string;
  /** Rutin uyum verileri */
  adherenceScore?: number;       // 0–100
  morningDays?: number;          // Son 7 günde sabah rutini
  eveningDays?: number;          // Son 7 günde akşam rutini
  activeDays?: number;           // Son 7 günde aktif gün
  /** Uyarı sinyalleri */
  warningCount?: number;
  warningTypes?: string[];       // "allergy" | "sensitivity" | "active_overload" | "barrier" vb.
  highSeverityWarning?: boolean;
  /** Kullanıcı profili */
  skinType?: string;
  skinConcerns?: string[];
  hasRoutine?: boolean;
  isPremium?: boolean;
}

export interface DailyInsight {
  type: InsightType;
  icon: string;
  iconBg: string;
  iconColor: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  title: string;
  message: string;
  microAction?: string;
}

// ─── Renk paletleri ───────────────────────────────────────────────────────────

const PALETTES = {
  sage:    { iconBg: "#3D6E56", iconColor: "#fff", cardBg: "#F0FAF5", cardBorder: "#A7D9BE", titleColor: "#164E35" },
  amber:   { iconBg: "#D97706", iconColor: "#fff", cardBg: "#FFFBEB", cardBorder: "#FDE68A", titleColor: "#78350F" },
  blue:    { iconBg: "#2563EB", iconColor: "#fff", cardBg: "#EFF6FF", cardBorder: "#BFDBFE", titleColor: "#1E40AF" },
  violet:  { iconBg: "#7C3AED", iconColor: "#fff", cardBg: "#F5F3FF", cardBorder: "#DDD6FE", titleColor: "#5B21B6" },
  rose:    { iconBg: "#E11D48", iconColor: "#fff", cardBg: "#FFF1F2", cardBorder: "#FECDD3", titleColor: "#9F1239" },
  teal:    { iconBg: "#0D9488", iconColor: "#fff", cardBg: "#F0FDFA", cardBorder: "#99F6E4", titleColor: "#0F766E" },
  slate:   { iconBg: "#475569", iconColor: "#fff", cardBg: "#F8FAFC", cardBorder: "#CBD5E1", titleColor: "#1E293B" },
  copper:  { iconBg: "#B87333", iconColor: "#fff", cardBg: "#FDF6EF", cardBorder: "#D4A265", titleColor: "#7A3D08" },
};

// ─── Mesaj havuzları ───────────────────────────────────────────────────────────

type MsgPool = { title: string; message: string; microAction?: string; icon: string }[];

// 1. GÜVENLİK UYARILARI
const SAFETY_MSGS: MsgPool = [
  {
    icon: "alert-triangle",
    title: "Alerji Uyarısı",
    message: "Rutininde dikkat gerektiren içerikler mevcut. Kullandığın ürünlerin içerik listesini incelemeyi ihmal etme.",
    microAction: "Bugün bir ürünün içerik listesini aç ve 'Uyarılar' sekmesine bak.",
  },
  {
    icon: "shield",
    title: "Hassasiyet Sinyali",
    message: "Cilt bariyerin şu an daha reaktif olabilir. Yeni veya güçlü içeriklere geçişi birkaç gün ertele.",
    microAction: "Bu hafta sadece mevcut rutinini uygula — yeni ürün deneme.",
  },
  {
    icon: "alert-circle",
    title: "Aktif Bileşen Yükü",
    message: "Birden fazla güçlü aktif bileşeni aynı anda kullanmak tahrişe zemin hazırlayabilir. Sıralamayı gözden geçir.",
    microAction: "Retinol, AHA ve BHA'yı aynı geceye koymaktan kaçın.",
  },
];

// 2. RUTİN HATALARI
const ROUTINE_MISTAKE_MSGS: MsgPool = [
  {
    icon: "moon",
    title: "Akşam Rutini Atlıyor",
    message: "Son günlerde akşam rutini aksıyor. Daha sade, 2 adımlık bir akşam rutini sürdürülebilirliği artırabilir.",
    microAction: "Bu gece sadece temizleyici + nemlendirici — basit tut.",
  },
  {
    icon: "clock",
    title: "Rutin Düzenli Değil",
    message: "Tutarsız rutin, en kaliteli ürünlerin bile etkisini sınırlar. Küçük ama düzenli adımlar daha değerlidir.",
    microAction: "Yarın sabah rutin için 10 dakika takvime ekle.",
  },
  {
    icon: "sun",
    title: "Sabah SPF Atlandı",
    message: "Güneş koruması olmadan diğer bakım adımları yarım kalır. SPF sabah rutininin zorunlu bir parçası.",
    microAction: "Bugün güneş kremini çantana koy — hiç geç değil.",
  },
  {
    icon: "refresh-cw",
    title: "Rutin Başlamayı Bekliyor",
    message: "Rutin henüz başlamamış gibi görünüyor. Bir temizleyici ve nemlendirici ile başlamak en güçlü ilk adımdır.",
    microAction: "Bu gece sadece yüzünü yıka ve nemlendirici sür — bu da bir rutindir.",
  },
];

// 3. DAVRANIŞSAL YÖNLENDIRME
const BEHAVIOR_MSGS: MsgPool = [
  {
    icon: "trending-up",
    title: "Bir Adım Daha",
    message: "Rutin genel olarak ilerliyor ama akşamlar biraz daha düzenli olabilir. Küçük bir değişiklik büyük fark yaratır.",
    microAction: "Bu gece rutin tamamlandığında 'yapıldı' olarak işaretle.",
  },
  {
    icon: "layers",
    title: "Katmanlama Sırası",
    message: "Ürünleri ince dokudan kalın dokuya doğru uygulamak her birinin cilde nüfuzunu artırır.",
    microAction: "Bugün: serum → nemlendirici → yağ/krem sırasını dene.",
  },
  {
    icon: "droplet",
    title: "Nem İçeriden Başlar",
    message: "Topikal nemlendirmenin yanı sıra günde 1.5–2 litre su cildin nem dengesini doğrudan etkiler.",
    microAction: "Bugün bir bardak su iç — bakımın içten başlar.",
  },
  {
    icon: "feather",
    title: "Az Çok Yeter",
    message: "Ürünü bolca sürmek etkisini artırmaz, aksine tahriş ve israf riski taşır. Bezelye tanesi kadar genellikle yeterli.",
    microAction: "Bu gece nemlendiricini bezelye kadar kullan — farkı gözlemle.",
  },
];

// 4. EĞİTİCİ (Endişeye göre şahsileştirilmiş + genel)
const EDUCATIONAL_BY_CONCERN: Record<string, MsgPool> = {
  akne: [
    {
      icon: "activity",
      title: "Akne ve Rutin İlişkisi",
      message: "Akne bakımında düzensiz rutin, bileşenlerin etkinliğini yarıya düşürür. Tutarlılık tedavinin %50'sidir.",
      microAction: "Bu hafta her gece temizleyicini kullan — geri kalan adımlar ikincil.",
    },
    {
      icon: "droplet",
      title: "Akne = Yağlı Cilt Değil",
      message: "Kuru ve hassas ciltler de akneli olabilir. Nemlendiriciyi kesmek sebum üretimini artırabilir.",
      microAction: "Aknenle savaşırken nemlendiricinden vazgeçme — hafif jel formül seç.",
    },
  ],
  hassasiyet: [
    {
      icon: "shield",
      title: "Bariyer Önce Gelir",
      message: "Hassas cilt bakımında ilk adım güçlü aktifler değil, bariyer onarımıdır. Seramid ve panthenol bu sürecin temel taşları.",
      microAction: "Seramid içeren ürününü bu gece kullan — bariyeri güçlendir.",
    },
    {
      icon: "wind",
      title: "Fragrance Hassas Ciltte",
      message: "Hassas ciltler için parfüm/fragrance içeren ürünleri atlayıp kokusuz formüllere geçmek reaktiviteyi belirgin azaltır.",
      microAction: "Bir ürününün bileşenlerinde 'fragrance' var mı? Bugün kontrol et.",
    },
  ],
  leke: [
    {
      icon: "sun",
      title: "Leke + SPF Zorunlu",
      message: "Leke bakımında güneş koruması olmadan herhangi bir aktif bileşen istenen sonucu veremez. SPF, tedavinin ayrılmaz parçasıdır.",
      microAction: "Bugün ve her gün: leke serumundan önce değil, sonra SPF sür.",
    },
    {
      icon: "zap",
      title: "Niasinamid + Leke",
      message: "Niasinamid melanin transferini yavaşlatır. SPF ile birlikte kullanıldığında leke bakımında güçlü bir kombinasyon oluşturur.",
      microAction: "Rutininde %5+ niasinamid içeren bir ürün var mı? Araştır.",
    },
  ],
  kuruluk: [
    {
      icon: "droplet",
      title: "Hümektan + Oklüzyon",
      message: "Kuru cilt için en etkili yöntem: önce hümektan (hyaluronik asit) ardından oklüzyon (krem/yağ) katmanı. Ters sıra işe yaramaz.",
      microAction: "Bu gece: serum → nemlendirici → hafif yağ veya oklüzyon katmanı ekle.",
    },
    {
      icon: "moon",
      title: "Gece Bariyer Onarımı",
      message: "Kuru cilt için en verimli bakım zamanı gece — onarım döngüsü aktifken daha zengin formüller daha derin etki yapar.",
      microAction: "Bu gece en zengin kremini son adım olarak uygula.",
    },
  ],
  gunes: [
    {
      icon: "sun",
      title: "SPF Her Gün",
      message: "Bulutlu havalar UV ışınımını durdurmaz. UVA yılın 365 günü cilt bariyerini etkiler — mevsim fark etmez.",
      microAction: "Bugün güneş kremi sürdün mü? Çantanda var mı?",
    },
    {
      icon: "refresh-cw",
      title: "SPF Yenileme Saati",
      message: "Her 2 saatte bir SPF yenilenmeli. Makyaj üzerine için spray veya toz formatlı ürünler kullanılabilir.",
      microAction: "Öğlen saatinde SPF tazelemeyi bugün dene.",
    },
  ],
  sac: [
    {
      icon: "wind",
      title: "Saç Derisi Cilt Gibi",
      message: "Saç derisi de sebum üretir, pH dengesi vardır ve bariyer bozukluğu yaşayabilir. Saç derisi bakımı, saç bakımından önce gelir.",
      microAction: "Şampuanını saç dişerini değil, sadece deri ve diplerini temizleyecek şekilde kullan.",
    },
  ],
};

const EDUCATIONAL_GENERAL: MsgPool = [
  {
    icon: "book",
    title: "İlk 5 Bileşen Kuralı",
    message: "Bileşen listesindeki ilk 5 madde ürünün yaklaşık %80'ini oluşturur. Etiket yerine bu listeyi oku.",
    microAction: "Elinizdeki bir ürünün ilk 5 bileşenini bugün oku.",
  },
  {
    icon: "layers",
    title: "pH Bekleme Süresi",
    message: "C vitamini veya AHA/BHA uyguladıktan sonra 20–30 dakika beklemek aktif bileşenin etkinliğini artırır.",
    microAction: "Asit serum sonrası 20–30 dakika bekle, ardından devam et.",
  },
  {
    icon: "info",
    title: "Bariyer Zayıfladığında",
    message: "Cilt bariyeri zayıfken yoğun aktif içerikler daha fazla tahrişe neden olabilir. Onarım önce gelir.",
    microAction: "Bu hafta güçlü aktifleri bir mola verdirip seramid ağırlıklı rutine geç.",
  },
  {
    icon: "clock",
    title: "12 Hafta Sabret",
    message: "Herhangi bir cilt ürününe adil şans tanımak için minimum 12 haftalık düzenli kullanım gereklidir.",
    microAction: "Yeni bir ürün başlattıysan başlangıç tarihini not et.",
  },
  {
    icon: "star",
    title: "Daha Az, Daha Tutarlı",
    message: "3 ürünle tutarlı bir rutin, 12 ürünle tutarsız bir rutinden her zaman daha etkilidir.",
    microAction: "Rutinini 3 temel adıma indir ve bu hafta dene.",
  },
];

// 5. MOTİVASYON
const ENCOURAGING_MSGS: MsgPool = [
  {
    icon: "award",
    title: "İyi Gidiyorsun",
    message: "Son günlerde rutinin dengeli ilerliyor. Böyle devam etmek en doğru yol — büyük değişimler birikirken gelir.",
    microAction: "Bugün de rutinini tamamla — küçük adım, büyük fark.",
  },
  {
    icon: "check-circle",
    title: "Tutarlılık Kazanır",
    message: "En pahalı ürün bile tutarsız kullanımla sonuç vermez. En iyi rutin, sürdürebileceğin rutindir.",
    microAction: "Bu gece rutini tamamla — yarın da, öbür gün de.",
  },
  {
    icon: "heart",
    title: "Cilt Sabrı Ödüller",
    message: "Cilt değişimleri gözle görülmeden önce hücresel düzeyde başlar. İlk 4 hafta sabrın en değerli zamanı.",
    microAction: "Bugün rutin sonrası cildin nasıl hissettirdiğini not al.",
  },
  {
    icon: "anchor",
    title: "Alışkanlık Yerleşiyor",
    message: "Düzenli rutin, zamanla otomatikleşen bir davranışa dönüşür. Kasıtlı tekrar bu dönüşümü hızlandırır.",
    microAction: "Rutin zamanını diş fırçalamayla bağda — koşullanmış alışkanlık daha güçlü.",
  },
];

// ─── Yardımcı: günlük seed indeksi ────────────────────────────────────────────

function getDayIndex(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
}

function pickFromPool(pool: MsgPool, salt = 0): (typeof pool)[0] {
  const idx = (getDayIndex() + salt) % pool.length;
  return pool[idx];
}

// ─── Ana motor ────────────────────────────────────────────────────────────────

/**
 * Kullanıcı bağlamına göre tek, güçlü günlük mesaj üretir.
 * Öncelik: güvenlik → rutin hatası → davranış → eğitici → motivasyon
 */
export function generateDailyInsight(ctx: InsightContext): DailyInsight {
  const isPremium = ctx.isPremium ?? false;

  // ── 1. GÜVENLİK UYARISI ─────────────────────────────────────────────────
  if (ctx.highSeverityWarning || (ctx.warningCount ?? 0) > 0) {
    const types = ctx.warningTypes ?? [];
    let safetyMsg: (typeof SAFETY_MSGS)[0];

    if (types.includes("allergy") || types.includes("sensitivity")) {
      safetyMsg = SAFETY_MSGS[0];
    } else if (types.includes("active_overload")) {
      safetyMsg = SAFETY_MSGS[2];
    } else {
      safetyMsg = SAFETY_MSGS[1];
    }

    const palette = PALETTES.rose;
    const baseMeta = {
      type: "safety" as InsightType,
      ...palette,
      ...safetyMsg,
    };

    if (isPremium && ctx.warningTypes?.length) {
      return {
        ...baseMeta,
        message: safetyMsg.message + " Seçkin üyeliğin sayesinde detaylı içerik analizi ürün sayfalarında mevcut.",
      };
    }
    return baseMeta;
  }

  // ── 2. RUTİN HATASI ──────────────────────────────────────────────────────
  const adherence  = ctx.adherenceScore ?? 100;
  const morningDays = ctx.morningDays ?? 7;
  const eveningDays = ctx.eveningDays ?? 7;
  const activeDays  = ctx.activeDays  ?? 7;

  const isEveningSkipping = eveningDays < morningDays - 1 && eveningDays <= 3;
  const isLowAdherence    = adherence < 40;
  const hasNoRoutine      = !ctx.hasRoutine && activeDays === 0;

  if (isEveningSkipping || isLowAdherence || hasNoRoutine) {
    let msg: (typeof ROUTINE_MISTAKE_MSGS)[0];
    if (hasNoRoutine) {
      msg = ROUTINE_MISTAKE_MSGS[3];
    } else if (isEveningSkipping) {
      msg = ROUTINE_MISTAKE_MSGS[0];
    } else if (isLowAdherence) {
      msg = ROUTINE_MISTAKE_MSGS[1];
    } else {
      msg = pickFromPool(ROUTINE_MISTAKE_MSGS, 11);
    }

    const palette = PALETTES.amber;
    const baseMeta = {
      type: "routine_mistake" as InsightType,
      ...palette,
      ...msg,
    };

    if (isPremium) {
      return {
        ...baseMeta,
        message: msg.message + (adherence > 0
          ? ` Bu hafta ${activeDays}/7 gün aktif rutin uygulandı.`
          : ""),
      };
    }
    return baseMeta;
  }

  // ── 3. DAVRANIŞSAL YÖNLENDIRME ───────────────────────────────────────────
  if (adherence < 75) {
    const msg = pickFromPool(BEHAVIOR_MSGS, 7);
    const palette = PALETTES.teal;
    return {
      type: "behavior",
      ...palette,
      ...msg,
    };
  }

  // ── 4. EĞİTİCİ ──────────────────────────────────────────────────────────
  const concern = ctx.lastConcern;
  if (concern && EDUCATIONAL_BY_CONCERN[concern]) {
    const pool = EDUCATIONAL_BY_CONCERN[concern];
    const msg = pickFromPool(pool, 3);
    const palette = PALETTES.violet;
    const baseMeta = {
      type: "educational" as InsightType,
      ...palette,
      ...msg,
    };
    if (isPremium && concern) {
      return {
        ...baseMeta,
        title: `${concern.charAt(0).toUpperCase()}${concern.slice(1)} İçin Not`,
        message: msg.message,
      };
    }
    return baseMeta;
  }

  // Endişe yoksa genel eğitici
  const skinConcerns = ctx.skinConcerns ?? [];
  let eduPool = EDUCATIONAL_GENERAL;
  if (skinConcerns.length > 0) {
    const matchedConcern = Object.keys(EDUCATIONAL_BY_CONCERN).find(k =>
      skinConcerns.some(c => c.toLowerCase().includes(k) || k.includes(c.toLowerCase()))
    );
    if (matchedConcern) {
      eduPool = [...EDUCATIONAL_BY_CONCERN[matchedConcern], ...EDUCATIONAL_GENERAL];
    }
  }
  const eduMsg = pickFromPool(eduPool, 5);
  return {
    type: "educational",
    ...PALETTES.blue,
    ...eduMsg,
  };

  // ── 5. MOTİVASYON (yukarıda hiçbiri çalışmadıysa) ── (unreachable guard için)
}

/**
 * Motivasyon mesajı — yüksek uyum veya fallback için
 */
export function getEncouragingInsight(isPremium = false): DailyInsight {
  const msg = pickFromPool(ENCOURAGING_MSGS, 0);
  const palette = PALETTES.sage;
  return {
    type: "encouraging",
    ...palette,
    ...msg,
    message: isPremium
      ? msg.message + " Rutinin detaylı analizine Profilim sekmesinden ulaşabilirsin."
      : msg.message,
  };
}

/**
 * Tam akıllı üretici — yüksek uyum + pozitif context durumunda motivasyona düşer
 */
export function getSmartDailyInsight(ctx: InsightContext): DailyInsight {
  const adherence = ctx.adherenceScore ?? 100;
  const noWarnings = (ctx.warningCount ?? 0) === 0;
  const goodAdherence = adherence >= 75;
  const isNewUser = !ctx.hasRoutine && (ctx.activeDays ?? 0) === 0 && !ctx.lastConcern;

  // Yeni kullanıcı → başlatıcı motivasyon
  if (isNewUser) {
    return {
      type: "encouraging",
      ...PALETTES.sage,
      icon: "compass",
      title: "Başlamak En Büyük Adım",
      message: "Cilt bakımı karmaşık olmak zorunda değil. Temizleyici, nemlendirici ve SPF — bu üçü yeterlice güçlü bir başlangıç.",
      microAction: "Bir ürün sayfasını aç ve içeriklere bak — merak, bakımın ilk adımı.",
    };
  }

  // Yüksek uyum ve uyarı yok → motivasyon
  if (goodAdherence && noWarnings) {
    return getEncouragingInsight(ctx.isPremium);
  }

  return generateDailyInsight(ctx);
}
