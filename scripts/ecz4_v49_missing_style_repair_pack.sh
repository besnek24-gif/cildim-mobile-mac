#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_v49_missing_style_repair_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v49_style_fix

cp app/index.tsx "backups/ecz4_v49_style_fix/index_before_style_repair_$STAMP.tsx"
cp -R local_demo_data "backups/ecz4_v49_style_fix/local_demo_data_before_style_repair_$STAMP"

python3 - <<'PY'
from pathlib import Path
import re

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48" not in s:
    print("V48 runtime fix marker bulunamadı. Aktif dosya beklenen hat değil.")
    raise SystemExit(1)

s = s.replace("ECZ4_FINAL_PRE_TESTFLIGHT_HARDENING_V48", "ECZ4_STYLE_REPAIR_PACK_V49")
s = s.replace("Final TestFlight hazırlık paketi", "Görsel stil tamir paketi")
s = s.replace(
    "V48 final test adayı: ürün, rutin, analiz, tara, karar rehberi ve profil akışları birlikte mühürlendi.",
    "V49 stil tamiri: Tara, ürün, rutin, analiz ve profil kartları yeniden görsel kutularla düzenlendi."
)

style_additions = {
"scanSelectionSummary": 'scanSelectionSummary: { marginTop: 16, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },',
"scanSelectionTitle": 'scanSelectionTitle: { fontSize: 16, fontWeight: "900", color: "#26342A", marginBottom: 10 },',
"summaryRow": 'summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },',
"summaryLabel": 'summaryLabel: { fontSize: 12, fontWeight: "900", color: "#6F746C" },',
"summaryValue": 'summaryValue: { flex: 1, textAlign: "right", fontSize: 12, fontWeight: "900", color: "#26342A" },',
"bigChoiceLabel": 'bigChoiceLabel: { marginTop: 18, marginLeft: 2, fontSize: 15, fontWeight: "900", color: "#26342A" },',
"choiceGrid": 'choiceGrid: { marginTop: 10, gap: 10 },',
"scanChoiceCard": 'scanChoiceCard: { borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, borderWidth: 1, borderColor: "rgba(107,122,106,0.16)" },',
"scanChoiceCardActive": 'scanChoiceCardActive: { backgroundColor: "#2F3A31", borderColor: "#2F3A31" },',
"scanChoiceTitle": 'scanChoiceTitle: { fontSize: 16, fontWeight: "900", color: "#26342A", marginBottom: 5 },',
"scanChoiceTitleActive": 'scanChoiceTitleActive: { color: "#FFFFFF" },',
"scanChoiceText": 'scanChoiceText: { fontSize: 12, lineHeight: 18, color: "#6F746C" },',
"scanChoiceTextActive": 'scanChoiceTextActive: { color: "#DCE3DB" },',
"scanChoiceStatus": 'scanChoiceStatus: { marginTop: 8, fontSize: 12, fontWeight: "900", color: "#9A642C" },',

"featuredProductBox": 'featuredProductBox: { marginTop: 14, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },',
"featuredLabel": 'featuredLabel: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 6 },',
"featuredTitle": 'featuredTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },',
"featuredMeta": 'featuredMeta: { marginTop: 4, fontSize: 12, lineHeight: 18, color: "#6F746C", fontWeight: "800" },',
"featuredScore": 'featuredScore: { marginTop: 8, fontSize: 13, fontWeight: "900", color: "#2F3A31" },',

"productDetailBox": 'productDetailBox: { marginTop: 16, borderRadius: 22, backgroundColor: "#F7F4EE", padding: 16, borderWidth: 1, borderColor: "rgba(107,122,106,0.12)" },',
"productDetailTitle": 'productDetailTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },',
"productDetailMeta": 'productDetailMeta: { marginTop: 5, fontSize: 12, lineHeight: 18, fontWeight: "800", color: "#9A642C" },',
"detailSectionTitle": 'detailSectionTitle: { marginTop: 14, fontSize: 13, fontWeight: "900", color: "#26342A" },',
"detailBullet": 'detailBullet: { marginTop: 5, fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "700" },',
"detailParagraph": 'detailParagraph: { marginTop: 5, fontSize: 12, lineHeight: 18, color: "#5D665C" },',
"detailNotice": 'detailNotice: { marginTop: 14, fontSize: 12, lineHeight: 18, color: "#6F746C", fontWeight: "800" },',

"routineHeroBox": 'routineHeroBox: { marginTop: 16, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },',
"routineHeroLabel": 'routineHeroLabel: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 6 },',
"routineHeroTitle": 'routineHeroTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },',
"routineHeroText": 'routineHeroText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#5D665C" },',
"routineStatsRow": 'routineStatsRow: { flexDirection: "row", gap: 10, marginTop: 14 },',
"routineStatCard": 'routineStatCard: { flex: 1, borderRadius: 16, backgroundColor: "#F8FAF7", padding: 10, alignItems: "center" },',
"routineStatValue": 'routineStatValue: { fontSize: 14, fontWeight: "900", color: "#26342A", textAlign: "center" },',
"routineStatLabel": 'routineStatLabel: { marginTop: 3, fontSize: 10, fontWeight: "900", color: "#6F746C" },',
"routineBlockActive": 'routineBlockActive: { backgroundColor: "#FFFDF8", borderColor: "#F4E9D8" },',
"routineBlockHeader": 'routineBlockHeader: { gap: 4 },',
"routineProductRow": 'routineProductRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 16, backgroundColor: "#FFFFFF", padding: 12 },',
"routineGoText": 'routineGoText: { fontSize: 11, fontWeight: "900", color: "#9A642C", marginTop: 4 },',
"routineTipsBox": 'routineTipsBox: { borderRadius: 16, backgroundColor: "#F4E9D8", padding: 12, marginTop: 2 },',
"routineTipsTitle": 'routineTipsTitle: { fontSize: 12, fontWeight: "900", color: "#26342A", marginBottom: 4 },',
"routineTipText": 'routineTipText: { fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "700" },',

"resultDivider": 'resultDivider: { height: 1, backgroundColor: "rgba(154,100,44,0.20)", marginVertical: 12 },',
"resultBadgeText": 'resultBadgeText: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 5 },',
"resultHeadline": 'resultHeadline: { fontSize: 14, lineHeight: 20, fontWeight: "900", color: "#26342A" },',
"actionGuideBox": 'actionGuideBox: { marginTop: 14, borderRadius: 20, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },',
"actionGuideTitle": 'actionGuideTitle: { fontSize: 15, fontWeight: "900", color: "#26342A", marginBottom: 8 },',
"actionGuideText": 'actionGuideText: { fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "700" },',
"pharmacistNote": 'pharmacistNote: { marginTop: 10, fontSize: 12, lineHeight: 18, color: "#9A642C", fontWeight: "900" },',
"scanSummary": 'scanSummary: { marginTop: 8, fontSize: 13, lineHeight: 19, color: "#5D665C", fontWeight: "700" },',

"profileHeroBox": 'profileHeroBox: { marginTop: 16, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },',
"profileHeroBadge": 'profileHeroBadge: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 6 },',
"profileHeroTitle": 'profileHeroTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },',
"profileHeroText": 'profileHeroText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#5D665C" },',
"moduleStatusList": 'moduleStatusList: { marginTop: 10, gap: 10 },',
"moduleStatusCard": 'moduleStatusCard: { borderRadius: 18, backgroundColor: "#F8FAF7", padding: 14, borderWidth: 1, borderColor: "rgba(107,122,106,0.12)" },',
"moduleStatusTop": 'moduleStatusTop: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },',
"moduleStatusTitle": 'moduleStatusTitle: { flex: 1, fontSize: 14, fontWeight: "900", color: "#26342A" },',
"moduleStatusBadge": 'moduleStatusBadge: { fontSize: 11, fontWeight: "900", color: "#9A642C" },',
"moduleStatusNote": 'moduleStatusNote: { marginTop: 6, fontSize: 12, lineHeight: 18, color: "#5D665C" },',
"membershipItem": 'membershipItem: { marginTop: 6, fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "800" },',

"readinessWarning": 'readinessWarning: { marginTop: 8, fontSize: 12, lineHeight: 18, color: "#9A642C", fontWeight: "900" },',
}

missing = []
for key, line in style_additions.items():
    if not re.search(rf"^\s*{re.escape(key)}\s*:", s, re.M):
        missing.append(line)

if missing:
    last = s.rfind("\n});")
    if last == -1:
        print("StyleSheet kapanışı bulunamadı.")
        raise SystemExit(1)
    insertion = "\n  " + "\n  ".join(missing) + "\n"
    s = s[:last] + insertion + s[last:]

p.write_text(s)
print(f"V49 missing style repair tamam. Eklenen style sayısı: {len(missing)}")
PY

{
echo "=== V49 STYLE SOURCE CHECK ==="
grep -RIn "ECZ4_STYLE_REPAIR_PACK_V49" app local_demo_data

echo ""
echo "=== STYLE PRESENCE CHECK ==="
python3 - <<'PY'
from pathlib import Path
import re

s = Path("app/index.tsx").read_text()
keys = [
"scanChoiceCard","scanSelectionSummary","featuredProductBox","productDetailBox",
"routineHeroBox","routineProductRow","actionGuideBox","profileHeroBox",
"moduleStatusCard","readinessWarning"
]
missing = []
for key in keys:
    if not re.search(rf"^\s*{re.escape(key)}\s*:", s, re.M):
        missing.append(key)
if missing:
    print("FAIL missing styles:", missing)
    raise SystemExit(1)
print("PASS: Kritik V43-V49 stilleri StyleSheet içinde var.")
PY

echo ""
echo "=== LOCAL IMPORT CONTRACT QUICK CHECK ==="
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
        r"export\s+type\s+([A-Za-z0-9_]+)",
    ]:
        for m in re.finditer(pat, s):
            names.add(m.group(1))
    return names

for file in app_files:
    src = file.read_text()
    for m in re.finditer(r'import\s*\{([^}]+)\}\s*from\s*"(\.\./local_demo_data/[^"]+)"', src, re.S):
        target = (file.parent / m.group(2)).with_suffix(".ts").resolve()
        exports = exported_names(target)
        for part in m.group(1).split(","):
            name = part.strip().replace("type ", "").split(" as ")[0].strip()
            if name and name not in exports:
                missing.append((str(file), str(target), name))

if missing:
    print("FAIL:", missing)
    raise SystemExit(1)

print("PASS: import/export sözleşmesi temiz.")
PY

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
rm -rf "dist/ecz4_v49_missing_style_repair_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_v49_missing_style_repair_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_v49_missing_style_repair_$STAMP" -type f -name "*.js" | head -1)
if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_STYLE_REPAIR_PACK_V49" "$BUNDLE"
echo "PASS: V49 marker bundle içinde var."

tar -czf "stable_snapshots/ECZ4_STYLE_REPAIR_PACK_V49_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 style repair pack v49 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_STYLE_REPAIR_PACK_V49_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
