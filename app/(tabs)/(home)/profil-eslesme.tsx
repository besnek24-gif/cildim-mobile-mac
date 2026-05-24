/**
 * profil-eslesme.tsx  —  Profil Eşleştirme Motoru
 *
 * Kullanıcı bir cilt kaygısı seçer;
 * motor, profilini (cilt tipi, alerji, özel koşullar) dikkate alarak
 * Supabase ürünlerini 0–100 puanla sıralar ve üç tier'da gösterir.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductImage } from "@/components/ProductImage";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useTheme } from "@/context/ThemeContext";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import {
  setRecommendation,
  buildRecommendationProfileSig,
} from "@/lib/recommendationFlowStore";
import { resolveImageUrl, resolveThumbnailUrl } from "@/types/product";
import type { Product } from "@/types/product";
import {
  rankProductsForConcern,
  TIER_META,
  CONCERN_ICONS,
  CONCERN_COLORS,
  type MatchResult,
  type MatchTier,
  type ConfidenceLevel,
} from "@/lib/productMatchEngine";
import {
  SKIN_CONCERN_LABELS,
  type SkinConcernKey,
} from "@/lib/userPreferences";
import {
  resolveConcernFromText,
  type ProfileConcernUIKey,
} from "@/lib/profileConcernIntent";

// ─── Renk paleti ──────────────────────────────────────────────────────────────

const LIGHT = {
  bg:         "#F5F1EB",
  cardBg:     "#FFFFFF",
  border:     "rgba(0,0,0,0.07)",
  text:       "#1A1A1A",
  textSub:    "#5A5A5A",
  textMuted:  "#8C8C8C",
  chipBg:     "#EEE8DE",
  chipBorder: "#D8CEBC",
  tierBg:     "#FAF7F2",
};
const DARK = {
  bg:         "#121210",
  cardBg:     "#1C1C1A",
  border:     "rgba(255,255,255,0.07)",
  text:       "#F0EDE6",
  textSub:    "#AAA8A2",
  textMuted:  "#6A6862",
  chipBg:     "#272521",
  chipBorder: "#363430",
  tierBg:     "#181816",
};

// ─── Concern listesi ──────────────────────────────────────────────────────────
// ECZ-4 DÖRTLÜ Step 3: UI alias concern modeli — yalnızca chip listesini
// genişletmek için. Engine her zaman canonical SkinConcernKey alır;
// alias'lar UI_CONCERN_TO_CANONICAL ile resolve edilir. SkinConcernKey union'ı,
// productMatchEngine, smartRoutineEngine, recommendationFlowStore DOKUNULMADI.

// Step 4: tek-tip UI key kaynağı — helper'daki ProfileConcernUIKey ile aynı
// değer setini paylaşır (paralel taksonomi yok).
type UIConcernKey = ProfileConcernUIKey;

const UI_CONCERN_TO_CANONICAL: Record<UIConcernKey, SkinConcernKey> = {
  acne:           "acne",
  spots:          "spots",
  redness:        "redness",
  dehydration:    "dehydration",
  barrier_repair: "barrier_repair",
  anti_aging:     "anti_aging",
  pore:           "pore",
  blackheads:     "pore",
  dullness:       "spots",
  texture:        "pore",
  oiliness:       "pore",
  sensitivity:    "redness",
};

const UI_CONCERN_KEYS: UIConcernKey[] = [
  "acne",
  "spots",
  "redness",
  "dehydration",
  "barrier_repair",
  "anti_aging",
  "pore",
  "blackheads",
  "dullness",
  "texture",
  "oiliness",
  "sensitivity",
];

const UI_CONCERN_LABELS: Record<UIConcernKey, string> = {
  ...SKIN_CONCERN_LABELS,
  blackheads:  "Siyah Nokta",
  dullness:    "Donuk Cilt",
  texture:     "Pürüzsüzlük",
  oiliness:    "Yağlanma",
  sensitivity: "Hassasiyet",
};

const getUIConcernIcon  = (key: UIConcernKey): string => CONCERN_ICONS[UI_CONCERN_TO_CANONICAL[key]];
const getUIConcernColor = (key: UIConcernKey): string => CONCERN_COLORS[UI_CONCERN_TO_CANONICAL[key]];

// ─── Score renk sistemi ───────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return "#7A8F6B";
  if (score >= 70) return "#4A6FA5";
  if (score >= 50) return "#C8A97E";
  return "#999";
}

function confidenceColor(level: ConfidenceLevel): string {
  if (level === "high")   return "#7A8F6B";
  if (level === "medium") return "#C8A97E";
  return "#A0A0A0";
}

// ─── Expandable "Neden önerildi?" bileşeni ────────────────────────────────────

function WhyCard({
  result,
  pal,
  accentColor,
}: {
  result: MatchResult;
  pal: typeof LIGHT;
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toVal = open ? 0 : 1;
    setOpen(!open);
    Animated.timing(anim, {
      toValue: toVal,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        style={[styles.whyBtn, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}0D` }]}
      >
        <Text style={[styles.whyBtnText, { color: accentColor }]}>Neden önerildi?</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="chevron-down" size={14} color={accentColor} />
        </Animated.View>
      </TouchableOpacity>

      {open && (
        <View style={[styles.whyBody, { backgroundColor: `${accentColor}08`, borderColor: `${accentColor}20` }]}>
          {result.matchReasons.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.whyLabel, { color: pal.textSub }]}>Eşleşme nedenleri</Text>
              {result.matchReasons.map((r, i) => (
                <View key={i} style={styles.whyRow}>
                  <Feather name="check-circle" size={13} color="#7A8F6B" style={{ marginTop: 1 }} />
                  <Text style={[styles.whyRowText, { color: pal.text }]}>{r}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.whyDivider, { backgroundColor: `${accentColor}20` }]} />

          <View style={{ marginTop: 8 }}>
            <Text style={[styles.whyLabel, { color: pal.textSub }]}>Profil uyumu</Text>
            <View style={styles.fitScoreRow}>
              <View style={[styles.fitBar, { backgroundColor: pal.border }]}>
                <View
                  style={[
                    styles.fitBarFill,
                    { width: `${result.fitScore}%` as any, backgroundColor: scoreColor(result.score) },
                  ]}
                />
              </View>
              <Text style={[styles.fitScoreText, { color: pal.textSub }]}>
                {result.fitScore}/100
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <Text style={[styles.whyLabel, { color: pal.textSub }]}>Öneri güveni</Text>
            <View style={[styles.confRow]}>
              <View style={[styles.confDot, { backgroundColor: confidenceColor(result.confidence) }]} />
              <Text style={[styles.confText, { color: pal.textSub }]}>{result.confidenceLabel}</Text>
            </View>
          </View>

          {result.warnings.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={[styles.whyLabel, { color: pal.textSub }]}>Dikkat noktaları</Text>
              {result.warnings.slice(0, 2).map((w, i) => (
                <View key={i} style={styles.whyRow}>
                  <Feather name="alert-circle" size={13} color="#E8604C" style={{ marginTop: 1 }} />
                  <Text style={[styles.whyRowText, { color: pal.text }]}>{w.title}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Ürün kartı ───────────────────────────────────────────────────────────────

function MatchCard({
  result,
  pal,
  isDark,
}: {
  result: MatchResult;
  pal: typeof LIGHT;
  isDark: boolean;
}) {
  const p       = result.product;
  const name    = (p.name ?? (p as any).isim ?? "Ürün") as string;
  const brand   = (p.brand ?? (p as any).marka ?? "") as string;
  // MERKEZI cozumleyici — storage_image_url > image_url > thumbnail_url > legacy
  const imgUrl  = resolveImageUrl(p as any);
  const thumb   = resolveThumbnailUrl(p as any);
  const accent  = scoreColor(result.score);
  const tierMeta = TIER_META[result.tier];

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prefetchProductHeroImage(p as any);
    setNavigationProduct(p);
    router.push(`/(tabs)/(home)/product/${p.id}`);
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.88}
      style={[
        styles.card,
        {
          backgroundColor: pal.cardBg,
          borderColor: pal.border,
          ...Platform.select({
            ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10 },
            android: { elevation: 3 },
            web:     { boxShadow: "0 3px 10px rgba(0,0,0,0.07)" } as any,
          }),
        },
      ]}
    >
      {/* Üst satır: görsel + bilgi */}
      <View style={styles.cardTop}>
        {/* Görsel */}
        <View style={[styles.imgWrap, { backgroundColor: isDark ? "#252422" : "#F5F0EA" }]}>
          <ProductImage
            imageUrl={imgUrl}
            thumbnailUrl={thumb}
            size={72}
            borderRadius={12}
          />
          {/* Skor rozeti */}
          <View style={[styles.scoreBadge, { backgroundColor: accent }]}>
            <Text style={styles.scoreBadgeText}>{result.score}</Text>
          </View>
        </View>

        {/* Metin kolonu */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          {brand.length > 0 && (
            <Text style={[styles.brandText, { color: pal.textMuted }]} numberOfLines={1}>
              {brand}
            </Text>
          )}
          <Text style={[styles.nameText, { color: pal.text }]} numberOfLines={2}>
            {name}
          </Text>

          {/* Tier + güven rozeti */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.tierBadge, { backgroundColor: `${tierMeta.color}18`, borderColor: `${tierMeta.color}35` }]}>
              <Feather name={tierMeta.iconName as any} size={10} color={tierMeta.color} />
              <Text style={[styles.tierBadgeText, { color: tierMeta.color }]}>
                {tierMeta.label}
              </Text>
            </View>
            <View style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: confidenceColor(result.confidence),
              marginLeft: 6, marginTop: 2,
            }} />
          </View>
        </View>

        {/* Ok */}
        <Feather name="chevron-right" size={16} color={pal.textMuted} style={{ marginTop: 4 }} />
      </View>

      {/* Eşleşme etiketleri */}
      {result.matchReasons.length > 0 && (
        <View style={styles.reasonsRow}>
          {result.matchReasons.slice(0, 3).map((r, i) => (
            <View key={i} style={[styles.reasonChip, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
              <Text style={[styles.reasonChipText, { color: accent }]}>{r}</Text>
            </View>
          ))}
        </View>
      )}

      {/* "Neden önerildi?" genişletici */}
      <WhyCard result={result} pal={pal} accentColor={accent} />
    </TouchableOpacity>
  );
}

// ─── Tier bölümü ─────────────────────────────────────────────────────────────

// ECZ-4 DÖRTLÜ Step 5 — UI-only tier copy override.
// TIER_META (productMatchEngine.ts) tek truth olarak kalır; bu harita
// SADECE bu ekranda gösterilen başlık/alt-başlık metnini değiştirir.
// Diğer ekranlar (akilli-rutin vb.) etkilenmez.
const LOCAL_TIER_COPY: Record<MatchTier, { label: string; sublabel: string }> = {
  best: {
    label:    "En uygun eşleşmeler",
    sublabel: "Profilinle güçlü uyum",
  },
  strong: {
    label:    "Güçlü alternatifler",
    sublabel: "Yüksek uyum",
  },
  consider: {
    label:    "Düşünülebilir seçenekler",
    sublabel: "Profilini destekleyebilir, kararı sana bırakıyoruz",
  },
};

function TierSection({
  tier,
  items,
  pal,
  isDark,
}: {
  tier: MatchTier;
  items: MatchResult[];
  pal: typeof LIGHT;
  isDark: boolean;
}) {
  if (items.length === 0) return null;
  const meta = TIER_META[tier];
  // Step 5: UI copy override — ikon, renk, kart yapısı, sayaç dokunulmadı.
  const copyLabel    = LOCAL_TIER_COPY[tier]?.label    ?? meta.label;
  const copySublabel = LOCAL_TIER_COPY[tier]?.sublabel ?? meta.sublabel;

  return (
    <View style={{ marginBottom: 24 }}>
      {/* Başlık */}
      <View style={[styles.tierHeader, { backgroundColor: `${meta.color}10`, borderColor: `${meta.color}25` }]}>
        <View style={[styles.tierIconBox, { backgroundColor: `${meta.color}20` }]}>
          <Feather name={meta.iconName as any} size={14} color={meta.color} />
        </View>
        <View>
          <Text style={[styles.tierTitle, { color: meta.color }]}>{copyLabel}</Text>
          <Text style={[styles.tierSubtitle, { color: pal.textMuted }]}>{copySublabel}</Text>
        </View>
        <View style={[styles.tierCount, { backgroundColor: `${meta.color}20` }]}>
          <Text style={[styles.tierCountText, { color: meta.color }]}>{items.length}</Text>
        </View>
      </View>

      {/* Ürün kartları */}
      {items.map((r, i) => (
        <View key={r.product.id} style={i > 0 ? { marginTop: 10 } : {}}>
          <MatchCard result={r} pal={pal} isDark={isDark} />
        </View>
      ))}
    </View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProfilEslesmeScreen() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const pal    = isDark ? DARK : LIGHT;

  const insets              = useSafeAreaInsets();
  const { scrollPaddingBottom } = useTabBarInset();

  const { preferences, ready } = useUserPreferences();
  const { products, loading }  = useSupabaseProducts();

  const [selectedConcern,   setSelectedConcern]   = useState<SkinConcernKey | null>(null);
  // ECZ-4 DÖRTLÜ Step 3: alias chip seçimini sadece görsel highlight için tutar.
  // Engine her zaman selectedConcern (canonical) ile çalışır.
  const [selectedUIConcern, setSelectedUIConcern] = useState<UIConcernKey | null>(null);

  // ECZ-4 DÖRTLÜ Step 4: serbest metin intent çözümleme.
  // Kullanıcı tipler → 250ms debounce → resolver tek bir öneri üretir →
  // kullanıcı suggestion chip'e dokunursa selectUIConcern çağrılır.
  // Tipleme sırasında HİÇBİR engine path tetiklenmez.
  const [intentInput,         setIntentInput]         = useState("");
  const [debouncedIntentInput, setDebouncedIntentInput] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedIntentInput(intentInput), 250);
    return () => clearTimeout(t);
  }, [intentInput]);

  const resolvedTextIntent = useMemo(
    () => resolveConcernFromText(debouncedIntentInput),
    [debouncedIntentInput],
  );

  // ── Puanlama: concern değişince yeniden hesapla ────────────────────────────
  const tiered = useMemo(() => {
    if (!selectedConcern || !ready || loading || products.length === 0) return null;
    const result = rankProductsForConcern(products, preferences, selectedConcern);
    // ── ECZ-4 DÖRTLÜ Step 1: bridge ──────────────────────────────────────
    // Hesaplanan tiered sonucu /akilli-rutin tarafından (aynı concern +
    // aynı profileSig içinde 5dk TTL ile) tekrar kullanılabilsin diye
    // module-level singleton'a yazılır. Engine ya da UI değiştirilmez.
    try {
      const allMatchedIds = [
        ...result.best,
        ...result.strong,
        ...result.consider,
      ]
        .map((m) => m.product?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      setRecommendation(
        {
          concern: selectedConcern,
          profileSig: buildRecommendationProfileSig(preferences),
          ts: Date.now(),
        },
        { tiered: result, allMatchedIds }
      );
    } catch {
      // store yazımı hata verirse UI etkilenmesin — fallback path zaten var.
    }
    return result;
  }, [selectedConcern, ready, loading, products, preferences]);

  function selectUIConcern(uiKey: UIConcernKey) {
    const canonical = UI_CONCERN_TO_CANONICAL[uiKey];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUIConcern(prev => (prev === uiKey ? null : uiKey));
    setSelectedConcern(prev => (prev === canonical && selectedUIConcern === uiKey ? null : canonical));
  }

  // Geriye uyumlu wrapper — varsa diğer çağrı yerleri için (kaldırılmadı, additive).
  function selectConcern(key: SkinConcernKey) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedConcern(prev => (prev === key ? null : key));
  }

  const isLoading = !ready || loading;
  const hasResults = tiered && tiered.total > 0;
  const noResults  = tiered && tiered.total === 0;

  return (
    <View style={[styles.root, { backgroundColor: pal.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: pal.border }]}>
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={pal.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.headerTitle, { color: pal.text }]}>Benim için ara</Text>
          <Text style={[styles.headerSub, { color: pal.textMuted }]}>Profiline göre ürün eşleştir</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom() }]}
      >
        {/* Profil özeti */}
        <View style={[styles.profileChips, { borderColor: pal.chipBorder, backgroundColor: isDark ? "#1E1C1A" : "#F0EBE0" }]}>
          <Feather name="user" size={14} color={pal.textMuted} style={{ marginRight: 6 }} />
          <Text style={[styles.profileChipText, { color: pal.textSub }]}>
            {preferences.skinType
              ? `${skinTypeLabel(preferences.skinType)} cilt`
              : "Cilt tipi belirtilmemiş"}
          </Text>
          {preferences.allergies.length > 0 && (
            <Text style={[styles.profileChipText, { color: pal.textMuted, marginLeft: 8 }]}>
              · {preferences.allergies.length} alerji
            </Text>
          )}
          {preferences.specialConditions.length > 0 && (
            <Text style={[styles.profileChipText, { color: pal.textMuted, marginLeft: 8 }]}>
              · {preferences.specialConditions.length} özel koşul
            </Text>
          )}
        </View>

        {/* Kaygı seçici */}
        <Text style={[styles.sectionLabel, { color: pal.textSub }]}>Hangi kaygıya çözüm arıyorsun?</Text>

        {/* ECZ-4 DÖRTLÜ Step 4 — Serbest metin intent alanı.
            Mevcut renk/border/typografi diline uyumlu kompakt giriş.
            Tipleme tek başına engine'i tetiklemez; öneri chip'i tıklanırsa
            selectUIConcern → canonical SkinConcernKey akışı çalışır. */}
        <View style={[
          styles.intentInputWrap,
          { backgroundColor: isDark ? "#1E1C1A" : "#F0EBE0", borderColor: pal.chipBorder },
        ]}>
          <Feather name="edit-3" size={14} color={pal.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={intentInput}
            onChangeText={setIntentInput}
            placeholder="Endişeni yaz: cildim pul pul, siyah noktam var..."
            placeholderTextColor={pal.textMuted}
            style={[styles.intentInput, { color: pal.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
          />
          {intentInput.length > 0 && (
            <Pressable
              onPress={() => setIntentInput("")}
              hitSlop={10}
              style={{ marginLeft: 6 }}
            >
              <Feather name="x" size={14} color={pal.textMuted} />
            </Pressable>
          )}
        </View>

        {/* ECZ-4 DÖRTLÜ — Free-text suggestion stale UX fix (Option A).
            Apply sonrası (selectedUIConcern === resolvedTextIntent.uiKey) chip
            gizlenir. Kullanıcı farklı bir chip seçerse suggestion alternatif
            ipucu olarak yeniden görünür. Input metni korunur; state/effect
            eklenmez; engine ve resolver dokunulmaz. */}
        {resolvedTextIntent && selectedUIConcern !== resolvedTextIntent.uiKey && (
          <TouchableOpacity
            onPress={() => selectUIConcern(resolvedTextIntent.uiKey)}
            activeOpacity={0.78}
            style={[
              styles.intentSuggestionChip,
              {
                backgroundColor: `${getUIConcernColor(resolvedTextIntent.uiKey)}18`,
                borderColor:     getUIConcernColor(resolvedTextIntent.uiKey),
              },
            ]}
          >
            <Feather
              name="zap"
              size={12}
              color={getUIConcernColor(resolvedTextIntent.uiKey)}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.intentSuggestionText, { color: pal.text }]}>
              Bunu{" "}
              <Text style={{ fontWeight: "700", color: getUIConcernColor(resolvedTextIntent.uiKey) }}>
                {UI_CONCERN_LABELS[resolvedTextIntent.uiKey]}
              </Text>
              {" "}olarak yorumladık · uygula
            </Text>
          </TouchableOpacity>
        )}

        {/* ECZ4 Step E — Önceden yatay ScrollView idi; concern chip'ler ekranın
            sağına kayıp gizleniyordu. Aynı chip görseli korunarak dikey wrap
            (flexDirection:row + flexWrap:wrap) layout'una geçirildi. Sıralama,
            etiket, ikon, seçim davranışı, CONCERN_KEYS, selectedConcern aynen.
            ProductCard / scoring / ranking dokunulmadı. */}
        <View style={styles.concernWrap}>
          {UI_CONCERN_KEYS.map(key => {
            // Çift seçim önlemi: alias ve canonical aynı engine concern'ine
            // çözümlense bile yalnızca tıklanan UI key highlight olur.
            const isActive  = selectedUIConcern === key;
            const color     = getUIConcernColor(key);
            const icon      = getUIConcernIcon(key) as any;

            return (
              <TouchableOpacity
                key={key}
                onPress={() => selectUIConcern(key)}
                activeOpacity={0.78}
                style={[
                  styles.concernChip,
                  isActive
                    ? { backgroundColor: color, borderColor: color }
                    : { backgroundColor: pal.chipBg, borderColor: pal.chipBorder },
                ]}
              >
                <Feather name={icon} size={13} color={isActive ? "#FFF" : color} style={{ marginRight: 6 }} />
                <Text style={[
                  styles.concernChipText,
                  { color: isActive ? "#FFF" : pal.text },
                ]}>
                  {UI_CONCERN_LABELS[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* İçerik alanı */}
        <View style={{ marginTop: 20 }}>
          {/* Yükleme */}
          {isLoading && (
            <View style={styles.center}>
              <ActivityIndicator color={pal.textMuted} />
              <Text style={[styles.emptyText, { color: pal.textMuted, marginTop: 10 }]}>Profil yükleniyor…</Text>
            </View>
          )}

          {/* Seçim bekleniyor */}
          {!isLoading && !selectedConcern && (
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? "#262420" : "#EEE8DE" }]}>
                <Feather name="search" size={28} color={pal.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: pal.text }]}>Kaygını seç</Text>
              <Text style={[styles.emptyText, { color: pal.textMuted }]}>
                Yukarıdan cilt sorununuzu seçin;{"\n"}profilinize uygun ürünleri sıralayalım.
              </Text>
            </View>
          )}

          {/* Sonuç yok */}
          {!isLoading && noResults && (
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? "#262420" : "#EEE8DE" }]}>
                <Feather name="package" size={28} color={pal.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: pal.text }]}>Uyumlu ürün bulunamadı</Text>
              <Text style={[styles.emptyText, { color: pal.textMuted }]}>
                Mevcut profil ve seçilen kaygı için{"\n"}yeterli uyum sağlayan ürün yok.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/ayarlar" as any)}
                style={[styles.profileBtn, { backgroundColor: "#7A8F6B" }]}
                activeOpacity={0.82}
              >
                <Feather name="edit-3" size={14} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.profileBtnText}>Profilimi düzenle</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sonuçlar */}
          {!isLoading && hasResults && (
            <View>
              <View style={[styles.resultsSummaryRow]}>
                <Text style={[styles.resultsSummaryText, { color: pal.textSub }]}>
                  {tiered!.total} ürün eşleşti
                </Text>
                {selectedConcern && (
                  <View style={[styles.concernBadge, { backgroundColor: `${CONCERN_COLORS[selectedConcern]}18` }]}>
                    <Feather name={CONCERN_ICONS[selectedConcern] as any} size={11} color={CONCERN_COLORS[selectedConcern]} style={{ marginRight: 4 }} />
                    <Text style={[styles.concernBadgeText, { color: CONCERN_COLORS[selectedConcern] }]}>
                      {SKIN_CONCERN_LABELS[selectedConcern]}
                    </Text>
                  </View>
                )}
              </View>

              {/* ECZ-4 DÖRTLÜ Step 5 — Sıralama mantığı kısa açıklaması.
                  Saf statik copy; hesaplama yok, motor edit'i yok. */}
              {selectedConcern && (
                <Text style={[styles.resultsExplain, { color: pal.textMuted }]}>
                  Bu sonuçlar{" "}
                  <Text style={{ fontWeight: "600", color: pal.textSub }}>
                    {SKIN_CONCERN_LABELS[selectedConcern]}
                  </Text>
                  {" "}için profilin, ürün içerikleri ve güvenlik sinyalleri birlikte değerlendirilerek sıralandı.
                </Text>
              )}

              <TierSection tier="best"     items={tiered!.best}     pal={pal} isDark={isDark} />
              <TierSection tier="strong"   items={tiered!.strong}   pal={pal} isDark={isDark} />
              <TierSection tier="consider" items={tiered!.consider} pal={pal} isDark={isDark} />

              {/* Rutin Oluştur CTA */}
              {selectedConcern && (
                <Text style={[styles.ctaMicroCopy, { color: pal.textMuted }]}>
                  Bu endişe için profilinle uyumlu sabah/akşam rutin önerisi hazırlanacak.
                </Text>
              )}
              {selectedConcern && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push(`/(tabs)/(home)/akilli-rutin?concern=${selectedConcern}`);
                  }}
                  activeOpacity={0.85}
                  style={[
                    styles.routineBtn,
                    { backgroundColor: CONCERN_COLORS[selectedConcern], borderColor: CONCERN_COLORS[selectedConcern] },
                  ]}
                >
                  <Feather name="list" size={16} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.routineBtnText}>Bu endişeye göre kişisel rutin oluştur</Text>
                  <Feather name="arrow-right" size={15} color="#FFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Cilt tipi Türkçe etiketi ─────────────────────────────────────────────────

function skinTypeLabel(type: string): string {
  const map: Record<string, string> = {
    dry: "Kuru", oily: "Yağlı", sensitive: "Hassas",
    combination: "Karma", normal: "Normal",
  };
  return map[type] ?? type;
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, marginTop: 1 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  profileChips: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 20,
  },
  profileChipText: { fontSize: 13, fontWeight: "500" },

  sectionLabel: { fontSize: 13, fontWeight: "600", marginBottom: 10 },

  concernScrollContent: { paddingRight: 16, paddingBottom: 4 },
  // ECZ4 Step E — Dikey wrap kapsayıcı. rowGap/columnGap RN 0.71+ destekli;
  // Expo SDK 50+ ile uyumlu. marginRight 8 chip stilinden kaldırılarak
  // tutarlı boşluk gap üzerinden yönetilir.
  concernWrap: {
    flexDirection: "row",
    flexWrap:      "wrap",
    alignItems:    "flex-start",
    rowGap:        8,
    columnGap:     8,
    paddingBottom: 4,
  },
  concernChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  concernChipText: { fontSize: 13, fontWeight: "600" },

  // ECZ-4 DÖRTLÜ Step 4 — intent input + suggestion chip
  intentInputWrap: {
    flexDirection: "row",
    alignItems:    "center",
    borderWidth:   1,
    borderRadius:  12,
    paddingHorizontal: 12,
    paddingVertical:   Platform.OS === "ios" ? 10 : 4,
    marginBottom: 10,
  },
  intentInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  intentSuggestionChip: {
    flexDirection: "row",
    alignItems:    "center",
    alignSelf:     "flex-start",
    borderWidth:   1,
    borderRadius:  20,
    paddingHorizontal: 12,
    paddingVertical:   7,
    marginBottom: 10,
  },
  intentSuggestionText: { fontSize: 12, fontWeight: "500" },

  // ECZ-4 DÖRTLÜ Step 5 — sonuç açıklama satırı + CTA mikro-copy
  resultsExplain: {
    fontSize:    12,
    lineHeight:  17,
    marginTop:   6,
    marginBottom: 14,
  },
  ctaMicroCopy: {
    fontSize:    12,
    lineHeight:  16,
    marginBottom: 8,
    textAlign:   "center",
  },

  // Empty / loading states
  center:     { alignItems: "center", justifyContent: "center", paddingTop: 60, paddingBottom: 40 },
  emptyIcon:  { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptyText:  { fontSize: 14, textAlign: "center", lineHeight: 20 },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 20,
  },
  profileBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },

  // Results summary
  resultsSummaryRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  resultsSummaryText: { fontSize: 14, fontWeight: "500", flex: 1 },
  concernBadge: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  concernBadgeText: { fontSize: 12, fontWeight: "600" },

  // Tier section
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  tierIconBox: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 10 },
  tierTitle:    { fontSize: 14, fontWeight: "700" },
  tierSubtitle: { fontSize: 11, marginTop: 1 },
  tierCount: { marginLeft: "auto", width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  tierCountText: { fontSize: 13, fontWeight: "700" },

  // Product card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },

  imgWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  scoreBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  scoreBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "800" },

  brandText: { fontSize: 11, fontWeight: "500", marginBottom: 2, letterSpacing: 0.2 },
  nameText:  { fontSize: 14, fontWeight: "700", lineHeight: 20, marginBottom: 6 },

  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeText: { fontSize: 10, fontWeight: "600", marginLeft: 4 },

  reasonsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  reasonChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  reasonChipText: { fontSize: 11, fontWeight: "600" },

  // Why card
  whyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  whyBtnText: { fontSize: 12, fontWeight: "600" },

  whyBody: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  whyLabel:   { fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  whyRow:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  whyRowText: { fontSize: 13, marginLeft: 6, flex: 1, lineHeight: 18 },
  whyDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  fitScoreRow: { flexDirection: "row", alignItems: "center" },
  fitBar:      { flex: 1, height: 4, borderRadius: 2, marginRight: 8 },
  fitBarFill:  { height: 4, borderRadius: 2 },
  fitScoreText:{ fontSize: 12, fontWeight: "600", minWidth: 36 },

  confRow:  { flexDirection: "row", alignItems: "center", marginTop: 2 },
  confDot:  { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  confText: { fontSize: 12 },

  routineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 4,
  },
  routineBtnText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
});