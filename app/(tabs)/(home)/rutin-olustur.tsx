import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { canUseAutoRoutine, getMaxRoutineCount } from "@/lib/accessControl";
// ECZ4 Step 2 — Multi-routine save: koleksiyon API'leri ve yetki yardımcıları.
import {
  hydrateRoutineCollection,
  getRoutineCount,
  getPrimaryRoutine,
  saveRoutineAsNew,
  replaceRoutine,
  setPrimaryRoutine,
  ROUTINE_TITLE_MAX_LEN,
  type RoutineRecordInput,
  type RoutineSource,
  type RoutineDomain,
} from "@/lib/routineCollection";
import {
  generateFreeRoutineStructure,
  generatePremiumRoutine,
  normalizeConcernToRoutineProfile,
  type FreeRoutineStructure,
  type RoutineStep,
} from "@/lib/concernRoutineBridge";
import { getSavedRoutineProfile } from "@/lib/concernRoutineBridgeStore";
// ECZ4 Step F — Adım başına ürün önerisi için. useSupabaseProducts zaten Home
// için ısıtılmış cache'ten okur, bu ekran ek ağ çağrısı yapmaz. Skor TEK
// kaynağı getFinalProductScore. ProductCard / ProductImage / scoring engine
// dokunulmuyor; burada minik bir kategori→keyword eşleştirme katmanı kullanılır.
import { useSupabaseProducts } from "@/local_demo_data/safe_runtime_shims_v74";
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import { getFinalProductScore } from "@/lib/getFinalScore";
import {
  resolveBrand,
  resolveProductName,
} from "@/types/product";
import type { Product } from "@/types/product";
// ECZ4 — "Rutinimi Kaydet" — generated routine guide → aktif manuel rutin.
// Tek kalıcılık katmanı (routineStore). Yeni store yok; mevcut addStep API'si
// ile yazılır. Rutinim ekranı zaten getManualRoutine().morning/evening üzerinden
// hasRoutine'i türetir — kayıt sonrası "Henüz şahsi rutin..." otomatik kalkar.
import {
  type ManualStep,
  type RoutineSlot,
  type StepCategory,
} from "@/lib/routineStore";

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <View style={[sl.wrap, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
      <Text style={[sl.text, { color }]}>{label}</Text>
    </View>
  );
}
const sl = StyleSheet.create({
  wrap: { alignSelf: "flex-start", borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  text: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.4 },
});

const ROLE_COLOR: Record<string, string> = {
  "Esas":          "#15803D",
  "Destek":        "#2563EB",
  "İsteğe bağlı": "#6B7280",
};
const ROLE_BG: Record<string, string> = {
  "Esas":          "rgba(21,128,61,0.09)",
  "Destek":        "rgba(37,99,235,0.09)",
  "İsteğe bağlı": "rgba(107,114,128,0.09)",
};

// ── ECZ4 Step F: Adım kategorisi → ürün eşleme katmanı ────────────────────────
// Küçük, lokal keyword haritası. Supabase şemasına / scoring'e / search'e
// dokunmaz. Yalnızca Home cache'inde zaten yüklü ürünler üzerinde çalışır.
// Bir adımın kategorisini, ürünün `category` + `subcategory` + `name` alanları
// içinde basit case-insensitive arama ile eşler. Eşleşenler arasında en
// yüksek getFinalProductScore'a sahip olanı seçer. İmaj YOK — sadece marka,
// ad, skor; ProductImage / ProductCard hiç render edilmez.
const STEP_CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Temizleyici":          ["temizleyici", "cleanser", "yüz yıkama", "jel temizleyici", "köpük"],
  "Nem Serumu":           ["serum", "hyaluronic", "hyalüronik", "nem serumu"],
  "Onarım Serumu":        ["serum", "peptit", "peptide", "seramid", "ceramide", "onarım"],
  "Akne Serumu":          ["serum", "niasinamid", "salisilik", "salicylic", "akne", "bha"],
  "Aydınlatıcı Serum":    ["serum", "c vitamini", "vitamin c", "arbutin", "aydınlatıcı"],
  "Yatıştırıcı Serum":    ["serum", "centella", "cica", "aloe", "bisabolol", "yatıştırıcı"],
  "Nemlendirici":         ["nemlendirici", "moisturizer", "krem", "cream", "lotion", "losyon"],
  "Güneş Koruyucu":       ["güneş", "sunscreen", "spf", "güneş koruyucu", "sunblock"],
};

// ECZ4 Step 8 Fix — Premium engine variantları (generatePremiumRoutine /
// generateFreeRoutineStructure) → base keyword key alias'ı. Premium akış
// "Nazik Temizleyici", "Bariyer Onarım Serumu" gibi türetilmiş kategoriler
// üretiyor; STEP_CATEGORY_KEYWORDS bunları bilmediği için main null → ne
// öneri ne de alternatif görünüyordu. Bu alias tablosu mevcut keyword
// havuzunu yeniden kullanır; eşleşme havuzu DEĞİŞMEZ, sadece anahtar
// çözünürlüğü tamamlanır. Yeni keyword/Supabase/scoring katmanı YOK.
const STEP_CATEGORY_ALIAS_TO_KEY: Record<string, string> = {
  // Temizleyici varyantları
  "Nazik Temizleyici":           "Temizleyici",
  // Serum varyantları
  "Bariyer Onarım Serumu":       "Onarım Serumu",
  "Akne Odaklı Serum":           "Akne Serumu",
  // Nemlendirici / krem varyantları
  "Bariyer Kremi":               "Nemlendirici",
};

function _resolveKeywordsForCategory(category: string): string[] | undefined {
  const direct = STEP_CATEGORY_KEYWORDS[category];
  if (direct) return direct;
  const aliasKey = STEP_CATEGORY_ALIAS_TO_KEY[category];
  if (aliasKey) return STEP_CATEGORY_KEYWORDS[aliasKey];
  return undefined;
}

function _matchesAny(haystacks: string[], keywords: string[]): boolean {
  for (const k of keywords) {
    for (const h of haystacks) {
      if (h.includes(k)) return true;
    }
  }
  return false;
}

// ECZ4 Step 8 — Ranked map: main + up to N brand-diverse alternatives.
// Aynı keyword/score logic'ini kullanır; sadece "tek best" yerine sıralı tüm
// eşleşmeleri tutup ilk = main, kalanlar = alternatif. Marka çeşitliliği:
// main'in markası dışındaki her markadan max 1 alternatif (Pass 1). Yetmezse
// Pass 2 marka kuralını gevşeterek 3'e doldurur. Skor TEK kaynağı
// getFinalProductScore. Supabase'e ek çağrı YOK; aynı products listesi.
const MAX_ALTERNATIVES_PER_STEP = 3;

interface RankedStep {
  main: Product;
  alternatives: Product[];
}

function buildStepProductRanked(
  categories: string[],
  products: Product[],
): Map<string, RankedStep> {
  const out = new Map<string, RankedStep>();
  if (!products || products.length === 0) return out;

  for (const category of categories) {
    if (out.has(category)) continue;
    const keywords = _resolveKeywordsForCategory(category);
    if (!keywords || keywords.length === 0) continue;

    const matches: { p: Product; score: number }[] = [];
    for (const p of products) {
      const cat  = (p.category    ?? "").toString().toLowerCase();
      const sub  = (p.subcategory ?? "").toString().toLowerCase();
      const name = resolveProductName(p).toLowerCase();
      if (!_matchesAny([cat, sub, name], keywords)) continue;
      matches.push({ p, score: getFinalProductScore(p) ?? 0 });
    }
    if (matches.length === 0) continue;

    matches.sort((a, b) => b.score - a.score);
    const main = matches[0].p;
    const remaining = matches.slice(1).map((m) => m.p);

    const mainBrand = (resolveBrand(main) ?? "").toLowerCase();
    const usedBrands = new Set<string>();
    if (mainBrand) usedBrands.add(mainBrand);

    const alternatives: Product[] = [];
    // Pass 1: brand-diverse — main markası ve önceki alt markaları hariç.
    for (const p of remaining) {
      if (alternatives.length >= MAX_ALTERNATIVES_PER_STEP) break;
      const brand = (resolveBrand(p) ?? "").toLowerCase();
      if (brand && usedBrands.has(brand)) continue;
      alternatives.push(p);
      if (brand) usedBrands.add(brand);
    }
    // Pass 2: yeterli çeşit yoksa marka kuralını gevşet, kalan en yüksek
    // skorluları doldur (asla aynı ürün iki kez).
    if (alternatives.length < MAX_ALTERNATIVES_PER_STEP) {
      const picked = new Set<string>(alternatives.map((a) => String(a.id)));
      for (const p of remaining) {
        if (alternatives.length >= MAX_ALTERNATIVES_PER_STEP) break;
        const id = String(p.id);
        if (picked.has(id)) continue;
        alternatives.push(p);
        picked.add(id);
      }
    }

    out.set(category, { main, alternatives });
  }
  return out;
}

function StepRow({
  step, accent, cardBg, textPrimary, textSecondary, borderColor, product, isDark,
  alternatives, canShowAlternatives, isExpanded, onToggleExpand,
  onSelectAlternative,
}: {
  step: { slot: string; category: string; reason?: string; suggestion?: string; roleLabel?: string };
  accent: string; cardBg: string; textPrimary: string; textSecondary: string; borderColor: string;
  product?: Product | null;
  isDark?: boolean;
  // ECZ4 Step 8 — Seçkin-only alternatif ürün listesi. Free için tüm bu
  // proplar undefined geçilir; render YOK. ProductCard / ProductImage
  // kullanılmaz — sadece marka, ad, skor + chevron metin satırları.
  alternatives?: Product[];
  canShowAlternatives?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  // ECZ4 ROUTINE ALT SELECT — Alt satıra basmak ürün detayına gitmek yerine
  // o adımın önerilen ürününü seçilen alternatifle değiştirir. undefined ise
  // (free path veya parent geçmediyse) eski davranış için fallback yok —
  // davranışsız (no-op). Detay navigasyonu sadece recommended row'da kalır.
  onSelectAlternative?: (alt: Product) => void;
}) {
  const roleColor = step.roleLabel ? (ROLE_COLOR[step.roleLabel] ?? accent) : null;
  const roleBg    = step.roleLabel ? (ROLE_BG[step.roleLabel]   ?? `${accent}18`) : null;

  return (
    <View style={[sr.row, { borderColor }]}>
      <View style={[sr.num, { backgroundColor: `${accent}18` }]}>
        <Text style={[sr.numText, { color: accent }]}>{step.slot}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        {/* Kategori + rol chip */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <Text style={[sr.cat, { color: textPrimary }]}>{step.category}</Text>
          {step.roleLabel ? (
            <View style={[sr.chip, { backgroundColor: roleBg!, borderColor: `${roleColor}30` }]}>
              <Text style={[sr.chipText, { color: roleColor! }]}>{step.roleLabel}</Text>
            </View>
          ) : null}
        </View>
        {/* Rol açıklaması */}
        {(step.reason ?? step.suggestion) ? (
          <Text style={[sr.reason, { color: textSecondary }]}>{step.reason ?? step.suggestion}</Text>
        ) : null}

        {/* ECZ4 Step F: Önerilen ürün — yalnızca eşleşme varsa */}
        {product ? (
          <Pressable
            onPress={() => {
              try {
                Haptics.selectionAsync();
                prefetchProductHeroImage(product as any);
                setNavigationProduct(product);
                router.push(`/(tabs)/(home)/product/${product.id}`);
              } catch {
                /* navigation failsafe */
              }
            }}
            style={[
              sr.recRow,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
                borderColor: `${accent}30`,
              },
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[sr.recLabel, { color: accent }]}>ÖNERİLEN ÜRÜN</Text>
              <Text style={[sr.recName, { color: textPrimary }]} numberOfLines={1}>
                {resolveBrand(product) ? `${resolveBrand(product)} · ` : ""}
                {resolveProductName(product) || "Ürün"}
              </Text>
            </View>
            {(() => {
              const score = getFinalProductScore(product);
              return score != null ? (
                <View style={[sr.recScore, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
                  <Text style={[sr.recScoreText, { color: accent }]}>{Math.round(score)}</Text>
                </View>
              ) : null;
            })()}
            <Feather name="chevron-right" size={16} color={textSecondary} />
          </Pressable>
        ) : null}

        {/* ECZ4 Step 8 — Seçkin-only alternatifler. Free için canShowAlternatives
            false → toggle ve liste hiç render edilmez. Aynı navigasyon kalıbı
            (setNavigationProduct + router.push). Görsel YOK. */}
        {canShowAlternatives && alternatives && alternatives.length > 0 ? (
          <>
            <Pressable
              onPress={() => {
                try { Haptics.selectionAsync(); } catch { /* noop */ }
                onToggleExpand?.();
              }}
              hitSlop={6}
              style={[sr.altToggle, { borderColor: `${accent}25` }]}
            >
              <Feather
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={13}
                color={accent}
              />
              <Text style={[sr.altToggleText, { color: accent }]}>
                {isExpanded ? "Alternatifleri gizle" : "Alternatifleri gör"}
                {!isExpanded ? ` (${alternatives.length})` : ""}
              </Text>
            </Pressable>
            {isExpanded ? (
              <View style={[sr.altList, { borderColor: `${accent}20` }]}>
                {alternatives.map((alt, idx) => {
                  const altScore = getFinalProductScore(alt);
                  const altBrand = resolveBrand(alt);
                  const altName  = resolveProductName(alt) || "Ürün";
                  return (
                    <Pressable
                      key={String(alt.id) + ":" + idx}
                      onPress={() => {
                        // ECZ4 ROUTINE ALT SELECT — Detay yerine SEÇ. Parent
                        // override map'ini günceller; effectiveStepProductMap
                        // yeniden hesaplanır → "Önerilen Ürün" satırı
                        // seçilen alternatifle değişir, eski main alt listesinin
                        // başına geçer. Slot/kategori bütünlüğü engine'in
                        // ürettiği alternatives listesinde zaten korunmuş.
                        try {
                          Haptics.selectionAsync();
                          onSelectAlternative?.(alt);
                        } catch {
                          /* selection failsafe */
                        }
                      }}
                      style={[
                        sr.altRow,
                        {
                          backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)",
                          borderColor: `${accent}1A`,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={[sr.altName, { color: textPrimary }]} numberOfLines={1}>
                          {altBrand ? `${altBrand} · ` : ""}{altName}
                        </Text>
                      </View>
                      {altScore != null ? (
                        <View style={[sr.altScore, { backgroundColor: `${accent}14`, borderColor: `${accent}30` }]}>
                          <Text style={[sr.altScoreText, { color: accent }]}>{Math.round(altScore)}</Text>
                        </View>
                      ) : null}
                      <Feather name="chevron-right" size={14} color={textSecondary} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}
const sr = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  num:      { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  numText:  { fontSize: 12, fontWeight: "800" },
  cat:      { fontSize: 13.5, fontWeight: "600" },
  reason:   { fontSize: 12, fontWeight: "400", lineHeight: 17 },
  chip:     { borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  recRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  recLabel:    { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.5 },
  recName:     { fontSize: 12.5, fontWeight: "600" },
  recScore:    { minWidth: 30, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, alignItems: "center" },
  recScoreText:{ fontSize: 11, fontWeight: "800" },
  // ECZ4 Step 8 — Alternatif toggle + liste stilleri (ProductCard'dan bağımsız)
  altToggle:    { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  altToggleText:{ fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  altList:      { marginTop: 6, gap: 4, padding: 6, borderRadius: 10, borderWidth: 1 },
  altRow:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  altName:      { fontSize: 12, fontWeight: "600" },
  altScore:     { minWidth: 26, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, borderWidth: 1, alignItems: "center" },
  altScoreText: { fontSize: 10.5, fontWeight: "800" },
});

function WarningChip({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <View style={[wc.wrap, { backgroundColor: isDark ? "rgba(234,179,8,0.08)" : "rgba(234,179,8,0.07)", borderColor: "rgba(234,179,8,0.25)" }]}>
      <Feather name="alert-triangle" size={12} color={isDark ? "#FDE047" : "#A16207"} />
      <Text style={[wc.text, { color: isDark ? "#FDE047" : "#A16207" }]}>{text}</Text>
    </View>
  );
}
const wc = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  text: { flex: 1, fontSize: 12, fontWeight: "500", lineHeight: 17 },
});

// ─── ECZ4 GLOBAL — Source-aware back resolver ───────────────────────────────
// rutin-olustur Home stack altında bir ekran. router.back() güvenilir değil
// (anket akışında stack history beklenmedik olabilir, deep-link senaryosunda
// hiç olmayabilir). `from` param truth: hangi ekran bizi açtıysa oraya dön.
// Bilinmeyen / yoksa Rutinim güvenli varsayılan (rutin oluşturma ana giriş).
function resolveRutinOlusturBack(from: string | undefined): any {
  switch (from) {
    case "rutin":         return "/(tabs)/rutin";
    case "homeRoutine":   return "/(tabs)/(home)";
    case "profile":       return "/(tabs)/profil";
    case "benimIcinAra":  return "/(tabs)/(home)/profil-eslesme";
    case "akilliSecim":   return "/(tabs)/(home)/akilli-secim";
    case "rehberSonuc":   return "/(tabs)/(home)/rehber-sonuc";
    case "danisma":       return "/(tabs)/danisma";
    default:              return "/(tabs)/rutin";
  }
}

// ECZ4 — BUG 1 fix. Bilinen `from` kaynağı varsa, source-aware route stack
// guess'i (router.back) ezer. Anket akışında stack history Rutinim → Anket →
// rutin-olustur'dur; router.back() Anket'e oradan da Profile'e (Anket'in
// kendi back fallback'i) düşürürdü. `from=rutin` truth ise direkt Rutinim.
// Sadece `from` boş/bilinmeyen olduğunda router.canGoBack() denenir.
const KNOWN_BACK_SOURCES = new Set([
  "rutin", "homeRoutine", "profile", "benimIcinAra",
  "akilliSecim", "rehberSonuc", "danisma",
]);
function hasKnownSource(from: string | undefined): boolean {
  return typeof from === "string" && KNOWN_BACK_SOURCES.has(from);
}
// ECZ4 — Rutin Rehberi kategori etiketi (Türkçe display) → manuel rutin
// StepCategory enum eşleştiricisi. Bilinen anahtar kelime eşleşmezse "other"
// güvenli varsayılanına düşer (routineStore validasyonunda geçerli, Rutinim'de
// "Diğer" olarak görünür). "treatment" yalnızca retinol/aktif/tedavi/peeling/
// maske gibi açıkça aktif/tedavi içerikli adımlar için ayrılır. Yeni kategori
// eklenirse buraya eklenir; routineStore şeması dokunulmaz.
function mapCategoryToStepCategory(category: string): StepCategory {
  const c = (category || "").toLowerCase();
  if (c.includes("temizle"))                                      return "cleanser";
  if (c.includes("güneş") || c.includes("spf") || c.includes("sunscreen")) return "sunscreen";
  if (c.includes("serum"))                                        return "serum";
  if (c.includes("nemlendirici") || c.includes("krem") || c.includes("bariyer kremi") || c.includes("losyon") || c.includes("moisturizer")) return "moisturizer";
  if (c.includes("retinol") || c.includes("aktif") || c.includes("tedavi") || c.includes("peeling") || c.includes("maske")) return "treatment";
  return "other";
}

function goBackSourceAware(from: string | undefined, backFallback: any) {
  if (hasKnownSource(from)) {
    router.replace(backFallback);
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(backFallback);
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function RutinOlusturScreen() {
  const { flow: flowId, premium, from } = useLocalSearchParams<{ flow: string; premium: string; from: string }>();
  const backFallback = resolveRutinOlusturBack(from);
  const { colorScheme } = useTheme();
  const isDark    = colorScheme === "dark";
  const insets    = useSafeAreaInsets();

  // ECZ4 · Step 5c — Premium URL bypass koruması.
  // ?premium=1 query string'i niyet bildirimi olarak okunur, ancak gerçek
  // premium UI yalnızca AuthContext'teki Seçkin durumu doğrulanırsa render
  // edilir. Bu sayede deep link veya manuel URL ile free/misafir kullanıcı
  // premium routine ekranını açamaz; sessizce free akışa düşülür.
  const { user, isRegistered } = useAuth();
  const requestedPremium    = premium === "1";
  const canUsePremiumRoutine = canUseAutoRoutine(user);
  const isPremium            = requestedPremium && canUsePremiumRoutine;

  if (__DEV__ && requestedPremium && !canUsePremiumRoutine) {
    console.warn(
      "[rutin-olustur] premium=1 reddedildi: kullanıcı Seçkin değil, free fallback render edilecek.",
    );
  }

  const { scrollPaddingBottom } = useTabBarInset();

  const bg            = isDark ? "#141414" : "#FAFAF8";
  const cardBg        = isDark ? "#1C2535" : "#FFFFFF";
  const textPrimary   = isDark ? "#F0F4F8" : "#111827";
  const textSecondary = isDark ? "#94A3B8" : "#6B7280";
  const borderColor   = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const record = flowId ? getSavedRoutineProfile(flowId) : null;

  const { routineProfile, accentColor } = useMemo(() => {
    if (!record || !flowId) return { routineProfile: null, accentColor: "#7A8F6B" };
    const rp = record.routineProfile;
    const ACCENT_MAP: Record<string, string> = {
      akne: "#6B7F5D", hassasiyet: "#BE123C", leke: "#7C3AED",
      kuruluk: "#1D4ED8", gunes: "#B45309", sac: "#C2410C",
      // ECZ4 Step 10 — Akıllı Seçim domain'leri için accent eşleşmesi.
      // Mevcut concern key'leri ile görsel uyum: skin → akne yeşili,
      // hair → sac turuncusu, sun → gunes ambası. Body/oral yeni domain'ler;
      // sıcak nötr (body) ve temiz teal (oral) tonları seçildi.
      akilli_skin: "#6B7F5D",
      akilli_hair: "#C2410C",
      akilli_sun:  "#B45309",
      akilli_body: "#A16207",
      akilli_oral: "#0E7490",
    };
    return { routineProfile: rp, accentColor: ACCENT_MAP[flowId] ?? "#7A8F6B" };
  }, [record, flowId]);

  const freeStructure = useMemo((): FreeRoutineStructure | null => {
    if (!routineProfile || isPremium) return null;
    return generateFreeRoutineStructure(routineProfile);
  }, [routineProfile, isPremium]);

  const premiumResult = useMemo(() => {
    if (!routineProfile || !isPremium) return null;
    return generatePremiumRoutine(routineProfile);
  }, [routineProfile, isPremium]);

  // ── ECZ4 Step F + Step G: Adım başına ürün önerisi haritası ────────────────
  // Home'un ısıttığı useSupabaseProducts cache'i. Bu ekran ek ağ çağrısı
  // tetiklemez. Eşleme bir kez hesaplanır; products referansı veya rutin
  // değiştiğinde yeniden hesaplanır.
  // Step G — Free kullanıcıya ürün önerisi RENDER edilmez. Eşleme yine yapılır
  // (Seçkin user free path'te ?premium=0 ile düşerse — anket akışı — ürün
  // rozetleri görünmeli; canUsePremiumRoutine truth kaynağıdır). Free için
  // map boş kalır, hesaplama maliyeti de oluşmaz.
  const { products: allProducts } = useSupabaseProducts();
  // ECZ4 Step 8 — Tek compute, iki türetilmiş map. Free için tüm map'ler boş
  // kalır; alternatif liste hesaplanmaz.
  const stepRanked = useMemo(() => {
    if (!canUsePremiumRoutine) return new Map<string, RankedStep>();
    const cats = new Set<string>();
    if (freeStructure) {
      for (const it of freeStructure.morning) cats.add(it.category);
      for (const it of freeStructure.evening) cats.add(it.category);
      if (freeStructure.weekly) for (const it of freeStructure.weekly) cats.add(it.category);
    }
    if (premiumResult) {
      for (const st of premiumResult.routine.morning as RoutineStep[]) cats.add(st.category);
      for (const st of premiumResult.routine.evening as RoutineStep[]) cats.add(st.category);
      if (premiumResult.routine.weekly) {
        for (const st of premiumResult.routine.weekly as RoutineStep[]) cats.add(st.category);
      }
    }
    return buildStepProductRanked(Array.from(cats), allProducts ?? []);
  }, [canUsePremiumRoutine, freeStructure, premiumResult, allProducts]);

  // Mevcut API'yi koru — buildGeneratedRoutineInput ve tüm StepRow product
  // proplari bu map'i kullanmaya devam eder; davranış değişmez.
  const stepProductMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const [k, v] of stepRanked) m.set(k, v.main);
    return m;
  }, [stepRanked]);

  const stepAlternativeMap = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const [k, v] of stepRanked) m.set(k, v.alternatives);
    return m;
  }, [stepRanked]);

  // ── ECZ4 ROUTINE ALT SELECT ──────────────────────────────────────────────
  // Override map: kullanıcı bir adım için bir alternatif seçtiğinde, o
  // kategoride main yerine bu alt id'si effective olur. Single source of truth
  // korunur: render + buildGeneratedRoutineInput aynı `effectiveStepProductMap`
  // üzerinden okur. Save akışı extra düzenleme istemez (productId zaten
  // recommended.id olarak yazılır).
  //
  // Key = category (stepProductMap key'i ile aynı). Aynı kategori birden çok
  // slot'ta varsa beraber değişir — tek bir "kullanıcı bu kategori için bunu
  // seçti" semantiği tutarlı.
  //
  // Engine alternatives listesi zaten slot/kategori uyumu, gebelik/alerji
  // filtreleri, smartRoutineEngine güvenlik kararlarından geçmiş ürünler
  // içerir → swap güvenlidir, ek filtre gerekmez.
  const [selectedAltByCategory, setSelectedAltByCategory] = useState<Map<string, string>>(() => new Map());

  const effectiveStepProductMap = useMemo(() => {
    if (selectedAltByCategory.size === 0) return stepProductMap;
    const m = new Map(stepProductMap);
    for (const [cat, altId] of selectedAltByCategory) {
      const alts = stepAlternativeMap.get(cat) ?? [];
      const picked = alts.find((a) => String(a.id) === altId);
      if (picked) m.set(cat, picked);
    }
    return m;
  }, [stepProductMap, stepAlternativeMap, selectedAltByCategory]);

  const effectiveStepAlternativeMap = useMemo(() => {
    if (selectedAltByCategory.size === 0) return stepAlternativeMap;
    const m = new Map<string, Product[]>();
    for (const [cat, alts] of stepAlternativeMap) {
      const altId = selectedAltByCategory.get(cat);
      if (!altId) { m.set(cat, alts); continue; }
      const baseMain = stepProductMap.get(cat);
      const remaining = alts.filter((a) => String(a.id) !== altId);
      // Önceki main alt listesinin BAŞINA geçer (kullanıcı geri dönmek isterse
      // hızlı erişebilsin); seçilen alt listeden çıkarılır.
      m.set(cat, baseMain ? [baseMain, ...remaining] : remaining);
    }
    return m;
  }, [stepProductMap, stepAlternativeMap, selectedAltByCategory]);

  const selectAlternativeForCategory = useCallback((category: string, altId: string) => {
    setSelectedAltByCategory((prev) => {
      if (prev.get(category) === altId) return prev; // no-op bailout
      const next = new Map(prev);
      next.set(category, altId);
      return next;
    });
  }, []);

  // ECZ4 Step 8 — Genişletilmiş adımlar için stable key'li Set state.
  // Key = `${section}:${category}:${index}`. Tek adım toggle yalnız ilgili
  // anahtar üzerinde mutasyon yapar; ekran state'i resetlenmez.
  const [expandedAltKeys, setExpandedAltKeys] = useState<Set<string>>(() => new Set());
  const toggleAltKey = useCallback((key: string) => {
    setExpandedAltKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── ECZ4 Step 2 — Multi-routine "Rutinimi Kaydet" handler ─────────────────
  // Generated guide (free veya premium) → routineCollection v2 store'una yazılır.
  // Tek truth katmanı: lib/routineCollection.ts (Kaide 4). routineStore.ts
  // adapter'ı eski getManualRoutine() çağrılarına primary routine'u döndürür;
  // dolayısıyla Home / Rutinim "henüz şahsi rutin..." kalkışı bozulmaz.
  //
  // Membership kapısı (Kaide 10):
  //   guest        → /giris
  //   free (üye)   → max 1 rutin; doluysa "Mevcut rutinin üzerine yaz" alert
  //   seçkin       → max 4 rutin; 1–3 arası "Yeni / Üzerine yaz" seçimi,
  //                  4 doluysa "Ana rutinin üzerine yaz" alert
  //
  // Free için ürün metadata YAZILMAZ; Seçkin stepProductMap'ten ürün iliştirir.
  const [saving, setSaving] = useState(false);

  // ECZ4 Step 5 — Yeni rutin kaydederken kullanıcıdan isim alma modalı.
  // Sadece "Yeni rutin olarak kaydet" akışını etkiler. "Üzerine yaz" akışı
  // mevcut primary'nin başlığını korur (input.title yerine prev.title).
  const [showNameModal, setShowNameModal]   = useState(false);
  const [nameInputValue, setNameInputValue] = useState("");
  const [nameInputError, setNameInputError] = useState<string | null>(null);

  // ── Title / source / domain çıkarımı ──────────────────────────────────────
  // Title flow'a göre seçilir; routineProfile.source/domain mevcutsa onlardan
  // okunur, yoksa güvenli fallback'lere düşer.
  const FLOW_TITLE_MAP: Record<string, string> = {
    akne:         "Akne Bakım Rutinim",
    hassasiyet:   "Hassas Cilt Rutinim",
    leke:         "Leke Bakım Rutinim",
    kuruluk:      "Nem Bakım Rutinim",
    gunes:        "Güneş Koruma Rutinim",
    sac:          "Saç Bakım Rutinim",
    akilli_skin:  "Cilt Bakım Rutinim",
    akilli_hair:  "Saç Bakım Rutinim",
    akilli_sun:   "Güneş Bakım Rutinim",
    akilli_body:  "Vücut Bakım Rutinim",
    akilli_oral:  "Ağız Bakım Rutinim",
  };

  function _uidStep(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  // ── buildGeneratedRoutineInput ────────────────────────────────────────────
  // Şu anki üretilmiş rehberi (free/premium) RoutineRecordInput şekline çevirir.
  // saveRoutineAsNew / replaceRoutine doğrudan bu input'u tüketir.
  const buildGeneratedRoutineInput = (): RoutineRecordInput | null => {
    if (!routineProfile) return null;

    type GuideStep = { slot: string; category: string; reason?: string; suggestion?: string };
    const morningSrc: GuideStep[] = [];
    const eveningSrc: GuideStep[] = [];
    const weeklySrc:  GuideStep[] = [];

    if (isPremium && premiumResult) {
      for (const st of premiumResult.routine.morning as RoutineStep[]) morningSrc.push(st);
      for (const st of premiumResult.routine.evening as RoutineStep[]) eveningSrc.push(st);
      if (premiumResult.routine.weekly) {
        for (const st of premiumResult.routine.weekly as RoutineStep[]) weeklySrc.push(st);
      }
    } else if (freeStructure) {
      for (const it of freeStructure.morning) morningSrc.push({ slot: "morning", category: it.category, suggestion: it.suggestion });
      for (const it of freeStructure.evening) eveningSrc.push({ slot: "evening", category: it.category, suggestion: it.suggestion });
      if (freeStructure.weekly) {
        for (const it of freeStructure.weekly) weeklySrc.push({ slot: "weekly", category: it.category, suggestion: it.suggestion });
      }
    }

    if (morningSrc.length === 0 && eveningSrc.length === 0 && weeklySrc.length === 0) {
      return null;
    }

    const toStep = (g: GuideStep, slot: RoutineSlot, idx: number): ManualStep => {
      const note = g.reason ?? g.suggestion ?? undefined;
      // ECZ4 ROUTINE ALT SELECT — Save effective map'ten okur ki kullanıcı
      // alt seçtiyse RoutineRecordInput'a o ürün yazılsın.
      const recommended = canUsePremiumRoutine ? effectiveStepProductMap.get(g.category) : null;
      return {
        id: _uidStep(),
        category: mapCategoryToStepCategory(g.category),
        label: g.category,
        slot,
        order: idx + 1,
        note,
        ...(recommended ? {
          productId:    String(recommended.id),
          productName:  resolveProductName(recommended) || undefined,
          productBrand: resolveBrand(recommended) || undefined,
        } : {}),
      };
    };

    const morning = morningSrc.map((g, i) => toStep(g, "morning", i));
    const evening = eveningSrc.map((g, i) => toStep(g, "evening", i));
    const weekly  = weeklySrc.map((g, i)  => toStep(g, "weekly",  i));

    // Title / source / domain çıkarımı.
    const title  = FLOW_TITLE_MAP[flowId ?? ""] ?? "Günlük Cilt Rutinim";
    const rpSource = (routineProfile as { source?: string }).source;
    const ALLOWED_SOURCES: ReadonlySet<RoutineSource> = new Set(
      ["manual", "anket", "cilt_analizi", "akilli_secim", "rehber", "danisma"] as const,
    );
    const source: RoutineSource =
      rpSource && ALLOWED_SOURCES.has(rpSource as RoutineSource)
        ? (rpSource as RoutineSource)
        : "rehber";
    const rpDomain = (routineProfile as { domain?: string }).domain;
    const ALLOWED_DOMAINS: ReadonlySet<RoutineDomain> = new Set(
      ["skin", "hair", "sun", "body", "oral", "mixed"] as const,
    );
    const domain: RoutineDomain =
      rpDomain && ALLOWED_DOMAINS.has(rpDomain as RoutineDomain)
        ? (rpDomain as RoutineDomain)
        : "skin";

    return { title, domain, source, morning, evening, weekly, monthly: [] };
  };

  // ── performSaveRoutine: gerçek yazma. mode = "new" | "replace" ────────────
  // ECZ4 Step 5 — overrideTitle mevcutsa input.title yerine geçer (sadece
  // "new" akışında naming modal'dan gelir; "replace" akışı title'ı korur).
  const performSaveRoutine = async (mode: "new" | "replace", overrideTitle?: string) => {
    if (!isRegistered) {
      router.push("/giris" as any);
      return;
    }
    if (saving) return;

    const input = buildGeneratedRoutineInput();
    if (!input) {
      Alert.alert("Kaydedilecek adım yok", "Bu rutin rehberi boş, kaydedilemiyor.");
      return;
    }
    if (mode === "new" && overrideTitle) {
      input.title = overrideTitle;
    }

    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Disk verisini garantile (race-safe — Step 1 replay queue de korur).
      await hydrateRoutineCollection();

      const max = getMaxRoutineCount(user);

      if (mode === "replace") {
        const primary = getPrimaryRoutine();
        if (primary) {
          const ok = replaceRoutine(primary.id, input);
          if (!ok) throw new Error("replaceRoutine reddetti");
        } else {
          // Fallback: primary yoksa yeni kaydet.
          const result = saveRoutineAsNew(input, max);
          if (!result.ok) {
            Alert.alert("Kaydedilemedi", "Rutin kaydedilirken bir sorun oluştu.");
            return;
          }
          setPrimaryRoutine(result.id);
        }
      } else {
        // mode === "new"
        const result = saveRoutineAsNew(input, max);
        if (!result.ok) {
          Alert.alert("Kaydedilemedi", "Rutin sınırına ulaşıldı, yeni rutin eklenemedi.");
          return;
        }
        // Yeni kaydedilen rutini primary yap (saveRoutineAsNew sadece ilk
        // rutinde primary atar; ikinciden itibaren explicit set gerekir).
        setPrimaryRoutine(result.id);
      }

      router.replace("/(tabs)/rutin" as any);
    } catch (err) {
      Alert.alert("Kaydedilemedi", "Rutin kaydedilirken bir sorun oluştu. Lütfen tekrar dene.");
      if (__DEV__) console.warn("[rutin-olustur] save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── handleSaveRoutine: rol-aware Alert orkestrasyonu ──────────────────────
  const handleSaveRoutine = async () => {
    if (!isRegistered) {
      router.push("/giris" as any);
      return;
    }
    if (saving) return;

    // Disk hidrasyonu — count/primary güvenilir okunsun.
    await hydrateRoutineCollection();

    const max   = getMaxRoutineCount(user);
    const count = getRoutineCount();

    // Hiç rutin yoksa — naming modal aç, sonra yeni olarak kaydet.
    if (count === 0) {
      openNameModalForNew();
      return;
    }

    // Kullanıcı limit aşımı durumu.
    if (count >= max) {
      // Free için: max=1, count>=1 → limit alert + overwrite.
      // Seçkin için: max=4, count>=4 → limit alert + overwrite.
      const isFreeLimit = !canUsePremiumRoutine;
      Alert.alert(
        "Rutin sınırına ulaştın",
        isFreeLimit
          ? "Ücretsiz üyelikte 1 rutin oluşturabilirsin. Yeni rutin için mevcut rutinin üzerine yazabilir veya Seçkin üyeliğe geçebilirsin."
          : "En fazla 4 rutin oluşturabilirsin. Yeni rutini kaydetmek için mevcut bir rutinin üzerine yazmalısın.",
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: isFreeLimit ? "Mevcut rutinin üzerine yaz" : "Ana rutinin üzerine yaz",
            style: "destructive",
            onPress: () => { void performSaveRoutine("replace"); },
          },
        ],
      );
      return;
    }

    // Seçkin, count 1–3 → kullanıcıya seçim bırak.
    Alert.alert(
      "Nasıl kaydedilsin?",
      "Bu rutini yeni bir rutin olarak kaydedebilir veya ana rutinin üzerine yazabilirsin.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Yeni rutin olarak kaydet", onPress: () => { openNameModalForNew(); } },
        { text: "Ana rutinin üzerine yaz",  style: "destructive",
          onPress: () => { void performSaveRoutine("replace"); } },
      ],
    );
  };

  // ── ECZ4 Step 5 — Naming modal helpers ───────────────────────────────────
  // Default title: buildGeneratedRoutineInput'tan üretilenle aynı eşleme
  // (FLOW_TITLE_MAP). Kullanıcı isterse değiştirir; trim + max length
  // kontrolü Kaydet'e basıldığında uygulanır.
  const openNameModalForNew = () => {
    const draft = buildGeneratedRoutineInput();
    const initial = draft?.title ?? FLOW_TITLE_MAP[flowId ?? ""] ?? "Günlük Cilt Rutinim";
    setNameInputValue(initial);
    setNameInputError(null);
    setShowNameModal(true);
  };
  const handleConfirmNameModal = () => {
    const trimmed = nameInputValue.trim();
    if (!trimmed) {
      setNameInputError("Rutin adı boş olamaz.");
      return;
    }
    if (trimmed.length > ROUTINE_TITLE_MAX_LEN) {
      setNameInputError(`En fazla ${ROUTINE_TITLE_MAX_LEN} karakter olabilir.`);
      return;
    }
    setShowNameModal(false);
    setNameInputError(null);
    void performSaveRoutine("new", trimmed);
  };
  const handleCancelNameModal = () => {
    if (saving) return;
    setShowNameModal(false);
    setNameInputError(null);
  };

  if (!routineProfile) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <Feather name="alert-circle" size={28} color={textSecondary} />
        <Text style={[s.emptyText, { color: textSecondary }]}>Rutin profili bulunamadı.{"\n"}Lütfen önce Akıllı Seçim’i veya bir Rehber’i tamamla.</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/akilli-secim" as any);
          }}
          style={{
            marginTop: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: accentColor,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Feather name="compass" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Profilimi oluştur</Text>
        </Pressable>
        <Pressable onPress={() => goBackSourceAware(from, backFallback)} style={{ marginTop: 12 }}>
          <Text style={{ color: accentColor, fontWeight: "700" }}>Geri Dön</Text>
        </Pressable>
      </View>
    );
  }

  const routineGoal = routineProfile.routineGoal;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => goBackSourceAware(from, backFallback)} hitSlop={12} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={textPrimary} />
        </Pressable>
        <Text style={[s.headerTitle, { color: textPrimary }]}>
          {isPremium ? "Akıllı Rutin" : "Rutin Rehberi"}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: scrollPaddingBottom() }]}
      >
        {/* Goal banner */}
        <View style={[s.goalBanner, { backgroundColor: `${accentColor}12`, borderColor: `${accentColor}28` }]}>
          <View style={[s.goalIconWrap, { backgroundColor: `${accentColor}20` }]}>
            <Feather name={isPremium ? "zap" : "edit-3"} size={16} color={accentColor} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.goalLabel, { color: accentColor }]}>
              {isPremium ? "Cildine göre akıllı rutin" : "Rutinini bu sonuca göre düzenle"}
            </Text>
            <Text style={[s.goalText, { color: textPrimary }]}>{routineGoal}</Text>
          </View>
        </View>

        {/* Notes from profile */}
        {routineProfile.notes.length > 0 && (
          <View style={{ gap: 6 }}>
            {routineProfile.notes.map((note, i) => (
              <WarningChip key={i} text={note} isDark={isDark} />
            ))}
          </View>
        )}

        {/* Warnings (premium) */}
        {isPremium && premiumResult && premiumResult.warnings.length > 0 && (
          <View style={{ gap: 6 }}>
            {premiumResult.warnings.map((w, i) => (
              <WarningChip key={i} text={w} isDark={isDark} />
            ))}
          </View>
        )}

        {/* ── FREE: Rutin iskeleti ── */}
        {!isPremium && freeStructure && (
          <>
            <View style={[s.section, { backgroundColor: cardBg, borderColor }]}>
              <SectionLabel label="SABAH RUTİNİ" color={accentColor} />
              {freeStructure.morning.map((item, i) => {
                const _key = `free-morning:${item.category}:${i}`;
                return (
                  <StepRow
                    key={i}
                    step={{ slot: String(i + 1), category: item.category, suggestion: item.suggestion }}
                    accent={accentColor}
                    cardBg={cardBg}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    borderColor={borderColor}
                    product={effectiveStepProductMap.get(item.category) ?? null}
                    isDark={isDark}
                    alternatives={canUsePremiumRoutine ? (effectiveStepAlternativeMap.get(item.category) ?? []) : undefined}
                    canShowAlternatives={canUsePremiumRoutine}
                    isExpanded={expandedAltKeys.has(_key)}
                    onToggleExpand={() => toggleAltKey(_key)}
                    onSelectAlternative={canUsePremiumRoutine ? (alt) => selectAlternativeForCategory(item.category, String(alt.id)) : undefined}
                  />
                );
              })}
            </View>

            <View style={[s.section, { backgroundColor: cardBg, borderColor }]}>
              <SectionLabel label="AKŞAM RUTİNİ" color="#7C3AED" />
              {freeStructure.evening.map((item, i) => {
                const _key = `free-evening:${item.category}:${i}`;
                return (
                  <StepRow
                    key={i}
                    step={{ slot: String(i + 1), category: item.category, suggestion: item.suggestion }}
                    accent="#7C3AED"
                    cardBg={cardBg}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    borderColor={borderColor}
                    product={effectiveStepProductMap.get(item.category) ?? null}
                    isDark={isDark}
                    alternatives={canUsePremiumRoutine ? (effectiveStepAlternativeMap.get(item.category) ?? []) : undefined}
                    canShowAlternatives={canUsePremiumRoutine}
                    isExpanded={expandedAltKeys.has(_key)}
                    onToggleExpand={() => toggleAltKey(_key)}
                    onSelectAlternative={canUsePremiumRoutine ? (alt) => selectAlternativeForCategory(item.category, String(alt.id)) : undefined}
                  />
                );
              })}
            </View>

            {freeStructure.weekly && freeStructure.weekly.length > 0 && (
              <View style={[s.section, { backgroundColor: cardBg, borderColor }]}>
                <SectionLabel label="HAFTALIK BAKIM" color="#0891B2" />
                {freeStructure.weekly.map((item, i) => {
                  const _key = `free-weekly:${item.category}:${i}`;
                  return (
                    <StepRow
                      key={i}
                      step={{ slot: String(i + 1), category: item.category, suggestion: item.suggestion }}
                      accent="#0891B2"
                      cardBg={cardBg}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      borderColor={borderColor}
                      product={effectiveStepProductMap.get(item.category) ?? null}
                      isDark={isDark}
                      alternatives={canUsePremiumRoutine ? (effectiveStepAlternativeMap.get(item.category) ?? []) : undefined}
                      canShowAlternatives={canUsePremiumRoutine}
                      isExpanded={expandedAltKeys.has(_key)}
                      onToggleExpand={() => toggleAltKey(_key)}
                      onSelectAlternative={canUsePremiumRoutine ? (alt) => selectAlternativeForCategory(item.category, String(alt.id)) : undefined}
                    />
                  );
                })}
              </View>
            )}

            {/* ECZ4 Step G — Free için pasif ürün önerisi kilit notu. Adım
                kategorileri ve genel öneri yazıları korunur; yalnızca somut
                ürün rozetleri Seçkin'e özeldir. */}
            {!canUsePremiumRoutine && (
              <View style={[s.lockedNote, { backgroundColor: isDark ? "rgba(184,115,51,0.07)" : "rgba(184,115,51,0.05)", borderColor: "rgba(184,115,51,0.20)" }]}>
                <Feather name="lock" size={12} color={isDark ? "#D4A56A" : "#92400E"} />
                <Text style={[s.lockedNoteText, { color: isDark ? "#D4A56A" : "#92400E" }]}>
                  Adım altında somut ürün önerileri Seçkin üyelikte açılır.
                </Text>
              </View>
            )}

            {/* ECZ4 Step F: "Seçkin üyeliğe geç" yalnızca gerçek free kullanıcıya
                gösterilir. Seçkin üye `?premium=0` ile bu ekrana düşse bile
                (ör. anket akışı), accessControl helper truth kaynağıdır:
                canUsePremiumRoutine === true ise upsell GİZLENİR. URL param
                tek başına asla truth olarak kullanılmaz. */}
            {!canUsePremiumRoutine && (
              <Pressable
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                style={[s.upsellCard, { backgroundColor: isDark ? "rgba(184,115,51,0.10)" : "rgba(184,115,51,0.07)", borderColor: "rgba(184,115,51,0.28)" }]}
              >
                <Feather name="star" size={18} color="#B87333" />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.upsellTitle, { color: isDark ? "#D4A56A" : "#92400E" }]}>Seçkin üyeliğe geç</Text>
                  <Text style={[s.upsellSub, { color: isDark ? "#A0835A" : "#B45309" }]}>
                    Uyumluluk kontrolü, adım açıklamaları ve otomatik hazırlanan tam rutin için Seçkin üyeliğini aktifleştir.
                  </Text>
                </View>
              </Pressable>
            )}
          </>
        )}

        {/* ── PREMIUM: Tam rutin ── */}
        {isPremium && premiumResult && (
          <>
            <View style={[s.section, { backgroundColor: cardBg, borderColor }]}>
              <SectionLabel label="SABAH RUTİNİ" color={accentColor} />
              {(premiumResult.routine.morning as RoutineStep[]).map((step, i) => {
                const _key = `prem-morning:${step.category}:${i}`;
                return (
                  <StepRow
                    key={i}
                    step={step}
                    accent={accentColor}
                    cardBg={cardBg}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    borderColor={borderColor}
                    product={effectiveStepProductMap.get(step.category) ?? null}
                    isDark={isDark}
                    alternatives={canUsePremiumRoutine ? (effectiveStepAlternativeMap.get(step.category) ?? []) : undefined}
                    canShowAlternatives={canUsePremiumRoutine}
                    isExpanded={expandedAltKeys.has(_key)}
                    onToggleExpand={() => toggleAltKey(_key)}
                    onSelectAlternative={canUsePremiumRoutine ? (alt) => selectAlternativeForCategory(step.category, String(alt.id)) : undefined}
                  />
                );
              })}
            </View>

            <View style={[s.section, { backgroundColor: cardBg, borderColor }]}>
              <SectionLabel label="AKŞAM RUTİNİ" color="#7C3AED" />
              {(premiumResult.routine.evening as RoutineStep[]).map((step, i) => {
                const _key = `prem-evening:${step.category}:${i}`;
                return (
                  <StepRow
                    key={i}
                    step={step}
                    accent="#7C3AED"
                    cardBg={cardBg}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    borderColor={borderColor}
                    product={effectiveStepProductMap.get(step.category) ?? null}
                    isDark={isDark}
                    alternatives={canUsePremiumRoutine ? (effectiveStepAlternativeMap.get(step.category) ?? []) : undefined}
                    canShowAlternatives={canUsePremiumRoutine}
                    isExpanded={expandedAltKeys.has(_key)}
                    onToggleExpand={() => toggleAltKey(_key)}
                    onSelectAlternative={canUsePremiumRoutine ? (alt) => selectAlternativeForCategory(step.category, String(alt.id)) : undefined}
                  />
                );
              })}
            </View>

            {premiumResult.routine.weekly && premiumResult.routine.weekly.length > 0 && (
              <View style={[s.section, { backgroundColor: cardBg, borderColor }]}>
                <SectionLabel label="HAFTALIK BAKIM" color="#0891B2" />
                {(premiumResult.routine.weekly as RoutineStep[]).map((step, i) => {
                  const _key = `prem-weekly:${step.category}:${i}`;
                  return (
                    <StepRow
                      key={i}
                      step={step}
                      accent="#0891B2"
                      cardBg={cardBg}
                      textPrimary={textPrimary}
                      textSecondary={textSecondary}
                      borderColor={borderColor}
                      product={effectiveStepProductMap.get(step.category) ?? null}
                      isDark={isDark}
                      alternatives={canUsePremiumRoutine ? (effectiveStepAlternativeMap.get(step.category) ?? []) : undefined}
                      canShowAlternatives={canUsePremiumRoutine}
                      isExpanded={expandedAltKeys.has(_key)}
                      onToggleExpand={() => toggleAltKey(_key)}
                      onSelectAlternative={canUsePremiumRoutine ? (alt) => selectAlternativeForCategory(step.category, String(alt.id)) : undefined}
                    />
                  );
                })}
              </View>
            )}

            {premiumResult.simplified && (
              <View style={[s.simplifiedNote, { backgroundColor: isDark ? "rgba(99,102,241,0.10)" : "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.25)" }]}>
                <Feather name="info" size={13} color={isDark ? "#818CF8" : "#4338CA"} />
                <Text style={[s.simplifiedText, { color: isDark ? "#A5B4FC" : "#4338CA" }]}>
                  Cilt yapına göre rutin basitleştirildi. Aktif toleransın ve bariyer durumun gözetildi.
                </Text>
              </View>
            )}

            {/* Seçkin badge */}
            <View style={[s.premiumBadge, { backgroundColor: isDark ? "rgba(184,115,51,0.10)" : "rgba(184,115,51,0.07)", borderColor: "rgba(184,115,51,0.25)" }]}>
              <Feather name="star" size={13} color="#B87333" />
              <Text style={[s.premiumBadgeText, { color: isDark ? "#D4A56A" : "#92400E" }]}>
                Seçkin üye rutini — Uyumluluk ve öncelik sıralaması dahil
              </Text>
            </View>
          </>
        )}

        {/* ECZ4 — "Rutinimi Kaydet" — Generated guide → aktif manuel rutin.
            Misafir gizlenir (Step G + GLOBAL guard zaten EmptyState'lerde
            engelliyor; burada da defense-in-depth — render bile etmiyoruz).
            Free + Seçkin görür. Buton şekli mevcut ekranın diline uygun
            (accent dolgu, full-width, anlamlı ikon + alt açıklama). */}
        {isRegistered && (freeStructure || premiumResult) && (
          <Pressable
            onPress={handleSaveRoutine}
            disabled={saving}
            style={({ pressed }) => [
              s.saveCta,
              {
                backgroundColor: accentColor,
                opacity: saving ? 0.6 : (pressed ? 0.85 : 1),
              },
            ]}
          >
            <Feather name="check-circle" size={16} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.saveCtaTitle}>
                {saving ? "Kaydediliyor…" : "Rutinimi Kaydet"}
              </Text>
              <Text style={s.saveCtaSub}>
                Sabah ve akşam bakım planın Rutinim'e eklensin.
              </Text>
            </View>
          </Pressable>
        )}

        {/* Back to results */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            goBackSourceAware(from, backFallback);
          }}
          style={({ pressed }) => [s.backToResults, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={13} color={textSecondary} />
          <Text style={[s.backToResultsText, { color: textSecondary }]}>Geri dön</Text>
        </Pressable>
      </ScrollView>

      {/* ── ECZ4 Step 5 — Rutin İsmi Modalı ───────────────────────────────── */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelNameModal}
        statusBarTranslucent
      >
        <Pressable
          onPress={handleCancelNameModal}
          style={{
            flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <Pressable
            onPress={() => { /* kart içine tap modal'ı kapatmasın */ }}
            style={{
              width: "100%", maxWidth: 380,
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
              borderRadius: 18, padding: 20, gap: 14,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: textPrimary, letterSpacing: -0.2 }}>
                Rutinine bir isim ver
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: "500", color: textSecondary, lineHeight: 18 }}>
                Bu isim Rutinim listende görünecek. Daha sonra değiştirebilirsin.
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <TextInput
                value={nameInputValue}
                onChangeText={(t) => {
                  setNameInputValue(t);
                  if (nameInputError) setNameInputError(null);
                }}
                placeholder="Rutin adı"
                placeholderTextColor={isDark ? "#6F6F6F" : "#A8A8A8"}
                maxLength={ROUTINE_TITLE_MAX_LEN}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirmNameModal}
                style={{
                  borderWidth: 1.2,
                  borderColor: nameInputError
                    ? "#DC3232"
                    : (isDark ? "rgba(255,255,255,0.15)" : "#D8D3CC"),
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
                  fontSize: 14, fontWeight: "600",
                  color: textPrimary,
                  backgroundColor: isDark ? "#252525" : "#FAFAF8",
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{
                  fontSize: 11, fontWeight: "600",
                  color: nameInputError ? "#DC3232" : textSecondary,
                  flex: 1,
                }}>
                  {nameInputError ?? "Boş olamaz · 40 karaktere kadar"}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: textSecondary }}>
                  {nameInputValue.trim().length}/{ROUTINE_TITLE_MAX_LEN}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable
                onPress={handleCancelNameModal}
                disabled={saving}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  borderWidth: 1.2,
                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "#E0DAD2",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: textSecondary }}>
                  Vazgeç
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmNameModal}
                disabled={saving}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: accentColor,
                  alignItems: "center",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "800", color: "#fff" }}>
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  header:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  scroll:  { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  goalBanner:  { flexDirection: "row", gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 14, alignItems: "flex-start" },
  goalIconWrap:{ width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  goalLabel:   { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.3 },
  goalText:    { fontSize: 14, fontWeight: "600", lineHeight: 20 },

  section: {
    borderRadius: 18, borderWidth: 1, padding: 14,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web:     { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as any,
    }),
  },

  upsellCard:    { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 14 },
  upsellTitle:   { fontSize: 14, fontWeight: "700" },
  upsellSub:     { fontSize: 12.5, fontWeight: "400", lineHeight: 18 },
  lockedNote:    { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  lockedNoteText:{ flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  simplifiedNote:{ flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  simplifiedText:{ flex: 1, fontSize: 12.5, fontWeight: "500", lineHeight: 18 },

  premiumBadge:     { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  premiumBadgeText: { flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },

  saveCta:           { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8 },
  saveCtaTitle:      { fontSize: 15, fontWeight: "700", color: "#fff", letterSpacing: -0.2 },
  saveCtaSub:        { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.85)", marginTop: 2 },
  backToResults:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, marginTop: 4 },
  backToResultsText: { fontSize: 13, fontWeight: "500" },
});