import { type Concern } from "./products_v37";
import { type RoutineLevel, type SkinFeel } from "./analysis_v39";
import { type ScanEntryMode, type ScanQuality } from "./scan_v40";

export type PremiumMetricV53 = {
  label: string;
  value: number;
  note: string;
};

export type PremiumAnalysisV53 = {
  title: string;
  profileLabel: string;
  score: number;
  metrics: PremiumMetricV53[];
  explanation: string;
  nextBestAction: string;
};

export type PremiumScanStepV53 = {
  step: string;
  title: string;
  text: string;
};

export type PremiumScanResultV53 = {
  title: string;
  qualityLabel: string;
  confidence: string;
  steps: PremiumScanStepV53[];
  recommendations: string[];
};

export function buildPremiumAnalysisV53(params: {
  concern: Concern;
  feel: SkinFeel;
  level: RoutineLevel;
}): PremiumAnalysisV53 {
  const base =
    params.concern === "Kuruluk" ? 78 :
    params.concern === "Hassasiyet" ? 74 :
    params.concern === "Leke" ? 76 :
    72;

  const feelDelta =
    params.feel === "Kuru" ? -4 :
    params.feel === "Hassas" ? -3 :
    params.feel === "Parlama" ? -2 :
    1;

  const levelDelta =
    params.level === "Sade" ? 2 :
    params.level === "Dengeli" ? 5 :
    7;

  const score = Math.max(55, Math.min(94, base + feelDelta + levelDelta));

  return {
    title: `${params.concern} odaklı cilt profili`,
    profileLabel: score >= 84 ? "Dengeli bakım profili" : score >= 74 ? "Destek isteyen profil" : "Yakından izlenecek profil",
    score,
    metrics: [
      {
        label: "Bariyer",
        value: params.concern === "Kuruluk" || params.concern === "Hassasiyet" ? 68 : 78,
        note: "Bakım dilinde nazik ve düzenli kullanım öne çıkar.",
      },
      {
        label: "Nem",
        value: params.feel === "Kuru" ? 64 : 76,
        note: "Nem desteği rutinin temel konfor adımıdır.",
      },
      {
        label: "Denge",
        value: params.concern === "Akne" || params.feel === "Parlama" ? 66 : 80,
        note: "Ağır his oluşturmayan ürün dili tercih edilir.",
      },
      {
        label: "Koruma",
        value: params.concern === "Leke" ? 62 : 74,
        note: "Gündüz koruma adımı anlatımın merkezinde tutulur.",
      },
    ],
    explanation: `${params.feel} hissi ve ${params.concern} odağı birlikte değerlendirildi. ${params.level} rutin seviyesiyle ürün önerisi sade ama yönlendirici tutulur.`,
    nextBestAction: params.concern === "Leke"
      ? "Önce gündüz koruma planını göster."
      : params.concern === "Kuruluk"
        ? "Önce bariyer ve nem ürünlerini öne çıkar."
        : params.concern === "Hassasiyet"
          ? "Önce kısa ve sakin bakım planı öner."
          : "Önce dengeleyici temizlik ve hafif nem adımını göster.",
  };
}

export function buildPremiumScanResultV53(params: {
  mode: ScanEntryMode;
  quality: ScanQuality;
  concern: Concern;
  feel: SkinFeel;
}): PremiumScanResultV53 {
  const confidence =
    params.quality === "İyi" ? "Yüksek demo güven" :
    params.quality === "Orta" ? "Orta demo güven" :
    "Düşük demo güven";

  return {
    title: "Tarama akışı özeti",
    qualityLabel: `${params.mode} • ${params.quality}`,
    confidence,
    steps: [
      {
        step: "1",
        title: "Girdi seçildi",
        text: `${params.mode} akışıyla ilerleniyor.`,
      },
      {
        step: "2",
        title: "Kalite okundu",
        text: `${params.quality} kaliteye göre sonuç dili ayarlandı.`,
      },
      {
        step: "3",
        title: "Yönlendirme hazır",
        text: `${params.concern} ve ${params.feel} bilgisi analiz sonucuna bağlandı.`,
      },
    ],
    recommendations: params.quality === "Yetersiz"
      ? ["Daha aydınlık ortam öner.", "Manuel değerlendirme seçeneğini açık tut.", "Sonucu kesin hüküm gibi sunma."]
      : ["Analiz sonucuna geç.", "İlk ürün önerisini göster.", "Rutin planını kısa özetle."],
  };
}
