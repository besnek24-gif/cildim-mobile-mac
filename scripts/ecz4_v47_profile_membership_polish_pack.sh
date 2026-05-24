#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_profile_membership_polish_pack_v47_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v47 local_demo_data

cp app/index.tsx "backups/ecz4_v47/index_before_v47_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v47/layout_before_v47_$STAMP.tsx"
cp local_demo_data/*.ts "backups/ecz4_v47/" 2>/dev/null || true

cat > local_demo_data/profile_v47.ts <<'TS'
export type ProfileModeV47 = "Misafir" | "Seçkin hazırlık";
export type LocalModuleStatusV47 = {
  title: string;
  status: string;
  note: string;
};

export const PROFILE_MODES_V47: ProfileModeV47[] = ["Misafir", "Seçkin hazırlık"];

export const LOCAL_MODULE_STATUS_V47: LocalModuleStatusV47[] = [
  {
    title: "Ürün motoru",
    status: "Hazır demo",
    note: "Yerel ürün listesi arama, kategori ve endişe filtresiyle çalışır.",
  },
  {
    title: "Rutin",
    status: "Hazır demo",
    note: "Sabah-akşam ürünlü plan seçilen endişeye göre değişir.",
  },
  {
    title: "Analiz",
    status: "Hazır demo",
    note: "Cilt hissi, endişe ve rutin seviyesiyle sonuç dili üretir.",
  },
  {
    title: "Tara",
    status: "Güvenli önizleme",
    note: "Gerçek görsel işleme açılmadan önce ekran akışı test edilir.",
  },
  {
    title: "Karar rehberi",
    status: "Hazır demo",
    note: "Ürünleri skor, kategori ve segment diliyle kıyaslar.",
  },
];

export const MEMBERSHIP_PREVIEW_V47 = [
  "Gelişmiş analiz açıklamaları",
  "Daha ayrıntılı ürün gerekçeleri",
  "Rutin takibi ve bakım planı",
  "Karar rehberi genişletmeleri",
];

export function getProfileSummaryV47(mode: ProfileModeV47) {
  if (mode === "Seçkin hazırlık") {
    return {
      title: "Seçkin üyelik hazırlığı",
      text: "Bu aşama ödeme veya giriş açmaz; sadece üyelik ekran dilini ve değer önerisini güvenli biçimde gösterir.",
      badge: "Hazırlık",
    };
  }

  return {
    title: "Misafir görünümü",
    text: "Kişisel veri almadan ürün, rutin, analiz ve tarama demo akışları gezilebilir.",
    badge: "Güvenli",
  };
}
TS

python3 - <<'PY'
from pathlib import Path
import re

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_ANALYSIS_SCAN_POLISH_PACK_V46" not in s:
    print("V46 marker bulunamadı. Önce V46 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_ANALYSIS_SCAN_POLISH_PACK_V46", "ECZ4_PROFILE_MEMBERSHIP_POLISH_PACK_V47")
s = s.replace("Analiz ve tarama sonuç paketi", "Profil ve üyelik hazırlık paketi")
s = s.replace(
    "Analiz ve tarama sonuçları daha görünür, yönlendirici ve karar verdirici hale getirildi.",
    "Profil, yerel modül durumu ve Seçkin üyelik hazırlık ekranı daha okunur hale getirildi."
)
s = s.replace('<StatusCard value="V46" label="Analiz/Tara" />', '<StatusCard value="V47" label="Profil" />')
s = s.replace("V46 durumu", "V47 durumu")
s = s.replace(
    "Analiz ve tarama sonuç ekranları artık daha net yönlendirme kartları içerir.",
    "Profil ekranı artık yerel modül durumu ve üyelik hazırlık kartlarını gösterir."
)
s = s.replace(
    "Analiz sonucu, tarama kalitesi, ürün önerisi ve rutin yönlendirmesi tek karar hattı gibi görünür.",
    "Misafir görünümü, yerel demo durumu ve Seçkin üyelik hazırlığı tek profil ekranında görünür."
)

if 'from "../local_demo_data/profile_v47"' not in s:
    s = s.replace(
        'import {\n  buildAnalysisPolishV46,\n  buildScanPolishV46,\n} from "../local_demo_data/analysis_scan_polish_v46";',
        'import {\n  buildAnalysisPolishV46,\n  buildScanPolishV46,\n} from "../local_demo_data/analysis_scan_polish_v46";\nimport {\n  LOCAL_MODULE_STATUS_V47,\n  MEMBERSHIP_PREVIEW_V47,\n  PROFILE_MODES_V47,\n  type ProfileModeV47,\n  getProfileSummaryV47,\n} from "../local_demo_data/profile_v47";'
    )

if 'const [profileMode, setProfileMode]' not in s:
    s = s.replace(
        'const [compareRight, setCompareRight] = useState(LOCAL_PRODUCTS[1].id);',
        'const [compareRight, setCompareRight] = useState(LOCAL_PRODUCTS[1].id);\n  const [profileMode, setProfileMode] = useState<ProfileModeV47>("Misafir");'
    )

if "const profileSummary = useMemo(" not in s:
    s = s.replace(
        'const scanPolish = useMemo(\n    () => buildScanPolishV46({ mode: scanMode, quality: scanQuality, concern }),\n    [scanMode, scanQuality, concern],\n  );',
        'const scanPolish = useMemo(\n    () => buildScanPolishV46({ mode: scanMode, quality: scanQuality, concern }),\n    [scanMode, scanQuality, concern],\n  );\n  const profileSummary = useMemo(() => getProfileSummaryV47(profileMode), [profileMode]);'
    )

profile_block = '''        {screen === "profile" && (
          <View style={styles.detailCard}>
            <Header title="Profil" badge="V47" />
            <Text style={styles.detailSubtitle}>
              Bu ekran kişisel veri toplamadan misafir görünümü, yerel modül durumu ve üyelik hazırlığını gösterir.
            </Text>

            <Text style={styles.smallLabel}>Profil modu</Text>
            <View style={styles.chipRow}>
              {PROFILE_MODES_V47.map((item) => (
                <Chip key={item} label={item} active={profileMode === item} onPress={() => setProfileMode(item)} />
              ))}
            </View>

            <View style={styles.profileHeroBox}>
              <Text style={styles.profileHeroBadge}>{profileSummary.badge}</Text>
              <Text style={styles.profileHeroTitle}>{profileSummary.title}</Text>
              <Text style={styles.profileHeroText}>{profileSummary.text}</Text>
            </View>

            <View style={styles.profileBox}>
              <ProfileLine label="Durum" value={profileMode} />
              <ProfileLine label="Ürün motoru" value="Yerel demo" />
              <ProfileLine label="Analiz akışı" value="Aktif demo" />
              <ProfileLine label="Tara akışı" value="Önizleme" />
              <ProfileLine label="Karar rehberi" value="Aktif demo" />
            </View>

            <Text style={styles.smallLabel}>Yerel modül durumu</Text>
            <View style={styles.moduleStatusList}>
              {LOCAL_MODULE_STATUS_V47.map((item) => (
                <View key={item.title} style={styles.moduleStatusCard}>
                  <View style={styles.moduleStatusTop}>
                    <Text style={styles.moduleStatusTitle}>{item.title}</Text>
                    <Text style={styles.moduleStatusBadge}>{item.status}</Text>
                  </View>
                  <Text style={styles.moduleStatusNote}>{item.note}</Text>
                </View>
              ))}
            </View>

            <View style={styles.membershipCard}>
              <Text style={styles.membershipTitle}>Seçkin üyelik hazırlığı</Text>
              <Text style={styles.membershipText}>
                Bu aşama gerçek üyelik açmaz; değer önerisini ve ekran dilini güvenli biçimde test eder.
              </Text>
              {MEMBERSHIP_PREVIEW_V47.map((item) => (
                <Text key={item} style={styles.membershipItem}>• {item}</Text>
              ))}
            </View>
          </View>
        )}

'''

pattern = re.compile(r'        \{screen === "profile" && \(\n.*?\n        \)}\n\n(?=        <View style=\{styles.footer\}>)', re.DOTALL)
s2, count = pattern.subn(profile_block, s, count=1)
if count != 1:
    print("Profil ekran bloğu bulunamadı.")
    for i, line in enumerate(s.splitlines(), start=1):
        if 'screen === "profile"' in line:
            for n, l in enumerate(s.splitlines()[max(0,i-5):i+120], start=max(1,i-4)):
                print(f"{n}: {l}")
            break
    raise SystemExit(1)
s = s2

if "profileHeroBox" not in s:
    s = s.replace(
        'profileBox: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10 },',
        '''profileHeroBox: { marginTop: 16, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },
  profileHeroBadge: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 6 },
  profileHeroTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },
  profileHeroText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#5D665C" },
  profileBox: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10 },'''
    )

if "moduleStatusList" not in s:
    s = s.replace(
        'membershipCard: { marginTop: 16, borderRadius: 20, backgroundColor: "#F4E9D8", padding: 16 },',
        '''moduleStatusList: { marginTop: 10, gap: 10 },
  moduleStatusCard: { borderRadius: 18, backgroundColor: "#F8FAF7", padding: 14, borderWidth: 1, borderColor: "rgba(107,122,106,0.12)" },
  moduleStatusTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  moduleStatusTitle: { flex: 1, fontSize: 14, fontWeight: "900", color: "#26342A" },
  moduleStatusBadge: { fontSize: 11, fontWeight: "900", color: "#9A642C" },
  moduleStatusNote: { marginTop: 6, fontSize: 12, lineHeight: 18, color: "#5D665C" },
  membershipCard: { marginTop: 16, borderRadius: 20, backgroundColor: "#F4E9D8", padding: 16 },'''
    )

if "membershipItem" not in s:
    s = s.replace(
        'membershipText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },',
        'membershipText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },\n  membershipItem: { marginTop: 6, fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "800" },'
    )

p.write_text(s)
print("V47 profile membership polish patch uygulandı.")
PY

{
echo "=== V47 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_PROFILE_MEMBERSHIP_POLISH_PACK_V47" app local_demo_data

echo ""
echo "=== PROFILE POLISH PRESENCE CHECK ==="
grep -RInE 'profile_v47|PROFILE_MODES_V47|profileSummary|profileHeroBox|moduleStatusCard|membershipItem' app local_demo_data

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
rm -rf "dist/ecz4_profile_membership_polish_pack_v47_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_profile_membership_polish_pack_v47_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_profile_membership_polish_pack_v47_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_PROFILE_MEMBERSHIP_POLISH_PACK_V47" "$BUNDLE"
echo "PASS: V47 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_PROFILE_MEMBERSHIP_POLISH_PACK_V47_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 profile membership polish pack v47 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_PROFILE_MEMBERSHIP_POLISH_PACK_V47_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
