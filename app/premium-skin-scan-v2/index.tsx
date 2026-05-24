/**
 * premium-skin-scan-v2 — EntryScreen
 * Giriş ekranı: geri butonu + ScanBottomNav + başlat CTA.
 */

import { router }                     from "expo-router";
import { useState }                   from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets }          from "react-native-safe-area-context";
import { ScanBottomNav, SCAN_NAV_HEIGHT } from "@/components/ScanBottomNav";

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";

export default function EntryScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const navPad = SCAN_NAV_HEIGHT + (bottom || 0);
  const [consent, setConsent] = useState(false);

  return (
    <View style={[s.wrapper, { paddingTop: top }]}>

      {/* Üst çubuk — geri */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12} activeOpacity={0.7}>
          <Text style={s.backTxt}>← Geri</Text>
        </TouchableOpacity>
        <View style={{ width: 60 }} />
      </View>

      {/* Başlık grubu */}
      <View style={s.hero}>
        <View style={s.ring}>
          <View style={s.ringInner} />
        </View>
        <Text style={s.title}>Yeni Bakım Profili</Text>
        <Text style={s.subtitle}>Kamera destekli cilt bakım profili</Text>

        {/* Özellik özetleri */}
        <View style={s.featureRow}>
          {["5 fotoğraf analizi", "Şahsi rutin", "Ürün eşleştirme"].map((f) => (
            <View key={f} style={s.featurePill}>
              <Text style={s.featureTxt}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={[s.bottom, { paddingBottom: navPad + 16 }]}>
        <TouchableOpacity
          style={s.consentRow}
          onPress={() => setConsent((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
        >
          <View style={[s.checkbox, { backgroundColor: consent ? SAGE : "transparent", borderColor: consent ? SAGE : "#B8BCB1" }]}>
            {consent && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.consentLabel}>
            Cilt fotoğrafımın ve bakım profili cevaplarımın kişisel bakım önerisi oluşturmak için işlenmesini kabul ediyorum.
          </Text>
        </TouchableOpacity>
        <Text style={s.consentNote}>
          Bu analiz tıbbi teşhis veya tedavi amacı taşımaz. Sonuçlar yalnızca kozmetik bakım rehberi niteliğindedir.{" "}
          <Text style={s.consentLink} onPress={() => router.push("/sozlesme" as any)}>
            Gizlilik Politikası ve Kullanım Koşulları
          </Text>
          .
        </Text>
        <TouchableOpacity
          style={[s.cta, !consent && s.ctaDisabled]}
          onPress={() => { if (consent) router.push("/premium-skin-scan-v2/capture" as any); }}
          activeOpacity={consent ? 0.82 : 1}
          disabled={!consent}
        >
          <Text style={[s.ctaText, !consent && s.ctaTextDisabled]}>Profili Oluştur</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.historyLink}
          onPress={() => router.push("/premium-skin-scan-v2/history" as any)}
          activeOpacity={0.7}
        >
          <Text style={s.historyTxt}>Bakım Profili Geçmişi →</Text>
        </TouchableOpacity>
      </View>

      <ScanBottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: CREAM },
  topBar:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backTxt:    { fontSize: 15, color: MUTED, fontWeight: "500" },

  hero:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 28 },
  ring:       { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: SAGE, alignItems: "center", justifyContent: "center" },
  ringInner:  { width: 60, height: 60, borderRadius: 30, backgroundColor: SAGE, opacity: 0.18 },
  title:      { fontSize: 30, fontWeight: "800", color: INK, letterSpacing: -0.5 },
  subtitle:   { fontSize: 15, color: MUTED },

  featureRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 8 },
  featurePill:{ backgroundColor: `${SAGE}14`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: `${SAGE}25` },
  featureTxt: { fontSize: 12, color: SAGE, fontWeight: "600" },

  bottom:     { paddingHorizontal: 28, gap: 10 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 4, paddingVertical: 4 },
  checkbox:   { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkmark:  { color: "#fff", fontSize: 14, fontWeight: "800", lineHeight: 16 },
  consentLabel:{ flex: 1, fontSize: 12.5, color: INK, lineHeight: 17 },
  consentNote:{ fontSize: 11.5, color: MUTED, textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },
  consentLink:{ color: SAGE, fontWeight: "700", textDecorationLine: "underline" },
  cta:        { backgroundColor: SAGE, paddingVertical: 17, borderRadius: 18, alignItems: "center", shadowColor: SAGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
  ctaDisabled:{ backgroundColor: "#D6D8D2", shadowOpacity: 0 },
  ctaText:    { color: "#fff", fontSize: 17, fontWeight: "700" },
  ctaTextDisabled:{ color: "#8A8E84" },
  historyLink:{ alignItems: "center", paddingVertical: 6 },
  historyTxt: { fontSize: 14, color: COPPER, fontWeight: "600" },
});