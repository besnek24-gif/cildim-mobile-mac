import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import __perf from "@/src/utils/performanceLogger";
import {
  parseNavigationSource,
  getBackLabel,
} from "@/src/navigation/navigationModel";
import {
  navigateToAllProducts,
  goBack,
} from "@/src/navigation/navigationHelpers";
import React, { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { IngredientBadge } from "@/components/IngredientBadge";
import { ProductImage } from "@/components/ProductImage";
import { ScoreRing } from "@/components/ScoreRing";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useTheme } from "@/context/ThemeContext";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { useColors } from "@/hooks/useColors";
import {
  consumeNavigationProduct,
  setNavigationDermoResult,
  setNavigationProduct,
} from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { trackEvent, getUserEvents } from "@/lib/userEvents";
import { trackProductView } from "@/lib/retentionEngine";
import { trackProductView as trackMetricView } from "@/lib/productMetrics";
import { useLearningProfile } from "@/hooks/useLearningProfile";
import {
  fetchSupabaseProductById,
  useSupabaseProducts,
} from "@/hooks/useSupabaseProducts";
import { searchProductByBarcode } from "@/lib/productSearchService";
import { useFavorites } from "@/hooks/useFavorites";
import { useRelatedProducts } from "@/hooks/useRelatedProducts";
import { findSimilarProducts } from "@/lib/similarProducts";
import {
  getRecommendedProducts,
  type RecommendationResult,
} from "@/lib/recommendations";
import {
  normalizeProductData,
  type NormalizedProduct,
} from "@/lib/normalizeProduct";
import { OverviewPipeline } from "@/components/productDetail/OverviewPipeline";
import { CompatibilityTab as CompatibilityTabComponent } from "@/components/productDetail/CompatibilityTab";
import { PremiumTeaserBlock } from "@/local_demo_data/safe_runtime_shims_v74";
import { getPharmacistComment } from "@/lib/formulaInsights";
import { addToLocalHistory } from "@/lib/localHistory";
import { canAccessFeature } from "@/local_demo_data/safe_runtime_shims_v74";
import {
  getSmartWarnings,
  warningLevelColor,
  warningLevelIcon,
  warningLevelBg,
  warningLevelBorder,
} from "@/lib/smartWarnings";
import { evaluateProductWarnings, fitScoreLabel } from "@/lib/productWarnings";
import {
  resolvePregnancyVerdict,
  resolveBreastfeedingVerdict,
  resolveFeature,
  type FeatureKey,
} from "@/lib/features/featureTruth";
import { ProductWarningList } from "@/components/ProductWarningList";
import { SeckinModal } from "@/components/SeckinModal";
import {
  getIngredientAlerts,
  getPregnancyBreastfeedingStatus,
  getChildUseNote,
  getTopSafetyBadges,
  type IngredientAlert,
  type SafetyEval,
  type SafetyBadge,
} from "@/lib/ingredientAlerts";
import {
  calcDermoScore,
  extractIngredientNames,
  levelToColor,
  scoreToColor,
  scoreToLabel,
  type DermoScoreResult,
} from "@/lib/dermoScore";
import {
  buildIngredientSummary,
  buildQuickBadges,
  getIngredientInfo,
  getRiskLevelBg,
  getRiskLevelColor,
  getRiskLevelLabel,
  parseIngredients,
  type IngredientSummary,
  type ParsedIngredient,
  type QuickBadge,
} from "@/lib/ingredientAnalysis";
import {
  Product,
  ProductSummary,
  resolveImageUrl,
  resolveThumbnailUrl,
  resolveBrand,
  resolveProductName,
} from "@/types/product";
import { getFinalProductScore } from "@/lib/getFinalScore";
import {
  getProductSafetyNotes,
  type UserSafetyProfile,
} from "@/lib/compareProducts";
import {
  runSafetyAlertEngine,
  type ProductFeatureFlags,
  type SafetyAlertResult,
} from "@/lib/safetyAlertEngine";
import { SafetyAlertBanner } from "@/components/SafetyAlertBanner";
import { getConcernProfile } from "@/lib/concernFlowStore";
import { derivePurposeTag } from "@/lib/featureBadges";
import { normalizeIngredients } from "@/lib/ingredientNormalizer";
// ── Ingredient Intelligence — Single Analysis Adapter ─────────────────────────
// One function, one model, one source priority: V3 → V2 → LEGACY.
// All score/summary/ingredient branching is inside the adapter.
import {
  buildProductDetailAnalysisModel,
  type ProductDetailAnalysisModel,
} from "@/lib/ingredientIntelligence/productDetailAnalysisAdapter";
// ── V4 unknown queue writer (fire-and-forget, additive, read-only for scoring) ─
import { resolveIngredientV4 } from "@/lib/ingredientEngineV4/resolver";
// ─────────────────────────────────────────────────────────────────────────────

// ECZ4 PERF F3: Detail analysis debug logs gated behind a dev-only flag.
// Önceden L890 + L947'deki console.log'lar sadece __DEV__ kontrolüyle koşuyordu;
// dev cihazlarda her analiz recompute'unda büyük obje serialization JS thread'ini
// meşgul ediyordu. Şimdi varsayılan KAPALI; sadece debug için elle true yap.
// Production etkisi: zaten yoktu (sadece dev). Dev etkisi: gereksiz log gürültüsü
// kaldırıldı, performans probing temiz.
const DEBUG_DETAIL_ANALYSIS = false;

/** Ham İngilizce kategori key'ini Türkçe etikete çevirir; çeviri yoksa orijinal döner. */
function translateCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return derivePurposeTag(raw) ?? raw;
}

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Canonical merge helper (ECZ4 — OBF→Supabase upgrade) ──────────────────
// When detail is opened from an OBF/non-UUID partial product (barcode/photo
// scan flow), we attempt a barcode-keyed canonical lookup in Supabase. If
// found, canonical fields win on every key that has a non-empty value, and
// OBF partial data is kept ONLY where canonical is missing. We deliberately
// preserve `id` (the route param) and `external_source` so:
//   - the [product?.id] tracking effect does not re-fire (no double events)
//   - downstream code that checks external_source still sees the OBF origin
// Heavy compute is avoided: this runs once per detail open (single fetch,
// guarded by `cancelled`), and the merge is a single-pass key walk.
function mergePreferCanonical<T extends Record<string, any>>(
  base: T,
  canonical: Record<string, any>,
): T {
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(canonical)) {
    if (k === "id" || k === "external_source") continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

// ── Ingredient Analysis V2 ─────────────────────────────────────────────────
// Product IDs that are currently enabled for v2 ingredient analysis.
// New products can be added here as the v2 system matures.
const INGREDIENT_V2_PRODUCT_IDS = new Set<string>([
  "2e71fc76-4135-48b0-a723-3dae9f621c3c", // Ducray Keracnyl UV Fluid SPF50+
  "cfb3c42e-a591-46cf-a583-466463bf77a8", // Eucerin Oil Control Dry Touch SPF50+
  "fce0c9e7-6ae7-44e6-83aa-af6b5180e5aa", // Ducray Melascreen UV Fluid SPF50+
]);

interface MatchedItemV2 {
  raw: string;
  canonical_name: string;
  matched: boolean;
  category: string;
  risk_level: string;
  flags: string[];
}

interface MatchResultV2 {
  version: "2";
  total: number;
  matched: number;
  unknown: number;
  coverage_pct: number;
  items: MatchedItemV2[];
  unknown_items: string[];
}

const V2_CATEGORY_DESC: Record<string, string> = {
  solvent: "Formül çözücüsü.",
  humectant: "Nemlendirici; su çekme özelliğiyle cildi besler.",
  emollient: "Yumuşatıcı; cilt dokusunu düzeltir ve pürüzsüzleştirir.",
  occlusive: "Oklüzif; nem bariyerini korur.",
  barrier: "Cilt bariyerini destekler.",
  soothing: "Yatıştırıcı; hassas ve tahrişli ciltlere yardımcıdır.",
  active: "Aktif bileşen; belirli cilt sorunlarını hedefler.",
  antioxidant: "Antioksidan; serbest radikallere karşı koruma sağlar.",
  surfactant:
    "Yüzey aktif madde; temizleme ve köpük oluşturma özelliği vardır.",
  preservative: "Formülü koruyucu bileşen.",
  emulsifier: "Emülgatör; yağ ve suyu bir arada tutar.",
  thickener: "Kıvam arttırıcı.",
  chelating: "Şelatlama ajanı; iz mineralleri bağlar.",
  fragrance: "Koku bileşeni; bazı kişilerde hassasiyet yapabilir.",
  sunfilter: "UV filtre; güneş koruyucu etki sağlar.",
  absorbent: "Emici; fazla yağı ve nemi tutar.",
  ph_adjuster: "pH düzenleyici.",
  film_former: "Film oluşturucu.",
};

function v2ItemToParsedIngredient(item: MatchedItemV2): ParsedIngredient {
  const levelMap: Record<
    string,
    "safe" | "low_risk" | "medium_risk" | "high_risk" | "unknown"
  > = {
    low: "safe",
    medium: "medium_risk",
    high: "high_risk",
    unknown: "unknown",
  };
  return {
    name: item.raw,
    nameTr: item.canonical_name,
    level: levelMap[item.risk_level] ?? "unknown",
    desc: item.matched
      ? (V2_CATEGORY_DESC[item.category] ?? "İçerik hakkında bilgi mevcut.")
      : "Bu içerik için veri bulunamadı.",
  };
}

function buildIngredientSummaryFromV2(
  result: MatchResultV2,
): IngredientSummary {
  let safe = 0,
    low = 0,
    medium = 0,
    high = 0,
    unknown = 0;
  const warnings: string[] = [];

  for (const item of result.items) {
    switch (item.risk_level) {
      case "low":
        safe++;
        break;
      case "medium":
        medium++;
        break;
      case "high":
        high++;
        break;
      default:
        unknown++;
        break;
    }
  }

  const hasFragrance = result.items.some((i) => i.flags.includes("fragrance"));
  const hasDryingAlcohol = result.items.some((i) =>
    i.flags.includes("drying_alcohol"),
  );
  if (hasFragrance) warnings.push("Koku (parfüm) içeriyor");
  if (hasDryingAlcohol) warnings.push("Kurutucu alkol içeriyor");

  const total = result.total;
  const hiPct = total > 0 ? (high / total) * 100 : 0;
  const midPct = total > 0 ? (medium / total) * 100 : 0;
  const safePct = total > 0 ? (safe / total) * 100 : 0;

  let rating: "cok_iyi" | "iyi" | "orta" | "dikkat" | "riskli";
  if (hiPct > 15) rating = "riskli";
  else if (hiPct > 5 || midPct > 30) rating = "dikkat";
  else if (midPct > 15) rating = "orta";
  else if (safePct > 70) rating = "cok_iyi";
  else rating = "iyi";

  const ratingMeta = {
    cok_iyi: { label: "Çok İyi", color: "#22c55e" },
    iyi: { label: "İyi", color: "#84cc16" },
    orta: { label: "Orta", color: "#eab308" },
    dikkat: { label: "Dikkat", color: "#f97316" },
    riskli: { label: "Riskli", color: "#ef4444" },
  };

  return {
    total,
    safe,
    low,
    medium,
    high,
    unknown,
    rating,
    ratingLabel: ratingMeta[rating].label,
    ratingColor: ratingMeta[rating].color,
    warnings,
  };
}
// ────────────────────────────────────────────────────────────────────────────

type AlternativeProduct = ProductSummary;

// "analysis" tab geçici olarak kaldırıldı — ileride "Derin Analiz / Uzman Yorumu" adıyla
// seçkin üyelere özel olarak geri eklenecek. AnalysisTab() fonksiyonu ve altyapı korunuyor.
type TabId = "overview" | "ingredients" | "compatibility" | "reviews";

// PERF: Empty fallback for analysisModel guard — used when product hasn't loaded yet.
// Allows the analysisModel useMemo to short-circuit without breaking downstream
// reads like `analysisModel.parsedIngredients`.
const EMPTY_ANALYSIS_MODEL: ProductDetailAnalysisModel = {
  source: "LEGACY",
  finalScore: null,
  scoreLabel: null,
  confidence: "low",
  parsedIngredients: [],
  ingredientSummary: {
    total: 0,
    safe: 0,
    low: 0,
    medium: 0,
    high: 0,
    unknown: 0,
    rating: "orta",
    ratingLabel: "",
    ratingColor: "#999999",
    warnings: [],
  },
  warnings: [],
  coveragePct: null,
  formulaType: null,
  formulaConfidence: null,
  matchedIngredients: null,
  unresolvedIngredients: null,
  totalIngredients: null,
  explanationSummary: null,
};

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Umumi Görüntü" },
  { id: "ingredients", label: "Muhteva" },
  { id: "compatibility", label: "Uygunluk" },
  { id: "reviews", label: "Yorumlar" },
];

const PREGNANCY_LABELS: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  guvenli: {
    label: "Hamileler İçin Güvenli",
    color: "#6B7F5D",
    icon: "check-circle",
  },
  dikkatli_kullanim: {
    label: "Hamilelikte Dikkatli Kullanın",
    color: "#a16207",
    icon: "alert-triangle",
  },
  dikkatli_kullanım: {
    label: "Hamilelikte Dikkatli Kullanın",
    color: "#a16207",
    icon: "alert-triangle",
  },
  onerilemez: {
    label: "Hamilelikte Önerilmez",
    color: "#b91c1c",
    icon: "x-circle",
  },
};

export default function ProductDetailScreen() {
  const __detailMountStart = useRef(__perf.mark("productDetail.mount.start")).current;
  __perf.count("ProductDetail.render");
  const {
    id,
    ref,
    source: rawSource,
    query: searchQuery,
    concernId,
  } = useLocalSearchParams<{
    id: string;
    ref?: string;
    source?: string;
    query?: string;
    concernId?: string;
  }>();
  useEffect(() => {
    if (id) __perf.consumePress(String(id));
    __perf.measureSince("productDetail.mount", __detailMountStart);
  }, []);

  // Determine navigation source — used for back-button label + analytics.
  // Preserves backward compat: `ref=similar` (old) maps to source "similar" (new).
  const navSource = parseNavigationSource(
    rawSource ?? (ref === "similar" ? "similar" : undefined),
  );
  const backLabel = getBackLabel(navSource);
  const fromSimilar = navSource === "similar" || ref === "similar";

  // EH18 Bug#3: DermOAsistan'dan açılan ürün detayında geri tuşu sohbet
  // tab'ına dönmeli. router.navigate tab'ı yeniden mount etmez,
  // mevcut sohbet state'i korunur.
  const handleBack = React.useCallback(() => {
    if (navSource === "danisma") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.navigate("/(tabs)/danisma" as any);
      return;
    }
    // ECZ4 Favorites back-route fix: Favoriler ayrı tab navigator olduğundan
    // router.back() (home) stack'ini pop'lar ve Home'a düşer. Aynı pattern
    // danisma için kullanılıyor; favorites için de eksik tab'a navigate edip
    // mevcut state'i koruyoruz.
    if (navSource === "favorites") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.navigate("/(tabs)/favoriler" as any);
      return;
    }
    // ECZ4 History back-route fix: Geçmiş ekranı gizli tab; gecmis → product
    // artık push ile açılıyor (router.replace yerine), source="history" ile.
    // Burada deterministik olarak /gecmis'e dönüyoruz — router.back() stack
    // edge-case'lerinde (deep-link, fresh launch) Home'a düşebilir.
    if (navSource === "history") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.navigate("/gecmis" as any);
      return;
    }
    goBack();
  }, [navSource]);
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useTabBarInset();
  const { user, getAuthHeaders, effectiveRole } = useAuth();
  const { preferences } = useUserPreferences();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // ECZ4 P1 — Defer heavy downstream computations so first paint is not blocked
  // by V4 ingredient matching, safety engine, similar/recommended pipelines.
  // useDeferredValue is React 18 native: it returns the previous value while a
  // lower-priority re-render is scheduled with the new value. Hero (name,
  // brand, image, score chip, badges, dermoResult, featureTruthMap) keeps
  // using `product` directly → first paint unchanged. Deep ingredient/safety/
  // recommendation panels read from `deferredProduct` → re-render after paint.
  // Output values are identical; only commit timing changes.
  const deferredProduct = useDeferredValue(product);
  const { isFavorite, toggle: toggleFav } = useFavorites();
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showScoreInfoModal, setShowScoreInfoModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSeckinModal, setShowSeckinModal] = useState(false);
  const [userAllergens, setUserAllergens] = useState<string[]>([]);
  // ── Related-products slim slice ─────────────────────────────────────────────
  // Replaces the previous full-catalog fetch. Pulls at most 40 same-category
  // siblings (card-relevant columns only, no `ingredients`) AFTER the open
  // animation finishes via InteractionManager — keeps detail open at 60fps
  // while still feeding findSimilarProducts() and getRecommendedProducts().
  // Rollback: replace with `const allProducts: Product[] = [];` and re-add
  // the empty-array guards in the two memos below.
  const { products: allProducts } = useRelatedProducts(
    product?.id ?? null,
    (product as any)?.category ?? null,
    (product as any)?.subcategory ?? null,
    40,
  );
  // PERF: useLearningProfile must be called unconditionally (rules of hooks).
  // Passing an empty array makes its internal effect short-circuit.
  const learningProfile = useLearningProfile(allProducts as any);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showAll, setShowAll] = useState(false);
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(
    null,
  );
  const [compareProduct, setCompareProduct] =
    useState<AlternativeProduct | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [ingredientAnalysisV2, setIngredientAnalysisV2] =
    useState<MatchResultV2 | null>(null);
  // ECZ4 P1 — V2 ingredient analysis is also a heavy-downstream input.
  const deferredIngredientAnalysisV2 = useDeferredValue(ingredientAnalysisV2);

  const tabAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  // ── Hero card entrance + press animations ─────────────────────────────────
  const heroCardAnim = useRef(new Animated.Value(0)).current;
  const heroCardPressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(heroCardAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 160,
      useNativeDriver: true,
    }).start();
  }, []);

  const onHeroPressIn = () => {
    Animated.spring(heroCardPressScale, {
      toValue: 1.03,
      damping: 22,
      stiffness: 400,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  };
  const onHeroPressOut = () => {
    Animated.spring(heroCardPressScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 240,
      mass: 0.7,
    }).start();
  };
  const heroCardAnimStyle = {
    opacity: heroCardAnim,
    transform: [
      { scale: heroCardPressScale },
      {
        scale: heroCardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = 0;

  useEffect(() => {
    if (!id) return;
    const stored = consumeNavigationProduct();
    if (stored) {
      // PERF: paint instantly with the lightweight Home/cache row, THEN hydrate
      // the full Supabase row in the background. This restores ingredients,
      // badges, scores, muhteva, warnings and analysis (all of which
      // HOME_FIELDS omits) without delaying first paint. analysisModel and the
      // ingredients-V2 effect both depend on (product as any)?.ingredients, so
      // they recompute/refire automatically when full hydration lands.
      // To rollback: keep only setProduct(stored) + setLoading(false) and drop
      // the fetchSupabaseProductById background call below.
      setProduct(stored);
      setLoading(false);
      let cancelled = false;
      if (!UUID_RE.test(id)) {
        // Non-UUID id (e.g. OBF "obf-..."): id-keyed Supabase lookup will
        // never match. Instead try a BARCODE-keyed canonical upgrade — if a
        // Supabase row exists with the same barcode, prefer its non-empty
        // fields over the OBF partial. This restores image / Muhteva /
        // ingredients / score for products that were ingested via OBF
        // first and later enriched in Supabase.
        const storedAny = stored as any;
        const isObf =
          id.startsWith("obf-") || storedAny?.external_source === "obf";
        // Barcode source: stored row first, then derive from route id when
        // the route is an "obf-{barcode}" id (covers history/deep-link reopens
        // where the lightweight payload may have stripped the barcode field).
        const storedBarcode =
          typeof storedAny?.barcode === "string"
            ? storedAny.barcode.trim()
            : "";
        const routeDerivedBarcode = id.startsWith("obf-")
          ? id.slice(4).trim()
          : "";
        const barcode = storedBarcode || routeDerivedBarcode;
        if (isObf && barcode.length > 0) {
          searchProductByBarcode(barcode)
            .then((res) => {
              if (cancelled) return;
              if (res.success && res.product) {
                setProduct((prev) => {
                  // Stale-resolution guard: only apply if user is still on
                  // this product (prev.id matches the route id we opened).
                  if (!prev || String(prev.id) !== String(stored.id))
                    return prev;
                  return mergePreferCanonical(prev, res.product as any);
                });
              }
            })
            .catch(() => {
              // Silent: OBF partial remains the visible source.
            });
        }
        return () => {
          cancelled = true;
        };
      }
      fetchSupabaseProductById(id)
        .then((full) => {
          if (cancelled) return;
          if (!full) return;
          // Guard against stale resolution: only apply if user hasn't navigated
          // to a different product in the meantime.
          setProduct((prev) =>
            prev && String(prev.id) === String(full.id) ? full : prev,
          );
        })
        .catch(() => {
          // Silent failure: lightweight stored product remains visible.
        });
      return () => {
        cancelled = true;
      };
    } else {
      fetchProduct(id);
    }
  }, [id]);

  // ECZ4 NAV STEP B — Analytics/history yan etkilerini push animation
  // tamamlandıktan sonra çalıştır. İlk paint cached product ile anında olur;
  // bu blok (getUserEvents AsyncStorage R + trackEvent x3 AsyncStorage W +
  // addToLocalHistory AsyncStorage W + getFinalProductScore) idle frame'e
  // ertelenir → "tap → kısa bekleme" hissi düşer. Davranış birebir korundu.
  useEffect(() => {
    if (!product) return;
    const pid = String(product.id);
    const eventMeta = {
      brand: (product.brand ?? product.marka ?? undefined) as
        | string
        | undefined,
      category: (product.category ?? product.kategori ?? undefined) as
        | string
        | undefined,
      segment: (product.segment ?? undefined) as string | undefined,
    };
    const handle = InteractionManager.runAfterInteractions(() => {
      // Daha önce bakıldıysa repeat_view de kaydet (güçlü ilgi sinyali)
      getUserEvents()
        .then((events) => {
          const alreadySeen = events.some(
            (e) => e.eventType === "product_view" && e.productId === pid,
          );
          trackEvent("product_view", pid, eventMeta);
          if (alreadySeen) trackEvent("repeat_view", pid, eventMeta);
          // Retention engine takibi (free hook zamanlama için)
          trackProductView(pid);
          // Supabase metrik takibi (interest_score, trending)
          trackMetricView(pid);
        })
        .catch(() => {
          trackEvent("product_view", pid, eventMeta);
          trackProductView(pid);
          trackMetricView(pid);
        });
      const finalScoreForHistory = getFinalProductScore(product);
      addToLocalHistory({
        productId: String(product.id),
        productName: product.name ?? product.isim ?? "Ürün",
        brand: product.brand ?? product.marka ?? undefined,
        // MERKEZI cozumleyici — gecmis preview'i de Storage URL'ini kullansin
        imageUrl: resolveImageUrl(product) ?? undefined,
        score: finalScoreForHistory ?? undefined,
      });
    });
    return () => {
      handle.cancel();
    };
  }, [product?.id]);

  // ECZ4 NAV STEP B — Allerjenleri push animation sonrası çek.
  useEffect(() => {
    if (!user) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      fetchAllergens();
    });
    return () => {
      handle.cancel();
    };
  }, [user]);

  // ── Ingredient Analysis V2 fetch ──────────────────────────────────────────
  // Runs only for products listed in INGREDIENT_V2_PRODUCT_IDS.
  // Result stored in `ingredientAnalysisV2`; used below to override parsedIngredients
  // and ingredientSummary. Old fields are never touched.
  // ECZ4 NAV STEP B — V2 fetch'i de InteractionManager ile ertele. Ek olarak
  // cancelled flag → ertelenmiş fetch dönüşünde unmount/product değişimi olduysa
  // setState atılmaz (önceden bu guard yoktu, artık güvenli).
  useEffect(() => {
    if (!product?.id || !API_BASE) return;
    const pid = String(product.id);
    if (!INGREDIENT_V2_PRODUCT_IDS.has(pid)) return;
    const rawIng = (product as any)?.ingredients;
    if (!rawIng || typeof rawIng !== "string") return;

    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      fetch(`${API_BASE}/api/ingredient-analysis-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: rawIng }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (data?.ingredient_analysis_v2) {
            setIngredientAnalysisV2(data.ingredient_analysis_v2 as MatchResultV2);
          }
        })
        .catch(() => {});
    });
    // Dep on `ingredients` ensures we re-fire after background hydration
    // delivers the real ingredient string (lightweight stored row → full row).
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [product?.id, (product as any)?.ingredients]);

  // ─────────────────────────────────────────────────────────────────────────
  // V3 ingredient analysis is now synchronous inside the analysisModel memo.
  // No useEffect needed — adapter runs inline when product/v2 state changes.
  // ─────────────────────────────────────────────────────────────────────────

  const fetchProduct = async (productId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Skip Supabase lookup for non-UUID ids (e.g. OBF "obf-..."): they will
      // never match the uuid column and only produce console noise.
      if (UUID_RE.test(productId)) {
        const sbProduct = await fetchSupabaseProductById(productId);
        if (sbProduct) {
          setProduct(sbProduct);
          setLoading(false);
          return;
        }
      }
      const res = await fetch(
        `${API_BASE}/api/v2/products/${encodeURIComponent(productId)}`,
      );
      if (res.ok) {
        setProduct(await res.json());
        setLoading(false);
        return;
      }
    } catch {}
    setError("Ürün bulunamadı");
    setLoading(false);
  };

  const fetchAllergens = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/me/allergens`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUserAllergens(data.allergens ?? []);
      }
    } catch {}
  };

  const toggleFavorite = async () => {
    if (!user) {
      Alert.alert(
        "Üyelik Gerekli",
        "Ürünleri favorilere eklemek için giriş yapmanız gerekiyor.",
        [
          { text: "Giriş Yap", onPress: () => router.push("/giris") },
          { text: "İptal", style: "cancel" },
        ],
      );
      return;
    }
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleFav(String(product.id));
    if (!isFavorite(String(product.id))) {
      trackEvent("favorite_add", String(product.id), {
        brand: resolveBrand(product) ?? undefined,
        category: product.category ?? product.kategori ?? undefined,
        segment: product.segment ?? undefined,
      });
    }
  };

  const handleShare = async () => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        title: resolveProductName(product) ?? "Ürün",
        message: `${resolveProductName(product)} – ${resolveBrand(product) ?? ""}\nhttps://ciltbakim.app/urun/${id}`,
        url: `https://ciltbakim.app/urun/${id}`,
      });
      trackEvent("share_product", String(product.id), {
        brand: resolveBrand(product) ?? undefined,
        category: product.category ?? product.kategori ?? undefined,
        segment: product.segment ?? undefined,
      });
    } catch {}
  };

  const switchTab = (tab: TabId) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(tabAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(tabAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    setActiveTab(tab);
    setShowAll(false);
    setExpandedIngredient(null);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 80);
    if (product && (tab === "ingredients" || tab === "compatibility")) {
      trackEvent("tab_view", String(product.id), {
        brand: resolveBrand(product) ?? undefined,
        category: product.category ?? product.kategori ?? undefined,
        segment: product.segment ?? undefined,
      });
    }
  };

  // ── Computed values ──────────────────────────────────────────────
  // Legacy score kept for dermoResult calculation only.
  const score = getFinalProductScore(product);

  const dermoResult: DermoScoreResult | null = React.useMemo(() => {
    if (!product) return null;

    // Supabase / Python AI sistem skoru (0-10 ölçek → ×10 → 0-100)
    const rawSys =
      (product as any).scores?.system_total_score ??
      (product as any).scores?.sistem_toplam_puani ??
      (product as any).sistem_toplam_puani ??
      null;
    const systemScore: number | null =
      rawSys != null
        ? rawSys > 10
          ? Math.round(rawSys)
          : Math.round(rawSys * 10)
        : null;

    const storedScore = (product as any).dermo_score; // Python içerik skoru 0-100

    if (typeof storedScore === "number") {
      // Kural 1: max(dermo_score, system_score)
      let adjusted = storedScore;
      if (systemScore != null) adjusted = Math.max(adjusted, systemScore);
      // Kural 2: +5 düzeltmesi ≤ 60 için
      if (adjusted <= 60) adjusted = Math.min(adjusted + 5, 100);
      // Kural 4: sistem skorundan aşağı düşme
      if (systemScore != null) adjusted = Math.max(adjusted, systemScore);
      adjusted = Math.max(0, Math.min(100, adjusted));
      return {
        total: adjusted,
        label: scoreToLabel(adjusted),
        color: scoreToColor(adjusted),
        analyzed: 0,
        total_ingredients: 0,
        counts: {
          beneficial: 0,
          safe: 0,
          mild: 0,
          moderate: 0,
          high_concern: 0,
          avoid: 0,
        },
        concerns: [],
      };
    }

    // Önceden hesaplanmış skor yoksa içerik listesinden hesapla;
    // sistem skorunu taban olarak geç (Kurallar 1-4 calcDermoScore içinde uygulanır)
    return calcDermoScore(extractIngredientNames(product as any), systemScore);
  }, [
    product?.id,
    product?.icerik_analizi,
    (product as any)?.ingredients,
    (product as any)?.dermo_score,
    (product as any)?.scores,
  ]);

  // ECZ4 P1 — Read from deferredProduct so hydration's heavy second pass
  // (V4 ingredient match over 100+ tokens inside analysisModel) commits at
  // low priority, never blocking the hero/score/badges first paint.
  const rawIngredientsText: string | null = React.useMemo(() => {
    const raw = (deferredProduct as any)?.ingredients;
    if (!raw) return null;
    if (typeof raw === "string" && raw.length > 0) return raw;
    if (Array.isArray(raw) && raw.length > 0)
      return (raw as string[]).join(", ");
    return null;
  }, [deferredProduct?.id, (deferredProduct as any)?.ingredients]);

  // ── Centralised Analysis Model — SINGLE SOURCE ───────────────────────────────
  // V4 → V3 → V2 → LEGACY priority. All source branching is inside the adapter.
  // This memo is the single authority for parsedIngredients, ingredientSummary,
  // finalScore, confidence, warnings, coveragePct, and formulaType.
  // Do NOT branch sources below this line.
  const analysisModel: ProductDetailAnalysisModel = React.useMemo(() => {
    // PERF: guard prevents wasted compute when product hasn't loaded yet.
    // ECZ4 P1: switched product/ingredientAnalysisV2 → deferred variants so
    // this heavy adapter (V4 ingredient match) commits at low priority and
    // does not block first paint. Output values are byte-identical because
    // deferredProduct is the same Product instance, just one render later.
    if (!deferredProduct?.id) return EMPTY_ANALYSIS_MODEL;
    const deferredScore = getFinalProductScore(deferredProduct);
    const model = buildProductDetailAnalysisModel({
      productId: String(deferredProduct?.id ?? "unknown"),
      rawIngredientsText: rawIngredientsText ?? null,
      legacyParsedIngredients: deferredProduct
        ? parseIngredients(rawIngredientsText ?? undefined).map(
            getIngredientInfo,
          )
        : [],
      legacySummary: buildIngredientSummary(rawIngredientsText ?? undefined),
      legacyScore: deferredScore,
      ingredientAnalysisV2: deferredIngredientAnalysisV2 as any,
    });
    if (__DEV__ && DEBUG_DETAIL_ANALYSIS) {
      console.log("DETAIL_ANALYSIS_MODEL", {
        product: (deferredProduct as any)?.name ?? (deferredProduct as any)?.isim,
        source: model.source,
        score: model.finalScore,
        confidence: model.confidence,
        formulaType: model.formulaType,
        coveragePct: model.coveragePct,
      });
    }
    return model;
    // PERF: deps include rawIngredientsText so analysisModel recomputes when
    // background hydration delivers ingredients (lightweight stored row → full
    // Supabase row). rawIngredientsText is itself memoized on
    // [product?.id, (product as any)?.ingredients], so it stays referentially
    // stable across unrelated product-ref changes (same id + same ingredients)
    // — no double-recompute loop. `score` and `legacy*` fields are
    // intentionally excluded from deps; legacyScore is only consumed by the
    // LEGACY fallback branch and `score` itself recomputes in the same render
    // pass, so the freshly-built model already reads it correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredProduct?.id, deferredIngredientAnalysisV2, rawIngredientsText]);

  // ── V4 Unknown Queue Writer ────────────────────────────────────────────────
  // Fire-and-forget: triggers resolveIngredientV4 for each unresolved ingredient
  // AFTER render so the Supabase ingredient_unknown_queue gets populated from
  // real user interactions.
  //
  // STRICT GUARANTEES:
  //   ✅ Does NOT affect score (resolveIngredientV4 has no scoring output)
  //   ✅ Does NOT block UI (runs in useEffect, after paint)
  //   ✅ Does NOT break useMemo (reads from memo, never writes back)
  //   ✅ Does NOT throw (every call is wrapped in .catch)
  //   ✅ Deduplicates (Set) + caps at 50 calls per product
  //   ✅ Only fires for source==="V4" (other sources map "unknown" differently)
  //   ✅ Silent on failure — queue errors never surface to the user
  useEffect(() => {
    // Guard: only V4 analysis has the right "unknown" level semantics
    if (analysisModel.source !== "V4") return;

    // Derive unresolved raw strings from parsedIngredients.
    // In V4, level==="unknown" means matchV4Ingredient() returned matched:false.
    // The `name` field holds the original raw ingredient token (item.raw).
    const rawUnresolved = analysisModel.parsedIngredients
      .filter((i) => i.level === "unknown")
      .map((i) => i.name)
      .filter((n) => typeof n === "string" && n.trim().length > 2);

    // Deduplicate (Set removes identical raw strings)
    const unique = [...new Set(rawUnresolved)];

    // Cap: prevent runaway network calls on pathological ingredient lists
    const MAX_QUEUE_CALLS = 50;
    const unresolved = unique.slice(0, MAX_QUEUE_CALLS);

    if (unresolved.length === 0) return;

    if (__DEV__ && DEBUG_DETAIL_ANALYSIS) {
      console.log(
        "[V4 Queue] Writing unknowns:",
        unresolved.length,
        "product:",
        String(product?.id ?? "unknown"),
      );
    }

    const productId = String(product?.id ?? "unknown");
    const productName =
      (product as any)?.name ?? (product as any)?.isim ?? undefined;

    // Fire-and-forget: resolveIngredientV4 → PATH 3 → Supabase queue insert
    // Each call is independent; one failure never affects the others.
    unresolved.forEach((raw) => {
      resolveIngredientV4(raw, { productId, productName }).catch(() => {});
    });
  }, [analysisModel]);
  // ── End V4 Unknown Queue Writer ───────────────────────────────────────────

  // Read-through shorthands — single source via analysisModel.
  const parsedIngredients = analysisModel.parsedIngredients;
  const ingredientSummary = analysisModel.ingredientSummary;

  const ingredientCoveragePct: number | null = React.useMemo(() => {
    // V4 path: use actual registry-based coverage (accurate)
    if (analysisModel.source === "V4" && analysisModel.coveragePct !== null) {
      return analysisModel.coveragePct;
    }
    // Legacy path: normalizeIngredients-derived coverage
    if (!rawIngredientsText) return null;
    const result = normalizeIngredients(rawIngredientsText);
    if (!result.normalized.length) return null;
    return Math.round((1 - result.unknown_ratio) * 100);
  }, [rawIngredientsText, analysisModel.source, analysisModel.coveragePct]);

  const scoreConfidenceStyle = React.useMemo(() => {
    if (ingredientCoveragePct === null || ingredientCoveragePct >= 70) {
      return { opacity: 1 as number, lowConfidence: false };
    }
    if (ingredientCoveragePct >= 50) {
      return { opacity: 0.65 as number, lowConfidence: false };
    }
    return { opacity: 0.45 as number, lowConfidence: true };
  }, [ingredientCoveragePct]);

  const icerikAnalizi =
    product?.icerik_analizi?.icerikler ?? product?.ingredients_parsed ?? [];

  // ─── D2 perf fix — SINGLE TRUTH MAP ─────────────────────────────────────
  // resolveFeature() artık per-key 11 kez çağrılmıyor (eski: quickBadges'tan
  // 6 + safetyAlertResult'tan 5). Bu memo onları TEK YERDE 6 kez çağırır,
  // alt-tüketiciler (quickBadges + safetyAlertResult) hazır verdict'i okur.
  //
  // Kapsam: alcohol/fragrance/paraben/silicone/sulfate (5 alerji) + vegan
  // (quickBadges için). Polariteler/semantik DEĞİŞMEZ — sadece çağrı yeri
  // merkezi.
  //
  // D1 truth birleştirmesi KORUNUR: iki yüzey hâlâ aynı kaynaktan, sadece
  // kaynak artık tek hesap. Çelişki yapısal olarak hâlâ imkânsız.
  //
  // Deps: yalnızca scalar (string/null) değerler — `product?.id` (string,
  // ürün değişiminde değişir) + `rawIngredientsText` (string, hidrasyonda
  // değişir). Eski reference-tabanlı `(product as any)?.features` kaldırıldı
  // çünkü features jsonb hidrasyonu zaten rawIngredientsText'i invalide
  // etmeyebilir AMA resolveFeature kendi içinde signature-aware cache ile
  // features değişimini yakalar. Bu memo'nun amacı çağrı SAYISINI azaltmak,
  // değişim DETEKSİYONU değil — onu featureTruth.ts cache'i yapıyor.
  const featureTruthMap = React.useMemo(() => ({
    alcohol:   resolveFeature(product, "alcohol"),
    fragrance: resolveFeature(product, "fragrance"),
    paraben:   resolveFeature(product, "paraben"),
    silicone:  resolveFeature(product, "silicone"),
    sulfate:   resolveFeature(product, "sulfate"),
    vegan:     resolveFeature(product, "vegan"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [product?.id, rawIngredientsText]);

  // D1 fix: pass the full product so badges derive from resolveFeature
  // (canonical truth — features jsonb + contains_<key> + ingredient regex).
  // Same verdict source as safetyAlertEngine → no badge ↔ "Veri Eksik"
  // conflicts.
  // D2 perf: pass featureTruthMap so buildQuickBadges skips its 6 internal
  // resolveFeature calls and reads pre-resolved verdicts directly.
  // D2 perf+ (architect feedback): deps drop `product` reference. All 6
  // badge keys exist in featureTruthMap → buildQuickBadges takes the
  // preResolved branch for every key and never reads `product` fields. So
  // the output depends purely on featureTruthMap; React Query refetches
  // that change `product` reference (but not data) no longer invalidate.
  // `product` is still passed as the first arg only to satisfy the function
  // signature (used for fallback when preResolved key missing — which never
  // happens here).
  const quickBadges = React.useMemo(
    () => buildQuickBadges(product, featureTruthMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featureTruthMap],
  );

  const warningsArr: string[] = Array.isArray(product?.warnings)
    ? (product?.warnings as unknown as string[])
    : typeof (product?.warnings as unknown) === "string" &&
        (product?.warnings as unknown as string)
      ? [product?.warnings as unknown as string]
      : [];

  const benefitsArr: string[] = Array.isArray(product?.benefits)
    ? (product?.benefits ?? [])
    : [];

  // ── Normalized product (single source for OverviewPipeline) ─────
  const normalizedProduct = React.useMemo<NormalizedProduct | null>(
    () => (product ? normalizeProductData(product) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      product?.id,
      product?.short_benefit,
      product?.description,
      product?.ingredients,
      product?.warnings,
    ],
  );
  // ECZ4 P1 — Heavy downstream consumers (safety engine, similar/recommended
  // pipelines) read from this deferred view so they commit at low priority.
  // Hero (heroScore = normalizedProduct.score) keeps the immediate value.
  const deferredNormalizedProduct = useDeferredValue(normalizedProduct);

  // ── Kullanıcıya özel güvenlik notları ────────────────────────────
  const productSafetyNotes = React.useMemo<string[]>(() => {
    if (!product) return [];
    const profile: UserSafetyProfile = {
      allergies: preferences.allergies,
      specialConditions: preferences.specialConditions,
    };
    return getProductSafetyNotes((product as any).ingredients, profile);
  }, [product?.id, (product as any)?.ingredients, preferences]);

  // ── Akıllı uyarı motoru ──────────────────────────────────────────
  const smartWarnings = React.useMemo(
    () =>
      getSmartWarnings(parsedIngredients, {
        specialConditions: preferences.specialConditions,
        allergies: preferences.allergies,
        skinType: preferences.skinType,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      parsedIngredients.length,
      preferences.specialConditions,
      preferences.allergies,
      preferences.skinType,
    ],
  );

  // ── Ürüne özel profil uyarıları + uyum puanı ─────────────────────
  const { warnings: productWarnings, fitScore: productFitScore } =
    React.useMemo(
      () => {
        if (!product) return { warnings: [], fitScore: 100 };
        return evaluateProductWarnings(product as Record<string, any>, {
          allergies: preferences.allergies,
          specialConditions: preferences.specialConditions,
          allergyIngredients: preferences.allergyIngredients,
          avoidedIngredients: preferences.avoidedIngredients,
          skinType: preferences.skinType,
        });
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        product?.id,
        preferences.allergies,
        preferences.specialConditions,
        preferences.allergyIngredients,
        preferences.avoidedIngredients,
      ],
    );

  const hasProfile = React.useMemo(
    () =>
      preferences.skinType !== null ||
      preferences.specialConditions.length > 0 ||
      preferences.allergies.length > 0 ||
      preferences.allergyIngredients.length > 0 ||
      preferences.avoidedIngredients.length > 0,
    [
      preferences.skinType,
      preferences.specialConditions,
      preferences.allergies,
      preferences.allergyIngredients,
      preferences.avoidedIngredients,
    ],
  );

  // ── İçerik eşleştirme motoru ─────────────────────────────────────
  const ingredientNames = React.useMemo(
    () => parsedIngredients.map((i) => i.name),
    [parsedIngredients.length],
  );

  const ingredientAlerts = React.useMemo<IngredientAlert[]>(
    () =>
      getIngredientAlerts(ingredientNames, {
        allergyIngredients: preferences.allergyIngredients,
        avoidedIngredients: preferences.avoidedIngredients,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ingredientNames.length,
      preferences.allergyIngredients,
      preferences.avoidedIngredients,
    ],
  );

  const pregnancyBreastfeedingStatus = React.useMemo(
    () => getPregnancyBreastfeedingStatus(ingredientNames),
    [ingredientNames.length],
  );

  const pregnancyStatus: SafetyEval | null = React.useMemo(
    () =>
      preferences.specialConditions.includes("pregnancy")
        ? pregnancyBreastfeedingStatus.pregnancy
        : null,
    [preferences.specialConditions, pregnancyBreastfeedingStatus],
  );

  const breastfeedingStatus: SafetyEval | null = React.useMemo(
    () =>
      preferences.specialConditions.includes("breastfeeding")
        ? pregnancyBreastfeedingStatus.breastfeeding
        : null,
    [preferences.specialConditions, pregnancyBreastfeedingStatus],
  );

  const forChildNote: string | null = React.useMemo(
    () =>
      preferences.specialConditions.includes("for_child")
        ? getChildUseNote(ingredientNames)
        : null,
    [preferences.specialConditions, ingredientNames.length],
  );

  const topSafetyBadges = React.useMemo<SafetyBadge[]>(
    () =>
      getTopSafetyBadges(
        ingredientNames,
        {
          specialConditions: preferences.specialConditions,
          allergyIngredients: preferences.allergyIngredients,
          avoidedIngredients: preferences.avoidedIngredients,
        },
        // FEATURE TRUTH ipucu — hero chip ile çelişme riskini ortadan kaldırır.
        product as unknown as Record<string, unknown> | undefined,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ingredientNames.length,
      preferences.specialConditions,
      preferences.allergyIngredients,
      preferences.avoidedIngredients,
      product?.id,
    ],
  );

  // ── Akıllı Güvenlik Uyarı Motoru ─────────────────────────────────
  // D1 unification: Safety flags ProductBadgesSection ile aynı kaynaktan
  // (resolveFeature). Çelişki yapısal olarak imkânsız.
  //
  // D2 perf fix: artık doğrudan resolveFeature(product, key) ÇAĞIRMIYORUZ.
  // Üstteki featureTruthMap useMemo zaten 6 verdict'i tek hesapta üretmiş;
  // burada sadece map'ten OKUYORUZ. Bu sayede:
  //   - Per-render resolveFeature çağrı sayısı 11 → 6 (5 azalma)
  //   - _computeSig çağrıları 132 string concat → 72 (~%45 azalma)
  //   - useMemo deps reference-tabanlı `product`/`features` yerine
  //     featureTruthMap (kendi değer-tabanlı deps'iyle stabil) → React Query
  //     refetch'lerinde bu memo gereksiz yere invalidate olmuyor →
  //     runSafetyAlertEngine regex pass'i çok daha az tetikleniyor.
  //
  // Polarite çevirisi (FeatureVerdict ↔ ProductFeatureFlags):
  //   true  (içerir)     → "negative" (uyarı: içerir)
  //   false (içermez)    → "positive" (uyarı yok)
  //   null  (sinyal yok) → "unknown"  (Veri Eksik notu)
  // Vegan ProductFeatureFlags şemasında YOK — bu dönüşüm 5 alerji anahtarına
  // sınırlı (alcohol/fragrance/paraben/silicone/sulfate). Vegan için ayrı
  // bilgi notu üretilmiyor (kullanıcı kuralı).
  const safetyAlertResult = React.useMemo<SafetyAlertResult>(() => {
    // ECZ4 P1: deferredNormalizedProduct so safety engine pass runs at low
    // priority; first paint is unblocked. Output unchanged once deferred
    // commit lands.
    if (!deferredNormalizedProduct) {
      return { alerts: [], maxSeverity: null, isProfiled: false };
    }
    const toFlag = (key: FeatureKey): "positive" | "negative" | "unknown" => {
      const v = featureTruthMap[key as keyof typeof featureTruthMap];
      if (v === true) return "negative";
      if (v === false) return "positive";
      return "unknown";
    };
    const flags: ProductFeatureFlags = {
      fragrance: toFlag("fragrance"),
      alcohol:   toFlag("alcohol"),
      paraben:   toFlag("paraben"),
      silicone:  toFlag("silicone"),
      sulfate:   toFlag("sulfate"),
    };
    return runSafetyAlertEngine(
      {
        allergies: preferences.allergies,
        specialConditions: preferences.specialConditions,
        skinType: preferences.skinType,
      },
      flags,
      deferredNormalizedProduct.ingredientsRaw,
    );
  }, [
    featureTruthMap,
    deferredNormalizedProduct?.ingredientsRaw,
    preferences.allergies,
    preferences.specialConditions,
    preferences.skinType,
  ]);

  // ── Bağlamsal ürün ipucu — cilt profiliyle ürün içerikleri eşleştirilir ──
  const contextualProductHint = React.useMemo<{
    icon: string;
    color: string;
    msg: string;
  } | null>(() => {
    if (!parsedIngredients.length) return null;

    const names = parsedIngredients.map((i) => i.name.toLowerCase());
    const hasRetinol = names.some(
      (n) => n.includes("retinol") || n.includes("retinyl"),
    );
    const hasAHA = names.some(
      (n) =>
        n.includes("glycolic") ||
        n.includes("lactic acid") ||
        n.includes("mandelic"),
    );
    const hasBHA = names.some((n) => n.includes("salicylic"));
    const hasVitaminC = names.some(
      (n) =>
        n.includes("ascorbic") ||
        n.includes("vitamin c") ||
        n.includes("ascorbyl"),
    );

    const leke = getConcernProfile("leke");
    const hassas = getConcernProfile("hassasiyet");
    const akne = getConcernProfile("akne");
    const kuruluk = getConcernProfile("kuruluk");

    const isPrem = effectiveRole === "seckin";
    if (leke && (hasVitaminC || hasAHA)) {
      return {
        icon: "sun",
        color: "#B45309",
        msg: isPrem
          ? "Leke bakımında bu içerikleri gündüz kullanırken SPF uygulamasını atlama. Aktiflerin etkinliği UV korumasına bağlıdır."
          : "Leke bakımında bu ürünü kullanıyorsan güneş koruması şart.",
      };
    }
    if (hassas && (hasRetinol || hasAHA)) {
      return {
        icon: "shield",
        color: "#BE123C",
        msg: isPrem
          ? "Hassas cilt profiliyle bu güçlü aktifler yavaş tanıştırılmalıdır — haftada 1-2 kezden başlamak bariyer tepkisini azaltır."
          : "Hassas cilt profiliyle bu tür aktifler dikkatli kullanılmalıdır.",
      };
    }
    if (akne && hasBHA) {
      return {
        icon: "droplet",
        color: "#15803D",
        msg: isPrem
          ? "Akne eğilimli cildin için salisilik asit iyi bir tercih — ancak başlangıçta %0.5-1 konsantrasyondan başlamak tahriş riskini düşürür."
          : "Akne eğilimli ciltlerde BHA içerikli ürünler işe yarayabilir.",
      };
    }
    if (kuruluk && hasRetinol) {
      return {
        icon: "cloud",
        color: "#1D4ED8",
        msg: isPrem
          ? "Kuru ciltlerde retinol kullanımı gece nemlendiricisiyle desteklenmelidir. Sandviç yöntemi tahriş riskini düşürür."
          : "Kuru ciltlerde retinol kullanımı için güçlü bir nemlendirici önerilir.",
      };
    }
    return null;
  }, [parsedIngredients.length, effectiveRole]);

  // ── Benzer ürünler — aynı kategori, puana göre sıralı ───────────
  // Engine runs over the slim ~40-row slice from useRelatedProducts, so the
  // per-row normalizeProductData loop is cheap (was the JS-thread killer
  // when this received the full ~1250-row catalog).
  // ECZ4 P1: deferredNormalizedProduct so the per-row normalize loop over the
  // 40-row sibling slice runs at low priority. First paint unblocked.
  const similarProducts = React.useMemo(
    () =>
      deferredNormalizedProduct && allProducts.length > 0
        ? findSimilarProducts(deferredNormalizedProduct, allProducts as any, 5)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferredNormalizedProduct?.id, allProducts.length],
  );

  // ── Akıllı öneriler — skor + segment + endişe + içerik faktörlü ─
  const recommendedProducts = React.useMemo<RecommendationResult[]>(
    () => {
      if (!deferredNormalizedProduct || allProducts.length === 0) return [];
      const excludeIds = new Set(similarProducts.map((r) => r.normalized.id));
      return getRecommendedProducts(
        deferredNormalizedProduct,
        allProducts as any,
        excludeIds,
        6,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferredNormalizedProduct?.id, allProducts.length, similarProducts.length],
  );

  // ─── FEATURE TRUTH LAYER ─────────────────────────────────────────────────
  // Hero "Hamileler İçin..." chip'i artık tek doğruluk üzerinden çiziliyor:
  // DB pregnancy_safe + pregnancy_use + ingredient regex tarama (retinol,
  // BHA/AHA, hidroquinon vb.) en kötü sonucu kazanır → sticky uyarı listesi
  // ile asla çelişmez (audit 2026-05-04 #11).
  const _pregnancyVerdict = product ? resolvePregnancyVerdict(product) : null;
  const pregnancyInfo = (() => {
    if (!_pregnancyVerdict || _pregnancyVerdict.reason === "default") return null;
    const k =
      _pregnancyVerdict.status === "safe"
        ? "guvenli"
        : _pregnancyVerdict.status === "avoid"
          ? "onerilemez"
          : "dikkatli_kullanim";
    return PREGNANCY_LABELS[k] ?? null;
  })();
  // FEATURE TRUTH LAYER — breastfeeding chip (audit 2026-05-04 fix #3)
  // Eskiden product.breastfeeding_safe okunuyordu ama o DB sütunu yok →
  // chip her zaman gizli kalıyordu. Artık truth'tan türetiliyor; pregnancyInfo
  // ile birebir paralel davranır.
  const _breastfeedingVerdict = product ? resolveBreastfeedingVerdict(product) : null;
  const breastfeedingInfo = (() => {
    if (!_breastfeedingVerdict || _breastfeedingVerdict.reason === "default") return null;
    const k =
      _breastfeedingVerdict.status === "safe"
        ? "guvenli"
        : _breastfeedingVerdict.status === "avoid"
          ? "onerilemez"
          : "dikkatli_kullanim";
    return PREGNANCY_LABELS[k] ?? null;
  })();

  const ALLERGEN_MAP: Record<string, string[]> = {
    parfum: ["parfum", "fragrance"],
    parabens: ["paraben"],
    alkol: ["alcohol denat", "ethanol", "sd alcohol"],
    sls: ["sodium lauryl sulfate", "sodium laureth sulfate"],
    retinol: ["retinol", "retinyl"],
    "vitamin-c": ["ascorbic acid", "sodium ascorbyl"],
    niacinamide: ["niacinamide"],
    "salisilik-asit": ["salicylic acid"],
    "glikolik-asit": ["glycolic acid"],
    "benzil-alkol": ["benzyl alcohol"],
  };
  const detectedAllergens: string[] = [];
  if (userAllergens.length > 0 && product?.ingredients) {
    const ingLower = product.ingredients.map((i: string) => i.toLowerCase());
    userAllergens.forEach((a) => {
      const keywords = ALLERGEN_MAP[a] ?? [a];
      if (
        keywords.some((kw) => ingLower.some((ing: string) => ing.includes(kw)))
      )
        detectedAllergens.push(a);
    });
  }

  // ── Hero URI stability lock (ECZ4 NAV STEP C — FIX A) ────────────
  // Rules of Hooks: useRef MUTLAKA early-return'lerden ÖNCE çağrılmalı.
  // (Önceden L2538'deydi → loading/!product return'leri sonra useRef →
  // hook count rendering arası değişiyor → "Rendered more hooks…" hatası.)
  // Davranış aynı: product değişince session lock sıfırlanır, aynı session
  // içinde URI bir kez set edilir; ProductImage internals dokunulmadı.
  // Geri alma: bu blok ile aşağıdaki ProductImage call site'larındaki
  // heroImageUrl/heroThumbnailUrl referanslarını sil.
  const heroUriLockRef = useRef<{
    pid: string;
    uri: string | null;
    thumb: string | null;
  } | null>(null);
  const liveHeroUri = product ? resolveImageUrl(product) : null;
  const liveHeroThumb = product ? resolveThumbnailUrl(product) : null;
  const heroPidKey = product?.id != null ? String(product.id) : "";
  if (heroPidKey) {
    if (heroUriLockRef.current?.pid !== heroPidKey) {
      heroUriLockRef.current = {
        pid: heroPidKey,
        uri: liveHeroUri,
        thumb: liveHeroThumb,
      };
    } else {
      if (!heroUriLockRef.current.uri && liveHeroUri) {
        heroUriLockRef.current.uri = liveHeroUri;
      }
      if (!heroUriLockRef.current.thumb && liveHeroThumb) {
        heroUriLockRef.current.thumb = liveHeroThumb;
      }
    }
  }
  const heroImageUrl = heroUriLockRef.current?.uri ?? liveHeroUri;
  const heroThumbnailUrl = heroUriLockRef.current?.thumb ?? liveHeroThumb;

  // ── Loading / Error ───────────────────────────────────────────────
  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Feather name="alert-circle" size={40} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {error ?? "Ürün bulunamadı"}
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => id && fetchProduct(id)}
        >
          <Text style={styles.retryBtnText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Tab components ────────────────────────────────────────────────

  const BadgeChip = ({ badge }: { badge: QuickBadge }) => {
    const isPositive = badge.status === "positive";
    const isUnknown = badge.status === "unknown";
    const bg = isUnknown
      ? isDark
        ? "#1f2937"
        : "#f3f4f6"
      : isPositive
        ? isDark
          ? "#2A3820"
          : "#EAF1EA"
        : isDark
          ? "#2d1a0e"
          : "#fff7ed";
    const bc = isUnknown
      ? isDark
        ? "#374151"
        : "#d1d5db"
      : isPositive
        ? isDark
          ? "#3A4D30"
          : "#B8CEB8"
        : isDark
          ? "#92400e"
          : "#fcd34d";
    const tc = isUnknown
      ? colors.textMuted
      : isPositive
        ? isDark
          ? "#9DB88D"
          : "#6B7F5D"
        : isDark
          ? "#fbbf24"
          : "#92400e";
    const label = isUnknown
      ? badge.unknownLabel
      : isPositive
        ? badge.positiveLabel
        : badge.negativeLabel;
    const icon = isUnknown
      ? "help-circle"
      : isPositive
        ? "check-circle"
        : "alert-circle";
    return (
      <View
        style={[styles.badgeChip, { backgroundColor: bg, borderColor: bc }]}
      >
        <Feather name={icon as any} size={12} color={tc} />
        <Text style={[styles.badgeChipText, { color: tc }]}>{label}</Text>
      </View>
    );
  };

  const OverviewTab = () => {
    if (!normalizedProduct) return null;
    return (
      <>
        {/* ── Akıllı Güvenlik Uyarı Bandı — açıklama bölümünün üzerinde ── */}
        {safetyAlertResult.alerts.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <SafetyAlertBanner
              result={safetyAlertResult}
              isDark={isDark}
              showSafeBadge={false}
            />
          </View>
        )}

        {/* ── Bağlamsal Cilt Profili İpucu — içerik + endişe eşleşmesinde gösterilir ── */}
        {contextualProductHint && safetyAlertResult.alerts.length === 0 && (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${contextualProductHint.color}28`,
              backgroundColor: isDark
                ? `${contextualProductHint.color}12`
                : `${contextualProductHint.color}08`,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: contextualProductHint.color,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 9,
                paddingLeft: 16,
                paddingRight: 12,
                paddingVertical: 10,
              }}
            >
              <Feather
                name={contextualProductHint.icon as any}
                size={13}
                color={contextualProductHint.color}
                style={{ marginTop: 2 }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  fontWeight: "500",
                  color: isDark ? "#CBD5E1" : "#374151",
                  lineHeight: 18,
                }}
              >
                {contextualProductHint.msg}
              </Text>
            </View>
          </View>
        )}

        <OverviewPipeline
          product={normalizedProduct}
          isDark={isDark}
          cardBg={colors.surfaceCard}
          cardBorder={colors.border}
          textColor={colors.text}
          textSecondary={colors.textSecondary}
          textMuted={colors.textMuted}
          primary={colors.primary}
          similar={similarProducts}
          recommendations={recommendedProducts}
          allProducts={allProducts as any}
          onOpenDermoDetail={() => {
            setNavigationDermoResult(
              dermoResult,
              product ? resolveProductName(product) : undefined,
            );
            router.push("./dermo-detail");
          }}
          preferences={preferences}
          learningProfile={learningProfile}
          isSeckin={effectiveRole === "seckin"}
          parsedIngredients={parsedIngredients}
          ingredientSummary={ingredientSummary}
        />
      </>
    );
  };

  const IngredientsTab = () => {
    const hasRaw = parsedIngredients.length > 0;
    const hasAnalyzed = icerikAnalizi.length > 0;
    const displayList = showAll
      ? parsedIngredients
      : parsedIngredients.slice(0, 15);

    return (
      <View style={styles.tabContent}>
        {/* Özet panel */}
        {ingredientSummary.total > 0 && (
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.summaryHeader}>
              <View>
                <Text style={[styles.cardSectionTitle, { color: colors.text }]}>
                  İçerik Özeti
                </Text>
                <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                  {ingredientSummary.total} içerik analiz edildi
                </Text>
              </View>
              <View
                style={[
                  styles.summaryRatingBadge,
                  {
                    backgroundColor: `${ingredientSummary.ratingColor}15`,
                    borderColor: `${ingredientSummary.ratingColor}40`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.summaryRatingText,
                    { color: ingredientSummary.ratingColor },
                  ]}
                >
                  {ingredientSummary.ratingLabel}
                </Text>
              </View>
            </View>
            <View style={styles.summaryGrid}>
              {[
                {
                  label: "Güvenli",
                  count: ingredientSummary.safe,
                  color: "#6B7F5D",
                },
                {
                  label: "Düşük Risk",
                  count: ingredientSummary.low,
                  color: "#0891b2",
                },
                {
                  label: "Orta Risk",
                  count: ingredientSummary.medium,
                  color: "#d97706",
                },
                {
                  label: "Dikkat",
                  count: ingredientSummary.high,
                  color: "#dc2626",
                },
                {
                  label: "Bilinmiyor",
                  count: ingredientSummary.unknown,
                  color: "#6b7280",
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={[
                    styles.summaryStatItem,
                    {
                      backgroundColor: `${stat.color}10`,
                      borderColor: `${stat.color}20`,
                    },
                  ]}
                >
                  <Text
                    style={[styles.summaryStatCount, { color: stat.color }]}
                  >
                    {stat.count}
                  </Text>
                  <Text
                    style={[
                      styles.summaryStatLabel,
                      { color: colors.textMuted },
                    ]}
                  >
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
            {/* Uyarılar */}
            {ingredientSummary.warnings.length > 0 && (
              <View style={styles.summaryWarnings}>
                {ingredientSummary.warnings.map((w, i) => (
                  <View key={i} style={styles.warningRow}>
                    <View
                      style={[
                        styles.warningDot,
                        {
                          backgroundColor:
                            w.includes("Belirgin") || w.includes("yok")
                              ? "#6B7F5D"
                              : "#d97706",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.warningRowText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Analiz edilmiş içerikler (icerik_analizi) */}
        {hasAnalyzed && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              İçerik Analizi
            </Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              {icerikAnalizi.length} içerik · EWG & CIR kaynaklı
            </Text>
            <View style={styles.ingredientsList}>
              {icerikAnalizi.map((ing: any, idx: number) => (
                <IngredientBadge key={`${ing.isim}-${idx}`} ingredient={ing} />
              ))}
            </View>
          </View>
        )}

        {/* Kural tabanlı içerik listesi */}
        {hasRaw && !hasAnalyzed && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              İçerik Değerlendirmesi
            </Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              {parsedIngredients.length} içerik · kural tabanlı analiz
            </Text>
            <View style={styles.ingredientCards}>
              {displayList.map((ing, idx) => {
                const isExpanded = expandedIngredient === `${ing.name}-${idx}`;
                const lc = getRiskLevelColor(ing.level);
                const lb = getRiskLevelBg(ing.level);
                return (
                  <TouchableOpacity
                    key={`${ing.name}-${idx}`}
                    style={[
                      styles.ingredientCard,
                      {
                        backgroundColor: colors.surfaceCard,
                        borderColor: colors.border,
                        borderLeftColor: lc,
                        borderLeftWidth: 3,
                      },
                    ]}
                    onPress={() => {
                      setExpandedIngredient(
                        isExpanded ? null : `${ing.name}-${idx}`,
                      );
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.ingredientCardRow}>
                      <View style={styles.ingredientCardLeft}>
                        <Text
                          style={[
                            styles.ingredientName,
                            { color: colors.text },
                          ]}
                          numberOfLines={isExpanded ? undefined : 1}
                        >
                          {ing.name}
                        </Text>
                        {ing.nameTr !== ing.name && (
                          <Text
                            style={[
                              styles.ingredientNameTr,
                              { color: colors.textSecondary },
                            ]}
                            numberOfLines={isExpanded ? undefined : 1}
                          >
                            {ing.nameTr}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.riskBadge, { backgroundColor: lb }]}>
                        <Text style={[styles.riskBadgeText, { color: lc }]}>
                          {getRiskLevelLabel(ing.level)}
                        </Text>
                      </View>
                    </View>
                    {isExpanded && (
                      <Text
                        style={[
                          styles.ingredientDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {ing.desc}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {parsedIngredients.length > 15 && (
              <TouchableOpacity
                style={[styles.showMoreBtn, { borderColor: colors.border }]}
                onPress={() => setShowAll(!showAll)}
              >
                <Text style={[styles.showMoreText, { color: colors.primary }]}>
                  {showAll
                    ? "Daha az göster"
                    : `${parsedIngredients.length - 15} içerik daha göster`}
                </Text>
                <Feather
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Ham metin */}
        {rawIngredientsText && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Ürün Muhtevası
            </Text>
            {ingredientCoveragePct !== null && (
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted ?? colors.textSecondary,
                  marginTop: 2,
                  marginBottom: 4,
                }}
              >
                {`İçerik kapsaması: %${ingredientCoveragePct}`}
              </Text>
            )}
            {/* ECZ4 MUHTEVA FIX — ham içerik metin bloğu kullanıcıya gösterilmiyor.
                İngredient kartları + coverage satırı yeterli; ham INCI string
                kartların üstünde tekrar etmiyor. Section başlığı + coverage
                korundu, sadece <Text>{rawIngredientsText}</Text> kaldırıldı. */}
          </View>
        )}

        {!hasRaw && !hasAnalyzed && (
          <View style={styles.emptyTab}>
            <Feather name="inbox" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTabTitle, { color: colors.text }]}>
              İçerik Bilgisi Yok
            </Text>
            <Text style={[styles.emptyTabSub, { color: colors.textMuted }]}>
              Bu ürün için içerik listesi henüz eklenmemiş.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const CompatibilityTab = () => (
    <CompatibilityTabComponent
      product={product}
      parsedIngredients={parsedIngredients}
      ingredientSummary={ingredientSummary}
      detectedAllergens={detectedAllergens}
      pregnancyInfo={pregnancyInfo}
      breastfeedingInfo={breastfeedingInfo}
      productSafetyNotes={productSafetyNotes}
      preferences={preferences}
      effectiveRole={effectiveRole}
      isDark={isDark}
      smartWarnings={smartWarnings}
      hasProfile={hasProfile}
      ingredientAlerts={ingredientAlerts}
      pregnancyStatus={pregnancyStatus}
      breastfeedingStatus={breastfeedingStatus}
      forChildNote={forChildNote}
    />
  );

  const AnalysisTab = () => (
    <View style={styles.tabContent}>
      {/* Dermo score tam kart — tıklanabilir */}
      {dermoResult && (
        <TouchableOpacity
          style={[
            styles.dermoCard,
            { backgroundColor: colors.surfaceCard, borderColor: colors.border },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setNavigationDermoResult(
              dermoResult,
              product ? resolveProductName(product) : undefined,
            );
            router.push("./dermo-detail");
          }}
          activeOpacity={0.85}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <View style={styles.dermoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dermoTitle, { color: colors.text }]}>
                Dermatolojik Güvenlik Puanı
              </Text>
              {analysisModel.source === "V4" ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 2,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#6B7F5D18",
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderWidth: 1,
                      borderColor: "#6B7F5D30",
                      marginRight: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#6B7F5D",
                        fontWeight: "600",
                      }}
                    >
                      {analysisModel.totalIngredients ?? 0} içerik · V4
                    </Text>
                  </View>
                  {analysisModel.confidence === "high" && (
                    <View
                      style={{
                        backgroundColor: "#22c55e18",
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderWidth: 1,
                        borderColor: "#22c55e30",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#22c55e",
                          fontWeight: "600",
                        }}
                      >
                        Yüksek Güven
                      </Text>
                    </View>
                  )}
                  {analysisModel.confidence === "medium" && (
                    <View
                      style={{
                        backgroundColor: "#eab30818",
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderWidth: 1,
                        borderColor: "#eab30830",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#eab308",
                          fontWeight: "600",
                        }}
                      >
                        Orta Güven
                      </Text>
                    </View>
                  )}
                  {analysisModel.confidence === "low" && (
                    <View
                      style={{
                        backgroundColor: "#94a3b818",
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderWidth: 1,
                        borderColor: "#94a3b830",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#94a3b8",
                          fontWeight: "600",
                        }}
                      >
                        Düşük Güven
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                dermoResult.analyzed > 0 && (
                  <Text style={[styles.dermoSub, { color: colors.textMuted }]}>
                    {dermoResult.analyzed}/{dermoResult.total_ingredients}{" "}
                    içerik analiz edildi · EWG & CIR kaynaklı
                  </Text>
                )
              )}
              <Text
                style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}
              >
                Detay için dokun →
              </Text>
            </View>
            {(() => {
              // finalScore → renk ve etiket (scoreToColor/scoreToLabel ile hizalı)
              const displayScore =
                analysisModel.finalScore ?? dermoResult.total;
              const displayColor = scoreToColor(displayScore);
              return (
                <>
                  <View style={{ opacity: scoreConfidenceStyle.opacity }}>
                    <View
                      style={[
                        styles.dermoBadge,
                        {
                          backgroundColor: `${displayColor}18`,
                          borderColor: `${displayColor}40`,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.dermoScore, { color: displayColor }]}
                      >
                        {displayScore}
                      </Text>
                      <Text
                        style={[styles.dermoScoreMax, { color: displayColor }]}
                      >
                        /100
                      </Text>
                    </View>
                  </View>
                </>
              );
            })()}
          </View>
          {(() => {
            const displayScore = analysisModel.finalScore ?? dermoResult.total;
            const displayColor = scoreToColor(displayScore);
            const displayLabel = scoreToLabel(displayScore);
            return (
              <View style={{ opacity: scoreConfidenceStyle.opacity }}>
                <View
                  style={[
                    styles.dermoBar,
                    { backgroundColor: `${displayColor}20` },
                  ]}
                >
                  <View
                    style={[
                      styles.dermoBarFill,
                      {
                        width: `${displayScore}%` as any,
                        backgroundColor: displayColor,
                      },
                    ]}
                  />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[styles.dermoLabel, { color: displayColor }]}>
                    {displayLabel}
                  </Text>
                  {scoreConfidenceStyle.lowConfidence && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.textMuted,
                        marginLeft: 6,
                        fontStyle: "italic",
                      }}
                    >
                      düşük güven
                    </Text>
                  )}
                </View>
                {analysisModel.source === "V4" &&
                  analysisModel.explanationSummary && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textMuted,
                        marginTop: 4,
                        lineHeight: 16,
                      }}
                    >
                      {analysisModel.explanationSummary}
                    </Text>
                  )}
              </View>
            );
          })()}
          <View style={styles.dermoStats}>
            {analysisModel.source === "V4" ? (
              <>
                {analysisModel.ingredientSummary.safe > 0 && (
                  <DermoStat
                    label="Güvenli"
                    count={analysisModel.ingredientSummary.safe}
                    level="safe"
                  />
                )}
                {analysisModel.ingredientSummary.low > 0 && (
                  <DermoStat
                    label="Düşük"
                    count={analysisModel.ingredientSummary.low}
                    level="mild"
                  />
                )}
                {analysisModel.ingredientSummary.medium > 0 && (
                  <DermoStat
                    label="Orta"
                    count={analysisModel.ingredientSummary.medium}
                    level="moderate"
                  />
                )}
                {analysisModel.ingredientSummary.high > 0 && (
                  <DermoStat
                    label="Riskli"
                    count={analysisModel.ingredientSummary.high}
                    level="high_concern"
                  />
                )}
              </>
            ) : (
              <>
                {dermoResult.counts.beneficial > 0 && (
                  <DermoStat
                    label="Faydalı"
                    count={dermoResult.counts.beneficial}
                    level="beneficial"
                  />
                )}
                {dermoResult.counts.safe > 0 && (
                  <DermoStat
                    label="Güvenli"
                    count={dermoResult.counts.safe}
                    level="safe"
                  />
                )}
                {dermoResult.counts.mild > 0 && (
                  <DermoStat
                    label="Hafif"
                    count={dermoResult.counts.mild}
                    level="mild"
                  />
                )}
                {dermoResult.counts.moderate > 0 && (
                  <DermoStat
                    label="Orta"
                    count={dermoResult.counts.moderate}
                    level="moderate"
                  />
                )}
                {dermoResult.counts.high_concern > 0 && (
                  <DermoStat
                    label="Yüksek"
                    count={dermoResult.counts.high_concern}
                    level="high_concern"
                  />
                )}
                {dermoResult.counts.avoid > 0 && (
                  <DermoStat
                    label="Kaçının"
                    count={dermoResult.counts.avoid}
                    level="avoid"
                  />
                )}
              </>
            )}
          </View>
          {dermoResult.concerns.length > 0 && analysisModel.source !== "V4" && (
            <View style={styles.dermoConcerns}>
              <Text
                style={[
                  styles.dermoConcernTitle,
                  { color: colors.textSecondary },
                ]}
              >
                Dikkat Edilmesi Gerekenler:
              </Text>
              {dermoResult.concerns.map(({ name, entry }) => (
                <View
                  key={name}
                  style={[
                    styles.dermoConcernRow,
                    { borderLeftColor: levelToColor(entry.level) },
                  ]}
                >
                  <Text
                    style={[
                      styles.dermoConcernName,
                      { color: levelToColor(entry.level) },
                    ]}
                  >
                    {name}
                  </Text>
                  <Text
                    style={[
                      styles.dermoConcernDesc,
                      { color: colors.textMuted },
                    ]}
                    numberOfLines={2}
                  >
                    {entry.tr}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Score ring */}
      {score != null && (
        <View
          style={[
            styles.scoreSection,
            { backgroundColor: colors.surfaceCard, borderColor: colors.border },
          ]}
        >
          <ScoreRing
            score={analysisModel.finalScore ?? score ?? 0}
            size={88}
            label="Güvenlik Puanı"
          />
          <View style={styles.scoreStats}>
            {product.icerik_analizi && (
              <>
                <View style={styles.statRow}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: colors.scoreHigh },
                    ]}
                  />
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    Güvenli
                  </Text>
                  <Text style={[styles.statVal, { color: colors.text }]}>
                    {product.icerik_analizi.guvenli_sayisi ?? 0}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: colors.scoreMid },
                    ]}
                  />
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    Dikkatli
                  </Text>
                  <Text style={[styles.statVal, { color: colors.text }]}>
                    {product.icerik_analizi.dikkatli_sayisi ?? 0}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: colors.scoreLow },
                    ]}
                  />
                  <Text
                    style={[styles.statLabel, { color: colors.textSecondary }]}
                  >
                    Riskli
                  </Text>
                  <Text style={[styles.statVal, { color: colors.text }]}>
                    {product.icerik_analizi.riskli_sayisi ?? 0}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Uyarılar */}
      {warningsArr.length > 0 && (
        <View
          style={[
            styles.warningBox,
            {
              backgroundColor: `${colors.danger}10`,
              borderColor: `${colors.danger}25`,
            },
          ]}
        >
          <Feather name="alert-circle" size={16} color={colors.danger} />
          <View style={{ flex: 1, gap: 2 }}>
            {warningsArr.map((w, i) => (
              <Text
                key={i}
                style={[styles.warningText, { color: colors.danger }]}
              >
                • {w}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Gelişmiş analiz — seçkin teaser veya tam içerik */}
      {!canAccessFeature(effectiveRole, "smartWarnings") ? (
        <PremiumTeaserBlock
          isDark={isDark}
          title="Derin İnceleme"
          icon="activity"
          previewText={(() => {
            const comment = getPharmacistComment(
              product,
              ingredientSummary,
              parsedIngredients,
            );
            return comment.length > 0
              ? comment.slice(0, 120) + "…"
              : "Formül kalitesi, bileşen etkileşimleri ve klinik veri dengesi açısından bu ürün hakkında çok daha fazlası var…";
          })()}
          lockedLabel="Bileşen etkileşim analizi ve şahsî profil yorumu gelişmiş analizde açık."
          ctaLabel="Gelişmiş Analizi Aç"
          onPress={() => router.push("/ayarlar" as any)}
        />
      ) : (
        <View
          style={[
            styles.section,
            { backgroundColor: colors.surfaceCard, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Uzman Yorumu
          </Text>
          <Text style={[styles.aciklama, { color: colors.textSecondary }]}>
            {getPharmacistComment(
              product,
              ingredientSummary,
              parsedIngredients,
            ) || "Formül analizi için yeterli içerik verisi bulunamadı."}
          </Text>
        </View>
      )}
    </View>
  );

  const ReviewsTab = () => (
    <View style={styles.tabContent}>
      <View
        style={[
          styles.placeholderCard,
          {
            backgroundColor: isDark ? "#1C1508" : "#FFFBEB",
            borderColor: isDark ? "#78350F" : "#FCD34D",
          },
        ]}
      >
        <Text style={{ fontSize: 36 }}>💬</Text>
        <Text
          style={[
            styles.placeholderTitle,
            { color: isDark ? "#FCD34D" : "#92400E" },
          ]}
        >
          Henüz Yorum Yok
        </Text>
        <Text
          style={[
            styles.placeholderSub,
            { color: isDark ? "#FDE68A" : "#78350F" },
          ]}
        >
          Bu ürünü kullanan kişilerin yorumları ve tecrübeleri yakında burada
          görüntülenecek.
        </Text>
      </View>
    </View>
  );

  const DermoStat = ({
    label,
    count,
    level,
  }: {
    label: string;
    count: number;
    level: string;
  }) => (
    <View style={styles.dermoStatItem}>
      <View
        style={[styles.dermoStatDot, { backgroundColor: levelToColor(level) }]}
      />
      <Text style={[styles.dermoStatText, { color: colors.textSecondary }]}>
        {label}: {count}
      </Text>
    </View>
  );

  // ── Hero score chip renkleri ─────────────────────────────────────
  const heroScore = normalizedProduct?.score ?? null;
  const heroScoreConfig =
    heroScore == null
      ? null
      : heroScore >= 75
        ? {
            text: isDark ? "#9DB88D" : "#6B7F5D",
            bg: isDark ? "#2A3820" : "#EAF1EA",
            border: isDark ? "#3A4D30" : "#C8D8C8",
          }
        : heroScore >= 50
          ? {
              text: isDark ? "#FCD34D" : "#D97706",
              bg: isDark ? "#2D1A00" : "#FFFBEB",
              border: isDark ? "#78350F" : "#FDE68A",
            }
          : heroScore >= 25
            ? {
                text: isDark ? "#FCA5A5" : "#92400E",
                bg: isDark ? "#2D0A0A" : "#FFF7ED",
                border: isDark ? "#7F1D1D" : "#FED7AA",
              }
            : {
                text: isDark ? "#FC8181" : "#DC2626",
                bg: isDark ? "#2D0A0A" : "#FEF2F2",
                border: isDark ? "#7F1D1D" : "#FCA5A5",
              };
  const heroShortBenefit = normalizedProduct?.shortBenefit ?? null;

  // ── Hero URI stability lock — yukarıya taşındı (ECZ4 NAV STEP C — FIX A)
  // useRef Rules of Hooks gereği loading/error early return'lerinden ÖNCE
  // tanımlanmak zorundaydı; tanım L1453 öncesindeki bloğa taşındı. Burada
  // sadece yorum bırakıldı; heroImageUrl/heroThumbnailUrl orada hesaplanır.

  // ── Main render ──────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Navbar ── */}
      <View style={[styles.navbar, { paddingTop: topPad + 8 }]}>
        {/* ECZ4 BACK BTN FIX — surfaceCard cream zemin üstünde tek başına
            görünmez "parlak yuvarlak" izlenimi veriyordu. Net kenarlık + biraz
            büyütülmüş ikon + hitSlop eklendi. Pozisyon/şekil/renk paleti aynı. */}
        <TouchableOpacity
          style={[
            styles.navBtn,
            {
              backgroundColor: colors.surfaceCard,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text
            style={[styles.navTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {resolveBrand(product) ?? resolveProductName(product)}
          </Text>
          {navSource !== "home" && navSource !== "unknown" && (
            <Text
              style={{
                fontSize: 10,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              ← {backLabel}
            </Text>
          )}
        </View>
        <View style={styles.navBtn} />
      </View>

      {/* ── Dermatolojik Puanlama Sistemi Modalı (🌸 butonu) ── */}
      <Modal
        visible={showScoreInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScoreInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowScoreInfoModal(false)}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surfaceCard }]}
          >
            <Text style={styles.modalGarlic}>🌸</Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Dermatolojik Puanlama Sistemi
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              İçerik güvenliği 0–100 üzerinden değerlendirilir. EWG ve CIR
              kaynaklı bilimsel veriler kullanılır.
            </Text>
            <View style={styles.modalRows}>
              {[
                {
                  range: "75 – 100",
                  label: "Güvenli",
                  desc: "İçerikler genel olarak güvenli, risk düşük",
                  color: "#6B7F5D",
                },
                {
                  range: "50 – 74",
                  label: "Orta Güvenli",
                  desc: "Dikkat gerektiren bazı içerikler mevcut",
                  color: "#a16207",
                },
                {
                  range: "25 – 49",
                  label: "Dikkatli Kullan",
                  desc: "Hassas ciltler için uygun olmayabilir",
                  color: "#c2410c",
                },
                {
                  range: "0 – 24",
                  label: "Yüksek Risk",
                  desc: "Potansiyel zararlı içerikler tespit edildi",
                  color: "#b91c1c",
                },
              ].map((row) => (
                <View
                  key={row.range}
                  style={[styles.modalRow, { borderColor: colors.border }]}
                >
                  <View
                    style={[styles.modalDot, { backgroundColor: row.color }]}
                  />
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <Text style={[styles.modalRange, { color: row.color }]}>
                        {row.range}
                      </Text>
                      <Text style={[styles.modalLabel, { color: colors.text }]}>
                        {row.label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.modalDesc,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {row.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Text
              style={{
                fontSize: 11,
                color: colors.textMuted,
                marginTop: 8,
                textAlign: "center",
                lineHeight: 16,
              }}
            >
              Bu sistem tıbbi tanı değil, bilgilendirme amaçlıdır.
            </Text>
            <TouchableOpacity
              style={[styles.modalClose, { backgroundColor: colors.primary }]}
              onPress={() => setShowScoreInfoModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseText}>Anladım</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Eski Score Modal (geriye dönük) ── */}
      <Modal
        visible={showScoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowScoreModal(false)}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surfaceCard }]}
          >
            <Text style={styles.modalGarlic}>🌸</Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Puan Sistemi
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Güvenlik puanı, ürünün içerik kalitesini 0–100 üzerinden
              değerlendirir
            </Text>
            <TouchableOpacity
              style={[styles.modalClose, { backgroundColor: colors.primary }]}
              onPress={() => setShowScoreModal(false)}
            >
              <Text style={styles.modalCloseText}>Anladım</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowImageModal(false)}
      >
        <Pressable
          style={styles.lightboxOverlay}
          onPress={() => setShowImageModal(false)}
        >
          <Image
            source={{ uri: resolveImageUrl(product) || "" }}
            style={styles.lightboxImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={[
              styles.lightboxClose,
              { backgroundColor: colors.surfaceCard },
            ]}
            onPress={() => setShowImageModal(false)}
          >
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* ── Karşılaştırma Modalı ── */}
      <Modal
        visible={showCompareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowCompareModal(false)}
          />
          <View
            style={[
              styles.compareModal,
              { backgroundColor: colors.surfaceCard },
            ]}
          >
            <View style={styles.compareModalHandle}>
              <View
                style={[styles.handleBar, { backgroundColor: colors.border }]}
              />
            </View>
            <Text style={[styles.compareModalTitle, { color: colors.text }]}>
              Ürün Karşılaştırması
            </Text>
            {compareProduct && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {[
                  {
                    label: "Marka",
                    a: resolveBrand(product) ?? "—",
                    b:
                      (compareProduct as any).brand ??
                      (compareProduct as any).marka ??
                      "—",
                  },
                  {
                    label: "Segment",
                    a: product.segment ?? "—",
                    b: (compareProduct as any).segment ?? "—",
                  },
                  {
                    label: "Fiyat",
                    a: product.price != null ? `${product.price} ₺` : "—",
                    b:
                      (compareProduct as any).price != null
                        ? `${(compareProduct as any).price} ₺`
                        : "—",
                  },
                  {
                    label: "Hacim",
                    a: product.volume != null ? `${product.volume} ml` : "—",
                    b:
                      (compareProduct as any).volume != null
                        ? `${(compareProduct as any).volume} ml`
                        : "—",
                  },
                ].map((row) => (
                  <View
                    key={row.label}
                    style={[styles.compareRow, { borderColor: colors.border }]}
                  >
                    <Text
                      style={[
                        styles.compareRowLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      {row.label}
                    </Text>
                    <View style={styles.compareRowValues}>
                      <View
                        style={[
                          styles.compareValueBox,
                          {
                            backgroundColor: isDark ? "#1E3A5F" : "#EFF6FF",
                            borderColor: isDark ? "#2563EB" : "#BFDBFE",
                            flex: 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.compareValueText,
                            { color: colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {row.a}
                        </Text>
                        <Text
                          style={[
                            styles.compareValueSub,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {resolveProductName(product)}
                        </Text>
                      </View>
                      <Text
                        style={[styles.compareVs, { color: colors.textMuted }]}
                      >
                        VS
                      </Text>
                      <View
                        style={[
                          styles.compareValueBox,
                          {
                            backgroundColor: isDark ? "#2D1657" : "#FAF5FF",
                            borderColor: isDark ? "#7C3AED" : "#DDD6FE",
                            flex: 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.compareValueText,
                            { color: colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {row.b}
                        </Text>
                        <Text
                          style={[
                            styles.compareValueSub,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {(compareProduct as any).name ??
                            (compareProduct as any).isim ??
                            "—"}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Skor karşılaştırması */}
                {(() => {
                  const scoreA =
                    dermoResult?.total ?? (score != null ? score : null);
                  const rawScoreB =
                    (compareProduct as any).scores?.system_total_score ??
                    (compareProduct as any).sistem_toplam_puani;
                  const scoreB =
                    rawScoreB != null ? Math.round(rawScoreB * 10) : null;
                  if (scoreA == null && scoreB == null) return null;
                  return (
                    <View
                      style={[
                        styles.compareRow,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.compareRowLabel,
                          { color: colors.textMuted },
                        ]}
                      >
                        Dermatolojik Puan
                      </Text>
                      <View style={styles.compareRowValues}>
                        <View
                          style={[
                            styles.compareValueBox,
                            {
                              backgroundColor: isDark ? "#1E3A5F" : "#EFF6FF",
                              borderColor: isDark ? "#2563EB" : "#BFDBFE",
                              flex: 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.compareScoreNum,
                              {
                                color:
                                  scoreA != null &&
                                  scoreB != null &&
                                  scoreA >= scoreB
                                    ? "#6B7F5D"
                                    : colors.text,
                              },
                            ]}
                          >
                            {scoreA ?? "—"}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.compareVs,
                            { color: colors.textMuted },
                          ]}
                        >
                          VS
                        </Text>
                        <View
                          style={[
                            styles.compareValueBox,
                            {
                              backgroundColor: isDark ? "#2D1657" : "#FAF5FF",
                              borderColor: isDark ? "#7C3AED" : "#DDD6FE",
                              flex: 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.compareScoreNum,
                              {
                                color:
                                  scoreB != null &&
                                  scoreA != null &&
                                  scoreB >= scoreA
                                    ? "#6B7F5D"
                                    : colors.text,
                              },
                            ]}
                          >
                            {scoreB ?? "—"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                <TouchableOpacity
                  style={[
                    styles.compareCta,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    setShowCompareModal(false);
                    // ECZ4 Step 2 compare-modal fix:
                    // 1) replace → push: önceki product detail stack'te kalır,
                    //    geri tuşu mevcut ürüne döner (replace ile yok oluyordu).
                    // 2) compareProduct full ProductSummary objesi: prefetch +
                    //    setNavigationProduct ile yeni detail sıcak paint.
                    prefetchProductHeroImage(compareProduct as any);
                    setNavigationProduct(compareProduct as any);
                    router.push(`/product/${compareProduct.id}` as any);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.compareCtaText}>Muadil Ürünü İncele</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Segment Açıklama Modalı ── */}
      <Modal
        visible={showSegmentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSegmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSegmentModal(false)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surfaceCard, maxWidth: 340 },
            ]}
          >
            <Text
              style={{ fontSize: 22, textAlign: "center", marginBottom: 4 }}
            >
              {product?.segment === "seçkin" ? "✦" : "◆"}
            </Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {product?.segment === "seçkin"
                ? "Seçkin Segment"
                : product?.segment === "profesyonel"
                  ? "Profesyonel Segment"
                  : "Ekonomik Segment"}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
              {product?.segment === "seçkin"
                ? "Rafine içerikler, üstün formül kalitesi ve zengin uygulama tecrübesi sunar. Cilt bakımında en yüksek standartları hedefleyen kullanıcılar için."
                : product?.segment === "profesyonel"
                  ? "Dermatoloji odaklı, bilinçli kullanıcı için geliştirilmiş formüller. Yüksek etkinlik ve fiyat-performans dengesiyle öne çıkar."
                  : "Günlük ihtiyaçlara yönelik, bütçe dostu formüller. Temel etkililiği ön planda tutan erişilebilir seçimler."}
            </Text>
            {[
              {
                seg: "ekonomik",
                color: "#7A8F6B",
                bg: isDark ? "#2A3820" : "#EAF1EA",
                border: "#9DB88D",
                label: "◆ Ekonomik",
                desc: "Erişilebilir & temel",
              },
              {
                seg: "profesyonel",
                color: isDark ? "#A5B4FC" : "#3730A3",
                bg: isDark ? "#1E1B4B" : "#EEF2FF",
                border: "#6366F1",
                label: "◆ Profesyonel",
                desc: "İlmi & yüksek etkinlik",
              },
              {
                seg: "seçkin",
                color: "#B87333",
                bg: isDark ? "#2A1600" : "#FFF8EE",
                border: "#B87333",
                label: "✦ Seçkin",
                desc: "Üst düzey & rafine",
              },
            ].map(({ seg, color, bg, border, label, desc }) => (
              <View
                key={seg}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: bg,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginTop: 6,
                  opacity: product?.segment === seg ? 1 : 0.45,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "800", color }}>
                  {label}
                </Text>
                <Text style={{ fontSize: 12, color, opacity: 0.8, flex: 1 }}>
                  {desc}
                </Text>
                {product?.segment === seg && (
                  <Feather name="check" size={13} color={color} />
                )}
              </View>
            ))}
            <TouchableOpacity
              style={[
                styles.modalClose,
                { backgroundColor: colors.primary, marginTop: 4 },
              ]}
              onPress={() => setShowSegmentModal(false)}
            >
              <Text style={styles.modalCloseText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Seçkin paywall modalı — uyarılarda "Daha derin bak" rozeti tetikler */}
      <SeckinModal visible={showSeckinModal} onClose={() => setShowSeckinModal(false)} />

      {/* ── ScrollView + Hero + TabBar + TabContent ── */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: scrollPaddingBottom() },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[2]}
      >
        {/* Çocuk 0: Hero kartı (scroll ile kayar) */}
        <View>
          {/* ── Alternatif kaynağı bildirimi (sadece benzer ürünlerden gelinince) ── */}
          {fromSimilar && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: isDark ? "#1A1215" : "#FDF2F4",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isDark ? "#3D1A20" : "#FBCFE8",
              }}
            >
              <Feather name="zap" size={11} color="#C5847A" />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: "500",
                  color: isDark ? "#E8A0A8" : "#9B3F52",
                  flex: 1,
                  lineHeight: 16,
                }}
              >
                Bu ürün, incelediğin ürüne güçlü bir alternatif
              </Text>
            </View>
          )}
          <Animated.View style={heroCardAnimStyle}>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surfaceCard,
                  borderColor: colors.border,
                },
              ]}
            >
              {Platform.OS === "ios" ? (
                /* ── iOS: Yatay düzen — görsel sol, metadata+aksiyonlar sağ ───── */
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    {/* Sol: ürün görseli */}
                    <TouchableOpacity
                      onPress={() => {
                        const img = resolveImageUrl(product);
                        if (img) {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          setShowImageModal(true);
                        }
                      }}
                      onPressIn={onHeroPressIn}
                      onPressOut={onHeroPressOut}
                      activeOpacity={0.92}
                      style={{ marginRight: 12 }}
                    >
                      <ProductImage
                        imageUrl={heroImageUrl}
                        thumbnailUrl={heroThumbnailUrl}
                        mode="full"
                        noBorder
                        width={
                          Math.min(Dimensions.get("window").width - 52, 360) *
                          0.689
                        }
                        height={
                          Math.min(Dimensions.get("window").width - 52, 360) *
                          0.689
                        }
                        borderRadius={12}
                        isDark={isDark}
                      />
                    </TouchableOpacity>
                    {/* Sağ: üst metadata (segment+skor+kategori) + alt aksiyonlar */}
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "space-between",
                        minHeight:
                          Math.min(Dimensions.get("window").width - 52, 360) *
                          0.689,
                        paddingVertical: 2,
                      }}
                    >
                      {/* Üst: Skor + Segment + Kategori */}
                      <View style={{ gap: 6 }}>
                        {heroScoreConfig ? (
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                              setShowScoreInfoModal(true);
                            }}
                            activeOpacity={0.75}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              alignSelf: "flex-start",
                              borderRadius: 7,
                              borderWidth: 1,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              backgroundColor: heroScoreConfig.bg,
                              borderColor: heroScoreConfig.border,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "800",
                                color: heroScoreConfig.text,
                              }}
                            >
                              {Math.round(heroScore!)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "500",
                                color: heroScoreConfig.text,
                                opacity: 0.8,
                              }}
                            >
                              puan
                            </Text>
                            <Feather
                              name="info"
                              size={9}
                              color={heroScoreConfig.text}
                              style={{ opacity: 0.6, marginLeft: 1 }}
                            />
                          </TouchableOpacity>
                        ) : null}
                        {product.segment ? (
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                              setShowSegmentModal(true);
                            }}
                            activeOpacity={0.75}
                            style={[
                              styles.segmentPill,
                              {
                                backgroundColor:
                                  product.segment === "seçkin"
                                    ? colors.premiumBg
                                    : product.segment === "profesyonel"
                                      ? isDark
                                        ? "#1E1B4B"
                                        : "#EEF2FF"
                                      : isDark
                                        ? "#2A3820"
                                        : "#EAF1EA",
                                borderColor:
                                  product.segment === "seçkin"
                                    ? colors.premium
                                    : product.segment === "profesyonel"
                                      ? "#6366F1"
                                      : "#B8CEB8",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.segmentPillText,
                                {
                                  color:
                                    product.segment === "seçkin"
                                      ? colors.premium
                                      : product.segment === "profesyonel"
                                        ? isDark
                                          ? "#A5B4FC"
                                          : "#3730A3"
                                        : isDark
                                          ? "#9DB88D"
                                          : "#6B7F5D",
                                },
                              ]}
                            >
                              {product.segment === "seçkin"
                                ? "✦ Seçkin"
                                : product.segment === "profesyonel"
                                  ? "◆ Pro"
                                  : "◆ Ekonomik"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        {(product.category ?? product.kategori) ? (
                          <TouchableOpacity
                            onPress={() => {
                              const cat = product.category ?? product.kategori;
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                              navigateToAllProducts({
                                source: "home",
                                category: cat,
                              });
                            }}
                            activeOpacity={0.75}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              alignSelf: "flex-start",
                              borderRadius: 99,
                              borderWidth: 1,
                              paddingHorizontal: 9,
                              paddingVertical: 3,
                              backgroundColor: isDark ? "#0F1729" : "#F0F4FF",
                              borderColor: isDark ? "#1E3A5F" : "#BFDBFE",
                            }}
                          >
                            <Feather
                              name="grid"
                              size={9}
                              color={isDark ? "#60A5FA" : "#2563EB"}
                            />
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: isDark ? "#60A5FA" : "#2563EB",
                                letterSpacing: 0.2,
                              }}
                            >
                              {translateCategory(
                                product.category ?? product.kategori,
                              ) ?? "genel bakım"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      {/* Alt: Favori + Paylaş */}
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={toggleFavorite}
                          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                          style={[
                            styles.heroActionBtn,
                            {
                              backgroundColor: isFavorite(String(id ?? ""))
                                ? isDark
                                  ? "#3B0A14"
                                  : "#FFF1F2"
                                : isDark
                                  ? "#1F2937"
                                  : "#F3F4F6",
                              borderColor: isFavorite(String(id ?? ""))
                                ? "#FDA4AF"
                                : "transparent",
                            },
                          ]}
                        >
                          <Feather
                            name="heart"
                            size={14}
                            color={
                              isFavorite(String(id ?? ""))
                                ? "#e11d48"
                                : colors.textMuted
                            }
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleShare}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
                          style={[
                            styles.heroActionBtn,
                            {
                              backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
                              borderColor: "transparent",
                            },
                          ]}
                        >
                          <Feather
                            name="share"
                            size={14}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {/* Marka + ürün adı — görsel+sidebar'ın altında */}
                  <View style={styles.heroInfo}>
                    {resolveBrand(product) ? (
                      <TouchableOpacity
                        onPress={() => {
                          const brand = resolveBrand(product);
                          if (!brand) return;
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          navigateToAllProducts({ source: "home", brand });
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 0, right: 4 }}
                      >
                        <Text
                          style={[styles.brand, { color: colors.primary }]}
                          numberOfLines={1}
                        >
                          {resolveBrand(product)}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <Text
                      style={[styles.productName, { color: colors.text }]}
                      numberOfLines={3}
                    >
                      {resolveProductName(product)}
                    </Text>
                  </View>
                </>
              ) : (
                /* ── Android / Web: mevcut dikey düzen (değiştirilmedi) ────────── */
                <>
                  {/* Ürün görseli — tıklanınca fullscreen */}
                  <TouchableOpacity
                    onPress={() => {
                      const img = resolveImageUrl(product);
                      if (img) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowImageModal(true);
                      }
                    }}
                    onPressIn={onHeroPressIn}
                    onPressOut={onHeroPressOut}
                    activeOpacity={0.92}
                    style={{ marginBottom: 14, alignSelf: "stretch" }}
                  >
                    <ProductImage
                      imageUrl={heroImageUrl}
                      thumbnailUrl={heroThumbnailUrl}
                      mode="full"
                      noBorder
                      width={
                        Math.min(Dimensions.get("window").width - 52, 360) *
                        0.689
                      }
                      height={
                        Math.min(Dimensions.get("window").width - 52, 360) *
                        0.689
                      }
                      borderRadius={12}
                      isDark={isDark}
                    />
                  </TouchableOpacity>
                  <View style={styles.heroInfo}>
                    {/* Marka + Aksiyon ikonları aynı satırda */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {resolveBrand(product) ? (
                        <TouchableOpacity
                          onPress={() => {
                            const brand = resolveBrand(product);
                            if (!brand) return;
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            navigateToAllProducts({ source: "home", brand });
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 6, bottom: 6, left: 0, right: 4 }}
                          style={{ flex: 1 }}
                        >
                          <Text
                            style={[styles.brand, { color: colors.primary }]}
                            numberOfLines={1}
                          >
                            {resolveBrand(product)}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                      <TouchableOpacity
                        onPress={toggleFavorite}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={[
                          styles.heroActionBtn,
                          {
                            backgroundColor: isFavorite(String(id ?? ""))
                              ? isDark
                                ? "#3B0A14"
                                : "#FFF1F2"
                              : isDark
                                ? "#1F2937"
                                : "#F3F4F6",
                            borderColor: isFavorite(String(id ?? ""))
                              ? "#FDA4AF"
                              : "transparent",
                          },
                        ]}
                      >
                        <Feather
                          name="heart"
                          size={14}
                          color={
                            isFavorite(String(id ?? ""))
                              ? "#e11d48"
                              : colors.textMuted
                          }
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleShare}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
                        style={[
                          styles.heroActionBtn,
                          {
                            backgroundColor: isDark ? "#1F2937" : "#F3F4F6",
                            borderColor: "transparent",
                          },
                        ]}
                      >
                        <Feather
                          name="share"
                          size={14}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text
                      style={[styles.productName, { color: colors.text }]}
                      numberOfLines={3}
                    >
                      {resolveProductName(product)}
                    </Text>
                    {/* Skor mini-chip — tıklanınca puanlama modalı açılır */}
                    {heroScoreConfig ? (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                          setShowScoreInfoModal(true);
                        }}
                        activeOpacity={0.75}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          alignSelf: "flex-start",
                          borderRadius: 7,
                          borderWidth: 1,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          backgroundColor: heroScoreConfig.bg,
                          borderColor: heroScoreConfig.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "800",
                            color: heroScoreConfig.text,
                          }}
                        >
                          {Math.round(heroScore!)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "500",
                            color: heroScoreConfig.text,
                            opacity: 0.8,
                          }}
                        >
                          puan
                        </Text>
                        <Feather
                          name="info"
                          size={9}
                          color={heroScoreConfig.text}
                          style={{ opacity: 0.6, marginLeft: 1 }}
                        />
                      </TouchableOpacity>
                    ) : null}
                    {/* Segment + Kategori — alt etiket satırı */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      {product.segment ? (
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            setShowSegmentModal(true);
                          }}
                          activeOpacity={0.75}
                          style={[
                            styles.segmentPill,
                            {
                              backgroundColor:
                                product.segment === "seçkin"
                                  ? colors.premiumBg
                                  : product.segment === "profesyonel"
                                    ? isDark
                                      ? "#1E1B4B"
                                      : "#EEF2FF"
                                    : isDark
                                      ? "#2A3820"
                                      : "#EAF1EA",
                              borderColor:
                                product.segment === "seçkin"
                                  ? colors.premium
                                  : product.segment === "profesyonel"
                                    ? "#6366F1"
                                    : "#B8CEB8",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.segmentPillText,
                              {
                                color:
                                  product.segment === "seçkin"
                                    ? colors.premium
                                    : product.segment === "profesyonel"
                                      ? isDark
                                        ? "#A5B4FC"
                                        : "#3730A3"
                                      : isDark
                                        ? "#9DB88D"
                                        : "#6B7F5D",
                              },
                            ]}
                          >
                            {product.segment === "seçkin"
                              ? "✦ Seçkin"
                              : product.segment === "profesyonel"
                                ? "◆ Pro"
                                : "◆ Ekonomik"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {(product.category ?? product.kategori) ? (
                        <TouchableOpacity
                          onPress={() => {
                            const cat = product.category ?? product.kategori;
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            navigateToAllProducts({
                              source: "home",
                              category: cat,
                            });
                          }}
                          activeOpacity={0.75}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            borderRadius: 99,
                            borderWidth: 1,
                            paddingHorizontal: 9,
                            paddingVertical: 3,
                            backgroundColor: isDark ? "#0F1729" : "#F0F4FF",
                            borderColor: isDark ? "#1E3A5F" : "#BFDBFE",
                          }}
                        >
                          <Feather
                            name="grid"
                            size={9}
                            color={isDark ? "#60A5FA" : "#2563EB"}
                          />
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: isDark ? "#60A5FA" : "#2563EB",
                              letterSpacing: 0.2,
                            }}
                          >
                            {translateCategory(
                              product.category ?? product.kategori,
                            ) ?? "genel bakım"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </>
              )}
            </View>
          </Animated.View>

          {/* ── Güvenlik rozet satırı (profil varsa gösterilir) ── */}
          {hasProfile && topSafetyBadges.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {topSafetyBadges.map((badge, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    borderRadius: 20,
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: `${badge.color}15`,
                    borderColor: `${badge.color}40`,
                  }}
                >
                  <Feather
                    name={badge.icon as any}
                    size={11}
                    color={badge.color}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: "700",
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Akıllı uyarı mini-chip (profil varsa ve sensitive seviyede) ── */}
          {(() => {
            if (topSafetyBadges.length > 0) return null;
            const topWarn = smartWarnings.find(
              (w) => w.level === "sensitive" && w.boostedByProfile,
            );
            if (!topWarn || !hasProfile) return null;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  marginTop: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  backgroundColor: warningLevelBg(topWarn.level),
                  borderColor: warningLevelBorder(topWarn.level),
                }}
              >
                <Feather
                  name={warningLevelIcon(topWarn.level) as any}
                  size={13}
                  color={warningLevelColor(topWarn.level)}
                  style={{ marginTop: 1, flexShrink: 0 }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: warningLevelColor(topWarn.level),
                    lineHeight: 17,
                  }}
                >
                  {topWarn.message}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* ── Profil Uyarıları — hero ile tab arası ──
            ÖNEMLİ: Bu wrapper View HER ZAMAN render edilir (boşsa bile).
            Aksi halde stickyHeaderIndices={[1]} koşullu render yüzünden
            kayar (uyarı varsa Warnings sticky olur, TabBar yapışmaz →
            içerik üst üste biner). Wrapper sabit, içerik koşullu. */}
        <View>
          {productWarnings.length > 0 &&
            (() => {
              const { label: fsLabel, color: fsColor } =
                fitScoreLabel(productFitScore);
              return (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: 2,
                  }}
                >
                  {/* Uyum puanı başlık bandı */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: fsColor,
                        marginRight: 6,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: "700",
                        color: fsColor,
                      }}
                    >
                      {fsLabel}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: colors.textMuted,
                        marginLeft: 5,
                      }}
                    >
                      · {productFitScore}/100 profil uyumu
                    </Text>
                  </View>
                  <ProductWarningList
                    warnings={productWarnings}
                    isDark={isDark}
                    compact
                    isPremium={effectiveRole === "seckin"}
                    onPremiumLockPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowSeckinModal(true);
                    }}
                    onAlternativesPress={
                      product
                        ? () => {
                            router.push(
                              `/product/similar?productId=${product.id}&category=${encodeURIComponent((product as any).category ?? "")}&subcategory=${encodeURIComponent((product as any).subcategory ?? "")}` as any,
                            );
                          }
                        : undefined
                    }
                  />
                </View>
              );
            })()}
        </View>

        {/* Çocuk 2: Tab bar (sticky) */}
        <View
          style={[
            styles.tabBarWrapper,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tabBtn,
                    isActive && {
                      borderBottomColor: colors.primary,
                      borderBottomWidth: 2,
                    },
                  ]}
                  onPress={() => switchTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      { color: isActive ? colors.primary : colors.textMuted },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Çocuk 3: Tab içeriği (animasyonlu)
            NOT: Fonksiyon olarak çağrılıyor (<Tab /> değil Tab()),
            iOS'ta her render'da yeniden mount sorununu önler */}
        <Animated.View style={{ opacity: tabAnim }}>
          {activeTab === "overview" && OverviewTab()}
          {activeTab === "ingredients" && IngredientsTab()}
          {activeTab === "compatibility" && CompatibilityTab()}
          {activeTab === "reviews" && ReviewsTab()}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  backBtn: { position: "absolute", top: 20, left: 20 },
  errorText: { fontSize: 16 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  retryBtnText: { color: "#fff", fontWeight: "600" as const },

  // Navbar
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  navCenter: { flex: 1, alignItems: "center" },
  navTitle: { fontSize: 15, fontWeight: "700" as const },

  // Hero
  scroll: { paddingHorizontal: 16, gap: 0 },
  heroCard: {
    flexDirection: "column",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    alignItems: "stretch",
    marginBottom: 0,
  },
  heroInfo: { gap: 4 },
  brand: {
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  productName: { fontSize: 16, fontWeight: "700" as const, lineHeight: 22 },
  kategori: { fontSize: 12 },
  segmentPill: {
    alignSelf: "flex-start" as const,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  segmentPillText: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 0.3,
  },
  heroActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  // Tab bar
  tabBarWrapper: {
    borderBottomWidth: 1,
    marginHorizontal: -16,
    paddingHorizontal: 0,
  },
  tabBar: { flexDirection: "row", paddingHorizontal: 12 },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnText: { fontSize: 13, fontWeight: "600" as const },

  // Tab content
  tabContent: { paddingTop: 14, gap: 14 },

  // Section
  section: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    borderColor: "transparent",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const },
  sectionTitleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 10,
  },
  sectionSub: { fontSize: 12, marginTop: -6 },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 6,
  },

  // Short benefit banner
  shortBenefitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shortBenefitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700" as const,
    lineHeight: 19,
  },

  // Meta chips
  metaChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  metaChipText: { fontSize: 12, fontWeight: "700" as const },

  // Badges card
  badgesCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeChipText: { fontSize: 12, fontWeight: "600" as const },

  // Dermo summary card
  dermoSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  dermoSummaryLeft: { flex: 1, gap: 6 },
  dermoSummaryLabel: { fontSize: 13, fontWeight: "700" as const },
  dermoSummaryBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  dermoSummaryFill: { height: 6, borderRadius: 3 },
  dermoSummaryBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    flexDirection: "row",
    gap: 1,
  },
  dermoSummaryScore: { fontSize: 22, fontWeight: "800" as const },
  dermoSummaryMax: {
    fontSize: 11,
    fontWeight: "600" as const,
    alignSelf: "flex-end",
    marginBottom: 2,
  },

  // Warnings card
  warningsCard: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  warningsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  warningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingLeft: 4,
  },
  warningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  warningRowText: { fontSize: 13, flex: 1, lineHeight: 19 },

  // Action buttons
  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: "22%" as any,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" as const },

  // Muadil
  muadilList: { gap: 10 },
  muadilCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  muadilAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  muadilAvatarText: { fontSize: 17, fontWeight: "700" as const },
  muadilInfo: { flex: 1, gap: 2 },
  muadilBrand: {
    fontSize: 10,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  muadilName: { fontSize: 13, fontWeight: "600" as const, lineHeight: 17 },
  muadilScore: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  muadilScoreText: { fontSize: 11, fontWeight: "700" as const },
  muadilActions: { gap: 6, alignItems: "flex-end" },
  muadilBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  muadilBtnText: { fontSize: 11, fontWeight: "600" as const },

  // Ingredient summary
  summaryCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryRatingBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  summaryRatingText: { fontSize: 13, fontWeight: "700" as const },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryStatItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 70,
  },
  summaryStatCount: { fontSize: 22, fontWeight: "800" as const },
  summaryStatLabel: { fontSize: 11, marginTop: 2 },
  summaryWarnings: { gap: 6, marginTop: 4 },

  // Ingredient cards
  ingredientCards: { gap: 6 },
  ingredientCard: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 6 },
  ingredientCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  ingredientCardLeft: { flex: 1, gap: 2 },
  ingredientName: { fontSize: 13, fontWeight: "600" as const },
  ingredientNameTr: { fontSize: 11 },
  ingredientDesc: { fontSize: 12, lineHeight: 17 },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexShrink: 0,
  },
  riskBadgeText: { fontSize: 10, fontWeight: "700" as const },

  ingredientsList: { gap: 0 },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  showMoreText: { fontSize: 14, fontWeight: "600" as const },

  // Compatibility
  allergenAlert: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
  },
  allergenTitle: { fontSize: 13, fontWeight: "700" as const, marginBottom: 2 },
  allergenDesc: { fontSize: 12, lineHeight: 17 },
  safetyRow: { gap: 8 },
  safetyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  safetyText: { fontSize: 13, fontWeight: "600" as const, flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600" as const },

  // Analysis
  dermoCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 12 },
  dermoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  dermoTitle: { fontSize: 15, fontWeight: "700" as const },
  dermoSub: { fontSize: 11, marginTop: 2 },
  dermoBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  dermoScore: { fontSize: 26, fontWeight: "800" as const },
  dermoScoreMax: {
    fontSize: 12,
    fontWeight: "600" as const,
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  dermoBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  dermoBarFill: { height: 8, borderRadius: 4 },
  dermoLabel: { fontSize: 14, fontWeight: "700" as const },
  dermoStats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dermoStatItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dermoStatDot: { width: 8, height: 8, borderRadius: 4 },
  dermoStatText: { fontSize: 12 },
  dermoConcerns: { gap: 6, marginTop: 4 },
  dermoConcernTitle: {
    fontSize: 12,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  dermoConcernRow: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
  dermoConcernName: {
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  dermoConcernDesc: { fontSize: 11, lineHeight: 15 },

  scoreSection: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 20,
  },
  scoreStats: { flex: 1, gap: 10 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { flex: 1, fontSize: 13 },
  statVal: { fontSize: 15, fontWeight: "700" as const },

  warningBox: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
  },
  warningText: { fontSize: 13, lineHeight: 18 },

  // Placeholder
  placeholderCard: {
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
  },
  placeholderTitle: { fontSize: 16, fontWeight: "700" as const },
  placeholderSub: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  // Empty
  emptyTab: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyTabTitle: { fontSize: 16, fontWeight: "700" as const },
  emptyTabSub: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  // Text
  aciklama: { fontSize: 14, lineHeight: 21 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 14, flex: 1, lineHeight: 20 },
  shortDescRow: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  shortDescText: {
    fontSize: 13,
    fontWeight: "600" as const,
    fontStyle: "italic" as const,
    lineHeight: 19,
  },
  disclaimer: { fontSize: 11, lineHeight: 16, fontStyle: "italic" as const },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 12,
    elevation: 8,
  },
  modalGarlic: { fontSize: 44, marginBottom: 4 },
  modalTitle: { fontSize: 20, fontWeight: "800" as const },
  modalSub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  modalRows: { width: "100%", gap: 10, marginTop: 4 },
  modalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  modalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  modalRange: { fontSize: 12, fontWeight: "700" as const },
  modalLabel: { fontSize: 13, fontWeight: "600" as const },
  modalDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  modalClose: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  modalCloseText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },

  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: { width: "90%", height: "70%" },
  lightboxClose: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
  },

  // Compare modal
  compareModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "85%",
    elevation: 10,
  },
  compareModalHandle: { alignItems: "center", marginBottom: 12 },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  compareModalTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    marginBottom: 16,
  },
  compareRow: { borderBottomWidth: 1, paddingVertical: 14, gap: 8 },
  compareRowLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  compareRowValues: { flexDirection: "row", alignItems: "center", gap: 8 },
  compareValueBox: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 2 },
  compareValueText: { fontSize: 14, fontWeight: "600" as const },
  compareValueSub: { fontSize: 10 },
  compareVs: { fontSize: 11, fontWeight: "700" as const, flexShrink: 0 },
  compareScoreNum: {
    fontSize: 24,
    fontWeight: "800" as const,
    textAlign: "center",
  },
  compareCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 20,
  },
  compareCtaText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
});