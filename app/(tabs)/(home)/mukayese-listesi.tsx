import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductImage } from "@/components/ProductImage";
import { CustomCompareSheet } from "@/components/CustomCompareSheet";
import { GateCard, SeckinModal } from "@/components/SeckinModal";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { prefetchProductImages } from "@/lib/imagePrefetch";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { arePairsCompatible, pairKey } from "@/lib/pairKey";
import { sameRawCategory, logCategoryGuardBlock } from "@/lib/sameRawCategory";
import { getDisplayScore } from "@/lib/getFinalScore";
import { getScoreColors } from "@/lib/scoreColors";
import { resolveImageUrl, resolveThumbnailUrl, type Product } from "@/types/product";

// ── Sabitler ─────────────────────────────────────────────────────────────────

const FREE_ROW_LIMIT = 5;

// EH19 · Kategori etiketi (lowercase pairKey) → Türkçe Title Case.
// "şampuan / kepek karşıtı" → "Şampuan / Kepek Karşıtı"
function formatCategoryLabel(raw: string): string {
  if (!raw) return "Diğer";
  return raw
    .split(" / ")
    .map((seg) =>
      seg
        .split(" ")
        .map((w) => (w.length > 0 ? w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1) : w))
        .join(" "),
    )
    .join(" / ");
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function getScore(p: Product): number | null {
  // Liste ve detay ekranı aynı fallback sırasını kullansın diye TEK kaynak.
  return getDisplayScore(p as any);
}

function isVerified(p: Product): boolean {
  const name = (p.name ?? (p as any).isim ?? "").trim();
  const brand = (p.brand ?? (p as any).marka ?? "").trim();
  return name.length > 0 && brand.length > 0;
}

type CompareRow = { id: string; pA: Product; pB: Product; category: string };
type ListItem =
  | { type: "header"; category: string; count: number }
  | { type: "row"; row: CompareRow }
  | { type: "info" }
  | { type: "paywall" };

// PERF: ScoreChipMini önceden component gövdesinde tanımlıydı → her renderda
// yeni fonksiyon referansı üretiyordu. Modül seviyesine alındı; styles ve
// getScoreColors zaten dışarıdan, closure bağımlılığı yok. Artık bu component
// React.memo gibi davranıp aynı `score` ile yeniden render olmaz.
const ScoreChipMini = React.memo(function ScoreChipMini({ score }: { score: number | null }) {
  if (score != null) {
    const tone = getScoreColors(score);
    return (
      <View style={[styles.scoreChip, { backgroundColor: tone.bg, marginTop: 4 }]}>
        <Text style={[styles.scoreNum, { color: tone.main }]}>{score}</Text>
        <Text style={[styles.scoreOf, { color: tone.main }]}>/100</Text>
      </View>
    );
  }
  return (
    <Text style={[styles.scoreNoneText, { color: "#9CA3AF", marginTop: 4 }]}>
      Skor yok
    </Text>
  );
});

export default function MukayeseListesiScreen() {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  // Visual fix v7 — kart çerçeveleri için tema-uyumlu yumuşak palet.
  // Dark mode'da `colors.border = #2E2E2E` yakın-siyah görünüyordu;
  // copper-tinted ton hem premium hem temalı duruyor. Light tarafı
  // mevcut warm-beige (`#E5DDD6`) ile birebir aynı.
  const softBorder = isDark ? "rgba(184,115,51,0.22)" : "#E5DDD6";
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;
  const { isSeckin } = useAuth();

  const { products, loading, error, refetch } = useSupabaseProducts();
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [showSeckinModal, setShowSeckinModal] = useState(false);
  const [customCompareOpen, setCustomCompareOpen] = useState(false);

  // SAFE PERF PATCH 4 — Grouping/pair generation memo split.
  // ÖNCEDEN: tek useMemo'nun deps'i [products, expandedCats, isSeckin] idi.
  // Bir kategori başlığına dokunmak (toggleCat) → 5000 ürün üzerinde
  // pairKey + grouping + pair eşleştirme yeniden çalışıyordu. O(n*m) iş
  // tek tıklamada gözle görülür gecikme yaratıyordu.
  //
  // ŞİMDİ:
  //  • compiledGroups (deps=[products]) — AĞIR iş: pairKey + grouping +
  //    arePairsCompatible + pair eşleştirme. products referansı değişmedikçe
  //    yeniden çalışmaz.
  //  • items / totalPairs (deps=[compiledGroups, expandedCats, isSeckin]) —
  //    HAFİF iş: önceden hazır pair'leri header/row/paywall'a materialize eder.
  //
  // Davranış garantileri:
  //  • Kategori sırası: aynı (groups[b].length - groups[a].length sort).
  //  • Pair id'leri: aynı (`${sortedA}__${sortedB}` stabil id).
  //  • totalPairs: aynı (compiledGroups'ta önceden toplanır).
  //  • Free-tier rowCount + paywall yerleşimi: aynı (materialize sırasında
  //    aynı algoritma uygulanır — rowCount accumulator + paywall guard).
  //  • Predefined pairs ve navigation: dokunulmadı.
  //  • Stiller, ProductImage, compare logic: dokunulmadı.
  //
  // Geri alma: iki memo'yu eski tek useMemo'ya birleştir, deps'e
  // expandedCats + isSeckin ekle.
  const compiledGroups = useMemo(() => {
    const verified = products.filter(isVerified);

    // EH19: pairKey artık geçersiz/size-token kategorileri "" döner.
    // Geçersiz anahtarlı ürünleri gruptan dışla — "Diğer" havuzunda
    // alakasız çiftler oluşmasın.
    const groups: Record<string, Product[]> = {};
    for (const p of verified) {
      const key = pairKey(p as any);
      if (!key) continue; // Geçersiz kategori → karşılaştırmaya alma
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    const usedInPair = new Set<string>();
    const keysSorted = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

    const compiled: { key: string; pairs: CompareRow[] }[] = [];
    let totalPairs = 0;

    for (const key of keysSorted) {
      const list = groups[key];
      if (list.length < 2) continue;

      const pairs: CompareRow[] = [];
      for (let i = 0; i < list.length; i++) {
        if (pairs.length >= list.length) break;
        const pA = list[i];
        if (usedInPair.has(pA.id)) continue;
        for (let j = i + 1; j < list.length; j++) {
          const pB = list[j];
          if (usedInPair.has(pB.id)) continue;
          // Aynı marka, aynı varyant veya concern çakışması olan çiftler listeye düşmesin.
          if (!arePairsCompatible(pA as any, pB as any)) continue;
          // HARD RAW CATEGORY GUARD — pairKey aynı olsa bile farklı
          // raw kategoriden çiftler Mukayese listesine düşmesin.
          if (!sameRawCategory(pA as any, pB as any)) {
            logCategoryGuardBlock("mukayese-listesi", pA as any, pB as any);
            continue;
          }
          // PERF: Satır id'si pair'in ürün id'lerinden türetilir.
          // Önceki `${key}-${pairIdx++}` pozisyonel index'ti — products dizisi
          // arka planda yenilenince (cache → fresh) her satırın id'si kayıyor,
          // FlatList tüm satırları unmount/remount ediyor, ProductImage'lar
          // baştan yükleniyordu (görsel flicker). Çift ürün id'sinden üretilen
          // stabil id ile yenileme arası remount yok.
          const sortedIds = [String(pA.id), String(pB.id)].sort();
          pairs.push({ id: `${sortedIds[0]}__${sortedIds[1]}`, pA, pB, category: key });
          usedInPair.add(pA.id);
          usedInPair.add(pB.id);
          break;
        }
      }
      if (pairs.length === 0) continue;
      totalPairs += pairs.length;
      compiled.push({ key, pairs });
    }

    return { compiled, totalPairs };
  }, [products]);

  const { items, totalPairs } = useMemo(() => {
    const allItems: ListItem[] = [{ type: "info" }];
    let rowCount = 0;
    let paywallInserted = false;

    for (const { key, pairs } of compiledGroups.compiled) {
      // Non-Seçkin: yalnızca ilk FREE_ROW_LIMIT satırı göster
      const rowsToShow = pairs.filter((_, i) => {
        if (isSeckin) return true;
        return rowCount + i < FREE_ROW_LIMIT;
      });

      if (rowsToShow.length === 0) {
        // Kategori başlığını da ekleme, limitin altında kaldık
        if (!isSeckin && !paywallInserted && rowCount >= FREE_ROW_LIMIT) {
          allItems.push({ type: "paywall" });
          paywallInserted = true;
        }
        continue;
      }

      allItems.push({ type: "header", category: key, count: pairs.length });

      const isOpen = expandedCats[key] !== false;
      if (isOpen) {
        for (const row of rowsToShow) {
          allItems.push({ type: "row", row });
          rowCount++;
        }
        // Limiti doldurduktan hemen sonra paywall ekle (non-Seçkin)
        if (!isSeckin && !paywallInserted && rowCount >= FREE_ROW_LIMIT && pairs.length > rowsToShow.length) {
          allItems.push({ type: "paywall" });
          paywallInserted = true;
        }
      }
    }

    // Hiç paywall eklenmemişse ama limit dolmuşsa (tüm kategoriler kapandıysa) sona ekle
    if (!isSeckin && !paywallInserted && rowCount >= FREE_ROW_LIMIT) {
      allItems.push({ type: "paywall" });
    }

    return { items: allItems, totalPairs: compiledGroups.totalPairs };
  }, [compiledGroups, expandedCats, isSeckin]);

  // PERF Level 2 — Mukayese listesi görsel prefetch.
  // İlk 8 satırın HER İKİ ürünü (16 görsel) arka planda indirilir; satır
  // göründüğünde ProductImage cache'ten alır → boş kutu→görsel geçişi kısalır.
  // Sadece "row" tipindekiler işlenir (header/info/paywall görsel taşımaz).
  // imagePrefetch.ts içinde Set guard sayesinde aynı URI tekrar tekrar
  // indirilmez. Mantık değişmez, geri dönülebilir.
  useEffect(() => {
    const rowProducts: Product[] = [];
    for (const it of items) {
      if (it.type !== "row") continue;
      rowProducts.push(it.row.pA, it.row.pB);
      if (rowProducts.length >= 16) break;
    }
    if (rowProducts.length === 0) return;
    prefetchProductImages(rowProducts, rowProducts.length);
  }, [items]);

  // PERF: setExpandedCats stabil setter, useCallback ile toggleCat referansı
  // her renderda aynı kalır → renderItem deps invalidation'ı önlenir.
  const toggleCat = useCallback((cat: string) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: prev[cat] === false ? true : false }));
  }, []);

  // PERF: renderItem'i useCallback ile sabitliyoruz. FlatList her render'da
  // yeni fonksiyon görürse bazı durumlarda ekstra iş üretebilir; ayrıca
  // expandedCats/colors değişmedikçe aynı referans korunur.
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    // ── Bilgi kutusu ──
    if (item.type === "info") {
      return (
        <View style={[styles.infoBox, { backgroundColor: "#EDE9FE", borderColor: "#DDD6FE" }]}>
          <Feather name="shield" size={14} color="#7C3AED" />
          <Text style={[styles.infoText, { color: "#5B21B6" }]}>
            Yalnızca adı, markası, kategorisi, görseli ve içerik listesi eksiksiz onaylanmış ürünler gösterilmektedir.
          </Text>
        </View>
      );
    }

    // ── Paywall kartı ──
    if (item.type === "paywall") {
      return (
        <View style={{ marginTop: 8, marginBottom: 4 }}>
          <GateCard
            title="Daha Fazla Karşılaştırma"
            description={`Ücretsiz hesabınızla son ${FREE_ROW_LIMIT} kıyası görüntüleyebilirsiniz. Tüm karşılaştırmalara ulaşmak için Seçkin üyelik gereklidir.`}
            onUpgrade={() => setShowSeckinModal(true)}
          />
        </View>
      );
    }

    // ── Kategori başlığı ──
    if (item.type === "header") {
      const isOpen = expandedCats[item.category] !== false;
      return (
        <TouchableOpacity
          onPress={() => toggleCat(item.category)}
          activeOpacity={0.75}
          style={[styles.catHeader, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.catLabel, { color: colors.text }]}>{formatCategoryLabel(item.category)}</Text>
          <View style={styles.catRight}>
            <View style={[styles.catCount, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <Text style={[styles.catCountText, { color: colors.textMuted }]}>{item.count * 2} ürün</Text>
            </View>
            <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
      );
    }

    // ── Kıyas satırı ──
    const { pA, pB } = item.row;

    // Güvenlik: aynı ürün asla karşılaştırılmasın
    const idA = String(pA.id ?? "");
    const idB = String(pB.id ?? "");
    const normA = (pA.name ?? (pA as any).isim ?? "").trim().toLowerCase();
    const normB = (pB.name ?? (pB as any).isim ?? "").trim().toLowerCase();
    if (idA && idB && idA === idB) return null;
    if (normA && normB && normA === normB) return null;

    const sA = getScore(pA);
    const sB = getScore(pB);
    const nameA = (pA.name ?? (pA as any).isim ?? "—");
    const nameB = (pB.name ?? (pB as any).isim ?? "—");
    const brandA = (pA.brand ?? (pA as any).marka ?? "");
    const brandB = (pB.brand ?? (pB as any).marka ?? "");

    return (
      <TouchableOpacity
        style={[styles.compareCard, { backgroundColor: colors.surfaceCard, borderColor: softBorder }]}
        onPress={() => router.push(`/mukayese-detay?idA=${pA.id}&idB=${pB.id}` as any)}
        activeOpacity={0.82}
      >
        {/* Ürün A */}
        <View style={styles.compareSlot}>
          <ProductImage
            imageUrl={resolveImageUrl(pA as any)}
            thumbnailUrl={resolveThumbnailUrl(pA as any)}
            size={96}
            borderRadius={14}
            style={styles.productImage}
          />
          <Text style={[styles.compareBrand, { color: colors.textMuted, marginTop: 6 }]} numberOfLines={1}>{brandA}</Text>
          <Text style={[styles.compareName, { color: colors.text, marginTop: 2 }]} numberOfLines={2}>{nameA}</Text>
          <ScoreChipMini score={sA} />
        </View>

        {/* × işareti */}
        <View style={styles.xDivider}>
          <Text style={[styles.xText, { color: colors.primary }]}>×</Text>
        </View>

        {/* Ürün B */}
        <View style={styles.compareSlot}>
          <ProductImage
            imageUrl={resolveImageUrl(pB as any)}
            thumbnailUrl={resolveThumbnailUrl(pB as any)}
            size={96}
            borderRadius={14}
            style={styles.productImage}
          />
          <Text style={[styles.compareBrand, { color: colors.textMuted, marginTop: 6 }]} numberOfLines={1}>{brandB}</Text>
          <Text style={[styles.compareName, { color: colors.text, marginTop: 2 }]} numberOfLines={2}>{nameB}</Text>
          <ScoreChipMini score={sB} />
        </View>
      </TouchableOpacity>
    );
  // PERF: deps minimal — colors (tema), expandedCats (katlama), toggleCat
  // (stabil), isSeckin (paywall). Bunlar değişmedikçe renderItem aynı kalır.
  }, [colors, softBorder, expandedCats, toggleCat, isSeckin]);

  // ── Custom compare CTA — FlatList header'ında gösterilir; mevcut kategori
  // grupları ve pair card'lar etkilenmez. Seçkin üyelik gate'i: ücretsiz
  // kullanıcılar /uyelik paywall'ına yönlendirilir (usePremiumGate'in tam
  // olarak yaptığı şey). Premium kullanıcılar için davranış değişmedi.
  // Renk paleti: sage sayfa zemininden net ayrılmak için warm cream/copper
  // (önceki "#EAF1EA" sage idi → arkayla karışıyordu).
  const ListHeader = useMemo(
    () => (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (!isSeckin) {
            router.push("/uyelik" as any);
            return;
          }
          // E4/F7: Seçkin user → mevcut çalışan candidate motoruna giden
          // yeni başlangıç-ürün seçim ekranına yönlendir. CustomCompareSheet
          // kodu silinmedi (additive kuralı); bu CTA'dan artık açılmıyor.
          router.push("/mukayese-baslat" as any);
        }}
        style={[
          styles.customCta,
          {
            backgroundColor: isDark ? "#2A2218" : "#FFF4E6",
            borderColor: isDark ? "rgba(226,183,122,0.40)" : "#E2B77A",
          },
        ]}
      >
        <View style={[styles.customCtaIcon, { backgroundColor: isDark ? "rgba(251,232,208,0.16)" : "#FBE8D0" }]}>
          <Feather name="git-merge" size={14} color={isDark ? "#E2B77A" : "#B9823D"} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.customCtaTitleRow}>
            <Text style={[styles.customCtaTitle, { color: isDark ? "#F0EDE8" : "#1F2937" }]}>
              Kendi karşılaştırmanı yap
            </Text>
            <View style={styles.customCtaSeckinPill}>
              <Text style={styles.customCtaSeckinPillText}>Seçkin</Text>
            </View>
          </View>
          <Text style={[styles.customCtaSub, { color: isDark ? "#C9B89A" : "#5A6474" }]}>
            İki ürünü seç, farklarını birlikte görelim.
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={isDark ? "#E2B77A" : "#B9823D"} />
      </TouchableOpacity>
    ),
    [isDark, isSeckin, router],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleInner}>
            <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="bar-chart-2" size={14} color="#D97706" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Karar Rehberi</Text>
          </View>
          <TouchableOpacity onPress={refetch} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!loading && !error && (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isSeckin
              ? `${totalPairs} karşılaştırma · tüm ürünler`
              : `${Math.min(totalPairs, FREE_ROW_LIMIT)} / ${totalPairs} karşılaştırma · ücretsiz`}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color="#DC2626" />
          <Text style={[styles.errorText, { color: "#DC2626" }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { borderColor: colors.primary }]} onPress={refetch}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : totalPairs === 0 ? (
        <View style={styles.center}>
          <Feather name="bar-chart-2" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Yeterli veri yok</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Karşılaştırma yapabilmek için eksiksiz veriyle kayıtlı en az 2 ürün gereklidir.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) =>
            item.type === "row" ? item.row.id
            : item.type === "header" ? `h-${item.category}`
            : item.type === "paywall" ? "paywall"
            : `info-${i}`
          }
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
          showsVerticalScrollIndicator={false}
          // PERF: FlatList tuning — sadece görünen ekran kadarını çiz, geri
          // kalanı pencere ilerledikçe ekle. Mevcut kart yüksekliği ~150px;
          // ücretsiz kullanıcı 5 satırla sınırlı, Seçkin ise daha uzun liste.
          // Bu değerler güvenli (UX'e zarar vermez): ilk açılış hızlanır,
          // bellek baskısı düşer.
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== "web"}
        />
      )}

      <SeckinModal visible={showSeckinModal} onClose={() => setShowSeckinModal(false)} />
      {/* Phase 2 / Step 1 — Lazy mount fix.
          Önceden CustomCompareSheet KOŞULSUZ mount ediliyordu; <Modal
          visible={false}> children'ı React tarafında reconcile ettiği için
          24 ProductImage thumbnail hidden subtree'de yüklenmeye başlıyor,
          JS thread + ağ üzerinden Home dönüşünü yavaşlatıyordu.
          Conditional mount ile subtree yalnızca CTA tıklanınca canlanır,
          kapatınca tamamen unmount olur. State zaten handleClose içinde
          sıfırlanıyor, kayıp yok. */}
      {customCompareOpen && (
        <CustomCompareSheet
          visible={true}
          onClose={() => setCustomCompareOpen(false)}
          products={products}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // PERF: ProductImage React.memo'sunun son alanı `prev.style === next.style`
  // referans karşılaştırması yapıyor; inline `style={{...}}` her renderda yeni
  // obje üretip memo'yu kırıyor. Bu sabit StyleSheet kaydı sayesinde referans
  // her renderda aynı kalır → ProductImage tekrar render olmaz.
  productImage: { alignSelf: "center" },
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleInner: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" },
  iconBox: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "800" as const },
  subtitle: { fontSize: 12, textAlign: "center", marginTop: 6 },
  list: { paddingHorizontal: 16 },
  infoBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 16, marginTop: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  catHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1 },
  catLabel: { fontSize: 15, fontWeight: "800" as const },
  catRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  catCount: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  catCountText: { fontSize: 11, fontWeight: "600" as const },
  compareCard: { flexDirection: "row", alignItems: "flex-start", borderRadius: 16, borderWidth: 1.5, padding: 14, marginVertical: 6 },
  compareSlot: { flex: 1, alignItems: "center" },
  compareBrand: { fontSize: 10, fontWeight: "600" as const, textAlign: "center" },
  compareName: { fontSize: 12, fontWeight: "700" as const, textAlign: "center", lineHeight: 16 },
  scoreChip: { flexDirection: "row", alignItems: "baseline", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  scoreNum: { fontSize: 14, fontWeight: "800" as const },
  scoreOf: { fontSize: 10, fontWeight: "600" as const, marginLeft: 1 },
  scoreNoneText: { fontSize: 10, fontWeight: "500" as const, fontStyle: "italic" as const, textAlign: "center" as const },
  xDivider: { width: 32, alignItems: "center", justifyContent: "center", paddingTop: 32 },
  xText: { fontSize: 26, fontWeight: "300" as const, lineHeight: 30, letterSpacing: -1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80, paddingHorizontal: 32 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
  retryText: { fontSize: 14, fontWeight: "600" as const },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Custom compare CTA (visual fix v7)
  customCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  customCtaIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  customCtaTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  customCtaTitle: { fontSize: 14, fontWeight: "800" as const, letterSpacing: 0.1 },
  customCtaSub: { fontSize: 11, fontWeight: "500" as const, marginTop: 2, lineHeight: 15 },
  customCtaSeckinPill: {
    backgroundColor: "#E8C48A",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 7,
  },
  customCtaSeckinPillText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#5A3516",
    letterSpacing: 0.3,
  },
});