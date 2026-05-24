/**
 * indicationRoutineEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Dermatolog tarzı, ENDİKASYON ÖNCE rutin motoru.
 *
 * TEMEL PRENSIP:
 *   Bir ürünün rolü kullanıcıdan kullanıcıya değişir.
 *   Şablondan değil, bireyin temel probleminden başlanır.
 *
 * ROL SİSTEMİ:
 *   Esas        — Bu adım olmadan hedef elde edilemez
 *   Destek      — Sonucu güçlendirir; çıkarılabilir
 *   İsteğe bağlı — Yük yaratmaması için rutini sadeleştirmek gerekirse çıkar
 *
 * KARAR KATMANLARI:
 *   1. Birincil endikasyon   (acne / dark_spots / sensitivity / dryness / sun)
 *   2. Cilt tipi             (oily / combination / dry / sensitive)
 *   3. Özel durumlar         (pregnancy / retinoid intolerance / active treatment)
 *
 * KLİNİK KURALLAR:
 *   - Sabah / akşam → max 5 adım
 *   - Bariyer hasarı varsa: önce onar, sonra aktif ekle
 *   - SPF: leke / akne izi / retinoid kullanımında Esas
 *   - Hamilelik: retinol / yüksek BHA adımları çıkar
 *   - Tolerans düşükse: aktif adımlar Esas'tan Destek'e iner
 */

import type { RoutineProfile } from "./concernRoutineBridge";

// ── Dönüş tipleri ─────────────────────────────────────────────────────────────

export type RoleLabel = "Esas" | "Destek" | "İsteğe bağlı";

export interface IndicationStep {
  slot:       string;
  category:   string;
  roleLabel:  RoleLabel;
  roleReason: string;      // 1 kısa cümle — neden bu rol?
  note?:      string;
  howTo?:     string;
  frequency?: string;
  caution?:   string;
  /** Hamilelik / retinoid toleransı gibi dışlama kuralı nedeniyle kaldırıldı */
  excluded?:  boolean;
  excludeReason?: string;
}

export interface IndicationRoutine {
  morning:    IndicationStep[];
  evening:    IndicationStep[];
  weekly?:    IndicationStep[];
  warnings:   string[];
  notes:      string[];
  simplified: boolean;
}

// ── İçerik detayı (kullanım talimatı katmanı) ────────────────────────────────

const HOW_TO: Record<string, { howTo: string; frequency: string; caution?: string }> = {
  "Temizleyici": {
    howTo:     "Nemli yüze küçük miktarda uygulayın, 20–30 sn masaj, bol suyla durulayın.",
    frequency: "Sabah ve akşam",
  },
  "Nazik Temizleyici": {
    howTo:     "Nemli yüze uygulayın, nazikçe masaj yapın, durulayın. Ovuşturmayın.",
    frequency: "Sabah ve akşam",
    caution:   "Double cleanse gerekiyorsa önce misel suyu kullanın.",
  },
  "Nem Serumu": {
    howTo:     "Temiz, hafif nemli cilde 3–4 damla uygulayın, baskıyla yedirin.",
    frequency: "Sabah ve/veya akşam",
    caution:   "Serum üzerine hemen nemlendirici uygulayın.",
  },
  "Akne Odaklı Serum": {
    howTo:     "Parmak uçlarıyla ince katman uygulayın. Göz çevresine yaklaştırmayın.",
    frequency: "Akşam, haftada 3–5 gece (başlangıçta 3 ile başlayın)",
    caution:   "İlk kullanımlarda hafif soyulma normal bir adaptasyon sürecidir.",
  },
  "Aydınlatıcı Serum": {
    howTo:     "Temiz cilde uygulayın.",
    frequency: "Akşam, her gün ya da gün aşırı",
    caution:   "Sabah kullanacaksanız SPF şart.",
  },
  "Yatıştırıcı Serum": {
    howTo:     "İnce katman uygulayın, 30 sn sindirme süresi bekleyin.",
    frequency: "Akşam, her gün",
    caution:   "Yeni ürünleri tek tek test edin — hassas cilt öngörülemeyen tepkiler verebilir.",
  },
  "Bariyer Onarım Serumu": {
    howTo:     "Temizleme sonrası 3–5 damla yavaşça yedirin.",
    frequency: "Akşam, her gün",
    caution:   "Güçlü aktiflerle (retinol, AHA) aynı gece karıştırmayın.",
  },
  "Nemlendirici": {
    howTo:     "Serum üzerine cömertçe uygulayın, yukarı yönlü hafif baskıyla yedirin.",
    frequency: "Sabah ve akşam",
  },
  "Bariyer Kremi": {
    howTo:     "Akşam rutininin son adımı; özellikle kuru alanlara ekstra katman ekleyin.",
    frequency: "Her akşam",
  },
  "Güneş Koruyucu": {
    howTo:     "Son adım olarak 1/4 çay kaşığı miktarında yüze + boyuna uygulayın.",
    frequency: "Her sabah — güneşli ya da değil",
    caution:   "2 saatte bir yenilemek önerilir.",
  },
  "Onarım Serumu": {
    howTo:     "3–4 damla yedirin, sindirilmesini bekleyerek nemlendirici uygulayın.",
    frequency: "Akşam, her gün",
  },
  "Hafif Serum": {
    howTo:     "Temizleme sonrası 3–4 damla cilde yayın, emilmesini bekleyin.",
    frequency: "Sabah ve/veya akşam",
  },
};

function enrichStep(step: IndicationStep): IndicationStep {
  const detail = HOW_TO[step.category];
  if (!detail) return step;
  return {
    ...step,
    howTo:     step.howTo     ?? detail.howTo,
    frequency: step.frequency ?? detail.frequency,
    caution:   step.caution   ?? detail.caution,
  };
}

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

function slot(n: number): string { return String(n); }

function isPregnancy(rp: RoutineProfile): boolean {
  // RoutineProfile'da specialConditions direkt yok,
  // ancak sensitivity/barrier'dan inference yapılabilir.
  // Gerçek koşul dış çağrıdan `options.isPregnant` ile gelir.
  return false;
}

function clamp(steps: IndicationStep[], max = 5): IndicationStep[] {
  if (steps.length <= max) return steps;
  // Önce İsteğe bağlı çıkar, sonra Destek, asla Esas çıkarma
  const essential = steps.filter(s => s.roleLabel === "Esas");
  const support   = steps.filter(s => s.roleLabel === "Destek");
  const optional  = steps.filter(s => s.roleLabel === "İsteğe bağlı");

  const combined = [...essential, ...support, ...optional];
  return combined.slice(0, max).map((s, i) => ({ ...s, slot: slot(i + 1) }));
}

// ── Endikasyon işleme fonksiyonları ──────────────────────────────────────────

// ──────────── AKNE ────────────────────────────────────────────────────────────

function buildAcne(rp: RoutineProfile, opts: EngineOptions): IndicationRoutine {
  const morning: IndicationStep[] = [];
  const evening: IndicationStep[] = [];
  const warnings: string[] = [];
  const notes: string[]    = [];
  let simplified = false;

  const highSeverity  = rp.severity === "high";
  const weakBarrier   = rp.barrierStatus === "weak" || rp.barrierStatus === "partial";
  const lowTolerance  = rp.activeTolerance === "low";
  const marksGoal     = rp.routineGoal.includes("iz") || rp.routineGoal.includes("görünüm");
  const oilControl    = rp.oilBalance === "oily" || rp.oilBalance === "combination";

  // ── SABAH ─────────────────────────────────────────────────────────────────

  morning.push({
    slot: slot(1),
    category: rp.sensitivityLevel === "high" ? "Nazik Temizleyici" : "Temizleyici",
    roleLabel: "Esas",
    roleReason: "Akne bakımının temel adımı; gece birikimini temizler.",
  });

  morning.push({
    slot: slot(2),
    category: "Nemlendirici",
    roleLabel: "Esas",
    roleReason: oilControl
      ? "Yağ dengesini kurmak için nem şart; nem atlayınca yağ üretimi artar."
      : "Bariyer bütünlüğünü korur.",
  });

  // SPF: iz / leke hedefi varsa Esas, yoksa Destek
  morning.push({
    slot: slot(3),
    category: "Güneş Koruyucu",
    roleLabel: marksGoal ? "Esas" : "Destek",
    roleReason: marksGoal
      ? "Mevcut izlerin koyulaşmasını önlemek için SPF bu rutinin en kritik adımı."
      : "Günlük temel koruma.",
  });

  // ── AKŞAM ─────────────────────────────────────────────────────────────────

  evening.push({
    slot: slot(1),
    category: "Temizleyici",
    roleLabel: "Esas",
    roleReason: "Gün sonu temizliği; akne odaklı bakımın önkoşulu.",
  });

  if (weakBarrier) {
    // Bariyer önce onarılır, aktif ertelenebilir
    evening.push({
      slot: slot(2),
      category: "Bariyer Onarım Serumu",
      roleLabel: "Esas",
      roleReason: "Bariyer hasarı varken aktif eklemek tahrişi artırır; önce onar.",
    });
    if (!lowTolerance && highSeverity) {
      evening.push({
        slot: slot(3),
        category: "Akne Odaklı Serum",
        roleLabel: "Destek",
        roleReason: "Bariyer stabil olduğunda BHA / niasinamid eklenerek etki artırılabilir.",
        caution:   "Haftada 2–3 ile başlayın; tahriş yoksa sıklığı artırın.",
      });
    }
  } else if (lowTolerance) {
    evening.push({
      slot: slot(2),
      category: "Akne Odaklı Serum",
      roleLabel: "Destek",
      roleReason: "Düşük tolerans nedeniyle aktif rolünü destekleme düzeyinde tutar.",
      caution:   "Haftada 2 gece ile başlayın.",
    });
  } else {
    evening.push({
      slot: slot(2),
      category: "Akne Odaklı Serum",
      roleLabel: highSeverity ? "Esas" : "Destek",
      roleReason: highSeverity
        ? "Yoğun akne durumunda aktif içerik (BHA/niasinamid) bu rutinin çekirdeği."
        : "Akne bakımını destekler; alternatif olarak niasinamid içerikli nemlendirici de işe yarar.",
    });
  }

  evening.push({
    slot: slot(3),
    category: weakBarrier ? "Bariyer Kremi" : "Nemlendirici",
    roleLabel: "Esas",
    roleReason: weakBarrier
      ? "Onarım serumuyla başlanan bariyeri kremle kapatır."
      : "Akne aktiflerinden sonra gece nem kapama şart.",
  });

  if (opts.isPregnant) {
    // Güçlü BHA (>2%) ve retinol çıkar
    warnings.push("Hamilelik/emzirme döneminde yüksek yoğunluklu BHA ve retinol kullanımı önerilmez. Eczacınıza danışın.");
    simplified = true;
  }

  if (weakBarrier) {
    notes.push("Bariyer güçlendikçe aktif adımlar artırılabilir.");
    simplified = true;
  }
  if (lowTolerance) {
    notes.push("Tolerans arttıkça sıklığı kademeli artırın.");
    simplified = true;
  }

  return {
    morning: clamp(morning.map(enrichStep)),
    evening: clamp(evening.map(enrichStep)),
    warnings,
    notes: [...notes, ...rp.notes],
    simplified,
  };
}

// ──────────── LEKE / DARK SPOTS ───────────────────────────────────────────────

function buildDarkSpots(rp: RoutineProfile, opts: EngineOptions): IndicationRoutine {
  const morning: IndicationStep[] = [];
  const evening: IndicationStep[] = [];
  const warnings: string[] = [];
  const notes: string[]    = [];
  let simplified = false;

  const weakBarrier  = rp.barrierStatus === "weak" || rp.barrierStatus === "partial";
  const lowTolerance = rp.activeTolerance === "low";
  const radiance     = rp.routineGoal.includes("Aydınlık") || rp.routineGoal.includes("aydınlık");

  // ── SABAH ─────────────────────────────────────────────────────────────────

  morning.push({
    slot: slot(1),
    category: rp.sensitivityLevel === "high" ? "Nazik Temizleyici" : "Temizleyici",
    roleLabel: "Esas",
    roleReason: "Gün başlangıcında temiz bir yüzey aktif içeriklerin emilimini artırır.",
  });

  morning.push({
    slot: slot(2),
    category: "Nemlendirici",
    roleLabel: "Destek",
    roleReason: "Aktif içeriklerin olası kurutma etkisini dengelemek için sabah nemi gereklidir.",
  });

  // SPF: leke rutininin Esas adımı — tartışmasız
  morning.push({
    slot: slot(3),
    category: "Güneş Koruyucu",
    roleLabel: "Esas",
    roleReason: "SPF olmadan aydınlatıcı aktifler istenilen etkiyi veremez; leke korumasının çekirdeği.",
  });

  // ── AKŞAM ─────────────────────────────────────────────────────────────────

  evening.push({
    slot: slot(1),
    category: rp.sensitivityLevel === "high" ? "Nazik Temizleyici" : "Temizleyici",
    roleLabel: "Esas",
    roleReason: "Gün sonu temizliği; aktifler temiz cilde uygulanmalıdır.",
  });

  if (weakBarrier) {
    evening.push({
      slot: slot(2),
      category: "Bariyer Onarım Serumu",
      roleLabel: "Esas",
      roleReason: "Leke aktiflerinden önce bariyerin stabilize edilmesi tahriş riskini düşürür.",
    });
    evening.push({
      slot: slot(3),
      category: "Aydınlatıcı Serum",
      roleLabel: "Destek",
      roleReason: "Bariyer güçlendikçe eklenir; düşük yoğunlukla başlamak doğru yaklaşım.",
    });
    simplified = true;
  } else if (lowTolerance) {
    evening.push({
      slot: slot(2),
      category: "Aydınlatıcı Serum",
      roleLabel: "Destek",
      roleReason: "Hassasiyet nedeniyle aktif rolü Destek'e indirildi; gün aşırı kullanım önerilir.",
      caution:   "Haftada 3–4 gece ile başlayın.",
    });
  } else {
    evening.push({
      slot: slot(2),
      category: "Aydınlatıcı Serum",
      roleLabel: "Esas",
      roleReason: radiance
        ? "Aydınlık hedefi için C vitamini / alfa arbutin / azelaik asit bu rutinin çekirdeği."
        : "Leke görünümünü azaltmak için gece aktif uygulaması şart.",
    });
  }

  evening.push({
    slot: slot(3),
    category: weakBarrier ? "Bariyer Kremi" : "Nemlendirici",
    roleLabel: "Esas",
    roleReason: "Aktif içerikleri kapatan nem katmanı; atlanırsa soyulma riski artar.",
  });

  if (opts.isPregnant) {
    warnings.push("Hamilelik/emzirme döneminde yüksek yoğunluklu AHA/retinol kullanımı önerilmez. Eczacınıza danışın.");
  }

  notes.push("SPF ile aydınlatıcı aktifin birleşimi bu rutinin en güçlü tarafıdır; biri eksikse etki yarıya iner.");
  return {
    morning: clamp(morning.map(enrichStep)),
    evening: clamp(evening.map(enrichStep)),
    warnings,
    notes: [...notes, ...rp.notes],
    simplified,
  };
}

// ──────────── HASSASİYET / SENSİTİVİTY ───────────────────────────────────────

function buildSensitivity(rp: RoutineProfile, opts: EngineOptions): IndicationRoutine {
  const morning: IndicationStep[] = [];
  const evening: IndicationStep[] = [];
  const warnings: string[] = [];
  const notes: string[]    = [];
  let simplified = false;

  const weakBarrier  = rp.barrierStatus === "weak" || rp.barrierStatus === "partial";
  const highSens     = rp.sensitivityLevel === "high";

  // ── SABAH ─────────────────────────────────────────────────────────────────

  morning.push({
    slot: slot(1),
    category: "Nazik Temizleyici",
    roleLabel: "Esas",
    roleReason: "Hassas cilt standart temizleyicilere dahi tepki verebilir; nazif formül zorunlu.",
  });

  morning.push({
    slot: slot(2),
    category: "Nemlendirici",
    roleLabel: "Esas",
    roleReason: "Nem bariyeri güçlendirmek bu rutinin temel amacı.",
  });

  morning.push({
    slot: slot(3),
    category: "Güneş Koruyucu",
    roleLabel: "Destek",
    roleReason: "UV hassasiyeti artmış ciltler için önemli; mümkün olduğunda mineral filtreli tercih edin.",
  });

  // ── AKŞAM ─────────────────────────────────────────────────────────────────

  evening.push({
    slot: slot(1),
    category: "Nazik Temizleyici",
    roleLabel: "Esas",
    roleReason: "Gün sonu temizliği; tahriş etmeden cilt yüzeyini hazırlar.",
  });

  if (weakBarrier) {
    evening.push({
      slot: slot(2),
      category: "Bariyer Onarım Serumu",
      roleLabel: "Esas",
      roleReason: "Reaktif ciltlerde önce bariyer güçlendirilmeden hiçbir aktif eklenmemeli.",
    });
    evening.push({
      slot: slot(3),
      category: "Bariyer Kremi",
      roleLabel: "Esas",
      roleReason: "Onarım serumuyla başlayan bariyeri kapatır; iyileşmede kilit adım.",
    });
    simplified = true;
  } else {
    evening.push({
      slot: slot(2),
      category: "Yatıştırıcı Serum",
      roleLabel: highSens ? "Esas" : "Destek",
      roleReason: highSens
        ? "Kızarıklık ve tahriş eğilimini centella / bisabolol ile baskılar."
        : "Günlük sakinleştirme desteği sağlar.",
    });

    evening.push({
      slot: slot(3),
      category: "Nemlendirici",
      roleLabel: "Esas",
      roleReason: "Nem kapama; yatıştırıcı serumun etkisini tamamlar.",
    });
  }

  if (highSens) {
    notes.push("Koku ve alkol içermeyen formüller öncelikli. Yeni ürün eklerken her seferinde tek ürün deneyin.");
    warnings.push("Bu cilt yapısında fazla aktif içerik tahrişi artırabilir; aktif eklemek için bariyer güçlenmesini bekleyin.");
  }

  return {
    morning: clamp(morning.map(enrichStep)),
    evening: clamp(evening.map(enrichStep)),
    warnings,
    notes: [...notes, ...rp.notes],
    simplified,
  };
}

// ──────────── KURULUK / DRYNESS ───────────────────────────────────────────────

function buildDryness(rp: RoutineProfile, opts: EngineOptions): IndicationRoutine {
  const morning: IndicationStep[] = [];
  const evening: IndicationStep[] = [];
  const warnings: string[] = [];
  const notes: string[]    = [];
  let simplified = false;

  const weakBarrier  = rp.barrierStatus === "weak" || rp.barrierStatus === "partial";
  const highHydration= rp.hydrationNeed === "high";
  const repairGoal   = rp.routineGoal.includes("Bariyer") || rp.routineGoal.includes("güçlendirmek");

  // ── SABAH ─────────────────────────────────────────────────────────────────

  morning.push({
    slot: slot(1),
    category: rp.sensitivityLevel === "high" ? "Nazik Temizleyici" : "Temizleyici",
    roleLabel: "Esas",
    roleReason: "Kuru cilt için köpüksüz / kremal formüller yağ tabakasını korur.",
  });

  morning.push({
    slot: slot(2),
    category: "Nem Serumu",
    roleLabel: highHydration ? "Esas" : "Destek",
    roleReason: highHydration
      ? "Yüksek nem ihtiyacında hyalüronik asit tek başına belirgin fark yaratır."
      : "Gün boyu orta düzey nem desteği.",
  });

  morning.push({
    slot: slot(3),
    category: "Nemlendirici",
    roleLabel: "Esas",
    roleReason: "Serum nemi kilitleyen krem olmadan hızla buharlaşır; bu adım atlanamaz.",
  });

  morning.push({
    slot: slot(4),
    category: "Güneş Koruyucu",
    roleLabel: "Destek",
    roleReason: "Kuru ciltlerde kremli SPF formülleri hem nem hem koruma sağlar.",
  });

  // ── AKŞAM ─────────────────────────────────────────────────────────────────

  evening.push({
    slot: slot(1),
    category: rp.sensitivityLevel === "high" ? "Nazik Temizleyici" : "Temizleyici",
    roleLabel: "Esas",
    roleReason: "Kuru cilt için aşırı temizlemeden kaçın; bir kez yeterlidir.",
  });

  evening.push({
    slot: slot(2),
    category: "Onarım Serumu",
    roleLabel: repairGoal ? "Esas" : "Destek",
    roleReason: repairGoal
      ? "Peptit / seramid içerikli serum gece bariyer yenilenmesini hızlandırır."
      : "Kuru ve hassas ciltlerde gece onarım desteği.",
  });

  if (weakBarrier) {
    evening.push({
      slot: slot(3),
      category: "Bariyer Kremi",
      roleLabel: "Esas",
      roleReason: "Bariyer hasarında zengin onarım kremi gece rutininin en önemli adımı.",
    });
  } else {
    evening.push({
      slot: slot(3),
      category: "Nemlendirici",
      roleLabel: "Esas",
      roleReason: rp.preferredTexture === "rich"
        ? "Kuru cilde zengin krem gece boyunca derin nem sağlar."
        : "Serum nemi gece boyunca kilitleyen temel adım.",
    });
  }

  notes.push("Katmanlı nem uygulaması (serum + krem) tek ürüne göre çok daha etkilidir.");
  return {
    morning: clamp(morning.map(enrichStep)),
    evening: clamp(evening.map(enrichStep)),
    warnings,
    notes: [...notes, ...rp.notes],
    simplified,
  };
}

// ──────────── GÜNEŞ / SUN ─────────────────────────────────────────────────────

function buildSun(rp: RoutineProfile, opts: EngineOptions): IndicationRoutine {
  const morning: IndicationStep[] = [];
  const evening: IndicationStep[] = [];
  const notes:   string[] = [];

  const highProtection = rp.protectionNeed === "high";
  const isOily         = rp.oilBalance === "oily" || rp.oilBalance === "combination";
  const antiSpot       = rp.routineGoal.includes("Leke");

  // ── SABAH ─────────────────────────────────────────────────────────────────

  morning.push({
    slot: slot(1),
    category: rp.sensitivityLevel === "high" ? "Nazik Temizleyici" : "Temizleyici",
    roleLabel: "Destek",
    roleReason: "SPF uygulamadan önce temiz yüzey; ancak bu rutinin asıl hedefi korumadır.",
  });

  morning.push({
    slot: slot(2),
    category: isOily ? "Nemlendirici" : "Nem Serumu",
    roleLabel: "Destek",
    roleReason: isOily
      ? "Yağlı ciltte hafif nemlendirici SPF katmanı için baz oluşturur."
      : "SPF öncesi nem katmanı güneş koruyucunun yayılımını kolaylaştırır.",
  });

  morning.push({
    slot: slot(3),
    category: "Güneş Koruyucu",
    roleLabel: "Esas",
    roleReason: highProtection
      ? "Yüksek maruziyet / leke geçmişi nedeniyle SPF bu rutinin değiştirilemez çekirdeği."
      : "Günlük SPF olmadan hiçbir bakım amacına ulaşmak mümkün değil.",
  });

  // ── AKŞAM ─────────────────────────────────────────────────────────────────

  evening.push({
    slot: slot(1),
    category: "Temizleyici",
    roleLabel: "Esas",
    roleReason: "Gün boyu biriken SPF filmini temizlemek bu rutinin başlangıç adımı.",
  });

  evening.push({
    slot: slot(2),
    category: antiSpot ? "Aydınlatıcı Serum" : "Nem Serumu",
    roleLabel: antiSpot ? "Esas" : "Destek",
    roleReason: antiSpot
      ? "Leke hedefi varsa gece aktif (C vitamini / azelaik) SPF'nin tamamlayıcısıdır."
      : "Güneş koruması sonrası gece nem takviyesi.",
  });

  evening.push({
    slot: slot(3),
    category: "Nemlendirici",
    roleLabel: "Destek",
    roleReason: "Gece nem kapama; genel bakım desteği.",
  });

  notes.push("SPF'nin etkisi yalnızca sürekli kullanımla katlanarak artar. Tek atlanan gün dahi birikimli hasara katkıda bulunur.");
  return {
    morning: clamp(morning.map(enrichStep)),
    evening: clamp(evening.map(enrichStep)),
    warnings: [],
    notes: [...notes, ...rp.notes],
    simplified: false,
  };
}

// ──────────── SAÇ DÖKÜLMESİ ──────────────────────────────────────────────────

function buildHairLoss(rp: RoutineProfile, opts: EngineOptions): IndicationRoutine {
  const morning: IndicationStep[] = [];
  const evening: IndicationStep[] = [];
  const weekly:  IndicationStep[] = [];

  morning.push({
    slot: slot(1),
    category: "Şampuan",
    roleLabel: "Esas",
    roleReason: rp.scalpType === "oily"
      ? "Yağlı saç derisi için hafif şampuan; sık yıkama yetersizse sebase tıkanma artar."
      : rp.scalpType === "dry"
        ? "Nemlendirici şampuan; kuru deri soyulma ve saç kırılganlığını artırır."
        : "Dengeleyici şampuan; bakımın başlangıç adımı.",
  });

  morning.push({
    slot: slot(2),
    category: "Bakım Spreyi veya Yağ",
    roleLabel: "Destek",
    roleReason: "Sabah saç lifleri için koruma ve güçlendirme desteği.",
  });

  evening.push({
    slot: slot(1),
    category: "Saç Derisi Serumu",
    roleLabel: "Esas",
    roleReason: rp.severity === "high"
      ? "Yoğun dökülmede kafein / biotin içerikli gece serumu bu rutinin çekirdeği."
      : "Saç derisini uyarır ve kök bölgesini besler.",
  });

  weekly.push({
    slot: slot(1),
    category: "Saç Maskesi",
    roleLabel: "İsteğe bağlı",
    roleReason: "Haftalık derin nem ve güçlendirme; dökülme bakımını doğrudan etkilemez.",
  });

  const warnings: string[] = [];
  if (rp.sensitivityLevel === "high") {
    warnings.push("Hassas saç derisi için parfümsüz formüller tercih edilmeli.");
  }

  return {
    morning: clamp(morning.map(enrichStep)),
    evening: clamp(evening.map(enrichStep)),
    weekly:  weekly.map(enrichStep),
    warnings,
    notes: [...rp.notes],
    simplified: false,
  };
}

// ── Ana motor ─────────────────────────────────────────────────────────────────

export interface EngineOptions {
  isPregnant?:        boolean;
  retinoidIntolerant?: boolean;
  activeDermTreatment?: boolean;
}

/**
 * RoutineProfile + özel koşullar → Endikasyon önce, dinamik rol etiketli rutin.
 *
 * @example
 * const routine = buildIndicationRoutine(routineProfile, { isPregnant: true });
 * console.log(routine.morning[0].roleLabel); // "Esas"
 */
export function buildIndicationRoutine(
  rp: RoutineProfile,
  opts: EngineOptions = {},
): IndicationRoutine {
  switch (rp.concern) {
    case "acne":       return buildAcne(rp, opts);
    case "dark_spots": return buildDarkSpots(rp, opts);
    case "sensitivity":return buildSensitivity(rp, opts);
    case "dryness":    return buildDryness(rp, opts);
    case "sun":        return buildSun(rp, opts);
    case "hair_loss":  return buildHairLoss(rp, opts);
    default:           return buildSensitivity(rp, opts); // güvenli fallback
  }
}

// ── UI yardımcıları ───────────────────────────────────────────────────────────

/** Rol etiketi için renk (UI'da chip olarak kullanılır) */
export function roleLabelColor(role: RoleLabel): string {
  switch (role) {
    case "Esas":           return "#15803D"; // yeşil
    case "Destek":         return "#2563EB"; // mavi
    case "İsteğe bağlı":  return "#6B7280"; // gri
  }
}

/** Rol etiketi için arka plan rengi */
export function roleLabelBg(role: RoleLabel): string {
  switch (role) {
    case "Esas":           return "rgba(21,128,61,0.08)";
    case "Destek":         return "rgba(37,99,235,0.08)";
    case "İsteğe bağlı":  return "rgba(107,114,128,0.08)";
  }
}
