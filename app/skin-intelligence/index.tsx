/**
 * Skin Intelligence — Entry Screen
 * Temiz, minimal giriş. "Cilt Analizi" başlığı, tek CTA.
 */

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { useSkinIntelligence } from "@/lib/skinIntelligence/store";

export default function SkinIntelligenceEntry() {
  const { top, bottom } = useSafeAreaInsets();
  const colors = useColors();
  const { isSeckin } = useAuth();
  const reset = useSkinIntelligence((s) => s.reset);

  const handleStart = () => {
    reset();
    router.push("/skin-intelligence/capture");
  };

  return (
    <View style={[s.wrapper, { backgroundColor: colors.background }]}>
      {/* ── TEST BANNER — yalnızca doğrulama için, sonra kaldırılacak ── */}
      <View style={s.testBanner}>
        <Text style={s.testBannerText}>✦ NEW SKIN INTELLIGENCE FLOW ✦</Text>
      </View>

      {/* Geri butonu */}
      <View style={[s.topBar, { paddingTop: top + 12 }]}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* İçerik */}
      <View style={s.center}>
        {/* İkon */}
        <View style={[s.iconBox, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }]}>
          <Feather name="eye" size={32} color={colors.primary} />
        </View>

        <View style={s.textGroup}>
          <Text style={[s.title, { color: colors.text }]}>Cilt Bakım Profili</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            Şahsi analiz, doğru bakım
          </Text>
        </View>

        {/* Özellik listesi — kısa */}
        <View style={[s.featureBox, { backgroundColor: colors.surfaceCard }]}>
          {[
            { icon: "camera", label: "5 açılı fotoğraf taraması" },
            { icon: "zap",    label: "Anında cilt skoru" },
            { icon: "layers", label: "Şahsi sabah & akşam rutini" },
            { icon: "shopping-bag", label: "Sana uygun ürün önerileri" },
          ].map(({ icon, label }) => (
            <View key={label} style={s.featureRow}>
              <Feather name={icon as any} size={15} color={colors.primary} />
              <Text style={[s.featureLabel, { color: colors.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        {!isSeckin && (
          <View style={[s.premiumNote, { backgroundColor: `${colors.accent}12`, borderColor: `${colors.accent}30` }]}>
            <Feather name="star" size={13} color={colors.accent} />
            <Text style={[s.premiumNoteText, { color: colors.accent }]}>Seçkin üyelere özel</Text>
          </View>
        )}
      </View>

      {/* CTA */}
      <View style={[s.bottom, { paddingBottom: bottom + 24 }]}>
        <TouchableOpacity
          style={[s.cta, { backgroundColor: isSeckin ? colors.primary : colors.border }]}
          onPress={isSeckin ? handleStart : () => router.push("/(tabs)/profil")}
          activeOpacity={0.82}
        >
          <Text style={[s.ctaText, { color: isSeckin ? "#fff" : colors.textMuted }]}>
            {isSeckin ? "Profili Oluştur" : "Seçkin Üye Ol"}
          </Text>
          <Feather name="arrow-right" size={18} color={isSeckin ? "#fff" : colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:       { flex: 1 },
  // TEST BANNER — sadece doğrulama için
  testBanner:      { backgroundColor: "#7A8F6B", paddingVertical: 8, alignItems: "center" },
  testBannerText:  { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  topBar:        { paddingHorizontal: 24, paddingBottom: 8 },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 24 },
  iconBox:       { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  textGroup:     { alignItems: "center", gap: 6 },
  title:         { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle:      { fontSize: 16, textAlign: "center" },
  featureBox:    { width: "100%", borderRadius: 18, padding: 18, gap: 14 },
  featureRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  featureLabel:  { fontSize: 14 },
  premiumNote:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  premiumNoteText: { fontSize: 13, fontWeight: "600" },
  bottom:        { paddingHorizontal: 24 },
  cta:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 16 },
  ctaText:       { fontSize: 17, fontWeight: "700" },
});