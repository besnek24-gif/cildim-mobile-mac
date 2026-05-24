#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_v53_premium_scan_analysis_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v53_premium_scan

cp app/index.tsx "backups/ecz4_v53_premium_scan/index_before_v53_$STAMP.tsx"
cp -R local_demo_data "backups/ecz4_v53_premium_scan/local_demo_data_before_v53_$STAMP"

cat > local_demo_data/premium_scan_analysis_v53.ts <<'TS'
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
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_LOCAL_STATE_FAVORITES_V52" not in s:
    print("V52 marker bulunamadı. Önce V52 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_LOCAL_STATE_FAVORITES_V52", "ECZ4_PREMIUM_SCAN_ANALYSIS_V53")
s = s.replace(
    "Bu sürüm favori, son bakılan ürün ve rutin kaydı simülasyonuyla daha gerçek uygulama hissi verir.",
    "Bu sürüm analiz ve tarama ekranlarını premium/klinik sonuç panelleriyle güçlendirir."
)

if 'from "../local_demo_data/premium_scan_analysis_v53"' not in s:
    marker = 'import {\n  buildFavoriteProductsV52,\n  buildLocalStateSummaryV52,\n  buildRecentProductsV52,\n} from "../local_demo_data/local_state_v52";'
    add = marker + '\nimport {\n  buildPremiumAnalysisV53,\n  buildPremiumScanResultV53,\n} from "../local_demo_data/premium_scan_analysis_v53";'
    s = s.replace(marker, add)

if "premiumAnalysis" not in s:
    s = s.replace(
        '''const analysis = useMemo(
    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),
    [concern, skinFeel, routineLevel],
  );''',
        '''const analysis = useMemo(
    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),
    [concern, skinFeel, routineLevel],
  );
  const premiumAnalysis = useMemo(
    () => buildPremiumAnalysisV53({ concern, feel: skinFeel, level: routineLevel }),
    [concern, skinFeel, routineLevel],
  );'''
    )

if "premiumScanResult" not in s:
    s = s.replace(
        '''const scanPreview = useMemo(
    () => buildScanPreviewV40({
      mode: scanMode,
      quality: scanQuality,
      concern,
      feel: skinFeel,
      level: routineLevel,
    }),
    [scanMode, scanQuality, concern, skinFeel, routineLevel],
  );''',
        '''const scanPreview = useMemo(
    () => buildScanPreviewV40({
      mode: scanMode,
      quality: scanQuality,
      concern,
      feel: skinFeel,
      level: routineLevel,
    }),
    [scanMode, scanQuality, concern, skinFeel, routineLevel],
  );
  const premiumScanResult = useMemo(
    () => buildPremiumScanResultV53({ mode: scanMode, quality: scanQuality, concern, feel: skinFeel }),
    [scanMode, scanQuality, concern, skinFeel],
  );'''
    )

# Pass props
s = s.replace(
    '''analysis={analysis}
              setScreen={setScreen}''',
    '''analysis={analysis}
              premiumAnalysis={premiumAnalysis}
              setScreen={setScreen}'''
)

s = s.replace(
    '''scanPreview={scanPreview}
              setScreen={setScreen}''',
    '''scanPreview={scanPreview}
              premiumScanResult={premiumScanResult}
              setScreen={setScreen}'''
)

# AnalysisScreen signature
s = s.replace(
    '''  analysis,
  setScreen,
}: {
  concern: Concern;
  setConcern: (value: Concern) => void;
  skinFeel: SkinFeel;
  setSkinFeel: (value: SkinFeel) => void;
  routineLevel: RoutineLevel;
  setRoutineLevel: (value: RoutineLevel) => void;
  analysis: ReturnType<typeof buildAnalysisResultV39>;
  setScreen: (screen: ScreenKey) => void;
}) {''',
    '''  analysis,
  premiumAnalysis,
  setScreen,
}: {
  concern: Concern;
  setConcern: (value: Concern) => void;
  skinFeel: SkinFeel;
  setSkinFeel: (value: SkinFeel) => void;
  routineLevel: RoutineLevel;
  setRoutineLevel: (value: RoutineLevel) => void;
  analysis: ReturnType<typeof buildAnalysisResultV39>;
  premiumAnalysis: ReturnType<typeof buildPremiumAnalysisV53>;
  setScreen: (screen: ScreenKey) => void;
}) {'''
)

# Analysis premium block after intro
if "premiumScorePanel" not in s:
    s = s.replace(
        '''      <ScreenIntro
        badge="Analiz"
        title="Cilt analizi"
        text="Cilt hissi, endişe ve rutin seviyesine göre demo analiz sonucu üret."
      />''',
        '''      <ScreenIntro
        badge="Analiz"
        title="Cilt analizi"
        text="Cilt hissi, endişe ve rutin seviyesine göre demo analiz sonucu üret."
      />

      <View style={styles.premiumScorePanel}>
        <View style={styles.premiumScoreTop}>
          <View>
            <Text style={styles.premiumKicker}>{premiumAnalysis.profileLabel}</Text>
            <Text style={styles.premiumTitle}>{premiumAnalysis.title}</Text>
          </View>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreCircleValue}>{premiumAnalysis.score}</Text>
            <Text style={styles.scoreCircleLabel}>skor</Text>
          </View>
        </View>

        <Text style={styles.premiumExplanation}>{premiumAnalysis.explanation}</Text>

        <View style={styles.metricGrid}>
          {premiumAnalysis.metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCardV53}>
              <Text style={styles.metricValueV53}>{metric.value}</Text>
              <Text style={styles.metricLabelV53}>{metric.label}</Text>
              <Text style={styles.metricNoteV53}>{metric.note}</Text>
            </View>
          ))}
        </View>

        <View style={styles.nextActionCard}>
          <Text style={styles.nextActionLabel}>En iyi sonraki adım</Text>
          <Text style={styles.nextActionText}>{premiumAnalysis.nextBestAction}</Text>
        </View>
      </View>'''
    )

# ScanScreen signature
s = s.replace(
    '''  scanPreview,
  setScreen,
}: {
  scanMode: ScanEntryMode;
  setScanMode: (value: ScanEntryMode) => void;
  scanQuality: ScanQuality;
  setScanQuality: (value: ScanQuality) => void;
  concern: Concern;
  setConcern: (value: Concern) => void;
  skinFeel: SkinFeel;
  setSkinFeel: (value: SkinFeel) => void;
  scanPreview: ReturnType<typeof buildScanPreviewV40>;
  setScreen: (screen: ScreenKey) => void;
}) {''',
    '''  scanPreview,
  premiumScanResult,
  setScreen,
}: {
  scanMode: ScanEntryMode;
  setScanMode: (value: ScanEntryMode) => void;
  scanQuality: ScanQuality;
  setScanQuality: (value: ScanQuality) => void;
  concern: Concern;
  setConcern: (value: Concern) => void;
  skinFeel: SkinFeel;
  setSkinFeel: (value: SkinFeel) => void;
  scanPreview: ReturnType<typeof buildScanPreviewV40>;
  premiumScanResult: ReturnType<typeof buildPremiumScanResultV53>;
  setScreen: (screen: ScreenKey) => void;
}) {'''
)

# Scan premium block after intro
if "scanTimelinePanel" not in s:
    s = s.replace(
        '''      <ScreenIntro
        badge="Tara"
        title="Cilt taraması"
        text="Gerçek kamera açmadan, tarama deneyimini ve yönlendirme akışını test et."
      />''',
        '''      <ScreenIntro
        badge="Tara"
        title="Cilt taraması"
        text="Gerçek görüntü işleme açmadan, tarama deneyimini ve yönlendirme akışını test et."
      />

      <View style={styles.scanTimelinePanel}>
        <Text style={styles.premiumKicker}>{premiumScanResult.qualityLabel}</Text>
        <Text style={styles.premiumTitle}>{premiumScanResult.title}</Text>
        <Text style={styles.scanConfidence}>{premiumScanResult.confidence}</Text>

        <View style={styles.timelineList}>
          {premiumScanResult.steps.map((step) => (
            <View key={step.step} style={styles.timelineItem}>
              <View style={styles.timelineDot}>
                <Text style={styles.timelineDotText}>{step.step}</Text>
              </View>
              <View style={styles.timelineTextBox}>
                <Text style={styles.timelineTitle}>{step.title}</Text>
                <Text style={styles.timelineText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.scanRecommendationBox}>
          <Text style={styles.nextActionLabel}>Tarama sonrası öneri</Text>
          {premiumScanResult.recommendations.map((item) => (
            <Text key={item} style={styles.scanRecommendationText}>• {item}</Text>
          ))}
        </View>
      </View>'''
    )

# Styles
if "premiumScorePanel" not in s:
    style_anchor = "  footerCard: {"
    style_block = '''  premiumScorePanel: {
    borderRadius: 30,
    backgroundColor: "#243428",
    padding: 22,
  },
  premiumScoreTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
  },
  premiumKicker: {
    color: "#D6C1A0",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  premiumTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  scoreCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#FFF6EA",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleValue: {
    color: "#243428",
    fontSize: 26,
    fontWeight: "900",
  },
  scoreCircleLabel: {
    color: "#8A5A28",
    fontSize: 11,
    fontWeight: "900",
  },
  premiumExplanation: {
    color: "#DCE4DB",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    fontWeight: "700",
  },
  metricGrid: {
    gap: 10,
    marginTop: 16,
  },
  metricCardV53: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: 14,
  },
  metricValueV53: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  metricLabelV53: {
    color: "#D6C1A0",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },
  metricNoteV53: {
    color: "#DCE4DB",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    fontWeight: "700",
  },
  nextActionCard: {
    borderRadius: 20,
    backgroundColor: "#FFF6EA",
    padding: 14,
    marginTop: 14,
  },
  nextActionLabel: {
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },
  nextActionText: {
    color: "#243428",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
  },
  scanTimelinePanel: {
    borderRadius: 30,
    backgroundColor: "#243428",
    padding: 22,
  },
  scanConfidence: {
    color: "#FFF6EA",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
  },
  timelineList: {
    gap: 12,
    marginTop: 16,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: 12,
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF6EA",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotText: {
    color: "#243428",
    fontWeight: "900",
  },
  timelineTextBox: {
    flex: 1,
  },
  timelineTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  timelineText: {
    color: "#DCE4DB",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: "700",
  },
  scanRecommendationBox: {
    borderRadius: 20,
    backgroundColor: "#FFF6EA",
    padding: 14,
    marginTop: 14,
  },
  scanRecommendationText: {
    color: "#243428",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 3,
  },
'''
    s = s.replace(style_anchor, style_block + style_anchor)

p.write_text(s)
print("V53 premium scan analysis patch uygulandı.")
PY

{
echo "=== V53 SOURCE CHECK ==="
grep -RIn "ECZ4_PREMIUM_SCAN_ANALYSIS_V53" app local_demo_data
grep -RInE "premium_scan_analysis_v53|premiumScorePanel|scanTimelinePanel|buildPremiumAnalysisV53|buildPremiumScanResultV53" app local_demo_data

echo ""
echo "=== OLD APP TRACE CHECK ==="
if grep -RInE "AuthProvider|UserPreferencesProvider|react-native-keyboard-controller|premium-skin-scan-v2|skin-intelligence|ProductCard|@supabase|Supabase|Feather|Ionicons|expo-camera|AsyncStorage|zustand" app local_demo_data --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "FAIL: Eski app izi aktif kaynakta bulundu."
  exit 1
else
  echo "PASS: Aktif kaynakta eski app izi yok."
fi

echo ""
echo "=== EXPO DOCTOR ==="
npx -y expo-doctor@latest

echo ""
echo "=== IOS EXPORT ==="
rm -rf "dist/ecz4_v53_premium_scan_analysis_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_v53_premium_scan_analysis_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_v53_premium_scan_analysis_$STAMP" -type f -name "*.js" | head -1)
if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"
grep -q "ECZ4_PREMIUM_SCAN_ANALYSIS_V53" "$BUNDLE"
echo "PASS: V53 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_PREMIUM_SCAN_ANALYSIS_V53_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 premium scan analysis v53 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_PREMIUM_SCAN_ANALYSIS_V53_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
