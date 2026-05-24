/**
 * OverviewPipeline.tsx — Karar Motoru
 * ─────────────────────────────────────────────────────────────────────────────
 * "Umumi Görüntü" sekmesi — pasif bilgi gösterimi yerine aktif karar desteği.
 *
 * SABİT SIRA — Zihinsel akış: Tanı → Güven → Karar → Kullan → Alternatif
 *
 *  ①  BenefitCard              — Kısa Fayda Kutusu
 *  ②  IngredientBadgesSection  — İçerik Rozetleri (CTA öncesi)
 *  ③  CtaLayer                 — Rutinime Ekle + Karşılaştır
 *  ④  DermatologyScoreCard     — Güven Puanı
 *  ⑤  [Neden Önerildi?]        — Şahsileştirme / Daha Derin Okuma (koşullu)
 *  ⑥  KimeUygun                — Bu ürün kime daha uygun?
 *  ⑦  RutindeYeri              — Rutinde yeri ve zamanlaması
 *  ⑧  NeZamanMantikli         — Situasyonel akıl
 *  ⑨  EczaciYorumu             — 2-3 cümlelik uzman yorumu
 *  ⑩  WarningSummaryCard       — Max 1 uyarı
 *  ⑪  BenzerAmaFarkli          — Alternatiflere göre fark
 *  ⑫  RecommendationSection    — Akıllı Öneriler
 *  ⑬  SimilarProductsSection   — Benzer Ürünler
 *  ⑭  PremiumTeaserBlock       — Seçkin teaser
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Platform, Pressable, Text, TouchableOpacity, View } from "react-native";
import { SeckinModal } from "@/components/SeckinModal";
import { router } from "expo-router";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";
import { getRecommendationReasons, type PreferencesSlice } from "@/lib/recommendationReason";
import type { LearningProfile } from "@/lib/userEvents";
import { buildProductPurposeProfile, type ProductPurposeProfile } from "@/lib/productPurposeEngine";
import { getPharmacistComment } from "@/lib/formulaInsights";
import { setRoutineAddIntent } from "@/lib/routineAddIntentStore";
import { ECZACI_SUB_LABEL, getPhysicianOverlay, buildWarningContext } from "@/lib/authorityLayer";
import type { IngredientSummary, ParsedIngredient } from "@/lib/ingredientAnalysis";

import { BenefitCard }              from "./BenefitCard";
import { DermatologyScoreCard }     from "./DermatologyScoreCard";
import { IngredientBadgesSection }  from "./IngredientBadgesSection";
import { WarningSummaryCard }       from "./WarningSummaryCard";
import { SimilarProductsSection }   from "./SimilarProductsSection";
import { RecommendationSection }    from "./RecommendationSection";
import { PremiumTeaserBlock }       from "@/components/PremiumTeaserBlock";
import type { SimilarResult }       from "@/lib/similarProducts";
import type { RecommendationResult } from "@/lib/recommendations";

export interface OverviewPipelineProps {
  product: NormalizedProduct;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  similar: SimilarResult[];
  allProducts: any[];
  recommendations: RecommendationResult[];
  onOpenDermoDetail: () => void;
  preferences?: PreferencesSlice;
  learningProfile?: LearningProfile;
  isSeckin?: boolean;
  parsedIngredients: ParsedIngredient[];
  ingredientSummary: IngredientSummary;
}

// ─── Yardımcı: "Ne Zaman Daha Mantıklı?" ──────────────────────────────────

function buildWhenToUse(purpose: ProductPurposeProfile, product: NormalizedProduct): string[] {
  const items: string[] = [];
  const cat = (product.category ?? "").toLowerCase();

  if (cat.includes("güneş") || cat.includes("sun") || cat.includes("spf")) {
    items.push("Yaz aylarında ve güneşe çıkılan her gün");
    items.push("Deniz, havuz veya outdoor aktivite öncesi");
  }
  if (purpose.routineRole === "cleanser") {
    items.push("Makyaj ve günlük kirlilik birikimini gidermede");
    items.push("Aktif içerik uygulamasından önce temiz bir başlangıç olarak");
  }
  if (purpose.routineRole === "treatment") {
    items.push("Hedefli cilt endişesine yönelik aktif bakım döneminde");
    if (purpose.concernTags.includes("akne")) items.push("Akne döngüsünü kırmaya çalışanlar için");
    if (purpose.concernTags.includes("leke")) items.push("Pigmentasyon ve leke azaltma protokolünde");
  }
  if (purpose.routineRole === "moisturizer") {
    items.push(
      purpose.textureStyle === "light"
        ? "Nem oranı yüksek yaz günlerinde veya yağlı cilt döneminde"
        : "Kış ve kuru iklim koşullarında bariyer desteği olarak"
    );
    if (purpose.barrierFit === "high") items.push("Bariyer hasarı veya kızarıklık sonrası onarımda");
  }
  if (purpose.routineRole === "sunscreen") {
    items.push("Sabah rutininin son ve zorunlu adımı olarak");
    items.push("Yeniden uygulama gerektiren uzun dış mekan aktivitelerinde");
  }
  if (purpose.sensitivityFit === "high") {
    items.push("Kızarıklık veya hassasiyet krizlerinde güvenli tercih olarak");
  }
  if (items.length === 0) {
    items.push("Düzenli günlük bakım rutininin parçası olarak");
    items.push("Cilt dengesini korumaya çalışılan mevsim geçişlerinde");
  }
  return items.slice(0, 3);
}

// ─── Yardımcı: Benzer ürünlerden farkı ────────────────────────────────────

function buildDifferentiatorText(purpose: ProductPurposeProfile, similar: SimilarResult[]): string | null {
  if (similar.length === 0) return null;
  const first = similar[0];
  const firstPurpose = buildProductPurposeProfile(first.product as any);

  const parts: string[] = [];

  if (purpose.textureStyle !== firstPurpose.textureStyle) {
    if (purpose.textureStyle === "light") parts.push("daha hafif ve yağsız bir doku sunuyor");
    else if (purpose.textureStyle === "rich") parts.push("daha yoğun ve besleyici bir formüle sahip");
    else parts.push("dengeli bir doku profili çiziyor");
  }

  if (purpose.sensitivityFit !== firstPurpose.sensitivityFit) {
    if (purpose.sensitivityFit === "high") parts.push("hassas ciltlere daha nazik bir yapıyla yaklaşıyor");
    else if (firstPurpose.sensitivityFit === "high") parts.push("irritasyon riski daha düşük alternatiflere kıyasla daha aktif bir formül taşıyor");
  }

  if (purpose.barrierFit !== firstPurpose.barrierFit) {
    if (purpose.barrierFit === "high") parts.push("bariyer onarımına daha odaklı");
    else if (firstPurpose.barrierFit === "high") parts.push("aktif etki öncelikli, bariyer desteği ikincil konumda");
  }

  if (parts.length === 0) {
    parts.push("benzer ürünlerle işlev açısından örtüşüyor");
    parts.push("en belirgin ayrım fiyat ve marka konumlandırmasında ortaya çıkıyor");
  }

  const sentence = parts.join("; ") + ".";
  const capFirst = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return `Bu ürün ${capFirst}`;
}

// ─── Compare navigation: Supabase id resolver ──────────────────────────────
// Compare screen (mukayese-adayi) reads from useSupabaseProducts. The product
// being viewed may originate from a different source (e.g. Python API) whose
// id is not present in the Supabase products array. Resolve to a real
// Supabase product before navigating, otherwise the compare screen cannot
// find currentProduct and renders empty.
function _norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}
function resolveSupabaseProductId(
  product: NormalizedProduct,
  allProducts: any[],
): string | null {
  if (!product || !Array.isArray(allProducts) || allProducts.length === 0) {
    return null;
  }
  const raw: any = (product as any)._raw ?? {};
  const candidateId = _norm(product.id ?? raw.id);
  // 1. direct id match
  if (candidateId) {
    const hit = allProducts.find((p) => _norm(p?.id) === candidateId);
    if (hit?.id != null) return String(hit.id);
  }
  // 2. barcode (preferred when ids do not align across sources)
  const barcode = _norm(raw.barcode ?? raw.barkod);
  if (barcode) {
    const hit = allProducts.find(
      (p) => _norm(p?.barcode ?? p?.barkod) === barcode,
    );
    if (hit?.id != null) return String(hit.id);
  }
  // 3. exact normalized name match (fallback)
  const name = _norm(product.name ?? raw.name ?? raw.title);
  if (name) {
    const hit = allProducts.find(
      (p) => _norm(p?.name ?? p?.title) === name,
    );
    if (hit?.id != null) return String(hit.id);
  }
  return null;
}
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function _isUuid(v: unknown): boolean {
  if (v == null) return false;
  return _UUID_RE.test(String(v).trim());
}

function navigateToCompare(
  product: NormalizedProduct,
  allProducts: any[],
): void {
  const resolved = resolveSupabaseProductId(product, allProducts);
  const rawAny: any = (product as any)?._raw ?? {};
  // Cap-bypass: mukayese-adayi has its own fetchSupabaseProductById fallback,
  // so navigation MUST proceed whenever we have any UUID-shaped id at hand —
  // even if that id is not present in the (potentially capped) local
  // allProducts list. The compare screen will resolve it server-side.
  let finalProductId: string | null = null;
  let reason: "resolved" | "product.id.uuid" | "_raw.id.uuid" | "failed" = "failed";
  if (resolved) {
    finalProductId = resolved;
    reason = "resolved";
  } else if (_isUuid(product?.id)) {
    finalProductId = String(product.id);
    reason = "product.id.uuid";
  } else if (_isUuid(rawAny?.id)) {
    finalProductId = String(rawAny.id);
    reason = "_raw.id.uuid";
  }

  if (!finalProductId) {
    Alert.alert(
      "Karşılaştırma yapılamıyor",
      "Bu ürün karşılaştırma listesinde bulunamadı. Lütfen daha sonra tekrar deneyin.",
    );
    return;
  }
  router.push(`/mukayese-adayi?productId=${encodeURIComponent(finalProductId)}` as any);
}

// ─── Ana bileşen ───────────────────────────────────────────────────────────

export function OverviewPipeline({
  product,
  isDark,
  cardBg, cardBorder, textColor, textSecondary, textMuted, primary,
  similar,
  allProducts,
  recommendations,
  onOpenDermoDetail,
  preferences,
  learningProfile,
  isSeckin = false,
  parsedIngredients,
  ingredientSummary,
}: OverviewPipelineProps) {

  const hasMetaChips = product.price != null || product.volume != null || product.usageTime;
  const reasons = getRecommendationReasons(product, preferences, learningProfile);

  const purpose = buildProductPurposeProfile(product as any);
  const pharmacistComment = getPharmacistComment(product as any, ingredientSummary, parsedIngredients);
  const whenToUse = buildWhenToUse(purpose, product);
  const differentiator = buildDifferentiatorText(purpose, similar);

  // Physician overlay — build from available ingredient + warning data
  const physicianOverlay = (() => {
    const ingredientNames = parsedIngredients.map((i) => i.name);
    const productWarnings: string[] = Array.isArray((product as any).warnings) ? (product as any).warnings : [];
    const ctx = buildWarningContext({
      highRiskCount: ingredientSummary.high,
      ingredientNames,
      productWarnings,
    });
    // Only show when there's a meaningful safety signal
    if (ctx.highRiskCount === 0 && !ctx.hasRetinol && !ctx.hasAcid && !ctx.hasSulfate) return null;
    return getPhysicianOverlay(ctx);
  })();

  // Renk sabitleri
  const green        = isDark ? "#9DB88D" : "#6B7F5D";
  const greenBg      = isDark ? "#2A3820" : "#EAF1EA";
  const greenBorder  = isDark ? "#3A4D30" : "#C8D8C8";
  const amber        = isDark ? "#FCD34D" : "#92400E";
  const amberBg      = isDark ? "#1C1200" : "#FFFBEB";
  const amberBorder  = isDark ? "#92400E" : "#FDE68A";
  const blue         = isDark ? "#93C5FD" : "#1D4ED8";
  const blueBg       = isDark ? "#0F172A" : "#EFF6FF";
  const blueBorder   = isDark ? "#1E3A5F" : "#BFDBFE";
  const violet       = isDark ? "#C4B5FD" : "#5B21B6";
  const violetBg     = isDark ? "#1E1040" : "#F5F3FF";
  const violetBorder = isDark ? "#4C1D95" : "#DDD6FE";

  const reasonAccent      = isDark ? "#60A5FA" : "#2563EB";
  const reasonAccentMuted = isDark ? "#1E3A5F" : "#BFDBFE";
  const reasonBg          = isDark ? "#0F1729" : "#F0F4FF";
  const reasonTextColor   = isDark ? "#93C5FD" : "#1E40AF";

  const cardShadow = Platform.select({
    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 } as any,
    android: { elevation: 2 } as any,
    web:     { boxShadow: "0 1px 6px rgba(0,0,0,0.06)" } as any,
  });

  const sectionCard = {
    borderRadius: PD.radius.md,
    borderWidth: PD.card.borderWidth,
    padding: PD.spacing.md,
    backgroundColor: cardBg,
    borderColor: cardBorder,
    ...cardShadow,
  };

  const [showSeckinModal, setShowSeckinModal] = useState(false);

  return (
    <View style={{ paddingTop: PD.spacing.sm + 6 }}>

      {/* Meta chips — fiyat / hacim / zamanlama */}
      {hasMetaChips && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: PD.spacing.sm, marginBottom: 16 }}>
          {product.price != null && (
            <MetaChip icon="tag" label={`${product.price} ₺`}
              bg={isDark ? "#1C1917" : "#FAFAF9"} border={isDark ? "#57534E" : "#D6D3D1"}
              iconColor={isDark ? "#A8A29E" : "#78716C"} textColor={isDark ? "#E7E5E4" : "#44403C"} />
          )}
          {product.volume != null && (
            <MetaChip icon="droplet" label={`${product.volume} ml`}
              bg={isDark ? "#0F172A" : "#F8FAFC"} border={isDark ? "#334155" : "#CBD5E1"}
              iconColor={isDark ? "#94A3B8" : "#64748B"} textColor={isDark ? "#CBD5E1" : "#475569"} />
          )}
          {product.usageTime && (
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: PD.radius.pill, borderWidth: 1, backgroundColor: isDark ? "#0C1A2E" : "#EFF6FF", borderColor: isDark ? "#1D4ED8" : "#93C5FD" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#93C5FD" : "#1D4ED8" }}>
                {product.usageTime === "morning" ? "Sabah" : product.usageTime === "evening" ? "Akşam" : "Sabah & Akşam"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ① Kısa Fayda — E4/F13: wrapper View kaldırıldı; marginBottom:16
          artık BenefitCard'ın kendi Animated.View'inde. Böylece BenefitCard
          null dönerse (shortBenefit yoksa) parent'ta 16px boşluk kalmaz. */}
      <BenefitCard product={product} isDark={isDark} />

      {/* ⑧ İçerik Rozetleri — Rutinime Ekle öncesinde */}
      <View style={{ marginBottom: 14 }}>
        <IngredientBadgesSection product={product} isDark={isDark} cardBg={cardBg} cardBorder={cardBorder} textColor={textColor} />
      </View>

      {/* ② CTA Katmanı — öne çıkarıldı */}
      <View style={{ marginBottom: 20, gap: 10 }}>
        {/* Birincil: Rutinime Ekle */}
        <Pressable
          onPress={() => {
            const pid = String((product as any).id ?? "");
            if (!pid) { router.push("/(tabs)/rutin" as any); return; }
            const brand =
              (product as any).brand ?? (product as any).marka ?? undefined;
            const category =
              (product as any).category ?? (product as any).kategori ?? undefined;
            setRoutineAddIntent({
              productId:       pid,
              productName:     (product as any).name ?? (product as any).isim ?? undefined,
              productBrand:    brand ?? undefined,
              productCategory: category ?? undefined,
              // ECZ4 back continuity: Expo Router dynamic segment için tam
               // path. Rutinim'de Vazgeç → goBackToProduct router.canGoBack
               // false olursa bu path direkt push edilir.
              sourceRoute:     `/product/${pid}`,
              sourceParams:    { id: pid },
              ts:              Date.now(),
            });
            router.push("/(tabs)/rutin?fromProductAdd=1" as any);
          }}
          style={({ pressed }) => ({
            borderRadius: PD.radius.lg,
            backgroundColor: pressed ? (isDark ? "#5C7050" : "#6B7F5D") : (isDark ? "#6B7F5D" : "#7A8F6B"),
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            ...Platform.select({
              ios:     { shadowColor: "#7A8F6B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10 } as any,
              android: { elevation: 4 } as any,
              web:     { boxShadow: "0 4px 10px rgba(122,143,107,0.28)" } as any,
            }),
          })}
        >
          <Feather name="plus-circle" size={16} color="#fff" />
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", letterSpacing: -0.2 }}>
            Rutinime Ekle
          </Text>
        </Pressable>

        {/* İkincil: Karşılaştır */}
        <Pressable
          onPress={() => {
            if (!isSeckin) { setShowSeckinModal(true); return; }
            navigateToCompare(product, allProducts);
          }}
          style={({ pressed }) => ({
            borderRadius: PD.radius.lg,
            backgroundColor: pressed
              ? (isDark ? "#2D1A5E" : "#EDE9FE")
              : (isDark ? "#1E1040" : "#F5F3FF"),
            borderWidth: 1.5,
            borderColor: isDark ? "#6D28D9" : "#A78BFA",
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          })}
        >
          <Feather name="sliders" size={15} color={isDark ? "#C4B5FD" : "#5B21B6"} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: isDark ? "#C4B5FD" : "#5B21B6" }}>
            Benzer Ürünlerle Karşılaştır
          </Text>
          {!isSeckin && (
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: isDark ? "#A78BFA30" : "#A78BFA25", alignItems: "center", justifyContent: "center" }}>
              <Feather name="lock" size={9} color={isDark ? "#C4B5FD" : "#5B21B6"} />
            </View>
          )}
        </Pressable>

        <SeckinModal visible={showSeckinModal} onClose={() => setShowSeckinModal(false)} />
      </View>

      {/* ④ Güven Puanı */}
      <View style={{ marginBottom: 16 }}>
        <DermatologyScoreCard product={product} isDark={isDark} cardBg={cardBg} cardBorder={cardBorder} textColor={textColor} textMuted={textMuted} onPress={onOpenDermoDetail} />
      </View>

      {/* ③ Neden Önerildi? */}
      {reasons.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ borderRadius: PD.radius.md, borderWidth: PD.card.borderWidth, padding: PD.spacing.md, backgroundColor: reasonBg, borderColor: reasonAccentMuted }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Feather name="compass" size={13} color={reasonAccent} />
              <Text style={{ fontSize: 10, fontWeight: "700", color: reasonAccent, letterSpacing: 0.5 }}>
                NEDEN ÖNERİLDİ?
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {reasons.slice(0, isSeckin ? 3 : 1).map((r, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: `${reasonAccent}18`, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 }}>
                    <Feather name="check" size={9} color={reasonAccent} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "400", color: reasonTextColor, lineHeight: 19 }}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
          {!isSeckin && (
            <PremiumTeaserBlock
              isDark={isDark} icon="compass"
              title="Daha Derin Okuma"
              previewText="Bu ürünün sana neden önerildiğinin daha derin katmanları var — içerik uyumu, geçmiş etkileşimlerin ve cilt profili birlikte değerlendiriliyor…"
              lockedLabel="İçerik-profil eşleşmesinin tam tablosu şahsî değerlendirmede görünür."
              ctaLabel="Şahsî Değerlendirmemi Aç"
              compact
              onPress={() => router.push("/ayarlar" as any)}
              style={{ marginTop: 8 }}
            />
          )}
        </View>
      )}

      {/* ⑤ Bu Ürün Kime Uygun? */}
      <View style={[{ marginBottom: 16 }, sectionCard]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 11 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${blue}18`, alignItems: "center", justifyContent: "center" }}>
            <Feather name="users" size={11} color={blue} />
          </View>
          <Text style={{ fontSize: 10, fontWeight: "700", color: blue, letterSpacing: 0.6 }}>
            KİME DAHA UYGUN?
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          {/* Birincil hedef */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <Feather name="check-circle" size={14} color={blue} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 13, color: textSecondary, lineHeight: 19 }}>
              {purpose.whoIsItFor}
            </Text>
          </View>
          {/* betterFor chip'leri */}
          {purpose.betterFor.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {purpose.betterFor.map((tag, i) => (
                <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: PD.radius.pill, borderWidth: 1, backgroundColor: blueBg, borderColor: blueBorder }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: blue }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          {/* Daha az uygun (seçkin'e göster) */}
          {isSeckin && (purpose.lessIdealFor ?? []).length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: muted(textMuted), marginBottom: 5 }}>Daha az uygun:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {(purpose.lessIdealFor ?? []).map((tag, i) => (
                  <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: PD.radius.pill, borderWidth: 1, backgroundColor: amberBg, borderColor: amberBorder }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: amber }}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {/* Premium lock */}
          {!isSeckin && (purpose.lessIdealFor ?? []).length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: cardBorder }}>
              <Feather name="lock" size={11} color={textMuted} />
              <Text style={{ fontSize: 11, color: textMuted }}>Sana daha az uygun cilt tipleri — Seçkin üyelere açık</Text>
            </View>
          )}
        </View>
      </View>

      {/* ⑥ Rutinde Yeri */}
      <View style={[{ marginBottom: 16 }, sectionCard]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 11 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${violet}18`, alignItems: "center", justifyContent: "center" }}>
            <Feather name="calendar" size={11} color={violet} />
          </View>
          <Text style={{ fontSize: 10, fontWeight: "700", color: violet, letterSpacing: 0.6 }}>
            RUTİNDE YERİ
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          {/* Adım */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: violetBg, borderWidth: 1, borderColor: violetBorder, alignItems: "center", justifyContent: "center" }}>
              <Feather name="layers" size={13} color={violet} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: textMuted, marginBottom: 1 }}>Rutin adımı</Text>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: textColor }}>{purpose.routineStep}</Text>
            </View>
          </View>
          {/* Zamanlama */}
          {product.usageTime && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: violetBg, borderWidth: 1, borderColor: violetBorder, alignItems: "center", justifyContent: "center" }}>
                <Feather name={product.usageTime === "morning" ? "sun" : product.usageTime === "evening" ? "moon" : "refresh-cw"} size={13} color={violet} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: textMuted, marginBottom: 1 }}>Kullanım zamanı</Text>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: textColor }}>
                  {product.usageTime === "morning" ? "Sabah bakımı" : product.usageTime === "evening" ? "Akşam bakımı" : "Sabah ve akşam"}
                </Text>
              </View>
            </View>
          )}
          {/* Aktif içerik uyarısı varsa */}
          {purpose.concernTags.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: cardBorder }}>
              <Feather name="info" size={12} color={textMuted} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 12, color: textMuted, lineHeight: 17 }}>
                {`${purpose.concernTags.slice(0, 2).join(", ")} içeren rutinlerde diğer aktiflerle etkileşimine dikkat edin.`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ⑦ Ne Zaman Daha Mantıklı? */}
      <View style={[{ marginBottom: 16 }, sectionCard, { backgroundColor: amberBg, borderColor: amberBorder }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 11 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${amber}18`, alignItems: "center", justifyContent: "center" }}>
            <Feather name="clock" size={11} color={amber} />
          </View>
          <Text style={{ fontSize: 10, fontWeight: "700", color: amber, letterSpacing: 0.6 }}>
            NE ZAMAN DAHA MANTIKLI?
          </Text>
        </View>
        <View style={{ gap: 9 }}>
          {whenToUse.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: amber, marginTop: 7, flexShrink: 0 }} />
              <Text style={{ flex: 1, fontSize: 13, color: isDark ? "#FDE68A" : "#78350F", lineHeight: 19 }}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ⑧b Eczacı Yorumu — içerik rozetlerinin altında */}
      {pharmacistComment.length > 0 && (
        <View style={{ marginBottom: 16, borderRadius: PD.radius.md, borderWidth: PD.card.borderWidth, borderLeftWidth: 3, borderLeftColor: green, backgroundColor: greenBg, borderColor: greenBorder, padding: PD.spacing.md, ...cardShadow }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${green}18`, alignItems: "center", justifyContent: "center" }}>
                <Feather name="user-check" size={11} color={green} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: green, letterSpacing: 0.6 }}>
                ECZACI YORUMU
              </Text>
            </View>
            <Text style={{ fontSize: 9.5, fontWeight: "500", color: isDark ? `${green}80` : "#4B9E6E", letterSpacing: 0.2, opacity: 0.8 }}>
              {ECZACI_SUB_LABEL}
            </Text>
          </View>
          <Text style={{ fontSize: 13.5, fontWeight: "400", color: isDark ? "#C8D8C8" : "#5C7050", lineHeight: 20, letterSpacing: -0.1 }}>
            {pharmacistComment}
          </Text>
        </View>
      )}

      {/* ⑨ Max 1 Uyarı */}
      <View style={{ marginBottom: physicianOverlay ? 8 : 12 }}>
        <WarningSummaryCard product={product} isDark={isDark} />
      </View>

      {/* ⑨b Hekim Bakışı — physician safety overlay (koşullu) */}
      {physicianOverlay && (
        <View style={{
          marginBottom: 12,
          borderRadius: PD.radius.md,
          borderWidth: PD.card.borderWidth,
          borderLeftWidth: 3,
          borderLeftColor: amber,
          backgroundColor: amberBg,
          borderColor: amberBorder,
          padding: PD.spacing.md,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${amber}18`, alignItems: "center", justifyContent: "center" }}>
              <Feather name="shield" size={11} color={amber} />
            </View>
            <Text style={{ fontSize: 10, fontWeight: "700", color: amber, letterSpacing: 0.6 }}>
              HEKİM BAKIŞI
            </Text>
            <Text style={{ fontSize: 9.5, fontWeight: "500", color: isDark ? `${amber}80` : "#92400E", opacity: 0.75, marginLeft: "auto" }}>
              {physicianOverlay.title}
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "400", color: isDark ? "#FEF3C7" : "#78350F", lineHeight: 19.5 }}>
            {physicianOverlay.body}
          </Text>
        </View>
      )}

      {/* ⑩ Benzer Ama Farklı */}
      {differentiator && similar.length > 0 && (
        <View style={[{ marginBottom: 16 }, sectionCard]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 11 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${primary}18`, alignItems: "center", justifyContent: "center" }}>
              <Feather name="git-branch" size={11} color={primary} />
            </View>
            <Text style={{ fontSize: 10, fontWeight: "700", color: primary, letterSpacing: 0.6 }}>
              BENZER AMA FARKLI
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: textSecondary, lineHeight: 20, marginBottom: 10 }}>
            {differentiator}
          </Text>
          {/* Birleştirme: karşılaştır satırı */}
          <TouchableOpacity
            onPress={() => navigateToCompare(product, allProducts)}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: primary }}>
              Tam karşılaştırmayı gör
            </Text>
            <Feather name="arrow-right" size={12} color={primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ⑫ Akıllı Öneriler */}
      {recommendations.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <RecommendationSection
            recommendations={recommendations}
            allProducts={allProducts}
            isDark={isDark}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textColor={textColor}
            textSecondary={textSecondary}
            textMuted={textMuted}
          />
        </View>
      )}

      {/* ⑬ Benzer Ürünler */}
      {similar.length > 0 && (
        <View style={{ marginTop: 20, marginBottom: 8 }}>
          <SimilarProductsSection
            currentId={product.id}
            currentCategory={product.category ?? null}
            currentShortBenefit={product.shortBenefit ?? null}
            similar={similar}
            allProducts={allProducts}
            isDark={isDark}
            cardBg={cardBg}
            cardBorder={cardBorder}
            textColor={textColor}
            textSecondary={textSecondary}
            textMuted={textMuted}
            primary={primary}
          />
        </View>
      )}

      {/* ⑭ Premium Teaser */}
      {!isSeckin && (
        <PremiumTeaserBlock
          isDark={isDark}
          icon="activity"
          title="Klinik Değerlendirme"
          previewText="Formül kalitesi, içerik etkileşimleri ve klinik veri dengesi birlikte incelendiğinde bu ürün hakkında çok daha fazlası söylenebilir…"
          lockedLabel="Bu ürünün formül dengesi ve klinik gerekçesi şahsî değerlendirme katmanında yer alıyor."
          ctaLabel="Tam Değerlendirmeyi Gör"
          onPress={() => router.push("/ayarlar" as any)}
          style={{ marginTop: 16, marginBottom: 8 }}
        />
      )}

    </View>
  );
}

// ─── Yardımcı: muted renk opacity ─────────────────────────────────────────
function muted(c: string): string { return c; }

// ─── MetaChip ─────────────────────────────────────────────────────────────
interface MetaChipProps { icon: string; label: string; bg: string; border: string; iconColor: string; textColor: string; }
function MetaChip({ icon, label, bg, border, iconColor, textColor }: MetaChipProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: PD.radius.pill, borderWidth: 1, backgroundColor: bg, borderColor: border }}>
      <Feather name={icon as any} size={11} color={iconColor} />
      <Text style={{ fontSize: 12, fontWeight: "700", color: textColor }}>{label}</Text>
    </View>
  );
}
