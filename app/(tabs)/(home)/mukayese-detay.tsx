import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { ProductImage } from "@/components/ProductImage";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useSupabaseProducts, fetchSupabaseProductById } from "@/local_demo_data/safe_runtime_shims_v74";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import {
  compareProducts,
  type ComparisonBadge,
  type ComparisonSummaryItem,
  type DiffFeature,
  type SharedFeature,
  type SkinTypeRow,
  type IngredientComparisonResult,
} from "@/lib/compareProducts";
import { getFinalProductScore, getDisplayScore } from "@/lib/getFinalScore";
import { arePairsCompatible, pairKey } from "@/lib/pairKey";
import { sameRawCategory, logCategoryGuardBlock } from "@/lib/sameRawCategory";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { getScoreColors } from "@/lib/scoreColors";
import { trackEvent } from "@/lib/userEvents";
import { trackCompareOpen, trackCompareWinner } from "@/lib/productMetrics";
import { buildComparisonInsight, type ComparisonInsight } from "@/lib/productPurposeEngine";
import { buildComparisonCommentary } from "@/lib/comparisonCommentary";
import { resolveImageUrl, resolveThumbnailUrl, type Product } from "@/types/product";
import { loadGuides, type DecisionGuide } from "@/lib/decisionGuideStore";
import { deriveFeatureBadges } from "@/lib/featureBadges";
import { normalizeProductData } from "@/lib/normalizeProduct";
import { evaluateProductWarnings, fitScoreLabel } from "@/lib/productWarnings";
import { ProductWarningList } from "@/components/ProductWarningList";

function normName(p: Product) { return (p.name ?? (p as any).isim ?? "Ürün").trim(); }
function normBrand(p: Product) { return (p.brand ?? (p as any).marka ?? "").trim(); }
function normScore(p: Product): number | null {
  // Liste ve detay ekranı aynı fallback sırasını kullansın diye TEK kaynak.
  return getDisplayScore(p as any);
}

// ── Rozet tabanlı karar ipucu ─────────────────────────────────────────────────
interface FeatureHint {
  winner: "A" | "B" | null;
  /** Öne çıkan ürünün özgün rozetleri (virgülle ayrılmış) */
  excText: string;
  excA: string[];
  excB: string[];
}

function computeFeatureHint(bA: string[], bB: string[]): FeatureHint | null {
  if (bA.length === 0 && bB.length === 0) return null;
  const setB = new Set(bB);
  const setA = new Set(bA);
  const excA = bA.filter((b) => !setB.has(b));
  const excB = bB.filter((b) => !setA.has(b));

  if (excA.length > excB.length) {
    return { winner: "A", excText: excA.slice(0, 2).join(" · "), excA, excB };
  }
  if (excB.length > excA.length) {
    return { winner: "B", excText: excB.slice(0, 2).join(" · "), excA, excB };
  }
  // Eşit özgün rozet sayısı
  if (excA.length > 0) {
    return { winner: null, excText: "aynı güçlü özellikler", excA, excB };
  }
  // Tamamen aynı rozetler
  if (bA.length > 0) {
    return { winner: null, excText: "aynı güçlü özellikler", excA: [], excB: [] };
  }
  return null;
}
function normPrice(p: Product): string | null {
  const v = p.price ?? p.average_price ?? null;
  return v != null ? `${v.toLocaleString("tr-TR")} ₺` : null;
}

const WINNER_A = "#3B82F6";
const WINNER_B = "#8B5CF6";
const TIE_CLR = "#6B7280";

// UI-HIDE flags (refactor v1) — kullanıcı talebi ile gizlenen bölümler.
// Tip: `boolean` olarak işaretli (literal değil) → TypeScript narrowing
// koşullarını bozmaz. Geri açmak için `true` → `false`.
const HIDE_TEMEL_FARKLAR: boolean       = true;
const HIDE_FARKLI_OZELLIKLER: boolean   = true;
const HIDE_DERMATOLOJIK: boolean        = true;
// "Temel fark" insight kartı (CoreDifferenceCard, başlık: "Temel fark")
// kullanıcı talebi ile gizlendi. Logic / hesaplama dokunulmadı.
const HIDE_TEMEL_FARK_INSIGHT: boolean  = true;

// Premium gating (refactor v2) — gerçek state-source bağlandı.
// Canonical kaynak: AuthContext.isSeckin (computeEffectiveRole + active
// subscription_status). Mock IS_PREMIUM_USER kaldırıldı.
// Bileşen içinde `useAuth().isSeckin` doğrudan tüketiliyor.

// ── Final Decision Sentence (refactor v1) ────────────────────────────────
// UI-only. Veri / scoring / ranking etkilenmez.
// Mevcut sistemde ComparisonResult.winner alanı YOK; tek doğru kaynak
// finalScoreA vs finalScoreB'den türeyen heroWinner. Spec'in `result?.winner`
// yerine heroWinner kullanılıyor (mimariyle uyumlu).
// Şablon SABİT — uzun ürün adlarının layout'u kırmasını engellemek için
// dinamik isim kaldırıldı. Kazanan referansı için Hero kartı + rozet zaten
// görsel olarak belli ediyor; cümle sadece kararın ağırlığını taşıyor.
// Beraberlik durumu nötr fallback ile ayrı tutuldu.
function buildFinalDecisionSentence(
  _pA: any,
  _pB: any,
  heroWinner: "A" | "B" | null,
): string {
  try {
    if (heroWinner !== "A" && heroWinner !== "B") {
      return "İki ürün de benzer seviyede; seçim cilt ihtiyacına göre değişir.";
    }
    return "Bu kıyaslamada daha dengeli ve güvenli seçim öne çıkıyor.";
  } catch {
    return "Bu kıyaslamada daha dengeli ve güvenli seçim öne çıkıyor.";
  }
}

function WinnerDot({ winner, side }: { winner: "A" | "B" | "tie" | null; side: "A" | "B" }) {
  if (winner === "tie") return <View style={[styles.winnerDot, { backgroundColor: TIE_CLR }]} />;
  if (winner === side) return <View style={[styles.winnerDot, { backgroundColor: side === "A" ? WINNER_A : WINNER_B }]} />;
  return <View style={[styles.winnerDot, { backgroundColor: "transparent" }]} />;
}

function BadgeCell({ status }: { status: "positive" | "negative" | "unknown" }) {
  const bg  = status === "positive" ? "#EAF1EA" : status === "negative" ? "#FEE2E2" : "#F3F4F6";
  const clr = status === "positive" ? "#5C7050" : status === "negative" ? "#991B1B" : "#6B7280";
  const icon = status === "positive" ? "check" : status === "negative" ? "x" : "minus";
  return (
    <View style={[styles.badgeCell, { backgroundColor: bg }]}>
      <Feather name={icon as any} size={14} color={clr} />
    </View>
  );
}

function SkinCell({ val }: { val: "good" | "caution" | "neutral" }) {
  if (val === "good") return <View style={[styles.skinCell, { backgroundColor: "#EAF1EA" }]}><Feather name="check" size={14} color="#5C7050" /></View>;
  if (val === "caution") return <View style={[styles.skinCell, { backgroundColor: "#FEF9C3" }]}><Feather name="alert-triangle" size={12} color="#92400E" /></View>;
  return <View style={[styles.skinCell, { backgroundColor: "#F3F4F6" }]}><Feather name="minus" size={14} color="#9CA3AF" /></View>;
}

// ── HeroScoreChip ─ EH19 · skor yoksa kırık "Skor —" yerine subtle not ─────
// EH19.1 · TÜM mukayese ekranlarında skor 0-100 tam sayı olarak gösterilir.
// Önceden `(score / 10).toFixed(1)` ile "Skor 7.8" yazıyordu; bu artık YANLIŞ.
// getDisplayScore zaten 0-100 normalize döner; burada ek bölme yapma.
function HeroScoreChip({ score }: { score: number | null }) {
  if (score != null) {
    const tone = getScoreColors(score);
    return (
      <View style={[styles.heroScore, { backgroundColor: tone.bg, borderColor: tone.border }]}>
        <Text style={[styles.heroScoreText, { color: tone.main }]}>
          {`Güven skoru ${Math.round(score)}`}
        </Text>
      </View>
    );
  }
  // EH19: prominent "Skor —" çok kırık görünüyordu → küçük italik etiket.
  return (
    <Text style={{ fontSize: 10, fontWeight: "500", fontStyle: "italic", color: "#9CA3AF", marginTop: 4 }}>
      Güven skoru yok
    </Text>
  );
}

// ── BadgeSectionOrFallback ─ rozet listesi boş/unknown ise HİÇ render etme ──
// (refactor v1) Önceki sürüm "Rozet verisi henüz hazırlanıyor." placeholder
// kart gösteriyordu; bu kullanıcıyı yanıltıyordu (sanki yükleniyor). Artık
// güvenilir veri yoksa bölüm tamamen gizleniyor — null dönüş.
function BadgeSectionOrFallback({
  badges,
  summary,
  colors,
}: {
  badges: { key: string; label: string; a: "positive" | "negative" | "unknown"; b: "positive" | "negative" | "unknown" }[];
  summary?: string | null;
  colors: any;
}) {
  if (badges.length === 0) return null;
  // (refactor v2) all-unknown null guard KALDIRILDI. Veri zayıf olsa
  // da tablo render edilsin; bilinmeyen hücreler BadgeCell tarafından
  // nötr ("—") gösterilir. Sessiz kaybolma engellendi. Placeholder
  // metin geri getirilmedi — yapı görünür, içerik gerçekçi.
  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: "#EDE9FE" }]}>
          <Feather name="tag" size={13} color="#7C3AED" />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Rozet Karşılaştırması</Text>
      </View>
      <View style={styles.badgeHeaderRow}>
        <View style={{ flex: 1 }} />
        <View style={[styles.badgeColHead, { backgroundColor: WINNER_A + "20" }]}><Text style={[styles.badgeColHeadText, { color: WINNER_A }]}>A</Text></View>
        <View style={[styles.badgeColHead, { backgroundColor: WINNER_B + "20" }]}><Text style={[styles.badgeColHeadText, { color: WINNER_B }]}>B</Text></View>
      </View>
      {badges.map((badge) => (
        <View key={badge.key} style={styles.badgeRow}>
          <Text style={[styles.badgeLabel, { color: colors.textMuted, fontSize: 12 }]}>{badge.label}</Text>
          <BadgeCell status={badge.a} />
          <BadgeCell status={badge.b} />
        </View>
      ))}
      {summary ? (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textMuted, fontStyle: "italic" }}>
            {summary}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// PERF (S1) · İKİ AYRIK ÜRÜN REFERANSI MODELİ (NO SPREAD)
// ──────────────────────────────────────────────────────────────────────────
// Eski model: light üzerine hidrasyondan gelen HEAVY alanları spread ile
// MERGE ediyorduk → her hidrasyonda YENİ obje doğuyor → useMemo zinciri
// (compareProducts/deriveFeatureBadges/getFinalProductScore) hidrasyon
// sonrası komple yeniden çalışıyor, ProductImage'a gelen string prop'ları
// aynı kalsa bile alt content yeniden render olduğu için "flicker" hissi
// oluşuyordu.
//
// Yeni model:
//   visualA/visualB = light (HOME_FIELDS) obje REFERANSININ KENDİSİ.
//                     Spread, clone yok. Hero (görsel + isim + marka +
//                     skor) yalnızca bu referansı okur. Hidrasyon olsa
//                     da OLMASA da bu referans değişmez → top UI sabit.
//   pA/pB           = (hydratedA ?? visualA). Heavy obje hazırsa onu,
//                     değilse light'ı doğrudan döndür. compareProducts,
//                     deriveFeatureBadges, ingredient/badge alt bölümleri
//                     bu referansı kullanır.
// İki referans arasındaki tek geçiş anı: hidrasyon dönerken pA/pB
// hydratedA/hydratedB'ye geçer; visualA/visualB AYNI kalır.

export default function MukayeseDetayScreen() {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  // Visual fix v7 — kart çerçeveleri için tema-uyumlu yumuşak palet.
  // Dark mode'da `colors.border = #2E2E2E` yakın-siyah görünüyordu;
  // burada copper-tinted yumuşak ton kullanıyoruz. Light tarafı zaten
  // warm-beige (`#E5DDD6`) — aynı tonu sabit tutuyoruz.
  const softBorder = isDark ? "rgba(184,115,51,0.22)" : "#E5DDD6";
  const insets = useSafeAreaInsets();
  const { scrollPaddingBottom } = useTabBarInset();
  const { width: winW } = useWindowDimensions();
  // Hero görsel boyutu — slot genişliğini taşmadan en büyük kareye yerleş.
  // Ekran kenar boşlukları (16+16), heroCard padding (12+12), divider (~28),
  // gap (~8) çıkarılır; iki sloda bölünür. Min 150 / max 200.
  const heroImgSize = Math.max(
    150,
    Math.min(200, Math.floor((winW - 32 - 24 - 28 - 8) / 2)),
  );
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ idA: string; idB: string; guideId?: string; fromGuide?: string }>();
  const { products, loading } = useSupabaseProducts();
  const { preferences } = useUserPreferences();
  const { isSeckin } = useAuth();
  const [activeGuide, setActiveGuide] = useState<DecisionGuide | null>(null);

  // EH22 · Tam ürün verisi (ingredients / features / concerns / benefits)
  // Home listesi performans için sadece 15 alan çekiyor (HOME_FIELDS) — bu
  // alanlar mukayese için yetersiz. Burada A ve B'yi paralel olarak tam
  // satır (select "*") ile yeniden çekip karşılaştırmayı zenginleştiriyoruz.
  // Light objeler (Home cache'inden) chrome'u anında gösterir; hidrasyon
  // tamamlandığında compareProducts/deriveFeatureBadges yeniden çalışır.
  const [hydratedA, setHydratedA] = useState<Product | null>(null);
  const [hydratedB, setHydratedB] = useState<Product | null>(null);
  // Tracks the in-flight hydration fetch (Promise.all of the two
  // fetchSupabaseProductById calls below) and whether at least one attempt
  // has finished. Used solely to gate the "Ürünler bulunamadı" branch so
  // it cannot render while the async resolution is still pending.
  const [isHydratingProducts, setIsHydratingProducts] = useState<boolean>(false);
  const [hydrationAttempted, setHydrationAttempted] = useState<boolean>(false);

  // PERF: Tek noktadan kontrol edilebilen DEBUG bayrağı.
  // Önceden her render'da JSON-stringify edilen büyük objelerle 5+ console.log
  // ateşleniyordu (hidrasyon öncesi 1, sonrası 1; preferences değişince yine 1).
  // Üretimde tamamen susturmak için sabit `false`. Geçici saha incelemesinde
  // tek satır `true` yapıp yeniden başlatmak yeter.
  const COMPARE_DEBUG = false;

  useEffect(() => {
    let cancelled = false;
    setHydratedA(null);
    setHydratedB(null);
    setHydrationAttempted(false);
    if (!params.idA || !params.idB) return;
    setIsHydratingProducts(true);
    (async () => {
      try {
        const [fullA, fullB] = await Promise.all([
          fetchSupabaseProductById(String(params.idA)),
          fetchSupabaseProductById(String(params.idB)),
        ]);
        if (cancelled) return;
        if (fullA) setHydratedA(fullA);
        if (fullB) setHydratedB(fullB);
      } catch {
        // Hydration failures are non-fatal — visualA/visualB (light objects)
        // remain in place and the UI degrades gracefully.
      } finally {
        if (!cancelled) {
          setIsHydratingProducts(false);
          setHydrationAttempted(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [params.idA, params.idB]);

  // Rehber bilgisini AsyncStorage'dan yükle (fromGuide=1 olduğunda)
  useEffect(() => {
    if (!params.guideId || params.fromGuide !== "1") return;
    loadGuides().then((guides) => {
      const found = guides.find((g) => g.id === params.guideId);
      if (found) setActiveGuide(found);
    }).catch(() => {});
  }, [params.guideId, params.fromGuide]);

  const { visualA, visualB, pA, pB, result, insight, commentary, categoryMismatch, incompatible, badgesA, badgesB, featureHint } = useMemo(() => {
    const empty = {
      visualA: null as Product | null,
      visualB: null as Product | null,
      pA: null as Product | null,
      pB: null as Product | null,
      result: null,
      insight: null,
      commentary: [] as string[],
      categoryMismatch: false,
      incompatible: false,
      badgesA: [] as string[],
      badgesB: [] as string[],
      featureHint: null as FeatureHint | null,
    };
    if (!params.idA || !params.idB) return empty;
    // PERF (S1) · NO-SPREAD model:
    // visualA/visualB = aLight/bLight (Home'dan gelen referansın AYNISI).
    // Hidrasyon sonrası bile visualA referansı değişmez (sameProductListById
    // guard products.find sonucunu stabil tutar). Hero ProductImage ve
    // hero başlık/skor SADECE visualA/visualB'yi okur → top UI sabit.
    //
    // pA/pB = (hydratedA ?? visualA). Heavy obje (ingredients/features/
    // concerns/benefits/scores/analysis) hazırsa onu kullan; değilse
    // light'ın kendisine düş. compareProducts/deriveFeatureBadges/
    // getFinalProductScore yalnızca pA/pB üzerinden çalışır — hidrasyon
    // tamamlanınca BU referans değişir, ama visualA/visualB DEĞİŞMEZ.
    const aLight = products.find((p) => p.id === params.idA);
    const bLight = products.find((p) => p.id === params.idB);
    const visualA = aLight ?? null;
    const visualB = bLight ?? null;
    const a: Product | null = (hydratedA as Product | null) ?? visualA;
    const b: Product | null = (hydratedB as Product | null) ?? visualB;
    if (!a || !b) return empty;

    // EH19 · Liste ve detay TEK kaynak (pairKey + arePairsCompatible) kullansın.
    // Eski raw category/subcategory eşitliği kaldırıldı; pairKey
    // (subcategory > category > isimden çıkarım > saç bakım amaç eki)
    // sayesinde "şampuan" gibi isimden gelen grupları da yakalar.
    const kA = pairKey(a as any);
    const kB = pairKey(b as any);

    // Özellik rozetleri — her iki ürün için türet
    const bA = deriveFeatureBadges(a as any);
    const bB = deriveFeatureBadges(b as any);
    const hint = computeFeatureHint(bA, bB);

    // 1) pairKey üretilemiyor veya farklı domain → kategori uyuşmazlığı
    if (!kA || !kB || kA !== kB) {
      return { visualA, visualB, pA: a, pB: b, result: null, insight: null, commentary: [] as string[], categoryMismatch: true, incompatible: false, badgesA: bA, badgesB: bB, featureHint: hint };
    }

    // 1b) HARD RAW CATEGORY GUARD — pairKey aynı olsa bile raw category
    // farklıysa kategori uyumsuzluğu olarak işaretle. Karşılaştırma detayı
    // farklı kategorideki ürünleri yan yana göstermez.
    if (!sameRawCategory(a as any, b as any)) {
      logCategoryGuardBlock("mukayese-detay", a as any, b as any);
      return { visualA, visualB, pA: a, pB: b, result: null, insight: null, commentary: [] as string[], categoryMismatch: true, incompatible: false, badgesA: bA, badgesB: bB, featureHint: hint };
    }

    // 2) Aynı pairKey ama eşleşme uyumsuz (aynı marka/varyant, concern çakışması)
    if (!arePairsCompatible(a as any, b as any)) {
      return { visualA, visualB, pA: a, pB: b, result: null, insight: null, commentary: [] as string[], categoryMismatch: false, incompatible: true, badgesA: bA, badgesB: bB, featureHint: hint };
    }

    const nameA = (a.name ?? (a as any).isim ?? "A").trim();
    const nameB = (b.name ?? (b as any).isim ?? "B").trim();

    const cmpResult = compareProducts(a, b, {
      allergies: preferences.allergies,
      specialConditions: preferences.specialConditions,
    });
    const fScoreA = getFinalProductScore(a as any);
    const fScoreB = getFinalProductScore(b as any);

    return {
      visualA,
      visualB,
      pA: a,
      pB: b,
      result: cmpResult,
      insight: buildComparisonInsight(a, b, fScoreA, fScoreB),
      commentary: buildComparisonCommentary(a, b, nameA, nameB),
      categoryMismatch: false,
      incompatible: false,
      badgesA: bA,
      badgesB: bB,
      featureHint: hint,
    };
  }, [params.idA, params.idB, products, preferences, hydratedA, hydratedB]);

  // ── Rozet truth UNIFY (refactor v4) ───────────────────────────────
  // Detay ekranı (ProductBadgesSection) İçerik Rozetleri'ni
  // normalizeProductData(p).quickBadges (öncelik) ve .badges (fallback)
  // üzerinden gösterir. Mukayese ekranı buraya kadar yalnızca
  // compareProducts → extractBadgeStatus (features/contains_*)
  // kullanıyordu → ingredient parsing'i olan detayla asimetri.
  // Bu noktadan itibaren mukayese tablosu DETAYLA AYNI helper'ı
  // kullanır: normalizeProductData. compareProducts.result.badges
  // değişmedi (başka tüketiciler için hesaplanmaya devam ediyor),
  // sadece UI'a beslenen satırlar artık unified kaynaktan geliyor.
  const normA = useMemo(() => (pA ? normalizeProductData(pA as Product) : null), [pA]);
  const normB = useMemo(() => (pB ? normalizeProductData(pB as Product) : null), [pB]);

  type BadgeKey = "vegan" | "paraben" | "sulfate" | "fragrance" | "alcohol" | "silicone";
  type CellStatus = "positive" | "negative" | "unknown";
  // Detay ile birebir aynı seçim: quickBadges PRIMARY, badges fallback.
  function pickStatusFromNormalized(
    norm: ReturnType<typeof normalizeProductData> | null,
    key: BadgeKey,
  ): CellStatus {
    if (!norm) return "unknown";
    const q = norm.quickBadges.find((b) => b.key === key);
    if (q && q.status !== "unknown") return q.status as CellStatus;
    const b = norm.badges.find((x) => x.key === key);
    return (b?.status ?? "unknown") as CellStatus;
  }

  const unifiedBadges = useMemo(() => {
    // BADGE_DEFS normalizeProduct.ts içinde private; aynı sıra ve label
    // listesini detay tarafının çıktısı olan normA.badges üzerinden
    // okuyoruz (her zaman 6 satır, sabit sıra). normA yoksa normB'den,
    // o da yoksa boş array (render guard L192 boş olursa null döner;
    // bu yalnız her iki ürün de null iken olur).
    const template = (normA?.badges ?? normB?.badges ?? []);
    return template.map((row) => ({
      key: row.key,
      label: row.label,
      a: pickStatusFromNormalized(normA, row.key as BadgeKey),
      b: pickStatusFromNormalized(normB, row.key as BadgeKey),
    }));
  }, [normA, normB]);

  // ── BADGE-DRIVEN DECISION CLARITY (UI-only refactor v5) ─────────────
  // unifiedBadges üzerinden 3 küçük türev: (1) pozitif sayıları ve
  // metinsel özet; (2) sadece bir tarafta pozitif olan en güçlü tekil
  // fark (decision'ı yönlendirir); (3) WhoIsItForCard duplikasyon
  // çözümü için anahtar→{a,b} differentiation copy. Hiçbir şey
  // ingredient parsing yapmaz; veri kaynağı yalnızca unifiedBadges.
  const badgeAdvantage = useMemo(() => {
    let aPos = 0, bPos = 0;
    let strongest: { key: string; label: string; side: "A" | "B" } | null = null;
    for (const row of unifiedBadges) {
      if (row.a === "positive") aPos++;
      if (row.b === "positive") bPos++;
      // Yalnızca BİR tarafta pozitif olan satır "fark" sayılır.
      if (!strongest) {
        if (row.a === "positive" && row.b !== "positive") strongest = { key: row.key, label: row.label, side: "A" };
        else if (row.b === "positive" && row.a !== "positive") strongest = { key: row.key, label: row.label, side: "B" };
      }
    }
    let summary: string | null = null;
    if (unifiedBadges.length > 0) {
      // nameA/nameB top-level scope'ta (L719) sonra tanımlanıyor; burada
      // pA/pB üzerinden lokal türetiyoruz (normName hoisted helper).
      const localA = pA ? normName(pA as Product) : "A ürünü";
      const localB = pB ? normName(pB as Product) : "B ürünü";
      // (refactor v6 — wording-only) strongest fark anahtarına göre
      // somut bir gerekçe ekliyoruz; kazanan tarafın strongest'ı varsa.
      const STRONGEST_LABEL_COPY: Record<string, string> = {
        sulfate:   "sülfat içermemesiyle",
        paraben:   "paraben içermemesiyle",
        fragrance: "parfümsüz yapısıyla",
        alcohol:   "alkol içermemesiyle",
        silicone:  "silikon içermemesiyle",
        vegan:     "vegan formülüyle",
      };
      const strongestLabel =
        strongest && STRONGEST_LABEL_COPY[strongest.key]
          ? STRONGEST_LABEL_COPY[strongest.key]
          : null;
      if (aPos > bPos) {
        summary =
          strongest?.side === "A" && strongestLabel
            ? `${localA}, içerik tarafında daha güçlü (${aPos} avantaj) — özellikle ${strongestLabel}.`
            : `${localA}, içerik tarafında daha güçlü (${aPos} avantaj).`;
      } else if (bPos > aPos) {
        summary =
          strongest?.side === "B" && strongestLabel
            ? `${localB}, içerik tarafında daha güçlü (${bPos} avantaj) — özellikle ${strongestLabel}.`
            : `${localB}, içerik tarafında daha güçlü (${bPos} avantaj).`;
      } else {
        summary = "İki ürün içerik açısından benzer seviyede.";
      }
    }
    return { aPos, bPos, strongest, summary };
  }, [unifiedBadges, pA, pB]);

  // Anahtar bazlı, AB simetrik kullanıcı profili eşleşmeleri.
  // Sadece WhoIsItForCard duplikasyonunda devreye girer.
  const WHO_DIFF_COPY: Record<string, { A: string; B: string }> = {
    sulfate:   { A: "Daha nazik temizleyici isteyenler",       B: "Daha güçlü arındırma isteyenler" },
    paraben:   { A: "Koruyuculardan kaçınmak isteyenler",      B: "Standart koruyucu toleransı olanlar" },
    fragrance: { A: "Parfümsüz/hassas profil tercih edenler",  B: "Kokulu formül sevenler" },
    alcohol:   { A: "Alkolsüz formül tercih edenler",          B: "Hızlı emilim ve ferahlık isteyenler" },
    silicone:  { A: "Silikonsuz formül tercih edenler",        B: "Pürüzsüz dokunuş isteyenler" },
    vegan:     { A: "Vegan formül tercih edenler",             B: "Genel kullanım için uygun olanlar" },
  };
  const whoOverride = useMemo(() => {
    if (!insight) return null;
    if (insight.whoA?.trim() !== insight.whoB?.trim()) return null;
    const s = badgeAdvantage.strongest;
    if (!s) return null;
    const copy = WHO_DIFF_COPY[s.key];
    if (!copy) return null;
    return { whoA: copy.A, whoB: copy.B };
  }, [insight, badgeAdvantage]);

  // FeatureHintCard'a eklenecek tek-cümlelik gerekçe (yalnız kazanan
  // tarafta strongest pozitif fark varsa).
  const FEATURE_REASON_COPY: Record<string, string> = {
    sulfate:   "sülfat içermez",
    paraben:   "paraben içermez",
    fragrance: "parfüm içermez",
    alcohol:   "alkol içermez",
    silicone:  "silikon içermez",
    vegan:     "vegan formüle sahip",
  };
  const featureReason = useMemo(() => {
    const s = badgeAdvantage.strongest;
    if (!s) return null;
    const reason = FEATURE_REASON_COPY[s.key];
    if (!reason) return null;
    return { side: s.side, text: `Bu kategoride öne çıkıyor çünkü ${reason}.` };
  }, [badgeAdvantage]);

  // ── Ürüne özel profil uyarıları + uyum puanı ─────────────────────
  const { warnings: warningsA, fitScore: fitScoreA } = useMemo(() => {
    if (!pA) return { warnings: [], fitScore: 100 };
    return evaluateProductWarnings(pA as Record<string, any>, {
      allergies:          preferences.allergies,
      specialConditions:  preferences.specialConditions,
      allergyIngredients: preferences.allergyIngredients,
      avoidedIngredients: preferences.avoidedIngredients,
      skinType:           preferences.skinType,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pA?.id, preferences.allergies, preferences.specialConditions, preferences.allergyIngredients, preferences.avoidedIngredients]);

  const { warnings: warningsB, fitScore: fitScoreB } = useMemo(() => {
    if (!pB) return { warnings: [], fitScore: 100 };
    return evaluateProductWarnings(pB as Record<string, any>, {
      allergies:          preferences.allergies,
      specialConditions:  preferences.specialConditions,
      allergyIngredients: preferences.allergyIngredients,
      avoidedIngredients: preferences.avoidedIngredients,
      skinType:           preferences.skinType,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pB?.id, preferences.allergies, preferences.specialConditions, preferences.allergyIngredients, preferences.avoidedIngredients]);

  useEffect(() => {
    if (pA && pB) {
      trackEvent("compare_open");
      trackCompareOpen([String(pA.id), String(pB.id)]);
    }
  }, [pA?.id, pB?.id]);

  // Final Decision Sentence (refactor v1) — UI-only memoize.
  // MUST stay above any conditional early return so hook order is stable
  // across renders (Rules of Hooks). Self-contained: derives heroWinner
  // internally from pA/pB so we don't depend on values computed later in
  // the render path. Returns "" when pA/pB missing so consumers can render
  // safely (current consumer is a Text child, "" renders nothing).
  const finalDecisionSentence = useMemo(() => {
    if (!pA || !pB) return "";
    const fa = getFinalProductScore(pA as any);
    const fb = getFinalProductScore(pB as any);
    const winner: "A" | "B" | null =
      fa != null && fb != null && fa !== fb ? (fa > fb ? "A" : "B") : null;
    return buildFinalDecisionSentence(pA, pB, winner);
  }, [pA, pB]);

  const goProduct = (p: Product) => {
    trackEvent("compare_winner_click", String(p.id));
    trackCompareWinner(String(p.id));
    prefetchProductHeroImage(p as any);
    setNavigationProduct(p);
    router.push(`/product/${p.id}`);
  };

  if (loading) {
    // Back-button fix: yükleme/hidrasyon ekranı da header (top-left chevron) içermeli;
    // aksi halde kullanıcı yavaş ağda karşılaştırma ekranında sıkışıyor — geri dönecek
    // görünür kontrol yok. Pattern dosyadaki diğer 3 dönüş yolu ile birebir aynı.
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.headerBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Karşılaştır</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  // ── Same-product guard (refactor v2) ────────────────────────────────
  // Bir ürünü kendisiyle karşılaştırma anlamsız ve UI'yı bozar; bu
  // savunma katmanı tüm navigasyon kaynaklarını yakalar.
  if (params.idA && params.idB && String(params.idA) === String(params.idB)) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.headerBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Karşılaştır</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={[styles.center, { padding: 32 }]}>
          <Feather name="alert-circle" size={40} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.text, marginTop: 16, textAlign: "center", fontWeight: "600" }]}>
            Aynı ürünü kendisiyle karşılaştıramazsın.
          </Text>
          <Text style={[styles.loadingText, { color: colors.textMuted, marginTop: 8, textAlign: "center" }]}>
            Lütfen farklı bir ürün seç.
          </Text>
          <TouchableOpacity
            onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
            style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 10 }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Geri dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (pA && pB && categoryMismatch) {
    const nameA = normName(pA);
    const nameB = normName(pB);
    const catA = ((pA.category ?? (pA as any).kategori ?? "") as string).trim() || "Belirtilmemiş";
    const catB = ((pB.category ?? (pB as any).kategori ?? "") as string).trim() || "Belirtilmemiş";
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.headerBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Karşılaştır</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={[styles.center, { flex: 1, padding: 24 }]}>
          <View style={[styles.mismatchCard, { backgroundColor: colors.surfaceCard, borderColor: "#F59E0B40" }]}>
            <View style={[styles.mismatchIconWrap, { backgroundColor: "#FEF9C3" }]}>
              <Feather name="alert-triangle" size={28} color="#D97706" />
            </View>
            <Text style={[styles.mismatchTitle, { color: colors.text }]}>Farklı Kategori</Text>
            <Text style={[styles.mismatchMsg, { color: colors.textMuted }]}>
              Bu iki ürün farklı amaçlara hizmet ettiği için doğrudan karşılaştırılmıyor.
            </Text>
            <View style={[styles.mismatchProducts, { borderColor: colors.border }]}>
              <View style={styles.mismatchRow}>
                <View style={[styles.mismatchBadge, { backgroundColor: WINNER_A + "20" }]}>
                  <Text style={[styles.mismatchBadgeLetter, { color: WINNER_A }]}>A</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mismatchName, { color: colors.text }]} numberOfLines={2}>{nameA}</Text>
                  <Text style={[styles.mismatchCat, { color: colors.textMuted }]}>{catA}</Text>
                </View>
              </View>
              <View style={[styles.mismatchDivider, { backgroundColor: colors.border }]} />
              <View style={styles.mismatchRow}>
                <View style={[styles.mismatchBadge, { backgroundColor: WINNER_B + "20" }]}>
                  <Text style={[styles.mismatchBadgeLetter, { color: WINNER_B }]}>B</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mismatchName, { color: colors.text }]} numberOfLines={2}>{nameB}</Text>
                  <Text style={[styles.mismatchCat, { color: colors.textMuted }]}>{catB}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={[styles.mismatchBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
              <Feather name="arrow-left" size={16} color="#fff" />
              <Text style={styles.mismatchBtnText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (pA && pB && incompatible) {
    const nameA = normName(pA);
    const nameB = normName(pB);
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.headerBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Karşılaştır</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={[styles.center, { flex: 1, padding: 24 }]}>
          <View style={[styles.mismatchCard, { backgroundColor: colors.surfaceCard, borderColor: "#7C3AED40" }]}>
            <View style={[styles.mismatchIconWrap, { backgroundColor: "#EDE9FE" }]}>
              <Feather name="git-pull-request" size={28} color="#7C3AED" />
            </View>
            <Text style={[styles.mismatchTitle, { color: colors.text }]}>Uygun Eşleşme Değil</Text>
            <Text style={[styles.mismatchMsg, { color: colors.textMuted }]}>
              Bu iki ürün karşılaştırma için uygun değil. Aynı marka veya aynı ürünün boyut varyantı olabilir.
            </Text>
            <View style={[styles.mismatchProducts, { borderColor: colors.border }]}>
              <View style={styles.mismatchRow}>
                <View style={[styles.mismatchBadge, { backgroundColor: WINNER_A + "20" }]}>
                  <Text style={[styles.mismatchBadgeLetter, { color: WINNER_A }]}>A</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mismatchName, { color: colors.text }]} numberOfLines={2}>{nameA}</Text>
                </View>
              </View>
              <View style={[styles.mismatchDivider, { backgroundColor: colors.border }]} />
              <View style={styles.mismatchRow}>
                <View style={[styles.mismatchBadge, { backgroundColor: WINNER_B + "20" }]}>
                  <Text style={[styles.mismatchBadgeLetter, { color: WINNER_B }]}>B</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mismatchName, { color: colors.text }]} numberOfLines={2}>{nameB}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={[styles.mismatchBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
              <Feather name="arrow-left" size={16} color="#fff" />
              <Text style={styles.mismatchBtnText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!pA || !pB || !result) {
    // Empty-state gating (refactor v2): if either product id is present in
    // the route but the async hydration is still in flight (or hasn't even
    // had a chance to finish a single attempt), show a spinner instead of
    // flashing "Ürünler bulunamadı." Only render the missing-products
    // screen after a fully-finished attempt with still no pA/pB.
    const stillResolving =
      isHydratingProducts ||
      (!!params.idA && !!params.idB && !hydrationAttempted);
    if (stillResolving) {
      // Back-button fix: aynı sebep — hidrasyon devam ederken de header görünür kalsın.
      return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.headerBtn} activeOpacity={0.7}>
              <Feather name="chevron-left" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Karşılaştır</Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={[styles.center, { flex: 1 }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Yükleniyor...</Text>
          </View>
        </View>
      );
    }
    // Back-button fix: "Ürünler bulunamadı" empty state — header dahil edildi ki
    // dahili "Geri Dön" pill'inden bağımsız olarak top-left chevron her zaman erişilebilir olsun.
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.headerBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Karşılaştır</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <Feather name="alert-circle" size={36} color={colors.danger} />
          <Text style={[styles.errText, { color: colors.danger }]}>Ürünler bulunamadı.</Text>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={[styles.backPill, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // PERF (S1): Hero başlık/skor için kullanılan primitive'ler SADECE visualA/visualB'den
  // (light, HOME_FIELDS) türetilir. Bu sayede hidrasyon dolduğunda nameA/brandA/scoreA
  // değerleri hiç değişmez (alanlar zaten HOME_FIELDS'te var) ve top UI prop referansları
  // sabit kalır → hero kart yeniden render olmaz, görsel flicker olmaz.
  const heroVA = visualA ?? pA;
  const heroVB = visualB ?? pB;
  const scoreA = normScore(heroVA);
  const scoreB = normScore(heroVB);
  const nameA = normName(heroVA);
  const nameB = normName(heroVB);
  const brandA = normBrand(heroVA);
  const brandB = normBrand(heroVB);

  // ── Kazanan vurgusu ── getFinalProductScore ile tam skor karşılaştırması ──
  // pA/pB kullanır çünkü heavy alanlar (scores) varsa final skor onlar üzerinden
  // doğru hesaplansın; light fallback durumunda dermo_score zaten yeterli.
  const finalScoreA = getFinalProductScore(pA as any);
  const finalScoreB = getFinalProductScore(pB as any);
  const heroWinner: "A" | "B" | null =
    finalScoreA !== finalScoreB
      ? finalScoreA > finalScoreB ? "A" : "B"
      : null;

  // Note: finalDecisionSentence is hoisted above all conditional early
  // returns (search the file for "Final Decision Sentence") to keep the
  // hook order stable. heroWinner here is still used by hero UI below.

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} style={styles.headerBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Karşılaştır</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom() }]}>

        {/* ── Karar Rehberi özet şeridi — fromGuide=1 ile açıldığında görünür ─ */}
        {!!activeGuide && (
          <View style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 12,
            ...Platform.select({
              ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
              android: { elevation: 2 },
            }),
          }}>
            {/* Üst: ikon + etiket */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(67,56,202,0.10)", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                <Feather name="bar-chart-2" size={12} color="#4338CA" />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>Karar Rehberi</Text>
              {activeGuide.is_featured && (
                <View style={{ marginLeft: 8, backgroundColor: "rgba(184,115,51,0.12)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "#B87333" }}>Öne Çıkan</Text>
                </View>
              )}
            </View>

            {/* Başlık */}
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, lineHeight: 18, marginBottom: 4 }} numberOfLines={2}>
              {activeGuide.title}
            </Text>

            {/* Özet */}
            {!!activeGuide.short_summary && (
              <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 10 }}>
                {activeGuide.short_summary}
              </Text>
            )}

            {/* Temel farklar — UI-HIDE (refactor v1): kullanıcı talebi ile
                gizlendi. Veri/logic dokunulmadı; istenirse `false` → `true`. */}
            {!HIDE_TEMEL_FARKLAR && activeGuide.difference_points.length > 0 && (
              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Temel Farklar</Text>
                {activeGuide.difference_points.slice(0, 3).map((pt, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 5 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#4338CA", marginTop: 6, marginRight: 8, flexShrink: 0 }} />
                    <Text style={{ fontSize: 12, color: colors.text, lineHeight: 16, flex: 1 }}>{pt}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* En iyi kim için */}
            {(!!activeGuide.best_for_product_1 || !!activeGuide.best_for_product_2) && (
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                {!!activeGuide.best_for_product_1 && (
                  <Text style={{ fontSize: 11.5, color: colors.text, lineHeight: 15, marginBottom: 4 }}>
                    <Text style={{ fontWeight: "700" }}>A için: </Text>{activeGuide.best_for_product_1}
                  </Text>
                )}
                {!!activeGuide.best_for_product_2 && (
                  <Text style={{ fontSize: 11.5, color: colors.text, lineHeight: 15 }}>
                    <Text style={{ fontWeight: "700" }}>B için: </Text>{activeGuide.best_for_product_2}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Hero: İki Ürün Yan Yana */}
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceCard, borderColor: softBorder }]}>

          {/* ── Slot A ── */}
          <TouchableOpacity
            style={[
              styles.heroSlot,
              heroWinner === "A" && styles.heroSlotWinner,
            ]}
            onPress={() => goProduct(pA)}
            activeOpacity={0.8}
          >
            {heroWinner === "A" && (
              <View style={styles.heroWinnerBadge}>
                <Feather name="award" size={9} color="#7A8F6B" />
                <Text style={styles.heroWinnerText}>Önerilir</Text>
              </View>
            )}
            <View style={[styles.heroLetterBadge, { backgroundColor: WINNER_A + "18" }]}>
              <Text style={[styles.heroLetter, { color: WINNER_A }]}>A</Text>
            </View>
            {/* PERF (S1): ProductImage SADECE visualA (light, sabit referans) okur. */}
            {/* Visual fix v7 — image full mode (image_url öncelikli, daha keskin)
                + dinamik hero boyutu (winW'ye göre 150–200 arası ölçeklenir). */}
            <ProductImage imageUrl={resolveImageUrl(heroVA as any)} thumbnailUrl={resolveThumbnailUrl(heroVA as any)} mode="full" size={heroImgSize} borderRadius={20} style={styles.heroImage} />
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={2}>{nameA}</Text>
            <Text style={[styles.heroBrand, { color: colors.textMuted }]} numberOfLines={1}>{brandA}</Text>
            <HeroScoreChip score={scoreA} />
            {/* Helper hooks */}
            {result.ingredientAnalysisReliable && result.ingredientScoreBonus.a > result.ingredientScoreBonus.b && (
              <Text style={[styles.heroBonusNote, { color: colors.textMuted }]}>İçerik avantajı puanı destekledi.</Text>
            )}
            {result.safetyNotes.a.slice(0, 2).map((note, i) => (
              <SafetyNoteRow key={`sna-${i}`} note={note} />
            ))}
            {/* ── Özellik rozetleri — A ── */}
            {badgesA.length > 0 && (
              <View style={styles.heroBadgeArea}>
                {badgesA.map((b, i) => (
                  <View key={i} style={[
                    styles.heroBadgePill,
                    featureHint?.winner === "A" && styles.heroBadgePillWinner,
                  ]}>
                    <Text style={[styles.heroBadgePillText, featureHint?.winner === "A" && styles.heroBadgePillTextWinner]}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

          {/* ── × ── */}
          <View style={{ width: 36, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 26, fontWeight: "200", color: colors.textMuted, letterSpacing: -1, lineHeight: 30 }}>×</Text>
          </View>

          {/* ── Slot B ── */}
          <TouchableOpacity
            style={[
              styles.heroSlot,
              heroWinner === "B" && styles.heroSlotWinner,
            ]}
            onPress={() => goProduct(pB)}
            activeOpacity={0.8}
          >
            {heroWinner === "B" && (
              <View style={styles.heroWinnerBadge}>
                <Feather name="award" size={9} color="#7A8F6B" />
                <Text style={styles.heroWinnerText}>Önerilir</Text>
              </View>
            )}
            <View style={[styles.heroLetterBadge, { backgroundColor: WINNER_B + "18" }]}>
              <Text style={[styles.heroLetter, { color: WINNER_B }]}>B</Text>
            </View>
            {/* PERF (S1): ProductImage SADECE visualB (light, sabit referans) okur. */}
            {/* Visual fix v7 — image full mode + dinamik hero boyutu (bk. A). */}
            <ProductImage imageUrl={resolveImageUrl(heroVB as any)} thumbnailUrl={resolveThumbnailUrl(heroVB as any)} mode="full" size={heroImgSize} borderRadius={20} style={styles.heroImage} />
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={2}>{nameB}</Text>
            <Text style={[styles.heroBrand, { color: colors.textMuted }]} numberOfLines={1}>{brandB}</Text>
            <HeroScoreChip score={scoreB} />
            {result.ingredientAnalysisReliable && result.ingredientScoreBonus.b > result.ingredientScoreBonus.a && (
              <Text style={[styles.heroBonusNote, { color: colors.textMuted }]}>İçerik avantajı puanı destekledi.</Text>
            )}
            {result.safetyNotes.b.slice(0, 2).map((note, i) => (
              <SafetyNoteRow key={`snb-${i}`} note={note} />
            ))}
            {/* ── Özellik rozetleri — B ── */}
            {badgesB.length > 0 && (
              <View style={styles.heroBadgeArea}>
                {badgesB.map((b, i) => (
                  <View key={i} style={[
                    styles.heroBadgePill,
                    featureHint?.winner === "B" && styles.heroBadgePillWinner,
                  ]}>
                    <Text style={[styles.heroBadgePillText, featureHint?.winner === "B" && styles.heroBadgePillTextWinner]}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>

        </View>

        {/* ── Profil Uyarıları + Uyum Puanı — A & B yan yana ── */}
        {(warningsA.length > 0 || warningsB.length > 0) && (() => {
          const fsA = fitScoreLabel(fitScoreA);
          const fsB = fitScoreLabel(fitScoreB);
          return (
            <View style={{ paddingHorizontal: 12, paddingTop: 14 }}>
              <View style={{ flexDirection: "row" }}>
                {/* Kolon A */}
                <View style={{ flex: 1 }}>
                  {/* Fit score bandı — A */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fsA.color, marginRight: 5 }} />
                    <Text style={{ fontSize: 10.5, fontWeight: "700", color: fsA.color }}>{fsA.label}</Text>
                    <Text style={{ fontSize: 10.5, color: "#9CA3AF", marginLeft: 4 }}>{fitScoreA}/100</Text>
                  </View>
                  {warningsA.length > 0 && (
                    <ProductWarningList
                      warnings={warningsA}
                      compact
                      onAlternativesPress={pA ? () =>
                        router.push(`/product/similar?productId=${pA.id}` as any)
                      : undefined}
                    />
                  )}
                </View>
                <View style={{ width: 10 }} />
                {/* Kolon B */}
                <View style={{ flex: 1 }}>
                  {/* Fit score bandı — B */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fsB.color, marginRight: 5 }} />
                    <Text style={{ fontSize: 10.5, fontWeight: "700", color: fsB.color }}>{fsB.label}</Text>
                    <Text style={{ fontSize: 10.5, color: "#9CA3AF", marginLeft: 4 }}>{fitScoreB}/100</Text>
                  </View>
                  {warningsB.length > 0 && (
                    <ProductWarningList
                      warnings={warningsB}
                      compact
                      onAlternativesPress={pB ? () =>
                        router.push(`/product/similar?productId=${pB.id}` as any)
                      : undefined}
                    />
                  )}
                </View>
              </View>
            </View>
          );
        })()}

        {/* Hızlı Özet */}
        {result.summary.length > 0 && (
          <Section title="Hızlı Özet" icon="zap" color="#F59E0B" bg="#FFFBEB" isDark={false} colors={colors}>
            {result.summary.map((item, i) => (
              <SummaryRow key={i} item={item} nameA={nameA} nameB={nameB} colors={colors} />
            ))}
          </Section>
        )}

        {/* Sonuç — Final Decision Sentence (refactor v1, UI-only) */}
        <View style={styles.finalDecisionCard}>
          <Text style={styles.finalDecisionTitle}>Sonuç</Text>
          <Text style={styles.finalDecisionText} numberOfLines={2}>
            {finalDecisionSentence}
          </Text>
        </View>

        {/* Rozet Karşılaştırması — boş veya tamamen unknown ise zarif fallback */}
        <BadgeSectionOrFallback badges={unifiedBadges} summary={badgeAdvantage.summary} colors={colors} />

        {/* ── Aynı Güçlü Özellikler / Öne Çıkan Rozet Karar Kartı ──
            (refactor v1) Generic "İki ürün benzer özellikler taşıyor"
            metni gürültü sayılıyor; sadece net bir kazanan varken render. */}
        {featureHint && (featureHint.winner === "A" || featureHint.winner === "B") && (
          <FeatureHintCard
            hint={featureHint}
            nameA={nameA}
            nameB={nameB}
            colors={colors}
            badgeReason={
              featureReason && featureReason.side === featureHint.winner
                ? featureReason.text
                : null
            }
          />
        )}

        {/* Cilt Tipi Uygunluğu */}
        {result.skinTypes.some((r) => r.a !== "neutral" || r.b !== "neutral") && (
          <Section title="Cilt Tipi Uygunluğu" icon="users" color="#0891B2" bg="#E0F7FA" isDark={false} colors={colors}>
            <View style={styles.badgeHeaderRow}>
              <View style={{ flex: 1 }} />
              <View style={[styles.badgeColHead, { backgroundColor: WINNER_A + "20" }]}><Text style={[styles.badgeColHeadText, { color: WINNER_A }]}>A</Text></View>
              <View style={[styles.badgeColHead, { backgroundColor: WINNER_B + "20" }]}><Text style={[styles.badgeColHeadText, { color: WINNER_B }]}>B</Text></View>
            </View>
            {result.skinTypes.map((row) => (
              <View key={row.type} style={styles.skinRow}>
                <Text style={[styles.skinLabel, { color: colors.text }]}>{row.label}</Text>
                <SkinCell val={row.a} />
                <SkinCell val={row.b} />
              </View>
            ))}
            <View style={styles.skinLegend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#EAF1EA" }]} /><Text style={[styles.legendText, { color: colors.textMuted }]}>Uyumlu</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#FEF9C3" }]} /><Text style={[styles.legendText, { color: colors.textMuted }]}>Dikkat</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#F3F4F6" }]} /><Text style={[styles.legendText, { color: colors.textMuted }]}>Nötr</Text></View>
            </View>
          </Section>
        )}

        {/* ── Temel Fark / Karar Rehberi ──
            (refactor v1) UI-HIDE flag ile gizlendi; hesaplama korunuyor. */}
        {!HIDE_TEMEL_FARK_INSIGHT && insight && (
          <CoreDifferenceCard insight={insight} nameA={nameA} nameB={nameB} colors={colors} />
        )}

        {/* Ortak Özellikler — Rozet Karşılaştırması ile tekrar oluşturduğu için gizlendi */}
        {false && result.shared.filter((f) =>
          f.label &&
          typeof f.label === "string" &&
          !f.label.includes("undefined") &&
          !f.label.includes("null") &&
          f.label.trim() !== ""
        ).length > 0 && (
          <Section title="Ortak Özellikler" icon="link" color="#7A8F6B" bg="#EAF1EA" isDark={false} colors={colors}>
            {result.shared
              .filter((f) =>
                f.label &&
                typeof f.label === "string" &&
                !f.label.includes("undefined") &&
                !f.label.includes("null") &&
                f.label.trim() !== ""
              )
              .map((f, i) => (
                <FeatureRow key={i} icon={f.icon} label={f.label} accent="#7A8F6B" colors={colors} />
              ))}
          </Section>
        )}

        {/* Farklı Özellikler — UI-HIDE (refactor v1): kullanıcı talebi ile
            gizlendi. Hesaplama/diff/commentary mantığı korunuyor;
            istenirse `false &&` kaldırılarak geri açılır. */}
        {!HIDE_FARKLI_OZELLIKLER && (result.different.length > 0 || result.ingredientDiffNotes.length > 0 || commentary.length > 0) && (
          <Section title="Farklı Özellikler" icon="git-branch" color="#DC2626" bg="#FEF2F2" isDark={false} colors={colors}>
            {/* ── Eczacı İçgörüleri — önce ── */}
            <FeatureInsightsBlock
              commentary={commentary}
              hasDiffs={result.different.length > 0 || result.ingredientDiffNotes.length > 0}
              colors={colors}
            />
            {/* ── Diff tablosu (akıllı birleştirme ile) ── */}
            {mergeIngredientAvoidDiffs(
              result.different.filter((f) =>
                f.label &&
                typeof f.label === "string" &&
                !f.label.includes("undefined") &&
                !f.label.includes("null") &&
                f.label.trim() !== ""
              )
            ).map((f, i) => (
              <MergedDiffRow key={i} item={f} colors={colors} />
            ))}
            {result.ingredientDiffNotes.length > 0 && (
              <>
                {result.different.length > 0 && (
                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6, opacity: 0.5 }} />
                )}
                {result.ingredientDiffNotes.slice(0, 4).map((note, i) => (
                  <IngredientNoteRow key={`inote-${i}`} note={note} colors={colors} />
                ))}
              </>
            )}
          </Section>
        )}

        {/* Eczacı Yorumu */}
        <PharmacistComment
          nameA={nameA}
          nameB={nameB}
          heroWinner={heroWinner}
          finalScoreA={finalScoreA}
          finalScoreB={finalScoreB}
          skinTypes={result.skinTypes}
          different={result.different}
          colors={colors}
        />

        {/* ── Kime Daha Uygun? ── */}
        {insight && (
          <WhoIsItForCard insight={insight} nameA={nameA} nameB={nameB} colors={colors} override={whoOverride} />
        )}

        {/* ── Rutinde Yeri ── */}
        {insight && (
          <RoutineRoleCard insight={insight} nameA={nameA} nameB={nameB} colors={colors} />
        )}

        {/* Dermatolojik Değerlendirme — UI-HIDE (refactor v1): kullanıcı
            talebi ile gizlendi. result.verdict üretimi olduğu gibi duruyor;
            istenirse `false &&` kaldırılarak geri açılır. */}
        {!HIDE_DERMATOLOJIK && result.verdict.length > 0 && (
          <View style={[styles.verdictCard, { backgroundColor: "#1E293B", borderColor: "#334155" }]}>
            <View style={styles.verdictHeader}>
              <Feather name="check-circle" size={16} color="#60A5FA" />
              <Text style={styles.verdictTitle}>Dermatolojik Değerlendirme</Text>
            </View>
            {result.verdict.map((v, i) => (
              <View key={i} style={styles.verdictRow}>
                <View style={styles.verdictBullet} />
                <Text style={styles.verdictText}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Karar Özeti ── */}
        {insight && (
          <DecisionSummaryCard insight={insight} nameA={nameA} nameB={nameB} colors={colors} />
        )}

        {/* ── Soft Conversion Hook: "Daha net karar için" ── */}
        {!isSeckin && (
          <ComparisonSoftHook nameA={nameA} nameB={nameB} heroWinner={heroWinner} colors={colors} />
        )}

        {/* İçerik verisi sınırlıysa soluk bilgi notu */}
        {!result.ingredientAnalysisReliable && (
          <View style={[styles.reliabilityNote, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.textMuted} style={{ marginTop: 1, flexShrink: 0 }} />
            <Text style={[styles.reliabilityNoteText, { color: colors.textMuted }]}>
              İçerik bilgisi sınırlı olduğu için değerlendirme temel ürün verileriyle yapıldı.
            </Text>
          </View>
        )}

        {/* İçerik Karşılaştırması */}
        <IngredientsSection result={result.ingredients} nameA={nameA} nameB={nameB} colors={colors} />

      </ScrollView>
    </View>
  );
}

/* ─── Alt Bileşenler ─── */

// ── Özellik Rozeti Karar Kartı ───────────────────────────────────────────────
function FeatureHintCard({ hint, nameA, nameB, colors, badgeReason }: {
  hint: FeatureHint; nameA: string; nameB: string; colors: any; badgeReason?: string | null;
}) {
  const winnerName  = hint.winner === "A" ? nameA : hint.winner === "B" ? nameB : null;
  const winnerColor = hint.winner === "A" ? WINNER_A : hint.winner === "B" ? WINNER_B : "#7A8F6B";

  const label = winnerName
    ? "öne çıkan"
    : "aynı güçlü özellikler";

  const body = winnerName
    ? `${winnerName} bu kategoride öne çıkıyor`
    : "İki ürün benzer özellikler taşıyor";

  return (
    <View style={[styles.fhCard, { borderColor: winnerColor + "40", backgroundColor: winnerColor + "0C" }]}>
      {/* Başlık satırı */}
      <View style={styles.fhHeader}>
        <View style={[styles.fhIconWrap, { backgroundColor: winnerColor + "20" }]}>
          <Feather name={winnerName ? "star" : "check-circle"} size={12} color={winnerColor} />
        </View>
        <Text style={[styles.fhTitle, { color: winnerColor }]}>{label}</Text>
        {winnerName && (
          <View style={[styles.fhWinnerPill, { backgroundColor: winnerColor + "20" }]}>
            <Text style={[styles.fhWinnerLetter, { color: winnerColor }]}>
              {hint.winner}
            </Text>
          </View>
        )}
      </View>

      {/* Açıklama */}
      <Text style={[styles.fhBody, { color: colors.text }]}>{body}</Text>

      {/* Badge-driven tek cümlelik gerekçe (refactor v5) */}
      {badgeReason ? (
        <Text style={[styles.fhBody, { color: colors.textMuted, fontStyle: "italic", marginTop: 4 }]}>
          {badgeReason}
        </Text>
      ) : null}

      {/* Öne çıkan rozet(ler) */}
      {hint.excText !== "aynı güçlü özellikler" && (
        <View style={styles.fhBadgeRow}>
          {(hint.winner === "A" ? hint.excA : hint.excB).map((b, i) => (
            <View key={i} style={[styles.fhBadgePill, { backgroundColor: winnerColor + "18", borderColor: winnerColor + "40" }]}>
              <Text style={[styles.fhBadgePillText, { color: winnerColor }]}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Section({ title, icon, color, bg, isDark, colors, children }: {
  title: string; icon: string; color: string; bg: string; isDark: boolean; colors: any; children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: bg }]}>
          <Feather name={icon as any} size={13} color={color} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function SummaryRow({ item, nameA, nameB, colors }: { item: ComparisonSummaryItem; nameA: string; nameB: string; colors: any }) {
  const bg = item.winner === "A" ? WINNER_A + "15" : item.winner === "B" ? WINNER_B + "15" : "#F9FAFB";
  const borderColor = item.winner === "A" ? WINNER_A + "40" : item.winner === "B" ? WINNER_B + "40" : colors.border;
  const winnerText = item.winner === "A" ? `→ ${nameA}` : item.winner === "B" ? `→ ${nameB}` : "→ Eşit";
  const winnerColor = item.winner === "A" ? WINNER_A : item.winner === "B" ? WINNER_B : TIE_CLR;
  return (
    <View style={[styles.summaryRow, { backgroundColor: bg, borderColor }]}>
      <View style={styles.summaryLeft}>
        <Feather name={item.icon as any} size={16} color={winnerColor} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>{item.label}</Text>
          <Text style={[styles.summaryDetail, { color: colors.textMuted }]}>{item.detail}</Text>
        </View>
      </View>
      <Text style={[styles.summaryWinner, { color: winnerColor }]}>{winnerText}</Text>
    </View>
  );
}

function FeatureRow({ icon, label, accent, colors }: { icon: string; label: string; accent: string; colors: any }) {
  return (
    <View style={styles.featureRow}>
      <Feather name={icon as any} size={13} color={accent} />
      <Text style={[styles.featureText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function DiffRow({ item, nameA, nameB, colors }: { item: DiffFeature; nameA: string; nameB: string; colors: any }) {
  const winnerColor = item.winner === "A" ? WINNER_A : item.winner === "B" ? WINNER_B : TIE_CLR;
  return (
    <View style={[styles.diffRow, { borderLeftColor: winnerColor }]}>
      <Feather name={item.icon as any} size={13} color={winnerColor} style={{ marginTop: 2 }} />
      <Text style={[styles.diffText, { color: colors.text }]}>{item.label}</Text>
    </View>
  );
}

// ── Intelligent Attribute Merge ─────────────────────────────────────────────
// Detects repeated "X avantajlı çünkü [keyword] içermiyor" entries per winner
// and collapses them into one natural Turkish sentence.

type MergedDiff = DiffFeature & { keywords?: string[] };

const ICERMIYOR_RE = /^(.+?) avantajlı çünkü (.+?) içermiyor/;

function mergeIngredientAvoidDiffs(items: DiffFeature[]): MergedDiff[] {
  const groupMap = new Map<string, { winnerName: string; winner: "A" | "B" | null; icon: string; keywords: string[]; origItems: DiffFeature[] }>();
  const ordered: Array<{ key: string | null; item: DiffFeature }> = [];

  for (const item of items) {
    const m = ICERMIYOR_RE.exec(item.label);
    if (m) {
      const winnerName = m[1];
      const keyword = m[2];
      const groupKey = `${item.winner ?? "null"}||${winnerName}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { winnerName, winner: item.winner, icon: item.icon, keywords: [], origItems: [] });
        ordered.push({ key: groupKey, item });
      }
      const g = groupMap.get(groupKey)!;
      if (!g.keywords.includes(keyword)) g.keywords.push(keyword);
      g.origItems.push(item);
    } else {
      ordered.push({ key: null, item });
    }
  }

  // Deduplicate — each groupKey appears only at its first occurrence position
  const seen = new Set<string>();
  const result: MergedDiff[] = [];

  for (const { key, item } of ordered) {
    if (key === null) {
      result.push(item as MergedDiff);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const g = groupMap.get(key)!;
    const { winnerName, winner, icon, keywords } = g;

    let kwPhrase: string;
    if (keywords.length === 1) {
      kwPhrase = keywords[0];
    } else if (keywords.length === 2) {
      kwPhrase = `${keywords[0]} ve ${keywords[1]}`;
    } else {
      kwPhrase = keywords.slice(0, -1).join(", ") + " ve " + keywords[keywords.length - 1];
    }

    const label = `${winnerName} avantajlı çünkü ${kwPhrase} içermiyor — daha temiz formül sunar.`;
    result.push({ icon, label, winner, keywords });
  }

  return result;
}

// ── Vurgulama: aktif madde adları + sayısal pattern'ler ───────────────────
const ALWAYS_HIGHLIGHT_TERMS: string[] = [
  "paraben", "alkol", "parfüm", "parfum", "silikon", "sülfat", "sulfat",
  "niacinamide", "niasinamid", "BHA", "AHA", "PHA",
  "çinko", "cinko", "salisilik asit", "salisilik",
  "retinol", "retinal", "seramid", "ceramide",
  "hyaluronik asit", "hyaluronik", "hyaluronic",
];

const NUMBER_PATTERNS: RegExp[] = [
  /\b\d+(?:[.,]\d+)?\s*puan\b/gi,
  /\b\d+(?:[.,]\d+)?\s*₺/g,
  /%\s?\d+(?:[.,]\d+)?/g,
  /\b\d+(?:[.,]\d+)?\s*ml\b/gi,
];

type Hit = { start: number; end: number };

function findHighlightHits(text: string, keywords: string[]): Hit[] {
  const hits: Hit[] = [];
  // FIX (highlight off-by-one): Varsayılan `String#toLowerCase()` Türkçe
  // `İ` (U+0130) harfini "i\u0307" (i + birleşik nokta) — YANİ 2 KARAKTER —
  // şeklinde dönüştürür. Sonuç: `lower.indexOf(k)` ile bulunan pozisyon
  // orijinal `text` içindeki pozisyondan +1 kayar; `text.slice(i, i+len)`
  // ilk harfi atlayıp sondan bir karakter taşırır → "Silikon" yerine
  // "ilikon " vurgulanır. Çözüm: Türkçe locale'iyle lowercase — bu varyant
  // İ → "i" ve I → "ı" tek karaktere indirger, pozisyon hizalı kalır.
  const lower = text.toLocaleLowerCase("tr");
  const isWordChar = (ch: string | undefined): boolean =>
    !!ch && /[a-zçğıöşü0-9]/i.test(ch);

  // 1) Çağıran tarafından sağlanan keyword'ler (substring eşleşmesi)
  for (const kw of keywords ?? []) {
    if (!kw) continue;
    const k = kw.toLocaleLowerCase("tr");
    let from = 0;
    while (true) {
      const i = lower.indexOf(k, from);
      if (i === -1) break;
      hits.push({ start: i, end: i + k.length });
      from = i + k.length;
    }
  }

  // 2) Always-on aktif madde terimleri (kelime sınırlı)
  for (const t of ALWAYS_HIGHLIGHT_TERMS) {
    const k = t.toLocaleLowerCase("tr");
    let from = 0;
    while (true) {
      const i = lower.indexOf(k, from);
      if (i === -1) break;
      const prev = i > 0 ? lower[i - 1] : undefined;
      const next = i + k.length < lower.length ? lower[i + k.length] : undefined;
      if (!isWordChar(prev) && !isWordChar(next)) {
        hits.push({ start: i, end: i + k.length });
      }
      from = i + k.length;
    }
  }

  // 3) Sayısal pattern'ler (orijinal text üstünde)
  for (const re of NUMBER_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // Çakışan/iç içe vurguları birleştir
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Hit[] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.start < last.end) {
      if (h.end > last.end) last.end = h.end;
    } else {
      merged.push({ ...h });
    }
  }
  return merged;
}

function buildHighlightParts(text: string, keywords: string[], accent: string): React.ReactNode[] {
  const hits = findHighlightHits(text, keywords);
  if (hits.length === 0) return [text];
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = 0;
  for (const h of hits) {
    if (h.start > cursor) parts.push(<Text key={`p${idx++}`}>{text.slice(cursor, h.start)}</Text>);
    parts.push(
      <Text key={`k${idx++}`} style={{ fontWeight: "700", color: accent }}>
        {text.slice(h.start, h.end)}
      </Text>,
    );
    cursor = h.end;
  }
  if (cursor < text.length) parts.push(<Text key={`p${idx++}`}>{text.slice(cursor)}</Text>);
  return parts;
}

function MergedDiffRow({ item, colors }: { item: MergedDiff; colors: any }) {
  const winnerColor = item.winner === "A" ? WINNER_A : item.winner === "B" ? WINNER_B : TIE_CLR;
  const parts = buildHighlightParts(item.label, item.keywords ?? [], winnerColor);
  return (
    <View style={[styles.diffRow, { borderLeftColor: winnerColor }]}>
      <Feather name={item.icon as any} size={13} color={winnerColor} style={{ marginTop: 2 }} />
      <Text style={[styles.diffText, { color: colors.text }]}>{parts}</Text>
    </View>
  );
}
// ── End Intelligent Attribute Merge ─────────────────────────────────────────

function IngredientNoteRow({ note, colors }: { note: string; colors: any }) {
  // Aktif madde adlarını ve sayısal değerleri otomatik vurgula.
  const parts = buildHighlightParts(note, [], "#0E7490");
  return (
    <View style={styles.ingredientNoteRow}>
      <View style={styles.ingredientNoteIcon}>
        <Feather name="droplet" size={11} color="#0891B2" />
      </View>
      <Text style={[styles.ingredientNoteText, { color: colors.text }]}>{parts}</Text>
    </View>
  );
}

function SafetyNoteRow({ note }: { note: string }) {
  return (
    <View style={styles.safetyNoteRow}>
      <Feather name="alert-triangle" size={10} color="#D97706" style={{ marginTop: 1, flexShrink: 0 }} />
      <Text style={styles.safetyNoteText}>{note}</Text>
    </View>
  );
}

function buildPharmacistText(
  nameA: string,
  nameB: string,
  heroWinner: "A" | "B" | null,
  finalScoreA: number,
  finalScoreB: number,
  skinTypes: SkinTypeRow[],
  different: DiffFeature[],
): string {
  const scoreDiff = Math.abs(finalScoreA - finalScoreB);
  const winnerName = heroWinner === "A" ? nameA : heroWinner === "B" ? nameB : null;

  // Belirgin kazanan — 10+ puan fark
  if (winnerName && scoreDiff >= 10) {
    return `Bu karşılaştırmada ${winnerName}, içerik ve genel performans açısından daha dengeli bir tercih.`;
  }

  // Hassas cilt uyumu farkı varsa
  const hassas = skinTypes.find((s) => s.type === "hassas");
  if (hassas) {
    if (hassas.a === "good" && hassas.b !== "good") {
      return `Hassas ciltler için ${nameA} daha güvenli. Daha güçlü etki arayanlar ${nameB}'i değerlendirebilir.`;
    }
    if (hassas.b === "good" && hassas.a !== "good") {
      return `Hassas ciltler için ${nameB} daha güvenli. Daha güçlü etki arayanlar ${nameA}'i değerlendirebilir.`;
    }
  }

  // Yakın kazanan — küçük puan farkı
  if (winnerName && scoreDiff > 0) {
    return `İki ürün birbirine çok yakın. ${winnerName} puanlama açısından hafif ileride — seçim şahsî ihtiyaca göre yapılmalı.`;
  }

  // Fiyat farkı varsa bütçe tavsiyesi
  const priceDiff = different.find((d) => d.icon === "dollar-sign");
  if (priceDiff?.winner) {
    const cheaperName = priceDiff.winner === "A" ? nameA : nameB;
    return `İki ürün de benzer performansta. Bütçeye göre tercih yapılacaksa ${cheaperName} daha uygun.`;
  }

  // Beraberlik
  return "İki ürün de benzer seviyede. Seçim cilt tipine ve kullanım amacına göre yapılmalı.";
}

function PharmacistComment({ nameA, nameB, heroWinner, finalScoreA, finalScoreB, skinTypes, different, colors }: {
  nameA: string; nameB: string; heroWinner: "A" | "B" | null;
  finalScoreA: number; finalScoreB: number;
  skinTypes: SkinTypeRow[]; different: DiffFeature[]; colors: any;
}) {
  // Premium gating (refactor v2):
  //  • Seçkin (premium) kullanıcı: tam metin, CTA YOK, modal HİÇ render edilmez.
  //  • Free kullanıcı: SADECE 1. cümle + "Daha fazlasını gör" CTA → modal.
  // buildPharmacistText'e dokunulmadı. Sadece görsel kısaltma.
  // Kaynak: AuthContext.isSeckin (canonical, app genelinde aynı flag).
  const { isSeckin } = useAuth();
  const isPremiumUser = isSeckin === true;
  const fullText = buildPharmacistText(nameA, nameB, heroWinner, finalScoreA, finalScoreB, skinTypes, different);
  const firstSentenceMatch = fullText.match(/[^.!?]+[.!?]+/);
  const shortText = firstSentenceMatch ? firstSentenceMatch[0].trim() : fullText;
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const text = isPremiumUser ? fullText : shortText;
  if (__DEV__) {
    // Tek seferlik tanılama; production build'de soyutlanır.
    // eslint-disable-next-line no-console
    console.log("[premium-gate]", { isPremiumUser, isSeckin });
  }
  return (
    <View style={styles.pharmacistCard}>
      <View style={styles.pharmacistHeader}>
        <View style={styles.pharmacistIconWrap}>
          <Feather name="book-open" size={14} color="#92400E" />
        </View>
        <Text style={styles.pharmacistTitle}>Eczacı Yorumu</Text>
      </View>
      <Text style={styles.pharmacistText}>{text}</Text>
      {!isPremiumUser && shortText !== fullText && (
        <TouchableOpacity
          onPress={() => setShowPremiumModal(true)}
          activeOpacity={0.7}
          style={styles.premiumCtaRow}
        >
          <Feather name="lock" size={12} color="#92400E" />
          <Text style={styles.premiumCtaText}>Daha fazlasını gör</Text>
          <Feather name="chevron-right" size={14} color="#92400E" />
        </TouchableOpacity>
      )}
      {!isPremiumUser && (
        <PremiumGateModal
          visible={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
        />
      )}
    </View>
  );
}

// ── PremiumGateModal (refactor v1) ────────────────────────────────────────
// Sadece UI. Navigation/payment YOK — şimdilik kapanır.
function PremiumGateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.premiumModalBackdrop} onPress={onClose}>
        <Pressable style={styles.premiumModalCard} onPress={() => { /* no-op, içeride kapanmasın */ }}>
          <View style={styles.premiumModalIconWrap}>
            <Feather name="award" size={22} color="#92400E" />
          </View>
          <Text style={styles.premiumModalTitle}>Daha akıllı kararlar için</Text>
          <Text style={styles.premiumModalBody}>
            Cilt tipine özel detaylı analizleri ve risk değerlendirmelerini
            görmek için Seçkin Üyeliğe geç.
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.premiumModalButton}>
            <Text style={styles.premiumModalButtonText}>Seçkin üyeliği dene</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.premiumModalDismiss}>
            <Text style={styles.premiumModalDismissText}>Şimdi değil</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── CoreDifferenceCard ────────────────────────────────────────────────────
function CoreDifferenceCard({ insight, nameA, nameB, colors }: {
  insight: ComparisonInsight; nameA: string; nameB: string; colors: any;
}) {
  return (
    <View style={[styles.insightCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightIconWrap, { backgroundColor: "#FEF9C3" }]}>
          <Feather name="git-merge" size={13} color="#D97706" />
        </View>
        <Text style={[styles.insightTitle, { color: colors.text }]}>Temel fark</Text>
      </View>
      <Text style={[styles.insightBody, { color: colors.text }]}>{insight.coreDifference}</Text>
      {insight.concernNote && (
        <View style={[styles.insightNote, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
          <Feather name="compass" size={11} color="#2563EB" style={{ marginTop: 1, flexShrink: 0 }} />
          <Text style={[styles.insightNoteText, { color: "#1D4ED8" }]}>{insight.concernNote}</Text>
        </View>
      )}
      {insight.warningNote && (
        <View style={[styles.insightNote, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
          <Feather name="alert-triangle" size={11} color="#D97706" style={{ marginTop: 1, flexShrink: 0 }} />
          <Text style={[styles.insightNoteText, { color: "#92400E" }]}>{insight.warningNote}</Text>
        </View>
      )}
    </View>
  );
}

// ── FeatureInsightsBlock ──────────────────────────────────────────────────
// Eczacı yorumlarını "Farklı Özellikler" bölümünde, tablo ÜSTÜNDE gösterir.

const FI_ICONS: Record<number, { name: "info" | "check-circle" | "alert-circle"; color: string }> = {
  0: { name: "info",          color: "#4B7A5C" },
  1: { name: "check-circle",  color: "#6B7280" },
  2: { name: "alert-circle",  color: "#8B6914" },
};

function InsightRow({ text, idx, colors }: { text: string; idx: number; colors: any }) {
  const ic = FI_ICONS[idx] ?? FI_ICONS[0];
  return (
    <View style={[styles.fiRow, { backgroundColor: colors.surface }]}>
      <Feather name={ic.name} size={13} color={ic.color} style={styles.fiIcon} />
      <Text style={[styles.fiText, { color: colors.text }]}>
        {text}
      </Text>
    </View>
  );
}

function FeatureInsightsBlock({
  commentary,
  hasDiffs,
  colors,
}: {
  commentary: string[];
  hasDiffs: boolean;
  colors: any;
}) {
  const FALLBACK =
    "Her iki ürün benzer özellikler sunar. Seçim cilt tipine göre yapılmalıdır.";
  const lines = commentary.length > 0 ? commentary.slice(0, 3) : [FALLBACK];

  return (
    <View style={styles.fiBlock}>
      {/* Başlık rozeti */}
      <View style={styles.fiHeader}>
        <View style={styles.fiHeaderPill}>
          <Feather name="activity" size={10} color="#7A8F6B" />
          <Text style={styles.fiLabel}>Eczacı yorumladı</Text>
        </View>
      </View>
      {/* İçgörü satırları */}
      <View style={styles.fiRows}>
        {lines.map((text, i) => (
          <InsightRow key={i} idx={i} text={text} colors={colors} />
        ))}
      </View>
      {/* Divider — altta, tablo başlamadan önce */}
      {hasDiffs && (
        <View style={[styles.fiDivider, { backgroundColor: colors.border }]} />
      )}
    </View>
  );
}

// ── WhoIsItForCard ────────────────────────────────────────────────────────
function WhoIsItForCard({ insight, nameA, nameB, colors, override }: {
  insight: ComparisonInsight; nameA: string; nameB: string; colors: any;
  override?: { whoA: string; whoB: string } | null;
}) {
  const shortA = nameA.split(" ").slice(0, 2).join(" ");
  const shortB = nameB.split(" ").slice(0, 2).join(" ");
  // (refactor v5) Eğer purpose engine her iki tarafa AYNI cümleyi
  // ürettiyse (duplikasyon), parent'tan gelen badge-tabanlı override
  // ile farklılaştırılır. Override yoksa orijinal davranış korunur.
  const whoA = override?.whoA ?? insight.whoA;
  const whoB = override?.whoB ?? insight.whoB;
  return (
    <View style={[styles.insightCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightIconWrap, { backgroundColor: "#EAF1EA" }]}>
          <Feather name="users" size={13} color="#7A8F6B" />
        </View>
        <Text style={[styles.insightTitle, { color: colors.text }]}>Kime daha uygun?</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={[styles.whoSlot, { backgroundColor: WINNER_A + "10", borderColor: WINNER_A + "30" }]}>
          <View style={[styles.whoLetterBadge, { backgroundColor: WINNER_A + "20" }]}>
            <Text style={[styles.whoLetter, { color: WINNER_A }]}>A</Text>
          </View>
          <Text style={[styles.whoName, { color: colors.textMuted }]} numberOfLines={1}>{shortA}</Text>
          <Text style={[styles.whoDesc, { color: colors.text }]}>{whoA}</Text>
        </View>
        <View style={[styles.whoSlot, { backgroundColor: WINNER_B + "10", borderColor: WINNER_B + "30" }]}>
          <View style={[styles.whoLetterBadge, { backgroundColor: WINNER_B + "20" }]}>
            <Text style={[styles.whoLetter, { color: WINNER_B }]}>B</Text>
          </View>
          <Text style={[styles.whoName, { color: colors.textMuted }]} numberOfLines={1}>{shortB}</Text>
          <Text style={[styles.whoDesc, { color: colors.text }]}>{whoB}</Text>
        </View>
      </View>
    </View>
  );
}

// ── RoutineRoleCard ───────────────────────────────────────────────────────
function RoutineRoleCard({ insight, nameA, nameB, colors }: {
  insight: ComparisonInsight; nameA: string; nameB: string; colors: any;
}) {
  const shortA = nameA.split(" ").slice(0, 2).join(" ");
  const shortB = nameB.split(" ").slice(0, 2).join(" ");
  return (
    <View style={[styles.insightCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightIconWrap, { backgroundColor: "#EDE9FE" }]}>
          <Feather name="clock" size={13} color="#7C3AED" />
        </View>
        <Text style={[styles.insightTitle, { color: colors.text }]}>Rutinde yeri</Text>
      </View>
      <View style={{ gap: 8 }}>
        <View style={[styles.routineRow, { borderLeftColor: WINNER_A, backgroundColor: WINNER_A + "08" }]}>
          <Text style={[styles.routineLabel, { color: WINNER_A }]}>{shortA}</Text>
          <Text style={[styles.routineStep, { color: colors.text }]}>{insight.routineStepA}</Text>
        </View>
        <View style={[styles.routineRow, { borderLeftColor: WINNER_B, backgroundColor: WINNER_B + "08" }]}>
          <Text style={[styles.routineLabel, { color: WINNER_B }]}>{shortB}</Text>
          <Text style={[styles.routineStep, { color: colors.text }]}>{insight.routineStepB}</Text>
        </View>
      </View>
    </View>
  );
}

// ── DecisionSummaryCard ───────────────────────────────────────────────────
function DecisionSummaryCard({ insight, nameA, nameB, colors }: {
  insight: ComparisonInsight; nameA: string; nameB: string; colors: any;
}) {
  const winnerColor = insight.decisionWinner === "A" ? WINNER_A : insight.decisionWinner === "B" ? WINNER_B : "#7A8F6B";
  const winnerIcon = insight.decisionWinner === "tie" ? "check-circle" : "award";
  return (
    <View style={[styles.decisionCard, { borderColor: winnerColor + "40" }]}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightIconWrap, { backgroundColor: winnerColor + "20" }]}>
          <Feather name={winnerIcon as any} size={13} color={winnerColor} />
        </View>
        <Text style={[styles.insightTitle, { color: "#fff" }]}>Karar özeti</Text>
      </View>
      <Text style={[styles.decisionText]}>{insight.decisionSummary}</Text>
    </View>
  );
}

function IngredientsSection({ result, nameA, nameB, colors }: {
  result: IngredientComparisonResult; nameA: string; nameB: string; colors: any;
}) {
  // EH-HIDE · Anlamlı içerik verisi yoksa bölümü TAMAMEN gizle.
  // Veri kriteri: en az bir bileşen listesi (common/onlyA/onlyB) dolu OLMALI
  // veya en az bir tarafta yüksek risk sayacı bulunmalı. Aksi halde placeholder
  // kart yerine null dön; başlık + "henüz hazırlanıyor" metni hiç render olmaz.
  const hasIngredientLists =
    result.common.length > 0 || result.onlyA.length > 0 || result.onlyB.length > 0;
  const hasRiskSignal = result.riskA.high > 0 || result.riskB.high > 0;
  const hasIngredientData = hasIngredientLists || hasRiskSignal;
  if (!hasIngredientData) {
    return null;
  }

  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: "#FEF3C7" }]}>
          <Feather name="layers" size={13} color="#D97706" />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>İçerik Karşılaştırması</Text>
      </View>

      {/* Risk Sayacı */}
      <View style={styles.riskRow}>
        <RiskBlock label={nameA} riskA={result.riskA} color={WINNER_A} colors={colors} />
        <View style={[styles.riskDivider, { backgroundColor: colors.border }]} />
        <RiskBlock label={nameB} riskA={result.riskB} color={WINNER_B} colors={colors} />
      </View>

      {result.common.length > 0 && (
        <IngBlock title="Ortak İçerikler" count={result.common.length} color="#7A8F6B" bg="#EAF1EA" items={prioritizeIngredients(result.common, 10)} showMore={result.common.length > 10} colors={colors} />
      )}
      {result.onlyA.length > 0 && (
        <IngBlock title={`Yalnızca ${nameA}`} count={result.onlyA.length} color={WINNER_A} bg={WINNER_A + "15"} items={prioritizeIngredients(result.onlyA, 8)} showMore={result.onlyA.length > 8} colors={colors} />
      )}
      {result.onlyB.length > 0 && (
        <IngBlock title={`Yalnızca ${nameB}`} count={result.onlyB.length} color={WINNER_B} bg={WINNER_B + "15"} items={prioritizeIngredients(result.onlyB, 8)} showMore={result.onlyB.length > 8} colors={colors} />
      )}
    </View>
  );
}

function RiskBlock({ label, riskA, color, colors }: { label: string; riskA: { high: number; medium: number; low: number; safe: number }; color: string; colors: any }) {
  return (
    <View style={styles.riskBlock}>
      <Text style={[styles.riskBlockLabel, { color }]} numberOfLines={1}>{label}</Text>
      <RiskBadge count={riskA.high} label="Yüksek Risk" color="#DC2626" bg="#FEE2E2" />
      <RiskBadge count={riskA.medium} label="Orta Risk" color="#D97706" bg="#FEF9C3" />
      <RiskBadge count={riskA.low} label="Düşük Risk" color="#0891B2" bg="#E0F7FA" />
      <RiskBadge count={riskA.safe} label="Güvenli" color="#7A8F6B" bg="#EAF1EA" />
    </View>
  );
}

function RiskBadge({ count, label, color, bg }: { count: number; label: string; color: string; bg: string }) {
  if (count === 0) return null;
  return (
    <View style={[styles.riskBadge, { backgroundColor: bg }]}>
      <Text style={[styles.riskBadgeCount, { color }]}>{count}</Text>
      <Text style={[styles.riskBadgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

// EH19 · İçerik listesini önceliklendir: vurgulu (good/irritant/harsh) ilk
// `cap` slot içinde görünsün, geri kalanlar orijinal sırada kalsın.
function prioritizeIngredients(list: string[], cap: number): string[] {
  if (list.length <= cap) return list;
  const flagged: string[] = [];
  const rest: string[] = [];
  for (const n of list) {
    if (classifyIngredientName(n) != null) flagged.push(n);
    else rest.push(n);
  }
  // Cap'i flagged'la dolu doldurmaya çalış, sonra rest'le tamamla.
  return [...flagged.slice(0, cap), ...rest].slice(0, cap);
}

// EH19 · Önemli aktif/etken bileşen rengi.
// "good"      = yararlı aktif (yeşil)
// "irritant"  = potansiyel tahriş edici (amber)
// "harsh"     = sert/şüpheli (kırmızı)
type IngTone = "good" | "irritant" | "harsh" | null;

function classifyIngredientName(name: string): IngTone {
  const n = name.toLowerCase();
  // Sert / şüpheli
  if (/\b(sulfate|sülfat|sodium\s*lauryl\s*sulfate|sls|sodium\s*laureth\s*sulfate|sles)\b/.test(n)) return "harsh";
  if (/\bparaben\b/.test(n)) return "harsh";
  // Tahriş edici / dikkat
  if (/\b(parfum|fragrance|perfume|koku)\b/.test(n)) return "irritant";
  if (/\balcohol\s*denat|alcohol\s*denatured|denat\.?\s*alcohol|sd\s*alcohol/.test(n)) return "irritant";
  if (/\bsilicone|silikon|dimethicone|cyclopentasiloxane|cyclomethicone|siloxane\b/.test(n)) return "irritant";
  // Faydalı aktifler
  if (/\bniacinamide|niasinamid\b/.test(n)) return "good";
  if (/\bsalicylic|salisilik|bha\b/.test(n)) return "good";
  if (/\bglycolic|glikolik|lactic|laktik|mandelic|aha\b/.test(n)) return "good";
  if (/\bzinc|çinko|zinc\s*pca\b/.test(n)) return "good";
  if (/\bretinol|retinal|retinoid\b/.test(n)) return "good";
  if (/\bceramide|seramid|ceramid\b/.test(n)) return "good";
  if (/\bhyaluronic|hyaluron|hiyalüronik|sodium\s*hyaluronate\b/.test(n)) return "good";
  if (/\bpanthenol|pantenol\b/.test(n)) return "good";
  if (/\bvitamin\s*c|ascorbic|askorbik|ascorbyl\b/.test(n)) return "good";
  if (/\bpeptide|peptit|matrixyl\b/.test(n)) return "good";
  return null;
}

const ING_TONE_STYLE: Record<NonNullable<IngTone>, { bg: string; border: string; text: string }> = {
  good:     { bg: "#EAF1EA", border: "#A5BFA0", text: "#3F6E3A" },
  irritant: { bg: "#FEF9C3", border: "#F4C76B", text: "#92400E" },
  harsh:    { bg: "#FEE2E2", border: "#F4A0A0", text: "#991B1B" },
};

function IngBlock({ title, count, color, bg, items, showMore, colors }: {
  title: string; count: number; color: string; bg: string; items: string[]; showMore: boolean; colors: any;
}) {
  return (
    <View style={[styles.ingBlock, { borderLeftColor: color }]}>
      <View style={styles.ingBlockHeader}>
        <Text style={[styles.ingBlockTitle, { color }]}>{title}</Text>
        <View style={[styles.ingCountPill, { backgroundColor: bg }]}>
          <Text style={[styles.ingCountText, { color }]}>{count}</Text>
        </View>
      </View>
      <View style={styles.ingChips}>
        {items.map((name, i) => {
          const tone = classifyIngredientName(name);
          const ts = tone ? ING_TONE_STYLE[tone] : null;
          return (
            <View
              key={i}
              style={[
                styles.ingChip,
                ts
                  ? { backgroundColor: ts.bg, borderColor: ts.border }
                  : { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.ingChipText,
                  { color: ts ? ts.text : colors.text, fontWeight: ts ? "700" : "500" },
                ]}
              >
                {name}
              </Text>
            </View>
          );
        })}
        {showMore && (
          <View style={[styles.ingChip, { backgroundColor: color + "20", borderColor: color + "40" }]}>
            <Text style={[styles.ingChipText, { color }]}>+{count - items.length} daha</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Soft Conversion Hook ──────────────────────────────────────────────────────

function ComparisonSoftHook({ nameA, nameB, heroWinner, colors }: {
  nameA: string; nameB: string; heroWinner: "A" | "B" | null; colors: any;
}) {
  const winnerName = heroWinner === "A" ? nameA : heroWinner === "B" ? nameB : null;
  const previewSentence = winnerName
    ? `${winnerName} genel karşılaştırmada öne çıkıyor — ancak bu sonuç cilt profiline göre tersine dönebilir.`
    : `Bu iki ürün arasında belirgin bir kazanan yok — ama şahsi cilt profili dengeyi bozabilir.`;

  return (
    <View style={[compHookStyles.wrapper, { backgroundColor: colors.surfaceCard, borderColor: "rgba(184,115,51,0.22)" }]}>
      {/* Başlık */}
      <View style={compHookStyles.header}>
        <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: "rgba(184,115,51,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Feather name="compass" size={10} color="#B87333" />
        </View>
        <Text style={compHookStyles.headerText}>DAHA NET KARAR İÇİN</Text>
      </View>

      {/* Önizleme metni — soluklaşan */}
      <View style={compHookStyles.previewWrap}>
        <Text style={[compHookStyles.previewText, { color: colors.textSecondary }]}>
          {previewSentence + " Rutinde kullandığın ürünlerle etkileşim, cilt bariyeri ve aktif içerik yükü hesaba katıldığında..."}
        </Text>
        {/* Fade overlay */}
        <View style={[compHookStyles.fadeOverlay, { backgroundColor: colors.surfaceCard }]} />
      </View>

      {/* Kilit satırı */}
      <View style={compHookStyles.lockRow}>
        <Feather name="lock" size={11} color="rgba(184,115,51,0.55)" />
        <Text style={[compHookStyles.lockLabel, { color: colors.textMuted }]}>
          Şahsi cilt profiline göre karar desteği — Seçkin üyelere açık.
        </Text>
      </View>

      {/* CTA */}
      <Pressable
        style={({ pressed }) => [compHookStyles.cta, { borderColor: "rgba(184,115,51,0.45)", opacity: pressed ? 0.8 : 1 }]}
        onPress={() => {}}
      >
        <Text style={compHookStyles.ctaText}>Karar desteğini aç</Text>
        <Feather name="arrow-right" size={12} color="#B87333" />
      </Pressable>
    </View>
  );
}

const compHookStyles = StyleSheet.create({
  wrapper: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerText: { fontSize: 10, fontWeight: "700", color: "#B87333", letterSpacing: 0.6 },
  previewWrap: { position: "relative", overflow: "hidden", maxHeight: 48 },
  previewText: { fontSize: 13, lineHeight: 19 },
  fadeOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 32, opacity: 0.85 },
  lockRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  lockLabel: { fontSize: 12, lineHeight: 17, flex: 1 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  ctaText: { fontSize: 13, fontWeight: "600", color: "#B87333" },
});

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14 },
  errText: { fontSize: 14, textAlign: "center" },
  backPill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 36, alignItems: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800" as const },
  scroll: { paddingHorizontal: 16, gap: 12, paddingTop: 14 },

  heroCard: { flexDirection: "row", borderRadius: 20, borderWidth: 1, padding: 12, gap: 4, marginBottom: 4 },
  heroSlot: { flex: 1, alignItems: "center", gap: 8 },
  heroSlotWinner: {
    backgroundColor: "#EAF1EA",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#C8D8C8",
    paddingTop: 8,
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  heroWinnerBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    backgroundColor: "#EAF1EA",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "center" as const,
  },
  heroWinnerText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#6B7F5D",
    letterSpacing: 0.3,
  },
  heroLetterBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  // PERF (S1): Hero ProductImage'ın style prop'u SABİT referans olmalı; inline {alignSelf}
  // her render'da yeni obje doğurup ProductImage memo'sunu kırıyordu.
  heroImage: { alignSelf: "center" },
  heroLetter: { fontSize: 12, fontWeight: "900" as const, letterSpacing: 0.5 },
  heroName: { fontSize: 13, fontWeight: "700" as const, textAlign: "center", lineHeight: 18 },
  heroBrand: { fontSize: 11, fontWeight: "500" as const, textAlign: "center" },
  heroScore: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, alignItems: "center" },
  heroScoreText: { fontSize: 11, fontWeight: "700" as const },
  heroBonusNote: { fontSize: 10, textAlign: "center", lineHeight: 14, opacity: 0.65, marginTop: 3 },
  safetyNoteRow: { flexDirection: "row" as const, gap: 4, alignItems: "flex-start", backgroundColor: "#FFFBEB", borderRadius: 7, borderWidth: 1, borderColor: "#FDE68A", paddingHorizontal: 6, paddingVertical: 4, alignSelf: "stretch" as const },
  safetyNoteText: { flex: 1, fontSize: 9, color: "#92400E", lineHeight: 13 },
  vsWrap: { width: 36, alignItems: "center", justifyContent: "center" },
  vsCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vsText: { fontSize: 8, fontWeight: "800" as const, letterSpacing: 0.5 },

  section: { borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "800" as const },

  badgeHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  badgeColHead: { width: 66, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badgeColHeadText: { fontSize: 12, fontWeight: "800" as const },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 },
  badgeLabel: { flex: 1, fontSize: 12, fontWeight: "600" as const },
  badgeCell: { width: 66, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 4 },
  badgeCellText: { fontSize: 9, fontWeight: "700" as const, textAlign: "center", flex: 1, flexWrap: "wrap" },

  skinRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 34 },
  skinLabel: { flex: 1, fontSize: 12, fontWeight: "600" as const },
  skinCell: { width: 66, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  skinLegend: { flexDirection: "row", gap: 12, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10 },

  summaryRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  summaryLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  summaryLabel: { fontSize: 14, fontWeight: "700" as const, lineHeight: 20 },
  summaryDetail: { fontSize: 12, marginTop: 3, lineHeight: 17, opacity: 0.7 },

  // Final Decision Sentence card (refactor v1) — soft sage, küçük rounded.
  finalDecisionCard: {
    backgroundColor: "#EAF1EA",
    borderColor: "#7A8F6B33",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  finalDecisionTitle: {
    fontSize: 11,
    fontWeight: "800" as const,
    color: "#4B7A5C",
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  finalDecisionText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#1F2937",
    lineHeight: 20,
  },

  // Premium gating CTA (refactor v1) — Eczacı Yorumu kartının altında.
  premiumCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  premiumCtaText: { fontSize: 12, fontWeight: "700" as const, color: "#92400E", letterSpacing: 0.2 },

  // Premium modal (refactor v1) — kapatma + soft CTA. Navigation YOK.
  premiumModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  premiumModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  premiumModalIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#FEF3C7",
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  premiumModalTitle: { fontSize: 17, fontWeight: "800" as const, color: "#1F2937", textAlign: "center", marginBottom: 8 },
  premiumModalBody: { fontSize: 13.5, lineHeight: 19, color: "#4B5563", textAlign: "center", marginBottom: 18 },
  premiumModalButton: {
    width: "100%",
    backgroundColor: "#92400E",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  premiumModalButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" as const, letterSpacing: 0.2 },
  premiumModalDismiss: { marginTop: 10, paddingVertical: 8 },
  premiumModalDismissText: { fontSize: 12.5, color: "#9CA3AF", fontWeight: "600" as const },
  summaryWinner: { fontSize: 13, fontWeight: "700" as const, textAlign: "right", flexShrink: 0, maxWidth: 110, marginTop: 2 },
  winnerDot: { width: 8, height: 8, borderRadius: 4 },

  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  featureText: { flex: 1, fontSize: 13, lineHeight: 18 },

  diffRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderLeftWidth: 2, paddingLeft: 10 },
  diffText: { flex: 1, fontSize: 13, lineHeight: 18 },
  ingredientNoteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 2 },
  ingredientNoteIcon: { width: 20, height: 20, borderRadius: 6, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  ingredientNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },

  riskRow: { flexDirection: "row", alignItems: "flex-start", gap: 0, marginBottom: 4 },
  riskBlock: { flex: 1, gap: 4, paddingHorizontal: 4 },
  riskBlockLabel: { fontSize: 11, fontWeight: "700" as const, marginBottom: 2 },
  riskDivider: { width: 1, alignSelf: "stretch", marginHorizontal: 6 },
  riskBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  riskBadgeCount: { fontSize: 13, fontWeight: "800" as const },
  riskBadgeLabel: { fontSize: 10, fontWeight: "600" as const },

  ingBlock: { borderLeftWidth: 2, paddingLeft: 10, gap: 6 },
  ingBlockHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  ingBlockTitle: { fontSize: 12, fontWeight: "700" as const },
  ingCountPill: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  ingCountText: { fontSize: 11, fontWeight: "700" as const },
  ingChips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  ingChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  ingChipText: { fontSize: 10 },

  emptyText: { fontSize: 13, textAlign: "center", paddingVertical: 8 },

  mismatchCard: { borderRadius: 20, borderWidth: 1.5, padding: 24, gap: 16, alignItems: "center", width: "100%" },
  mismatchIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  mismatchTitle: { fontSize: 18, fontWeight: "800" as const, textAlign: "center" },
  mismatchMsg: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  reliabilityNote: { flexDirection: "row" as const, alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginBottom: 4 },
  reliabilityNoteText: { flex: 1, fontSize: 12, lineHeight: 17, opacity: 0.7 },
  mismatchProducts: { width: "100%", borderWidth: 1, borderRadius: 14, overflow: "hidden" as const },
  mismatchRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  mismatchDivider: { height: 1 },
  mismatchBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  mismatchBadgeLetter: { fontSize: 15, fontWeight: "800" as const },
  mismatchName: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  mismatchCat: { fontSize: 11, marginTop: 2 },
  mismatchBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, alignSelf: "stretch" as const, justifyContent: "center" },
  mismatchBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },

  verdictCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 10 },
  verdictHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  verdictTitle: { fontSize: 14, fontWeight: "800" as const, color: "#E2E8F0" },
  verdictRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  verdictBullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#60A5FA", marginTop: 6 },
  verdictText: { flex: 1, fontSize: 13, lineHeight: 19, color: "#CBD5E1" },

  pharmacistCard: {
    backgroundColor: "#FFFBF5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  pharmacistHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  pharmacistIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  pharmacistTitle: { fontSize: 13, fontWeight: "800" as const, color: "#78350F", letterSpacing: 0.2 },
  pharmacistText: { fontSize: 14, lineHeight: 22, color: "#44403C", fontWeight: "400" as const },

  // ── Insight Cards ──
  insightCard: { borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 10 },
  insightHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  insightIconWrap: { width: 26, height: 26, borderRadius: 7, alignItems: "center" as const, justifyContent: "center" as const },
  insightTitle: { fontSize: 14, fontWeight: "800" as const },
  insightBody: { fontSize: 14, lineHeight: 21, fontWeight: "400" as const },
  insightNote: { flexDirection: "row" as const, gap: 6, alignItems: "flex-start" as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  insightNoteText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" as const },

  // ── Feature Insights Block (Eczacı yorumladı) ──
  fiBlock:      { gap: 10, paddingBottom: 4 },
  fiHeader:     { flexDirection: "row" as const, alignItems: "center" as const },
  fiHeaderPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    backgroundColor: "#EAF1EA",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fiLabel: { fontSize: 11, fontWeight: "700" as const, color: "#4B7A5C", letterSpacing: 0.3 },
  fiRows: { gap: 6 },
  fiRow:  {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 9,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  fiIcon: { marginTop: 1, flexShrink: 0 },
  fiText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "400" as const },
  fiDivider: { height: 1, opacity: 0.4, marginTop: 2 },

  // ── Who Is It For ──
  whoSlot: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, gap: 5, alignItems: "center" as const },
  whoLetterBadge: { width: 24, height: 24, borderRadius: 7, alignItems: "center" as const, justifyContent: "center" as const },
  whoLetter: { fontSize: 11, fontWeight: "900" as const },
  whoName: { fontSize: 10, fontWeight: "600" as const, textAlign: "center" as const },
  whoDesc: { fontSize: 12, fontWeight: "600" as const, textAlign: "center" as const, lineHeight: 17 },

  // ── Routine Role ──
  routineRow: { flexDirection: "column" as const, gap: 3, borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  routineLabel: { fontSize: 11, fontWeight: "700" as const },
  routineStep: { fontSize: 13, fontWeight: "400" as const, lineHeight: 19 },

  // ── Decision Summary ──
  decisionCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 10,
  },
  decisionText: { fontSize: 14, lineHeight: 21, color: "#E2E8F0", fontWeight: "500" as const },

  // ── Hero Özellik Rozetleri ──────────────────────────────────────────────
  heroBadgeArea: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "center" as const,
    marginTop: 8,
    marginHorizontal: -2,
  },
  heroBadgePill: {
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginHorizontal: 2,
    marginBottom: 4,
    backgroundColor: "#7A8F6B18",
    borderWidth: 1,
    borderColor: "#7A8F6B40",
  },
  heroBadgePillWinner: {
    backgroundColor: "#7A8F6B28",
    borderColor: "#7A8F6B80",
  },
  heroBadgePillText: {
    fontSize: 9,
    fontWeight: "600" as const,
    color: "#4B6B3A",
    letterSpacing: 0.2,
  },
  heroBadgePillTextWinner: {
    color: "#3A5C2E",
    fontWeight: "700" as const,
  },

  // ── FeatureHintCard ─────────────────────────────────────────────────────
  fhCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  fhHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  fhIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  fhTitle: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
    flex: 1,
  },
  fhWinnerPill: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  fhWinnerLetter: {
    fontSize: 12,
    fontWeight: "900" as const,
  },
  fhBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500" as const,
  },
  fhBadgeRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 5,
    marginTop: 2,
  },
  fhBadgePill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  fhBadgePillText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
});