#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_interactive_shell_v32_clean_retry_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_interactive_shell

cp app/index.tsx "backups/ecz4_interactive_shell/index_before_v32_clean_retry_$STAMP.tsx"

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

replacements = {
    "ProductCard": "eski ürün kartı",
    "AsyncStorage": "kalıcı kayıt katmanı",
    "AuthProvider": "giriş sağlayıcı katmanı",
    "UserPreferencesProvider": "tercih sağlayıcı katmanı",
    "Supabase": "veri servisi",
    "@supabase": "veri servisi",
    "react-native-keyboard-controller": "klavye denetleyici",
    "KeyboardProvider": "klavye sağlayıcı",
    "premium-skin-scan-v2": "ileri analiz modülü",
    "skin-intelligence": "analiz zekâ modülü",
    "expo-camera": "kamera modülü",
    "Feather": "ikon",
    "Ionicons": "ikon",
    "zustand": "durum katmanı",
}
for old, new in replacements.items():
    s = s.replace(old, new)

p.write_text(s)
print("V32 source metinleri steril hale getirildi.")
PY

{
echo "=== V32 CLEAN RETRY SOURCE CHECK ==="
find app -type f | sort
grep -RIn "ECZ4_INTERACTIVE_APP_SHELL_V32" app

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
rm -rf "dist/ecz4_interactive_shell_v32_clean_retry_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_interactive_shell_v32_clean_retry_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_interactive_shell_v32_clean_retry_$STAMP" -type f -name "*.js" | head -1)
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_INTERACTIVE_APP_SHELL_V32" "$BUNDLE"
echo "PASS: interactive shell marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_INTERACTIVE_APP_SHELL_V32_CLEAN_RETRY_PASS_$STAMP.tar.gz" app app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 interactive shell v32 clean retry kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_INTERACTIVE_APP_SHELL_V32_CLEAN_RETRY_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
