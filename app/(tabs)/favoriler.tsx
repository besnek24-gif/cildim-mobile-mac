import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { getScoreColors } from "@/lib/scoreColors";
import { getFinalProductScore } from "@/lib/getFinalScore";
import { getFavoriteRows, deleteFavorite, type FavoriteRow } from "@/lib/favoritesService";
import type { Product } from "@/types/product";

interface Favorite {
  id: string;
  urunId: string;
  urunAdi?: string;
  marka?: string;
  gorselUrl?: string;
  /** Dermatology score 0–100, already resolved */
  score?: number;
  createdAt: string;
}

// scoreColor + scoreBg → getScoreColors (lib/scoreColors.ts) ile değiştirildi

export default function FavorilerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [favoriler, setFavoriler] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [siliniyor, setSiliniyor] = useState<string | null>(null);
  const [arama, setArama] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ECZ4 NAV STEP C — FIX B: Warm-refresh favoriler.
  // BUG: Her tab focus'ta setLoading(true) → mevcut liste 3-4s spinner ardına
  // gizleniyordu (state'te dolu olsa bile). ÇÖZÜM: favorilerRef ile mevcut
  // liste uzunluğunu render dışında oku; cold load (boş liste) → spinner +
  // fetch eski davranış; warm focus (liste dolu) → spinner gösterme, sessiz
  // refresh. Sil/search/navigation/F4 memoization birebir korundu.
  const favorilerRef = useRef<Favorite[]>([]);
  useEffect(() => { favorilerRef.current = favoriler; }, [favoriler]);

  // ECZ4 NAV STEP D — FIX 2: No-op bailout signature.
  // Warm refresh sonrası rows içerik olarak aynıysa setFavoriler ÇAĞIRMA;
  // mevcut array referansını koru → filtreli/scoreMap useMemo invalidasyonu
  // tetiklenmez, FlatList rerender etmez. id+score+gorselUrl+ad+marka render'ı
  // etkileyen tüm alanları kapsar. createdAt dahil değil (görünmez metadata).
  const buildFavoritesSignature = (list: Favorite[]): string => {
    if (list.length === 0) return "";
    const parts: string[] = [];
    for (const f of list) {
      parts.push(
        `${f.id}|${f.score ?? ""}|${f.gorselUrl ?? ""}|${f.urunAdi ?? ""}|${f.marka ?? ""}`,
      );
    }
    return parts.join("§");
  };

  const fetchFavoriler = useCallback(async () => {
    if (!user?.id) { setLoading(false); setFavoriler([]); return; }
    const isCold = favorilerRef.current.length === 0;
    if (isCold) setLoading(true);
    try {
      const rows = await getFavoriteRows(user.id);
      const mapped: Favorite[] = rows.map((r: FavoriteRow) => ({
        id:        r.productId,
        urunId:    r.productId,
        urunAdi:   r.name,
        marka:     r.brand,
        gorselUrl: r.imageUrl,
        score:     r.score,
        createdAt: r.createdAt,
      }));
      // No-op bailout: warm refresh içerik aynıysa state'i tutma.
      if (!isCold) {
        const prevSig = buildFavoritesSignature(favorilerRef.current);
        const nextSig = buildFavoritesSignature(mapped);
        if (prevSig === nextSig) return;
      }
      setFavoriler(mapped);
    } catch {
      // Warm refresh hatasında mevcut liste korunur; cold load hatasında temizle.
      if (isCold) setFavoriler([]);
    } finally {
      if (isCold) setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    // Cold load (henüz veri yok): hemen fetch — spinner gösterilir.
    if (favorilerRef.current.length === 0) {
      fetchFavoriler();
      return;
    }
    // Warm focus (liste zaten dolu): native tab geçiş animasyonu bittikten
    // sonra arka planda sessiz refresh; mevcut liste görünür kalır.
    const handle = InteractionManager.runAfterInteractions(() => {
      fetchFavoriler();
    });
    return () => {
      handle.cancel();
    };
  }, [fetchFavoriler]));

  const sil = useCallback((fav: Favorite) => {
    Alert.alert("Favoriden Çıkar", `"${fav.urunAdi ?? "Ürün"}" favorilerinizden kaldırılsın mı?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: async () => {
          setSiliniyor(fav.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await deleteFavorite(user!.id, fav.urunId);
            setFavoriler(prev => prev.filter(f => f.id !== fav.id));
          } catch {}
          setSiliniyor(null);
        },
      },
    ]);
  }, [user?.id]);

  // ECZ4 PERF F4: filtre artık useMemo ile cache'leniyor.
  // Önceden her render'da favoriler.filter(...) yeniden çalışıyordu (search keystroke
  // veya unrelated state change'lerde bile). Mantık birebir korundu.
  const filtreli = useMemo(() => {
    return favoriler.filter(f => {
      if (!arama.trim()) return true;
      const q = arama.toLowerCase();
      return (f.urunAdi ?? "").toLowerCase().includes(q) || (f.marka ?? "").toLowerCase().includes(q);
    });
  }, [favoriler, arama]);

  // ECZ4 PERF F4: score map — her satır için getFinalProductScore'u tek seferde
  // çözüp id→score eşlemesi yapıyoruz. Kaide #4 (single source of truth) korunur:
  // hâlâ aynı getFinalProductScore + fav.score fallback kullanılıyor; bu sadece
  // bir cache. Daha önce renderItem her satırda her render'da yeniden çağırıyordu.
  const scoreMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const f of favoriler) {
      m.set(f.id, getFinalProductScore(f as any) ?? f.score ?? null);
    }
    return m;
  }, [favoriler]);

  // ECZ4 PERF F4: stabil keyExtractor (önceden inline arrow her render'da yeni
  // referans üretiyordu → FlatList key memoization tetiklenemiyordu).
  const keyExtractor = useCallback((item: Favorite) => String(item.id), []);

  // ECZ4 PERF F4: stabil renderItem. Score artık scoreMap'ten okunuyor.
  // Layout, navigation, sil davranışı, deleteBtn — birebir aynı.
  const renderItem = useCallback(({ item }: { item: Favorite }) => {
    const score = scoreMap.get(item.id) ?? null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // ECZ4 NAV STEP A — hero prefetch (fire-and-forget, await YOK).
          // Favori satırı `gorselUrl` içerir; resolveImageUrl bunu image_url
          // alanından okur ve hero'nun talep edeceği tam-boy URL'i ısıtır.
          prefetchProductHeroImage({
            image_url: item.gorselUrl,
            thumbnail_url: item.gorselUrl,
          });
          setNavigationProduct({
            id: item.urunId,
            name: item.urunAdi,
            brand: item.marka,
            image_url: item.gorselUrl,
          } as Product);
          // ECZ4 Favorites back-route fix: source="favorites"
          // → product detail handleBack ayrı tab navigator'a
          // (router.back yerine) navigate ederek Favoriler'e döner.
          router.push({
            pathname: `/product/${item.urunId}` as any,
            params: { source: "favorites" },
          });
        }}
        activeOpacity={0.75}
      >
        <View style={[styles.imgBox, { backgroundColor: "#F0EEEC", borderColor: "#E0DBD7", borderWidth: 1 }]}>
          {item.gorselUrl ? (
            <Image source={{ uri: item.gorselUrl }} style={styles.img} resizeMode="contain" />
          ) : (
            <Feather name="package" size={24} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.info}>
          {item.marka ? (
            <Text style={[styles.marka, { color: "#DC2626" }]} numberOfLines={1}>
              {item.marka}
            </Text>
          ) : null}
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {item.urunAdi ?? "Ürün"}
          </Text>
          {score != null && (
            <View style={[styles.scoreBadge, { backgroundColor: getScoreColors(score).bg }]}>
              <Text style={[styles.scoreText, { color: getScoreColors(score).main }]}>
                {`${score} puan`}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: "#FEE2E2" }]}
          onPress={() => sil(item)}
          disabled={siliniyor === item.id}
        >
          {siliniyor === item.id ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Feather name="trash-2" size={18} color="#DC2626" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [scoreMap, colors, siliniyor, sil]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Renkli Header ── */}
      {/* Bakır manşet — Tenvir premium kimliğine uyumlu sıcak ton.
          Eski: ["#DC2626", "#991B1B"] (kırmızı alarm hissi). */}
      <LinearGradient
        colors={["#C98255", "#A85F3A", "#7A3E24"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroBand, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.decoCircle1} />
        <View style={styles.decoCircle2} />

        <TouchableOpacity
          onPress={() => safeBack(router, "/(tabs)/profil")}
          style={styles.backBtn}
          activeOpacity={0.75}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.9)" />
          <Text style={styles.backBtnText}>Profil</Text>
        </TouchableOpacity>

        <View style={styles.heroContent}>
          <View style={styles.heroLeft}>
            <View style={styles.heroTitleRow}>
              <Feather name="heart" size={22} color="#fff" />
              <Text style={styles.heroTitle}>Favorilerim</Text>
            </View>
            <Text style={styles.heroSub}>Kaydettiğiniz ürünler</Text>
          </View>
          {favoriler.length > 0 && (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeNum}>{favoriler.length}</Text>
              <Text style={styles.heroBadgeLabel}>ürün</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {!user ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconBox, { backgroundColor: "#FFF0F0" }]}>
            <Feather name="lock" size={32} color="#DC2626" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Giriş Gerekli</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Favorilerinizi görmek için giriş yapın
          </Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: "#DC2626" }]}
            onPress={() => router.push("/giris")}
          >
            <Text style={styles.loginBtnText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#DC2626" size="large" />
        </View>
      ) : (
        <>
          {favoriler.length > 0 && (
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Favorilerde ara..."
                placeholderTextColor={colors.textMuted}
                value={arama}
                onChangeText={setArama}
              />
              {arama.length > 0 && (
                <TouchableOpacity onPress={() => setArama("")}>
                  <Feather name="x" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}
          <FlatList
            data={filtreli}
            keyExtractor={keyExtractor}
            contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
            ListEmptyComponent={
              <View style={styles.centered}>
                <View style={[styles.emptyIconBox, { backgroundColor: "#FFF0F0" }]}>
                  <Feather name="heart" size={32} color="#DC2626" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {arama ? "Sonuç bulunamadı" : "Favori Yok"}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {arama
                    ? "Farklı bir arama deneyin"
                    : "Ürün detayında kalp ikonuna tıklayarak ekleyin"}
                </Text>
              </View>
            }
            renderItem={renderItem}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroBand: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    overflow: "hidden",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  backBtnText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -10,
    left: 40,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heroLeft: { flex: 1, gap: 4 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTitle: { fontSize: 26, fontWeight: "800" as const, color: "#fff" },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  heroBadgeNum: { fontSize: 20, fontWeight: "800" as const, color: "#fff" },
  heroBadgeLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: "600" as const },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 40 },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  loginBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  list: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  imgBox: { width: 62, height: 62, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  img: { width: 62, height: 62 },
  info: { flex: 1, gap: 4 },
  marka: { fontSize: 11, fontWeight: "700" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  name: { fontSize: 14, fontWeight: "600" as const, lineHeight: 19 },
  scoreBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  scoreText: { fontSize: 11, fontWeight: "700" as const },
  deleteBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});