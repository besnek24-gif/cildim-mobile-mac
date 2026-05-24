/**
 * Skin Intelligence — Ürün Önerileri Screen
 * Layer 5: Doğrudan ürünler. Anket yok. Akıllı Seçim yok.
 * Ekonomik / Profesyonel / Seçkin segment grupları.
 */

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSkinIntelligence } from "@/lib/skinIntelligence/store";
import type { ProductMatch, ProductSegment } from "@/lib/skinIntelligence/types";

// ─── Etiket / renk eşlemeleri ───────────────────────────────────────────────

const SEGMENT_TR: Record<ProductSegment, string> = {
  ekonomik:    "Ekonomik",
  profesyonel: "Profesyonel",
  seckin:      "Seçkin",
};

const SEGMENT_COLOR: Record<ProductSegment, string> = {
  ekonomik:    "#16A34A",
  profesyonel: "#2563EB",
  seckin:      "#7C3AED",
};

const CATEGORY_TR: Record<string, string> = {
  cleanser:     "Temizleyici",
  toner:        "Tonik",
  serum:        "Serum",
  moisturizer:  "Nemlendirici",
  sunscreen:    "SPF",
  eye_cream:    "Göz Kremi",
  mask:         "Maske",
  treatment:    "Aktif Bakım",
  oil:          "Yağ",
};

// ─── Ürün kartı ───────────────────────────────────────────────────────────────

function ProductCard({ match, segmentColor, colors }: {
  match: ProductMatch;
  segmentColor: string;
  colors: any;
}) {
  const catLabel = CATEGORY_TR[match.stepCategory] ?? match.stepCategory;

  return (
    <View style={[pc.card, { backgroundColor: colors.surfaceCard }]}>
      <View style={pc.top}>
        <View style={[pc.roleChip, { backgroundColor: `${segmentColor}12` }]}>
          <Text style={[pc.roleText, { color: segmentColor }]}>{catLabel}</Text>
        </View>
        {match.matchScore > 0 && (
          <Text style={[pc.score, { color: colors.textMuted }]}>{match.matchScore}% uyum</Text>
        )}
      </View>
      <Text style={[pc.name, { color: colors.text }]} numberOfLines={2}>{match.productName}</Text>
      {match.brand ? (
        <Text style={[pc.brand, { color: colors.textMuted }]}>{match.brand}</Text>
      ) : null}
      {match.reason ? (
        <Text style={[pc.reason, { color: colors.textSecondary }]} numberOfLines={2}>{match.reason}</Text>
      ) : null}
    </View>
  );
}

const pc = StyleSheet.create({
  card:      { borderRadius: 15, padding: 14, gap: 6 },
  top:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roleChip:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  roleText:  { fontSize: 11.5, fontWeight: "700" },
  score:     { fontSize: 11 },
  name:      { fontSize: 14.5, fontWeight: "700" },
  brand:     { fontSize: 12 },
  reason:    { fontSize: 12.5, lineHeight: 18 },
});

// ─── Placeholder (ürün eşleme bekleniyor) ────────────────────────────────────

function EmptyProducts({ colors, routine }: { colors: any; routine: any }) {
  if (!routine) {
    return (
      <View style={[ep.card, { backgroundColor: colors.surfaceCard }]}>
        <Feather name="clock" size={32} color={colors.textMuted} />
        <Text style={[ep.title, { color: colors.text }]}>Rutin hazırlanıyor</Text>
        <Text style={[ep.body, { color: colors.textMuted }]}>
          Derin analiz tamamlandığında ürün önerileri hazırlanacak.
        </Text>
      </View>
    );
  }

  // Rutin var ama ürün eşleme henüz yapılmamış
  const morningCats = routine.morningSteps.map((s: any) => CATEGORY_TR[s.category] ?? s.category);
  const eveningCats = routine.eveningSteps.map((s: any) => CATEGORY_TR[s.category] ?? s.category);

  return (
    <View style={{ gap: 12 }}>
      <View style={[ep.card, { backgroundColor: colors.surfaceCard }]}>
        <Feather name="shopping-bag" size={28} color={colors.textMuted} />
        <Text style={[ep.title, { color: colors.text }]}>Ürünler hazırlanıyor</Text>
        <Text style={[ep.body, { color: colors.textMuted }]}>
          Rutininize göre en uygun ürünler üç segmentte listelenecek.
        </Text>
      </View>

      {/* Rutindeki kategorileri ön göster */}
      <View style={[ep.previewCard, { backgroundColor: colors.surfaceCard }]}>
        <Text style={[ep.previewTitle, { color: colors.textSecondary }]}>Sabah için araştırılacak</Text>
        <View style={ep.chips}>
          {morningCats.map((cat: string) => (
            <View key={cat} style={[ep.chip, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={[ep.chipText, { color: colors.primary }]}>{cat}</Text>
            </View>
          ))}
        </View>

        <Text style={[ep.previewTitle, { color: colors.textSecondary, marginTop: 12 }]}>Akşam için araştırılacak</Text>
        <View style={ep.chips}>
          {eveningCats.map((cat: string) => (
            <View key={cat} style={[ep.chip, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={[ep.chipText, { color: colors.primary }]}>{cat}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const ep = StyleSheet.create({
  card:         { borderRadius: 16, padding: 24, alignItems: "center", gap: 12 },
  title:        { fontSize: 16, fontWeight: "700", textAlign: "center" },
  body:         { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  previewCard:  { borderRadius: 15, padding: 16 },
  previewTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  chips:        { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  chipText:     { fontSize: 12, fontWeight: "500" },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const colors = useColors();

  const { products, routine } = useSkinIntelligence((s) => ({
    products: s.products,
    routine: s.routine,
  }));

  return (
    <View style={[s.wrapper, { backgroundColor: colors.background }]}>
      {/* Başlık */}
      <View style={[s.topBar, { paddingTop: top + 12 }]}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>Sana Uygun Ürünler</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {!products ? (
          <EmptyProducts colors={colors} routine={routine} />
        ) : (
          products.groups.map((group) => {
            const color = SEGMENT_COLOR[group.segment] ?? "#7A8F6B";
            return (
              <View key={group.segment} style={s.segmentBlock}>
                {/* Segment başlığı */}
                <View style={s.segmentHeader}>
                  <View style={[s.segmentDot, { backgroundColor: color }]} />
                  <Text style={[s.segmentLabel, { color: colors.text }]}>
                    {SEGMENT_TR[group.segment]}
                  </Text>
                </View>

                {/* Ürün kartları */}
                {group.matches.map((match, i) => (
                  <ProductCard
                    key={`${match.routineStepId}-${i}`}
                    match={match}
                    segmentColor={color}
                    colors={colors}
                  />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:        { flex: 1 },
  topBar:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
  title:          { fontSize: 18, fontWeight: "800" },
  scroll:         { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  segmentBlock:   { gap: 8 },
  segmentHeader:  { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 4 },
  segmentDot:     { width: 8, height: 8, borderRadius: 4 },
  segmentLabel:   { fontSize: 14, fontWeight: "700" },
});