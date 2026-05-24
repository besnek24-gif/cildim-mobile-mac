#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_v54_final_polish_test_candidate_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v54_final

cp app/index.tsx "backups/ecz4_v54_final/index_before_v54_$STAMP.tsx"
cp -R local_demo_data "backups/ecz4_v54_final/local_demo_data_before_v54_$STAMP"

cat > local_demo_data/final_polish_v54.ts <<'TS'
export const FINAL_READY_CARDS_V54 = [
  {
    title: "Ürün keşfi",
    text: "Katalog, ürün detayı, favori ve son bakılan ürün akışı birlikte çalışır.",
    target: "products",
  },
  {
    title: "Analiz + Tara",
    text: "Premium analiz paneli ve tarama timeline alanı test edilebilir durumdadır.",
    target: "analysis",
  },
  {
    title: "Rutin + Karar",
    text: "Sabah-akşam rutin, ürün kıyaslama ve karar cümlesi görsel kartlarla ilerler.",
    target: "routine",
  },
];

export const FINAL_TEST_AREAS_V54 = [
  "Ana ekran",
  "Ürün katalog",
  "Ürün detay",
  "Favori / son bakılan",
  "Rutin kaydı",
  "Premium analiz",
  "Tara timeline",
  "Karar rehberi",
  "Profil özeti",
];

export const FINAL_POLISH_NOTE_V54 = {
  title: "V54 TestFlight adayı",
  text: "Bu sürüm gerçek uygulama hissi için görsel kartlar, yerel durum, katalog, analiz, tarama, rutin ve profil akışlarını tek pakette toplar.",
  warning: "Uzak veri, hesap açma, ödeme ve gerçek görsel işleme bu adayda bilinçli olarak kapalıdır.",
};

export function getFinalAreaCountV54() {
  return FINAL_TEST_AREAS_V54.length;
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_PREMIUM_SCAN_ANALYSIS_V53" not in s:
    print("V53 marker bulunamadı. Önce V53 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_PREMIUM_SCAN_ANALYSIS_V53", "ECZ4_FINAL_POLISH_TEST_CANDIDATE_V54")
s = s.replace(
    "Bu sürüm analiz ve tarama ekranlarını premium/klinik sonuç panelleriyle güçlendirir.",
    "Bu sürüm ürün, rutin, analiz, tara, karar ve profil akışlarını TestFlight adayı olarak tek pakette toplar."
)

if 'from "../local_demo_data/final_polish_v54"' not in s:
    marker = 'import {\n  buildPremiumAnalysisV53,\n  buildPremiumScanResultV53,\n} from "../local_demo_data/premium_scan_analysis_v53";'
    add = marker + '\nimport {\n  FINAL_POLISH_NOTE_V54,\n  FINAL_READY_CARDS_V54,\n  FINAL_TEST_AREAS_V54,\n  getFinalAreaCountV54,\n} from "../local_demo_data/final_polish_v54";'
    s = s.replace(marker, add)

# HomeScreen içine final panel
if "<V54FinalLaunchPanel" not in s:
    if '<View style={styles.stateDashboardCard}>' in s:
        s = s.replace(
            '<View style={styles.stateDashboardCard}>',
            '<V54FinalLaunchPanel setScreen={setScreen} />\n\n      <View style={styles.stateDashboardCard}>',
            1
        )
    else:
        s = s.replace(
            '<SectionTitle title="Hızlı başlangıç" />',
            '<V54FinalLaunchPanel setScreen={setScreen} />\n\n      <SectionTitle title="Hızlı başlangıç" />',
            1
        )

# Profile içine final aday kartı
if "finalPolishCard" not in s:
    s = s.replace(
'''      <View style={styles.profileStateCard}>''',
'''      <View style={styles.finalPolishCard}>
        <Text style={styles.finalPolishKicker}>{FINAL_POLISH_NOTE_V54.title}</Text>
        <Text style={styles.finalPolishTitle}>Test alanları hazır</Text>
        <Text style={styles.finalPolishText}>{FINAL_POLISH_NOTE_V54.text}</Text>
        <Text style={styles.finalPolishWarning}>{FINAL_POLISH_NOTE_V54.warning}</Text>
        <Text style={styles.finalPolishCount}>{getFinalAreaCountV54()} test alanı</Text>
        <View style={styles.finalAreaGrid}>
          {FINAL_TEST_AREAS_V54.map((area) => (
            <Text key={area} style={styles.finalAreaPill}>{area}</Text>
          ))}
        </View>
      </View>

      <View style={styles.profileStateCard}>''',
        1
    )

# Component ekle
if "function V54FinalLaunchPanel" not in s:
    s = s.replace(
'''function NavItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {''',
'''function V54FinalLaunchPanel({ setScreen }: { setScreen: (screen: ScreenKey) => void }) {
  return (
    <View style={styles.v54LaunchPanel}>
      <Text style={styles.v54LaunchKicker}>{FINAL_POLISH_NOTE_V54.title}</Text>
      <Text style={styles.v54LaunchTitle}>Uygulama akışı test için hazır</Text>
      <Text style={styles.v54LaunchText}>{FINAL_POLISH_NOTE_V54.text}</Text>

      <View style={styles.v54ReadyGrid}>
        {FINAL_READY_CARDS_V54.map((card) => (
          <Pressable
            key={card.title}
            style={styles.v54ReadyCard}
            onPress={() => setScreen(card.target as ScreenKey)}
          >
            <Text style={styles.v54ReadyTitle}>{card.title}</Text>
            <Text style={styles.v54ReadyText}>{card.text}</Text>
            <Text style={styles.v54ReadyAction}>Aç</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.v54TestStrip}>
        <Text style={styles.v54TestStripText}>{getFinalAreaCountV54()} ana test alanı hazır</Text>
      </View>
    </View>
  );
}

function NavItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {'''
    )

# Footer final metni
s = s.replace(
    "Bu sürüm yerel verilerle çalışan, hızlı test edilebilir görsel uygulama iskeletidir.",
    "V54 final aday: yerel ürün, favori, rutin, analiz, tara, karar ve profil akışları birlikte test edilir."
)
s = s.replace(
    "Bu sürüm ürün katalog vitrini, detay paneli ve karar açıklaması güçlendirilmiş yerel uygulama adayıdır.",
    "V54 final aday: yerel ürün, favori, rutin, analiz, tara, karar ve profil akışları birlikte test edilir."
)
s = s.replace(
    "Bu sürüm favori, son bakılan ürün ve rutin kaydı simülasyonuyla daha gerçek uygulama hissi verir.",
    "V54 final aday: yerel ürün, favori, rutin, analiz, tara, karar ve profil akışları birlikte test edilir."
)
s = s.replace(
    "Bu sürüm analiz ve tarama ekranlarını premium/klinik sonuç panelleriyle güçlendirir.",
    "V54 final aday: yerel ürün, favori, rutin, analiz, tara, karar ve profil akışları birlikte test edilir."
)

# Styles
if "v54LaunchPanel" not in s:
    style_anchor = "  footerCard: {"
    style_block = '''  v54LaunchPanel: {
    borderRadius: 32,
    backgroundColor: "#243428",
    padding: 22,
  },
  v54LaunchKicker: {
    color: "#D6C1A0",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  v54LaunchTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
  },
  v54LaunchText: {
    color: "#DCE4DB",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    fontWeight: "700",
  },
  v54ReadyGrid: {
    gap: 10,
    marginTop: 16,
  },
  v54ReadyCard: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: 15,
  },
  v54ReadyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  v54ReadyText: {
    color: "#DCE4DB",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    fontWeight: "700",
  },
  v54ReadyAction: {
    color: "#D6C1A0",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 9,
  },
  v54TestStrip: {
    borderRadius: 999,
    backgroundColor: "#FFF6EA",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    alignSelf: "flex-start",
  },
  v54TestStripText: {
    color: "#243428",
    fontSize: 12,
    fontWeight: "900",
  },
  finalPolishCard: {
    borderRadius: 30,
    backgroundColor: "#243428",
    padding: 22,
  },
  finalPolishKicker: {
    color: "#D6C1A0",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  finalPolishTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
  },
  finalPolishText: {
    color: "#DCE4DB",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    fontWeight: "700",
  },
  finalPolishWarning: {
    color: "#FFF6EA",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: "900",
  },
  finalPolishCount: {
    color: "#D6C1A0",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 12,
  },
  finalAreaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  finalAreaPill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
    overflow: "hidden",
  },
'''
    s = s.replace(style_anchor, style_block + style_anchor)

p.write_text(s)
print("V54 final polish test candidate patch uygulandı.")
PY

{
echo "=== V54 SOURCE CHECK ==="
grep -RIn "ECZ4_FINAL_POLISH_TEST_CANDIDATE_V54" app local_demo_data
grep -RInE "final_polish_v54|V54FinalLaunchPanel|v54LaunchPanel|finalPolishCard|FINAL_TEST_AREAS_V54" app local_demo_data

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
rm -rf "dist/ecz4_v54_final_polish_test_candidate_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_v54_final_polish_test_candidate_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_v54_final_polish_test_candidate_$STAMP" -type f -name "*.js" | head -1)
if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"
grep -q "ECZ4_FINAL_POLISH_TEST_CANDIDATE_V54" "$BUNDLE"
echo "PASS: V54 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_FINAL_POLISH_TEST_CANDIDATE_V54_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 final polish test candidate v54 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_FINAL_POLISH_TEST_CANDIDATE_V54_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
