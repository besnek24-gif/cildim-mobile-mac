#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_v52_local_state_favorites_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v52_state

cp app/index.tsx "backups/ecz4_v52_state/index_before_v52_$STAMP.tsx"
cp -R local_demo_data "backups/ecz4_v52_state/local_demo_data_before_v52_$STAMP"

cat > local_demo_data/local_state_v52.ts <<'TS'
import { LOCAL_PRODUCTS, type Concern, type LocalProduct } from "./products_v37";

export type LocalStateSummaryV52 = {
  title: string;
  favoriteLine: string;
  recentLine: string;
  routineLine: string;
  status: string;
};

export function buildLocalStateSummaryV52(params: {
  favoriteCount: number;
  recentCount: number;
  savedRoutineConcern: Concern | null;
}): LocalStateSummaryV52 {
  return {
    title: "Yerel kullanım özeti",
    favoriteLine: `${params.favoriteCount} favori ürün`,
    recentLine: `${params.recentCount} son bakılan ürün`,
    routineLine: params.savedRoutineConcern
      ? `${params.savedRoutineConcern} rutini kaydedildi`
      : "Henüz rutin kaydı yok",
    status: params.favoriteCount || params.recentCount || params.savedRoutineConcern
      ? "Aktif kullanım simülasyonu"
      : "Yeni kullanıcı görünümü",
  };
}

export function buildRecentProductsV52(ids: string[]): LocalProduct[] {
  return ids
    .map((id) => LOCAL_PRODUCTS.find((item) => item.id === id))
    .filter(Boolean) as LocalProduct[];
}

export function buildFavoriteProductsV52(ids: string[]): LocalProduct[] {
  return ids
    .map((id) => LOCAL_PRODUCTS.find((item) => item.id === id))
    .filter(Boolean) as LocalProduct[];
}
TS

python3 - <<'PY'
from pathlib import Path

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_PRODUCT_CATALOG_EXPANSION_V51" not in s:
    print("V51 marker bulunamadı. Önce V51 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_PRODUCT_CATALOG_EXPANSION_V51", "ECZ4_LOCAL_STATE_FAVORITES_V52")
s = s.replace(
    "Bu sürüm ürün katalog vitrini, detay paneli ve karar açıklaması güçlendirilmiş yerel uygulama adayıdır.",
    "Bu sürüm favori, son bakılan ürün ve rutin kaydı simülasyonuyla daha gerçek uygulama hissi verir."
)

if 'from "../local_demo_data/local_state_v52"' not in s:
    marker = 'import {\n  buildProductInsightV51,\n  getCatalogCategoriesV51,\n  getConcernShowcaseV51,\n} from "../local_demo_data/catalog_v51";'
    add = marker + '\nimport {\n  buildFavoriteProductsV52,\n  buildLocalStateSummaryV52,\n  buildRecentProductsV52,\n} from "../local_demo_data/local_state_v52";'
    s = s.replace(marker, add)

# State ekle
if "favoriteProductIds" not in s:
    s = s.replace(
        'const [selectedProductId, setSelectedProductId] = useState(LOCAL_PRODUCTS[0].id);',
        'const [selectedProductId, setSelectedProductId] = useState(LOCAL_PRODUCTS[0].id);\n  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);\n  const [visitedProductIds, setVisitedProductIds] = useState<string[]>([]);\n  const [savedRoutineConcern, setSavedRoutineConcern] = useState<Concern | null>(null);'
    )

# Derived state + handlers
if "selectProductV52" not in s:
    s = s.replace(
        'const selectedProduct = getProductById(selectedProductId);',
        '''const selectedProduct = getProductById(selectedProductId);
  const favoriteProducts = useMemo(() => buildFavoriteProductsV52(favoriteProductIds), [favoriteProductIds]);
  const recentProducts = useMemo(() => buildRecentProductsV52(visitedProductIds), [visitedProductIds]);
  const localStateSummary = useMemo(
    () => buildLocalStateSummaryV52({
      favoriteCount: favoriteProductIds.length,
      recentCount: visitedProductIds.length,
      savedRoutineConcern,
    }),
    [favoriteProductIds.length, visitedProductIds.length, savedRoutineConcern],
  );

  const selectProductV52 = (productId: string) => {
    setSelectedProductId(productId);
    setVisitedProductIds((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, 5));
  };

  const toggleFavoriteV52 = (productId: string) => {
    setFavoriteProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [productId, ...prev],
    );
  };'''
    )

# Home props
s = s.replace(
    'concernShowcase={concernShowcase}',
    'concernShowcase={concernShowcase}\n              localStateSummary={localStateSummary}\n              favoriteProducts={favoriteProducts}\n              recentProducts={recentProducts}'
)

# Products props
s = s.replace(
    'setSelectedProductId={setSelectedProductId}',
    'setSelectedProductId={selectProductV52}\n              favoriteProductIds={favoriteProductIds}\n              toggleFavorite={toggleFavoriteV52}\n              recentProducts={recentProducts}\n              localStateSummary={localStateSummary}'
)

# Routine props
s = s.replace(
    'setSelectedProductId={setSelectedProductId}',
    'setSelectedProductId={selectProductV52}\n              savedRoutineConcern={savedRoutineConcern}\n              setSavedRoutineConcern={setSavedRoutineConcern}',
    1
)

# Profile props
s = s.replace(
    '{screen === "profile" && <ProfileScreen />}',
    '{screen === "profile" && <ProfileScreen localStateSummary={localStateSummary} favoriteProducts={favoriteProducts} recentProducts={recentProducts} />}'
)

# Home signature
s = s.replace(
'''  selectedProduct,
  concernShowcase,
}: {
  setScreen: (screen: ScreenKey) => void;
  concern: Concern;
  setConcern: (concern: Concern) => void;
  bestProducts: LocalProduct[];
  selectedProduct: LocalProduct;
  concernShowcase: ReturnType<typeof getConcernShowcaseV51>;
}) {''',
'''  selectedProduct,
  concernShowcase,
  localStateSummary,
  favoriteProducts,
  recentProducts,
}: {
  setScreen: (screen: ScreenKey) => void;
  concern: Concern;
  setConcern: (concern: Concern) => void;
  bestProducts: LocalProduct[];
  selectedProduct: LocalProduct;
  concernShowcase: ReturnType<typeof getConcernShowcaseV51>;
  localStateSummary: ReturnType<typeof buildLocalStateSummaryV52>;
  favoriteProducts: LocalProduct[];
  recentProducts: LocalProduct[];
}) {'''
)

# Home state card after hero
if "stateDashboardCard" not in s:
    s = s.replace(
'''      <SectionTitle title="Hızlı başlangıç" />''',
'''      <View style={styles.stateDashboardCard}>
        <Text style={styles.stateDashboardKicker}>{localStateSummary.status}</Text>
        <Text style={styles.stateDashboardTitle}>{localStateSummary.title}</Text>
        <Text style={styles.stateDashboardText}>{localStateSummary.favoriteLine} • {localStateSummary.recentLine}</Text>
        <Text style={styles.stateDashboardText}>{localStateSummary.routineLine}</Text>

        <View style={styles.stateMiniRow}>
          <Text style={styles.stateMiniPill}>Favori {favoriteProducts.length}</Text>
          <Text style={styles.stateMiniPill}>Geçmiş {recentProducts.length}</Text>
        </View>
      </View>

      <SectionTitle title="Hızlı başlangıç" />'''
    )

# Products signature
s = s.replace(
'''  selectedProduct,
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
}) {''',
'''  selectedProduct,
  selectedInsight,
  catalogCategories,
  setSelectedProductId,
  favoriteProductIds,
  toggleFavorite,
  recentProducts,
  localStateSummary,
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
  favoriteProductIds: string[];
  toggleFavorite: (value: string) => void;
  recentProducts: LocalProduct[];
  localStateSummary: ReturnType<typeof buildLocalStateSummaryV52>;
}) {'''
)

# Selected product favorite button
if "Favoriye ekle" not in s:
    s = s.replace(
'''        <View style={styles.tagRow}>
          {selectedInsight.tags.map((tag) => (
            <Text key={tag} style={styles.detailTag}>{tag}</Text>
          ))}
        </View>
      </View>''',
'''        <View style={styles.tagRow}>
          {selectedInsight.tags.map((tag) => (
            <Text key={tag} style={styles.detailTag}>{tag}</Text>
          ))}
        </View>

        <Pressable style={styles.favoriteWideButton} onPress={() => toggleFavorite(selectedProduct.id)}>
          <Text style={styles.favoriteWideButtonText}>
            {favoriteProductIds.includes(selectedProduct.id) ? "Favoriden çıkar" : "Favoriye ekle"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.localStateStrip}>
        <Text style={styles.localStateTitle}>{localStateSummary.title}</Text>
        <Text style={styles.localStateText}>{localStateSummary.favoriteLine} • {localStateSummary.recentLine}</Text>
        {recentProducts.length > 0 ? (
          <View style={styles.recentList}>
            {recentProducts.slice(0, 3).map((item) => (
              <Text key={item.id} style={styles.recentItem}>{item.name}</Text>
            ))}
          </View>
        ) : null}
      </View>'''
    )

# Product tile props
s = s.replace(
'''            <LocalProductTile
              key={product.id}
              product={product}
              active={product.id === selectedProduct.id}
              onPress={() => setSelectedProductId(product.id)}
            />''',
'''            <LocalProductTile
              key={product.id}
              product={product}
              active={product.id === selectedProduct.id}
              favorite={favoriteProductIds.includes(product.id)}
              onPress={() => setSelectedProductId(product.id)}
              onFavorite={() => toggleFavorite(product.id)}
            />'''
)

# Routine signature
s = s.replace(
'''  setScreen,
  setSelectedProductId,
}: {
  concern: Concern;
  setConcern: (value: Concern) => void;
  routineBlocks: ReturnType<typeof getRoutineBlocksV38>;
  setScreen: (screen: ScreenKey) => void;
  setSelectedProductId: (value: string) => void;
}) {''',
'''  setScreen,
  setSelectedProductId,
  savedRoutineConcern,
  setSavedRoutineConcern,
}: {
  concern: Concern;
  setConcern: (value: Concern) => void;
  routineBlocks: ReturnType<typeof getRoutineBlocksV38>;
  setScreen: (screen: ScreenKey) => void;
  setSelectedProductId: (value: string) => void;
  savedRoutineConcern: Concern | null;
  setSavedRoutineConcern: (value: Concern | null) => void;
}) {'''
)

# Routine save panel after intro
if "routineSaveCard" not in s:
    s = s.replace(
'''      <ScreenIntro
        badge="Rutin"
        title={`${concern} bakım planı`}
        text="Sabah ve akşam adımlarını ürün kartlarıyla takip et."
      />''',
'''      <ScreenIntro
        badge="Rutin"
        title={`${concern} bakım planı`}
        text="Sabah ve akşam adımlarını ürün kartlarıyla takip et."
      />

      <View style={styles.routineSaveCard}>
        <Text style={styles.routineSaveTitle}>
          {savedRoutineConcern === concern ? "Bu rutin kaydedildi" : "Rutini kaydet"}
        </Text>
        <Text style={styles.routineSaveText}>
          Bu kayıt gerçek hesap gerektirmez; uygulama içi kullanım hissini simüle eder.
        </Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => setSavedRoutineConcern(savedRoutineConcern === concern ? null : concern)}
        >
          <Text style={styles.secondaryButtonText}>
            {savedRoutineConcern === concern ? "Kaydı kaldır" : "Rutini kaydet"}
          </Text>
        </Pressable>
      </View>'''
    )

# LocalProductTile signature
s = s.replace(
'''  active,
  onPress,
}: {
  product: LocalProduct;
  active: boolean;
  onPress: () => void;
}) {''',
'''  active,
  favorite,
  onPress,
  onFavorite,
}: {
  product: LocalProduct;
  active: boolean;
  favorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
}) {'''
)

# LocalProductTile body add fav button before productMetaRow or after
if "favoriteMiniButton" not in s:
    s = s.replace(
'''        <View style={styles.productMetaRow}>
          <Text style={styles.scorePill}>Skor {product.score}</Text>
          <Text style={styles.segmentPill}>{product.segment}</Text>
        </View>''',
'''        <View style={styles.productMetaRow}>
          <Text style={styles.scorePill}>Skor {product.score}</Text>
          <Text style={styles.segmentPill}>{product.segment}</Text>
          <Pressable style={styles.favoriteMiniButton} onPress={onFavorite}>
            <Text style={styles.favoriteMiniText}>{favorite ? "Favori" : "Kaydet"}</Text>
          </Pressable>
        </View>'''
    )

# ProfileScreen signature/body
s = s.replace(
'''function ProfileScreen() {
  return (
    <View style={styles.screenBlock}>''',
'''function ProfileScreen({
  localStateSummary,
  favoriteProducts,
  recentProducts,
}: {
  localStateSummary: ReturnType<typeof buildLocalStateSummaryV52>;
  favoriteProducts: LocalProduct[];
  recentProducts: LocalProduct[];
}) {
  return (
    <View style={styles.screenBlock}>'''
)

if "profileStateCard" not in s:
    s = s.replace(
'''      <View style={styles.statusList}>
        <StatusRow title="Ürün motoru" status="Aktif" />''',
'''      <View style={styles.profileStateCard}>
        <Text style={styles.profileStateTitle}>{localStateSummary.title}</Text>
        <Text style={styles.profileStateText}>{localStateSummary.favoriteLine}</Text>
        <Text style={styles.profileStateText}>{localStateSummary.recentLine}</Text>
        <Text style={styles.profileStateText}>{localStateSummary.routineLine}</Text>
        <Text style={styles.profileStateMini}>Favoriler: {favoriteProducts.length} • Son bakılanlar: {recentProducts.length}</Text>
      </View>

      <View style={styles.statusList}>
        <StatusRow title="Ürün motoru" status="Aktif" />'''
    )

# Styles
if "stateDashboardCard" not in s:
    style_anchor = "  footerCard: {"
    style_block = '''  stateDashboardCard: {
    borderRadius: 26,
    backgroundColor: "#FFFDF8",
    padding: 18,
    borderWidth: 1,
    borderColor: "#F4E9D8",
  },
  stateDashboardKicker: {
    color: "#AA7A3A",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  stateDashboardTitle: {
    color: "#243428",
    fontSize: 20,
    fontWeight: "900",
  },
  stateDashboardText: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "700",
  },
  stateMiniRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  stateMiniPill: {
    borderRadius: 999,
    backgroundColor: "#243428",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: "hidden",
  },
  favoriteWideButton: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: "#243428",
    paddingVertical: 13,
    alignItems: "center",
  },
  favoriteWideButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  localStateStrip: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  localStateTitle: {
    color: "#243428",
    fontSize: 16,
    fontWeight: "900",
  },
  localStateText: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    fontWeight: "700",
  },
  recentList: {
    marginTop: 10,
    gap: 6,
  },
  recentItem: {
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
  },
  favoriteMiniButton: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F4E9D8",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  favoriteMiniText: {
    color: "#8A5A28",
    fontSize: 11,
    fontWeight: "900",
  },
  routineSaveCard: {
    borderRadius: 26,
    backgroundColor: "#FFFDF8",
    padding: 18,
    borderWidth: 1,
    borderColor: "#F4E9D8",
  },
  routineSaveTitle: {
    color: "#243428",
    fontSize: 19,
    fontWeight: "900",
  },
  routineSaveText: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "700",
  },
  profileStateCard: {
    borderRadius: 26,
    backgroundColor: "#FFFDF8",
    padding: 18,
    borderWidth: 1,
    borderColor: "#F4E9D8",
  },
  profileStateTitle: {
    color: "#243428",
    fontSize: 19,
    fontWeight: "900",
  },
  profileStateText: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    fontWeight: "700",
  },
  profileStateMini: {
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
  },
'''
    s = s.replace(style_anchor, style_block + style_anchor)

p.write_text(s)
print("V52 local state favorites patch uygulandı.")
PY

{
echo "=== V52 SOURCE CHECK ==="
grep -RIn "ECZ4_LOCAL_STATE_FAVORITES_V52" app local_demo_data
grep -RInE "local_state_v52|favoriteProductIds|visitedProductIds|savedRoutineConcern|favoriteMiniButton|routineSaveCard|profileStateCard" app local_demo_data

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
rm -rf "dist/ecz4_v52_local_state_favorites_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_v52_local_state_favorites_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_v52_local_state_favorites_$STAMP" -type f -name "*.js" | head -1)
if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"
grep -q "ECZ4_LOCAL_STATE_FAVORITES_V52" "$BUNDLE"
echo "PASS: V52 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_LOCAL_STATE_FAVORITES_V52_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 local state favorites v52 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_LOCAL_STATE_FAVORITES_V52_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
