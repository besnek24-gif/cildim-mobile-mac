/**
 * premium-skin-scan-v2 — ResultScreen (v3)
 *
 * Analiz sonucu + rutin kaydetme akışı + ürün alternatifleri + bottom nav.
 * Hook'lar koşullu return'lardan ÖNCE · Modal backdrop: TouchableWithoutFeedback
 */

import { router }            from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreRing }                    from "@/components/ScoreRing";
import { ScanBottomNav, SCAN_NAV_HEIGHT } from "@/components/ScanBottomNav";
import { GateCard, SeckinModal }        from "@/components/SeckinModal";
import { useAuth }                      from "@/local_demo_data/safe_runtime_shims_v74";
import {
  fetchAlternativesForStep,
  fetchTopProductsForSteps,
  findProductByName,
  getProductImageUri,
  isProductValidForStep,
  type V2DBProduct,
  type V2Alternatives,
} from "@/lib/premium-skin-scan-v2/v2ProductDB";
import { resultStore }                  from "@/local_demo_data/safe_runtime_shims_v74";
import { captureStore }                 from "@/local_demo_data/safe_runtime_shims_v74";
import { SAFE_FALLBACK_BUNDLE }         from "@/lib/skinAnalysis/contextBundle";
import { ECZ4_RUNTIME_BUILD_ID }        from "@/lib/skinAnalysis/runtimeBuildId";
import { applyScanRecommendationSafetyFilter } from "@/lib/skinAnalysis/recommendationSafetyFilter";
import { setNavigationProduct }         from "@/lib/productStore";
import { prefetchProductHeroImage }     from "@/lib/imagePrefetch";
import {
  routineProgramStore,
  buildRoutineFromAnalysis,
  saveRoutineToHistory,
  toggleFavorite,
  isFavorite,
}                                       from "@/lib/premium-skin-scan-v2/routineProgramStore";
import { resolveStep }                  from "@/local_demo_data/safe_runtime_shims_v74";
import type {
  RoutineStep,
  ProductItem,
  AnalysisResult,
}                                       from "@/lib/premium-skin-scan-v2/analysisEngine";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";
const WHITE  = "#FFFFFF";

// ─── Rol badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: RoutineStep["role"] }) {
  const cfg =
    role === "Esas"          ? { bg: `${SAGE}20`,   text: SAGE,   label: "Esas"          } :
    role === "Destek"        ? { bg: `${COPPER}20`, text: COPPER, label: "Destek"        } :
                               { bg: "#EEE",         text: MUTED,  label: "İsteğe bağlı" };
  return (
    <View style={[rb.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[rb.txt, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}
const rb = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  txt:  { fontSize: 11, fontWeight: "700" },
});

// ─── Tıklanabilir rutin adımı ─────────────────────────────────────────────────

function StepRow({
  step,
  index,
  resolution,
  selectedProduct,
  autoProduct,
  onPress,
}: {
  step:            RoutineStep;
  index:           number;
  // Legacy: hardcoded PRODUCTS havuzundan eşleşen ürün (analysisEngine).
  // YALNIZCA Supabase autoProduct boşsa son çare olarak kullanılır.
  resolution?:     { displayMode: "product" | "category"; matchedProduct: ProductItem | null } | null;
  // ECZ4 SCAN-RESULT ALT SELECT — Kullanıcı AltsModal'dan ürün seçtiyse bu
  // adım için onun adı productHint olarak yansıtılır.
  selectedProduct?: V2DBProduct | null;
  // ECZ4 STEP 3 — Supabase'ten otomatik seçilen ürün (Single Source of Truth).
  // selectedProduct yoksa görünen birincil hint bu olur. Hardcoded fallback
  // (resolution.matchedProduct) yalnızca her ikisi de boşsa devreye girer.
  autoProduct?:    V2DBProduct | null;
  onPress?:        () => void;
}) {
  // ECZ4 STEP 3B — Hardcoded PRODUCTS havuzu UI'a HİÇBİR DURUMDA basılmaz.
  // `resolution` prop'u tip uyumu için tutuluyor (resolveStep çağrıları
  // değişmedi) ama display priority'den çıkarıldı. Loading anında
  // `autoProduct` henüz null → neutral fallback metin görünür.
  const hasSelection  = !!selectedProduct;
  const hasAuto       = !!autoProduct;
  // resolution intentionally unused for display; void to silence noUnusedLocals
  void resolution;

  return (
    <TouchableOpacity
      style={sp.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={sp.num}>
        <Text style={sp.numTxt}>{index + 1}</Text>
      </View>
      <View style={sp.middle}>
        <Text style={sp.name}>{step.name}</Text>
        {hasSelection ? (
          <Text style={sp.productHint} numberOfLines={1}>
            ✓ {selectedProduct!.name}
          </Text>
        ) : hasAuto ? (
          <Text style={sp.productHint} numberOfLines={1}>
            {autoProduct!.name}
          </Text>
        ) : onPress ? (
          <Text style={sp.categoryHint}>Uygun ürün eklendikçe görünecek</Text>
        ) : null}
      </View>
      <RoleBadge role={step.role} />
      {onPress && <Text style={sp.chevron}>›</Text>}
    </TouchableOpacity>
  );
}
const sp = StyleSheet.create({
  row:         { flexDirection: "row", alignItems: "center", gap: 12 },
  num:         { width: 26, height: 26, borderRadius: 13, backgroundColor: `${SAGE}18`, alignItems: "center", justifyContent: "center" },
  numTxt:      { fontSize: 11, fontWeight: "700", color: SAGE },
  middle:      { flex: 1, gap: 1 },
  name:        { fontSize: 14, color: INK, fontWeight: "500" },
  productHint: { fontSize: 11, color: SAGE, fontWeight: "500" },
  categoryHint:{ fontSize: 11, color: MUTED, fontStyle: "italic" },
  chevron:     { fontSize: 18, color: MUTED, fontWeight: "400" },
});

// ─── Bölüm başlığı ────────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return <Text style={st.t}>{label}</Text>;
}
const st = StyleSheet.create({
  t: { fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.8 },
});

// ─── Kart ────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[ca.card, style]}>{children}</View>;
}
const ca = StyleSheet.create({
  card: { backgroundColor: WHITE, borderRadius: 18, padding: 18, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
});

// ─── Bulgu satırı ─────────────────────────────────────────────────────────────

function ConcernRow({ text, idx }: { text: string; idx: number }) {
  const colors = [COPPER, `${SAGE}CC`, "#A0AEC0"];
  return (
    <View style={cr.row}>
      <View style={[cr.dot, { backgroundColor: colors[idx] ?? colors[0] }]} />
      <Text style={cr.text}>{text}</Text>
    </View>
  );
}
const cr = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot:  { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  text: { flex: 1, fontSize: 14, color: INK, lineHeight: 21 },
});

// ─── Ürün tier bölümü — tıklanabilir ─────────────────────────────────────────

function TierSection({ title, icon, items }: { title: string; icon: string; items: ProductItem[] }) {
  if (!items.length) return null;
  return (
    <View style={ts.wrap}>
      <View style={ts.header}>
        <Text style={ts.icon}>{icon}</Text>
        <Text style={ts.title}>{title}</Text>
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.name}
          style={ts.row}
          onPress={() => goToProduct(item.name)}
          activeOpacity={0.72}
        >
          <View style={ts.left}>
            <Text style={ts.name}>{item.name}</Text>
            <Text style={ts.reason}>{item.reason}</Text>
          </View>
          <View style={ts.rolePill}>
            <Text style={ts.roleText}>{item.role}</Text>
          </View>
          <Text style={ts.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const ts = StyleSheet.create({
  wrap:    { gap: 10 },
  header:  { flexDirection: "row", alignItems: "center", gap: 6 },
  icon:    { fontSize: 13, color: MUTED },
  title:   { fontSize: 12, fontWeight: "700", color: MUTED },
  row:     { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, borderColor: "#F0EBE3", backgroundColor: "#FDFAF7", paddingHorizontal: 12, paddingVertical: 10 },
  left:    { flex: 1, gap: 2 },
  name:    { fontSize: 13, fontWeight: "600", color: INK },
  reason:  { fontSize: 12, color: MUTED },
  rolePill:{ backgroundColor: `${COPPER}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleText:{ fontSize: 11, color: COPPER, fontWeight: "600" },
  chevron: { fontSize: 18, color: MUTED },
});

// ─── Ürün detail navigasyonu ──────────────────────────────────────────────────
// ECZ4 Step 2: id-only path için tek değişiklik — name fallback'inde DB'den
// tam ürünü bulduğumuzda prefetch + setNavigationProduct ile sıcak paint.
// Caller yalnızca id verdiğinde (item.id yok şimdilik), enrichment yapamayız;
// id-only branch cold remain — başka iş yok.

async function goToProduct(name: string, id?: string) {
  if (id) { router.push(`/product/${id}` as any); return; }
  const found = await findProductByName(name);
  if (found?.id) {
    prefetchProductHeroImage(found as any);
    setNavigationProduct(found as any);
    router.push(`/product/${found.id}` as any);
    return;
  }
  router.push(`/(tabs)/(home)/tum-urunler?query=${encodeURIComponent(name)}` as any);
}

// ─── Alternatifler Modalı (DB-bağlı) ─────────────────────────────────────────

type AltsFetchState = "idle" | "loading" | "results" | "empty" | "error";

function AltsModal({
  visible,
  step,
  onClose,
  onSelect,
}: {
  visible:  boolean;
  step:     RoutineStep | null;
  onClose:  () => void;
  // ECZ4 SCAN-RESULT ALT SELECT — onSelect verilirse alt satıra dokunmak
  // ürünü o adıma seçer (modal kapanır), detay sayfasına gitmez. Verilmezse
  // eski davranış (detaya yönlendir) korunur — geriye uyumluluk için.
  // routine-program.tsx AltModal pattern'i ile birebir aynı kontrat.
  onSelect?: (product: V2DBProduct) => void;
}) {
  const EMPTY: V2Alternatives = { ekonomik: [], profesyonel: [], seckin: [] };
  const [dbAlts,  setDbAlts]  = useState<V2Alternatives>(EMPTY);
  const [state,   setState]   = useState<AltsFetchState>("idle");
  const [favs,    setFavs]    = useState<Record<string, boolean>>({});

  const doFetch = useCallback(() => {
    if (!step) return;
    setState("loading");
    fetchAlternativesForStep(step.name)
      .then((alts) => {
        // ECZ-REC-GATE-1: scan-derived alternatif listesini güvenlik filtresinden geçir
        const b = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
        const filtered: V2Alternatives = {
          ekonomik:    applyScanRecommendationSafetyFilter(alts.ekonomik,    b, { stepName: step.name }).products,
          profesyonel: applyScanRecommendationSafetyFilter(alts.profesyonel, b, { stepName: step.name }).products,
          seckin:      applyScanRecommendationSafetyFilter(alts.seckin,      b, { stepName: step.name }).products,
        };
        setDbAlts(filtered);
        const total = filtered.ekonomik.length + filtered.profesyonel.length + filtered.seckin.length;
        setState(total > 0 ? "results" : "empty");
      })
      .catch(() => setState("error"));
  }, [step]);

  useEffect(() => {
    if (!visible || !step) { setDbAlts(EMPTY); setState("idle"); return; }
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.name, visible]);

  if (!step) return null;

  async function handleFav(name: string) {
    const next = await toggleFavorite(name);
    setFavs((prev) => ({ ...prev, [name]: next }));
  }

  function DBProductRow({ item }: { item: V2DBProduct }) {
    const loved  = favs[item.name] ?? false;
    const imgUri = getProductImageUri(item);
    // ECZ4 SCAN-RESULT ALT SELECT — onSelect varsa ana satır basışı SEÇ; yoksa
    // (geriye dönük yol) detay sayfasına git. Heart bağımsız çalışır.
    const handleRowPress = () => {
      if (onSelect) {
        console.log(`[AltsModal] Seçildi: "${item.name}" → adım "${step!.name}"`);
        onSelect(item);
        onClose();
      } else {
        console.log(`[AltsModal] Tıklandı: "${item.name}" (id: ${item.id}) | img: ${imgUri ? "var" : "yok"}`);
        goToProduct(item.name, item.id);
      }
    };
    return (
      <TouchableOpacity
        style={am.row}
        onPress={handleRowPress}
        activeOpacity={0.72}
      >
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={am.rowImg} resizeMode="contain" />
        ) : (
          <View style={[am.rowImg, am.rowImgPlaceholder]}>
            <Text style={am.rowImgFallback}>{(item.name ?? "?").charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={am.rowLeft}>
          <Text style={am.rowName}>{item.name}</Text>
          {(item.short_benefit || item.brand) ? (
            <Text style={am.rowReason} numberOfLines={1}>{item.short_benefit ?? item.brand}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => handleFav(item.name)} hitSlop={10} activeOpacity={0.7}>
          <Text style={[am.heart, loved && { color: COPPER }]}>{loved ? "♥" : "♡"}</Text>
        </TouchableOpacity>
        <Text style={am.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  function DBSection({ title, icon, items }: { title: string; icon: string; items: V2DBProduct[] }) {
    if (!items.length) return null;
    return (
      <View style={am.section}>
        <Text style={am.sectionTitle}>{icon}  {title} ({items.length})</Text>
        {items.map((i) => <DBProductRow key={i.id} item={i} />)}
      </View>
    );
  }

  function BodyContent() {
    if (state === "loading") {
      return (
        <View style={am.stateWrap}>
          <ActivityIndicator color={SAGE} size="small" />
          <Text style={am.stateTxt}>Ürünler aranıyor...</Text>
        </View>
      );
    }
    if (state === "error") {
      return (
        <View style={am.stateWrap}>
          <Text style={[am.stateTxt, { marginBottom: 10 }]}>Ürünler alınamadı.</Text>
          <TouchableOpacity style={am.retryBtn} onPress={doFetch} activeOpacity={0.8}>
            <Text style={am.retryTxt}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (state === "empty") {
      return (
        <View style={am.stateWrap}>
          <Text style={am.stateEmoji}>🔍</Text>
          <Text style={[am.stateTxt, { fontWeight: "600", marginBottom: 4 }]}>{step!.name}</Text>
          <Text style={am.stateTxt}>Bu adım için henüz uygun ürün yüklenmedi.</Text>
          <Text style={[am.stateTxt, { marginTop: 4 }]}>Uygun ürünler eklendikçe burada görünecek.</Text>
        </View>
      );
    }
    // results
    return (
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 14 }}>
        <DBSection title="Ekonomik"    icon="◦" items={dbAlts.ekonomik} />
        {dbAlts.ekonomik.length > 0 && (dbAlts.profesyonel.length + dbAlts.seckin.length) > 0 && <View style={am.divider} />}
        <DBSection title="Profesyonel" icon="◈" items={dbAlts.profesyonel} />
        {dbAlts.profesyonel.length > 0 && dbAlts.seckin.length > 0 && <View style={am.divider} />}
        <DBSection title="Seçkin"      icon="✦" items={dbAlts.seckin} />
      </ScrollView>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={am.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <View style={am.sheet}>
          <View style={am.handle} />
          <Text style={am.title}>{step.name}</Text>
          <Text style={am.subtitle}>Bu adım için ürün alternatifleri</Text>
          <BodyContent />
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={am.closeTxt}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay:          { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet:            { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  handle:           { width: 36, height: 4, backgroundColor: "#DDD", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title:            { fontSize: 17, fontWeight: "700", color: INK, marginBottom: 2 },
  subtitle:         { fontSize: 13, color: MUTED, marginBottom: 14 },
  section:          { gap: 10 },
  sectionTitle:     { fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 0.5 },
  row:              {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#F0EBE3",
    backgroundColor: "#FAFAF8", marginBottom: 4,
  },
  rowImg:           { width: 42, height: 42, borderRadius: 10, backgroundColor: "#EDEAE4", flexShrink: 0 },
  rowImgPlaceholder:{ alignItems: "center", justifyContent: "center" },
  rowImgFallback:   { fontSize: 15, color: MUTED, fontWeight: "700" },
  rowLeft:          { flex: 1, gap: 2 },
  rowName:          { fontSize: 13, fontWeight: "600", color: INK },
  rowReason:        { fontSize: 12, color: MUTED },
  heart:            { fontSize: 18, color: "#CCC" },
  chevron:          { fontSize: 18, color: MUTED, paddingLeft: 2 },
  divider:          { height: StyleSheet.hairlineWidth, backgroundColor: "#EEE" },
  closeBtn:         { marginTop: 16, paddingVertical: 13, borderRadius: 14, backgroundColor: `${SAGE}12`, alignItems: "center", borderWidth: 1, borderColor: `${SAGE}30` },
  closeTxt:         { fontSize: 15, fontWeight: "700", color: SAGE },
  stateWrap:        { padding: 24, alignItems: "center", gap: 8 },
  stateEmoji:       { fontSize: 28, marginBottom: 4 },
  stateTxt:         { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 19 },
  retryBtn:         { marginTop: 4, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 12, backgroundColor: `${SAGE}15`, borderWidth: 1, borderColor: `${SAGE}30` },
  retryTxt:         { fontSize: 13, fontWeight: "700", color: SAGE },
});

// ─── Rutin Kaydet Modalı ──────────────────────────────────────────────────────

type SaveModalMode = "simple" | "update";

function SaveRoutineModal({
  visible,
  mode,
  onSetActive,
  onSaveOnly,
  onUpdate,
  onSaveNew,
  onDismiss,
}: {
  visible:     boolean;
  mode:        SaveModalMode;
  onSetActive: () => void;
  onSaveOnly:  () => void;
  onUpdate:    () => void;
  onSaveNew:   () => void;
  onDismiss:   () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={sm.overlay} />
      </TouchableWithoutFeedback>
      <View style={sm.centeredView}>
        <View style={sm.card}>
          <Text style={sm.title}>
            {mode === "simple"
              ? "Bu rutin şahsi aktif rutinin olsun mu?"
              : "Mevcut rutin güncellensin mi?"}
          </Text>

          {mode === "simple" ? (
            <>
              <TouchableOpacity style={sm.primaryBtn} onPress={onSetActive} activeOpacity={0.82}>
                <Text style={sm.primaryTxt}>Aktif Rutin Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sm.primaryBtn, { backgroundColor: `${SAGE}15` }]} onPress={onSaveOnly} activeOpacity={0.82}>
                <Text style={[sm.primaryTxt, { color: SAGE }]}>Sadece Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sm.ghostBtn} onPress={onDismiss} activeOpacity={0.75}>
                <Text style={sm.ghostTxt}>Şimdilik Değil</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={sm.primaryBtn} onPress={onUpdate} activeOpacity={0.82}>
                <Text style={sm.primaryTxt}>Aktif Rutini Güncelle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sm.primaryBtn, { backgroundColor: `${SAGE}15` }]} onPress={onSaveNew} activeOpacity={0.82}>
                <Text style={[sm.primaryTxt, { color: SAGE }]}>Sadece Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sm.ghostBtn} onPress={onDismiss} activeOpacity={0.75}>
                <Text style={sm.ghostTxt}>İptal</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.40)" },
  centeredView:{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card:        { width: "100%", backgroundColor: WHITE, borderRadius: 22, padding: 24, gap: 10 },
  title:       { fontSize: 16, fontWeight: "600", color: INK, lineHeight: 23, marginBottom: 4 },
  primaryBtn:  { backgroundColor: COPPER, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryTxt:  { fontSize: 15, fontWeight: "700", color: WHITE },
  ghostBtn:    { paddingVertical: 10, alignItems: "center" },
  ghostTxt:    { fontSize: 14, color: MUTED },
});

// ─── DB-bağlı Ürünler Kartı ───────────────────────────────────────────────────

type DbProdState = "loading" | "results" | "empty";

function DbProductRow({ item }: { item: V2DBProduct }) {
  const imgUri = getProductImageUri(item);
  return (
    <TouchableOpacity
      style={dp.row}
      onPress={() => {
        console.log(`[DbProductsCard] Tıklandı: "${item.name}" (id: ${item.id}) | img: ${imgUri ? "var" : "yok"}`);
        goToProduct(item.name, item.id);
      }}
      activeOpacity={0.72}
    >
      {imgUri ? (
        <Image source={{ uri: imgUri }} style={dp.img} resizeMode="contain" />
      ) : (
        <View style={[dp.img, dp.imgPlaceholder]}>
          <Text style={dp.imgFallback}>{(item.name ?? "?").charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={dp.left}>
        <Text style={dp.name} numberOfLines={1}>{item.name}</Text>
        {(item.short_benefit || item.brand) ? (
          <Text style={dp.reason} numberOfLines={1}>{item.short_benefit ?? item.brand}</Text>
        ) : null}
      </View>
      <Text style={dp.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function DbTierSection({ title, icon, items }: { title: string; icon: string; items: V2DBProduct[] }) {
  if (!items.length) return null;
  return (
    <View style={dp.tierWrap}>
      <View style={dp.tierHeader}>
        <Text style={dp.tierIcon}>{icon}</Text>
        <Text style={dp.tierTitle}>{title}</Text>
      </View>
      {items.map((item) => <DbProductRow key={item.id} item={item} />)}
    </View>
  );
}

function DbProductsCard({ morning, evening }: { morning: RoutineStep[]; evening: RoutineStep[] }) {
  const [alts,  setAlts]  = useState<V2Alternatives | null>(null);
  const [state, setState] = useState<DbProdState>("loading");

  useEffect(() => {
    const stepNames = [
      ...morning.slice(0, 3).map((s) => s.name),
      ...evening.slice(0, 2).map((s) => s.name),
    ].filter(Boolean);

    console.log(`[DbProductsCard] ${stepNames.length} adım için ürünler çekiliyor...`);

    fetchTopProductsForSteps(stepNames, 4)
      .then((res) => {
        // ECZ-REC-GATE-1: tier başına güvenlik filtresi
        const b = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
        const safeAlts: V2Alternatives = {
          ekonomik:    applyScanRecommendationSafetyFilter(res.ekonomik,    b).products,
          profesyonel: applyScanRecommendationSafetyFilter(res.profesyonel, b).products,
          seckin:      applyScanRecommendationSafetyFilter(res.seckin,      b).products,
        };
        setAlts(safeAlts);
        const total = safeAlts.ekonomik.length + safeAlts.profesyonel.length + safeAlts.seckin.length;
        console.log(`[DbProductsCard] toplam ${total} ürün gösterilecek (güvenlik filtresinden sonra)`);
        setState(total > 0 ? "results" : "empty");
      })
      .catch(() => setState("empty"));
  }, []);

  if (state === "loading") {
    return (
      <Card>
        <SectionTitle label="SANA UYGUN ÜRÜNLER" />
        <View style={dp.loadWrap}>
          <ActivityIndicator color={SAGE} size="small" />
          <Text style={dp.loadTxt}>Ürünler seçiliyor...</Text>
        </View>
      </Card>
    );
  }

  if (state === "empty" || !alts) {
    return (
      <Card>
        <SectionTitle label="SANA UYGUN ÜRÜNLER" />
        <Text style={dp.emptyTxt}>
          Ürün veritabanı genişledikçe cildinize uygun öneriler burada görünecek.
        </Text>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 16 }}>
      <SectionTitle label="SANA UYGUN ÜRÜNLER" />
      <DbTierSection title="Ekonomik"    icon="◦" items={alts.ekonomik} />
      {alts.ekonomik.length > 0 && (alts.profesyonel.length + alts.seckin.length) > 0 && (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "#EEE" }} />
      )}
      <DbTierSection title="Profesyonel" icon="◈" items={alts.profesyonel} />
      {alts.profesyonel.length > 0 && alts.seckin.length > 0 && (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "#EEE" }} />
      )}
      <DbTierSection title="Seçkin"      icon="✦" items={alts.seckin} />
    </Card>
  );
}

const dp = StyleSheet.create({
  loadWrap:    { padding: 16, alignItems: "center", gap: 8, flexDirection: "row", justifyContent: "center" },
  loadTxt:     { fontSize: 13, color: MUTED },
  emptyTxt:    { fontSize: 13, color: MUTED, fontStyle: "italic", textAlign: "center", paddingVertical: 8 },
  tierWrap:    { gap: 8 },
  tierHeader:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  tierIcon:    { fontSize: 13, color: MUTED },
  tierTitle:   { fontSize: 12, fontWeight: "700", color: MUTED },
  row:         {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1, borderColor: "#F0EBE3",
    backgroundColor: "#FDFAF7", marginBottom: 3,
  },
  img:         { width: 44, height: 44, borderRadius: 11, backgroundColor: "#EDEAE4", flexShrink: 0 },
  imgPlaceholder: { alignItems: "center", justifyContent: "center" },
  imgFallback: { fontSize: 16, color: MUTED, fontWeight: "700" },
  left:        { flex: 1, gap: 2 },
  name:        { fontSize: 13, fontWeight: "600", color: INK },
  reason:      { fontSize: 12, color: MUTED },
  chevron:     { fontSize: 18, color: MUTED },
});

// ─── Fallback analiz ─────────────────────────────────────────────────────────

function buildFallback(): AnalysisResult {
  return {
    id: "fallback", timestamp: new Date().toISOString(),
    skinType: "Karma", score: 72,
    concerns: ["T bölgesinde yağlanma eğilimi", "Yanak bölgesinde hafif nem eksikliği"],
    comment:  "Bölgesel ihtiyaçlar farklılaşıyor. Hedefli bakım rutinle dengelenir.",
    morning: [
      { name: "Köpük temizleyici",      role: "Esas" },
      { name: "Hafif nemlendirici",     role: "Esas" },
      { name: "SPF 50+ güneş koruyucu", role: "Esas" },
    ],
    evening: [
      { name: "Çift temizleme",         role: "Esas" },
      { name: "Nemlendirici krem",      role: "Esas" },
      { name: "Göz altı kremi",         role: "İsteğe bağlı" },
    ],
    weekly: [],
    products: {
      ekonomik:    [{ name: "CeraVe Jel Temizleyici",   role: "Temizleyici", reason: "Yağ dengesini bozmaz" }],
      profesyonel: [{ name: "La Roche-Posay Effaclar",  role: "Temizleyici", reason: "T bölgesi için ideal" }],
      seckin:      [{ name: "Tata Harper Clarifying",   role: "Temizleyici", reason: "Bitkisel formül" }],
    },
  };
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { isSeckin }    = useAuth();

  // Tüm hook'lar koşullu return'lardan ÖNCE
  const [altStep,        setAltStep]        = useState<RoutineStep | null>(null);
  const [saveModal,      setSaveModal]      = useState(false);
  const [saveMode,       setSaveMode]       = useState<SaveModalMode>("simple");
  const [routineSaved,   setRoutineSaved]   = useState(false);
  const [seckinModal,    setSeckinModal]    = useState(false);
  // ECZ4 SCAN-RESULT ALT SELECT — Kullanıcının her adım için seçtiği ürün.
  // Key = step.name (RoutineStep adı). routine-program.tsx'teki
  // selectedProducts pattern'i ile birebir aynı: UI yansıması için, no-op
  // bailout ile gereksiz render fan-out yok.
  const [selectedProducts, setSelectedProducts] = useState<Record<string, V2DBProduct>>({});
  // ECZ4 STEP 3 — Supabase'ten otomatik seedlenen birincil ürün (per step).
  // Hardcoded analysisEngine.PRODUCTS yerine geçer. Kullanıcı henüz bir
  // alternatif seçmediyse bu ürün gösterilir. routine-program.tsx'teki
  // PremiumStepRow.autoProduct paradigmasının ResultScreen versiyonu.
  const [autoProducts, setAutoProducts] = useState<Record<string, V2DBProduct>>({});

  const handleSelectProduct = useCallback((product: V2DBProduct) => {
    if (!altStep) return;
    const stepName = altStep.name;
    setSelectedProducts((prev) => {
      if (prev[stepName]?.id === product.id) return prev; // no-op bailout
      return { ...prev, [stepName]: product };
    });
  }, [altStep]);

  const result: AnalysisResult = resultStore.get() ?? buildFallback();

  // ECZ4 PART A — result-screen mount marker (one-shot per mount)
  useEffect(() => {
    if (__DEV__) {
      console.log("[ECZ4_RUNTIME_BUILD_ID]", ECZ4_RUNTIME_BUILD_ID,
        "result.mount", {
          at: new Date().toISOString(),
          scan_id: resultStore.getScanId(),
          score_source: result.score_source ?? "(undefined)",
          score: result.score,
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ECZ-CTX-GATE-1 — tek doğruluk bundle'ı (yoksa safe fallback) ─────────
  const bundle = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
  const isBlocked    = bundle.routineEligibility === "blocked";
  const isPediatric  = bundle.riskMode === "pediatric";
  const isMinimal    = bundle.routineEligibility === "minimal";
  // FINAL-HARD-LOCK — pose compliance failed → skor/cilt tipi/yorum/rutin/
  // ürün önerileri TAMAMEN gizlenir; safe state + "Yeniden Tara" CTA gösterilir.
  const isPoseFailed = bundle.serverPoseComplianceOk === false;
  // RELEASE-BLOCKER PART D — Güvenli Kullanım Notu görünüm kuralı:
  // Önceki davranış `contradictionWarnings.length > 0` ile her tek
  // bilgi-amaçlı uyarıda kartı yakıyordu; valid 5-açılı taramada da
  // false-positive görünüyordu. Artık koşul yalnızca güvenlik-kritik
  // sinyallere bağlı: eligibility !== full ya da reliability low/insufficient
  // ya da riskMode pediatric/low_confidence/irritated ya da pose failed
  // ya da bundle.hasCriticalContradictions (>=2 çelişki ya da blocked/pediatric/insufficient).
  const showSafetyNote =
    bundle.safetyMessages.length > 0 && (
      bundle.routineEligibility !== "full" ||
      bundle.resultReliabilityLevel === "low" ||
      bundle.resultReliabilityLevel === "insufficient" ||
      bundle.riskMode === "pediatric" ||
      bundle.riskMode === "low_confidence" ||
      bundle.riskMode === "irritated" ||
      bundle.serverPoseComplianceOk === false ||
      bundle.hasCriticalContradictions
    );

  // Ürün çözümleme — ürün modunu otomatik belirle
  const resolvedMorning = useMemo(
    () => result.morning.map((s) => resolveStep(s.name, result.products)),
    [result]
  );
  const resolvedEvening = useMemo(
    () => result.evening.map((s) => resolveStep(s.name, result.products)),
    [result]
  );

  // ── ECZ4 STEP 3 — Supabase autoProduct seeding ──────────────────────────────
  // Tüm rutin adımları için Supabase'ten en uygun birincil ürünü çek ve
  // autoProducts map'ine yerleştir. Hardcoded PRODUCTS havuzu artık
  // kullanıcıya gösterilen birincil kaynak DEĞİL — sadece Supabase tamamen
  // boş dönerse görünen son-çare fallback.
  const stepNamesKey = useMemo(() => {
    const names = [
      ...result.morning.map((s) => s.name),
      ...result.evening.map((s) => s.name),
    ];
    return Array.from(new Set(names)).join("|");
  }, [result]);

  useEffect(() => {
    if (!stepNamesKey) return;
    const names = stepNamesKey.split("|").filter(Boolean);
    let alive   = true;

    // ECZ-REC-GATE-1: autoProduct seeding'inde de güvenlik filtresini uygula
    const safetyBundle = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;

    Promise.all(
      names.map(async (name) => {
        try {
          const alts = await fetchAlternativesForStep(name);
          const candidates = [
            ...alts.profesyonel,
            ...alts.ekonomik,
            ...alts.seckin,
          ].filter((p) => isProductValidForStep(p, name));
          const safe = applyScanRecommendationSafetyFilter(candidates, safetyBundle, { stepName: name }).products;
          return [name, safe[0] ?? null] as const;
        } catch {
          return [name, null] as const;
        }
      })
    ).then((pairs) => {
      if (!alive) return;
      // ECZ4 STEP-PRODUCT-CACHE — aynı tarama için routine-program'ın
      // birinci ürünleri yeniden hesaplamasını önle. Burada hesaplanan
      // pair'ler resultStore cache'ine yazılır; routine-program PremiumStepRow
      // bu değeri okuyarak SAME selection gösterir.
      for (const [name, prod] of pairs) {
        resultStore.setStepProduct(name, prod);
      }
      setAutoProducts((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [name, prod] of pairs) {
          if (prod && next[name]?.id !== prod.id) {
            next[name] = prod;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    return () => { alive = false; };
  }, [stepNamesKey]);

  const skinTypeLabel =
    result.skinType === "Karma"  ? "Karma Cilt"  :
    result.skinType === "Yağlı"  ? "Yağlı Cilt"  :
    result.skinType === "Kuru"   ? "Kuru Cilt"    :
    result.skinType === "Normal" ? "Normal Cilt"  :
    result.skinType === "Hassas" ? "Hassas Cilt"  :
                                    result.skinType;

  async function handleSavePress() {
    if (__DEV__) {
      // ECZ4 PART A — save path runtime kanıt logu (storage-only path).
      const liveBundleProbe = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
      console.log("[ECZ4_RUNTIME_BUILD_ID]", ECZ4_RUNTIME_BUILD_ID,
        "result.handleSavePress", {
          scan_id: resultStore.getScanId(),
          eligibility: liveBundleProbe.routineEligibility,
          reliability: liveBundleProbe.resultReliabilityLevel,
          riskMode: liveBundleProbe.riskMode,
          serverPoseComplianceOk: liveBundleProbe.serverPoseComplianceOk,
          score: result.score,
          score_source: result.score_source,
        });
    }
    if (__DEV__) {
      // RELEASE-BLOCKER PART A — save-button click marker
      console.log("[ECZ4 RELEASE BLOCKER BUILD] result.handleSavePress() pressed @", new Date().toISOString());
    }
    if (routineSaved) {
      router.push("/premium-skin-scan-v2/routine-program" as any);
      return;
    }
    // ── ECZ-FINAL-QA-FIX-1 (rev2) — bundle-driven save gate ────────────────
    // Tek truth: SkinScanContextBundle. ROOT-CAUSE FIX: önceki kapı yalnız
    // (full + normal/sensitive + medium/high) izin veriyordu. Bu durumda
    // GERÇEK BIR KULLANICI taraması (örn. yüzde hafif kızarıklık tespit
    // edilen valid 5-açılı tarama) içerik tarafında riskMode="irritated"
    // alınca eligibility=minimal olur ve save tamamen kapanırdı — ürün
    // kataloğunda buildRoutineFromAnalysis'in zaten desteklediği "restricted
    // save mode" (yalnız temizleyici/nemlendirici/SPF) hiç çalışamadan
    // kapanmış olurdu.
    //
    // YENİ KAPI: gerçek güvenlik durumlarını (blocked, pediatric, insufficient
    // reliability) BLOKLAMAYA devam et, ama riskMode=irritated/low_confidence
    // veya eligibility=minimal olan valid taramalarda restricted save'e izin
    // ver. buildRoutineFromAnalysis bundle'ı alıyor ve aktif-ağır içerikleri
    // (Retinol/AHA/BHA vs.) zaten dışlıyor, weekly adımlarını gizliyor.
    //
    // Same-angle hard-block (serverPoseFailed) → eligibility=blocked +
    // reliability=insufficient → BU KAPI HÂLÂ KAPALI ✓
    // Pediatric → BU KAPI HÂLÂ KAPALI ✓
    // Strong-override valid scan (irritation tespit edilmiş) → restricted save
    // izinli ✓ (kullanıcının asıl istediği)
    const liveBundle = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
    const isHardBlocked = liveBundle.routineEligibility === "blocked";
    const isPediatricGate = liveBundle.riskMode === "pediatric";
    const isInsufficient = liveBundle.resultReliabilityLevel === "insufficient";
    if (isHardBlocked || isPediatricGate || isInsufficient) {
      const { Alert } = await import("react-native");
      const msg = isPediatricGate
        ? "Bebek/çocuk cildi için otomatik kozmetik rutin kaydetmek güvenli değildir. Lütfen eczacı veya hekim görüşü alın."
        : isHardBlocked
          ? "Bu sonuç rutin olarak kaydedilemez. Daha net ve doğru açılı fotoğraflarla tekrar deneyin."
          : "Bu sonuç rutin olarak kaydedilecek kadar güvenilir değil. Lütfen daha net ve doğru açılı fotoğraflarla tekrar deneyin.";
      Alert.alert("Rutin kaydedilemiyor", msg, [{ text: "Tamam" }]);
      return;
    }
    const existing = await routineProgramStore.loadActive();
    setSaveMode(existing ? "update" : "simple");
    setSaveModal(true);
  }

  async function doSetActive() {
    // RELEASE-BLOCKER PART F — bundle ile çağır: minimal/blocked/pediatric/
    // low_confidence/irritated bağlamında aktif-ağır adımlar dışlanır.
    const liveBundle = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
    const prog = buildRoutineFromAnalysis(result, liveBundle);
    await routineProgramStore.saveProgram(prog);
    setSaveModal(false);
    setRoutineSaved(true);
  }

  async function doSaveOnly() {
    const liveBundle = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
    const prog = buildRoutineFromAnalysis(result, liveBundle);
    await saveRoutineToHistory(prog);
    setSaveModal(false);
    setRoutineSaved(true);
  }

  function restart() {
    resultStore.clear();
    captureStore.reset();
    router.replace("/premium-skin-scan-v2" as any);
  }

  const navBottom = SCAN_NAV_HEIGHT + (bottom || 0);

  return (
    <View style={s.root}>

      {/* ── Üst çubuk ─────────────────────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: top + 10 }]}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Text style={s.backTxt}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Bakım Profili</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* ── İçerik ────────────────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: navBottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* FINAL-HARD-LOCK — POSE FAILED SAFE STATE
             Skor / cilt tipi / yorum / rutin / ürünler GİZLENİR.
             Tek bir koruma kartı + "Yeniden Tara" CTA gösterilir. */}
        {isPoseFailed ? (() => {
          // ECZ4 PRECHECK-UNAVAILABLE-MESSAGE-FIX — block sebebi gerçek pose
          // problemi mi yoksa precheck JSON/network hatası mı, ona göre başlık
          // ve gövde metnini değiştir. analysis.tsx blocked path'i bundle'a
          // cannotDetermineFields=["precheck_unavailable"] yazıyor.
          const isPrecheckUnavailable = Array.isArray(bundle?.cannotDetermineFields)
            && bundle!.cannotDetermineFields.includes("precheck_unavailable");
          const blockedTitle = isPrecheckUnavailable
            ? "AÇI UYGUNLUK KONTROLÜ TAMAMLANAMADI"
            : "FOTOĞRAF AÇILARI YENİDEN ÇEKİLMELİ";
          const blockedBody = isPrecheckUnavailable
            ? "Sunucu fotoğraflarınızı bu sefer kontrol edemedi. Lütfen birkaç saniye sonra tekrar deneyin."
            : (Array.isArray(bundle?.safetyMessages) && bundle!.safetyMessages[0])
              ? String(bundle!.safetyMessages[0])
              : "Fotoğraflar istenen açılarla uyumlu görünmüyor. Profil oluşturmak için düz, sağ, sol, yukarı ve aşağı açıları yeniden çekmelisiniz.";
          return (
          <>
            <Card style={{ borderWidth: 1, borderColor: `${COPPER}55`, backgroundColor: "#FBF6EE", gap: 14 }}>
              <SectionTitle label={blockedTitle} />
              <Text style={{ fontSize: 14, color: INK, lineHeight: 21 }}>
                {blockedBody}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resultStore.clear();
                  captureStore.reset();
                  router.replace("/premium-skin-scan-v2/capture" as any);
                }}
                style={{
                  marginTop: 4,
                  alignSelf: "flex-start",
                  backgroundColor: SAGE,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: WHITE, fontWeight: "700", fontSize: 14 }}>Yeniden Tara</Text>
              </TouchableOpacity>
              <Text style={s.disclaimerText}>
                Bu sonuç fotoğraf destekli bakım önerisidir; kesin tıbbi tanı yerine geçmez.
              </Text>
            </Card>
          </>
          );
        })() : (
          <>
            {/* HERO */}
            <Card style={{ gap: 0 }}>
              <View style={s.heroRow}>
                <ScoreRing score={result.score} size={130} />
                <View style={s.heroRight}>
                  <Text style={s.skinTypeLabel}>{skinTypeLabel}</Text>
                  <View style={s.scorePill}>
                    <View style={[s.scoreDot, { backgroundColor: result.score >= 75 ? SAGE : COPPER }]} />
                    <Text style={s.scorePillTxt}>
                      {result.score >= 75 ? "İyi seviye" : result.score >= 60 ? "Orta seviye" : "Dikkat gerekiyor"}
                    </Text>
                  </View>
                  <Text style={s.commentText}>{result.comment}</Text>
                </View>
              </View>
              {/* ECZ4 STEP 4 — Dürüst dil disclaimer'ı (mevcut MUTED stilinde, redesign yok) */}
              <Text style={s.disclaimerText}>
                Bu sonuç fotoğraf destekli bakım önerisidir; kesin tıbbi tanı yerine geçmez.
              </Text>
            </Card>

            {/* BAKIM ÖNCELİKLERİ — eski "BULGULAR" başlığı dürüst dile çevrildi */}
            <Card>
              <SectionTitle label="BAKIM ÖNCELİKLERİ" />
              {result.concerns.slice(0, 3).map((c, i) => <ConcernRow key={i} text={c} idx={i} />)}
            </Card>
          </>
        )}

        {/* ── FINAL-HARD-LOCK TASK 5 — Güvenlik / Güvenli Kullanım Notu ─────── */}
        {showSafetyNote && (
          <Card style={{ borderWidth: 1, borderColor: `${COPPER}55`, backgroundColor: "#FBF6EE" }}>
            <SectionTitle label={isBlocked ? "GÜVENLİK UYARISI" : "GÜVENLİ KULLANIM NOTU"} />
            {bundle.safetyMessages.map((m, i) => (
              <Text key={i} style={{ fontSize: 13.5, color: INK, lineHeight: 20 }}>{m}</Text>
            ))}
          </Card>
        )}

        {/* DERİN ANALİZ KAPISI */}
        {!isSeckin && (
          <GateCard
            title="Derin Analiz"
            description="Daha ayrıntılı yorum, rafine endişe analizi ve kişiye özel derin öneri."
            onUpgrade={() => setSeckinModal(true)}
          />
        )}

        {/* ── ECZ-CTX-GATE-1 — gating ────────────────────────────────────────
             • blocked / pediatric → rutin & DB ürünleri tamamen gizli
             • minimal             → yalnızca temel bakım (ilk 2 adım), ileri
               adımlar ve DB ürün katalogu gizli
             • full                → eski tam görünüm
        */}
        {!isBlocked && !isPediatric && (() => {
          const morningSteps = isMinimal ? result.morning.slice(0, 2) : result.morning;
          const eveningSteps = isMinimal ? result.evening.slice(0, 2) : result.evening;
          return (
            <>
              <Card>
                <View style={s.routineHeader}>
                  <SectionTitle label="SABAH RUTİNİ" />
                  <Text style={s.routineEmoji}>☀</Text>
                </View>
                {isMinimal && (
                  <Text style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
                    Yalnız temel bakım — fotoğraf güveni sınırlı olduğu için detaylı adımlar atlandı.
                  </Text>
                )}
                {morningSteps.map((step, i) => (
                  <StepRow
                    key={step.name}
                    step={step}
                    index={i}
                    resolution={resolvedMorning[i]}
                    selectedProduct={selectedProducts[step.name] ?? null}
                    autoProduct={autoProducts[step.name] ?? null}
                    onPress={() => setAltStep(step)}
                  />
                ))}
              </Card>

              <Card>
                <View style={s.routineHeader}>
                  <SectionTitle label="AKŞAM RUTİNİ" />
                  <Text style={s.routineEmoji}>◑</Text>
                </View>
                {isMinimal && (
                  <Text style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
                    Yalnız temel bakım — detaylı katmanlar gösterilmiyor.
                  </Text>
                )}
                {eveningSteps.map((step, i) => (
                  <StepRow
                    key={step.name}
                    step={step}
                    index={i}
                    resolution={resolvedEvening[i]}
                    selectedProduct={selectedProducts[step.name] ?? null}
                    autoProduct={autoProducts[step.name] ?? null}
                    onPress={() => setAltStep(step)}
                  />
                ))}
              </Card>

              {/* ÜRÜNLER — minimal modda gizli (gerçek ürün önerisi sunmamak için) */}
              {!isMinimal && (
                <DbProductsCard morning={result.morning} evening={result.evening} />
              )}
            </>
          );
        })()}

      </ScrollView>

      {/* ── Alt CTA ───────────────────────────────────────────────────────── */}
      {/* ECZ-CTX-GATE-1 — blocked/pediatric: rutin kaydetme ve ürün inceleme
          akışı kapalı; yalnızca güvenli aksiyonlar (geçmiş, yeniden tara). */}
      <View style={[s.ctaBar, { paddingBottom: navBottom + 4 }]}>
        {!isBlocked && !isPediatric ? (
          <>
            {/* Primary */}
            <TouchableOpacity
              style={[s.primaryBtn, routineSaved && { backgroundColor: SAGE }]}
              onPress={handleSavePress}
              activeOpacity={0.82}
            >
              <Text style={s.primaryTxt}>
                {routineSaved ? "Şahsi Rutinime Git →" : "Rutinime Kaydet"}
              </Text>
            </TouchableOpacity>

            {/* Secondary */}
            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.push("/premium-skin-scan-v2/routine-program" as any)}
              activeOpacity={0.82}
            >
              <Text style={s.secondaryTxt}>Ürünleri İncele</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[s.primaryBtn, { backgroundColor: "#E0DAD0" }]}>
            <Text style={[s.primaryTxt, { color: MUTED }]}>
              {isPediatric
                ? "Bebek/çocuk için otomatik rutin sunulmuyor"
                : "Bu sonuçla rutin önerilmiyor"}
            </Text>
          </View>
        )}

        {/* Tertiary row */}
        <View style={s.tertiaryRow}>
          <TouchableOpacity
            style={[s.tertiaryBtn, { borderColor: `${COPPER}50` }]}
            onPress={() => router.push("/premium-skin-scan-v2/history" as any)}
            activeOpacity={0.82}
          >
            <Text style={[s.tertiaryTxt, { color: COPPER }]}>Geçmiş</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tertiaryBtn, { borderColor: `${SAGE}40` }]}
            onPress={restart}
            activeOpacity={0.8}
          >
            <Text style={[s.tertiaryTxt, { color: SAGE }]}>Yeniden Tara</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Seçkin Üyelik Modalı */}
      <SeckinModal visible={seckinModal} onClose={() => setSeckinModal(false)} />

      {/* Alternatifler Modalı */}
      <AltsModal
        visible={altStep !== null}
        step={altStep}
        onClose={() => setAltStep(null)}
        onSelect={handleSelectProduct}
      />

      {/* Rutin Kaydet Modalı */}
      <SaveRoutineModal
        visible={saveModal}
        mode={saveMode}
        onSetActive={doSetActive}
        onSaveOnly={doSaveOnly}
        onUpdate={doSetActive}
        onSaveNew={doSaveOnly}
        onDismiss={() => setSaveModal(false)}
      />

      {/* Alt Navigasyon */}
      <ScanBottomNav />
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: CREAM },

  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
  backTxt:       { color: MUTED, fontSize: 15 },
  pageTitle:     { fontSize: 15, fontWeight: "700", color: INK },

  scroll:        { flex: 1 },
  content:       { paddingHorizontal: 16, paddingTop: 12, gap: 14 },

  heroRow:       { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  heroRight:     { flex: 1, gap: 10, paddingTop: 4 },
  skinTypeLabel: { fontSize: 20, fontWeight: "800", color: INK },
  scorePill:     { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreDot:      { width: 7, height: 7, borderRadius: 3.5 },
  scorePillTxt:  { fontSize: 13, color: MUTED, fontWeight: "500" },
  commentText:   { fontSize: 13, color: MUTED, lineHeight: 19 },
  // ECZ4 STEP 4 — disclaimer (mevcut MUTED renk + ufak fontSize, layout değişmedi)
  disclaimerText:{ fontSize: 11, color: MUTED, lineHeight: 16, marginTop: 12, fontStyle: "italic" },

  routineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  routineEmoji:  { fontSize: 16 },
  divider:       { height: StyleSheet.hairlineWidth, backgroundColor: "#EEE" },

  // CTA Bar
  ctaBar:        {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: CREAM,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E0D9D0",
  },
  primaryBtn:    { backgroundColor: COPPER, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryTxt:    { color: WHITE, fontSize: 15, fontWeight: "700" },
  secondaryBtn:  { backgroundColor: `${SAGE}10`, paddingVertical: 12, borderRadius: 13, alignItems: "center", borderWidth: 1, borderColor: `${SAGE}30` },
  secondaryTxt:  { color: SAGE, fontSize: 14, fontWeight: "700" },
  tertiaryRow:   { flexDirection: "row", gap: 10 },
  tertiaryBtn:   { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, alignItems: "center", backgroundColor: "transparent" },
  tertiaryTxt:   { fontSize: 13, fontWeight: "600" },
});