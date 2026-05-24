import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";

// ── Ürün Öner ekranına özgü palet ────────────────────────────────────────────
// Ana sayfa #E8ECE4 / #141414'ten ~%15 daha ayrışık zemin + yüksek kontrast yazı

const SCREEN_COLORS = {
  light: {
    bg:        "#EBE8DF",   // Ana sayfadan belirgin daha koyu sıcak bej
    text:      "#1E1410",   // Çok koyu — zeminden max kontrast
    textSub:   "#5E4A38",   // Orta sıcak kahve
    textMuted: "#8C7462",   // Soluk sıcak
    inputBg:   "#F5F0E6",   // Zeminden açık, iç alan hissi
    border:    "#D8CEBC",   // Belirgin border
    danger:    "#b91c1c",
  },
  dark: {
    bg:        "#111110",   // Ana sayfadan belirgin daha koyu
    text:      "#F5F0E8",   // Açık krem — zeminden max kontrast
    textSub:   "#BBAB98",   // Orta sıcak
    textMuted: "#756450",   // Soluk sıcak
    inputBg:   "#1C1915",   // Zeminden biraz açık
    border:    "#332820",
    danger:    "#ef4444",
  },
};

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

export default function UrunOnerScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const sc = theme === "dark" ? SCREEN_COLORS.dark : SCREEN_COLORS.light;
  const insets = useSafeAreaInsets();
  const { getAuthHeaders } = useAuth();
  const [isim, setIsim] = useState("");
  const [marka, setMarka] = useState("");
  const [barkod, setBarkod] = useState("");
  const [kategori, setKategori] = useState("");
  const [icerikler, setIcerikler] = useState("");
  const [loading, setLoading] = useState(false);
  const [basarili, setBasarili] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { scrollPaddingBottom } = useTabBarInset();

  const zorunluDolu = isim.trim() && marka.trim() && barkod.trim() && icerikler.trim();

  const gonder = async () => {
    if (!isim.trim()) { alert("Ürün adı zorunludur."); return; }
    if (!marka.trim()) { alert("Marka zorunludur."); return; }
    if (!barkod.trim()) { alert("Barkod zorunludur."); return; }
    if (!icerikler.trim()) { alert("İçerikler zorunludur."); return; }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v2/products/oner`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          isim: isim.trim(),
          marka: marka.trim() || undefined,
          barkod: barkod.trim() || undefined,
          kategori: kategori.trim() || undefined,
          icerikler: icerikler.trim() ? icerikler.trim().split(",").map(s => s.trim()).filter(Boolean) : undefined,
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBasarili(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail ?? err.error ?? "Öneri gönderilemedi");
      }
    } catch {
      alert("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  if (basarili) {
    return (
      <View style={[styles.container, { backgroundColor: sc.bg }]}>
        <View style={[styles.centered, { paddingTop: topPad + 60 }]}>
          <View style={[styles.successIcon, { backgroundColor: `${colors.scoreHigh}20` }]}>
            <Feather name="check-circle" size={40} color={colors.scoreHigh} />
          </View>
          <Text style={[styles.successTitle, { color: sc.text }]}>Teşekkürler!</Text>
          <Text style={[styles.successDesc, { color: sc.textSub }]}>
            Ürün öneriniz alındı. İncelendikten sonra veri tabanına eklenecek.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => safeBack(router, "/(tabs)/profil")}
          >
            <Text style={styles.btnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: sc.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomWidth: 1, borderBottomColor: sc.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: sc.inputBg }]}
          onPress={() => safeBack(router, "/(tabs)/profil")}
        >
          <Feather name="arrow-left" size={20} color={sc.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: sc.text }]}>Ürün Öner</Text>
          <Text style={[styles.subtitle, { color: sc.textMuted }]}>Veritabanına ürün ekletelim</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom() }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.infoBox, { backgroundColor: `${colors.secondary}12`, borderColor: `${colors.secondary}28` }]}>
          <Feather name="info" size={16} color={colors.secondary} />
          <Text style={[styles.infoText, { color: sc.textSub }]}>
            Aradığınız ürünü bulamadıysanız buradan önerin. Ekip inceleyip veri tabanına ekleyecek.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: sc.text }]}>Ürün Adı <Text style={{ color: sc.danger }}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: sc.inputBg, borderColor: isim ? colors.secondary : sc.border, color: sc.text }]}
              placeholder="örn. Cerave Nemlendirici Krem"
              placeholderTextColor={sc.textMuted}
              value={isim}
              onChangeText={setIsim}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: sc.text }]}>Marka <Text style={{ color: sc.danger }}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: sc.inputBg, borderColor: marka ? colors.secondary : sc.border, color: sc.text }]}
              placeholder="örn. CeraVe"
              placeholderTextColor={sc.textMuted}
              value={marka}
              onChangeText={setMarka}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: sc.text }]}>Barkod <Text style={{ color: sc.danger }}>*</Text></Text>
            <TextInput
              style={[styles.input, { backgroundColor: sc.inputBg, borderColor: barkod ? colors.secondary : sc.border, color: sc.text }]}
              placeholder="13 haneli barkod numarası"
              placeholderTextColor={sc.textMuted}
              value={barkod}
              onChangeText={setBarkod}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: sc.text }]}>Kategori</Text>
            <TextInput
              style={[styles.input, { backgroundColor: sc.inputBg, borderColor: kategori ? colors.secondary : sc.border, color: sc.text }]}
              placeholder="örn. Nemlendirici, Serum, Temizleyici"
              placeholderTextColor={sc.textMuted}
              value={kategori}
              onChangeText={setKategori}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: sc.text }]}>İçerikler (virgülle ayırın) <Text style={{ color: sc.danger }}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.multiInput, { backgroundColor: sc.inputBg, borderColor: icerikler ? colors.secondary : sc.border, color: sc.text }]}
              placeholder="Aqua, Glycerin, Niacinamide..."
              placeholderTextColor={sc.textMuted}
              value={icerikler}
              onChangeText={setIcerikler}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: zorunluDolu ? colors.primary : sc.border }]}
            onPress={gonder}
            disabled={!zorunluDolu || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Öneri Gönder</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 2 },
  title: { fontSize: 22, fontWeight: "800" as const },
  subtitle: { fontSize: 12, marginTop: 2 },
  scroll: { paddingHorizontal: 20 },
  infoBox: { flexDirection: "row", gap: 10, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 24, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" as const },
  input: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  multiInput: { minHeight: 80, textAlignVertical: "top" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    paddingVertical: 16,
    gap: 10,
    marginTop: 8,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" as const },
  centered: { alignItems: "center", gap: 16, paddingHorizontal: 40 },
  successIcon: { width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 26, fontWeight: "800" as const },
  successDesc: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  btn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
});