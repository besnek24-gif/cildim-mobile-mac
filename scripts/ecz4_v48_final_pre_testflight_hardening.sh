#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_final_pre_testflight_hardening_v48_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v48 local_demo_data

cp app/index.tsx "backups/ecz4_v48/index_before_v48_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v48/layout_before_v48_$STAMP.tsx"
cp local_demo_data/*.ts "backups/ecz4_v48/" 2>/dev/null || true

cat > local_demo_data/final_readiness_v48.ts <<'TS'
export const FINAL_READINESS_V48 = {
  title: "V48 TestFlight adayı",
  summary:
    "Bu paket yerel ürün motoru, rutin, analiz, tara önizleme, karar rehberi, profil/üyelik hazırlığı ve güvenli boş ekran korumalarını birlikte taşır.",
  warning:
    "Gerçek kamera, giriş sistemi, Supabase ve uzak veri bu sürümde bilinçli olarak kapalıdır.",
};

export const FINAL_TEST_AREAS_V48 = [
  "Ana ekran ve hızlı giriş kartları",
  "Ürün arama / kategori / endişe filtresi",
  "Ürün detay ve neden önerildi alanı",
  "Rutin ekranı sabah-akşam planı",
  "Analiz ekranı sonuç ve yönlendirme kartları",
  "Tara ekranı büyük seçim kartları",
  "Karar rehberi ürün kıyaslama",
  "Profil ve Seçkin üyelik hazırlığı",
  "Boş arama sonucu koruması",
];

export function getFinalReadinessCountV48() {
  return FINAL_TEST_AREAS_V48.length;
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_PROFILE_MEMBERSHIP_POLISH_PACK_V47" not in s:
    print("V47 marker bulunamadı. Önce V47 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_PROFILE_MEMBERSHIP_POLISH_PACK_V47", "ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48")
s = s.replace("Profil ve üyelik hazırlık paketi", "Final TestFlight hazırlık paketi")
s = s.replace(
    "Profil, yerel modül durumu ve Seçkin üyelik hazırlık ekranı daha okunur hale getirildi.",
    "V48 final test adayı: ürün, rutin, analiz, tara, karar rehberi ve profil akışları birlikte mühürlendi."
)
s = s.replace('<StatusCard value="V47" label="Profil" />', '<StatusCard value="V48" label="Final aday" />')
s = s.replace("V47 durumu", "V48 durumu")
s = s.replace(
    "Profil ekranı artık yerel modül durumu ve üyelik hazırlık kartlarını gösterir.",
    "TestFlight öncesi tüm güvenli yerel modüller tek aday pakette toplandı."
)
s = s.replace(
    "Misafir görünümü, yerel demo durumu ve Seçkin üyelik hazırlığı tek profil ekranında görünür.",
    "Bu sürüm gerçek uzak veri, giriş ve kamera açmadan uygulamanın ana kullanım akışlarını test ettirir."
)

if 'from "../local_demo_data/final_readiness_v48"' not in s:
    s = s.replace(
        'import {\n  LOCAL_MODULE_STATUS_V47,\n  MEMBERSHIP_PREVIEW_V47,\n  PROFILE_MODES_V47,\n  type ProfileModeV47,\n  getProfileSummaryV47,\n} from "../local_demo_data/profile_v47";',
        'import {\n  LOCAL_MODULE_STATUS_V47,\n  MEMBERSHIP_PREVIEW_V47,\n  PROFILE_MODES_V47,\n  type ProfileModeV47,\n  getProfileSummaryV47,\n} from "../local_demo_data/profile_v47";\nimport {\n  FINAL_READINESS_V48,\n  FINAL_TEST_AREAS_V48,\n  getFinalReadinessCountV48,\n} from "../local_demo_data/final_readiness_v48";'
    )

# Ana ekran readiness kartını V48 final karta çevir
if "FINAL_READINESS_V48.title" not in s:
    s = s.replace(
        '<View style={styles.readinessCard}>\n              <Text style={styles.readinessTitle}>{TEST_SUMMARY_V42.title}</Text>\n              <Text style={styles.readinessText}>{TEST_SUMMARY_V42.text}</Text>\n              <Text style={styles.readinessCount}>{getReadinessCountV42()} kontrol başlığı hazır</Text>\n              {TEST_CHECKLIST_V42.map((item) => (\n                <Text key={item} style={styles.readinessItem}>• {item}</Text>\n              ))}\n            </View>',
        '<View style={styles.readinessCard}>\n              <Text style={styles.readinessTitle}>{FINAL_READINESS_V48.title}</Text>\n              <Text style={styles.readinessText}>{FINAL_READINESS_V48.summary}</Text>\n              <Text style={styles.readinessWarning}>{FINAL_READINESS_V48.warning}</Text>\n              <Text style={styles.readinessCount}>{getFinalReadinessCountV48()} test alanı hazır</Text>\n              {FINAL_TEST_AREAS_V48.map((item) => (\n                <Text key={item} style={styles.readinessItem}>• {item}</Text>\n              ))}\n            </View>'
    )

# Profil içine final aday satırı ekle
if '<ProfileLine label="Final aday" value="V48 hazır" />' not in s:
    s = s.replace(
        '<ProfileLine label="Karar rehberi" value="Aktif demo" />',
        '<ProfileLine label="Karar rehberi" value="Aktif demo" />\n              <ProfileLine label="Final aday" value="V48 hazır" />'
    )

# Footer final metin
s = s.replace(
    "Bu sürüm test öncesi güvenli pakettir; gerçek uzak veri, gerçek görsel işleme ve giriş katmanı içermez.",
    "V48 final TestFlight aday paketi: gerçek uzak veri, gerçek görsel işleme, giriş ve ödeme katmanı içermez."
)

# Style warning yoksa ekle
if "readinessWarning" not in s:
    s = s.replace(
        'readinessCount: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 8 },',
        'readinessWarning: { marginTop: 8, fontSize: 12, lineHeight: 18, color: "#9A642C", fontWeight: "900" },\n  readinessCount: { marginTop: 10, fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 8 },'
    )

p.write_text(s)
print("V48 final pre-TestFlight hardening patch uygulandı.")
PY

{
echo "=== V48 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48" app local_demo_data

echo ""
echo "=== FINAL READINESS PRESENCE CHECK ==="
grep -RInE 'final_readiness_v48|FINAL_READINESS_V48|FINAL_TEST_AREAS_V48|getFinalReadinessCountV48|readinessWarning' app local_demo_data

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
rm -rf "dist/ecz4_final_pre_testflight_hardening_v48_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_final_pre_testflight_hardening_v48_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_final_pre_testflight_hardening_v48_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48" "$BUNDLE"
echo "PASS: V48 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 final pre-TestFlight hardening v48 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
