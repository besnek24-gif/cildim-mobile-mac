#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_product_detail_polish_pack_v44_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v44 local_demo_data

cp app/index.tsx "backups/ecz4_v44/index_before_v44_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v44/layout_before_v44_$STAMP.tsx"
cp local_demo_data/products_v37.ts "backups/ecz4_v44/products_v37_before_v44_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/decision_v38.ts "backups/ecz4_v44/decision_v38_before_v44_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/analysis_v39.ts "backups/ecz4_v44/analysis_v39_before_v44_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/scan_v40.ts "backups/ecz4_v44/scan_v40_before_v44_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/ux_guard_v41.ts "backups/ecz4_v44/ux_guard_v41_before_v44_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/test_readiness_v42.ts "backups/ecz4_v44/test_readiness_v42_before_v44_$STAMP.ts" 2>/dev/null || true

cat > local_demo_data/product_detail_v44.ts <<'TS'
import { type LocalProduct } from "./products_v37";

export type ProductDetailV44 = {
  headline: string;
  why: string[];
  usage: string;
  routineRole: string;
  caution: string;
};

export function buildProductDetailV44(product: LocalProduct): ProductDetailV44 {
  return {
    headline: `${product.brand} • ${product.category} • ${product.segment}`,
    why: [
      `${product.score} skor ile yerel demo listede güçlü seçenek olarak görünür.`,
      `${product.routineStep} adımında danışma dilini sadeleştirir.`,
      product.shortBenefit,
    ],
    usage: product.usage,
    routineRole: `${product.routineStep} adımı için ${product.category} kategorisinde konumlanır.`,
    caution: "Bu kart demo amaçlıdır; gerçek ürün verisi bağlanınca içerik, uygunluk ve kullanım notları ayrıntılanacaktır.",
  };
}

export function getScoreLabelV44(score: number) {
  if (score >= 90) return "Çok güçlü eşleşme";
  if (score >= 85) return "Güçlü eşleşme";
  if (score >= 80) return "Uygun eşleşme";
  return "Temel eşleşme";
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_SCAN_VISIBILITY_PACK_V43" not in s:
    print("V43 marker bulunamadı. Önce V43 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_SCAN_VISIBILITY_PACK_V43", "ECZ4_PRODUCT_DETAIL_POLISH_PACK_V44")
s = s.replace("Tarama görünürlüğü paketi", "Ürün detay parlatma paketi")
s = s.replace(
    "Tara bölümündeki seçimler büyütüldü; seçili akış, kalite, endişe ve cilt hissi açıkça görünür.",
    "Ürün detayları, neden önerildiği ve rutin rolü daha okunur hale getirildi."
)
s = s.replace('<StatusCard value="V43" label="Tara görünür" />', '<StatusCard value="V44" label="Ürün detay" />')
s = s.replace("V43 durumu", "V44 durumu")
s = s.replace(
    "Tara ekranı artık daha belirgin seçim kartlarıyla okunur.",
    "Ürün seçimi artık daha net detay ve öneri gerekçesi gösterir."
)
s = s.replace(
    "Tara ekranındaki akış tipi, kalite, endişe ve cilt hissi seçimleri büyük kartlarla gösterilir.",
    "Ürün ekranında seçili ürünün kullanım dili, rutin rolü ve neden önerildiği ayrı ayrı görünür."
)

if 'from "../local_demo_data/product_detail_v44"' not in s:
    s = s.replace(
        'import {\n  TEST_CHECKLIST_V42,\n  TEST_SUMMARY_V42,\n  getReadinessCountV42,\n} from "../local_demo_data/test_readiness_v42";',
        'import {\n  TEST_CHECKLIST_V42,\n  TEST_SUMMARY_V42,\n  getReadinessCountV42,\n} from "../local_demo_data/test_readiness_v42";\nimport {\n  buildProductDetailV44,\n  getScoreLabelV44,\n} from "../local_demo_data/product_detail_v44";'
    )

if "const selectedProductDetail = useMemo(" not in s:
    s = s.replace(
        'const selectedProduct = getProductById(selectedProductId);',
        'const selectedProduct = getProductById(selectedProductId);\n  const selectedProductDetail = useMemo(() => buildProductDetailV44(selectedProduct), [selectedProduct]);'
    )

# Ürün ekranında seçili ürün özetini ürün listesinden önce göster
if "Seçili ürün özeti" not in s:
    s = s.replace(
        '<Text style={styles.resultText}>{filteredProducts.length} ürün listeleniyor</Text>',
        '<Text style={styles.resultText}>{filteredProducts.length} ürün listeleniyor</Text>\n\n            <View style={styles.featuredProductBox}>\n              <Text style={styles.featuredLabel}>Seçili ürün özeti</Text>\n              <Text style={styles.featuredTitle}>{selectedProduct.name}</Text>\n              <Text style={styles.featuredMeta}>{selectedProductDetail.headline}</Text>\n              <Text style={styles.featuredScore}>{getScoreLabelV44(selectedProduct.score)} • {selectedProduct.score}</Text>\n            </View>'
    )

# Eski InfoBox detayını daha güçlü detay bloğuyla değiştir
old = '<InfoBox title={selectedProduct.name} text={`${selectedProduct.detail} ${selectedProduct.usage}`} />'
new = '''<View style={styles.productDetailBox}>
              <Text style={styles.productDetailTitle}>{selectedProduct.name}</Text>
              <Text style={styles.productDetailMeta}>{selectedProductDetail.headline}</Text>

              <Text style={styles.detailSectionTitle}>Neden önerildi?</Text>
              {selectedProductDetail.why.map((line) => (
                <Text key={line} style={styles.detailBullet}>• {line}</Text>
              ))}

              <Text style={styles.detailSectionTitle}>Kullanım dili</Text>
              <Text style={styles.detailParagraph}>{selectedProductDetail.usage}</Text>

              <Text style={styles.detailSectionTitle}>Rutindeki rolü</Text>
              <Text style={styles.detailParagraph}>{selectedProductDetail.routineRole}</Text>

              <Text style={styles.detailNotice}>{selectedProductDetail.caution}</Text>
            </View>'''
if old in s:
    s = s.replace(old, new, 1)

# Analiz ürün tile basınca seçili ürünün detayını daha iyi bağla
s = s.replace(
    'setSelectedProductId(product.id);\n                    go("products");',
    'setSelectedProductId(product.id);\n                    setCategory("Tümü");\n                    setQuery("");\n                    go("products");'
)

# Karar rehberi metnine score label ekle
if "getScoreLabelV44(product.score)" not in s:
    s = s.replace(
        '<Text style={styles.compareScore}>Skor {product.score} • {product.segment} • {product.category}</Text>',
        '<Text style={styles.compareScore}>Skor {product.score} • {getScoreLabelV44(product.score)} • {product.segment} • {product.category}</Text>'
    )

# Styles
if "featuredProductBox" not in s:
    s = s.replace(
        'productList: { marginTop: 12, gap: 12 },',
        '''featuredProductBox: { marginTop: 14, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },
  featuredLabel: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 6 },
  featuredTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },
  featuredMeta: { marginTop: 4, fontSize: 12, lineHeight: 18, color: "#6F746C", fontWeight: "800" },
  featuredScore: { marginTop: 8, fontSize: 13, fontWeight: "900", color: "#2F3A31" },
  productList: { marginTop: 12, gap: 12 },'''
    )

if "productDetailBox" not in s:
    s = s.replace(
        'infoBox: { marginTop: 16, borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },',
        '''productDetailBox: { marginTop: 16, borderRadius: 22, backgroundColor: "#F7F4EE", padding: 16, borderWidth: 1, borderColor: "rgba(107,122,106,0.12)" },
  productDetailTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },
  productDetailMeta: { marginTop: 5, fontSize: 12, lineHeight: 18, fontWeight: "800", color: "#9A642C" },
  detailSectionTitle: { marginTop: 14, fontSize: 13, fontWeight: "900", color: "#26342A" },
  detailBullet: { marginTop: 5, fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "700" },
  detailParagraph: { marginTop: 5, fontSize: 12, lineHeight: 18, color: "#5D665C" },
  detailNotice: { marginTop: 14, fontSize: 12, lineHeight: 18, color: "#6F746C", fontWeight: "800" },
  infoBox: { marginTop: 16, borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },'''
    )

p.write_text(s)
print("V44 product detail polish patch uygulandı.")
PY

{
echo "=== V44 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_PRODUCT_DETAIL_POLISH_PACK_V44" app local_demo_data

echo ""
echo "=== PRODUCT DETAIL PRESENCE CHECK ==="
grep -RInE 'product_detail_v44|buildProductDetailV44|selectedProductDetail|productDetailBox|featuredProductBox' app local_demo_data

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
rm -rf "dist/ecz4_product_detail_polish_pack_v44_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_product_detail_polish_pack_v44_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_product_detail_polish_pack_v44_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_PRODUCT_DETAIL_POLISH_PACK_V44" "$BUNDLE"
echo "PASS: V44 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_PRODUCT_DETAIL_POLISH_PACK_V44_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 product detail polish pack v44 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_PRODUCT_DETAIL_POLISH_PACK_V44_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
