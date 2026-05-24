import { type Concern } from "./products_v37";
import { type RoutineLevel, type SkinFeel } from "./analysis_v39";
import { type ScanEntryMode, type ScanQuality } from "./scan_v40";

export type AnalysisPolishV46 = {
  confidence: string;
  headline: string;
  nextActions: string[];
  pharmacistNote: string;
};

export type ScanPolishV46 = {
  statusTitle: string;
  statusText: string;
  nextSteps: string[];
};

export function buildAnalysisPolishV46(params: {
  concern: Concern;
  feel: SkinFeel;
  level: RoutineLevel;
  productCount: number;
}): AnalysisPolishV46 {
  const confidence =
    params.productCount >= 4 ? "Güçlü demo eşleşme" : params.productCount >= 2 ? "Yeterli demo eşleşme" : "Sınırlı demo eşleşme";

  return {
    confidence,
    headline: `${params.concern} odağında ${params.level.toLocaleLowerCase("tr-TR")} bakım planı`,
    nextActions: [
      "Önce sonucu müşteriye sade cümleyle anlat.",
      "Sonra ürünleri göster ve ilk öneriyi açıklığa kavuştur.",
      "Rutin gerekiyorsa sabah-akşam planı birlikte aç.",
    ],
    pharmacistNote: `${params.feel} hissi baskınsa öneri dili kısa tutulmalı; gereksiz ürün kalabalığı yapılmamalı.`,
  };
}

export function buildScanPolishV46(params: {
  mode: ScanEntryMode;
  quality: ScanQuality;
  concern: Concern;
}): ScanPolishV46 {
  if (params.quality === "Yetersiz") {
    return {
      statusTitle: "Yeniden deneme önerilir",
      statusText: "Görsel kalite düşükse sonuç temkinli verilmeli; kullanıcı manuel değerlendirme akışına da alınabilir.",
      nextSteps: ["Daha aydınlık ortam öner.", "Manuel değerlendirme seçeneğini göster.", "Analiz sonucunu kesin hüküm gibi sunma."],
    };
  }

  if (params.quality === "Orta") {
    return {
      statusTitle: "Temkinli sonuç ver",
      statusText: "Kalite orta seviyedeyse analiz dili yumuşatılır ve ürün önerisi abartısız kurulur.",
      nextSteps: ["Önceliği doğrula.", "Ürünleri sade listele.", "Rutin planını kısa tut."],
    };
  }

  return {
    statusTitle: "Akış hazır",
    statusText: `${params.mode} akışı ${params.concern} odağıyla analiz sonucuna güvenli şekilde bağlanabilir.`,
    nextSteps: ["Analiz sonucuna geç.", "Ürünleri göster.", "Rutini gerekiyorsa aç."],
  };
}
