/**
 * Akıllı Seçim — Guided Decision Engine
 * Adım akışı: ALAN → AMAÇ → KOŞULLAR → SEVİYE → SONUÇLAR
 *
 * Kullanıcıyı uzman gibi yönlendirir.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useAuthGate } from "@/local_demo_data/safe_runtime_shims_v74";
import { canUseBasicCareProfile } from "@/lib/accessControl";
import { saveAkilliSecimProfile } from "@/lib/concernRoutineBridgeStore";
import { ProductImage } from "@/components/ProductImage";
import { getFinalProductScore } from "@/lib/getFinalScore";
import { getScoreColor } from "@/lib/scoreColors";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { resolveThumbnailUrl } from "@/types/product";
import type { Product } from "@/types/product";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width;
const CARD_COL_W = Math.floor((SCREEN_W - 32 - 10) / 2);

const ACCENT      = "#4A6FA5";   // primary blue (matches home card)
const ACCENT_GOLD = "#B8955B";   // accent copper (seçkin only)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Truncate comma-separated desc to max 2 items + "..." */
function truncateDesc(desc: string): string {
  const parts = desc.split(",").map(s => s.trim());
  if (parts.length <= 2) return desc;
  return parts.slice(0, 2).join(", ") + "…";
}

const TOTAL_STEPS = 4; // 0-based: 0,1,2,3 + results=4

// ─── Data: Main Areas ─────────────────────────────────────────────────────────

interface MainArea {
  id: string;
  label: string;
  icon: string;
  desc: string;
  categoryKeywords: string[];
}

const MAIN_AREAS: MainArea[] = [
  {
    id: "cilt", label: "Cilt", icon: "droplet",
    desc: "Yüz bakımı, serum, krem, tonik",
    categoryKeywords: ["serum", "nemlendirici", "krem", "toner", "tonik", "temizleyici",
      "jel", "maske", "peeling", "göz", "yüz", "misel", "cilt", "retinol", "niasin"],
  },
  {
    id: "sac", label: "Saç", icon: "wind",
    desc: "Şampuan, maske, bakım yağı",
    categoryKeywords: ["şampuan", "saç", "scalp", "keratin"],
  },
  {
    id: "gunes", label: "Güneş", icon: "sun",
    desc: "SPF, güneş koruyucu",
    categoryKeywords: ["güneş", "spf", "sun", "uv"],
  },
  {
    id: "vucut", label: "Vücut", icon: "user",
    desc: "Losyon, duş jeli, vücut yağı",
    categoryKeywords: ["vücut", "body", "losyon", "duş", "banyo"],
  },
  {
    id: "agiz", label: "Ağız & Diş", icon: "smile",
    desc: "Diş macunu, gargara, ağız bakım",
    categoryKeywords: ["ağız", "diş", "oral", "gargara"],
  },
];

// ─── Data: Purposes ──────────────────────────────────────────────────────────

interface Purpose {
  id: string;
  label: string;
  keywords: string[];
}

const PURPOSES: Record<string, Purpose[]> = {
  cilt: [
    { id: "temizleme",   label: "Temizleme",         keywords: ["temizleyici", "misel", "köpük", "kil", "jel"] },
    { id: "nemlendirme", label: "Nemlendirme",        keywords: ["nemlendirici", "hyaluron", "nem", "krem"] },
    { id: "leke",        label: "Leke görünümü",      keywords: ["leke", "aydınlatıcı", "vitamin c", "niasinamid"] },
    { id: "akne",        label: "Akne eğilimi",       keywords: ["akne", "sivilce", "salisilik", "bha", "blemish"] },
    { id: "hassasiyet",  label: "Hassasiyet",         keywords: ["hassas", "yatıştırıcı", "panthenol", "aloe"] },
    { id: "bariyer",     label: "Bariyer desteği",    keywords: ["ceramide", "bariyer", "onarıcı", "peptid"] },
  ],
  sac: [
    { id: "yikama",      label: "Yıkama",             keywords: ["şampuan", "scalp", "yıkama"] },
    { id: "beslenme",    label: "Beslenme & Onarım",  keywords: ["maske", "onarıcı", "besleyici", "keratin"] },
    { id: "nem",         label: "Nem Dengesi",        keywords: ["nemlendirici", "hyaluron", "nem"] },
    { id: "dokulum",     label: "Saç dökülmesi",      keywords: ["güçlendirici", "dökülme", "biotin"] },
    { id: "kepek",       label: "Kepek",              keywords: ["kepek", "çay ağacı", "zinc"] },
  ],
  gunes: [
    { id: "yuz",         label: "Yüz koruma",         keywords: ["yüz", "face", "spf"] },
    { id: "vucut",       label: "Vücut koruma",       keywords: ["vücut", "body", "spf"] },
    { id: "su",          label: "Suya dayanıklı",     keywords: ["geçirmez", "waterproof", "dayanıklı"] },
    { id: "isiltili",    label: "Işıltılı görünüm",   keywords: ["işıltı", "glow", "renk"] },
  ],
  vucut: [
    { id: "nemlendirme", label: "Nemlendirme",        keywords: ["nemlendirici", "losyon", "hyaluron"] },
    { id: "sikilas",     label: "Sıkılaştırma",       keywords: ["sıkılaştırıcı", "lifting", "collagen"] },
    { id: "selulit",     label: "Selülit",            keywords: ["selülit", "kafein", "drainage"] },
    { id: "hassas",      label: "Hassas bölge",       keywords: ["hassas", "bebek", "nazik"] },
  ],
  agiz: [
    { id: "beyazlatma",  label: "Beyazlatma",         keywords: ["beyazlatıcı", "whitening"] },
    { id: "disheti",     label: "Diş eti bakımı",     keywords: ["diş eti", "gum", "periodontal"] },
    { id: "gunluk",      label: "Günlük bakım",       keywords: ["günlük", "florür", "temiz"] },
  ],
};

// ─── Data: Conditions ─────────────────────────────────────────────────────────

interface Condition {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
}

const CONDITIONS: Condition[] = [
  { id: "hassas",   label: "Hassas cilt",         icon: "heart",          keywords: ["hassas", "sensitive"] },
  { id: "yagli",    label: "Yağlı cilt",           icon: "droplet",        keywords: ["yağlı", "mat", "oily"] },
  { id: "parfums",  label: "Parfümsüz",            icon: "wind",           keywords: ["parfümsüz", "fragrance free", "kokusuz"] },
  { id: "alkols",   label: "Alkolsüz",             icon: "x-circle",       keywords: ["alkolsüz", "alcohol free"] },
  { id: "vegan",    label: "Vegan",                icon: "feather",        keywords: ["vegan", "bitkisel"] },
  { id: "gebelik",  label: "Gebelikte dikkat",     icon: "alert-circle",   keywords: ["gebelik", "hamile"] },
  { id: "emzirme",  label: "Emzirmede dikkat",     icon: "alert-triangle", keywords: ["emzirme"] },
];

// ─── Data: Selection Levels ──────────────────────────────────────────────────

interface SelectionLevel {
  id: string;
  label: string;
  segmentMap: string[];
  desc: string;
  subdesc: string;
  color: string;
  icon: string;
}

// BUG FIX (Smart Choice Step 4):
//   • Eski "Dengeli" seçeneği iki segmenti birleştiriyordu
//     (ekonomik + profesyonel) → ekonomik ürünler "Pro" altında çıkıyordu.
//   • Eski "Seçkin" seçeneği profesyonel + seçkin'i birleştiriyordu →
//     profesyonel ürünler "Seçkin" altında çıkıyordu.
//   • Yeni davranış: her seçenek TEK kanonik segmentle eşleşir.
//     Label "Dengeli" → "Profesyonel" (etiket); id "dengeli" diğer
//     dosyalarda referans alınmadığından stabil tutuldu.
const LEVELS: SelectionLevel[] = [
  {
    id: "temel",   label: "Temel",
    segmentMap: ["ekonomik"],
    desc: "Etkili ve erişilebilir.",
    subdesc: "Bütçe dostu, kaliteli formüller. Günlük ihtiyaçları karşılar.",
    color: "#8A9275", icon: "check-circle",
  },
  {
    id: "dengeli", label: "Profesyonel",
    segmentMap: ["profesyonel"],
    desc: "Performans odaklı formüller.",
    subdesc: "Kanıtlanmış aktifler, güçlü ürün yelpazesi.",
    color: ACCENT, icon: "layers",
  },
  {
    id: "seckin",  label: "Seçkin",
    segmentMap: ["seçkin"],
    desc: "Üst segment ürünler.",
    subdesc: "Premium formüller, uzman tercihi. Maksimum performans.",
    color: ACCENT_GOLD, icon: "award",
  },
];

// ─── Segment normalization ────────────────────────────────────────────────
// DB ve UI string'leri arasındaki varyasyonları (ç/c, eko/ekonomik,
// pro/profesyonel, premium/seçkin) tek kanonik etikete indirir. Karşılaştırma
// HER İKİ TARAFTA da bu kanonik etiketle yapılır → strict eşitlik garantili.
function normalizeSegment(raw: string | null | undefined): "ekonomik" | "profesyonel" | "seçkin" | "" {
  if (!raw) return "";
  const r = String(raw).toLowerCase().trim();
  if (!r) return "";
  if (r.startsWith("eko") || r === "temel") return "ekonomik";
  if (r.startsWith("prof") || r === "dengeli" || r === "pro") return "profesyonel";
  if (r.startsWith("seç") || r.startsWith("sec") || r === "premium") return "seçkin";
  return "";
}

// ─── Product Filtering ────────────────────────────────────────────────────────

function filterProducts(
  products: Product[],
  areaId: string,
  purposeId: string,
  conditions: string[],
  levelId: string,
): Product[] {
  const area = MAIN_AREAS.find(a => a.id === areaId);
  const purposes = PURPOSES[areaId] ?? [];
  const purposeData = purposes.find(p => p.id === purposeId);
  const levelData = LEVELS.find(l => l.id === levelId);

  if (!area || !purposeData || !levelData) return [];

  const condKeywords = conditions.flatMap(c =>
    CONDITIONS.find(cond => cond.id === c)?.keywords ?? [],
  );

  const matchFull = (p: Product) => {
    const cat  = (p.category ?? p.kategori ?? "").toLowerCase();
    const sub  = (p.subcategory ?? "").toLowerCase();
    const name = (p.name ?? p.isim ?? "").toLowerCase();
    const desc = (p.description ?? p.aciklama ?? p.short_description ?? "").toLowerCase();
    return `${cat} ${sub} ${name} ${desc}`;
  };

  // Strict segment filtering — tek kanonik segment, varyasyonlara karşı
  // dayanıklı. Önceki sessiz "<4 ürün varsa segment filtresini bırak"
  // fallback'i KALDIRILDI; aksi halde "Profesyonel" seçince ekonomik
  // ürünler de listeye karışıyordu.
  const targetSegments = new Set(
    levelData.segmentMap.map((s) => normalizeSegment(s)).filter(Boolean)
  );

  const pool = products.filter(p => {
    const full = matchFull(p);
    const areaHit = area.categoryKeywords.some(kw => full.includes(kw));
    if (!areaHit) return false;
    const seg = normalizeSegment(p.segment);
    if (!seg) return false;
    return targetSegments.has(seg);
  });

  const scored = pool.map(p => {
    const full = matchFull(p);
    const purposeHits = purposeData.keywords.filter(kw => full.includes(kw)).length;
    const condHits    = condKeywords.filter(kw => full.includes(kw)).length;
    const dermo       = getFinalProductScore(p);
    return { p, score: purposeHits * 3 + condHits * 2 + dermo / 10 };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.p)
    .slice(0, 24);
}

function buildWhyText(
  p: Product,
  areaId: string,
  purposeId: string,
): string {
  const score       = getFinalProductScore(p);
  const areaLabel   = MAIN_AREAS.find(a => a.id === areaId)?.label ?? "";
  const purposeLabel = (PURPOSES[areaId] ?? []).find(pr => pr.id === purposeId)?.label ?? "";
  const seg         = (p.segment ?? "").toLowerCase();

  const qualText = score >= 75 ? "Yüksek dermatolojik skoru"
    : score >= 50              ? "Dengeli içerik profili"
    :                            "Uygun formülü";
  const segText = seg === "seçkin"     ? "üst segment kalitesiyle"
    : seg === "profesyonel"            ? "profesyonel içerikleriyle"
    :                                   "erişilebilir fiyatıyla";

  return `${qualText} ve ${purposeLabel.toLowerCase()} odaklı yapısıyla bu ${areaLabel.toLowerCase()} ürünü ${segText} öne çıkıyor.`;
}

// ─── Result Card ──────────────────────────────────────────────────────────────

interface ResultCardProps {
  product: Product;
  areaId: string;
  purposeId: string;
  isDark: boolean;
  colors: ReturnType<typeof useColors>;
}

function ResultCard({ product, areaId, purposeId, isDark, colors }: ResultCardProps) {
  const score = getFinalProductScore(product);
  const scoreColor = getScoreColor(score);
  const thumb = resolveThumbnailUrl(product);
  const name = product.name ?? product.isim ?? "Ürün";
  const brand = product.brand ?? product.marka ?? "";
  const seg = (product.segment ?? "").toLowerCase();
  const whyText = buildWhyText(product, areaId, purposeId);

  const segConfig: Record<string, { label: string; color: string; bg: string }> = {
    "seçkin":     { label: "Seçkin", color: "#B8955B", bg: "rgba(184,149,91,0.12)"  },
    "profesyonel":{ label: "Pro",    color: "#7E8A6A", bg: "rgba(126,138,106,0.12)" },
    "ekonomik":   { label: "Eko",    color: "#7E8A6A", bg: "rgba(126,138,106,0.10)" },
  };
  const segInfo = segConfig[seg] ?? segConfig["ekonomik"];

  const cardBg = isDark ? "#1E1A16" : "#F6F4EF";
  const textColor = isDark ? "#EDE8E3" : "#2C2C2C";
  const subTextColor = isDark ? "#9CA3AF" : "#7A7A7A";
  const borderColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(126,138,106,0.12)";

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prefetchProductHeroImage(product as any);
    setNavigationProduct(product);
    router.push(`/(tabs)/(home)/product/${product.id}` as any);
  }, [product]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.82}
      style={{
        width: CARD_COL_W,
        backgroundColor: cardBg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor,
        overflow: "hidden",
        shadowColor: "#1D2B1A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.22 : 0.07,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: isDark ? "#111" : "#F9F6F2" }}>
        <ProductImage
          imageUrl={thumb}
          thumbnailUrl={thumb}
          width={CARD_COL_W}
          height={CARD_COL_W}
          noBorder
        />
      </View>

      <View style={{ padding: 10, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{
            paddingHorizontal: 7, paddingVertical: 2,
            borderRadius: 5,
            backgroundColor: segInfo.bg,
          }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: segInfo.color }}>
              {segInfo.label}
            </Text>
          </View>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 3,
            paddingHorizontal: 7, paddingVertical: 2,
            borderRadius: 5,
            backgroundColor: `${scoreColor}18`,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: scoreColor }} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: scoreColor }}>
              {Math.round(score)}
            </Text>
          </View>
        </View>

        {!!brand && (
          <Text style={{ fontSize: 10, color: subTextColor, fontWeight: "600", letterSpacing: 0.3 }} numberOfLines={1}>
            {brand.toUpperCase()}
          </Text>
        )}
        <Text style={{ fontSize: 13, fontWeight: "700", color: textColor, lineHeight: 17 }} numberOfLines={2}>
          {name}
        </Text>
        {/* "Neden uygun?" açıklama bloğu kaldırıldı (visual cleanup).
            whyText verisi ve recommendation reason / scoring engine korundu;
            sadece bu kart üzerindeki render kaldırıldı. Kart yüksekliği
            doğal olarak küçülür. */}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AkilliSecimScreen() {
  const colors   = useColors();
  const { theme } = useTheme();
  const isDark   = theme === "dark";
  const insets   = useSafeAreaInsets();
  const { scrollPaddingBottom } = useTabBarInset();
  const { products, loading: productsLoading } = useSupabaseProducts();
  const { user, isSeckin } = useAuth();
  const { requireAuth } = useAuthGate();

  // ─── ECZ4 Step 7e · Save status (local micro feedback) ─────────────────────
  // Yalnızca CTA buton metnini değiştirmek için. Disable yok, navigation yok,
  // toast yok. Seçim değişince otomatik olarak "idle"a döner.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [step,               setStep]               = useState(0);
  const [selectedArea,       setSelectedArea]       = useState<string | null>(null);
  const [selectedPurpose,    setSelectedPurpose]    = useState<string | null>(null);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedLevel,      setSelectedLevel]      = useState<string | null>(null);

  const anim = useRef(new Animated.Value(1)).current;

  const bg          = isDark ? "#0F0C09" : "#EFEDE8";
  const cardBg      = isDark ? "#1A1512" : "#F6F4EF";
  const textPrimary = isDark ? "#8AAED4" : "#2D4E7A";
  const textSecond  = isDark ? "#6B8FAF" : "#5A7BA0";
  const accentColor = isDark ? "#8AAED4" : "#4A6FA5";
  const borderC     = isDark ? "rgba(255,255,255,0.07)" : "rgba(126,138,106,0.15)";

  const stepTransition = useCallback((toStep: number) => {
    Animated.spring(anim, { toValue: 0, useNativeDriver: true, friction: 8 }).start(() => {
      setStep(toStep);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    });
  }, [anim]);

  const goBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
      return;
    }
    stepTransition(step - 1);
  }, [step, stepTransition]);

  const selectArea = useCallback((areaId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedArea(areaId);
    setSelectedPurpose(null);
    setSelectedConditions([]);
    setSelectedLevel(null);
    stepTransition(1);
  }, [stepTransition]);

  const selectPurpose = useCallback((purposeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPurpose(purposeId);
    stepTransition(2);
  }, [stepTransition]);

  const toggleCondition = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedConditions(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    );
  }, []);

  const proceedFromConditions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stepTransition(3);
  }, [stepTransition]);

  const selectLevel = useCallback((levelId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedLevel(levelId);
    stepTransition(4);
  }, [stepTransition]);

  // ─── ECZ4 Step 7c · Akıllı Seçim → Bakım Profili kaydetme (additive) ───────
  // Misafir: useAuthGate → "Üyelik Gerekli" Alert + /giris.
  // Kayıtlı (free/seckin): saveAkilliSecimProfile (Step 7b) ile persist.
  // Filtre/sonuç hesaplaması ETKİLENMEZ — bağımlılıklar yalnızca seçim
  // state'i + auth boolean'ları.
  const handleSaveProfile = useCallback(() => {
    if (!canUseBasicCareProfile(user)) {
      requireAuth(() => {}, "Bakım profilini kaydetme");
      return;
    }
    if (!selectedArea || !selectedPurpose || !selectedLevel) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = saveAkilliSecimProfile(
      {
        selectedArea,
        selectedPurpose,
        selectedConditions,
        selectedLevel,
      },
      isSeckin,
    );
    if (result.ok) {
      // Step 7e — Alert yerine sessiz local "saved" state. Daha az müdahaleci.
      setSaveStatus("saved");
    } else {
      Alert.alert("Profil kaydedilemedi", "Lütfen seçimleri kontrol et.");
    }
  }, [user, requireAuth, selectedArea, selectedPurpose, selectedConditions, selectedLevel, isSeckin]);

  // ECZ4 Step 7e — Seçim her değiştiğinde "saved" rozeti bayatlamasın diye
  // statüyü sıfırla. Sadece scalar/array referans değişimini izler — ürün
  // grid/filtre dep listelerine eklenmez.
  useEffect(() => {
    setSaveStatus("idle");
  }, [selectedArea, selectedPurpose, selectedConditions, selectedLevel]);

  const filteredResults = useMemo(() => {
    if (step !== 4 || !selectedArea || !selectedPurpose || !selectedLevel) return [];
    return filterProducts(products, selectedArea, selectedPurpose, selectedConditions, selectedLevel);
  }, [step, products, selectedArea, selectedPurpose, selectedConditions, selectedLevel]);

  const purposes = selectedArea ? (PURPOSES[selectedArea] ?? []) : [];
  const chosenLevel = LEVELS.find(l => l.id === selectedLevel);

  // ── Header ────────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={{
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingTop: topPad + 8, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: borderC,
      backgroundColor: bg,
    }}>
      <TouchableOpacity onPress={goBack} hitSlop={12} style={{ marginRight: 12 }}>
        <Feather name="arrow-left" size={22} color={textPrimary} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: textPrimary }}>
          Akıllı Seçim
        </Text>
        {step < 4 && (
          <Text style={{ fontSize: 11, color: textSecond, marginTop: 1 }}>
            Adım {step + 1} / {TOTAL_STEPS}
          </Text>
        )}
      </View>
      {step < 4 && (
        <View style={{ flexDirection: "row", gap: 5 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === step ? accentColor : i < step ? `${accentColor}60` : borderC,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );

  // ── Step 0: Main Area ─────────────────────────────────────────────────────

  const renderStep0 = () => (
    <ScrollView
      contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: scrollPaddingBottom }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: textPrimary, marginBottom: 2 }}>
        Neye çözüm{"\n"}arıyorsun?
      </Text>
      <Text style={{ fontSize: 13, color: textSecond, marginBottom: 6 }}>
        Bir bakım alanı seç.
      </Text>
      {MAIN_AREAS.map(area => (
        <TouchableOpacity
          key={area.id}
          onPress={() => selectArea(area.id)}
          activeOpacity={0.80}
          style={{
            backgroundColor: cardBg,
            borderRadius: 10,
            borderWidth: selectedArea === area.id ? 1.5 : 0,
            borderColor: selectedArea === area.id ? ACCENT : "transparent",
            padding: 20,
            flexDirection: "row", alignItems: "center", gap: 16,
            shadowColor: "#1D2B1A",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.18 : 0.07,
            shadowRadius: 12, elevation: 3,
          }}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: `${accentColor}14`,
            alignItems: "center", justifyContent: "center",
          }}>
            <Feather name={area.icon as any} size={21} color={accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: textPrimary }}>
              {area.label}
            </Text>
            <Text style={{ fontSize: 12, color: textSecond, marginTop: 3 }}>
              {truncateDesc(area.desc)}
            </Text>
          </View>
          <Feather name="chevron-right" size={17} color={`${textSecond}99`} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── Step 1: Purpose ───────────────────────────────────────────────────────

  const renderStep1 = () => (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: scrollPaddingBottom }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: textPrimary, marginBottom: 4 }}>
        Ne için{"\n"}bakıyorsun?
      </Text>
      {selectedArea && (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 6,
          marginBottom: 16, marginTop: 4,
        }}>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 8, backgroundColor: `${accentColor}15`,
          }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: accentColor }}>
              {MAIN_AREAS.find(a => a.id === selectedArea)?.label}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: textSecond }}>seçildi</Text>
        </View>
      )}
      <View style={{ gap: 10 }}>
        {purposes.map(p => (
          <TouchableOpacity
            key={p.id}
            onPress={() => selectPurpose(p.id)}
            activeOpacity={0.80}
            style={{
              backgroundColor: cardBg,
              borderRadius: 9,
              borderWidth: selectedPurpose === p.id ? 1.5 : 0,
              borderColor: selectedPurpose === p.id ? accentColor : "transparent",
              paddingHorizontal: 20, paddingVertical: 17,
              flexDirection: "row", alignItems: "center",
              shadowColor: "#1D2B1A",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: isDark ? 0.15 : 0.06,
              shadowRadius: 10, elevation: 2,
            }}
          >
            <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: textPrimary }}>
              {p.label}
            </Text>
            <Feather name="arrow-right" size={16} color={`${ACCENT}99`} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // ── Step 2: Conditions ────────────────────────────────────────────────────

  const renderStep2 = () => (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: scrollPaddingBottom }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: textPrimary, marginBottom: 4 }}>
        Sana uygun{"\n"}olanları daraltalım
      </Text>
      <Text style={{ fontSize: 13, color: textSecond, marginBottom: 20 }}>
        Birden fazla seçebilirsin.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
        {CONDITIONS.map(cond => {
          const active = selectedConditions.includes(cond.id);
          return (
            <TouchableOpacity
              key={cond.id}
              onPress={() => toggleCondition(cond.id)}
              activeOpacity={0.78}
              style={{
                flexDirection: "row", alignItems: "center", gap: 7,
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 24, borderWidth: 1.5,
                borderColor: active ? accentColor : borderC,
                backgroundColor: active ? `${accentColor}14` : cardBg,
              }}
            >
              <Feather name={cond.icon as any} size={14} color={active ? accentColor : textSecond} />
              <Text style={{
                fontSize: 13, fontWeight: active ? "700" : "500",
                color: active ? accentColor : textPrimary,
              }}>
                {cond.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        onPress={proceedFromConditions}
        activeOpacity={0.82}
        style={{
          backgroundColor: accentColor,
          borderRadius: 14,
          paddingVertical: 15,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
          {selectedConditions.length > 0
            ? `${selectedConditions.length} filtre ile devam et`
            : "Tümünü göster"}
        </Text>
        <Feather name="arrow-right" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Step 3: Selection Level ───────────────────────────────────────────────

  const renderStep3 = () => (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: scrollPaddingBottom }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: textPrimary, marginBottom: 4 }}>
        Nasıl bir{"\n"}seçim istersin?
      </Text>
      <Text style={{ fontSize: 13, color: textSecond, marginBottom: 4 }}>
        Bütçe ve beklentine göre seç.
      </Text>
      {LEVELS.map(level => (
        <TouchableOpacity
          key={level.id}
          onPress={() => selectLevel(level.id)}
          activeOpacity={0.80}
          style={{
            backgroundColor: cardBg,
            borderRadius: 10,
            borderWidth: selectedLevel === level.id ? 1.5 : 0,
            borderColor: selectedLevel === level.id ? level.color : "transparent",
            padding: 20,
            shadowColor: "#1D2B1A",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.18 : 0.07,
            shadowRadius: 12, elevation: 3,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <View style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: `${level.color}18`,
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name={level.icon as any} size={20} color={level.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: level.color }}>
                {level.label}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: textPrimary, marginTop: 1 }}>
                {level.desc}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={level.color} />
          </View>
          <Text style={{ fontSize: 13, color: textSecond, lineHeight: 19, marginLeft: 54 }}>
            {level.subdesc}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── Step 4: Results ───────────────────────────────────────────────────────

  const renderResults = () => {
    const areaLabel    = MAIN_AREAS.find(a => a.id === selectedArea)?.label ?? "";
    const purposeLabel = (PURPOSES[selectedArea ?? ""] ?? []).find(p => p.id === selectedPurpose)?.label ?? "";
    const levelColor   = chosenLevel?.color ?? ACCENT;

    return (
      <FlatList
        data={filteredResults}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14 }}
        contentContainerStyle={{ padding: 16, paddingBottom: scrollPaddingBottom, gap: 14 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 11, color: textSecond, fontWeight: "600", letterSpacing: 0.5, marginBottom: 6 }}>
              KRİTERLERİNE GÖRE
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: textPrimary, marginBottom: 8 }}>
              En uygun seçenekler
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {[areaLabel, purposeLabel, chosenLevel?.label].filter(Boolean).map((tag, i) => (
                <View key={i} style={{
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: i === 2 ? `${levelColor}15` : `${accentColor}12`,
                  borderWidth: 1,
                  borderColor: i === 2 ? `${levelColor}30` : `${accentColor}25`,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: i === 2 ? levelColor : accentColor }}>
                    {tag}
                  </Text>
                </View>
              ))}
              {selectedConditions.map(cid => (
                <View key={cid} style={{
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 8, backgroundColor: borderC,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: textSecond }}>
                    {CONDITIONS.find(c => c.id === cid)?.label}
                  </Text>
                </View>
              ))}
            </View>
            {productsLoading ? (
              <ActivityIndicator color={accentColor} />
            ) : (
              <Text style={{ fontSize: 13, color: textSecond }}>
                {filteredResults.length} ürün bulundu
              </Text>
            )}

            {/* ── ECZ4 Step 7c · Bakım Profili kaydetme CTA (additive) ──
                  Yalnızca bu başlık bloğuna yerleştirildi. FlatList yapısı
                  (numColumns / columnWrapperStyle / renderItem / data) ve
                  filtre/sonuç hesaplaması ETKİLENMEZ. */}
            <View
              style={{
                marginTop: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: borderC,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: textPrimary,
                  marginBottom: 4,
                }}
              >
                Bu seçimi profiline kaydet
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: textSecond,
                  lineHeight: 17,
                  marginBottom: 10,
                }}
              >
                Daha sonra bakım profillerinde kullanmak için bu kriterleri sakla.
              </Text>
              <TouchableOpacity
                onPress={handleSaveProfile}
                activeOpacity={0.82}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 9,
                  backgroundColor: accentColor,
                }}
              >
                <Feather
                  name={saveStatus === "saved" ? "check" : "bookmark"}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>
                  {saveStatus === "saved"
                    ? "Profil kaydedildi"
                    : "Bu seçimi profilime kaydet"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={!productsLoading ? (
          <View style={{ alignItems: "center", paddingTop: 40, gap: 12 }}>
            <Feather name="search" size={40} color={textSecond} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: textPrimary, textAlign: "center" }}>
              Bu kriterlere uygun{"\n"}ürün bulunamadı
            </Text>
            <Text style={{ fontSize: 13, color: textSecond, textAlign: "center" }}>
              Filtrelerini genişletmeyi dene.
            </Text>
            <TouchableOpacity
              onPress={() => stepTransition(2)}
              style={{
                marginTop: 8, paddingHorizontal: 20, paddingVertical: 12,
                borderRadius: 12, backgroundColor: accentColor,
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>
                Filtreleri Değiştir
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <ResultCard
            product={item}
            areaId={selectedArea ?? "cilt"}
            purposeId={selectedPurpose ?? ""}
            isDark={isDark}
            colors={colors}
          />
        )}
      />
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {renderHeader()}
      <Animated.View style={{ flex: 1, opacity: anim }}>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderResults()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({});