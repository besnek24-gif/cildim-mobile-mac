#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_v48_full_runtime_import_fix_retry_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v48_runtime_fix

V48=$(ls -t stable_snapshots/ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48_FIX_PASS_*.tar.gz | head -1)
echo "RESTORE_FROM=$V48" | tee "$REPORT_DIR/summary.txt"
tar -xzf "$V48" app local_demo_data

cp app/index.tsx "backups/ecz4_v48_runtime_fix/index_before_full_import_fix_retry_$STAMP.tsx"
cp -R local_demo_data "backups/ecz4_v48_runtime_fix/local_demo_data_before_full_import_fix_retry_$STAMP"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("app/index.tsx")
s = p.read_text()

required_imports = [
'''import {
  buildProductDetailV44,
  getScoreLabelV44,
} from "../local_demo_data/product_detail_v44";''',
'''import {
  buildRoutinePlanV45,
} from "../local_demo_data/routine_plan_v45";''',
'''import {
  buildAnalysisPolishV46,
  buildScanPolishV46,
} from "../local_demo_data/analysis_scan_polish_v46";''',
'''import {
  LOCAL_MODULE_STATUS_V47,
  MEMBERSHIP_PREVIEW_V47,
  PROFILE_MODES_V47,
  type ProfileModeV47,
  getProfileSummaryV47,
} from "../local_demo_data/profile_v47";''',
]

# test_readiness import bloğunu kaç isimli olduğuna bakmadan bul
pattern = re.compile(
    r'import\s*\{[^}]*\}\s*from\s*"\.\./local_demo_data/test_readiness_v42";',
    re.S
)
m = pattern.search(s)

if not m:
    print("test_readiness import bloğu yine bulunamadı. İlk 90 satır:")
    for i, line in enumerate(s.splitlines()[:90], 1):
        print(f"{i}: {line}")
    raise SystemExit(1)

insert_at = m.end()
to_add = ""
for block in required_imports:
    source = block.split('from "')[1].split('"')[0]
    if source not in s:
        to_add += "\n" + block

s = s[:insert_at] + to_add + s[insert_at:]
p.write_text(s)

# V43 readiness alias export'larını tamamla
tp = Path("local_demo_data/test_readiness_v42.ts")
t = tp.read_text()

if "TEST_SUMMARY_V43" not in t:
    t += '''

export const TEST_SUMMARY_V43 = {
  title: "V48 TestFlight adayı",
  text: "Bu paket yerel ürün motoru, rutin, analiz, tara önizleme, karar rehberi, profil/üyelik hazırlığı ve güvenli boş ekran korumalarını birlikte taşır.",
};

export const TEST_CHECKLIST_V43 = [
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

export function getReadinessCountV43() {
  return TEST_CHECKLIST_V43.length;
}
'''
else:
    if "getReadinessCountV43" not in t:
        t += '''

export function getReadinessCountV43() {
  return TEST_CHECKLIST_V43.length;
}
'''

tp.write_text(t)

print("V48 full runtime import fix retry uygulandı.")
PY

{
echo ""
echo "=== V48 FULL RUNTIME FIX RETRY SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48" app local_demo_data

echo ""
echo "=== REQUIRED IMPORT CHECK ==="
grep -RInE 'product_detail_v44|routine_plan_v45|analysis_scan_polish_v46|profile_v47|TEST_SUMMARY_V43|TEST_CHECKLIST_V43|getReadinessCountV43' app local_demo_data

echo ""
echo "=== LOCAL IMPORT / EXPORT CONTRACT CHECK ==="
python3 - <<'PY'
from pathlib import Path
import re

app_files = list(Path("app").glob("**/*.tsx")) + list(Path("app").glob("**/*.ts"))
missing = []

def exported_names(path: Path):
    s = path.read_text()
    names = set()
    for pat in [
        r"export\s+const\s+([A-Za-z0-9_]+)",
        r"export\s+function\s+([A-Za-z0-9_]+)",
        r"export\s+class\s+([A-Za-z0-9_]+)",
        r"export\s+type\s+([A-Za-z0-9_]+)",
    ]:
        for m in re.finditer(pat, s):
            names.add(m.group(1))
    return names

for file in app_files:
    s = file.read_text()
    for m in re.finditer(r'import\s*\{([^}]+)\}\s*from\s*"(\.\./local_demo_data/[^"]+)"', s, re.S):
        raw_names = m.group(1)
        rel = m.group(2)
        target = (file.parent / rel).with_suffix(".ts").resolve()
        if not target.exists():
            missing.append((str(file), rel, "TARGET_FILE_MISSING"))
            continue

        exports = exported_names(target)
        for part in raw_names.split(","):
            name = part.strip()
            if not name:
                continue
            name = name.replace("type ", "").split(" as ")[0].strip()
            if name not in exports:
                missing.append((str(file), rel, name))

if missing:
    print("FAIL: Eksik runtime/type export var:")
    for item in missing:
        print(item)
    raise SystemExit(1)

print("PASS: App local_demo_data import/export sözleşmesi temiz.")
PY

echo ""
echo "=== V44-V48 RUNTIME SYMBOL CHECK ==="
python3 - <<'PY'
from pathlib import Path
import re

src = Path("app/index.tsx").read_text()
symbols = [
  "buildProductDetailV44",
  "getScoreLabelV44",
  "buildRoutinePlanV45",
  "buildAnalysisPolishV46",
  "buildScanPolishV46",
  "getProfileSummaryV47",
  "LOCAL_MODULE_STATUS_V47",
  "MEMBERSHIP_PREVIEW_V47",
  "PROFILE_MODES_V47",
  "ProfileModeV47",
  "TEST_SUMMARY_V43",
  "TEST_CHECKLIST_V43",
  "getReadinessCountV43",
]

for sym in symbols:
    used = sym in src
    imported = bool(re.search(r'import\s*\{[^}]*\b' + re.escape(sym) + r'\b[^}]*\}', src, re.S))
    print(f"{sym}: used={used} imported={imported}")
    if used and not imported:
        raise SystemExit(f"FAIL: {sym} kullanılıyor ama import yok")

print("PASS: V44-V48 runtime sembolleri importlu.")
PY

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
rm -rf "dist/ecz4_v48_full_runtime_import_fix_retry_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_v48_full_runtime_import_fix_retry_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_v48_full_runtime_import_fix_retry_$STAMP" -type f -name "*.js" | head -1)

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

tar -czf "stable_snapshots/ECZ4_V48_FULL_RUNTIME_IMPORT_FIX_RETRY_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 V48 full runtime import fix retry kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_V48_FULL_RUNTIME_IMPORT_FIX_RETRY_PASS_$STAMP.tar.gz"
} | tee -a "$REPORT_DIR/summary.txt"
