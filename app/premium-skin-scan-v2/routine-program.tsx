/**
 * premium-skin-scan-v2 — RoutineProgramScreen  (Premium Yeniden Tasarım)
 *
 * Layout:
 *   1. Premium Header
 *   2. Cilt Insight Kartı (hero)
 *   3. Sabah Rutin Bloku
 *   4. Akşam Rutin Bloku
 *   5. Haftalık Blok (varsa)
 *   6. Rutin Evrimi Kartı
 *   7. Eczacı Notu Kartı
 *   8. Kaydet CTA (sticky alt)
 *
 * Hook'lar koşullu return'lardan ÖNCE · Easing KULLANILMAZ
 * Modal backdrop: TouchableWithoutFeedback + absoluteFillObject
 */

import { router }                        from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScanBottomNav, SCAN_NAV_HEIGHT }  from "@/components/ScanBottomNav";
import { GateCard, SeckinModal }           from "@/components/SeckinModal";
import { useAuth }                         from "@/local_demo_data/safe_runtime_shims_v74";
import {
  fetchAlternativesForStep,
  findProductByName,
  getProductImageUri,
  isProductValidForStep,
  type V2DBProduct,
  type V2Alternatives,
}                                          from "@/lib/premium-skin-scan-v2/v2ProductDB";
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
}                                          from "react-native";
import { useSafeAreaInsets }               from "react-native-safe-area-context";
import { resultStore }                     from "@/local_demo_data/safe_runtime_shims_v74";
import { SAFE_FALLBACK_BUNDLE }            from "@/lib/skinAnalysis/contextBundle";
import { applyScanRecommendationSafetyFilter } from "@/lib/skinAnalysis/recommendationSafetyFilter";
import { setNavigationProduct }            from "@/lib/productStore";
import { prefetchProductHeroImage }        from "@/lib/imagePrefetch";
import {
  routineProgramStore,
  buildRoutineFromAnalysis,
}                                          from "@/lib/premium-skin-scan-v2/routineProgramStore";
import type { RoutineStep, AnalysisResult } from "@/local_demo_data/safe_runtime_shims_v74";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";
const WHITE  = "#FFFFFF";
const GOLD   = "#B8965A";

// ─── İçerik Verileri ─────────────────────────────────────────────────────────

const STEP_WHY: Record<string, string> = {
  "Köpük temizleyici":           "Gün içinde biriken yüzey kirini ve fazla sebumu dengeli şekilde uzaklaştırır.",
  "Jel temizleyici":             "Yağ bazlı kirlilik ve gözenek tıkanıklığını net formülle temizler.",
  "Kremsi temizleyici":          "Kuruluğa yol açmadan kirleri çözer; nem bariyerini korur.",
  "Parfümsüz kremsi temizleyici":"Tetikleyici içerik içermez; hassas cilt için güvenli temizlik.",
  "Hassas cilt temizleyici":     "pH dengeli minimal formül ile kızarıklık riskini en aza indirir.",
  "Çift temizleme":              "İlk yağ bazlı aşama makyajı çözer; ikinci su bazlı aşama cildi netleştirir.",
  "Hyaluronik asit serum":       "Hücre düzeyinde nem çekerek tüm katmanlarda dolgunluk sağlar.",
  "Niacinamide serum":           "Gözenek görünümünü azaltır, ton eşitsizliğini dengeler, yağı regüle eder.",
  "Peptit serum":                "Kollajen sentezini uyarır; uzun vadede doku kalitesini yükseltir.",
  "Pantenol serum":              "Bariyer onarımını hızlandırır; tahriş olmuş cildi sakinleştirir.",
  "Hafif serum":                 "Cilt tonunu dengeleyen antioksidanlar ile yüzey eşitliği sağlar.",
  "Hafif nemlendirici":          "Hafif film tabakasıyla nem kaybını engeller; tıkayıcı değildir.",
  "Yağ-free nemlendirici":       "Yağ salgısını artırmadan yeterli hidrasyon sağlar.",
  "Zengin nemlendirici":         "Ceramid ve yağ asitleriyle derin katmanları besler, kurulukla savaşır.",
  "Kalın bariyer nemlendirici":  "Ceramid ve cholesterol ile bariyer fonksiyonunu doğrudan güçlendirir.",
  "Nemlendirici krem":           "Günlük nem ihtiyacını karşılar; cilt yüzeyini pürüzsüzleştirir.",
  "Yoğun gece kremi":            "Gece onarım döngüsünde nem depolarını yeniler.",
  "Onarıcı gece kremi":          "Anti-inflamatuar içeriklerle geceleri bariyer hasarını kapatır.",
  "SPF 50+ güneş koruyucu":      "UV hasarı en önemli yaşlanma sebebidir; SPF 50+ bu riski minimize eder.",
  "SPF 50 hafif formül":         "Yağlı cilt için mat bitişli geniş spektrumlu UV koruması.",
  "Mineral SPF 50+":             "Kimyasal filtre içermez; hassas cilt için en güvenli UV kalkan seçeneği.",
  "Hafif AHA toner":             "Ölü hücre birikmesini önler; ton eşitlenmesi ve geçirgenliği artırır.",
  "BHA toner":                   "Gözenek içine nüfuz ederek yağ tıkaçlarını çözer; akne riskini azaltır.",
  "Retinol (başlangıç dozu)":    "Hücre yenileme hızını artırır; uzun vadede doku kalitesini yükseltir.",
  "Göz altı kremi":              "Göz çevresi derisi çok ince; hedefli nem ve peptit desteği gerektirir.",
  "Göz kremi":                   "Hassas göz çevresi için özel nem ve sıkılaştırma desteği.",
  "Kil maskesi":                 "Haftada bir yüzey yağını ve gözenek kirlini yoğun şekilde temizler.",
  "Gözenek maskesi":             "Siyah nokta ve tıkanmış gözenek görünümünü haftalık düzenler.",
  "BHA yüz maskesi":             "Hem yüzey hem gözenek içi için kimyasal eksfoliyasyon sağlar.",
  "Yoğun nemlendirici maske":    "Nem depolarını tek seansta dolduran yoğun bakım maskesi.",
  "Yüz yağı masajı":            "Kan dolaşımını canlandırır; aktif içeriklerin emilimini artırır.",
  "Hafif kil maske":             "Genel bakım olarak yüzey dengesini düzenli korur.",
  "Yatıştırıcı maske":           "Bitkisel anti-inflamatuar içeriklerle haftalık kızarıklık baskılaması.",
  "Bariyer bakım maskesi":       "Ceramid yoğunlaştırılmış formülle bariyer hasarını haftalık kapatır.",
  "Hafif eksfoliasyon":          "Ölü hücre tabakasını incelterek cilt yüzeyini canlandırır.",
};

const STEP_TARGET: Record<string, string[]> = {
  "Köpük temizleyici":           ["Sebum", "Gözenek"],
  "Jel temizleyici":             ["Yağ", "Gözenek"],
  "Kremsi temizleyici":          ["Bariyer", "Nem"],
  "Parfümsüz kremsi temizleyici":["Hassasiyet", "pH"],
  "Hassas cilt temizleyici":     ["Kızarıklık", "pH"],
  "Çift temizleme":              ["Makyaj", "Güneş kremi"],
  "Hyaluronik asit serum":       ["Hidrasyon", "Dolgunluk"],
  "Niacinamide serum":           ["Gözenek", "Ton", "Yağ"],
  "Peptit serum":                ["Sıkılaşma", "Kollajen"],
  "Pantenol serum":              ["Bariyer", "Tahriş"],
  "Hafif serum":                 ["Antioksidan", "Ton"],
  "Hafif nemlendirici":          ["Nem kilidi", "Hafiflik"],
  "Yağ-free nemlendirici":       ["Nem", "Yağ kontrolü"],
  "Zengin nemlendirici":         ["Derin nem", "Ceramid"],
  "Kalın bariyer nemlendirici":  ["Bariyer", "Ceramid"],
  "Nemlendirici krem":           ["Günlük nem", "Pürüzsüzlük"],
  "Yoğun gece kremi":            ["Gece onarımı", "Nem"],
  "Onarıcı gece kremi":          ["Gece bariyeri", "Sakinleştirme"],
  "SPF 50+ güneş koruyucu":      ["UV", "Fotoaging"],
  "SPF 50 hafif formül":         ["UV", "Mat görünüm"],
  "Mineral SPF 50+":             ["UV", "Hassas koruma"],
  "Hafif AHA toner":             ["Ölü hücre", "Ton"],
  "BHA toner":                   ["Gözenek", "Akne"],
  "Retinol (başlangıç dozu)":    ["Hücre yenileme", "Doku"],
  "Göz altı kremi":              ["Göz çevresi", "Peptit"],
  "Göz kremi":                   ["Göz çevresi", "Sıkılaşma"],
  "Kil maskesi":                 ["Gözenek", "Yağ"],
  "Gözenek maskesi":             ["Siyah nokta", "Gözenek"],
  "BHA yüz maskesi":             ["Eksfoliyasyon", "Gözenek"],
  "Yoğun nemlendirici maske":    ["Yoğun nem", "Derinlemesine"],
  "Yüz yağı masajı":            ["Dolaşım", "Emilim"],
  "Hafif kil maske":             ["Yüzey dengesi"],
  "Yatıştırıcı maske":           ["Kızarıklık", "Sakinlik"],
  "Bariyer bakım maskesi":       ["Bariyer", "Ceramid"],
  "Hafif eksfoliasyon":          ["Ölü hücre", "Canlılık"],
};

type HeroData = { direction: string; focus: string; expertLine: string };
const HERO_INSIGHTS: Record<string, HeroData> = {
  Karma: {
    direction: "Dengeleyici · Bölgesel bakım",
    focus:     "T bölgesini kontrol altında tutarken yanakların nemini koruma",
    expertLine:"Karma cilt iki farklı ihtiyacı aynı anda yönetir. Bu plan, bölgesel formüller seçerek o dengeyi kurar.",
  },
  Yağlı: {
    direction: "Sebum düzenleyici · Gözenek bakımı",
    focus:     "Yağ salgısını dengelemek ve gözenekleri açık tutmak",
    expertLine:"Yağlı cilt aşırı temizlemeden değil; akıllı dengelemeden fayda görür. Bu plan tam bunu sağlar.",
  },
  Kuru: {
    direction: "Onarıcı · Yoğun nemlendirici",
    focus:     "Nem bariyerini güçlendirmek ve katmanlı hidrasyon sağlamak",
    expertLine:"Nem sadece yüzey meselesi değil; bariyer bütünlüğü korunmadan kalıcı sonuç alınamaz.",
  },
  Normal: {
    direction: "Koruyucu · Sürdürülebilir bakım",
    focus:     "Mevcut denge korunarak hafif destek sağlamak",
    expertLine:"Normal cilt ince ayar ister. Bu plan, dengeyi bozmadan cildi en iyi hâlinde tutar.",
  },
  Hassas: {
    direction: "Sakinleştirici · Bariyer odaklı",
    focus:     "Tetikleyicileri azaltmak, reaktiviteyi düşürmek",
    expertLine:"Hassas ciltte daha az, daha seçici demektir. Bu plan yalnızca kanıtlanmış içerikleri kullanır.",
  },
};

const ROUTINE_EVOLUTION: Record<string, string[]> = {
  Karma: [
    "2–3. haftada T bölgesi yağ dengesi düzene girerse hafif AHA toner eklenebilir.",
    "6. haftada gözenek görünümü haritalaması yapılarak BHA değerlendirilebilir.",
    "Mevsim geçişlerinde nemlendirici yoğunluğu yeniden düzenlenebilir.",
  ],
  Yağlı: [
    "İlk 3 haftada cilt temizleme tepkisini değerlendirin; aşırı kuruma varsa krem temizleyiciye geçin.",
    "4–6. haftada yağ kontrolü sağlandıysa düşük dozda retinol girilebilir.",
    "Yazın SPF dokusu hafifletilir, kışın nemlendirici katmanlanabilir.",
  ],
  Kuru: [
    "3 haftalık kullanım sonrası sıkışma hissi azalmazsa seruma oküzif eklenebilir.",
    "6. haftada cilt tepkisi stabilse hafif peptit veya retinol değerlendirilebilir.",
    "Kış aylarında gece kremi yoğunluğu artırılabilir.",
  ],
  Normal: [
    "2–3 hafta sonra C vitamini serum eklenebilir.",
    "Cilt tonu düzeldikçe hafif eksfoliasyon haftaya bir dahil edilir.",
    "6. haftada genel değerlendirmeyle preventif aktif bileşen girilebilir.",
  ],
  Hassas: [
    "İlk 4 hafta sadece mevcut adımlara bağlı kalın; yeni içerik eklemeyin.",
    "Reaktivite düştükten sonra niacinamide gibi tolere edilen bir aktif test edilir.",
    "Herhangi adımda kızarıklık görülürse sadece temizleyici + nemlendirici + SPF'ye dönün.",
  ],
};

const PHARMACIST_NOTES: Record<string, string> = {
  Karma:  "Bu rutin sade görünebilir; ama içeriklerin kombinasyonu kasıtlı. Niacinamide ve BHA'yı aynı seansta kullanmayın — biri sabah, biri akşam işe yarar.",
  Yağlı:  "Yağ kontrolü için cilt kurutmak doğal değil. Cilt kurudukça daha fazla yağ üretir. Bu rutindeki hafif nemlendiriciler tam bu yüzden var.",
  Kuru:   "Hyaluronik asit nemli yüze uygulanmalı. Kuru yüzeye uygulanırsa ciltten nem çekebilir. Uygulamadan önce yüzü hafif ıslak bırakın.",
  Normal: "Normal cilt bazen 'rutin gerekmez' yanılgısı yaratır. UV hasarı birikimlidir; güneş koruyucu bu rutinin en kritik adımıdır.",
  Hassas: "Yeni ürün deniyorsanız önce boyun çizgisinde 48 saat test yapın. Alerjik reaksiyon değil; tahriş tepkisi arıyorsunuz.",
};

// ─── Ürün detail navigasyonu ──────────────────────────────────────────────────
// ECZ4 Step 2: name fallback DB hit'inde prefetch + setNavigationProduct →
// ürün detayı sıcak paint. id-only branch enrichment yapılamaz, cold remain.

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

// ─── Hero Insight Kartı ───────────────────────────────────────────────────────

function InsightCard({ analysis }: { analysis: AnalysisResult }) {
  const skinType = analysis.skinType ?? "Karma";
  const insight: HeroData = HERO_INSIGHTS[skinType] ?? HERO_INSIGHTS["Normal"];
  // ECZ4 score-consistency fix: ölü `?? 72` kaldırıldı. analysis daima
  // resultStore.get() veya buildFallback() (score: 70) sağlar; ikinci
  // varsayılana düşmek tek truth ilkesini kırıyordu.
  const score = analysis.score;
  const concerns = (analysis.concerns ?? []).slice(0, 2);

  return (
    <View style={ic.card}>
      <View style={ic.topRow}>
        <View style={ic.leftSide}>
          <View style={ic.typePill}>
            <Text style={ic.typeLabel}>{skinType} Cilt</Text>
          </View>
          <Text style={ic.direction}>{insight.direction}</Text>
        </View>
        <View style={ic.scoreBubble}>
          <Text style={ic.scoreNum}>{score}</Text>
          <Text style={ic.scoreSub}>skor</Text>
        </View>
      </View>

      <Text style={ic.focus}>{insight.focus}</Text>

      {concerns.length > 0 && (
        <View style={ic.concernRow}>
          {concerns.map((c, i) => (
            <View key={i} style={ic.concernPill}>
              <Text style={ic.concernTxt}>{c}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={ic.divider} />
      <Text style={ic.expertLine}>{insight.expertLine}</Text>
    </View>
  );
}

const ic = StyleSheet.create({
  card:        { backgroundColor: WHITE, borderRadius: 20, padding: 20, gap: 14,
                 borderWidth: 1, borderColor: `${COPPER}30`,
                 shadowColor: COPPER, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 3 },
  topRow:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  leftSide:    { flex: 1, gap: 6 },
  typePill:    { alignSelf: "flex-start", backgroundColor: `${SAGE}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeLabel:   { fontSize: 12, fontWeight: "700", color: SAGE, letterSpacing: 0.4 },
  direction:   { fontSize: 13, color: MUTED, fontWeight: "500", lineHeight: 18 },
  scoreBubble: { width: 52, height: 52, borderRadius: 26, backgroundColor: `${COPPER}15`,
                 borderWidth: 1.5, borderColor: `${COPPER}40`,
                 alignItems: "center", justifyContent: "center", gap: 1 },
  scoreNum:    { fontSize: 17, fontWeight: "800", color: GOLD, lineHeight: 20 },
  scoreSub:    { fontSize: 9, color: COPPER, fontWeight: "600", letterSpacing: 0.3 },
  focus:       { fontSize: 15, fontWeight: "700", color: INK, lineHeight: 22 },
  concernRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  concernPill: { backgroundColor: `${COPPER}12`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: `${COPPER}25` },
  concernTxt:  { fontSize: 11.5, color: GOLD, fontWeight: "600" },
  divider:     { height: StyleSheet.hairlineWidth, backgroundColor: "#EDE8E0" },
  expertLine:  { fontSize: 13, color: MUTED, lineHeight: 20, fontStyle: "italic" },
});

// ─── Rutin Adım Satırı ────────────────────────────────────────────────────────

function PremiumStepRow({
  step,
  index,
  overrideProduct,
  onAltPress,
}: {
  step:            RoutineStep;
  index:           number;
  overrideProduct: V2DBProduct | null;
  onAltPress:      (step: RoutineStep) => void;
}) {
  // ECZ4 STEP-PRODUCT-CACHE — result.tsx aynı stepName için zaten birinci
  // ürünü hesapladıysa cache'ten oku ve fetch'i atla. Bu, "Ürünleri İncele"
  // ekranındaki birincil ürünün result ekranındakiyle birebir aynı olmasını
  // garanti eder (yarışı/önbellek farkını ortadan kaldırır).
  const cached = resultStore.getStepProduct(step.name);
  const [autoProduct, setAutoProduct] = useState<V2DBProduct | null>(cached);
  const [fetching,    setFetching]    = useState(cached === null && !resultStore.hasStepProduct(step.name));

  useEffect(() => {
    // Cache hit: result.tsx'in seçimini aynen göster, fetch atla.
    if (resultStore.hasStepProduct(step.name)) {
      const c = resultStore.getStepProduct(step.name);
      // ECZ4 SAVED-ROUTINE-FIX-3 (rev3 — architect feedback): cache-hit
      // path'i önceki taramanın bundle'ıyla seçilmiş ürünü tutuyor olabilir.
      // history-detail viewing_saved_routine geçişi bundle'ı conservative
      // moda alır ama cache aynı kalır → eski full-mode'da seçilmiş aktif-ağır
      // ürün sızabilir. Çözüm: cache-hit'te de güncel bundle ile safety
      // filter'dan tekrar geçir; reddedilirse null göster ve kullanıcı
      // "Alternatif ara"ya yönlensin.
      let safe: V2DBProduct | null = c;
      if (c) {
        const bundleNow = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
        const passes = applyScanRecommendationSafetyFilter([c], bundleNow, { stepName: step.name }).products;
        safe = passes[0] ?? null;
        if (safe === null) {
          console.log(
            `[SkinScan][SavedRoutineProductFallback] step="${step.name}" cached product "${c.name}" rejected by safety filter (bundle mode change)`,
          );
        }
      }
      setAutoProduct(safe);
      setFetching(false);
      console.log(`[PremiumStepRow] "${step.name}" → CACHE: "${safe?.name ?? "yok"}"`);
      return;
    }
    let alive = true;
    fetchAlternativesForStep(step.name)
      .then((alts) => {
        if (!alive) return;
        const allCandidates = [
          ...alts.profesyonel,
          ...alts.ekonomik,
          ...alts.seckin,
        ];
        const candidates = allCandidates.filter((p) => isProductValidForStep(p, step.name));
        const rejected = allCandidates.length - candidates.length;
        if (rejected > 0) {
          // ECZ4 SAVED-ROUTINE-FIX-1 — kategori uyuşmazlıkları görünür log.
          // (örn. eski bug'da "Göz Altı Kremi - Peptit" altına serum sızdığında
          // hard validation reddederdi; şimdi düzeltildi ama log korunur.)
          console.log(
            `[SkinScan][SavedRoutineProductFallback] step="${step.name}" rejected ${rejected}/${allCandidates.length} wrong-category candidates`,
          );
        }
        // ECZ-REC-GATE-1: scan-derived autoProduct öneri filtresi
        const b = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
        const safe = applyScanRecommendationSafetyFilter(candidates, b, { stepName: step.name }).products;
        const best = safe[0] ?? null;
        console.log(`[PremiumStepRow] "${step.name}" → birincil: "${best?.name ?? "yok"}" | img: ${best ? (getProductImageUri(best) ? "var" : "yok") : "-"}`);
        // Yeni hesaplandı → cache'e yaz; sonraki ziyaretler için tutarlı kalsın.
        resultStore.setStepProduct(step.name, best);
        setAutoProduct(best);
      })
      .catch(() => { if (alive) setAutoProduct(null); })
      .finally(() => { if (alive) setFetching(false); });
    return () => { alive = false; };
  }, [step.name]);

  const displayProduct = overrideProduct ?? autoProduct;
  const imgUri         = displayProduct ? getProductImageUri(displayProduct) : null;
  const why            = STEP_WHY[step.name]    ?? "Bu adım cilt sağlığını destekler.";
  const targets        = STEP_TARGET[step.name] ?? [];
  const roleColor      = step.role === "Esas" ? SAGE : step.role === "Destek" ? COPPER : MUTED;
  const hasOverride    = overrideProduct !== null;

  return (
    <View style={sr.card}>
      {/* Başlık */}
      <View style={sr.header}>
        <View style={[sr.numBadge, { backgroundColor: `${roleColor}18` }]}>
          <Text style={[sr.numTxt, { color: roleColor }]}>{index + 1}</Text>
        </View>
        <View style={sr.headerText}>
          <Text style={sr.stepName}>{step.name}</Text>
          <View style={[sr.rolePill, { backgroundColor: `${roleColor}14` }]}>
            <Text style={[sr.roleLabel, { color: roleColor }]}>{step.role}</Text>
          </View>
          {hasOverride && (
            <View style={sr.selectedBadge}>
              <Text style={sr.selectedBadgeTxt}>✓ Seçildi</Text>
            </View>
          )}
        </View>
      </View>

      {/* WHY */}
      <Text style={sr.why}>{why}</Text>

      {/* Target tags */}
      {targets.length > 0 && (
        <View style={sr.tagRow}>
          {targets.map((tag, i) => (
            <View key={i} style={sr.tag}>
              <Text style={sr.tagTxt}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Primary product — with image */}
      <View style={sr.productWrap}>
        {fetching && !overrideProduct ? (
          <View style={sr.skeleton}>
            <View style={sr.skeletonImg} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={sr.skeletonBar} />
              <View style={[sr.skeletonBar, { width: "40%", opacity: 0.5 }]} />
            </View>
          </View>
        ) : displayProduct ? (
          <TouchableOpacity
            style={sr.productPill}
            onPress={() => {
              console.log(`[PremiumStepRow] Tıklandı: "${displayProduct.name}" (id: ${displayProduct.id})`);
              goToProduct(displayProduct.name, displayProduct.id);
            }}
            activeOpacity={0.72}
          >
            {/* Ürün görseli */}
            {imgUri ? (
              <Image
                source={{ uri: imgUri }}
                style={sr.productImg}
                resizeMode="contain"
              />
            ) : (
              <View style={[sr.productImg, sr.productImgPlaceholder]}>
                <Text style={sr.productImgFallback}>
                  {(displayProduct.name ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={sr.productMid}>
              <Text style={sr.productName} numberOfLines={1}>{displayProduct.name}</Text>
              {(displayProduct.brand || displayProduct.short_benefit) && (
                <Text style={sr.productBrand} numberOfLines={1}>
                  {displayProduct.brand ?? displayProduct.short_benefit}
                </Text>
              )}
            </View>
            <Text style={sr.productChev}>›</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={sr.noMatchWrap} onPress={() => onAltPress(step)} activeOpacity={0.75}>
            <Text style={sr.noMatchTxt}>Bu adım için henüz uygun ürün eşleşmedi.</Text>
            <Text style={sr.noMatchHint}>Alternatif ara →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Alt link */}
      <TouchableOpacity
        style={sr.altRow}
        onPress={() => onAltPress(step)}
        activeOpacity={0.7}
      >
        <Text style={sr.altTxt}>
          {displayProduct ? "Değiştir · Tüm alternatifleri gör" : "Ürün ara"}
        </Text>
        <Text style={sr.altChev}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const sr = StyleSheet.create({
  card:               { backgroundColor: WHITE, borderRadius: 18, padding: 18, gap: 12,
                        borderWidth: 1, borderColor: "#EEEAE3",
                        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  header:             { flexDirection: "row", alignItems: "center", gap: 12 },
  numBadge:           { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  numTxt:             { fontSize: 13, fontWeight: "800" },
  headerText:         { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  stepName:           { flex: 1, fontSize: 15.5, fontWeight: "700", color: INK },
  rolePill:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleLabel:          { fontSize: 11, fontWeight: "700" },
  selectedBadge:      { backgroundColor: `${SAGE}18`, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  selectedBadgeTxt:   { fontSize: 10, color: SAGE, fontWeight: "700" },

  why:                { fontSize: 13, color: MUTED, lineHeight: 19 },

  tagRow:             { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tag:                { backgroundColor: "#F0ECE5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagTxt:             { fontSize: 11, color: MUTED, fontWeight: "600" },

  productWrap:        { marginTop: 2 },
  skeleton:           { flexDirection: "row", gap: 10, paddingVertical: 8, alignItems: "center" },
  skeletonImg:        { width: 48, height: 48, borderRadius: 12, backgroundColor: "#EDEAE4", flexShrink: 0 },
  skeletonBar:        { height: 12, width: "65%", borderRadius: 6, backgroundColor: "#EDEAE4" },

  productPill:        { flexDirection: "row", alignItems: "center", gap: 10,
                        backgroundColor: `${SAGE}0C`, borderRadius: 14, borderWidth: 1, borderColor: `${SAGE}25`,
                        paddingHorizontal: 12, paddingVertical: 10 },
  productImg:         { width: 48, height: 48, borderRadius: 12, backgroundColor: "#EEE9E0", flexShrink: 0 },
  productImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  productImgFallback: { fontSize: 18, color: MUTED, fontWeight: "700" },
  productMid:         { flex: 1, gap: 2 },
  productName:        { fontSize: 14, fontWeight: "700", color: INK },
  productBrand:       { fontSize: 11.5, color: MUTED },
  productChev:        { fontSize: 20, color: SAGE, lineHeight: 24 },

  selectBtn:          { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
                        borderWidth: 1.5, borderColor: `${SAGE}35`, borderStyle: "dashed",
                        alignItems: "center" },
  selectBtnTxt:       { fontSize: 13, color: SAGE, fontWeight: "700" },

  noMatchWrap:        { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
                        backgroundColor: `${MUTED}08`, gap: 3 },
  noMatchTxt:         { fontSize: 12.5, color: MUTED, fontStyle: "italic" },
  noMatchHint:        { fontSize: 12, color: COPPER, fontWeight: "600" },

  altRow:             { flexDirection: "row", alignItems: "center", gap: 4,
                        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EDE8E0", paddingTop: 12 },
  altTxt:             { fontSize: 12.5, color: COPPER, fontWeight: "600" },
  altChev:            { fontSize: 15, color: COPPER, fontWeight: "400" },
});

// ─── Rutin Bloku (Sabah / Akşam / Haftalık) ──────────────────────────────────

function RoutineBlock({
  title,
  subtitle,
  steps,
  selectedProducts,
  onAltPress,
}: {
  title:            string;
  subtitle:         string;
  steps:            RoutineStep[];
  selectedProducts: Record<string, V2DBProduct>;
  onAltPress:       (step: RoutineStep) => void;
}) {
  if (steps.length === 0) return null;
  return (
    <View style={rb2.wrap}>
      <View style={rb2.header}>
        <View style={rb2.headerLeft}>
          <Text style={rb2.title}>{title}</Text>
          <Text style={rb2.subtitle}>{subtitle}</Text>
        </View>
        <View style={rb2.stepCount}>
          <Text style={rb2.stepCountTxt}>{steps.length} adım</Text>
        </View>
      </View>
      <View style={rb2.steps}>
        {steps.map((step, i) => (
          <PremiumStepRow
            key={`${step.name}-${i}`}
            step={step}
            index={i}
            overrideProduct={selectedProducts[step.name] ?? null}
            onAltPress={onAltPress}
          />
        ))}
      </View>
    </View>
  );
}

const rb2 = StyleSheet.create({
  wrap:          { gap: 12 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                   paddingHorizontal: 4 },
  headerLeft:    { gap: 2 },
  title:         { fontSize: 17, fontWeight: "800", color: INK, letterSpacing: -0.3 },
  subtitle:      { fontSize: 12, color: MUTED, fontWeight: "500" },
  stepCount:     { backgroundColor: `${SAGE}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  stepCountTxt:  { fontSize: 12, color: SAGE, fontWeight: "700" },
  steps:         { gap: 10 },
});

// ─── Rutin Evrimi Kartı ───────────────────────────────────────────────────────

function EvolutionCard({ skinType }: { skinType: string }) {
  const items = ROUTINE_EVOLUTION[skinType] ?? ROUTINE_EVOLUTION["Normal"];
  return (
    <View style={ev.card}>
      <View style={ev.header}>
        <Text style={ev.icon}>◎</Text>
        <View>
          <Text style={ev.title}>Rutinin Gelişimi</Text>
          <Text style={ev.sub}>Önümüzdeki haftalar</Text>
        </View>
      </View>
      {items.map((item, i) => (
        <View key={i} style={ev.row}>
          <View style={ev.dot} />
          <Text style={ev.rowTxt}>{item}</Text>
        </View>
      ))}
      <View style={ev.note}>
        <Text style={ev.noteTxt}>
          Bu öngörüler cilt cevabına göre sonraki analizde güncellenir.
        </Text>
      </View>
    </View>
  );
}

const ev = StyleSheet.create({
  card:    { backgroundColor: `${SAGE}0A`, borderRadius: 18, padding: 18, gap: 14,
             borderWidth: 1, borderColor: `${SAGE}25` },
  header:  { flexDirection: "row", alignItems: "center", gap: 12 },
  icon:    { fontSize: 22, color: SAGE },
  title:   { fontSize: 16, fontWeight: "800", color: INK },
  sub:     { fontSize: 12, color: MUTED },
  row:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: SAGE, marginTop: 6, flexShrink: 0 },
  rowTxt:  { flex: 1, fontSize: 13, color: INK, lineHeight: 20 },
  note:    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${SAGE}30`, paddingTop: 12 },
  noteTxt: { fontSize: 12, color: MUTED, fontStyle: "italic" },
});

// ─── Eczacı Notu Kartı ────────────────────────────────────────────────────────

function ExpertNoteCard({ skinType }: { skinType: string }) {
  const note = PHARMACIST_NOTES[skinType] ?? PHARMACIST_NOTES["Normal"];
  return (
    <View style={en.card}>
      <View style={en.header}>
        <View style={en.badge}>
          <Text style={en.badgeTxt}>Uzman Notu</Text>
        </View>
      </View>
      <Text style={en.note}>{note}</Text>
    </View>
  );
}

const en = StyleSheet.create({
  card:     { backgroundColor: `${COPPER}0C`, borderRadius: 18, padding: 18, gap: 12,
              borderWidth: 1, borderColor: `${COPPER}28` },
  header:   { flexDirection: "row" },
  badge:    { backgroundColor: `${COPPER}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTxt: { fontSize: 11, color: GOLD, fontWeight: "800", letterSpacing: 0.5 },
  note:     { fontSize: 14, color: INK, lineHeight: 22 },
});

// ─── Alternatifler Modalı (DB-bağlı) ─────────────────────────────────────────

type AltFetchState = "idle" | "loading" | "results" | "empty" | "error";

function AltModal({
  visible,
  step,
  onClose,
  onSelect,
}: {
  visible:   boolean;
  step:      RoutineStep | null;
  onClose:   () => void;
  onSelect?: (product: V2DBProduct) => void;
}) {
  const EMPTY: V2Alternatives = { ekonomik: [], profesyonel: [], seckin: [] };
  const [dbAlts, setDbAlts]   = useState<V2Alternatives>(EMPTY);
  const [state,  setState]    = useState<AltFetchState>("idle");

  const doFetch = useCallback(() => {
    if (!step) return;
    setState("loading");
    fetchAlternativesForStep(step.name)
      .then((alts) => {
        // ECZ-REC-GATE-1: routine-program AltModal güvenlik filtresi
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

  function DBRow({ item }: { item: V2DBProduct }) {
    const imgUri = getProductImageUri(item);
    return (
      <View style={am.productRow}>
        {/* Görsel */}
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={am.productImg} resizeMode="contain" />
        ) : (
          <View style={[am.productImg, am.productImgPlaceholder]}>
            <Text style={am.productImgFallback}>{(item.name ?? "?").charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {/* İsim + fayda */}
        <TouchableOpacity
          style={am.productLeft}
          onPress={() => {
            console.log(`[AltModal] Ürüne gidiliyor: "${item.name}" (id: ${item.id})`);
            goToProduct(item.name, item.id);
          }}
          activeOpacity={0.72}
        >
          <Text style={am.productName}>{item.name}</Text>
          {(item.short_benefit || item.brand) ? (
            <Text style={am.productReason} numberOfLines={1}>{item.short_benefit ?? item.brand}</Text>
          ) : null}
        </TouchableOpacity>
        {/* Seç butonu (varsa) */}
        {onSelect ? (
          <TouchableOpacity
            style={am.selectBtn}
            onPress={() => {
              console.log(`[AltModal] Seçildi: "${item.name}" → adım "${step!.name}"`);
              onSelect(item);
              onClose();
            }}
            activeOpacity={0.8}
          >
            <Text style={am.selectTxt}>Seç</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => goToProduct(item.name, item.id)} hitSlop={8}>
            <Text style={am.chevron}>›</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function DBSection({ title, icon, items }: { title: string; icon: string; items: V2DBProduct[] }) {
    if (!items.length) return null;
    return (
      <View style={am.tierWrap}>
        <View style={am.tierHeader}>
          <Text style={am.tierIcon}>{icon}</Text>
          <Text style={am.tierTitle}>{title} ({items.length})</Text>
        </View>
        {items.map((item) => <DBRow key={item.id} item={item} />)}
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
    return (
      <ScrollView showsVerticalScrollIndicator={false} style={am.scroll} contentContainerStyle={{ gap: 14 }}>
        {onSelect && (
          <Text style={am.selectHint}>Adım için ürün seçmek üzere "Seç" butonuna basın</Text>
        )}
        <DBSection title="Ekonomik"    icon="◦" items={dbAlts.ekonomik} />
        {dbAlts.ekonomik.length > 0 && (dbAlts.profesyonel.length + dbAlts.seckin.length) > 0 && <View style={am.divider} />}
        <DBSection title="Profesyonel" icon="◈" items={dbAlts.profesyonel} />
        {dbAlts.profesyonel.length > 0 && dbAlts.seckin.length > 0 && <View style={am.divider} />}
        <DBSection title="Seçkin"      icon="✦" items={dbAlts.seckin} />
      </ScrollView>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={am.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <View style={am.sheet}>
          <View style={am.handle} />
          <Text style={am.title}>{step.name}</Text>
          <Text style={am.subtitle}>
            {onSelect ? "Bu adım için ürün seç" : "Bu adım için ürün seçenekleri"}
          </Text>
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
  sheet:            { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, maxHeight: "85%" },
  handle:           { width: 36, height: 4, backgroundColor: "#DDD", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title:            { fontSize: 17, fontWeight: "700", color: INK, marginBottom: 2 },
  subtitle:         { fontSize: 13, color: MUTED, marginBottom: 16 },
  selectHint:       { fontSize: 12, color: COPPER, fontStyle: "italic", marginBottom: 4 },
  scroll:           { maxHeight: 360 },
  tierWrap:         { gap: 10 },
  tierHeader:       { flexDirection: "row", alignItems: "center", gap: 6 },
  tierIcon:         { fontSize: 13, color: MUTED },
  tierTitle:        { fontSize: 12, fontWeight: "700", color: MUTED },
  productRow:       { flexDirection: "row", alignItems: "center", gap: 10,
                      paddingVertical: 8, paddingHorizontal: 10,
                      borderRadius: 12, borderWidth: 1, borderColor: "#F0EBE3",
                      backgroundColor: "#FAFAF8", marginBottom: 4 },
  productImg:       { width: 42, height: 42, borderRadius: 10, backgroundColor: "#EDEAE4", flexShrink: 0 },
  productImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  productImgFallback:    { fontSize: 16, color: MUTED, fontWeight: "700" },
  productLeft:      { flex: 1, gap: 2 },
  productName:      { fontSize: 13, fontWeight: "600", color: INK },
  productReason:    { fontSize: 12, color: MUTED },
  selectBtn:        { backgroundColor: SAGE, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  selectTxt:        { fontSize: 12, fontWeight: "700", color: WHITE },
  chevron:          { fontSize: 18, color: MUTED, paddingLeft: 4 },
  divider:          { height: StyleSheet.hairlineWidth, backgroundColor: "#EEE" },
  closeBtn:         { marginTop: 16, paddingVertical: 13, borderRadius: 14, backgroundColor: `${SAGE}12`, alignItems: "center", borderWidth: 1, borderColor: `${SAGE}30` },
  closeTxt:         { fontSize: 15, fontWeight: "700", color: SAGE },
  stateWrap:        { padding: 24, alignItems: "center", gap: 8 },
  stateEmoji:       { fontSize: 28, marginBottom: 4 },
  stateTxt:         { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 19 },
  retryBtn:         { marginTop: 4, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 12, backgroundColor: `${SAGE}15`, borderWidth: 1, borderColor: `${SAGE}30` },
  retryTxt:         { fontSize: 13, fontWeight: "700", color: SAGE },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function RoutineProgramScreen() {
  const { top, bottom }           = useSafeAreaInsets();
  const { isSeckin }              = useAuth();
  const [altStep, setAltStep]     = useState<RoutineStep | null>(null);
  const [saved, setSaved]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [seckinModal, setSeckinModal] = useState(false);
  /** Kullanıcının manuel seçtiği ürünler: stepName → V2DBProduct */
  const [selectedProducts, setSelectedProducts] = useState<Record<string, V2DBProduct>>({});

  // ── ECZ-FINAL-CLEAN-1 — Doğrudan giriş guard ─────────────────────────────
  // Kullanıcı tarama yapmadan doğrudan bu ekrana gelirse buildFallback()
  // sahte "Karma / 70" sonucu UI'a sızdırırdı. Artık real result yoksa
  // güvenli boş durum gösterip taramaya yönlendiriyoruz. buildFallback()
  // legacy yardımcı olarak korunuyor (handleSave / başka tüketiciler için).
  const realResult = resultStore.get();
  const analysis: AnalysisResult = realResult ?? buildFallback();
  const skinType = analysis.skinType ?? "Karma";

  // ── ECZ-CTX-GATE-1 — bundle gating ────────────────────────────────────────
  const bundle = resultStore.getContextBundle() ?? SAFE_FALLBACK_BUNDLE;
  const isBlocked   = bundle.routineEligibility === "blocked";
  const isPediatric = bundle.riskMode === "pediatric";
  const isMinimal   = bundle.routineEligibility === "minimal";
  // Pediatric ASLA full kozmetik rutin göstermez; blocked olmasa bile
  // adult routine bloklarını saklar.
  const hideAdultRoutine = isBlocked || isPediatric;

  function handleSelectProduct(product: V2DBProduct) {
    if (!altStep) return;
    console.log(`[RoutineProgramScreen] "${altStep.name}" adımına "${product.name}" seçildi`);
    setSelectedProducts((prev) => ({ ...prev, [altStep.name]: product }));
  }

  async function handleSave() {
    if (saving || saved) return;
    // ── ECZ-FINAL-QA-FIX-1 — bundle-driven save gate (result.tsx ile aynı) ──
    // routine-program direct-entry'de de aynı kuralı uygula. Bundle yoksa
    // SAFE_FALLBACK_BUNDLE → minimal/low_confidence → save engellenir.
    // Ek olarak: view-only (kayıtlı rutin görüntüleme) modunda re-save
    // engellenir — kullanıcı yeni bir tarama yapmadan eski rutini "yeniden
    // kaydedip" sahte güven üretmesin.
    const isViewingSaved = bundle.cannotDetermineFields.includes("viewing_saved_routine");
    if (isViewingSaved) {
      const { Alert } = await import("react-native");
      Alert.alert(
        "Kayıtlı rutin görüntüleniyor",
        "Bu rutin daha önce kaydedilmiş. Yeniden kaydetmek için yeni bir cilt taraması yapmanız gerekir.",
        [{ text: "Tamam" }],
      );
      return;
    }
    const reliabilityOk = bundle.resultReliabilityLevel === "high" || bundle.resultReliabilityLevel === "medium";
    const riskOk = bundle.riskMode === "normal" || bundle.riskMode === "sensitive";
    const eligibilityOk = bundle.routineEligibility === "full";
    if (!reliabilityOk || !riskOk || !eligibilityOk) {
      const { Alert } = await import("react-native");
      const msg = bundle.riskMode === "pediatric"
        ? "Bebek/çocuk cildi için otomatik kozmetik rutin kaydetmek güvenli değildir. Lütfen eczacı veya hekim görüşü alın."
        : bundle.routineEligibility === "blocked"
          ? "Bu sonuç rutin olarak kaydedilemez. Daha net ve doğru açılı fotoğraflarla tekrar deneyin."
          : "Bu sonuç rutin olarak kaydedilecek kadar güvenilir değil. Lütfen daha net ve doğru açılı fotoğraflarla tekrar deneyin.";
      Alert.alert("Rutin kaydedilemiyor", msg, [{ text: "Tamam" }]);
      return;
    }
    setSaving(true);
    try {
      // ECZ4 SAVED-ROUTINE-FIX-2 — bundle ekrandakiyle aynı projection'ı
      // veriyor; kayıt da görünüm de bire bir aynı adım setini içerir.
      const program = buildRoutineFromAnalysis(analysis, bundle);
      await routineProgramStore.saveProgram(program);
      setSaved(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  // ── ECZ-FINAL-CLEAN-1 — Real result yoksa güvenli boş durum ──────────────
  // Sahte skinType/score göstermek yerine kullanıcıyı taramaya yönlendir.
  // Hiçbir RoutineBlock, hiçbir ürün, hiçbir InsightCard render edilmez.
  if (!realResult) {
    return (
      <View style={[s.root, { paddingTop: top }]}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
            hitSlop={12}
            style={s.backBtn}
          >
            <Text style={s.backTxt}>← Geri</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.mainTitle}>Uzman Rutinim</Text>
            <Text style={s.mainSub}>Cildiniz için gerekçeli bakım planı</Text>
          </View>
          <View style={s.premiumBadge}>
            <Text style={s.premiumBadgeTxt}>✦ Seçkin</Text>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, { paddingBottom: bottom + SCAN_NAV_HEIGHT + 100, alignItems: "stretch" }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            marginTop: 32,
            padding: 24,
            borderRadius: 18,
            backgroundColor: `${SAGE}10`,
            borderWidth: 1,
            borderColor: `${SAGE}30`,
            alignItems: "center",
            gap: 14,
          }}>
            <Text style={{ fontSize: 32 }}>○</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: INK, textAlign: "center" }}>
              Henüz bir cilt taramanız yok
            </Text>
            <Text style={{ fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 21 }}>
              Rutin oluşturmak için önce cilt taramasını tamamlamalısınız.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/premium-skin-scan-v2/capture" as any)}
              style={{
                marginTop: 8,
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: SAGE,
              }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: WHITE }}>Taramaya Başla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.replace("/" as any)}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: MUTED }}>Ana sayfaya dön</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: top }]}>

      {/* ── Premium Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12} style={s.backBtn}>
          <Text style={s.backTxt}>← Geri</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.mainTitle}>Uzman Rutinim</Text>
          <Text style={s.mainSub}>Cildiniz için gerekçeli bakım planı</Text>
        </View>
        <View style={s.premiumBadge}>
          <Text style={s.premiumBadgeTxt}>✦ Seçkin</Text>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: bottom + SCAN_NAV_HEIGHT + 160 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Insight */}
        <InsightCard analysis={analysis} />

        {/* Separator */}
        <View style={s.sep}>
          <View style={s.sepLine} />
          <Text style={s.sepTxt}>Günlük Bakım Planı</Text>
          <View style={s.sepLine} />
        </View>

        {/* ── FINAL-HARD-LOCK TASK 5 — Güvenli Kullanım Notu görünüm kuralı ── */}
        {(() => {
          const showSafetyNote =
            bundle.safetyMessages.length > 0 && (
              bundle.routineEligibility !== "full" ||
              bundle.resultReliabilityLevel === "low" ||
              bundle.resultReliabilityLevel === "insufficient" ||
              bundle.riskMode === "pediatric" ||
              bundle.riskMode === "low_confidence" ||
              bundle.riskMode === "irritated" ||
              bundle.serverPoseComplianceOk === false ||
              bundle.contradictionWarnings.length > 0
            );
          if (!showSafetyNote) return null;
          return (
            <View style={[mr.card, { backgroundColor: "#FBF6EE", borderColor: `${COPPER}55` }]}>
              <View style={mr.header}>
                <View style={[mr.iconBox, { backgroundColor: `${COPPER}22` }]}>
                  <Text style={[mr.iconTxt, { color: GOLD }]}>!</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[mr.title, { color: GOLD }]}>
                    {isBlocked ? "Güvenlik Uyarısı" : "Güvenli Kullanım Notu"}
                  </Text>
                  {bundle.safetyMessages.map((m, i) => (
                    <Text key={i} style={[mr.note, { color: INK }]}>{m}</Text>
                  ))}
                </View>
              </View>
            </View>
          );
        })()}

        {/* 2-4. Rutin Blokları — gating
             • blocked/pediatric → tamamen gizli
             • minimal           → ilk 2 adım (yalnız temel bakım), haftalık gizli
             • full              → tam rutin
        */}
        {!hideAdultRoutine && (() => {
          // ECZ4 SAVED-ROUTINE-FIX-2 — Single source of truth.
          // Eski inline ALLOW/DENY listesi ile routineProgramStore içindeki
          // _rpFilterStepsForRestrictedMode farklı token setleri tutuyordu →
          // "Analiz Detayı" tam plan, "Ürünleri Gör" daha az adım gösteriyordu
          // (kaydedilen rutinden de farklı). Artık ekran da kayıt da AYNI
          // helper'ı (buildRoutineFromAnalysis) kullanır → adım sayısı,
          // adım adları ve sıra üç yerde de birebir aynı.
          // ECZ4 SAVED-ROUTINE-FIX-3 (rev2) — history-detail'den geçildiğinde
          // bundle conservative (minimal) tutulur ki recommendation safety
          // filter aktif kalsın. Ama o senaryoda PROJECTION conservative
          // OLMAMALI — kullanıcı "Analiz Detayı"nda gördüğü tam planı burada
          // da görmek ister. Bayrak: cannotDetermineFields.viewing_saved_routine.
          const isViewingSavedRoutineHere = bundle.cannotDetermineFields.includes("viewing_saved_routine");
          const projected = buildRoutineFromAnalysis(
            analysis,
            !isViewingSavedRoutineHere && (isMinimal || isPediatric || isBlocked) ? bundle : undefined,
          );
          const morningSteps = projected.morning;
          const eveningSteps = projected.evening;
          const weeklySteps  = projected.weekly ?? [];
          const stepsTrimmed =
            (analysis.morning.length - morningSteps.length) +
            (analysis.evening.length - eveningSteps.length) +
            ((analysis.weekly?.length ?? 0) - weeklySteps.length);
          if (isMinimal && stepsTrimmed > 0) {
            console.log(
              `[SkinScan][SavedRoutineProductFallback] minimal mode trimmed ${stepsTrimmed} aktif/serum step → only basic care displayed`,
            );
          }
          // Minimal modda hiçbir güvenli adım kalmazsa rutin yerine kullanıcıya
          // bilgi notu göster — sahte/aktif rutin sızdırmaktan iyidir.
          if (isMinimal && morningSteps.length === 0 && eveningSteps.length === 0) {
            return (
              <View style={[mr.card, { backgroundColor: "#FBF6EE", borderColor: `${COPPER}55` }]}>
                <View style={mr.header}>
                  <View style={[mr.iconBox, { backgroundColor: `${COPPER}22` }]}>
                    <Text style={[mr.iconTxt, { color: GOLD }]}>!</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[mr.title, { color: GOLD }]}>Bu güvenilirlikle rutin önerilmiyor</Text>
                    <Text style={[mr.note, { color: INK }]}>
                      Mevcut analiz güveni düşük olduğu için aktif içerikli adımlar gösterilmiyor;
                      bu öneri setinde size gösterilebilecek güvenli temel bakım adımı bulunamadı.
                      Daha net ve doğru açılı fotoğraflarla taramayı tekrar deneyin.
                    </Text>
                  </View>
                </View>
              </View>
            );
          }
          return (
            <>
              {isMinimal && stepsTrimmed > 0 && (
                <View style={[mr.card, { backgroundColor: "#FBF6EE", borderColor: `${COPPER}40` }]}>
                  <Text style={[mr.note, { color: INK }]}>
                    Mevcut güvenle yalnız temel bakım adımları gösteriliyor.
                    Aktif içerikli adımlar (serum, asit, peeling, retinol vb.)
                    "Analiz Detayı"nda rehber olarak kalır; ürün önerisi
                    güvenilir bir taramayla birlikte açılır.
                  </Text>
                </View>
              )}
              <RoutineBlock
                title="☀  Sabah"
                subtitle={isMinimal ? "Yalnız temel bakım" : "Koruma ve hazırlık"}
                steps={morningSteps}
                selectedProducts={selectedProducts}
                onAltPress={setAltStep}
              />

              <RoutineBlock
                title="◑  Akşam"
                subtitle={isMinimal ? "Yalnız temel bakım" : "Onarım ve destek"}
                steps={eveningSteps}
                selectedProducts={selectedProducts}
                onAltPress={setAltStep}
              />

              {weeklySteps.length > 0 && (
                <RoutineBlock
                  title="◎  Haftalık"
                  subtitle="Ek bakım seansları"
                  steps={weeklySteps}
                  selectedProducts={selectedProducts}
                  onAltPress={setAltStep}
                />
              )}
            </>
          );
        })()}

        {/* Seçkin kapısı (ücretsiz kullanıcılar için) */}
        {!isSeckin && (
          <GateCard
            title="Akıllı Rutin Motoru"
            description="Rutin dinamik optimize edilir; adımlar cilt cevabına göre ince ayarlanır."
            onUpgrade={() => setSeckinModal(true)}
          />
        )}

        {/* 5. Rutin Evrimi */}
        <View style={s.sep}>
          <View style={s.sepLine} />
          <Text style={s.sepTxt}>Zaman İçinde</Text>
          <View style={s.sepLine} />
        </View>
        <EvolutionCard skinType={skinType} />

        {/* 6. Eczacı / Uzman Notu */}
        <ExpertNoteCard skinType={skinType} />

        {/* 7. Manuel Rutin Erişimi — Seçkin kullanıcılar her iki sistemi de kullanabilir */}
        <View style={mr.card}>
          <View style={mr.header}>
            <View style={mr.iconBox}>
              <Text style={mr.iconTxt}>✎</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={mr.title}>Kendi Rutinini de Oluştur</Text>
              <Text style={mr.sub}>Analiz rutinine ek olarak özel adımlar ekleyebilirsin</Text>
            </View>
          </View>
          <View style={mr.btnRow}>
            <TouchableOpacity
              style={mr.primaryBtn}
              onPress={() => router.push("/(tabs)/rutin" as any)}
              activeOpacity={0.82}
            >
              <Text style={mr.primaryTxt}>Rutinim Sekmesi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={mr.secondaryBtn}
              onPress={() => router.push("/rutin/duzenle" as any)}
              activeOpacity={0.82}
            >
              <Text style={mr.secondaryTxt}>Yeni rutin oluştur</Text>
            </TouchableOpacity>
          </View>
          <Text style={mr.note}>
            Sabah · Akşam · Haftalık · Aylık slotlara özel adımlar ve ürünler ekleyebilirsin.
          </Text>
        </View>

      </ScrollView>

      {/* ── Sticky CTA ── */}
      {/* ECZ-CTX-GATE-1 — blocked/pediatric: kaydet CTA'sı gizlenir; rutin
          oluşturma akışı bu güvenilirlikle önerilmez. */}
      <View style={[s.ctaBar, { paddingBottom: bottom + SCAN_NAV_HEIGHT + 8 }]}>
        {hideAdultRoutine ? (
          <View style={s.savedBanner}>
            <Text style={[s.savedTxt, { color: MUTED }]}>
              Bu sonuçla otomatik rutin önerilmiyor.
            </Text>
          </View>
        ) : saved ? (
          <>
            <View style={s.savedBanner}>
              <Text style={s.savedTxt}>✓  Rutin kaydedildi</Text>
            </View>
            <TouchableOpacity
              style={s.trackingBtn}
              onPress={() => router.push("/premium-skin-scan-v2/routine-tracking" as any)}
              activeOpacity={0.82}
            >
              <Text style={s.trackingTxt}>Takip Ekranına Git →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.82}
            disabled={saving}
          >
            <Text style={s.saveTxt}>
              {saving ? "Kaydediliyor..." : "Rutinimi Kaydet"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <SeckinModal visible={seckinModal} onClose={() => setSeckinModal(false)} />

      <AltModal
        visible={altStep !== null}
        step={altStep}
        onClose={() => setAltStep(null)}
        onSelect={handleSelectProduct}
      />

      <ScanBottomNav />
    </View>
  );
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallback(): AnalysisResult {
  return {
    id: "fallback", timestamp: new Date().toISOString(),
    skinType: "Karma", score: 70,
    concerns: ["T bölgesinde yağlanma", "Yanak bölgesinde hafif nem eksikliği"],
    comment:  "Hedefli bakım rutinle dengelenir.",
    morning: [
      { name: "Köpük temizleyici",      role: "Esas" },
      { name: "Hafif nemlendirici",     role: "Esas" },
      { name: "SPF 50+ güneş koruyucu", role: "Esas" },
    ],
    evening: [
      { name: "Çift temizleme",    role: "Esas" },
      { name: "Nemlendirici krem", role: "Esas" },
    ],
    weekly: [
      { name: "Kil maskesi", role: "Destek" },
    ],
    products: {
      ekonomik:    [{ name: "CeraVe Jel Temizleyici",   role: "Temizleyici", reason: "Yağ dengesini bozmaz" }],
      profesyonel: [{ name: "La Roche-Posay Effaclar",  role: "Temizleyici", reason: "T bölgesi için ideal" }],
      seckin:      [{ name: "Tata Harper Clarifying",    role: "Temizleyici", reason: "Bitkisel formül" }],
    },
  };
}

// ─── Manuel Rutin Kartı Stilleri ──────────────────────────────────────────────

const mr = StyleSheet.create({
  card:       {
    backgroundColor: "#F0F4FF",
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(37,99,235,0.18)",
    padding: 18, gap: 14,
  },
  header:     { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconBox:    {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "#DBEAFE",
    alignItems: "center", justifyContent: "center",
  },
  iconTxt:    { fontSize: 18, color: "#2563EB" },
  title:      { fontSize: 15, fontWeight: "800", color: "#1E3A8A", letterSpacing: -0.2 },
  sub:        { fontSize: 12, color: "#3B82F6", lineHeight: 17 },
  btnRow:     { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1, backgroundColor: "#2563EB",
    borderRadius: 12, paddingVertical: 11, alignItems: "center",
  },
  primaryTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  secondaryBtn:{
    flex: 1, backgroundColor: "rgba(37,99,235,0.10)",
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(37,99,235,0.28)",
    paddingVertical: 11, alignItems: "center",
  },
  secondaryTxt:{ fontSize: 13, fontWeight: "700", color: "#2563EB" },
  note:       { fontSize: 11.5, color: "#3B82F6", lineHeight: 17 },
});

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: CREAM },

  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                   paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E8E0D6" },
  backBtn:       {},
  backTxt:       { fontSize: 15, color: MUTED },
  headerCenter:  { alignItems: "center", gap: 2, flex: 1, paddingHorizontal: 8 },
  mainTitle:     { fontSize: 16, fontWeight: "800", color: INK, letterSpacing: -0.3 },
  mainSub:       { fontSize: 11, color: MUTED, textAlign: "center" },
  premiumBadge:  { backgroundColor: `${COPPER}18`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: `${COPPER}35` },
  premiumBadgeTxt:{ fontSize: 11, color: GOLD, fontWeight: "700" },

  scroll:        { flex: 1 },
  content:       { paddingHorizontal: 18, paddingTop: 20, gap: 20 },

  sep:           { flexDirection: "row", alignItems: "center", gap: 10 },
  sepLine:       { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#DDD8CF" },
  sepTxt:        { fontSize: 11, color: MUTED, fontWeight: "600", letterSpacing: 0.8 },

  ctaBar:        { position: "absolute", bottom: 0, left: 0, right: 0,
                   backgroundColor: CREAM, paddingHorizontal: 20, paddingTop: 12,
                   borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E0D9D0", gap: 8 },
  saveBtn:       { backgroundColor: SAGE, paddingVertical: 15, borderRadius: 16, alignItems: "center" },
  saveTxt:       { color: WHITE, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  savedBanner:   { paddingVertical: 8, alignItems: "center" },
  savedTxt:      { fontSize: 14, color: SAGE, fontWeight: "700" },
  trackingBtn:   { backgroundColor: COPPER, paddingVertical: 15, borderRadius: 16, alignItems: "center" },
  trackingTxt:   { color: WHITE, fontSize: 16, fontWeight: "700" },
});