#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_analysis_scan_polish_pack_v46_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v46 local_demo_data

cp app/index.tsx "backups/ecz4_v46/index_before_v46_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v46/layout_before_v46_$STAMP.tsx"
cp local_demo_data/*.ts "backups/ecz4_v46/" 2>/dev/null || true

cat > local_demo_data/analysis_scan_polish_v46.ts <<'TS'
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
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_ROUTINE_SCREEN_POLISH_PACK_V45" not in s:
    print("V45 marker bulunamadı. Önce V45 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_ROUTINE_SCREEN_POLISH_PACK_V45", "ECZ4_ANALYSIS_SCAN_POLISH_PACK_V46")
s = s.replace("Rutin ekranı parlatma paketi", "Analiz ve tarama sonuç paketi")
s = s.replace(
    "Sabah-akşam rutin planı daha okunur, kartlı ve yönlendirici hale getirildi.",
    "Analiz ve tarama sonuçları daha görünür, yönlendirici ve karar verdirici hale getirildi."
)
s = s.replace('<StatusCard value="V45" label="Rutin ekranı" />', '<StatusCard value="V46" label="Analiz/Tara" />')
s = s.replace("V45 durumu", "V46 durumu")
s = s.replace(
    "Rutin ekranı artık sabah-akşam plan, ipucu ve ürün adımlarıyla daha belirgin.",
    "Analiz ve tarama sonuç ekranları artık daha net yönlendirme kartları içerir."
)
s = s.replace(
    "Rutin ekranında seçili endişeye göre amaç, ürünler, ipuçları ve adım özeti birlikte görünür.",
    "Analiz sonucu, tarama kalitesi, ürün önerisi ve rutin yönlendirmesi tek karar hattı gibi görünür."
)

if 'from "../local_demo_data/analysis_scan_polish_v46"' not in s:
    s = s.replace(
        'import {\n  buildRoutinePlanV45,\n} from "../local_demo_data/routine_plan_v45";',
        'import {\n  buildRoutinePlanV45,\n} from "../local_demo_data/routine_plan_v45";\nimport {\n  buildAnalysisPolishV46,\n  buildScanPolishV46,\n} from "../local_demo_data/analysis_scan_polish_v46";'
    )

if "const analysisPolish = useMemo(" not in s:
    s = s.replace(
        'const analysis = useMemo(\n    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),\n    [concern, skinFeel, routineLevel],\n  );',
        'const analysis = useMemo(\n    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),\n    [concern, skinFeel, routineLevel],\n  );\n  const analysisPolish = useMemo(\n    () => buildAnalysisPolishV46({ concern, feel: skinFeel, level: routineLevel, productCount: analysis.products.length }),\n    [concern, skinFeel, routineLevel, analysis.products.length],\n  );'
    )

if "const scanPolish = useMemo(" not in s:
    s = s.replace(
        'const scanPreview = useMemo(\n    () => buildScanPreviewV40({ mode: scanMode, quality: scanQuality, concern, feel: skinFeel, level: routineLevel }),\n    [scanMode, scanQuality, concern, skinFeel, routineLevel],\n  );',
        'const scanPreview = useMemo(\n    () => buildScanPreviewV40({ mode: scanMode, quality: scanQuality, concern, feel: skinFeel, level: routineLevel }),\n    [scanMode, scanQuality, concern, skinFeel, routineLevel],\n  );\n  const scanPolish = useMemo(\n    () => buildScanPolishV46({ mode: scanMode, quality: scanQuality, concern }),\n    [scanMode, scanQuality, concern],\n  );'
    )

old_analysis_box = '''            <View style={styles.analysisResultBox}>
              <Text style={styles.resultTitle}>{analysis.title}</Text>
              <Text style={styles.resultSummary}>{analysis.summary}</Text>
            </View>'''

new_analysis_box = '''            <View style={styles.analysisResultBox}>
              <Text style={styles.resultTitle}>{analysis.title}</Text>
              <Text style={styles.resultSummary}>{analysis.summary}</Text>
              <View style={styles.resultDivider} />
              <Text style={styles.resultBadgeText}>{analysisPolish.confidence}</Text>
              <Text style={styles.resultHeadline}>{analysisPolish.headline}</Text>
            </View>

            <View style={styles.actionGuideBox}>
              <Text style={styles.actionGuideTitle}>Sonraki adım rehberi</Text>
              {analysisPolish.nextActions.map((item) => (
                <Text key={item} style={styles.actionGuideText}>• {item}</Text>
              ))}
              <Text style={styles.pharmacistNote}>{analysisPolish.pharmacistNote}</Text>
            </View>'''

if old_analysis_box not in s:
    print("Analiz sonuç kutusu bulunamadı.")
    raise SystemExit(1)
s = s.replace(old_analysis_box, new_analysis_box, 1)

old_scan_box = '''            <View style={styles.scanPreviewBox}>
              <Text style={styles.resultTitle}>{scanPreview.title}</Text>
              <Text style={styles.resultSummary}>{scanPreview.status}</Text>
              <Text style={styles.scanSummary}>{scanPreview.summary}</Text>
            </View>'''

new_scan_box = '''            <View style={styles.scanPreviewBox}>
              <Text style={styles.resultTitle}>{scanPreview.title}</Text>
              <Text style={styles.resultSummary}>{scanPreview.status}</Text>
              <Text style={styles.scanSummary}>{scanPreview.summary}</Text>
              <View style={styles.resultDivider} />
              <Text style={styles.resultBadgeText}>{scanPolish.statusTitle}</Text>
              <Text style={styles.scanSummary}>{scanPolish.statusText}</Text>
            </View>

            <View style={styles.actionGuideBox}>
              <Text style={styles.actionGuideTitle}>Tarama sonrası yapılacaklar</Text>
              {scanPolish.nextSteps.map((item) => (
                <Text key={item} style={styles.actionGuideText}>• {item}</Text>
              ))}
            </View>'''

if old_scan_box not in s:
    print("Tarama sonuç kutusu bulunamadı.")
    raise SystemExit(1)
s = s.replace(old_scan_box, new_scan_box, 1)

if "actionGuideBox" not in s:
    s = s.replace(
        'analysisResultBox: { marginTop: 18, borderRadius: 22, backgroundColor: "#F4E9D8", padding: 16 },',
        '''analysisResultBox: { marginTop: 18, borderRadius: 22, backgroundColor: "#F4E9D8", padding: 16 },
  resultDivider: { height: 1, backgroundColor: "rgba(154,100,44,0.20)", marginVertical: 12 },
  resultBadgeText: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 5 },
  resultHeadline: { fontSize: 14, lineHeight: 20, fontWeight: "900", color: "#26342A" },
  actionGuideBox: { marginTop: 14, borderRadius: 20, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },
  actionGuideTitle: { fontSize: 15, fontWeight: "900", color: "#26342A", marginBottom: 8 },
  actionGuideText: { fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "700" },
  pharmacistNote: { marginTop: 10, fontSize: 12, lineHeight: 18, color: "#9A642C", fontWeight: "900" },'''
    )

p.write_text(s)
print("V46 analysis + scan polish patch uygulandı.")
PY

{
echo "=== V46 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_ANALYSIS_SCAN_POLISH_PACK_V46" app local_demo_data

echo ""
echo "=== ANALYSIS / SCAN POLISH PRESENCE CHECK ==="
grep -RInE 'analysis_scan_polish_v46|buildAnalysisPolishV46|buildScanPolishV46|analysisPolish|scanPolish|actionGuideBox' app local_demo_data

echo ""
echo "=== OLD APP TRACE CHECK ==="
if grep -RInE "AuthProvider|UserPreferencesProvider|react-native-keyboard-controller|premium-skin-scan-v2|skin-intelligence|ProductCard|@supabase|Supabase|Feather|Ionicons|expo-camera|AsyncStorage|zustand" app local_demo_data --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "FAIL: Source içinde eski app token bulundu."
  exit 1
else
  echo "PASS: Source içinde eski app token yok."
fi

echo ""
echo "=== EXPO DOCTOR ==="
npx -y expo-doctor@latest

echo ""
echo "=== IOS EXPORT ==="
rm -rf "dist/ecz4_analysis_scan_polish_pack_v46_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_analysis_scan_polish_pack_v46_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_analysis_scan_polish_pack_v46_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_ANALYSIS_SCAN_POLISH_PACK_V46" "$BUNDLE"
echo "PASS: V46 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_ANALYSIS_SCAN_POLISH_PACK_V46_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 analysis scan polish pack v46 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_ANALYSIS_SCAN_POLISH_PACK_V46_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
