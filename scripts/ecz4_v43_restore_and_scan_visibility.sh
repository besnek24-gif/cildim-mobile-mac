#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_scan_visibility_pack_v43_restore_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v43 local_demo_data

cp app/index.tsx "backups/ecz4_v43/index_before_v43_restore_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v43/layout_before_v43_restore_$STAMP.tsx"

V42=$(ls -t stable_snapshots/ECZ4_PRE_TEST_HARDENING_PACK_V42_PASS_*.tar.gz | head -1)
echo "RESTORE_FROM=$V42" | tee "$REPORT_DIR/summary.txt"
tar -xzf "$V42" app local_demo_data

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_PRE_TEST_HARDENING_PACK_V42" not in s:
    print("V42 marker bulunamadı. Restore başarısız olabilir.")
    raise SystemExit(1)

s = s.replace("ECZ4_PRE_TEST_HARDENING_PACK_V42", "ECZ4_SCAN_VISIBILITY_PACK_V43")
s = s.replace("Test hazırlık paketi", "Tarama görünürlüğü paketi")
s = s.replace(
    "Ürün, rutin, analiz, tarama, karar rehberi ve güvenli boş ekran katmanları test için hazırlandı.",
    "Tara bölümündeki seçimler büyütüldü; seçili akış, kalite, endişe ve cilt hissi açıkça görünür."
)
s = s.replace('<StatusCard value="V42" label="Test paketi" />', '<StatusCard value="V43" label="Tara görünür" />')
s = s.replace("V42 durumu", "V43 durumu")
s = s.replace("Test öncesi ana akışlar tek pakette toplandı.", "Tara ekranı artık daha belirgin seçim kartlarıyla okunur.")
s = s.replace(
    "Yerel ürün motoru, analiz, rutin, tarama önizlemesi, karar rehberi ve boş ekran koruması tek akışta çalışır.",
    "Tara ekranındaki akış tipi, kalite, endişe ve cilt hissi seçimleri büyük kartlarla gösterilir."
)

scan_block = '''        {screen === "scan" && (
          <View style={styles.detailCard}>
            <Header title="Cilt Taraması" badge="V43" />
            <Text style={styles.detailSubtitle}>
              Bu ekran gerçek görsel işleme yapmadan tarama deneyimini, seçim görünürlüğünü ve sonuç yönlendirmesini test eder.
            </Text>

            <GuardNotice text={SAFE_FLOW_NOTICES.scan} />

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

lines = s.splitlines()
start = None
for i, line in enumerate(lines):
    if '{screen === "scan" && (' in line:
        start = i
        break

if start is None:
    print("scan başlangıcı bulunamadı")
    raise SystemExit(1)

end = None
for j in range(start + 1, len(lines)):
    if lines[j].startswith('        {screen === "compare" && (') or lines[j].startswith('        {screen === "profile" && ('):
        end = j
        break

if end is None:
    print("scan sonrası compare/profile bloğu bulunamadı")
    for n in range(max(0, start - 5), min(len(lines), start + 120)):
        print(f"{n+1}: {lines[n]}")
    raise SystemExit(1)

new_lines = lines[:start] + scan_block.rstrip("\\n").splitlines() + lines[end:]
s = "\\n".join(new_lines) + "\\n"

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
  smallLabel: { marginTop: 15, marginLeft: 2, fontSize: 12, fontWeight: "900", color: "#6F746C" },'''
    )

p.write_text(s)
print("V43 restore + scan visibility patch tamam.")
PY

{
echo "=== V43 RESTORE SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_SCAN_VISIBILITY_PACK_V43" app local_demo_data

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
rm -rf "dist/ecz4_scan_visibility_pack_v43_restore_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_scan_visibility_pack_v43_restore_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_scan_visibility_pack_v43_restore_$STAMP" -type f -name "*.js" | head -1)

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

tar -czf "stable_snapshots/ECZ4_SCAN_VISIBILITY_PACK_V43_RESTORE_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 scan visibility pack v43 restore kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_SCAN_VISIBILITY_PACK_V43_RESTORE_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
