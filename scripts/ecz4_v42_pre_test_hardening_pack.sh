#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_pre_test_hardening_pack_v42_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v42 local_demo_data

cp app/index.tsx "backups/ecz4_v42/index_before_v42_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v42/layout_before_v42_$STAMP.tsx"
cp local_demo_data/products_v37.ts "backups/ecz4_v42/products_v37_before_v42_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/decision_v38.ts "backups/ecz4_v42/decision_v38_before_v42_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/analysis_v39.ts "backups/ecz4_v42/analysis_v39_before_v42_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/scan_v40.ts "backups/ecz4_v42/scan_v40_before_v42_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/ux_guard_v41.ts "backups/ecz4_v42/ux_guard_v41_before_v42_$STAMP.ts" 2>/dev/null || true

cat > local_demo_data/test_readiness_v42.ts <<'TS'
export const TEST_SUMMARY_V42 = {
  title: "TestFlight hazırlık özeti",
  text: "Bu sürüm yerel ürün motoru, rutin, analiz, tarama önizlemesi, karar rehberi ve boş ekran korumalarını birlikte taşır.",
};

export const TEST_CHECKLIST_V42 = [
  "Uygulama açılışı",
  "Ana menü geçişleri",
  "Ürün arama ve filtreleme",
  "Rutin oluşturma",
  "Analiz sonucu yönlendirmesi",
  "Tarama önizleme akışı",
  "Karar rehberi",
  "Profil demo alanı",
  "Boş sonuç koruması",
];

export function getReadinessCountV42() {
  return TEST_CHECKLIST_V42.length;
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_UX_GUARD_PACK_V41" not in s:
    print("V41 marker bulunamadı. Önce V41 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_UX_GUARD_PACK_V41", "ECZ4_PRE_TEST_HARDENING_PACK_V42")
s = s.replace("Güvenli akış korumaları", "Test hazırlık paketi")
s = s.replace(
    "Boş ekran, filtre, tarama ve analiz yönlendirmeleri güvenli korumalarla çalışıyor.",
    "Ürün, rutin, analiz, tarama, karar rehberi ve güvenli boş ekran katmanları test için hazırlandı."
)

if 'from "../local_demo_data/test_readiness_v42"' not in s:
    s = s.replace(
        'import {\n  SAFE_FLOW_NOTICES,\n  buildEmptyStateV41,\n} from "../local_demo_data/ux_guard_v41";',
        'import {\n  SAFE_FLOW_NOTICES,\n  buildEmptyStateV41,\n} from "../local_demo_data/ux_guard_v41";\nimport {\n  TEST_CHECKLIST_V42,\n  TEST_SUMMARY_V42,\n  getReadinessCountV42,\n} from "../local_demo_data/test_readiness_v42";'
    )

# Alt menüye Karar ekle
if 'label="Karar"' not in s:
    s = s.replace(
        '<NavButton label="Tara" active={screen === "scan"} onPress={() => go("scan")} />\n          <NavButton label="Profil" active={screen === "profile"} onPress={() => go("profile")} />',
        '<NavButton label="Tara" active={screen === "scan"} onPress={() => go("scan")} />\n          <NavButton label="Karar" active={screen === "compare"} onPress={() => go("compare")} />\n          <NavButton label="Profil" active={screen === "profile"} onPress={() => go("profile")} />'
    )

s = s.replace('<StatusCard value="V41" label="Akış koruması" />', '<StatusCard value="V42" label="Test paketi" />')
s = s.replace("V41 durumu", "V42 durumu")
s = s.replace(
    "Boş ekran ve hata akışları güvenli şekilde yönetiliyor.",
    "Test öncesi ana akışlar tek pakette toplandı."
)
s = s.replace(
    "Ürün, analiz ve tarama ekranlarında kullanıcı boşta kalmaz; her durumda yönlendirme görünür.",
    "Yerel ürün motoru, analiz, rutin, tarama önizlemesi, karar rehberi ve boş ekran koruması tek akışta çalışır."
)

# Ana ekrana readiness kartı ekle
if "TEST_SUMMARY_V42.title" not in s:
    s = s.replace(
        '<Text style={styles.highlightText}>\n                Ürün, analiz ve tarama ekranlarında kullanıcı boşta kalmaz; her durumda yönlendirme görünür.\n              </Text>\n            </View>',
        '<Text style={styles.highlightText}>\n                Yerel ürün motoru, analiz, rutin, tarama önizlemesi, karar rehberi ve boş ekran koruması tek akışta çalışır.\n              </Text>\n            </View>'
    )

    s = s.replace(
        '<Text style={styles.sectionTitle}>Hızlı giriş</Text>',
        '<View style={styles.readinessCard}>\n              <Text style={styles.readinessTitle}>{TEST_SUMMARY_V42.title}</Text>\n              <Text style={styles.readinessText}>{TEST_SUMMARY_V42.text}</Text>\n              <Text style={styles.readinessCount}>{getReadinessCountV42()} kontrol başlığı hazır</Text>\n              {TEST_CHECKLIST_V42.map((item) => (\n                <Text key={item} style={styles.readinessItem}>• {item}</Text>\n              ))}\n            </View>\n\n            <Text style={styles.sectionTitle}>Hızlı giriş</Text>'
    )

# Profile alanına test özeti
if "Test hazırlığı" not in s:
    s = s.replace(
        '<ProfileLine label="Karar rehberi" value="Aktif demo" />',
        '<ProfileLine label="Karar rehberi" value="Aktif demo" />\n              <ProfileLine label="Test hazırlığı" value="V42 hazır" />'
    )

# Footer update
s = s.replace(
    "Bu sürüm gerçek veri, gerçek görsel işleme, giriş ve eski ağır bileşenleri içermez. Boş ekran ve hata korumaları yereldir.",
    "Bu sürüm test öncesi güvenli pakettir; gerçek uzak veri, gerçek görsel işleme ve giriş katmanı içermez."
)

# Styles
if "readinessCard" not in s:
    s = s.replace(
        'grid: { gap: 12 },',
        'readinessCard: { borderRadius: 22, backgroundColor: "#FFFDF8", padding: 18, borderWidth: 1, borderColor: "#F4E9D8", marginBottom: 22 },\n  readinessTitle: { fontSize: 17, fontWeight: "900", color: "#26342A", marginBottom: 6 },\n  readinessText: { fontSize: 13, lineHeight: 19, color: "#5D665C", marginBottom: 10 },\n  readinessCount: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 8 },\n  readinessItem: { fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "700" },\n  grid: { gap: 12 },'
    )

p.write_text(s)
print("V42 pre-test hardening patch uygulandı.")
PY

{
echo "=== V42 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_PRE_TEST_HARDENING_PACK_V42" app local_demo_data

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
rm -rf "dist/ecz4_pre_test_hardening_pack_v42_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_pre_test_hardening_pack_v42_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_pre_test_hardening_pack_v42_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_PRE_TEST_HARDENING_PACK_V42" "$BUNDLE"
echo "PASS: V42 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_PRE_TEST_HARDENING_PACK_V42_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 pre-test hardening pack v42 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_PRE_TEST_HARDENING_PACK_V42_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
