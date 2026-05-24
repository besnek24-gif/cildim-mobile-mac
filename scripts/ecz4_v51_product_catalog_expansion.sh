#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_v51_product_catalog_expansion_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v51_catalog

cp app/index.tsx "backups/ecz4_v51_catalog/index_before_v51_$STAMP.tsx"
cp -R local_demo_data "backups/ecz4_v51_catalog/local_demo_data_before_v51_$STAMP"

cat > local_demo_data/catalog_v51.ts <<'TS'
import { LOCAL_PRODUCTS, PRODUCT_CATEGORIES, type Concern, type LocalProduct, type ProductCategory } from "./products_v37";

export type CatalogCategoryV51 = {
  title: ProductCategory;
  count: number;
  topProduct: LocalProduct;
  scoreAverage: number;
};

export type ProductInsightV51 = {
  headline: string;
  reason: string;
  usage: string;
  routineRole: string;
  decisionScore: string;
  tags: string[];
};

export function getCatalogCategoriesV51(): CatalogCategoryV51[] {
  return PRODUCT_CATEGORIES
    .filter((category): category is ProductCategory => category !== "Tümü")
    .map((category) => {
      const products = LOCAL_PRODUCTS.filter((item) => item.category === category);
      const topProduct = [...products].sort((a, b) => b.score - a.score)[0] ?? LOCAL_PRODUCTS[0];
      const scoreAverage = products.length
        ? Math.round(products.reduce((sum, item) => sum + item.score, 0) / products.length)
        : topProduct.score;

      return {
        title: category,
        count: products.length,
        topProduct,
        scoreAverage,
      };
    });
}

export function buildProductInsightV51(product: LocalProduct, concern: Concern): ProductInsightV51 {
  return {
    headline: `${product.brand} ${product.category} kategorisinde ${concern} odağına yakın duruyor.`,
    reason: `${product.shortBenefit} Skoru ${product.score}; bu yüzden demo katalog içinde öne çıkan seçeneklerden biri.`,
    usage: product.usage,
    routineRole: `${product.routineStep} adımında konumlanır. Rutin içinde sade ve anlaşılır bir rol üstlenir.`,
    decisionScore: product.score >= 90 ? "Çok güçlü eşleşme" : product.score >= 85 ? "Güçlü eşleşme" : "Uygun eşleşme",
    tags: [product.category, product.segment, product.routineStep, `${product.score} skor`],
  };
}

export function getConcernShowcaseV51(concern: Concern) {
  const pool = LOCAL_PRODUCTS
    .filter((item) => item.concern.includes(concern))
    .sort((a, b) => b.score - a.score);

  return {
    title: `${concern} vitrini`,
    subtitle: `${pool.length} ürün bu endişeyle ilişkilendirildi.`,
    products: pool.slice(0, 4),
  };
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_FULL_VISUAL_APP_REBUILD_V50" not in s:
    print("V50 marker bulunamadı. Önce V50 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_FULL_VISUAL_APP_REBUILD_V50", "ECZ4_PRODUCT_CATALOG_EXPANSION_V51")
s = s.replace(
    "Bu sürüm yerel verilerle çalışan, hızlı test edilebilir görsel uygulama iskeletidir.",
    "Bu sürüm ürün katalog vitrini, detay paneli ve karar açıklaması güçlendirilmiş yerel uygulama adayıdır."
)

if 'from "../local_demo_data/catalog_v51"' not in s:
    marker = 'import {\n  SCAN_ENTRY_MODES,\n  SCAN_QUALITY_LEVELS,\n  type ScanEntryMode,\n  type ScanQuality,\n  buildScanPreviewV40,\n} from "../local_demo_data/scan_v40";'
    add = marker + '\nimport {\n  buildProductInsightV51,\n  getCatalogCategoriesV51,\n  getConcernShowcaseV51,\n} from "../local_demo_data/catalog_v51";'
    s = s.replace(marker, add)

# Add memo values
if "catalogCategories" not in s:
    s = s.replace(
        'const selectedProduct = getProductById(selectedProductId);',
        'const selectedProduct = getProductById(selectedProductId);\n  const catalogCategories = useMemo(() => getCatalogCategoriesV51(), []);\n  const selectedInsight = useMemo(() => buildProductInsightV51(selectedProduct, concern), [selectedProduct, concern]);\n  const concernShowcase = useMemo(() => getConcernShowcaseV51(concern), [concern]);'
    )

# Pass new props to home
s = s.replace(
    'bestProducts={bestProducts}\n              selectedProduct={selectedProduct}',
    'bestProducts={bestProducts}\n              selectedProduct={selectedProduct}\n              concernShowcase={concernShowcase}'
)

# Pass new props to products
s = s.replace(
    'filteredProducts={filteredProducts}\n              selectedProduct={selectedProduct}',
    'filteredProducts={filteredProducts}\n              selectedProduct={selectedProduct}\n              selectedInsight={selectedInsight}\n              catalogCategories={catalogCategories}'
)

# Update HomeScreen signature
s = s.replace(
    '''  bestProducts,
  selectedProduct,
}: {
  setScreen: (screen: ScreenKey) => void;
  concern: Concern;
  setConcern: (concern: Concern) => void;
  bestProducts: LocalProduct[];
  selectedProduct: LocalProduct;
}) {''',
    '''  bestProducts,
  selectedProduct,
  concernShowcase,
}: {
  setScreen: (screen: ScreenKey) => void;
  concern: Concern;
  setConcern: (concern: Concern) => void;
  bestProducts: LocalProduct[];
  selectedProduct: LocalProduct;
  concernShowcase: ReturnType<typeof getConcernShowcaseV51>;
}) {'''
)

# Add showcase to home after spotlight card
if "homeCatalogPreview" not in s:
    s = s.replace(
        '''      <View style={styles.spotlightCard}>
        <Text style={styles.spotlightLabel}>Öne çıkan ürün</Text>
        <Text style={styles.spotlightTitle}>{bestProducts[0]?.name ?? selectedProduct.name}</Text>
        <Text style={styles.spotlightText}>{bestProducts[0]?.shortBenefit ?? selectedProduct.shortBenefit}</Text>
        <Pressable style={styles.primaryButton} onPress={() => setScreen("products")}>
          <Text style={styles.primaryButtonText}>Ürünleri gör</Text>
        </Pressable>
      </View>''',
        '''      <View style={styles.spotlightCard}>
        <Text style={styles.spotlightLabel}>Öne çıkan ürün</Text>
        <Text style={styles.spotlightTitle}>{bestProducts[0]?.name ?? selectedProduct.name}</Text>
        <Text style={styles.spotlightText}>{bestProducts[0]?.shortBenefit ?? selectedProduct.shortBenefit}</Text>
        <Pressable style={styles.primaryButton} onPress={() => setScreen("products")}>
          <Text style={styles.primaryButtonText}>Ürünleri gör</Text>
        </Pressable>
      </View>

      <View style={styles.homeCatalogPreview}>
        <Text style={styles.previewKicker}>{concernShowcase.title}</Text>
        <Text style={styles.previewTitle}>Katalog önizlemesi</Text>
        <Text style={styles.previewText}>{concernShowcase.subtitle}</Text>
        <View style={styles.previewProductRow}>
          {concernShowcase.products.slice(0, 3).map((product) => (
            <View key={product.id} style={styles.previewMiniCard}>
              <Text style={styles.previewMiniBrand}>{product.brand}</Text>
              <Text style={styles.previewMiniName}>{product.name}</Text>
            </View>
          ))}
        </View>
      </View>'''
    )

# Update ProductsScreen signature
s = s.replace(
    '''  filteredProducts,
  selectedProduct,
  setSelectedProductId,
}: {
  query: string;
  setQuery: (value: string) => void;
  category: "Tümü" | ProductCategory;
  setCategory: (value: "Tümü" | ProductCategory) => void;
  concern: Concern;
  setConcern: (value: Concern) => void;
  filteredProducts: LocalProduct[];
  selectedProduct: LocalProduct;
  setSelectedProductId: (value: string) => void;
}) {''',
    '''  filteredProducts,
  selectedProduct,
  selectedInsight,
  catalogCategories,
  setSelectedProductId,
}: {
  query: string;
  setQuery: (value: string) => void;
  category: "Tümü" | ProductCategory;
  setCategory: (value: "Tümü" | ProductCategory) => void;
  concern: Concern;
  setConcern: (value: Concern) => void;
  filteredProducts: LocalProduct[];
  selectedProduct: LocalProduct;
  selectedInsight: ReturnType<typeof buildProductInsightV51>;
  catalogCategories: ReturnType<typeof getCatalogCategoriesV51>;
  setSelectedProductId: (value: string) => void;
}) {'''
)

# Add catalog categories after intro
if "catalogStrip" not in s:
    s = s.replace(
        '''      <ScreenIntro
        badge="Ürün"
        title="Ürün önerileri"
        text="Endişe, kategori ve arama metnine göre ürünleri görsel kartlarla incele."
      />''',
        '''      <ScreenIntro
        badge="Ürün"
        title="Ürün önerileri"
        text="Endişe, kategori ve arama metnine göre ürünleri görsel kartlarla incele."
      />

      <View style={styles.catalogStrip}>
        {catalogCategories.map((item) => (
          <Pressable
            key={item.title}
            style={[styles.catalogCategoryCard, category === item.title && styles.catalogCategoryCardActive]}
            onPress={() => setCategory(item.title)}
          >
            <Text style={[styles.catalogCategoryTitle, category === item.title && styles.catalogCategoryTitleActive]}>{item.title}</Text>
            <Text style={[styles.catalogCategoryText, category === item.title && styles.catalogCategoryTextActive]}>
              {item.count} ürün • ort. {item.scoreAverage}
            </Text>
          </Pressable>
        ))}
      </View>'''
    )

# Replace selected product card body
old = '''      <View style={styles.selectedItemCard}>
        <Text style={styles.selectedLabel}>Seçili ürün</Text>
        <Text style={styles.selectedTitle}>{selectedProduct.name}</Text>
        <Text style={styles.selectedMeta}>{selectedProduct.brand} • {selectedProduct.category} • Skor {selectedProduct.score}</Text>
        <Text style={styles.selectedText}>{selectedProduct.detail}</Text>
      </View>'''
new = '''      <View style={styles.selectedItemCard}>
        <View style={styles.detailHeaderRow}>
          <View style={styles.largeFakeImage}>
            <Text style={styles.largeFakeImageText}>{selectedProduct.brand.slice(0, 1)}</Text>
          </View>
          <View style={styles.detailHeaderText}>
            <Text style={styles.selectedLabel}>Seçili ürün</Text>
            <Text style={styles.selectedTitle}>{selectedProduct.name}</Text>
            <Text style={styles.selectedMeta}>{selectedProduct.brand} • {selectedProduct.category}</Text>
          </View>
        </View>

        <View style={styles.insightBox}>
          <Text style={styles.insightBadge}>{selectedInsight.decisionScore}</Text>
          <Text style={styles.insightHeadline}>{selectedInsight.headline}</Text>
          <Text style={styles.insightText}>{selectedInsight.reason}</Text>
        </View>

        <View style={styles.insightSection}>
          <Text style={styles.insightSectionTitle}>Kullanım</Text>
          <Text style={styles.insightText}>{selectedInsight.usage}</Text>
        </View>

        <View style={styles.insightSection}>
          <Text style={styles.insightSectionTitle}>Rutindeki rolü</Text>
          <Text style={styles.insightText}>{selectedInsight.routineRole}</Text>
        </View>

        <View style={styles.tagRow}>
          {selectedInsight.tags.map((tag) => (
            <Text key={tag} style={styles.detailTag}>{tag}</Text>
          ))}
        </View>
      </View>'''
if old in s:
    s = s.replace(old, new, 1)
else:
    print("Seçili ürün kartı eski formatta bulunamadı; atlandı.")

# Insert styles before footerCard
style_anchor = '  footerCard: {'
style_block = '''  homeCatalogPreview: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  previewKicker: {
    color: "#AA7A3A",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },
  previewTitle: {
    color: "#243428",
    fontSize: 20,
    fontWeight: "900",
  },
  previewText: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "700",
  },
  previewProductRow: {
    gap: 8,
    marginTop: 12,
  },
  previewMiniCard: {
    borderRadius: 16,
    backgroundColor: "#F8FAF7",
    padding: 12,
  },
  previewMiniBrand: {
    color: "#AA7A3A",
    fontSize: 11,
    fontWeight: "900",
  },
  previewMiniName: {
    color: "#243428",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },
  catalogStrip: {
    gap: 10,
  },
  catalogCategoryCard: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  catalogCategoryCardActive: {
    backgroundColor: "#243428",
    borderColor: "#243428",
  },
  catalogCategoryTitle: {
    color: "#243428",
    fontSize: 15,
    fontWeight: "900",
  },
  catalogCategoryTitleActive: {
    color: "#FFFFFF",
  },
  catalogCategoryText: {
    color: "#626A61",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  catalogCategoryTextActive: {
    color: "#DCE4DB",
  },
  detailHeaderRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  largeFakeImage: {
    width: 92,
    height: 116,
    borderRadius: 26,
    backgroundColor: "#E8ECE4",
    alignItems: "center",
    justifyContent: "center",
  },
  largeFakeImageText: {
    color: "#243428",
    fontSize: 38,
    fontWeight: "900",
  },
  detailHeaderText: {
    flex: 1,
  },
  insightBox: {
    borderRadius: 20,
    backgroundColor: "#F8FAF7",
    padding: 14,
    marginTop: 16,
  },
  insightBadge: {
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },
  insightHeadline: {
    color: "#243428",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
  },
  insightText: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "700",
  },
  insightSection: {
    marginTop: 13,
  },
  insightSectionTitle: {
    color: "#243428",
    fontSize: 13,
    fontWeight: "900",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  detailTag: {
    borderRadius: 999,
    backgroundColor: "#F4E9D8",
    color: "#8A5A28",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
'''
if style_anchor in s and "catalogStrip" not in s:
    s = s.replace(style_anchor, style_block + style_anchor)

p.write_text(s)
print("V51 product catalog expansion patch uygulandı.")
PY

{
echo "=== V51 SOURCE CHECK ==="
grep -RIn "ECZ4_PRODUCT_CATALOG_EXPANSION_V51" app local_demo_data
grep -RInE "catalog_v51|getCatalogCategoriesV51|buildProductInsightV51|getConcernShowcaseV51|catalogStrip|insightBox" app local_demo_data

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
rm -rf "dist/ecz4_v51_product_catalog_expansion_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_v51_product_catalog_expansion_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_v51_product_catalog_expansion_$STAMP" -type f -name "*.js" | head -1)
if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"
grep -q "ECZ4_PRODUCT_CATALOG_EXPANSION_V51" "$BUNDLE"
echo "PASS: V51 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_PRODUCT_CATALOG_EXPANSION_V51_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 product catalog expansion v51 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_PRODUCT_CATALOG_EXPANSION_V51_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
