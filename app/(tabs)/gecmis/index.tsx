import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductImage } from "@/components/ProductImage";
import { useColors } from "@/hooks/useColors";
import { getScoreColors } from "@/lib/scoreColors";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import {
  getLocalHistory,
  removeFromLocalHistory,
  clearLocalHistory,
  type LocalHistoryEntry,
} from "@/lib/localHistory";
import type { Product } from "@/types/product";

export default function GecmisScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<LocalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── ECZ4 History focus dampening ──────────────────────────────────
  // Önceden useFocusEffect her tab/ekran dönüşünde load() → AsyncStorage read
  // + setHistory → FlatList remount tetikliyordu. Product detail'den geri
  // dönüşte gözle görülür "yeniden çiz" oluşturuyordu.
  // ÇÖZÜM (additive):
  //   1) InteractionManager ile transition bitene kadar ertele
  //   2) 30s TTL — son load'tan sonra yenilemeyi atla (ama liste boşsa yine yükle)
  //   3) Equality bailout — id+order signature aynıysa setHistory ÇAĞIRMA
  // İlk soğuk yükleme korunuyor (lastLoadAtRef=0 ⇒ TTL geçerli değil), boş
  // state korunuyor, prefetch + setNavigationProduct çağrıları korunuyor.
  const lastLoadAtRef = useRef<number>(0);
  const historySigRef = useRef<string>("");
  const HISTORY_TTL_MS = 30_000;

  const computeSig = (rows: LocalHistoryEntry[]): string =>
    rows.map((r) => r.id).join("|");

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const now = Date.now();
    const isCold = lastLoadAtRef.current === 0;
    const stale = now - lastLoadAtRef.current >= HISTORY_TTL_MS;
    if (!opts?.force && !isCold && !stale) {
      // TTL içinde — soğuk değil, force değil → no-op
      return;
    }
    if (isCold) setLoading(true);
    const data = await getLocalHistory();
    lastLoadAtRef.current = Date.now();
    const sig = computeSig(data);
    if (sig !== historySigRef.current) {
      historySigRef.current = sig;
      setHistory(data);
    }
    if (isCold) setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const handle = InteractionManager.runAfterInteractions(() => {
        load();
      });
      return () => handle.cancel();
    }, [load])
  );

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Geçmişten Kaldır", "Bu ürünü geçmişten silmek istiyor musunuz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const updated = await removeFromLocalHistory(id);
          historySigRef.current = computeSig(updated);
          lastLoadAtRef.current = Date.now();
          setHistory(updated);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Tüm Geçmişi Sil", "Tüm görüntüleme geçmişi silinecek. Emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Tümünü Sil",
        style: "destructive",
        onPress: async () => {
          await clearLocalHistory();
          historySigRef.current = "";
          lastLoadAtRef.current = Date.now();
          setHistory([]);
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={["#6BA3A0", "#3D7A77"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroBand, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.decoCircle1} />
        <View style={styles.decoCircle2} />

        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => safeBack(router, "/(tabs)/profil")}
            style={styles.backBtn}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={19} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>İnceleme Geçmişim</Text>
            <Text style={styles.heroSub}>İncelenen ürünler</Text>
          </View>

          <View style={styles.heroRight}>
            {history.length > 0 && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeNum}>{history.length}</Text>
                <Text style={styles.heroBadgeLabel}>ürün</Text>
              </View>
            )}
            {history.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAll}
                style={styles.clearBtn}
                activeOpacity={0.75}
              >
                <Feather name="trash-2" size={15} color="rgba(255,255,255,0.85)" />
                <Text style={styles.clearBtnText}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      {loading ? null : history.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconBox, { backgroundColor: "#ECFEFF" }]}>
            <Feather name="clock" size={32} color="#0891B2" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz Geçmiş Yok</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Ürünleri incelediğinizde burada görünecek
          </Text>
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: "#6BA3A0" }]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <Feather name="camera" size={16} color="#fff" />
            <Text style={styles.scanBtnText}>Ürün Tara</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.textMuted }]}>
              {history.length} ürün incelendi
            </Text>
          }
          renderItem={({ item }) => {
            const { main: scoreColor, bg: scoreBg } = getScoreColors(item.score);

            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const stub = {
                    id: item.productId as unknown as number,
                    name: item.productName,
                    brand: item.brand,
                    image_url: item.imageUrl,
                  } as Product;
                  prefetchProductHeroImage(stub as any);
                  setNavigationProduct(stub);
                  // ECZ4: replace → push + source="history".
                  // replace stack'ten Geçmiş'i siliyordu → geri tuşu Home'a
                  // veya önceki ürüne düşüyordu. push ile stack korunur,
                  // product detail handleBack source="history" → /gecmis.
                  router.push({
                    pathname: `/product/${item.productId}` as any,
                    params: { source: "history" },
                  });
                }}
                activeOpacity={0.75}
              >
                <ProductImage
                  imageUrl={item.imageUrl ?? null}
                  thumbnailUrl={item.imageUrl ?? null}
                  mode="thumbnail"
                  size={54}
                  borderRadius={12}
                  resizeMode="contain"
                />
                <View style={styles.info}>
                  {item.brand ? (
                    <Text style={[styles.brand, { color: "#6BA3A0" }]} numberOfLines={1}>
                      {item.brand}
                    </Text>
                  ) : null}
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.date, { color: colors.textMuted }]}>
                    {formatDate(item.viewedAt)}
                  </Text>
                </View>
                {item.score != null ? (
                  <View style={[styles.scoreBadge, { backgroundColor: scoreBg }]}>
                    <Text style={[styles.scoreNum, { color: scoreColor }]}>{item.score}</Text>
                    <Text style={[styles.scoreDen, { color: scoreColor }]}>/100</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.deleteBtn, { backgroundColor: colors.background }]}
                >
                  <Feather name="x" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroBand: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    overflow: "hidden",
  },
  decoCircle1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -50,
    right: -30,
  },
  decoCircle2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -20,
    left: 20,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTitle: { fontSize: 20, fontWeight: "800" as const, color: "#fff" },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  heroBadgeNum: { fontSize: 22, fontWeight: "800" as const, color: "#fff" },
  heroBadgeLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "600" as const },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnText: { fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "700" as const },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, textAlign: "center" },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  scanBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 15 },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  listHeader: { fontSize: 13, marginBottom: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    marginBottom: 10,
  },
  info: { flex: 1, gap: 2 },
  brand: { fontSize: 11, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  name: { fontSize: 14, fontWeight: "600" as const, lineHeight: 19 },
  date: { fontSize: 12, marginTop: 2 },
  scoreBadge: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scoreNum: { fontSize: 15, fontWeight: "800" as const, lineHeight: 18 },
  scoreDen: { fontSize: 10, fontWeight: "600" as const, opacity: 0.8, lineHeight: 12 },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});