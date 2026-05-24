import * as Haptics from "expo-haptics";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import __perf from "@/src/utils/performanceLogger";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ProductImage } from "@/components/ProductImage";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { computeMatchScore } from "@/lib/safetyRanking";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { detectAllergyConflict } from "@/lib/allergyDetector";
import { canUseAllergyFilter } from "@/lib/accessControl";
import { deriveBadgesWithPurpose, normalizeCardBadges, translateRawBadge } from "@/lib/featureBadges";
import { getScoreColor } from "@/lib/scoreColors";
import { getCardLabel } from "@/lib/recommendationReason";
import type { LearningProfile } from "@/lib/userEvents";
// SCORE: single source of truth for product score across all card render
// points. Same function the Detail screen uses (product/[id].tsx). Wrapped in
// useMemo below so the 6-tier resolver runs at most once per product per
// render. Falls back through dermo_score → scores → sistem_toplam_puani →
// ingredient calc → rating ×20, returning null when nothing is available.
import { getFinalProductScore } from "@/lib/getFinalScore";
import { trackEvent } from "@/lib/userEvents";
import {
  Product,
  ProductSummary,
  resolveBrand,
  resolveProductName,
  resolveThumbnailUrl,
  resolveImageUrl,
} from "@/types/product";

const MATCH_THRESHOLD = 2;

// ── Segment config ────────────────────────────────────────────────────────────

const SEGMENT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; info: string }> = {
  "seçkin": {
    label: "Seçkin",
    color: "#7A3D08",
    bg: "#FDF2E5",
    border: "#D4A265",
    info: "Üst segment ürünler. En yüksek kalite ve performans arayanlar için.",
  },
  "profesyonel": {
    label: "Pro",
    color: "#2E2C9E",
    bg: "#EEF2FF",
    border: "#8B8CF5",
    info: "Güçlü içerik ve performans sunar. Bilinçli kullanıcı tercihi.",
  },
  "ekonomik": {
    label: "Eko",
    color: "#6B7F5D",
    bg: "#EAF1EA",
    border: "#B8CEB8",
    info: "Günlük ihtiyaçları karşılar. Ulaşılabilir ve akıllı bir seçim.",
  },
};

// ── Layout constants ──────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width;
/** Sabit kart genişliği — tüm carousel ve grid'lerde tutarlı */
const CARD_W   = 152;
/** Sabit toplam kart yüksekliği */
const CARD_H   = 280;
/** Görsel alanı yüksekliği — toplam kartın ~%70'i */
const IMAGE_H  = 196;
/** Info panel referans yüksekliği (artık flex:1 kullanılıyor) */
const INFO_H   = 84;

/** Grid kolon genişliği: ekran - (2×12px liste paddingi) - 14px gap, 2'ye böl */
const GRID_COL_W = Math.floor((SCREEN_W - 38) / 2);

// ── Grid görsel çerçevesi — TEK KANONİK KAYNAK ─────────────────────────────
/** Görsel çerçeve kenar uzunluğu: kart genişliği ile aynı → tam kare */
const GRID_FRAME = GRID_COL_W;
/** imageWrap iç dolgu — her 4 kenar için aynı değer */
const GRID_FRAME_PAD = 10;
/** Her grid kartın başlık satırı yüksekliği (marka / rozet / puan) */
const GRID_META_H = 28;
/** Her grid kartın alt metin alanı sabit yüksekliği — isim (34px) + rozet (2 satır tam ≈ 40px) + padding (6+8) */
const GRID_INFO_H = 94;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  product: ProductSummary;
  onPress?: () => void;
  compact?: boolean;
  gridMode?: boolean;
  index?: number;
  learningProfile?: LearningProfile;
}

// ── Category accent — anlamlı renk sistemi ────────────────────────────────────

function getCategoryAccent(product: any): string {
  const cat      = (product.category ?? product.kategori ?? "").toLowerCase();
  const concerns: string[] = product.concerns_supported ?? [];
  const text     = [cat, ...concerns].join(" ").toLowerCase();

  if (/akne|sivilce|acne/.test(text))              return "#B83232"; // kırmızımsı
  if (/güneş|spf|sun|uv/.test(text))              return "#C08A10"; // amber
  if (/hassas|sensitive|kızarık|rosace/.test(text)) return "#7050B8"; // mor
  if (/leke|spot|ton|hiperpig|aydın/.test(text))   return "#2D8A60"; // yeşil
  if (/saç|hair|skalp/.test(text))                return "#7A5C42"; // sıcak kahve
  if (/göz|eye/.test(text))                        return "#3A70C0"; // lacivert
  if (/nem|nemlendirici|moistur|kuru/.test(text))  return "#2E72C0"; // mavi
  if (/temiz|cleanse|arındır|jel|köpük/.test(text)) return "#3A8EA8"; // teal
  return "#7A8F6B"; // varsayılan: brand sage
}

// ── Component ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

// ── BadgePills — maks 2 rozet, premium pill stili ─────────────────────────────

function BadgePills({ badges, isDark }: { badges?: string[] | null; isDark: boolean }) {
  const visible = Array.isArray(badges) ? badges.slice(0, 3) : [];
  if (visible.length === 0) return null;

  return (
    <View style={badgeStyles.row}>
      {visible.map((badge, i) => (
        <View
          key={i}
          style={[
            badgeStyles.pill,
            {
              backgroundColor: isDark
                ? "rgba(168,197,160,0.12)"
                : "rgba(122,143,107,0.10)",
              borderColor: isDark
                ? "rgba(168,197,160,0.25)"
                : "rgba(122,143,107,0.28)",
            },
          ]}
        >
          <Text
            style={[
              badgeStyles.text,
              { color: isDark ? "#A8C5A0" : "#4A6741" },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {badge}
          </Text>
        </View>
      ))}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  row: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    alignContent: "flex-start" as const,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden" as const,
    marginRight: 3,
    marginBottom: 2,
  },
  text: {
    fontSize: 9,
    fontWeight: "600" as const,
    letterSpacing: 0.1,
    lineHeight: 13,
  },
});

// PERF — Home back flicker fix:
// ProductCard önceden plain function'dı → parent rerender'da (useFocusEffect
// loadPremiumData setState dalgası, vs.) FlatList her item için yeni renderItem
// arrow + yeni `onPress` closure üretiyordu → tüm görünür kartlar yeniden
// render → ProductImage memo URI ile skip etse de kart-içi alt component
// hesaplamaları tekrar çalışıyor, kullanıcıda mikro flicker. React.memo +
// CUSTOM COMPARATOR ile çözüm: `onPress` referans değişimini ignore et,
// sadece içeriği etkileyen prop'ları (product / compact / gridMode / index /
// learningProfile) karşılaştır. onPress closure içeriği "tıklanınca
// navigate" olduğundan referans yenilense de davranışı değişmez (parent
// scope hâlâ doğru product'ı yakalar).
// Mantık değişmedi — aynı içerik, aynı render. Sadece gereksiz rerender
// engellendi.
function ProductCardInner({ product, onPress, compact, gridMode, index = 0, learningProfile }: Props) {
  __perf.count("ProductCard.render");
  const colors = useColors();
  const { colorScheme: scheme } = useTheme();
  const brandColor  = scheme === "dark" ? "#8BA8BC" : "#6B7280";
  const cardAccent  = getCategoryAccent(product);
  const { effectiveRole, user, getAuthHeaders } = useAuth();
  const { preferences } = useUserPreferences();
  const [showSegmentInfo, setShowSegmentInfo] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [favPressed, setFavPressed] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isPremium    = effectiveRole === "seckin";
  const canFilter    = canUseAllergyFilter(user ?? undefined);
  // Single source of truth: same getFinalProductScore the Detail screen uses.
  // useMemo keyed on the product reference so the resolver runs at most once
  // per render. Returns null when no score field is available — caller hides
  // the badge entirely (no "—" placeholder).
  const score = useMemo(() => getFinalProductScore(product as any), [product]);

  // ── Rozet çözümleyici ────────────────────────────────────────────────────
  // deriveBadgesWithPurpose: purpose tag (ilk) + feature badges + failsafe "genel bakım"
  // Manuel badges varsa translateRawBadge ile Türkçe'ye çevir, sonra purpose ile birleştir
  //
  // E1 — Card presentation dedupe (sadece sunum katmanı):
  // Her iki yol (manual + fallback) da `normalizeCardBadges` ile temizlenir:
  //   - trim + Türkçe-güvenli lowercase + whitespace collapse → dedupe key
  //   - ilk geçen orijinal label korunur, sıra değişmez
  //   - max 3 görünür badge
  //   - product objesi MUTATE edilmez (filter/map yeni dizi)
  // Scoring/recommendation/derive logic'ine dokunulmaz.
  const smartBadges = useMemo(() => {
    const p = product as any;
    const manual: unknown = p.badges;
    if (Array.isArray(manual) && manual.length > 0) {
      const purposeArr = p.category
        ? deriveBadgesWithPurpose({ category: p.category } as any).slice(0, 1)
        : [];
      const purposeLabel = purposeArr[0] ?? null;

      // Raw Supabase badge key'lerini (ör. "fragrance_free") Türkçe etikete çevir
      const translatedManual = (manual as string[])
        .map((b) => translateRawBadge(b) ?? b);     // çevirisi yoksa orijinal bırak

      const all = purposeLabel ? [purposeLabel, ...translatedManual] : translatedManual;
      const deduped = normalizeCardBadges(all, 3);
      return deduped.length > 0 ? deduped : ["genel bakım"];
    }
    return normalizeCardBadges(deriveBadgesWithPurpose(product as any), 3);
  }, [product]);

  // ── Kısa fayda satırı ────────────────────────────────────────────────────
  // Birincil kaynak: short_benefit
  // Geçici render fallback: short_description (mimari değişmez, sadece boşluk dolgusu)
  // Her ikisi de yoksa alan tamamen kaldırılır
  const shortBenefit = useMemo(() => {
    const p = product as any;
    // Adapted products use camelCase (shortBenefit); raw Supabase rows use snake_case (short_benefit)
    const raw: string =
      p.shortBenefit?.trim() ||      // adaptLegacyProduct → DomainProduct
      p.short_benefit?.trim() ||     // raw Supabase row (non-adapted path)
      p.short_description?.trim() || // fallback only — not the primary field
      "";
    if (!raw || raw.length < 2) return null;
    return raw.length > 72 ? raw.slice(0, 70) + "…" : raw;
  }, [product]);

  const allergyConflict = useMemo(() => {
    if (!canFilter) return null;
    if (
      preferences.allergies.length === 0 &&
      preferences.allergyIngredients.length === 0 &&
      preferences.avoidedIngredients.length === 0
    ) return null;
    return detectAllergyConflict(
      product as any,
      preferences.allergies,
      preferences.allergyIngredients,
      preferences.avoidedIngredients,
    );
  }, [canFilter, product, preferences.allergies, preferences.allergyIngredients, preferences.avoidedIngredients]);
  const matchScore   = computeMatchScore(product as any, preferences.skinType, preferences.skinConcerns);
  const showBadge    = matchScore >= MATCH_THRESHOLD;
  const showPaywall  = !isPremium && index % 5 === 4;
  const reason       = !showPaywall
    ? getCardLabel(product as any)
    : null;
  const imageUrl     = resolveImageUrl(product);
  const thumbnailUrl = resolveThumbnailUrl(product);
  // gorsel_url: marka logosu — ürün fotoğrafı yüklenemezse fallback
  const gorselUrl    = (product as any).gorsel_url || (product as any).gorselUrl || null;
  const displayName  = resolveProductName(product);
  const displayBrand = resolveBrand(product);
  const segment      = (product as any).segment as string | undefined;
  const segConfig    = segment ? (SEGMENT_CONFIG[segment] ?? null) : null;
  const scoreColor   = getScoreColor(score);


  // ── Press animation — Animated.spring (NO Easing) ─────────────────────────
  const pressScale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    setIsPressed(true);
    Animated.spring(pressScale, {
      toValue: 0.97,
      useNativeDriver: true,
      damping: 20,
      stiffness: 520,
      mass: 0.55,
    }).start();
  };

  const onPressOut = () => {
    setIsPressed(false);
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 280,
      mass: 0.7,
    }).start();
  };

  // ── Entrance animation — spring (NO Easing) ───────────────────────────────
  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
      delay: index * 55,
    } as any).start();
  }, []);

  const entranceStyle = {
    opacity: entranceAnim,
    transform: [
      { scale: pressScale },
      {
        scale: entranceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  // ── Score tooltip ─────────────────────────────────────────────────────────
  const scoreTooltipAnim = useRef(new Animated.Value(0)).current;
  const scoreTooltipVisible = useRef(false);

  const handleScorePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (scoreTooltipVisible.current) {
      scoreTooltipVisible.current = false;
      Animated.spring(scoreTooltipAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 300 }).start(() => setShowScoreInfo(false));
    } else {
      scoreTooltipVisible.current = true;
      setShowScoreInfo(true);
      scoreTooltipAnim.setValue(0);
      Animated.spring(scoreTooltipAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }).start();
    }
  };

  const scoreTooltipStyle = {
    opacity: scoreTooltipAnim,
    transform: [
      { scaleY: scoreTooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
      { translateY: scoreTooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) },
    ],
  };

  // ── Favourite (card-level write-only) ─────────────────────────────────────
  const favAnim = useRef(new Animated.Value(1)).current;

  const handleFavPress = async () => {
    if (!user) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        "Üyelik Gerekli",
        "Ürünleri favorilere eklemek için giriş yapmanız gerekiyor.",
        [
          { text: "Giriş Yap", onPress: () => router.push("/giris" as any) },
          { text: "İptal", style: "cancel" },
        ]
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFavPressed(true);
    Animated.sequence([
      Animated.spring(favAnim, { toValue: 1.35, useNativeDriver: true, damping: 8, stiffness: 400 }),
      Animated.spring(favAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 280 }),
    ]).start();
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/api/me/favorites`, {
        method: "POST",
        headers,
        body: JSON.stringify({ urunId: product.id, urunAdi: resolveProductName(product), marka: resolveBrand(product), gorselUrl: resolveImageUrl(product) }),
      });
      trackEvent("favorite_add", String(product.id), {
        brand:    resolveBrand(product)    ?? undefined,
        category: (product.category ?? product.kategori) ?? undefined,
        segment:  product.segment ?? undefined,
      });
    } catch {}
    setTimeout(() => setFavPressed(false), 3000);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const name = resolveProductName(product);
    const brand = resolveBrand(product);
    const title = brand ? `${brand} — ${name}` : name;
    try {
      await Share.share({
        title,
        message: `${title}\n\nCiltBakımım uygulamasında incele:\nciltbakim.app/urun/${product.id}`,
      });
      trackEvent("share_product", String(product.id), {
        brand:    brand   ?? undefined,
        category: (product.category ?? product.kategori) ?? undefined,
        segment:  product.segment ?? undefined,
      });
    } catch {}
  };

  // ── Segment tooltip ───────────────────────────────────────────────────────
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const tooltipVisible = useRef(false);

  const handleSegmentPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tooltipVisible.current) {
      tooltipVisible.current = false;
      Animated.spring(tooltipAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 300,
      }).start(() => setShowSegmentInfo(false));
    } else {
      tooltipVisible.current = true;
      setShowSegmentInfo(true);
      tooltipAnim.setValue(0);
      Animated.spring(tooltipAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 200,
      }).start();
    }
  };

  const tooltipStyle = {
    opacity: tooltipAnim,
    transform: [
      {
        scaleY: tooltipAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
      {
        translateY: tooltipAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-4, 0],
        }),
      },
    ],
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handlePress = () => {
    __perf.markPress(String(product.id));
    // ECZ4 NAV STEP A — Detay hero görselini fire-and-forget disk cache'e ısıt.
    // Navigation'ı bloklamaz (await yok). Hero ProductImage mode="full" tam-boy
    // image_url ister; thumbnail prefetch farklı cache anahtarı → soğuk fetch.
    // Bu çağrı sayfa açılırken paralel indirmeyi başlatır → "geç gelen hero"
    // hissi azalır. Hata sessiz, davranış değişmez.
    prefetchProductHeroImage(product as any);
    trackEvent("product_click", String(product.id), {
      brand:    resolveBrand(product)    ?? undefined,
      category: (product.category ?? product.kategori) ?? undefined,
      segment:  product.segment ?? undefined,
    });
    if (onPress) {
      onPress();
    } else {
      setNavigationProduct(product as Product);
      router.push(`/product/${product.id}`);
    }
  };

  // ── Compact (horizontal scroll) card ─────────────────────────────────────
  if (compact) {
    return (
      <Animated.View style={[styles.compactCard, { backgroundColor: colors.surfaceCard }, entranceStyle]}>
        <Pressable onPress={handlePress} onPressIn={onPressIn} onPressOut={onPressOut} style={{ flex: 1 }}>
          <ProductImage
            imageUrl={imageUrl}
            thumbnailUrl={thumbnailUrl}
            gorselUrl={gorselUrl}
            mode="thumbnail"
            width={160}
            height={120}
            borderRadius={0}
            noBorder={true}
            isDark={scheme === "dark"}
          />
          <View style={styles.compactInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              {displayBrand ? (
                <Text style={[styles.compactBrand, { color: brandColor, flex: 1 }]} numberOfLines={1}>
                  {displayBrand}
                </Text>
              ) : <View style={{ flex: 1 }} />}
              {score != null ? (
                <View style={[styles.compactScore, { backgroundColor: `${scoreColor}18` }]}>
                  <Text style={[styles.compactScoreText, { color: scoreColor }]}>
                    {`${score} puan`}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.compactName, { color: scheme === "dark" ? "#E8EDF5" : "#111827" }]} numberOfLines={2}>
              {displayName}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Standard (grid) card — dikey: üstte görsel, altta metin ─────────────
  const cardSurface    = scheme === "dark" ? "#1E2840" : "#FFFFFF";
  // Grid mode: görsel ve info aynı kart yüzeyinde — kutu etkisi yok
  const gridInfoBg     = scheme === "dark" ? "#1E2840" : "#FFFFFF";
  // imageWrap arka planı: CardImage ile aynı (#FFFFFF) — tüm ürünler tek renk
  const imageSurface   = gridMode ? "#FFFFFF" : cardSurface;
  const infoBg         = gridMode ? gridInfoBg : (scheme === "dark" ? "#1E2840" : "#F5F3F0");
  const gridBorder     = scheme === "dark" ? "rgba(255,255,255,0.08)" : "#DCE5F2";

  const GRID_ACTION_H = 30;

  return (
    <Animated.View
      style={[
        styles.card,
        gridMode && {
          // Sabit piksel genişlik — "48%" + CARD_W=152 çatışmasını keser
          width:         GRID_COL_W,
          height:        undefined,         // yükseklik serbest — içerik kadar büyür
          flexDirection: "column" as const,
          overflow:      "hidden" as const, // borderRadius köşe kırpma
          borderRadius:  18,
          borderWidth:   1,
          borderColor:   gridBorder,
          backgroundColor: cardSurface,
          marginBottom:  14,
        },
        {
          backgroundColor: cardSurface,
          ...Platform.select({
            ios:     { shadowColor: "#1A2F5A", shadowOffset: { width: 0, height: gridMode ? 8 : 4 }, shadowOpacity: isPressed ? (scheme === "dark" ? 0.12 : 0.04) : (scheme === "dark" ? 0.38 : 0.11), shadowRadius: gridMode ? 16 : 8 },
            android: { elevation: isPressed ? (gridMode ? 2 : 1) : (gridMode ? 7 : 3) },
            web:     { boxShadow: isPressed ? "0px 2px 6px rgba(26,47,90,0.06)" : (scheme === "dark" ? "0px 6px 20px rgba(0,0,0,0.40)" : "0px 6px 16px rgba(26,47,90,0.12)") } as any,
          }),
        },
        entranceStyle,
      ]}
    >
      {/* ── GRID META ROW: brand (sol) | segment + skor (sağ) — HER ZAMAN AYRILMIŞ ALAN ── */}
      {gridMode && (
        <View style={[
          styles.gridMetaRow,
          { backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(122,143,107,0.06)" },
        ]}>
          {/* Sol: marka — boşsa görünmez ama alan ayrılmıştır */}
          <Text
            style={[styles.gridMetaBrand, { color: brandColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayBrand ?? ""}
          </Text>
          {/* Sağ: segment + skor — asla büzülmez */}
          <View style={styles.gridMetaRight}>
            {segConfig ? (
              <Pressable
                onPress={handleSegmentPress}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[styles.gridMetaSeg, { backgroundColor: segConfig.bg, borderColor: segConfig.border }]}
              >
                <Text style={[styles.gridMetaSegText, { color: segConfig.color }]}>{segConfig.label}</Text>
              </Pressable>
            ) : null}
            {score != null ? (
              <Pressable
                onPress={handleScorePress}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[
                  styles.gridMetaScore,
                  {
                    backgroundColor: `${scoreColor}15`,
                    borderColor: `${scoreColor}40`,
                  },
                  segConfig ? { marginLeft: 4 } : undefined,
                ]}
              >
                <Text style={[styles.gridMetaScoreText, { color: scoreColor }]}>
                  {`${score} puan`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {/* ── IMAGE AREA ── */}
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.imageWrap,
          gridMode && {
            // ── TEMİZ GÖRSEL SAHNE — padding yok, borderRadius yok (kart halleder) ──
            flex:           0,
            width:          GRID_COL_W,   // sabit piksel
            height:         GRID_FRAME,   // sabit yükseklik = GRID_COL_W
            padding:        0,            // sıfır padding — cream her tarafa uzanır
            alignItems:     "center" as const,
            justifyContent: "center" as const,
            overflow:       "hidden" as const,
          },
          { backgroundColor: imageSurface },
        ]}
      >
        <ProductImage
          imageUrl={imageUrl}
          thumbnailUrl={thumbnailUrl}
          gorselUrl={gorselUrl}
          mode="thumbnail"
          width={gridMode  ? GRID_FRAME : CARD_W}
          height={gridMode ? GRID_FRAME  : IMAGE_H}
          borderRadius={0}  // kart overflow:hidden borderRadius:18 ile köşeleri halleder
          noBorder={true}
          isDark={scheme === "dark"}
        />
      </Pressable>

      {/* ── BOTTOM ZONE: Info + Action ── */}
      <View style={[styles.bottomZone, gridMode && { flex: 0 }]}>

        {/* Separator kaldırıldı — görsel info içine akar */}

        {/* ── INFO PANEL ── */}
        <Pressable
          onPress={handlePress}
          style={[
            styles.info,
            { backgroundColor: infoBg },
            gridMode && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: gridBorder,
              backgroundColor: cardSurface,
              paddingTop: 8,
              paddingHorizontal: 8,
              paddingBottom: 10,
              flex: 0,
              flexDirection: "column" as const,
              justifyContent: "flex-start" as const,
              // height yok — içerik doğal olarak büyür; her kart kendi içeriğine göre
            },
          ]}
        >
          {gridMode ? (
            /* ── Grid info layout: isim + rozet satırı (benefit yok) ── */
            <>
              {/* İsim — maks 2 satır */}
              <View style={styles.gridNameWrap}>
                <Text
                  style={[styles.gridName, { color: scheme === "dark" ? "#EAF0FA" : "#111827" }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {displayName}
                </Text>
              </View>

              {/* Rozet alanı — maks 4, 2 satır, iOS safe */}
              <View style={styles.badgeRow}>
                {smartBadges.map((b, i) => (
                  <View key={i} style={[styles.badge, scheme === "dark" && styles.badgeDark]}>
                    <Text style={[styles.badgeText, scheme === "dark" && styles.badgeTextDark]}>{b}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            /* ── Non-grid info layout (carousel vb.) — mevcut davranış ── */
            <>
              <View style={styles.metaRow}>
                {displayBrand ? (
                  <Text style={[styles.brand, { color: brandColor }]} numberOfLines={1}>
                    {displayBrand}
                  </Text>
                ) : <View style={{ flex: 1 }} />}
                <View style={{ flex: 1 }} />
                {segConfig ? (
                  <Pressable
                    onPress={handleSegmentPress}
                    style={[styles.segmentBadge, {
                      backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.10)" : "#FFFFFF",
                      borderColor: segConfig.border,
                    }]}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Text style={[styles.segmentText, { color: segConfig.color }]}>{segConfig.label}</Text>
                  </Pressable>
                ) : null}
                {score != null ? (
                  <Pressable
                    onPress={handleScorePress}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={[styles.scorePill, {
                      backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.10)" : "#FFFFFF",
                      borderColor: `${scoreColor}50`,
                    }]}
                  >
                    <Text style={[styles.scorePillText, { color: scoreColor }]}>
                      {`Skor | ${score} / 100`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.nameContainer}>
                <Text
                  style={[styles.name, { color: scheme === "dark" ? "#E8EDF5" : "#111827" }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {displayName}
                </Text>
              </View>

              {/* Kısa fayda satırı — ikisi de yoksa alan yok edilir */}
              {shortBenefit ? (
                <Text
                  style={[styles.benefitLine, { color: scheme === "dark" ? "#8FA3B8" : "#6B7C8D" }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  ellipsizeMode="tail"
                >
                  {shortBenefit}
                </Text>
              ) : null}

              {/* Alerjen uyarı şeridi — carousel mode */}
              {!!allergyConflict?.level && (
                <View style={[
                  styles.allergyStrip,
                  { backgroundColor: allergyConflict.level === "danger" ? "#FEF2F2" : "#FFFBEB",
                    borderColor:      allergyConflict.level === "danger" ? "#FCA5A5" : "#FDE68A" }
                ]}>
                  <Feather
                    name={allergyConflict.level === "danger" ? "alert-circle" : "alert-triangle"}
                    size={9}
                    color={allergyConflict.level === "danger" ? "#B91C1C" : "#92400E"}
                  />
                  <Text style={[styles.allergyStripText, {
                    color: allergyConflict.level === "danger" ? "#B91C1C" : "#92400E"
                  }]}>
                    {allergyConflict.level === "danger" ? "Alerjen!" : "Kaçınılan"}
                  </Text>
                </View>
              )}

              <View style={styles.microRow}>
                {smartBadges.length > 0 && (
                  <BadgePills badges={smartBadges} isDark={scheme === "dark"} />
                )}
              </View>
            </>
          )}
        </Pressable>

        {/* ── Tooltiplar (grid mode: sadece non-grid'de göster) ── */}
        {!gridMode && showScoreInfo && score != null ? (
          <Animated.View
            style={[
              styles.segmentTooltip,
              { backgroundColor: `${scoreColor}12`, borderColor: `${scoreColor}30`, marginHorizontal: 11, borderLeftWidth: 3, borderLeftColor: `${cardAccent}B0` },
              scoreTooltipStyle,
            ]}
          >
            <Text style={[styles.segmentTooltipText, { color: scoreColor }]}>
              {score >= 75
                ? "Yüksek puan: İçerik kalitesi ve güvenlik açısından üst dilimde."
                : score >= 50
                ? "Orta-yüksek puan: Dengeli formül, bazı dikkat noktaları var."
                : score >= 25
                ? "Orta-düşük puan: Belirli endişeler mevcut, içerikleri kontrol edin."
                : "Düşük puan: Riskli bileşen potansiyeli var, dikkatli kullanın."}
            </Text>
          </Animated.View>
        ) : null}
        {!gridMode && showSegmentInfo && segConfig ? (
          <Animated.View
            style={[
              styles.segmentTooltip,
              { backgroundColor: segConfig.bg, borderColor: `${segConfig.color}30`, marginHorizontal: 11, borderLeftWidth: 3, borderLeftColor: segConfig.color },
              tooltipStyle,
            ]}
          >
            <Text style={[styles.segmentTooltipText, { color: segConfig.color }]}>
              {segConfig.info}
            </Text>
          </Animated.View>
        ) : null}

        {/* ── Tooltip — grid modda (skor tooltip, görsel üstünde zaten badge var) ── */}
        {gridMode && showScoreInfo && score != null ? (
          <Animated.View
            style={[
              styles.segmentTooltip,
              { backgroundColor: `${scoreColor}12`, borderColor: `${scoreColor}30`, marginHorizontal: 10, borderLeftWidth: 3, borderLeftColor: `${cardAccent}B0` },
              scoreTooltipStyle,
            ]}
          >
            <Text style={[styles.segmentTooltipText, { color: scoreColor }]}>
              {score >= 75
                ? "Yüksek puan: İçerik kalitesi güçlü."
                : score >= 50
                ? "Orta-yüksek: Dengeli formül."
                : score >= 25
                ? "Orta: Bazı dikkat noktaları var."
                : "Düşük: İçerikleri kontrol edin."}
            </Text>
          </Animated.View>
        ) : null}
        {gridMode && showSegmentInfo && segConfig ? (
          <Animated.View
            style={[
              styles.segmentTooltip,
              { backgroundColor: segConfig.bg, borderColor: `${segConfig.color}30`, marginHorizontal: 10, borderLeftWidth: 3, borderLeftColor: segConfig.color },
              tooltipStyle,
            ]}
          >
            <Text style={[styles.segmentTooltipText, { color: segConfig.color }]}>
              {segConfig.info}
            </Text>
          </Animated.View>
        ) : null}


      </View>{/* bottomZone */}
    </Animated.View>
  );
}

// PERF — Custom comparator (Home back flicker fix; bkz. ProductCardInner üstündeki not).
// onPress YENİ closure olabilir ama davranışı aynı — referans değişimini IGNORE.
// Kalan props'lar ürün içeriğini/görünümünü etkiler → değişirse rerender.
export const ProductCard = React.memo(ProductCardInner, (prev, next) => {
  return (
    prev.product === next.product &&
    prev.compact === next.compact &&
    prev.gridMode === next.gridMode &&
    prev.index === next.index &&
    prev.learningProfile === next.learningProfile
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Standard grid card — dikey (görsel üst, metin alt)
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  pressable: {
    flex: 1,
    flexDirection: "column",
  },
  imageWrap: {
    flex: 7,
    width: CARD_W,
    overflow: "hidden" as const,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  bottomZone: {
    flex: 3,
  },
  info: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
    flexDirection: "column" as const,
    justifyContent: "space-between" as const,
    overflow: "hidden" as const,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  microRow: {
    height: 16,
    flexDirection: "row" as const,
    alignItems: "center",
    overflow: "hidden" as const,
  },
  actionStrip: {
    flexDirection: "row" as const,
    alignItems: "center",
    height: 22,
    paddingHorizontal: 10,
    backgroundColor: "#F0F2F6",
    borderTopWidth: 1,
    borderTopColor: "#E4E8F0",
  },
  actionIconBtn: {
    width: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  actionIconBtnActive: {
    backgroundColor: "rgba(225,29,72,0.08)",
  },

  // Meta row
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "nowrap",
  },
  brand: {
    fontSize: 11,
    fontWeight: "400" as const,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  segmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  scorePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  scorePillText: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  nameContainer: {
    height: 18,
    justifyContent: "flex-start" as const,
    overflow: "hidden" as const,
  },
  name: {
    fontSize: 12,
    fontWeight: "600" as const,
    lineHeight: 18,
  },

  // Segment tooltip
  segmentTooltip: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    transformOrigin: "top center" as any,
  },
  segmentTooltipText: {
    fontSize: 10,
    fontWeight: "600" as const,
    lineHeight: 14,
  },

  // Soft paywall teaser
  paywallRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 4,
    opacity: 0.72,
    backgroundColor: "rgba(139,92,246,0.06)",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(139,92,246,0.22)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: "stretch" as const,
  },
  paywallText: {
    flex: 1,
    fontSize: 9,
    fontWeight: "500" as const,
    color: "#7C3AED",
  },

  // Neden önerildi — micro-label, italik, net okunur
  recommendReason: {
    fontSize: 10,
    fontWeight: "500" as const,
    fontStyle: "italic" as const,
    opacity: 0.88,
    lineHeight: 14,
  },
  // Kategori fallback — okunabilir boyut
  categoryLabel: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: "#7A8899",
    letterSpacing: 0.1,
    lineHeight: 15,
  },

  // Şahsileştirme etiketi
  matchBadge: {
    alignSelf: "flex-start" as const,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  matchBadgeText: {
    fontSize: 9,
    fontWeight: "600" as const,
    color: "#4338CA",
    letterSpacing: 0.1,
  },

  // Alerjen uyarı şeridi
  allergyStrip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    alignSelf: "flex-start" as const,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  allergyStripText: {
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.1,
  },

  // ── Grid mode üst meta satır: brand (sol) | segment+score (sağ) ──────────
  gridMetaRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between" as const,
    paddingHorizontal: 10,
    height: GRID_META_H,          // sabit yükseklik — her kartta ayrılmış alan
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  gridMetaBrand: {
    flex: 1,
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: "500" as const,
    letterSpacing: 0.1,
    opacity: 0.58,
    marginRight: 6,
  },
  gridMetaRight: {
    flexDirection: "row" as const,
    alignItems: "center",
    flexShrink: 0,
  },
  gridMetaSeg: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    flexShrink: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: 0.78,
  },
  gridMetaSegText: {
    fontSize: 9,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
  },
  gridMetaScore: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    flexShrink: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    // marginLeft artık inline kondisyonel: segConfig varsa 4px, yoksa 0
  },
  gridMetaScoreText: {
    fontSize: 9,
    fontWeight: "600" as const,
    letterSpacing: 0.1,
  },
  // ── Grid mode overlay rozetler ──────────────────────────────────────────
  gridScoreBadge: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  gridScoreBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.2,
  },
  gridSegBadge: {
    position: "absolute" as const,
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 10,
  },
  gridSegBadgeText: {
    fontSize: 9,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },

  // ── Grid mode info panel ──────────────────────────────────────────────────
  gridBrand: {
    fontSize: 9.5,
    fontWeight: "500" as const,
    letterSpacing: 0.1,
    marginBottom: 2,
    opacity: 0.68,
  },
  gridNameWrap: {
    height: 34,
    justifyContent: "flex-start" as const,
    marginBottom: 6,
  },
  gridName: {
    fontSize: 11.5,
    fontWeight: "700" as const,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  benefitLine: {
    fontSize: 10,
    fontWeight: "400" as const,
    lineHeight: 14,
    letterSpacing: 0.05,
    marginTop: 1,
    marginBottom: 2,
  },
  gridSub: {
    fontSize: 11.5,
    fontWeight: "400" as const,
    lineHeight: 16,
    letterSpacing: 0.1,
    marginBottom: 6,
  },
  gridBottomRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "flex-end" as const,
    flexShrink: 0,
    marginTop: 4,
  },
  // ── İnline rozet satırı — maks 4 rozet, 2 satır, iOS safe ──────────────
  badgeRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    // overflow yok — info panel artık sabit yükseklik değil, içerik kadar büyür
  },
  badge: {
    backgroundColor: "#EBF2E8",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  badgeDark: {
    backgroundColor: "rgba(122,143,107,0.22)",
  },
  badgeText: {
    fontSize: 9,
    color: "#3D5E32",
    fontWeight: "500" as const,
    lineHeight: 12,
    letterSpacing: 0.1,
  },
  badgeTextDark: {
    color: "#A8C49A",
  },
  gridIconBtn: {
    width: 28,
    height: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 10,
  },

  // Compact (yatay scroll) card
  compactCard: { width: 160, borderRadius: 18, overflow: "hidden" },
  compactInfo: { padding: 10, gap: 4 },
  compactBrand: {
    fontSize: 10,
    fontWeight: "400" as const,
    letterSpacing: 0.1,
  },
  compactName: { fontSize: 13, fontWeight: "600" as const, lineHeight: 17 },
  compactScore: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 2,
  },
  compactScoreText: { fontSize: 11, fontWeight: "700" as const },
});
