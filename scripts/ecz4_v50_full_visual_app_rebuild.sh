#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_v50_full_visual_app_rebuild_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v50_full_visual

cp app/index.tsx "backups/ecz4_v50_full_visual/index_before_v50_$STAMP.tsx"
cp -R local_demo_data "backups/ecz4_v50_full_visual/local_demo_data_before_v50_$STAMP"

cat > app/index.tsx <<'TSX'
import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CONCERNS,
  LOCAL_PRODUCTS,
  PRODUCT_CATEGORIES,
  type Concern,
  type ProductCategory,
  type LocalProduct,
  filterProducts,
  getProductById,
} from "../local_demo_data/products_v37";

import {
  compareProductsV38,
  getBestProductsForConcern,
  getRoutineBlocksV38,
} from "../local_demo_data/decision_v38";

import {
  ROUTINE_LEVELS,
  SKIN_FEELS,
  type RoutineLevel,
  type SkinFeel,
  buildAnalysisResultV39,
} from "../local_demo_data/analysis_v39";

import {
  SCAN_ENTRY_MODES,
  SCAN_QUALITY_LEVELS,
  type ScanEntryMode,
  type ScanQuality,
  buildScanPreviewV40,
} from "../local_demo_data/scan_v40";

type ScreenKey = "home" | "products" | "routine" | "analysis" | "scan" | "compare" | "profile";

const MARKER = "ECZ4_FULL_VISUAL_APP_REBUILD_V50";

export default function Index() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Tümü" | ProductCategory>("Tümü");
  const [concern, setConcern] = useState<Concern>("Kuruluk");
  const [skinFeel, setSkinFeel] = useState<SkinFeel>("Kuru");
  const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");
  const [scanMode, setScanMode] = useState<ScanEntryMode>("Demo tarama");
  const [scanQuality, setScanQuality] = useState<ScanQuality>("İyi");
  const [selectedProductId, setSelectedProductId] = useState(LOCAL_PRODUCTS[0].id);
  const [compareLeft, setCompareLeft] = useState(LOCAL_PRODUCTS[0].id);
  const [compareRight, setCompareRight] = useState(LOCAL_PRODUCTS[1].id);

  const selectedProduct = getProductById(selectedProductId);

  const filteredProducts = useMemo(
    () => filterProducts({ query, category, concern }),
    [query, category, concern],
  );

  const bestProducts = useMemo(() => getBestProductsForConcern(concern), [concern]);

  const routineBlocks = useMemo(() => getRoutineBlocksV38(concern), [concern]);

  const analysis = useMemo(
    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),
    [concern, skinFeel, routineLevel],
  );

  const scanPreview = useMemo(
    () => buildScanPreviewV40({
      mode: scanMode,
      quality: scanQuality,
      concern,
      feel: skinFeel,
      level: routineLevel,
    }),
    [scanMode, scanQuality, concern, skinFeel, routineLevel],
  );

  const leftProduct = getProductById(compareLeft);
  const rightProduct = getProductById(compareRight);
  const decision = compareProductsV38(leftProduct, rightProduct);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appFrame}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.brandEyebrow}>Cildim</Text>
              <Text style={styles.brandTitle}>{screenTitle(screen)}</Text>
            </View>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>C</Text>
            </View>
          </View>

          <View style={styles.markerPill}>
            <Text style={styles.markerText}>{MARKER}</Text>
          </View>

          <View style={styles.navWrap}>
            <NavItem label="Ana" active={screen === "home"} onPress={() => setScreen("home")} />
            <NavItem label="Ürün" active={screen === "products"} onPress={() => setScreen("products")} />
            <NavItem label="Rutin" active={screen === "routine"} onPress={() => setScreen("routine")} />
            <NavItem label="Analiz" active={screen === "analysis"} onPress={() => setScreen("analysis")} />
            <NavItem label="Tara" active={screen === "scan"} onPress={() => setScreen("scan")} />
            <NavItem label="Karar" active={screen === "compare"} onPress={() => setScreen("compare")} />
            <NavItem label="Profil" active={screen === "profile"} onPress={() => setScreen("profile")} />
          </View>

          {screen === "home" && (
            <HomeScreen
              setScreen={setScreen}
              concern={concern}
              setConcern={setConcern}
              bestProducts={bestProducts}
              selectedProduct={selectedProduct}
            />
          )}

          {screen === "products" && (
            <ProductsScreen
              query={query}
              setQuery={setQuery}
              category={category}
              setCategory={setCategory}
              concern={concern}
              setConcern={setConcern}
              filteredProducts={filteredProducts}
              selectedProduct={selectedProduct}
              setSelectedProductId={setSelectedProductId}
            />
          )}

          {screen === "routine" && (
            <RoutineScreen
              concern={concern}
              setConcern={setConcern}
              routineBlocks={routineBlocks}
              setScreen={setScreen}
              setSelectedProductId={setSelectedProductId}
            />
          )}

          {screen === "analysis" && (
            <AnalysisScreen
              concern={concern}
              setConcern={setConcern}
              skinFeel={skinFeel}
              setSkinFeel={setSkinFeel}
              routineLevel={routineLevel}
              setRoutineLevel={setRoutineLevel}
              analysis={analysis}
              setScreen={setScreen}
            />
          )}

          {screen === "scan" && (
            <ScanScreen
              scanMode={scanMode}
              setScanMode={setScanMode}
              scanQuality={scanQuality}
              setScanQuality={setScanQuality}
              concern={concern}
              setConcern={setConcern}
              skinFeel={skinFeel}
              setSkinFeel={setSkinFeel}
              scanPreview={scanPreview}
              setScreen={setScreen}
            />
          )}

          {screen === "compare" && (
            <CompareScreen
              compareLeft={compareLeft}
              setCompareLeft={setCompareLeft}
              compareRight={compareRight}
              setCompareRight={setCompareRight}
              leftProduct={leftProduct}
              rightProduct={rightProduct}
              decision={decision}
            />
          )}

          {screen === "profile" && <ProfileScreen />}

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Güvenli geliştirme modu</Text>
            <Text style={styles.footerText}>
              Bu sürüm yerel verilerle çalışan, hızlı test edilebilir görsel uygulama iskeletidir.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({
  setScreen,
  concern,
  setConcern,
  bestProducts,
  selectedProduct,
}: {
  setScreen: (screen: ScreenKey) => void;
  concern: Concern;
  setConcern: (concern: Concern) => void;
  bestProducts: LocalProduct[];
  selectedProduct: LocalProduct;
}) {
  return (
    <View style={styles.screenBlock}>
      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Bugünkü öneri merkezi</Text>
        <Text style={styles.heroTitle}>Cilt bakımını tek akışta yönet</Text>
        <Text style={styles.heroText}>
          Ürün, analiz, tarama, rutin ve karar rehberi artık tek görsel uygulama deneyimi gibi çalışıyor.
        </Text>

        <View style={styles.heroStats}>
          <MiniStat value={String(LOCAL_PRODUCTS.length)} label="Ürün" />
          <MiniStat value={String(CONCERNS.length)} label="Endişe" />
          <MiniStat value="7" label="Ekran" />
        </View>
      </View>

      <SectionTitle title="Hızlı başlangıç" />
      <View style={styles.moduleGrid}>
        <ModuleCard title="Cilt Analizi" text="Endişe ve cilt hissine göre sonuç üret." onPress={() => setScreen("analysis")} />
        <ModuleCard title="Cilt Taraması" text="Görsel seçim akışını büyük kartlarla dene." onPress={() => setScreen("scan")} />
        <ModuleCard title="Ürün Önerileri" text="Filtrele, seç, detayını gör." onPress={() => setScreen("products")} />
        <ModuleCard title="Rutinim" text="Sabah-akşam bakım planı oluştur." onPress={() => setScreen("routine")} />
      </View>

      <SectionTitle title="Odak seç" />
      <ChipRow>
        {CONCERNS.map((item) => (
          <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
        ))}
      </ChipRow>

      <View style={styles.spotlightCard}>
        <Text style={styles.spotlightLabel}>Öne çıkan ürün</Text>
        <Text style={styles.spotlightTitle}>{bestProducts[0]?.name ?? selectedProduct.name}</Text>
        <Text style={styles.spotlightText}>{bestProducts[0]?.shortBenefit ?? selectedProduct.shortBenefit}</Text>
        <Pressable style={styles.primaryButton} onPress={() => setScreen("products")}>
          <Text style={styles.primaryButtonText}>Ürünleri gör</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProductsScreen({
  query,
  setQuery,
  category,
  setCategory,
  concern,
  setConcern,
  filteredProducts,
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
}) {
  return (
    <View style={styles.screenBlock}>
      <ScreenIntro
        badge="Ürün"
        title="Ürün önerileri"
        text="Endişe, kategori ve arama metnine göre ürünleri görsel kartlarla incele."
      />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Ürün, marka veya endişe ara"
        placeholderTextColor="#8A9188"
        style={styles.searchInput}
      />

      <SectionTitle title="Endişe" />
      <ChipRow>
        {CONCERNS.map((item) => (
          <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
        ))}
      </ChipRow>

      <SectionTitle title="Kategori" />
      <ChipRow>
        {PRODUCT_CATEGORIES.map((item) => (
          <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />
        ))}
      </ChipRow>

      <View style={styles.selectedProductCard}>
        <Text style={styles.selectedLabel}>Seçili ürün</Text>
        <Text style={styles.selectedTitle}>{selectedProduct.name}</Text>
        <Text style={styles.selectedMeta}>{selectedProduct.brand} • {selectedProduct.category} • Skor {selectedProduct.score}</Text>
        <Text style={styles.selectedText}>{selectedProduct.detail}</Text>
      </View>

      <SectionTitle title={`${filteredProducts.length} ürün`} />
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Sonuç bulunamadı</Text>
          <Text style={styles.emptyText}>Aramayı veya kategoriyi temizleyerek yeniden dene.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => {
            setQuery("");
            setCategory("Tümü");
          }}>
            <Text style={styles.secondaryButtonText}>Filtreleri temizle</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.productGrid}>
          {filteredProducts.map((product) => (
            <LocalProductTile
              key={product.id}
              product={product}
              active={product.id === selectedProduct.id}
              onPress={() => setSelectedProductId(product.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function RoutineScreen({
  concern,
  setConcern,
  routineBlocks,
  setScreen,
  setSelectedProductId,
}: {
  concern: Concern;
  setConcern: (value: Concern) => void;
  routineBlocks: ReturnType<typeof getRoutineBlocksV38>;
  setScreen: (screen: ScreenKey) => void;
  setSelectedProductId: (value: string) => void;
}) {
  return (
    <View style={styles.screenBlock}>
      <ScreenIntro
        badge="Rutin"
        title={`${concern} bakım planı`}
        text="Sabah ve akşam adımlarını ürün kartlarıyla takip et."
      />

      <ChipRow>
        {CONCERNS.map((item) => (
          <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
        ))}
      </ChipRow>

      {routineBlocks.map((block) => (
        <View key={block.title} style={styles.routineCard}>
          <View style={styles.routineHeader}>
            <Text style={styles.routineTitle}>{block.title}</Text>
            <Text style={styles.routineBadge}>{block.products.length} adım</Text>
          </View>
          <Text style={styles.routineText}>{block.purpose}</Text>

          {block.products.map((product, index) => (
            <Pressable
              key={`${block.title}-${product.id}`}
              style={styles.routineStep}
              onPress={() => {
                setSelectedProductId(product.id);
                setScreen("products");
              }}
            >
              <View style={styles.stepCircle}>
                <Text style={styles.stepCircleText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{product.routineStep}</Text>
                <Text style={styles.stepText}>{product.name}</Text>
              </View>
              <Text style={styles.goText}>Aç</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function AnalysisScreen({
  concern,
  setConcern,
  skinFeel,
  setSkinFeel,
  routineLevel,
  setRoutineLevel,
  analysis,
  setScreen,
}: {
  concern: Concern;
  setConcern: (value: Concern) => void;
  skinFeel: SkinFeel;
  setSkinFeel: (value: SkinFeel) => void;
  routineLevel: RoutineLevel;
  setRoutineLevel: (value: RoutineLevel) => void;
  analysis: ReturnType<typeof buildAnalysisResultV39>;
  setScreen: (screen: ScreenKey) => void;
}) {
  return (
    <View style={styles.screenBlock}>
      <ScreenIntro
        badge="Analiz"
        title="Cilt analizi"
        text="Cilt hissi, endişe ve rutin seviyesine göre demo analiz sonucu üret."
      />

      <SectionTitle title="Endişe" />
      <ChipRow>
        {CONCERNS.map((item) => (
          <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
        ))}
      </ChipRow>

      <SectionTitle title="Cilt hissi" />
      <ChipRow>
        {SKIN_FEELS.map((item) => (
          <Chip key={item} label={item} active={skinFeel === item} onPress={() => setSkinFeel(item)} />
        ))}
      </ChipRow>

      <SectionTitle title="Rutin seviyesi" />
      <ChipRow>
        {ROUTINE_LEVELS.map((item) => (
          <Chip key={item} label={item} active={routineLevel === item} onPress={() => setRoutineLevel(item)} />
        ))}
      </ChipRow>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>Analiz sonucu</Text>
        <Text style={styles.resultTitle}>{analysis.title}</Text>
        <Text style={styles.resultText}>{analysis.summary}</Text>
      </View>

      <View style={styles.actionGrid}>
        <Pressable style={styles.primaryButton} onPress={() => setScreen("products")}>
          <Text style={styles.primaryButtonText}>Ürünleri gör</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setScreen("routine")}>
          <Text style={styles.secondaryButtonText}>Rutini aç</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScanScreen({
  scanMode,
  setScanMode,
  scanQuality,
  setScanQuality,
  concern,
  setConcern,
  skinFeel,
  setSkinFeel,
  scanPreview,
  setScreen,
}: {
  scanMode: ScanEntryMode;
  setScanMode: (value: ScanEntryMode) => void;
  scanQuality: ScanQuality;
  setScanQuality: (value: ScanQuality) => void;
  concern: Concern;
  setConcern: (value: Concern) => void;
  skinFeel: SkinFeel;
  setSkinFeel: (value: SkinFeel) => void;
  scanPreview: ReturnType<typeof buildScanPreviewV40>;
  setScreen: (screen: ScreenKey) => void;
}) {
  return (
    <View style={styles.screenBlock}>
      <ScreenIntro
        badge="Tara"
        title="Cilt taraması"
        text="Gerçek kamera açmadan, tarama deneyimini ve yönlendirme akışını test et."
      />

      <View style={styles.scanSummaryCard}>
        <Text style={styles.scanSummaryTitle}>Seçili ayarlar</Text>
        <SummaryLine label="Akış" value={scanMode} />
        <SummaryLine label="Kalite" value={scanQuality} />
        <SummaryLine label="Endişe" value={concern} />
        <SummaryLine label="Cilt hissi" value={skinFeel} />
      </View>

      <SectionTitle title="1. Akış tipi" />
      <View style={styles.choiceList}>
        {SCAN_ENTRY_MODES.map((item) => (
          <BigChoice key={item} label={item} active={scanMode === item} onPress={() => setScanMode(item)} />
        ))}
      </View>

      <SectionTitle title="2. Görsel kalite" />
      <View style={styles.choiceList}>
        {SCAN_QUALITY_LEVELS.map((item) => (
          <BigChoice key={item} label={item} active={scanQuality === item} onPress={() => setScanQuality(item)} />
        ))}
      </View>

      <SectionTitle title="3. Endişe" />
      <ChipRow>
        {CONCERNS.map((item) => (
          <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
        ))}
      </ChipRow>

      <SectionTitle title="4. Cilt hissi" />
      <ChipRow>
        {SKIN_FEELS.map((item) => (
          <Chip key={item} label={item} active={skinFeel === item} onPress={() => setSkinFeel(item)} />
        ))}
      </ChipRow>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>Tarama önizlemesi</Text>
        <Text style={styles.resultTitle}>{scanPreview.title}</Text>
        <Text style={styles.resultText}>{scanPreview.status}</Text>
      </View>

      <View style={styles.actionGrid}>
        <Pressable style={styles.primaryButton} onPress={() => setScreen("analysis")}>
          <Text style={styles.primaryButtonText}>Analize geç</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setScreen("products")}>
          <Text style={styles.secondaryButtonText}>Ürünleri aç</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CompareScreen({
  compareLeft,
  setCompareLeft,
  compareRight,
  setCompareRight,
  leftProduct,
  rightProduct,
  decision,
}: {
  compareLeft: string;
  setCompareLeft: (value: string) => void;
  compareRight: string;
  setCompareRight: (value: string) => void;
  leftProduct: LocalProduct;
  rightProduct: LocalProduct;
  decision: ReturnType<typeof compareProductsV38>;
}) {
  const pool = LOCAL_PRODUCTS.slice(0, 8);

  return (
    <View style={styles.screenBlock}>
      <ScreenIntro
        badge="Karar"
        title="Karar rehberi"
        text="İki ürünü skor, segment ve kullanım diliyle karşılaştır."
      />

      <SectionTitle title="Sol ürün" />
      <ChipRow>
        {pool.map((item) => (
          <Chip key={`l-${item.id}`} label={item.name.split(" ")[0]} active={compareLeft === item.id} onPress={() => setCompareLeft(item.id)} />
        ))}
      </ChipRow>

      <SectionTitle title="Sağ ürün" />
      <ChipRow>
        {pool.map((item) => (
          <Chip key={`r-${item.id}`} label={item.name.split(" ")[0]} active={compareRight === item.id} onPress={() => setCompareRight(item.id)} />
        ))}
      </ChipRow>

      <View style={styles.compareGrid}>
        <CompareTile product={leftProduct} />
        <CompareTile product={rightProduct} />
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>Karar cümlesi</Text>
        <Text style={styles.resultTitle}>{decision.winner.name}</Text>
        <Text style={styles.resultText}>{decision.sentence}</Text>
        {decision.reasons.map((reason) => (
          <Text key={reason} style={styles.bulletText}>• {reason}</Text>
        ))}
      </View>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={styles.screenBlock}>
      <ScreenIntro
        badge="Profil"
        title="Misafir profil"
        text="Kişisel veri almadan uygulama modüllerini test et."
      />

      <View style={styles.profileHero}>
        <Text style={styles.profileKicker}>Seçkin üyelik hazırlığı</Text>
        <Text style={styles.profileTitle}>Premium ekran dili hazır</Text>
        <Text style={styles.profileText}>
          Gelişmiş analiz, karar rehberi, rutin takibi ve ürün açıklamaları sonraki büyük paketlerde bağlanacak.
        </Text>
      </View>

      <View style={styles.statusList}>
        <StatusRow title="Ürün motoru" status="Aktif" />
        <StatusRow title="Rutin" status="Aktif" />
        <StatusRow title="Analiz" status="Aktif" />
        <StatusRow title="Tara" status="Önizleme" />
        <StatusRow title="Karar rehberi" status="Aktif" />
      </View>
    </View>
  );
}

function NavItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.navItem, active && styles.navItemActive]} onPress={onPress}>
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ScreenIntro({ badge, title, text }: { badge: string; title: string; text: string }) {
  return (
    <View style={styles.introCard}>
      <Text style={styles.introBadge}>{badge}</Text>
      <Text style={styles.introTitle}>{title}</Text>
      <Text style={styles.introText}>{text}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function BigChoice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.bigChoice, active && styles.bigChoiceActive]} onPress={onPress}>
      <View>
        <Text style={[styles.bigChoiceTitle, active && styles.bigChoiceTitleActive]}>{label}</Text>
        <Text style={[styles.bigChoiceText, active && styles.bigChoiceTextActive]}>
          {active ? "Seçili tercih" : "Dokun ve seç"}
        </Text>
      </View>
      <Text style={[styles.bigChoiceMark, active && styles.bigChoiceMarkActive]}>{active ? "✓" : "+"}</Text>
    </Pressable>
  );
}

function LocalProductTile({
  product,
  active,
  onPress,
}: {
  product: LocalProduct;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.productTile, active && styles.productTileActive]} onPress={onPress}>
      <View style={styles.fakeImage}>
        <Text style={styles.fakeImageText}>{product.brand.slice(0, 1)}</Text>
      </View>

      <View style={styles.productBody}>
        <Text style={styles.productBrand}>{product.brand}</Text>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productBenefit}>{product.shortBenefit}</Text>

        <View style={styles.productMetaRow}>
          <Text style={styles.scorePill}>Skor {product.score}</Text>
          <Text style={styles.segmentPill}>{product.segment}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CompareTile({ product }: { product: LocalProduct }) {
  return (
    <View style={styles.compareTile}>
      <Text style={styles.compareBrand}>{product.brand}</Text>
      <Text style={styles.compareName}>{product.name}</Text>
      <Text style={styles.compareMeta}>Skor {product.score} • {product.segment}</Text>
      <Text style={styles.compareText}>{product.shortBenefit}</Text>
    </View>
  );
}

function ModuleCard({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <Pressable style={styles.moduleCard} onPress={onPress}>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text style={styles.moduleText}>{text}</Text>
      <Text style={styles.moduleAction}>Aç</Text>
    </Pressable>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function StatusRow({ title, status }: { title: string; status: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusBadge}>{status}</Text>
    </View>
  );
}

function screenTitle(screen: ScreenKey) {
  const titles: Record<ScreenKey, string> = {
    home: "Ana sayfa",
    products: "Ürünler",
    routine: "Rutinim",
    analysis: "Analiz",
    scan: "Tara",
    compare: "Karar",
    profile: "Profil",
  };
  return titles[screen];
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#E8ECE4",
  },
  appFrame: {
    flex: 1,
    backgroundColor: "#E8ECE4",
  },
  scroll: {
    padding: 20,
    paddingTop: 26,
    paddingBottom: 42,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brandEyebrow: {
    color: "#8A6A3E",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  brandTitle: {
    marginTop: 4,
    color: "#243428",
    fontSize: 34,
    fontWeight: "900",
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: "#243428",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFF6EA",
    fontSize: 30,
    fontWeight: "900",
  },
  markerPill: {
    alignSelf: "flex-start",
    backgroundColor: "#F4E9D8",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 14,
  },
  markerText: {
    color: "#8A5A28",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  navWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  navItem: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  navItemActive: {
    backgroundColor: "#243428",
  },
  navText: {
    color: "#5F675E",
    fontSize: 12,
    fontWeight: "900",
  },
  navTextActive: {
    color: "#FFFFFF",
  },
  screenBlock: {
    gap: 16,
  },
  heroCard: {
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  heroKicker: {
    color: "#AA7A3A",
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#243428",
    fontWeight: "900",
    fontSize: 30,
    lineHeight: 35,
  },
  heroText: {
    marginTop: 10,
    color: "#626A61",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  heroStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  miniStat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#F8FAF7",
    padding: 12,
    alignItems: "center",
  },
  miniStatValue: {
    color: "#243428",
    fontWeight: "900",
    fontSize: 18,
  },
  miniStatLabel: {
    color: "#697168",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 3,
  },
  sectionTitle: {
    color: "#243428",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  moduleGrid: {
    gap: 12,
  },
  moduleCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  moduleTitle: {
    color: "#243428",
    fontSize: 20,
    fontWeight: "900",
  },
  moduleText: {
    color: "#687066",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    fontWeight: "700",
  },
  moduleAction: {
    color: "#AA7A3A",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  chipActive: {
    backgroundColor: "#243428",
    borderColor: "#243428",
  },
  chipText: {
    color: "#5F675E",
    fontSize: 12,
    fontWeight: "900",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  spotlightCard: {
    borderRadius: 26,
    backgroundColor: "#243428",
    padding: 20,
  },
  spotlightLabel: {
    color: "#D6C1A0",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  spotlightTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  spotlightText: {
    color: "#DCE4DB",
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  introCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  introBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#F4E9D8",
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
    marginBottom: 10,
  },
  introTitle: {
    color: "#243428",
    fontSize: 26,
    fontWeight: "900",
  },
  introText: {
    color: "#657066",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    fontWeight: "700",
  },
  searchInput: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "800",
    color: "#243428",
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.10)",
  },
  selectedProductCard: {
    borderRadius: 26,
    backgroundColor: "#FFFDF8",
    padding: 18,
    borderWidth: 1,
    borderColor: "#F4E9D8",
  },
  selectedLabel: {
    color: "#AA7A3A",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  selectedTitle: {
    color: "#243428",
    fontSize: 22,
    fontWeight: "900",
  },
  selectedMeta: {
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
  },
  selectedText: {
    color: "#626A61",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
  },
  emptyTitle: {
    color: "#243428",
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: "#626A61",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  productGrid: {
    gap: 12,
  },
  productTile: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: 14,
    flexDirection: "row",
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  productTileActive: {
    borderColor: "#AA7A3A",
    backgroundColor: "#FFFDF8",
  },
  fakeImage: {
    width: 78,
    height: 92,
    borderRadius: 22,
    backgroundColor: "#E8ECE4",
    alignItems: "center",
    justifyContent: "center",
  },
  fakeImageText: {
    color: "#243428",
    fontSize: 30,
    fontWeight: "900",
  },
  productBody: {
    flex: 1,
  },
  productBrand: {
    color: "#AA7A3A",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4,
  },
  productName: {
    color: "#243428",
    fontSize: 17,
    fontWeight: "900",
  },
  productBenefit: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: "700",
  },
  productMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  scorePill: {
    borderRadius: 999,
    backgroundColor: "#243428",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
  segmentPill: {
    borderRadius: 999,
    backgroundColor: "#F4E9D8",
    color: "#8A5A28",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
  routineCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  routineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  routineTitle: {
    color: "#243428",
    fontSize: 22,
    fontWeight: "900",
  },
  routineBadge: {
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
    backgroundColor: "#F4E9D8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  routineText: {
    color: "#626A61",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: "700",
  },
  routineStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#F8FAF7",
    padding: 12,
    marginTop: 12,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#243428",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: "#AA7A3A",
    fontSize: 12,
    fontWeight: "900",
  },
  stepText: {
    color: "#243428",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  goText: {
    color: "#AA7A3A",
    fontWeight: "900",
    fontSize: 12,
  },
  resultCard: {
    borderRadius: 26,
    backgroundColor: "#FFFDF8",
    padding: 18,
    borderWidth: 1,
    borderColor: "#F4E9D8",
  },
  resultLabel: {
    color: "#AA7A3A",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  resultTitle: {
    color: "#243428",
    fontSize: 22,
    fontWeight: "900",
  },
  resultText: {
    color: "#626A61",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: "700",
  },
  bulletText: {
    color: "#626A61",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: "700",
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "#243428",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "#F4E9D8",
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  secondaryButtonText: {
    color: "#8A5A28",
    fontWeight: "900",
    fontSize: 14,
  },
  scanSummaryCard: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  scanSummaryTitle: {
    color: "#243428",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 5,
  },
  summaryLabel: {
    color: "#626A61",
    fontWeight: "900",
    fontSize: 13,
  },
  summaryValue: {
    color: "#243428",
    fontWeight: "900",
    fontSize: 13,
  },
  choiceList: {
    gap: 10,
  },
  bigChoice: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bigChoiceActive: {
    backgroundColor: "#243428",
    borderColor: "#243428",
  },
  bigChoiceTitle: {
    color: "#243428",
    fontSize: 18,
    fontWeight: "900",
  },
  bigChoiceTitleActive: {
    color: "#FFFFFF",
  },
  bigChoiceText: {
    color: "#626A61",
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  bigChoiceTextActive: {
    color: "#DCE4DB",
  },
  bigChoiceMark: {
    color: "#AA7A3A",
    fontSize: 24,
    fontWeight: "900",
  },
  bigChoiceMarkActive: {
    color: "#FFFFFF",
  },
  compareGrid: {
    flexDirection: "row",
    gap: 12,
  },
  compareTile: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(36,52,40,0.08)",
  },
  compareBrand: {
    color: "#AA7A3A",
    fontSize: 11,
    fontWeight: "900",
  },
  compareName: {
    color: "#243428",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },
  compareMeta: {
    color: "#8A5A28",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
  },
  compareText: {
    color: "#626A61",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontWeight: "700",
  },
  profileHero: {
    borderRadius: 28,
    backgroundColor: "#243428",
    padding: 22,
  },
  profileKicker: {
    color: "#D6C1A0",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
  },
  profileTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  profileText: {
    color: "#DCE4DB",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: "700",
  },
  statusList: {
    gap: 10,
  },
  statusRow: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  statusTitle: {
    color: "#243428",
    fontSize: 15,
    fontWeight: "900",
  },
  statusBadge: {
    color: "#8A5A28",
    fontSize: 12,
    fontWeight: "900",
    backgroundColor: "#F4E9D8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
  },
  footerCard: {
    marginTop: 20,
    borderRadius: 24,
    backgroundColor: "#243428",
    padding: 18,
  },
  footerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  footerText: {
    color: "#DCE4DB",
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
});
TSX

{
echo "=== V50 SOURCE CHECK ==="
grep -RIn "ECZ4_FULL_VISUAL_APP_REBUILD_V50" app local_demo_data

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
rm -rf "dist/ecz4_v50_full_visual_app_rebuild_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_v50_full_visual_app_rebuild_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_v50_full_visual_app_rebuild_$STAMP" -type f -name "*.js" | head -1)
if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_FULL_VISUAL_APP_REBUILD_V50" "$BUNDLE"
echo "PASS: V50 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_FULL_VISUAL_APP_REBUILD_V50_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 full visual app rebuild v50 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_FULL_VISUAL_APP_REBUILD_V50_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
