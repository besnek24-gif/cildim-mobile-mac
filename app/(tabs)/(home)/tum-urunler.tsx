import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { useProductCount } from "@/hooks/useProductCount";
import type { Product } from "@/types/product";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { canUseAllergyFilter } from "@/lib/accessControl";
import { detectAllergyConflict } from "@/lib/allergyDetector";
import {
  navigateToProduct as navToProduct,
  goBack,
} from "@/src/navigation/navigationHelpers";
import { parseNavigationSource } from "@/src/navigation/navigationModel";
import {
  findSuggestion,
  findSuggestions,
  filterByQuery,
  smartFilter,
  type SearchSuggestion,
} from "@/lib/fuzzySearch";
import {
  getSearchScore,
  getDidYouMeanSuggestion,
  expandSearchQuery,
  normalizeSearchText,
  detectSearchIntent,
} from "@/src/search/searchIntelligence";
import { SEARCH_INTENTS, type IntentKey } from "@/src/search/searchIntentLibrary";
import {
  semanticSearch,
  type SemanticResult,
  type SemanticSearchOutput,
} from "@/lib/semanticSearch";
import { trackEvent } from "@/lib/userEvents";
import { recordCorrection } from "@/lib/searchCorrections";

// ── Palet ─────────────────────────────────────────────────────────────────────

const SC = {
  light: {
    bg:           "#E8E1D5",
    text:         "#1A100A",
    textSub:      "#5C4535",
    textMuted:    "#8A7060",
    searchBg:     "#F2EBE0",
    searchBorder: "#CFC3B0",
    border:       "#D4C9B6",
    intentBg:     "#F0FDF4",
    intentBorder: "#BBF7D0",
    intentText:   "#166534",
    sectionText:  "#7C6555",
    reasonBg:     "#F0FDF4",
    reasonText:   "#166534",
    reasonDark:   "#1E4D35",
  },
  dark: {
    bg:           "#0E0B09",
    text:         "#F8F2EB",
    textSub:      "#C0AA96",
    textMuted:    "#7A6558",
    searchBg:     "#1C1712",
    searchBorder: "#3A2E24",
    border:       "#2A2018",
    intentBg:     "#0D2818",
    intentBorder: "#166534",
    intentText:   "#4ADE80",
    sectionText:  "#9A8070",
    reasonBg:     "#0D2818",
    reasonText:   "#4ADE80",
    reasonDark:   "#4ADE80",
  },
};

// ── Sabitler ──────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width;
/** ProductCard içindeki GRID_COL_W ile birebir aynı formül */
const CARD_W = Math.floor((SCREEN_W - 38) / 2);

// ── Liste Öğesi Tipleri ───────────────────────────────────────────────────────

type PairSlot = { product: Product; reason?: string };

type ListItem =
  | { type: "section"; title: string; count: number }
  | { type: "pair"; left: PairSlot; right?: PairSlot }
  | { type: "concern-chips"; suggestions: string[] };

function buildNormalPairs(products: Product[]): ListItem[] {
  const items: ListItem[] = [];
  for (let i = 0; i < products.length; i += 2) {
    items.push({
      type: "pair",
      left:  { product: products[i] },
      right: products[i + 1] ? { product: products[i + 1] } : undefined,
    });
  }
  return items;
}

function buildSemanticPairs(results: SemanticResult[]): ListItem[] {
  const top     = results.filter((r) => r.group === "top");
  const similar = results.filter((r) => r.group === "similar");
  const related = results.filter((r) => r.group === "related");

  const items: ListItem[] = [];

  const pushGroup = (list: SemanticResult[], title: string) => {
    if (list.length === 0) return;
    items.push({ type: "section", title, count: list.length });
    for (let i = 0; i < list.length; i += 2) {
      items.push({
        type: "pair",
        left:  { product: list[i].product, reason: list[i].matchReasons[0] },
        right: list[i + 1]
          ? { product: list[i + 1].product, reason: list[i + 1].matchReasons[0] }
          : undefined,
      });
    }
  };

  pushGroup(top,     "En Uygun Ürünler");
  pushGroup(similar, "Benzer Alternatifler");
  pushGroup(related, "İlgili Ürünler");
  return items;
}

// ── Öneri Chip'i (typo düzeltme) ─────────────────────────────────────────────

function SuggestionChip({
  suggestion,
  onAccept,
  sc,
}: {
  suggestion: SearchSuggestion;
  onAccept: (t: string) => void;
  sc: typeof SC.light;
}) {
  return (
    <View
      style={[
        chip.wrap,
        { backgroundColor: sc.searchBg, borderColor: sc.searchBorder },
      ]}
    >
      <Feather name="search" size={13} color={sc.textMuted} />
      <Text style={[chip.label, { color: sc.textMuted }]}>
        Bunu mu demek istediniz?
      </Text>
      <TouchableOpacity
        onPress={() => onAccept(suggestion.correctedQuery)}
        activeOpacity={0.75}
        style={[chip.btn, { borderColor: sc.border }]}
      >
        <Text style={[chip.btnText, { color: sc.textSub }]}>
          {suggestion.display}
        </Text>
        <Feather name="arrow-right" size={11} color={sc.textSub} />
      </TouchableOpacity>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 16,
    marginTop: 8,
    flexWrap: "wrap" as const,
  },
  label:   { fontSize: 12, fontWeight: "500" as const, marginRight: 6 },
  btn:     { flexDirection: "row" as const, alignItems: "center" as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 2 },
  btnText: { fontSize: 12, fontWeight: "700" as const, marginRight: 4 },
});

// ── İnt Banner ───────────────────────────────────────────────────────────────

function IntentBanner({
  label,
  onClear,
  sc,
}: {
  label: string;
  onClear: () => void;
  sc: typeof SC.light;
}) {
  return (
    <View
      style={[
        intentBanner.wrap,
        { backgroundColor: sc.intentBg, borderColor: sc.intentBorder },
      ]}
    >
      <Feather name="zap" size={13} color={sc.intentText} />
      <Text style={[intentBanner.text, { color: sc.intentText }]}>
        <Text style={{ fontWeight: "700" }}>{label}</Text>
        {" "}için ürünler
      </Text>
      <TouchableOpacity
        onPress={onClear}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={14} color={sc.intentText} />
      </TouchableOpacity>
    </View>
  );
}

const intentBanner = StyleSheet.create({
  wrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 4,
  },
  text: { flex: 1, fontSize: 12, marginLeft: 6 },
});

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, sc }: { title: string; count: number; sc: typeof SC.light }) {
  return (
    <View style={sectionHdr.wrap}>
      <Text style={[sectionHdr.title, { color: sc.textSub }]}>{title}</Text>
      <Text style={[sectionHdr.count, { color: sc.textMuted }]}>{count}</Text>
    </View>
  );
}

const sectionHdr = StyleSheet.create({
  wrap:  { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 13, fontWeight: "700" as const, flex: 1 },
  count: { fontSize: 12, fontWeight: "500" as const },
});

// ── Match Reason Tag ──────────────────────────────────────────────────────────

function ReasonTag({ reason, sc }: { reason: string; sc: typeof SC.light }) {
  return (
    <View style={[reasonTag.pill, { backgroundColor: sc.reasonBg }]}>
      <Text style={[reasonTag.text, { color: sc.reasonText }]} numberOfLines={1}>
        {reason}
      </Text>
    </View>
  );
}

const reasonTag = StyleSheet.create({
  pill: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" as const, marginTop: 5, maxWidth: "95%" as any },
  text: { fontSize: 10, fontWeight: "600" as const },
});

// ── Kaygı Önerileri (empty state) ────────────────────────────────────────────

function ConcernChips({
  suggestions,
  onTap,
  sc,
}: {
  suggestions: string[];
  onTap: (s: string) => void;
  sc: typeof SC.light;
}) {
  return (
    <View style={concernChips.wrap}>
      <Text style={[concernChips.label, { color: sc.textMuted }]}>
        Şunları deneyebilirsiniz:
      </Text>
      <View style={concernChips.row}>
        {suggestions.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onTap(s)}
            activeOpacity={0.75}
            style={[concernChips.chip, { backgroundColor: sc.searchBg, borderColor: sc.border }]}
          >
            <Text style={[concernChips.chipText, { color: sc.textSub }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const concernChips = StyleSheet.create({
  wrap:     { paddingHorizontal: 12, paddingTop: 16 },
  label:    { fontSize: 12, fontWeight: "500" as const, marginBottom: 10 },
  row:      { flexDirection: "row" as const, flexWrap: "wrap" as const },
  chip:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 13, fontWeight: "600" as const },
});

// ── Çift Ürün Satırı ──────────────────────────────────────────────────────────

function ProductPairRow({
  left,
  right,
  showReasons,
  onPress,
  sc,
}: {
  left: PairSlot;
  right?: PairSlot;
  showReasons: boolean;
  onPress: (p: Product) => void;
  sc: typeof SC.light;
}) {
  return (
    <View style={pairRow.wrap}>
      {/* Sol kart */}
      <View style={{ flex: 0 }}>
        <ProductCard
          product={left.product}
          onPress={() => onPress(left.product)}
          gridMode
        />
        {showReasons && left.reason ? (
          <ReasonTag reason={left.reason} sc={sc} />
        ) : null}
      </View>

      {/* Boşluk */}
      <View style={{ width: 14 }} />

      {/* Sağ kart (veya boş alan) */}
      <View style={{ flex: 0 }}>
        {right ? (
          <>
            <ProductCard
              product={right.product}
              onPress={() => onPress(right.product)}
              gridMode
            />
            {showReasons && right.reason ? (
              <ReasonTag reason={right.reason} sc={sc} />
            ) : null}
          </>
        ) : (
          <View style={{ width: CARD_W }} />
        )}
      </View>
    </View>
  );
}

const pairRow = StyleSheet.create({
  wrap: {
    flexDirection: "row" as const,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
});

// ── Ana Ekran ─────────────────────────────────────────────────────────────────

export default function TumUrunlerScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const sc = isDark ? SC.dark : SC.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const { category: categoryParam, source: rawSource } =
    useLocalSearchParams<{ category?: string; source?: string }>();
  const _navSource = parseNavigationSource(rawSource);

  const { products, loading, error, refetch: refetchProducts } = useSupabaseProducts();
  const { count: liveProductCount, refetch: refetchProductCount } = useProductCount();
  const refetch = async () => {
    await Promise.all([
      Promise.resolve(refetchProducts()),
      refetchProductCount(),
    ]);
  };
  const [query, setQuery]                       = useState(categoryParam ?? "");
  const [hideAllergyProducts, setHideAllergyProducts] = useState(false);

  const { user }        = useAuth();
  const { preferences } = useUserPreferences();
  const canFilter   = canUseAllergyFilter(user);
  const hasAllergies = preferences.allergies.length > 0;

  // ── Niyet tabanlı skor sıralaması (rating ASLA kullanılmaz) ───────────────
  const textFiltered = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return products;
    const scored = products
      .map((p) => ({ product: p, score: getSearchScore(query, p) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        // Tie-breaker'lar: featured DESC, sonra created_at DESC. (Rating ASLA kullanılmaz.)
        const af = (a.product as any).featured ? 1 : 0;
        const bf = (b.product as any).featured ? 1 : 0;
        if (af !== bf) return bf - af;
        const ac = (a.product as any).created_at ?? "";
        const bc = (b.product as any).created_at ?? "";
        return String(bc).localeCompare(String(ac));
      })
      .map((item) => item.product);

    if (__DEV__) {
      const intents = detectSearchIntent(query);
      const expanded = expandSearchQuery(query);
      console.log(`[searchIntent] query=${q}`);
      console.log(`[searchIntent] intents=${JSON.stringify(intents)}`);
      console.log(`[searchIntent] expanded=${JSON.stringify(expanded)}`);
      console.log(`[searchIntent] results=${scored.length}`);
    }
    return scored;
  }, [products, query]);

  // ── Algılanan niyet(ler) — "akıllı çip" satırı için ────────────────────────
  const detectedIntents = useMemo<IntentKey[]>(() => {
    if (!query.trim()) return [];
    return detectSearchIntent(query);
  }, [query]);

  // ── "Bunu mu demek istediniz?" — marka/seri/sinonim/niyet önerisi ─────────
  const didYouMean = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q || q.length < 3) return null;
    const s = getDidYouMeanSuggestion(query, products);
    if (__DEV__) console.log(`[searchIntent] suggestion=${s?.suggestion ?? "none"}`);
    if (!s || s.suggestion === q) return null;
    return s;
  }, [query, products]);

  // ── Alerji filtresi ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!hideAllergyProducts || !canFilter || !hasAllergies) return textFiltered;
    return textFiltered.filter((p) => {
      const c = detectAllergyConflict(p.ingredients ?? "", preferences.allergies as any);
      return c.level === "none";
    });
  }, [textFiltered, hideAllergyProducts, canFilter, hasAllergies, preferences.allergies]);

  // ── Semantik arama ────────────────────────────────────────────────────────
  const semantic = useMemo<SemanticSearchOutput | null>(() => {
    if (!query.trim() || query.trim().length < 2) return null;
    return semanticSearch(query, products);
  }, [query, products]);

  // Semantik mod aktif: intent tespit edildi + exact sonuç yetersiz (<3)
  const semanticMode =
    !!semantic?.active &&
    (semantic.results.length > 0 || filtered.length < 3);

  // ── Typo düzeltme önerileri (top 3) ─────────────────────────────────────
  const suggestions = useMemo<SearchSuggestion[]>(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    if (filtered.length >= 3) return []; // yeterli sonuç varsa öneri gerekmez
    if (semanticMode) return [];
    return findSuggestions(query, products);
  }, [query, products, filtered.length, semanticMode]);

  // İlk yüksek güvenli önerinin ürünleri (otomatik öneri)
  const suggestion = suggestions[0] ?? null;

  const suggestedProducts = useMemo<Product[]>(() => {
    if (!suggestion || suggestion.confidence < 80) return [];
    return smartFilter(suggestion.correctedQuery, products);
  }, [suggestion, products]);

  const usingSuggestion = filtered.length === 0 && suggestedProducts.length > 0;

  // ── Gösterilecek ürün sayısı ──────────────────────────────────────────────
  const displayCount = semanticMode
    ? semantic!.results.length
    : usingSuggestion
    ? suggestedProducts.length
    : filtered.length;

  // ── Liste verisi ──────────────────────────────────────────────────────────
  const listData = useMemo<ListItem[]>(() => {
    if (semanticMode && semantic) {
      const pairs = buildSemanticPairs(semantic.results);
      // Sonuç yoksa kaygı önerileri ekle
      if (pairs.length === 0 && semantic.concernSuggestions.length > 0) {
        return [{ type: "concern-chips", suggestions: semantic.concernSuggestions }];
      }
      return pairs;
    }
    const src = usingSuggestion ? suggestedProducts : filtered;
    return buildNormalPairs(src);
  }, [semanticMode, semantic, filtered, suggestedProducts, usingSuggestion]);

  const isCategoryFilter = !!categoryParam && query.trim() === categoryParam.trim();

  // ── Arama takibi — anlamlı sorgular kaydedilir ────────────────────────────
  const lastTrackedQuery = useRef<string>("");
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || q === lastTrackedQuery.current) return;
    const timer = setTimeout(() => {
      lastTrackedQuery.current = q;
      const concern = semantic?.intent?.label ?? semantic?.intent?.concern ?? undefined;
      trackEvent("search_query", undefined, {
        query: q,
        category: semantic?.intent?.type !== "generic" ? q : undefined,
        concern,
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [query, semantic?.intent?.type, semantic?.intent?.label]);

  const navigateToProduct = (p: Product) => {
    navToProduct(p, { source: "allProducts" });
  };

  const handleAcceptSuggestion = (term: string) => {
    recordCorrection(query, term);
    trackEvent("corrected_search_used", undefined, { query: term, category: term });
    setQuery(term);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if (item.type === "section") {
      return <SectionHeader title={item.title} count={item.count} sc={sc} />;
    }
    if (item.type === "concern-chips") {
      return (
        <ConcernChips
          suggestions={item.suggestions}
          onTap={handleAcceptSuggestion}
          sc={sc}
        />
      );
    }
    // pair
    return (
      <ProductPairRow
        left={item.left}
        right={item.right}
        showReasons={semanticMode}
        onPress={navigateToProduct}
        sc={sc}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: sc.bg }]}>
      {/* Başlık */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: sc.border },
        ]}
      >
        <View style={styles.titleRow}>
          <TouchableOpacity
            onPress={() => goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={24} color={sc.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: sc.text }]}>Bütün Ürünler</Text>
          <TouchableOpacity
            onPress={refetch}
            style={styles.refreshBtn}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={18} color={sc.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Kategori chip */}
        {isCategoryFilter && (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={[
                styles.categoryChip,
                { backgroundColor: sc.searchBg, borderColor: sc.border },
              ]}
            >
              <Feather name="grid" size={12} color={sc.textSub} />
              <Text style={[styles.categoryChipText, { color: sc.textSub }]}>
                {categoryParam}
              </Text>
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={13} color={sc.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Arama kutusu */}
        <View
          style={[
            styles.searchBox,
            { backgroundColor: sc.searchBg, borderColor: sc.searchBorder },
          ]}
        >
          <Feather name="search" size={17} color={sc.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: sc.text }]}
            placeholder="Ürün, marka, kaygı, içerik veya kategori..."
            placeholderTextColor={sc.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={16} color={sc.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* "Bunu mu demek istediniz?" çipi — marka/seri/sinonim/niyet */}
        {didYouMean && (
          <TouchableOpacity
            onPress={() => setQuery(didYouMean.suggestion)}
            activeOpacity={0.75}
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              paddingHorizontal: 12,
              paddingVertical: 7,
              marginTop: 8,
              borderRadius: 14,
              backgroundColor: sc.searchBg,
              borderWidth: 1,
              borderColor: sc.searchBorder,
            }}
          >
            <Feather name="search" size={12} color={sc.textMuted} style={{ marginRight: 6 }} />
            <Text style={{ color: sc.text, fontSize: 13 }}>
              Bunu mu demek istediniz:{" "}
              <Text style={{ fontWeight: "600" }}>{didYouMean.suggestion}</Text>?
            </Text>
          </TouchableOpacity>
        )}

        {/* Akıllı niyet çipleri — algılanan niyet için tek dokunuş kısayolu */}
        {detectedIntents.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {detectedIntents
              .map((k) => SEARCH_INTENTS[k])
              .filter((intent) => intent.primaryKeyword !== normalizeSearchText(query))
              .slice(0, 4)
              .map((intent) => (
                <TouchableOpacity
                  key={intent.key}
                  onPress={() => setQuery(intent.primaryKeyword)}
                  activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor: sc.searchBg,
                    borderWidth: 1,
                    borderColor: sc.searchBorder,
                  }}
                >
                  <Text style={{ color: sc.text, fontSize: 12 }}>{intent.label}</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {/* Alerji toggle */}
        {canFilter && hasAllergies && (
          <TouchableOpacity
            onPress={() => setHideAllergyProducts((v) => !v)}
            activeOpacity={0.75}
            style={[
              styles.allergyToggle,
              {
                backgroundColor: hideAllergyProducts
                  ? isDark
                    ? "rgba(220,38,38,0.15)"
                    : "#FEF2F2"
                  : sc.searchBg,
                borderColor: hideAllergyProducts
                  ? isDark
                    ? "rgba(220,38,38,0.35)"
                    : "#FECACA"
                  : sc.border,
              },
            ]}
          >
            <Feather
              name="shield"
              size={13}
              color={hideAllergyProducts ? "#DC2626" : sc.textMuted}
            />
            <Text
              style={[
                styles.allergyToggleText,
                { color: hideAllergyProducts ? "#DC2626" : sc.textMuted },
              ]}
            >
              Alerjilerime uymayanları gizle
            </Text>
            <View
              style={[
                styles.allergyToggleDot,
                {
                  backgroundColor: hideAllergyProducts
                    ? "#DC2626"
                    : sc.border,
                },
              ]}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* İçerik */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: sc.textMuted }]}>
            Yükleniyor...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: sc.border }]}
            onPress={refetch}
          >
            <Text style={[styles.retryText, { color: sc.textSub }]}>
              Tekrar dene
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => {
            if (item.type === "section") return `sec-${item.title}`;
            if (item.type === "concern-chips") return "concern-chips";
            return `pair-${index}`;
          }}
          numColumns={1}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ paddingBottom: 4, paddingTop: 2 }}>
              {/* Intent banner (semantik mod) */}
              {semanticMode && semantic?.intent.label ? (
                <IntentBanner
                  label={semantic.intent.label}
                  onClear={() => setQuery("")}
                  sc={sc}
                />
              ) : null}

              {/* Typo öneri chip'leri (top 3) */}
              {!semanticMode && suggestions.length > 0 && !usingSuggestion ? (
                <View style={{ marginBottom: 10, marginHorizontal: -12 }}>
                  {suggestions.map((s) => (
                    <SuggestionChip
                      key={s.correctedQuery}
                      suggestion={s}
                      onAccept={handleAcceptSuggestion}
                      sc={sc}
                    />
                  ))}
                </View>
              ) : null}

              {/* Öneri ürünleri bilgi şeridi */}
              {!semanticMode && usingSuggestion && !!suggestion ? (
                <View
                  style={[
                    styles.suggestionBanner,
                    {
                      backgroundColor: sc.searchBg,
                      borderColor: sc.searchBorder,
                    },
                  ]}
                >
                  <Feather name="zap" size={12} color={sc.textSub} />
                  <Text
                    style={[
                      styles.suggestionBannerText,
                      { color: sc.textSub },
                    ]}
                  >
                    <Text style={{ fontWeight: "700" }}>
                      {suggestion.display}
                    </Text>{" "}
                    için sonuçlar gösteriliyor
                  </Text>
                  <TouchableOpacity
                    onPress={() => setQuery(suggestion.correctedQuery)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text
                      style={[
                        styles.suggestionBannerApply,
                        { color: sc.textSub },
                      ]}
                    >
                      Uygula →
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Ürün sayısı */}
              <Text style={[styles.countText, { color: sc.textMuted }]}>
                {(() => {
                  const hasActiveFilter =
                    query.trim().length > 0 || semanticMode || usingSuggestion;
                  if (!hasActiveFilter) {
                    return `${liveProductCount ?? displayCount} ürün`;
                  }
                  const totalSuffix =
                    liveProductCount != null && liveProductCount > 0
                      ? ` / ${liveProductCount}`
                      : "";
                  return `${displayCount}${totalSuffix} ürün`;
                })()}
                {query.trim() && !semanticMode && !usingSuggestion
                  ? ` — "${query}"`
                  : ""}
                {usingSuggestion && suggestion
                  ? ` — "${suggestion.display}"`
                  : ""}
              </Text>
            </View>
          }
          ListEmptyComponent={
            listData.length === 0 ? (
              <View style={styles.center}>
                <Feather name="inbox" size={36} color={sc.textMuted} />
                <Text style={[styles.emptyText, { color: sc.textSub }]}>
                  {query.trim()
                    ? `"${query}" için ürün bulunamadı`
                    : "Henüz ürün eklenmemiş"}
                </Text>
                {/* Typo önerisi */}
                {!!suggestion && !semanticMode ? (
                  <SuggestionChip
                    suggestion={suggestion}
                    onAccept={handleAcceptSuggestion}
                    sc={sc}
                  />
                ) : null}
                {/* Kaygı önerileri */}
                {semanticMode &&
                  semantic!.concernSuggestions.length > 0 ? (
                    <ConcernChips
                      suggestions={semantic!.concernSuggestions}
                      onTap={handleAcceptSuggestion}
                      sc={sc}
                    />
                  ) : null}
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginBottom: 10,
  },
  backBtn:    { padding: 4 },
  title:      { fontSize: 20, fontWeight: "800" as const },
  refreshBtn: { padding: 4 },
  searchBox: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0, marginLeft: 10 },
  list:        { paddingTop: 8 },
  countText:   { fontSize: 12, fontWeight: "500" as const, paddingHorizontal: 12, marginBottom: 4 },
  center:      { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, paddingTop: 80 },
  loadingText: { fontSize: 14, marginTop: 10 },
  errorText:   { fontSize: 14, textAlign: "center" as const },
  retryBtn:    { borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginTop: 12 },
  retryText:   { fontSize: 14, fontWeight: "600" as const },
  emptyText:   { fontSize: 14, textAlign: "center" as const, marginBottom: 16 },
  categoryChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  categoryChipText: { fontSize: 13, fontWeight: "600" as const, marginHorizontal: 6 },
  allergyToggle: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 6,
  },
  allergyToggleText: { fontSize: 12, fontWeight: "600" as const, marginHorizontal: 6 },
  allergyToggleDot:  { width: 8, height: 8, borderRadius: 4 },
  suggestionBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 8,
    marginHorizontal: 12,
  },
  suggestionBannerText:  { flex: 1, fontSize: 12, marginLeft: 6 },
  suggestionBannerApply: { fontSize: 12, fontWeight: "700" as const },
});