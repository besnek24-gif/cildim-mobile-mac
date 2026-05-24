#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_ux_guard_pack_v41_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v41 local_demo_data

cp app/index.tsx "backups/ecz4_v41/index_before_v41_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v41/layout_before_v41_$STAMP.tsx"
cp local_demo_data/products_v37.ts "backups/ecz4_v41/products_v37_before_v41_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/decision_v38.ts "backups/ecz4_v41/decision_v38_before_v41_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/analysis_v39.ts "backups/ecz4_v41/analysis_v39_before_v41_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/scan_v40.ts "backups/ecz4_v41/scan_v40_before_v41_$STAMP.ts" 2>/dev/null || true

cat > local_demo_data/ux_guard_v41.ts <<'TS'
import { type Concern } from "./products_v37";

export type EmptyStateCopy = {
  title: string;
  text: string;
  action: string;
};

export const SAFE_FLOW_NOTICES = {
  products: "Bu bölüm yerel ürün motoruyla çalışır. Sonuç bulunamazsa filtreler sıfırlanabilir.",
  scan: "Bu adım gerçek görsel işleme yapmaz. Önce güvenli akış, sonra gerçek tarama katmanı gelir.",
  analysis: "Analiz sonucu demo veriden üretilir; ürün ve rutin önerisine güvenli şekilde bağlanır.",
};

export function buildEmptyStateV41(params: {
  query: string;
  category: string;
  concern: Concern;
}): EmptyStateCopy {
  const hasQuery = params.query.trim().length > 0;
  const hasCategory = params.category !== "Tümü";

  if (hasQuery && hasCategory) {
    return {
      title: "Bu arama ve kategoriyle sonuç yok",
      text: `${params.concern} odağında daha geniş sonuç için arama metnini veya kategoriyi sıfırla.`,
      action: "Filtreleri sıfırla",
    };
  }

  if (hasQuery) {
    return {
      title: "Bu aramayla ürün bulunamadı",
      text: "Marka, ürün adı veya endişeyi daha kısa yazarak tekrar dene.",
      action: "Aramayı temizle",
    };
  }

  if (hasCategory) {
    return {
      title: "Bu kategoride uygun ürün yok",
      text: `${params.concern} odağında başka kategori seçerek devam edebilirsin.`,
      action: "Kategoriyi sıfırla",
    };
  }

  return {
    title: "Uygun ürün bulunamadı",
    text: "Endişe seçimini değiştirerek yeni öneri listesi oluştur.",
    action: "Filtreleri sıfırla",
  };
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_SAFE_SCAN_PLACEHOLDER_PACK_V40" not in s:
    print("V40 marker bulunamadı. Önce V40 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_SAFE_SCAN_PLACEHOLDER_PACK_V40", "ECZ4_UX_GUARD_PACK_V41")
s = s.replace("Güvenli tarama akışı", "Güvenli akış korumaları")
s = s.replace(
    "Tarama önizlemesi, analiz, ürün ve rutin akışı yerel motorla birlikte çalışıyor.",
    "Boş ekran, filtre, tarama ve analiz yönlendirmeleri güvenli korumalarla çalışıyor."
)

if 'from "../local_demo_data/ux_guard_v41"' not in s:
    s = s.replace(
        'import {\n  SCAN_ENTRY_MODES,\n  SCAN_QUALITY_LEVELS,\n  type ScanEntryMode,\n  type ScanQuality,\n  buildScanPreviewV40,\n} from "../local_demo_data/scan_v40";',
        'import {\n  SCAN_ENTRY_MODES,\n  SCAN_QUALITY_LEVELS,\n  type ScanEntryMode,\n  type ScanQuality,\n  buildScanPreviewV40,\n} from "../local_demo_data/scan_v40";\nimport {\n  SAFE_FLOW_NOTICES,\n  buildEmptyStateV41,\n} from "../local_demo_data/ux_guard_v41";'
    )

if "const emptyState = useMemo(" not in s:
    s = s.replace(
        '  const scanPreview = useMemo(\n    () => buildScanPreviewV40({ mode: scanMode, quality: scanQuality, concern, feel: skinFeel, level: routineLevel }),\n    [scanMode, scanQuality, concern, skinFeel, routineLevel],\n  );',
        '  const scanPreview = useMemo(\n    () => buildScanPreviewV40({ mode: scanMode, quality: scanQuality, concern, feel: skinFeel, level: routineLevel }),\n    [scanMode, scanQuality, concern, skinFeel, routineLevel],\n  );\n  const emptyState = useMemo(\n    () => buildEmptyStateV41({ query, category, concern }),\n    [query, category, concern],\n  );'
    )

s = s.replace('<StatusCard value="V40" label="Tarama akışı" />', '<StatusCard value="V41" label="Akış koruması" />')
s = s.replace("V40 durumu", "V41 durumu")
s = s.replace(
    "Tarama önizlemesi analiz ve öneriye bağlanıyor.",
    "Boş ekran ve hata akışları güvenli şekilde yönetiliyor."
)
s = s.replace(
    "Güvenli tarama akışı; endişe, cilt hissi, ürün önerisi ve rutin planını tek hatta bağlar.",
    "Ürün, analiz ve tarama ekranlarında kullanıcı boşta kalmaz; her durumda yönlendirme görünür."
)

# Product notice after product subtitle
if "SAFE_FLOW_NOTICES.products" not in s:
    s = s.replace(
        '<Text style={styles.detailSubtitle}>\n              Ürün listesi analiz seçimi, endişe, kategori ve arama metnine göre şekillenir.\n            </Text>',
        '<Text style={styles.detailSubtitle}>\n              Ürün listesi analiz seçimi, endişe, kategori ve arama metnine göre şekillenir.\n            </Text>\n\n            <GuardNotice text={SAFE_FLOW_NOTICES.products} />'
    )

# Analysis notice
if "SAFE_FLOW_NOTICES.analysis" not in s:
    s = s.replace(
        '<Text style={styles.detailSubtitle}>\n              Bu akış gerçek ölçüm almadan analiz ekranı, sonuç dili ve yönlendirme davranışını test eder.\n            </Text>',
        '<Text style={styles.detailSubtitle}>\n              Bu akış gerçek ölçüm almadan analiz ekranı, sonuç dili ve yönlendirme davranışını test eder.\n            </Text>\n\n            <GuardNotice text={SAFE_FLOW_NOTICES.analysis} />'
    )

# Scan notice
if "SAFE_FLOW_NOTICES.scan" not in s:
    s = s.replace(
        '<Text style={styles.detailSubtitle}>\n              Bu ekran gerçek görsel işleme yapmadan tarama deneyimini, izin dilini ve sonuç yönlendirmesini test eder.\n            </Text>',
        '<Text style={styles.detailSubtitle}>\n              Bu ekran gerçek görsel işleme yapmadan tarama deneyimini, izin dilini ve sonuç yönlendirmesini test eder.\n            </Text>\n\n            <GuardNotice text={SAFE_FLOW_NOTICES.scan} />'
    )

# Empty state after result count
if "EmptyStateCard" not in s:
    s = s.replace(
        '<Text style={styles.resultText}>{filteredProducts.length} ürün listeleniyor</Text>\n\n            <View style={styles.productList}>',
        '<Text style={styles.resultText}>{filteredProducts.length} ürün listeleniyor</Text>\n\n            {filteredProducts.length === 0 ? (\n              <EmptyStateCard\n                title={emptyState.title}\n                text={emptyState.text}\n                action={emptyState.action}\n                onPress={() => {\n                  setQuery("");\n                  setCategory("Tümü");\n                }}\n              />\n            ) : null}\n\n            <View style={styles.productList}>'
    )

# Footer update
s = s.replace(
    "Bu sürüm gerçek veri, gerçek görsel işleme, giriş ve eski ağır bileşenleri içermez. Tarama akışı yerel ve izoledir.",
    "Bu sürüm gerçek veri, gerçek görsel işleme, giriş ve eski ağır bileşenleri içermez. Boş ekran ve hata korumaları yereldir."
)

# Components before ProfileLine
if "function GuardNotice" not in s:
    s = s.replace(
        'function ProfileLine({ label, value }: { label: string; value: string }) {',
        '''function GuardNotice({ text }: { text: string }) {
  return (
    <View style={styles.guardNotice}>
      <Text style={styles.guardText}>{text}</Text>
    </View>
  );
}

function EmptyStateCard({
  title,
  text,
  action,
  onPress,
}: {
  title: string;
  text: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyStateBox}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <Pressable style={styles.resetButton} onPress={onPress}>
        <Text style={styles.resetButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {'''
    )

# Styles
if "guardNotice" not in s:
    s = s.replace(
        'infoBox: { marginTop: 16, borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },',
        'guardNotice: { marginTop: 14, borderRadius: 18, backgroundColor: "#EDF1EA", padding: 13, borderWidth: 1, borderColor: "rgba(107,122,106,0.16)" },\n  guardText: { fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "800" },\n  emptyStateBox: { marginTop: 14, borderRadius: 20, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },\n  emptyTitle: { fontSize: 15, fontWeight: "900", color: "#26342A", marginBottom: 6 },\n  emptyText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },\n  resetButton: { marginTop: 12, alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#2F3A31", paddingVertical: 9, paddingHorizontal: 14 },\n  resetButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },\n  infoBox: { marginTop: 16, borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },'
    )

p.write_text(s)
print("V41 UX guard patch uygulandı.")
PY

{
echo "=== V41 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_UX_GUARD_PACK_V41" app local_demo_data

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
rm -rf "dist/ecz4_ux_guard_pack_v41_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_ux_guard_pack_v41_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_ux_guard_pack_v41_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_UX_GUARD_PACK_V41" "$BUNDLE"
echo "PASS: V41 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_UX_GUARD_PACK_V41_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 UX guard pack v41 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_UX_GUARD_PACK_V41_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
