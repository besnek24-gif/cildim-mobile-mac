#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_force_scan_visibility_pack_v43_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v43 local_demo_data

cp app/index.tsx "backups/ecz4_v43/index_before_v43_force_$STAMP.tsx" 2>/dev/null || true
cp app/_layout.tsx "backups/ecz4_v43/layout_before_v43_force_$STAMP.tsx" 2>/dev/null || true

V42=$(ls -t stable_snapshots/ECZ4_PRE_TEST_HARDENING_PACK_V42_PASS_*.tar.gz | head -1)
echo "RESTORE_FROM=$V42" | tee "$REPORT_DIR/summary.txt"
tar -xzf "$V42" app local_demo_data

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
  const status =
    params.quality === "İyi"
      ? "Görsel kalitesi demo akış için uygun görünüyor."
      : params.quality === "Orta"
        ? "Görsel kalitesi kabul edilebilir; sonuç dili temkinli tutulmalı."
        : "Görsel kalitesi düşük; kullanıcıya yeniden deneme veya manuel akış önerilmeli.";

  return {
    title: "Güvenli tarama önizlemesi",
    status,
    summary: "Bu sürüm gerçek görsel işleme yapmaz; tarama deneyiminin ekran akışını ve yönlendirme mantığını test eder.",
    checklist: [
      `Akış tipi: ${params.mode}`,
      `Kalite: ${params.quality}`,
      `Öncelikli endişe: ${params.concern}`,
      `Cilt hissi: ${params.feel}`,
      `Rutin seviyesi: ${params.level}`,
    ],
    nextConcern: params.concern,
    nextFeel: params.feel,
    nextLevel: params.level,
  };
}
TS

python3 - <<'PY'
from pathlib import Path
import re

p = Path("app/index.tsx")
s = p.read_text()

s = s.replace("ECZ4_PRE_TEST_HARDENING_PACK_V42", "ECZ4_SCAN_VISIBILITY_PACK_V43")
s = s.replace("Test hazırlık paketi", "Tarama görünürlüğü paketi")
s = s.replace("V42", "V43")
s = s.replace("Test öncesi ana akışlar tek pakette toplandı.", "Tara ekranı artık daha belirgin seçim kartlarıyla okunur.")
s = s.replace(
    "Ürün, rutin, analiz, tarama, karar rehberi ve güvenli boş ekran katmanları test için hazırlandı.",
    "Tara bölümündeki seçimler büyütüldü; seçili akış, kalite, endişe ve cilt hissi açıkça görünür."
)

# ScreenKey'e scan yoksa ekle
s = s.replace(
    'type ScreenKey = "home" | "products" | "routine" | "analysis" | "compare" | "profile";',
    'type ScreenKey = "home" | "products" | "routine" | "analysis" | "scan" | "compare" | "profile";'
)

# scan import yoksa ekle
if 'from "../local_demo_data/scan_v40"' not in s:
    s = s.replace(
        'import {\n  ROUTINE_LEVELS,\n  SKIN_FEELS,\n  type RoutineLevel,\n  type SkinFeel,\n  buildAnalysisResultV39,\n} from "../local_demo_data/analysis_v39";',
        'import {\n  ROUTINE_LEVELS,\n  SKIN_FEELS,\n  type RoutineLevel,\n  type SkinFeel,\n  buildAnalysisResultV39,\n} from "../local_demo_data/analysis_v39";\nimport {\n  SCAN_ENTRY_MODES,\n  SCAN_QUALITY_LEVELS,\n  type ScanEntryMode,\n  type ScanQuality,\n  buildScanPreviewV40,\n} from "../local_demo_data/scan_v40";'
    )

# scan state yoksa ekle
if "const [scanMode, setScanMode]" not in s:
    s = s.replace(
        'const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");',
        'const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");\n  const [scanMode, setScanMode] = useState<ScanEntryMode>("Demo tarama");\n  const [scanQuality, setScanQuality] = useState<ScanQuality>("İyi");'
    )

# scanPreview yoksa ekle
if "const scanPreview = useMemo(" not in s:
    s = s.replace(
        'const analysis = useMemo(\n    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),\n    [concern, skinFeel, routineLevel],\n  );',
        'const analysis = useMemo(\n    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),\n    [concern, skinFeel, routineLevel],\n  );\n  const scanPreview = useMemo(\n    () => buildScanPreviewV40({ mode: scanMode, quality: scanQuality, concern, feel: skinFeel, level: routineLevel }),\n    [scanMode, scanQuality, concern, skinFeel, routineLevel],\n  );'
    )

# bottom nav Tara yoksa ekle
if 'label="Tara"' not in s:
    s = s.replace(
        '<NavButton label="Analiz" active={screen === "analysis"} onPress={() => go("analysis")} />\n          <NavButton label="Profil" active={screen === "profile"} onPress={() => go("profile")} />',
        '<NavButton label="Analiz" active={screen === "analysis"} onPress={() => go("analysis")} />\n          <NavButton label="Tara" active={screen === "scan"} onPress={() => go("scan")} />\n          <NavButton label="Profil" active={screen === "profile"} onPress={() => go("profile")} />'
    )

# Home kartı yoksa ekle
if 'title="Cilt Taraması"' not in s:
    s = s.replace(
        '<ModuleCard title="Cilt Analizi" text="Endişe, his ve rutin seviyesiyle demo analiz." onPress={() => go("analysis")} />',
        '<ModuleCard title="Cilt Analizi" text="Endişe, his ve rutin seviyesiyle demo analiz." onPress={() => go("analysis")} />\n              <ModuleCard title="Cilt Taraması" text="Büyük seçim kartlarıyla güvenli tarama akışı." onPress={() => go("scan")} />'
    )

scan_block = '''        {screen === "scan" && (
          <View style={styles.detailCard}>
            <Header title="Cilt Taraması" badge="V43" />
            <Text style={styles.detailSubtitle}>
              Bu ekran gerçek görsel işleme yapmadan tarama deneyimini, seçim görünürlüğünü ve sonuç yönlendirmesini test eder.
            </Text>

            <View style={styles.scanSelectionSummary}>
              <Text style={styles.scanSelectionTitle}>Seçili tarama ayarları</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Akış</Text>
                <Text style={styles.summaryValue}>{scanMode}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Kalite</Text>
                <Text style={styles.summaryValue}>{scanQuality}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Endişe</Text>
                <Text style={styles.summaryValue}>{concern}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cilt hissi</Text>
                <Text style={styles.summaryValue}>{skinFeel}</Text>
              </View>
            </View>

            <Text style={styles.bigChoiceLabel}>1. Akış tipini seç</Text>
            <View style={styles.choiceGrid}>
              {SCAN_ENTRY_MODES.map((item) => (
                <ScanChoiceCard
                  key={item}
                  label={item}
                  description="Tarama deneyiminin nasıl başlayacağını belirler."
                  active={scanMode === item}
                  onPress={() => setScanMode(item)}
                />
              ))}
            </View>

            <Text style={styles.bigChoiceLabel}>2. Görsel kalite durumunu seç</Text>
            <View style={styles.choiceGrid}>
              {SCAN_QUALITY_LEVELS.map((item) => (
                <ScanChoiceCard
                  key={item}
                  label={item}
                  description="Sonuç dilinin ne kadar temkinli olacağını belirler."
                  active={scanQuality === item}
                  onPress={() => setScanQuality(item)}
                />
              ))}
            </View>

            <Text style={styles.bigChoiceLabel}>3. Ana cilt endişesini seç</Text>
            <View style={styles.choiceGrid}>
              {CONCERNS.map((item) => (
                <ScanChoiceCard
                  key={item}
                  label={item}
                  description="Ürün ve analiz yönlendirmesini etkiler."
                  active={concern === item}
                  onPress={() => setConcern(item)}
                />
              ))}
            </View>

            <Text style={styles.bigChoiceLabel}>4. Cilt hissini seç</Text>
            <View style={styles.choiceGrid}>
              {SKIN_FEELS.map((item) => (
                <ScanChoiceCard
                  key={item}
                  label={item}
                  description="Analiz özetindeki dili belirginleştirir."
                  active={skinFeel === item}
                  onPress={() => setSkinFeel(item)}
                />
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

# Mevcut scan bloğu varsa değiştir; yoksa compare/profile öncesine ekle
pattern = re.compile(r'        \{screen === "scan" && \(\n.*?\n        \)}\n\n', re.DOTALL)
s2, count = pattern.subn(scan_block, s, count=1)
if count == 0:
    anchor = '        {screen === "compare" && ('
    if anchor not in s:
        anchor = '        {screen === "profile" && ('
    if anchor not in s:
        print("scan bloğu eklemek için compare/profile anchor bulunamadı")
        raise SystemExit(1)
    s2 = s.replace(anchor, scan_block + anchor, 1)
s = s2

# Component ekle
if "function ScanChoiceCard" not in s:
    s = s.replace(
        'function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {',
        '''function ScanChoiceCard({
  label,
  description,
  active,
  onPress,
}: {
  label: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.scanChoiceCard, active && styles.scanChoiceCardActive]} onPress={onPress}>
      <Text style={[styles.scanChoiceTitle, active && styles.scanChoiceTitleActive]}>{label}</Text>
      <Text style={[styles.scanChoiceText, active && styles.scanChoiceTextActive]}>{description}</Text>
      <Text style={[styles.scanChoiceStatus, active && styles.scanChoiceTitleActive]}>
        {active ? "Seçili" : "Seç"}
      </Text>
    </Pressable>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {'''
    )

# Style ekle
if "scanChoiceCard" not in s:
    s = s.replace(
        'smallLabel: { marginTop: 15, marginLeft: 2, fontSize: 12, fontWeight: "900", color: "#6F746C" },',
        '''scanSelectionSummary: { marginTop: 16, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },
  scanSelectionTitle: { fontSize: 16, fontWeight: "900", color: "#26342A", marginBottom: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  summaryLabel: { fontSize: 12, fontWeight: "900", color: "#6F746C" },
  summaryValue: { flex: 1, textAlign: "right", fontSize: 12, fontWeight: "900", color: "#26342A" },
  bigChoiceLabel: { marginTop: 18, marginLeft: 2, fontSize: 15, fontWeight: "900", color: "#26342A" },
  choiceGrid: { marginTop: 10, gap: 10 },
  scanChoiceCard: { borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, borderWidth: 1, borderColor: "rgba(107,122,106,0.16)" },
  scanChoiceCardActive: { backgroundColor: "#2F3A31", borderColor: "#2F3A31" },
  scanChoiceTitle: { fontSize: 16, fontWeight: "900", color: "#26342A", marginBottom: 5 },
  scanChoiceTitleActive: { color: "#FFFFFF" },
  scanChoiceText: { fontSize: 12, lineHeight: 18, color: "#6F746C" },
  scanChoiceTextActive: { color: "#DCE3DB" },
  scanChoiceStatus: { marginTop: 8, fontSize: 12, fontWeight: "900", color: "#9A642C" },
  wideSoftButton: { marginTop: 12, borderRadius: 999, backgroundColor: "#F4E9D8", paddingVertical: 13, alignItems: "center" },
  wideSoftButtonText: { color: "#9A642C", fontWeight: "900", fontSize: 14 },
  smallLabel: { marginTop: 15, marginLeft: 2, fontSize: 12, fontWeight: "900", color: "#6F746C" },'''
    )

# scan summary style yoksa ekle
if "scanSummary" not in s:
    s = s.replace(
        'resultSummary: { fontSize: 13, lineHeight: 19, color: "#5D665C" },',
        'resultSummary: { fontSize: 13, lineHeight: 19, color: "#5D665C" },\n  scanSummary: { marginTop: 8, fontSize: 13, lineHeight: 19, color: "#5D665C", fontWeight: "700" },'
    )

p.write_text(s)
print("V43 force scan visibility tamamlandı.")
PY

{
echo "=== V43 FORCE SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_SCAN_VISIBILITY_PACK_V43" app local_demo_data

echo ""
echo "=== SCAN PRESENCE CHECK ==="
grep -RIn 'screen === "scan"|ScanChoiceCard|scanSelectionSummary' app/index.tsx

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
rm -rf "dist/ecz4_force_scan_visibility_pack_v43_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_force_scan_visibility_pack_v43_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_force_scan_visibility_pack_v43_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_SCAN_VISIBILITY_PACK_V43" "$BUNDLE"
echo "PASS: V43 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_FORCE_SCAN_VISIBILITY_PACK_V43_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 force scan visibility pack v43 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_FORCE_SCAN_VISIBILITY_PACK_V43_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
