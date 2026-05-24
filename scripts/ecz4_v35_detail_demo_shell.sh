#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_detail_demo_shell_v35_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v35

cp app/index.tsx "backups/ecz4_v35/index_before_v35_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v35/layout_before_v35_$STAMP.tsx"

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

# V34 marker ve başlık V35'e yükseltilir.
s = s.replace("ECZ4_RICH_DEMO_SHELL_V34", "ECZ4_DETAIL_DEMO_SHELL_V35")
s = s.replace("Zengin demo iskelet", "Detaylı demo iskelet")

# Güvenli küçük detail özelliği: eski app import etmeden, sadece mevcut React state + RN bileşenleri.
if "type DetailKey = string | null;" not in s:
    s = s.replace(
        'type SectionKey = "home" | "analysis" | "products" | "routine" | "compare" | "profile";',
        'type SectionKey = "home" | "analysis" | "products" | "routine" | "compare" | "profile";\ntype DetailKey = string | null;'
    )

if 'const [detail, setDetail] = useState<DetailKey>(null);' not in s:
    s = s.replace(
        'const [active, setActive] = useState<SectionKey>("home");',
        'const [active, setActive] = useState<SectionKey>("home");\n  const [detail, setDetail] = useState<DetailKey>(null);'
    )

# Sekme değişimlerinde detay temizleme.
s = s.replace(
    'onPress={() => setActive("home")}',
    'onPress={() => { setActive("home"); setDetail(null); }}'
)
s = s.replace(
    'onPress={() => setActive(item.key)}',
    'onPress={() => { setActive(item.key); setDetail(null); }}'
)

# Ürün kartlarına detay açma.
s = s.replace(
    '<View key={product.name} style={styles.productCard}>',
    '<Pressable key={product.name} style={styles.productCard} onPress={() => setDetail(product.name)}>'
)
s = s.replace(
    '</View>\n              ))}\n            </View>\n\n            <BackButton onPress={() => setActive("home")} />',
    '</Pressable>\n              ))}\n            </View>\n\n            {detail ? (\n              <View style={styles.inlineDetailBox}>\n                <Text style={styles.inlineDetailTitle}>{detail}</Text>\n                <Text style={styles.inlineDetailText}>Bu ürün için detay ekranı daha sonra gerçek içerikle genişletilecek. Şimdilik kart seçimi ve detay paneli güvenli biçimde deneniyor.</Text>\n                <Pressable style={styles.smallButton} onPress={() => setDetail(null)}>\n                  <Text style={styles.smallButtonText}>Detayı kapat</Text>\n                </Pressable>\n              </View>\n            ) : null}\n\n            <BackButton onPress={() => { setActive("home"); setDetail(null); }} />',
    1
)

# Rutin bölümünde küçük açıklama kutusu.
if "Rutin seçimi çalışıyor" not in s:
    s = s.replace(
        '<BackButton onPress={() => setActive("home")} />\n          </View>\n        )}\n\n        {active === "compare"',
        '<View style={styles.inlineDetailBox}>\n              <Text style={styles.inlineDetailTitle}>Rutin seçimi çalışıyor</Text>\n              <Text style={styles.inlineDetailText}>Sabah ve akşam adımları bu sürümde örnek veriyle gösterilir. Sonraki aşamada gerçek seçim akışı eklenir.</Text>\n            </View>\n\n            <BackButton onPress={() => { setActive("home"); setDetail(null); }} />\n          </View>\n        )}\n\n        {active === "compare"'
    )

# Analiz bölümünde güvenli ek yorum.
if "Analiz detay paneli" not in s:
    s = s.replace(
        '<BackButton onPress={() => setActive("home")} />\n          </View>\n        )}\n\n        {active === "products"',
        '<InfoBox\n              title="Analiz detay paneli"\n              text="Bu alan gerçek ölçüm almadan örnek bakım önceliklerini gösterir. Hedef: kullanıcıya sade ve anlaşılır sonuç dili hazırlamak."\n            />\n\n            <BackButton onPress={() => { setActive("home"); setDetail(null); }} />\n          </View>\n        )}\n\n        {active === "products"'
    )

# Profil ve compare dönüşlerini de güvenli hale getir.
s = s.replace(
    '<BackButton onPress={() => setActive("home")} />',
    '<BackButton onPress={() => { setActive("home"); setDetail(null); }} />'
)

# Stil ekle.
if "inlineDetailBox" not in s:
    s = s.replace(
        'footer: { marginTop: 18, borderRadius: 22, backgroundColor: "#2F3A31", padding: 18 },',
        'inlineDetailBox: { marginTop: 16, borderRadius: 20, backgroundColor: "#F4E9D8", padding: 16 },\n  inlineDetailTitle: { fontSize: 15, fontWeight: "900", color: "#26342A", marginBottom: 6 },\n  inlineDetailText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },\n  smallButton: { marginTop: 12, alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#2F3A31", paddingVertical: 9, paddingHorizontal: 14 },\n  smallButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },\n  footer: { marginTop: 18, borderRadius: 22, backgroundColor: "#2F3A31", padding: 18 },'
    )

p.write_text(s)
print("V35 detail demo shell patch uygulandı.")
PY

{
echo "=== V35 SOURCE CHECK ==="
find app -type f | sort
grep -RIn "ECZ4_DETAIL_DEMO_SHELL_V35" app

echo ""
echo "=== OLD APP TRACE CHECK ==="
if grep -RInE "AuthProvider|UserPreferencesProvider|react-native-keyboard-controller|premium-skin-scan-v2|skin-intelligence|ProductCard|@supabase|Supabase|Feather|Ionicons|expo-camera|AsyncStorage|zustand" app --include="*.ts" --include="*.tsx" 2>/dev/null; then
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
rm -rf "dist/ecz4_detail_demo_shell_v35_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_detail_demo_shell_v35_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_detail_demo_shell_v35_$STAMP" -type f -name "*.js" | head -1)
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_DETAIL_DEMO_SHELL_V35" "$BUNDLE"
echo "PASS: V35 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_DETAIL_DEMO_SHELL_V35_PASS_$STAMP.tar.gz" app app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 detail demo shell v35 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_DETAIL_DEMO_SHELL_V35_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
