#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_safe_scan_placeholder_pack_v40_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v40 local_demo_data

cp app/index.tsx "backups/ecz4_v40/index_before_v40_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v40/layout_before_v40_$STAMP.tsx"
cp local_demo_data/products_v37.ts "backups/ecz4_v40/products_v37_before_v40_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/decision_v38.ts "backups/ecz4_v40/decision_v38_before_v40_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/analysis_v39.ts "backups/ecz4_v40/analysis_v39_before_v40_$STAMP.ts" 2>/dev/null || true

cat > local_demo_data/scan_v40.ts <<'TS'
import { type Concern } from "./products_v37";
import { type RoutineLevel, type SkinFeel } from "./analysis_v39";

export type ScanEntryMode = "Demo tarama" | "Fotoğraf seçimi" | "Manuel değerlendirme";
export type ScanQuality = "İyi" | "Orta" | "Yetersiz";

export type ScanPreviewV40 = {
  title: string;
  status: string;
  summary: string;
  checklist: string[];
  nextConcern: Concern;
  nextFeel: SkinFeel;
  nextLevel: RoutineLevel;
};

export const SCAN_ENTRY_MODES: ScanEntryMode[] = ["Demo tarama", "Fotoğraf seçimi", "Manuel değerlendirme"];
export const SCAN_QUALITY_LEVELS: ScanQuality[] = ["İyi", "Orta", "Yetersiz"];

export function buildScanPreviewV40(params: {
  mode: ScanEntryMode;
  quality: ScanQuality;
  concern: Concern;
  feel: SkinFeel;
  level: RoutineLevel;
}): ScanPreviewV40 {
  const qualityText = params.quality === "İyi"
    ? "Görsel kalitesi demo akış için uygun görünüyor."
    : params.quality === "Orta"
      ? "Görsel kalitesi kabul edilebilir; sonuç dili temkinli tutulmalı."
      : "Görsel kalitesi düşük; kullanıcıya yeniden deneme veya manuel akış önerilmeli.";

  const checklist = [
    `Akış tipi: ${params.mode}`,
    `Kalite: ${params.quality}`,
    `Öncelikli endişe: ${params.concern}`,
    `Cilt hissi: ${params.feel}`,
    `Rutin seviyesi: ${params.level}`,
  ];

  return {
    title: "Güvenli tarama önizlemesi",
    status: qualityText,
    summary: "Bu sürüm gerçek görsel işleme yapmaz; tarama deneyiminin ekran akışını ve yönlendirme mantığını test eder.",
    checklist,
    nextConcern: params.concern,
    nextFeel: params.feel,
    nextLevel: params.level,
  };
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

# Marker / başlık
s = s.replace("ECZ4_SKIN_ANALYSIS_FLOW_PACK_V39", "ECZ4_SAFE_SCAN_PLACEHOLDER_PACK_V40")
s = s.replace("Analiz akışı paketi", "Güvenli tarama akışı")
s = s.replace(
    "Analiz, ürün, rutin ve karar alanları yerel motorla birlikte çalışıyor.",
    "Tarama önizlemesi, analiz, ürün ve rutin akışı yerel motorla birlikte çalışıyor."
)

# Imports
if 'from "../local_demo_data/scan_v40"' not in s:
    s = s.replace(
        'import {\n  ROUTINE_LEVELS,\n  SKIN_FEELS,\n  type RoutineLevel,\n  type SkinFeel,\n  buildAnalysisResultV39,\n} from "../local_demo_data/analysis_v39";',
        'import {\n  ROUTINE_LEVELS,\n  SKIN_FEELS,\n  type RoutineLevel,\n  type SkinFeel,\n  buildAnalysisResultV39,\n} from "../local_demo_data/analysis_v39";\nimport {\n  SCAN_ENTRY_MODES,\n  SCAN_QUALITY_LEVELS,\n  type ScanEntryMode,\n  type ScanQuality,\n  buildScanPreviewV40,\n} from "../local_demo_data/scan_v40";'
    )

# Screen type
s = s.replace(
    'type ScreenKey = "home" | "products" | "routine" | "analysis" | "compare" | "profile";',
    'type ScreenKey = "home" | "products" | "routine" | "analysis" | "scan" | "compare" | "profile";'
)

# State
if 'const [scanMode, setScanMode]' not in s:
    s = s.replace(
        'const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");',
        'const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");\n  const [scanMode, setScanMode] = useState<ScanEntryMode>("Demo tarama");\n  const [scanQuality, setScanQuality] = useState<ScanQuality>("İyi");'
    )

# Scan result memo
if 'const scanPreview = useMemo(' not in s:
    s = s.replace(
        'const analysis = useMemo(\n    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),\n    [concern, skinFeel, routineLevel],\n  );',
        'const analysis = useMemo(\n    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),\n    [concern, skinFeel, routineLevel],\n  );\n  const scanPreview = useMemo(\n    () => buildScanPreviewV40({ mode: scanMode, quality: scanQuality, concern, feel: skinFeel, level: routineLevel }),\n    [scanMode, scanQuality, concern, skinFeel, routineLevel],\n  );'
    )

# Bottom nav add Tara
if 'label="Tara"' not in s:
    s = s.replace(
        '<NavButton label="Analiz" active={screen === "analysis"} onPress={() => go("analysis")} />\n          <NavButton label="Profil" active={screen === "profile"} onPress={() => go("profile")} />',
        '<NavButton label="Analiz" active={screen === "analysis"} onPress={() => go("analysis")} />\n          <NavButton label="Tara" active={screen === "scan"} onPress={() => go("scan")} />\n          <NavButton label="Profil" active={screen === "profile"} onPress={() => go("profile")} />'
    )

# Home status update
s = s.replace('<StatusCard value="V39" label="Analiz akışı" />', '<StatusCard value="V40" label="Tarama akışı" />')
s = s.replace("V39 durumu", "V40 durumu")
s = s.replace(
    "Analiz artık ürün ve rutine bağlanıyor.",
    "Tarama önizlemesi analiz ve öneriye bağlanıyor."
)
s = s.replace(
    "Seçilen endişe, cilt hissi ve rutin seviyesi; analiz sonucunu, ürünleri ve bakım planını etkiler.",
    "Güvenli tarama akışı; endişe, cilt hissi, ürün önerisi ve rutin planını tek hatta bağlar."
)

# Home module add scan
if 'title="Cilt Taraması"' not in s:
    s = s.replace(
        '<ModuleCard title="Cilt Analizi" text="Endişe, his ve rutin seviyesiyle demo analiz." onPress={() => go("analysis")} />',
        '<ModuleCard title="Cilt Analizi" text="Endişe, his ve rutin seviyesiyle demo analiz." onPress={() => go("analysis")} />\n              <ModuleCard title="Cilt Taraması" text="Güvenli tarama önizlemesi ve yönlendirme akışı." onPress={() => go("scan")} />'
    )

# Insert scan screen before compare screen
if 'screen === "scan"' not in s:
    marker = '        {screen === "compare" && ('
    scan_block = r'''        {screen === "scan" && (
          <View style={styles.detailCard}>
            <Header title="Cilt Taraması" badge="V40" />
            <Text style={styles.detailSubtitle}>
              Bu ekran gerçek görsel işleme yapmadan tarama deneyimini, izin dilini ve sonuç yönlendirmesini test eder.
            </Text>

            <Text style={styles.smallLabel}>Akış tipi</Text>
            <View style={styles.chipRow}>
              {SCAN_ENTRY_MODES.map((item) => (
                <Chip key={item} label={item} active={scanMode === item} onPress={() => setScanMode(item)} />
              ))}
            </View>

            <Text style={styles.smallLabel}>Görsel kalite simülasyonu</Text>
            <View style={styles.chipRow}>
              {SCAN_QUALITY_LEVELS.map((item) => (
                <Chip key={item} label={item} active={scanQuality === item} onPress={() => setScanQuality(item)} />
              ))}
            </View>

            <Text style={styles.smallLabel}>Endişe</Text>
            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            <Text style={styles.smallLabel}>Cilt hissi</Text>
            <View style={styles.chipRow}>
              {SKIN_FEELS.map((item) => (
                <Chip key={item} label={item} active={skinFeel === item} onPress={() => setSkinFeel(item)} />
              ))}
            </View>

            <View style={styles.scanPreviewBox}>
              <Text style={styles.resultTitle}>{scanPreview.title}</Text>
              <Text style={styles.resultSummary}>{scanPreview.status}</Text>
              <Text style={styles.scanSummary}>{scanPreview.summary}</Text>
            </View>

            <View style={styles.priorityBox}>
              {scanPreview.checklist.map((line) => (
                <Text key={line} style={styles.priorityText}>• {line}</Text>
              ))}
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.primaryButton} onPress={() => go("analysis")}>
                <Text style={styles.primaryButtonText}>Analiz sonucuna git</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => go("products")}>
                <Text style={styles.secondaryButtonText}>Ürünleri gör</Text>
              </Pressable>
            </View>

            <Pressable style={styles.wideSoftButton} onPress={() => go("routine")}>
              <Text style={styles.wideSoftButtonText}>Bu sonuca göre rutini gör</Text>
            </Pressable>
          </View>
        )}

'''
    s = s.replace(marker, scan_block + marker)

# Footer update
s = s.replace(
    "Bu sürüm gerçek veri, görsel alma, giriş ve eski ağır bileşenleri içermez. Analiz akışı yerel ve izoledir.",
    "Bu sürüm gerçek veri, gerçek görsel işleme, giriş ve eski ağır bileşenleri içermez. Tarama akışı yerel ve izoledir."
)

# Styles add
if "scanPreviewBox" not in s:
    s = s.replace(
        'analysisResultBox: { marginTop: 18, borderRadius: 22, backgroundColor: "#F4E9D8", padding: 16 },',
        'analysisResultBox: { marginTop: 18, borderRadius: 22, backgroundColor: "#F4E9D8", padding: 16 },\n  scanPreviewBox: { marginTop: 18, borderRadius: 22, backgroundColor: "#F4E9D8", padding: 16 },'
    )

if "scanSummary" not in s:
    s = s.replace(
        'resultSummary: { fontSize: 13, lineHeight: 19, color: "#5D665C" },',
        'resultSummary: { fontSize: 13, lineHeight: 19, color: "#5D665C" },\n  scanSummary: { marginTop: 8, fontSize: 13, lineHeight: 19, color: "#5D665C", fontWeight: "700" },'
    )

if "wideSoftButton" not in s:
    s = s.replace(
        'secondaryButtonText: { color: "#9A642C", fontWeight: "900", fontSize: 14 },',
        'secondaryButtonText: { color: "#9A642C", fontWeight: "900", fontSize: 14 },\n  wideSoftButton: { marginTop: 12, borderRadius: 999, backgroundColor: "#F4E9D8", paddingVertical: 13, alignItems: "center" },\n  wideSoftButtonText: { color: "#9A642C", fontWeight: "900", fontSize: 14 },'
    )

p.write_text(s)
print("V40 safe scan placeholder patch uygulandı.")
PY

{
echo "=== V40 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_SAFE_SCAN_PLACEHOLDER_PACK_V40" app local_demo_data

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
rm -rf "dist/ecz4_safe_scan_placeholder_pack_v40_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_safe_scan_placeholder_pack_v40_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_safe_scan_placeholder_pack_v40_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_SAFE_SCAN_PLACEHOLDER_PACK_V40" "$BUNDLE"
echo "PASS: V40 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_SAFE_SCAN_PLACEHOLDER_PACK_V40_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 safe scan placeholder pack v40 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_SAFE_SCAN_PLACEHOLDER_PACK_V40_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
