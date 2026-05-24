import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { setNavigationProduct } from "@/lib/productStore";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { applyPersonalizedRanking } from "@/lib/safetyRanking";
import { useLearningProfile } from "@/hooks/useLearningProfile";
import type { Product } from "@/types/product";

export default function YeniEklenenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  const { products, loading, error, refetch } = useSupabaseProducts();
  const { preferences } = useUserPreferences();
  const learningProfile = useLearningProfile(products);
  const [query, setQuery] = useState("");

  const sorted = applyPersonalizedRanking(
    [...products].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    ),
    preferences,
    learningProfile,
  );

  const filtered = query.trim()
    ? sorted.filter((p) => {
        const q = query.toLowerCase();
        return (
          (p.name ?? "").toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
        );
      })
    : sorted;

  const navigateToProduct = (p: Product) => {
    setNavigationProduct(p);
    router.push(`/product/${p.id}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleInner}>
            <View style={[styles.iconBox, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="star" size={14} color="#2563EB" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Yeni Eklenen Ürünler</Text>
          </View>
          <TouchableOpacity onPress={refetch} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Ürün veya marka ara..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { borderColor: colors.primary }]} onPress={refetch}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: "space-between", gap: 14 }}
          renderItem={({ item, index }) => (
            <ProductCard product={item} onPress={() => navigateToProduct(item)} learningProfile={learningProfile} gridMode index={index} />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.countText, { color: colors.textMuted }]}>
              {filtered.length} ürün{query.trim() ? ` — "${query}"` : ""} · yeniden eskiye
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="inbox" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {query.trim() ? `"${query}" için ürün bulunamadı` : "Henüz ürün eklenmemiş"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleInner: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" },
  iconBox: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "800" as const },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  list: { paddingHorizontal: 16, gap: 10 },
  countText: { fontSize: 12, marginBottom: 10, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: "center" },
  retryBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
  retryText: { fontSize: 14, fontWeight: "600" as const },
  emptyText: { fontSize: 14, textAlign: "center" },
});