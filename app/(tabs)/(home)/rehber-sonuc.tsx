import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { ProductImage } from "@/components/ProductImage";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useTheme } from "@/context/ThemeContext";
import { FLOW_CONFIGS, BUCKET_META, classifyBucket, type ProductBucket } from "@/lib/concernFlows";
import { getConcernProfile } from "@/lib/concernFlowStore";
import { normalizeConcernToRoutineProfile } from "@/lib/concernRoutineBridge";
import { saveConcernRoutineProfile } from "@/lib/concernRoutineBridgeStore";
import {
  generateWarningsFromConcernProfile,
  mergeAndPrioritizeWarnings,
} from "@/lib/smartWarningEngine";
import { WarningList } from "@/components/WarningCard";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { resolveImageUrl, resolveThumbnailUrl, type Product } from "@/types/product";

const BUCKET_ORDER: ProductBucket[] = ["cleanser", "serum", "moisturizer", "sunscreen", "other"];
// Ecz4 Free/Seçkin tier — MAX_PER_BUCKET artık component içinde isSeckin'e göre hesaplanır

export default function RehberSonucScreen() {
  const { flow: flowId } = useLocalSearchParams<{ flow: string }>();
  const { colorScheme } = useTheme();
  const { isSeckin, isRegistered } = useAuth();
  const isDark = colorScheme === "dark";

  // Ecz4 Defense-in-Depth — deep-link / push notification ile gelen misafiri /giris'e yönlendir
  useEffect(() => {
    if (!isRegistered) {
      router.replace("/giris" as any);
    }
  }, [isRegistered]);
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useTabBarInset();

  const config = flowId ? FLOW_CONFIGS[flowId] : undefined;
  const profile = flowId ? getConcernProfile(flowId) : null;
  const { products, loading } = useSupabaseProducts();

  const bg           = isDark ? "#141414" : "#FAFAF8";
  const cardBg       = isDark ? "#1C2535" : "#FFFFFF";
  const textPrimary  = isDark ? "#F0F4F8" : "#111827";
  const textSecondary= isDark ? "#94A3B8" : "#6B7280";
  const borderColor  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const accent       = config?.accentColor ?? "#7A8F6B";
  const summaryBg    = isDark ? `${accent}18` : `${accent}0D`;

  // ── Bridge: normalize + save on mount ─────────────────────────────────────
  useEffect(() => {
    if (flowId && profile) {
      const routineProfile = normalizeConcernToRoutineProfile(flowId, profile);
      saveConcernRoutineProfile(flowId, routineProfile, isSeckin);
    }
  }, [flowId, profile, isSeckin]);

  const summary = useMemo(() => {
    if (!config || !profile) return "";
    return config.generateSummary(profile);
  }, [config, profile]);

  const flowWarnings = useMemo(() => {
    if (!flowId || !profile) return [];
    const rp = normalizeConcernToRoutineProfile(flowId, profile);
    const raw = generateWarningsFromConcernProfile(rp);
    return mergeAndPrioritizeWarnings([raw], { maxTotal: 2 });
  }, [flowId, profile]);

  // Ecz4 Free/Seçkin tier — Free 2 ürün/bucket, Seçkin 4 ürün/bucket
  const maxPerBucket = isSeckin ? 4 : 2;

  const bucketed = useMemo(() => {
    if (!config || !profile || !products.length) return {} as Record<ProductBucket, Array<{ product: Product; score: number; reason: string }>>;
    const scored = products.map(p => ({
      product: p,
      score: config.scoreProduct(p as any, profile),
      reason: config.getProductReason(p as any, profile),
    })).filter(x => x.score >= 55).sort((a, b) => b.score - a.score);

    const result: Record<ProductBucket, Array<{ product: Product; score: number; reason: string }>> = {
      cleanser: [], serum: [], moisturizer: [], sunscreen: [], other: [],
    };
    const seen = new Set<string>();
    for (const item of scored) {
      const bucket = classifyBucket(item.product as any);
      if (!seen.has(item.product.id) && result[bucket].length < maxPerBucket) {
        result[bucket].push(item);
        seen.add(item.product.id);
      }
    }
    return result;
  }, [config, profile, products, maxPerBucket]);

  const activeBuckets = BUCKET_ORDER.filter(b => bucketed[b]?.length > 0);

  if (!config || !profile) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <Text style={{ color: textPrimary }}>Profil bulunamadı.</Text>
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={{ marginTop: 16 }}>
          <Text style={{ color: accent, fontWeight: "600" }}>Geri Dön</Text>
        </Pressable>
      </View>
    );
  }

  function handleOpenRoutine() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // ECZ4 GLOBAL — Defense-in-depth: misafir kullanıcı kişisel rutin
    // oluşturamaz. Mount-time guard zaten /giris'e yönlendiriyor (line 43);
    // bu ek kontrol race condition / mid-session tier düşüşü için savunma
    // derinliği. Ayrıca `from=rehberSonuc` parametresi sonuç ekranındaki
    // (rutin-olustur) geri tuşunu kaynak Rehber sonuç ekranına döndürür.
    if (!isRegistered) {
      router.push("/giris" as any);
      return;
    }
    router.push(`/(tabs)/(home)/rutin-olustur?flow=${flowId}&premium=${isSeckin ? "1" : "0"}&from=rehberSonuc` as any);
  }

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={textPrimary} />
        </Pressable>
        <Text style={[s.headerTitle, { color: textPrimary }]}>Sonuçların</Text>
        <Pressable onPress={() => router.replace("/(tabs)/(home)")} hitSlop={12}>
          <Feather name="home" size={19} color={textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scrollContent, { paddingBottom: scrollPaddingBottom() }]}
      >
        {/* Summary card */}
        <View style={[s.summaryCard, { backgroundColor: summaryBg, borderColor: `${accent}30` }]}>
          <View style={[s.summaryIconWrap, { backgroundColor: `${accent}20` }]}>
            <Feather name="activity" size={18} color={accent} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[s.summaryTitle, { color: accent }]}>Cildine yakın tablo</Text>
            <Text style={[s.summaryBody, { color: textPrimary }]}>{summary}</Text>
          </View>
        </View>

        {/* Routine CTA block */}
        <View style={[s.routineBlock, { backgroundColor: cardBg, borderColor }]}>
          <View style={s.routineBlockHeader}>
            <View style={[s.routineIconWrap, { backgroundColor: `${accent}15` }]}>
              <Feather name="layers" size={15} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.routineBlockTitle, { color: textPrimary }]}>
                {isSeckin ? "Cildine göre akıllı rutin hazırlandı" : "Sonucuna göre rutin iskeleti oluşturalım"}
              </Text>
              <Text style={[s.routineBlockSub, { color: textSecondary }]}>
                {isSeckin
                  ? "Uyumluluk ve öncelik sıralaması dahil şahsi rutin"
                  : "Hangi adımları, hangi sırayla uygulaman gerektiğini gör"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleOpenRoutine}
            style={({ pressed }) => [
              s.routineBtn,
              { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name={isSeckin ? "zap" : "edit-3"} size={14} color="#fff" />
            <Text style={s.routineBtnText}>{isSeckin ? "Akıllı rutin oluştur" : "Basit rutin oluştur"}</Text>
          </Pressable>
        </View>

        {/* Premium hook — soft, non-pushy */}
        {!isSeckin && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/uyelik" as any);
            }}
            style={({ pressed }) => [
              s.premiumHint,
              {
                backgroundColor: isDark ? "rgba(184,115,51,0.12)" : "rgba(184,115,51,0.07)",
                borderColor: "rgba(184,115,51,0.30)",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{
              width: 32, height: 32, borderRadius: 9,
              backgroundColor: isDark ? "rgba(184,115,51,0.22)" : "rgba(184,115,51,0.14)",
              alignItems: "center", justifyContent: "center",
              marginRight: 10,
            }}>
              <Feather name="zap" size={15} color="#B87333" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#D4A56A" : "#92400E", marginBottom: 2 }}>
                Sonucun hazır.
              </Text>
              <Text style={[s.premiumHintText, { color: isDark ? "#A17A54" : "#B45309" }]}>
                İstersen buna göre akıllı rutin ve şahsi uyarı sistemi oluşturabilirsin.
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color="#B87333" />
          </Pressable>
        )}

        {/* Smart warnings — Free 1, Seçkin 2 */}
        {flowWarnings.length > 0 && (
          <WarningList
            warnings={flowWarnings}
            isDark={isDark}
            isPremium={isSeckin}
            max={isSeckin ? 2 : 1}
          />
        )}

        {/* Ecz4 Free tier — Locked Insight Card (warnings altında) */}
        {!isSeckin && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/uyelik" as any);
            }}
            style={({ pressed }) => [
              s.lockedInsight,
              {
                backgroundColor: isDark ? "rgba(184,115,51,0.10)" : "#FFF4E6",
                borderColor: isDark ? "rgba(184,115,51,0.32)" : "#E2B77A",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[s.lockedIconWrap, { backgroundColor: isDark ? "rgba(184,115,51,0.20)" : "rgba(184,115,51,0.12)" }]}>
              <Feather name="lock" size={14} color="#B87333" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.lockedTitle, { color: isDark ? "#D4A56A" : "#92400E" }]}>
                Daha derin analiz ve kişisel uyarılar
              </Text>
              <Text style={[s.lockedSub, { color: isDark ? "#A17A54" : "#B45309" }]}>
                Seçkin üyelik ile açılır
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color="#B87333" />
          </Pressable>
        )}

        {/* Loading */}
        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={accent} />
            <Text style={[s.loadingText, { color: textSecondary }]}>Ürünler yükleniyor…</Text>
          </View>
        )}

        {/* Buckets */}
        {!loading && activeBuckets.length === 0 && (
          <View style={[s.emptyCard, { backgroundColor: cardBg, borderColor }]}>
            <Feather name="package" size={28} color={textSecondary} />
            <Text style={[s.emptyText, { color: textSecondary }]}>
              Profiline uygun ürün henüz eklenmemiş.{"\n"}Yakında yeni ürünler geliyor.
            </Text>
          </View>
        )}

        {!loading && activeBuckets.map(bucket => {
          const items = bucketed[bucket];
          const meta  = BUCKET_META[bucket];
          return (
            <View key={bucket} style={[s.bucketSection, { backgroundColor: cardBg, borderColor }]}>
              <View style={s.bucketHeader}>
                <View style={[s.bucketIconWrap, { backgroundColor: `${accent}15` }]}>
                  <Feather name={meta.icon as any} size={14} color={accent} />
                </View>
                <Text style={[s.bucketTitle, { color: textPrimary }]}>{meta.title}</Text>
              </View>

              {items.map(({ product, reason }, idx) => {
                const name  = product.name  ?? product.isim  ?? "—";
                const brand = product.brand ?? product.marka ?? "";
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      prefetchProductHeroImage(product as any);
                      setNavigationProduct(product);
                      router.push(`/(tabs)/(home)/product/${product.id}` as any);
                    }}
                    style={({ pressed }) => [
                      s.productRow,
                      {
                        borderTopColor: borderColor,
                        borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                        opacity: pressed ? 0.80 : 1,
                      },
                    ]}
                  >
                    <View style={[s.thumbWrap, { backgroundColor: isDark ? "#242E45" : "#F3F4F6" }]}>
                      <ProductImage
                        imageUrl={resolveImageUrl(product as any)}
                        thumbnailUrl={resolveThumbnailUrl(product as any)}
                        width={52}
                        height={52}
                      />
                    </View>
                    <View style={s.productInfo}>
                      {brand.length > 0 && (
                        <Text style={[s.productBrand, { color: textSecondary }]} numberOfLines={1}>{brand}</Text>
                      )}
                      <Text style={[s.productName, { color: textPrimary }]} numberOfLines={2}>{name}</Text>
                      {/* Ecz4 Free/Seçkin tier — reason badge sadece Seçkin'e */}
                      {isSeckin && (
                        <View style={[s.reasonBadge, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
                          <Text style={[s.reasonText, { color: accent }]}>{reason}</Text>
                        </View>
                      )}
                    </View>
                    <Feather name="chevron-right" size={16} color={textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {/* Restart flow */}
        <Pressable
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          style={({ pressed }) => [s.restartBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="refresh-cw" size={13} color={textSecondary} />
          <Text style={[s.restartText, { color: textSecondary }]}>Soruları tekrar cevapla</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  headerTitle:  { fontSize: 16, fontWeight: "700" },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  summaryCard: {
    flexDirection: "row", gap: 14, borderRadius: 18, borderWidth: 1.5, padding: 16, alignItems: "flex-start",
  },
  summaryIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  summaryTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  summaryBody:  { fontSize: 14, fontWeight: "400", lineHeight: 21 },

  // ── Routine CTA block
  routineBlock: {
    borderRadius: 18, borderWidth: 1, padding: 14, gap: 12,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web:     { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as any,
    }),
  },
  routineBlockHeader:{ flexDirection: "row", alignItems: "center", gap: 10 },
  routineIconWrap:   { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  routineBlockTitle: { fontSize: 13.5, fontWeight: "700", lineHeight: 18, marginBottom: 2 },
  routineBlockSub:   { fontSize: 12, fontWeight: "400", lineHeight: 17 },
  routineBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16,
  },
  routineBtnText: { fontSize: 13.5, fontWeight: "700", color: "#fff" },

  // ── Premium hint
  premiumHint: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
  },
  premiumHintText: { flex: 1, fontSize: 12.5, fontWeight: "500", lineHeight: 18 },

  // Ecz4 Free tier — Locked Insight Card
  lockedInsight: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  lockedIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  lockedTitle:    { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  lockedSub:      { fontSize: 12, fontWeight: "500", lineHeight: 17 },

  loadingWrap:  { alignItems: "center", gap: 10, paddingVertical: 32 },
  loadingText:  { fontSize: 13, fontWeight: "500" },
  emptyCard:    { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: "center", gap: 12 },
  emptyText:    { fontSize: 14, textAlign: "center", lineHeight: 21 },
  bucketSection: {
    borderRadius: 18, borderWidth: 1, overflow: "hidden",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web:     { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as any,
    }),
  },
  bucketHeader:  { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  bucketIconWrap:{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  bucketTitle:   { fontSize: 14, fontWeight: "700" },
  productRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  thumbWrap:     { width: 56, height: 56, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  productInfo:   { flex: 1, gap: 4 },
  productBrand:  { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  productName:   { fontSize: 13.5, fontWeight: "600", lineHeight: 19 },
  reasonBadge:   { alignSelf: "flex-start", borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  reasonText:    { fontSize: 11, fontWeight: "600", letterSpacing: 0.1 },
  restartBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, marginTop: 4 },
  restartText:   { fontSize: 13, fontWeight: "500" },
});