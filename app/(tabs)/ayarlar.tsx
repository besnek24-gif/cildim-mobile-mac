import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { SKIN_TYPE_LABELS, clearPreferences } from "@/lib/userPreferences";
// ECZ4 PHASE 2C-4 — "Cilt verilerimi ve rızamı sıfırla" akışı için cleanup
// helper'ları. Hesabı silmeden, cihazdaki tüm bakım/profil/geçmiş/rutin
// verilerini temizler. KVKK 7.3 (rıza geri çekme) için pratik yol.
import { clearLocalHistory } from "@/lib/localHistory";
import { historyStore } from "@/local_demo_data/safe_runtime_shims_v74";
import { resultStore } from "@/local_demo_data/safe_runtime_shims_v74";
import { clearAllOnLogout as clearRoutineCollection } from "@/lib/routineCollection";
import { clearAllOnLogout as clearRoutineProgram } from "@/local_demo_data/safe_runtime_shims_v74";
import { clearAllOnLogout as clearBridgeProfiles } from "@/lib/concernRoutineBridgeStore";
import { clearCorrections } from "@/lib/searchCorrections";
import { clearUserEvents } from "@/lib/userEvents";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

// ECZ4 — Profile/Settings Cleanup:
// Önceden burada `ALERJENLER` chip listesi + /api/me/allergens fetch/POST + Alerjen
// Takibi banner+grid render bloğu vardı. Profil ekranıyla görsel/fonksiyonel
// duplikasyon yaratıyordu. V1 için Settings sayfası "hesap/uygulama/yasal" merkezi
// olarak sadeleştirildi; alerji düzenleme tek nokta üzerinden yapılır:
// "Alerji & Kaçınma Listesi" → /alerji-listesi (preferences.allergyIngredients +
// avoidedIngredients → ingredientAlerts → CompatibilityTab).
// Yanıltıcı "kırmızıyla işaretlenir" iddiası bu temizlikle kaldırıldı.

export default function AyarlarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const { user, logout, getAuthHeaders } = useAuth();
  const { preferences } = useUserPreferences();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [resettingData, setResettingData] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { scrollPaddingBottom } = useTabBarInset();

  // ECZ4 PHASE 2C-4 — "Cilt verilerimi ve rızamı sıfırla"
  // KVKK 7.3 (rıza geri çekme) için pratik akış: hesabı silmeden, cihazdaki
  // tüm bakım verilerini (cilt profili, alerji, hassasiyet, geçmiş, rutin
  // takip, bridge profilleri, son analiz sonucu, davranış sinyalleri)
  // temizler. Logout yapmaz, hesabı silmez.
  const handleVerileriSifirla = () => {
    Alert.alert(
      "Cilt Verilerimi ve Rızamı Sıfırla",
      "Hesabınız korunur; cilt profili, alerji/hassasiyet bilgileri, analiz geçmişi ve rutin takip verileri bu cihazdan temizlenir. Devam edilsin mi?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sıfırla",
          style: "destructive",
          onPress: async () => {
            setResettingData(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await Promise.all([
                clearPreferences().catch(() => {}),
                historyStore.removeAll().catch(() => {}),
                clearLocalHistory().catch(() => {}),
                clearRoutineProgram().catch(() => {}),
                clearRoutineCollection().catch(() => {}),
                clearBridgeProfiles().catch(() => {}),
                clearCorrections().catch(() => {}),
                clearUserEvents().catch(() => {}),
              ]);
              try { resultStore.clear(); } catch { /* best-effort */ }
              Alert.alert(
                "Temizlendi",
                "Cilt verileriniz ve bakım tercihleriniz bu cihazdan kaldırıldı. Hesabınız aktiftir.",
              );
            } catch {
              Alert.alert("Hata", "Veriler temizlenemedi. Tekrar deneyin.");
            }
            setResettingData(false);
          },
        },
      ],
    );
  };

  const handleHesapSil = () => {
    Alert.alert(
      "Hesabı Sil",
      "Hesabınız ve tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Hesabı Sil",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${API_BASE}/api/me/account`, {
                method: "DELETE",
                headers,
              });
              if (res.ok) {
                await logout();
                router.replace("/(tabs)/profil");
              } else {
                // ECZ4 PHASE 2C-4 — backend mesajı (503 service-role eksik /
                // 502 auth-delete fail) kullanıcıya iletilsin: kişi destek
                // adresine yönlendirilebilsin.
                let msg = "Hesap silinemedi. Tekrar deneyin.";
                try {
                  const body = await res.json();
                  if (body && typeof body.error === "string" && body.error.trim()) {
                    msg = body.error;
                  }
                } catch { /* fallback default */ }
                Alert.alert("Hata", msg);
              }
            } catch {
              Alert.alert("Hata", "Bağlantı hatası.");
            }
            setDeletingAccount(false);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Renkli Header ── */}
      <LinearGradient
        colors={["#4F46E5", "#3730A3"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroBand, { paddingTop: topPad + 20 }]}
      >
        <View style={styles.decoCircle1} />
        <View style={styles.decoCircle2} />
        <View style={styles.heroRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => safeBack(router, "/(tabs)/profil")}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroTextArea}>
            <View style={styles.heroIconRow}>
              <View style={styles.heroIconBox}>
                <Feather name="settings" size={20} color="#4F46E5" />
              </View>
              <Text style={styles.heroTitle}>Ayarlar</Text>
            </View>
            <Text style={styles.heroSub}>Hesap ve uygulama tercihleri</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: scrollPaddingBottom() }]}>

        {/* ── Cilt Profili ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CİLT PROFİLİ</Text>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/profil-kur" as any);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF" }]}>
              <Feather name="user" size={16} color={isDark ? "#A5B4FC" : "#4338CA"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, { color: colors.text }]}>Cilt Profilimi Düzenle</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {preferences.skinType
                  ? SKIN_TYPE_LABELS[preferences.skinType]
                  : preferences.specialConditions.length > 0
                  ? `${preferences.specialConditions.length} özel durum seçili`
                  : "Profil henüz oluşturulmadı"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/alerji-listesi" as any);
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDark ? "#1C1917" : "#FEF9C3" }]}>
              <Feather name="alert-triangle" size={16} color={isDark ? "#FCD34D" : "#D97706"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, { color: colors.text }]}>Alerji & Kaçınma Listesi</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {preferences.allergyIngredients.length + preferences.avoidedIngredients.length > 0
                  ? `${preferences.allergyIngredients.length + preferences.avoidedIngredients.length} içerik kayıtlı`
                  : "Şahsî içerik listesi oluştur"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
            borderRadius: 12,
            borderWidth: 1,
            padding: 11,
            marginTop: 4,
            backgroundColor: isDark ? "#0F1729" : "#F0F9FF",
            borderColor: isDark ? "#1E3A5F" : "#BAE6FD",
          }]}>
            <Feather name="info" size={13} color={isDark ? "#38BDF8" : "#0369A1"} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, color: isDark ? "#7DD3FC" : "#0369A1", lineHeight: 18 }}>
              Profilin cilt tipi, hassasiyet ve özel koşullarına göre uyarı seviyelerini ve uygunluk analizini şahsileştirir.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HAKKIMIZDA</Text>
          {[
            { icon: "shield", label: "Gizlilik Politikası", msg: "Verileriniz yalnızca uygulamanın çalışması ve tecrübenizin iyileştirilmesi için kullanılır. Hizmet sağlayıcılarımız (Supabase veri tabanı, Resend e-posta, Expo bildirim, AI analiz sağlayıcısı) yalnızca bu amaçla işleme yapar; pazarlama amacıyla satılmaz veya paylaşılmaz. Detay için sözleşme metnini inceleyin.", color: "#6BA3A0", bg: "#ECFEFF" },
            { icon: "file-text", label: "Kullanım Koşulları", msg: "Bu uygulamayı kullanarak kullanım koşullarını kabul etmiş sayılırsınız.", color: "#6BA3A0", bg: "#ECFEFF" },
            { icon: "info", label: "Uygulama Hakkında", msg: "Cildim v1.0\nİçerik analizi & şahsi cilt bakımı rehberi", color: "#6BA3A0", bg: "#ECFEFF" },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuItem, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              onPress={() => Alert.alert(item.label, item.msg)}
            >
              <View style={[styles.menuIconBox, { backgroundColor: item.bg }]}>
                <Feather name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>{item.label}</Text>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ECZ4 PHASE 2C-4 — KVKK 7.3 (rıza geri çekme) için pratik akış.
            Hesabı silmeden cihazdaki tüm bakım verilerini temizler. Misafir
            kullanıcı için de görünür: cihazda anonim biriken veriler temizlenebilsin. */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GİZLİLİK & VERİLERİM</Text>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: isDark ? "#2A1F0A" : "#FFFBEB", borderColor: isDark ? "#5C4015" : "#FDE68A" }]}
            onPress={handleVerileriSifirla}
            disabled={resettingData}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIconBox, { backgroundColor: isDark ? "#3F2D0A" : "#FEF3C7" }]}>
              {resettingData ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <Feather name="refresh-ccw" size={16} color="#D97706" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, { color: isDark ? "#FCD34D" : "#92400E" }]}>Cilt Verilerimi ve Rızamı Sıfırla</Text>
              <Text style={{ fontSize: 12, color: isDark ? "#FBBF24" : "#B45309", marginTop: 2, lineHeight: 16 }}>
                Hesap korunur; cilt profili, alerji, geçmiş ve rutin verileri bu cihazdan temizlenir.
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#D97706" />
          </TouchableOpacity>
        </View>

        {user && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HESAP</Text>
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
              onPress={handleHesapSil}
              disabled={deletingAccount}
            >
              <View style={[styles.menuIconBox, { backgroundColor: "#FEE2E2" }]}>
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Feather name="trash-2" size={16} color="#EF4444" />
                )}
              </View>
              <Text style={[styles.menuText, { color: "#DC2626" }]}>Hesabı Sil</Text>
              <Feather name="chevron-right" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroBand: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    overflow: "hidden",
  },
  decoCircle1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -50,
    right: -30,
  },
  decoCircle2: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -20,
    left: 30,
  },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  heroTextArea: { flex: 1, gap: 6 },
  heroIconRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 24, fontWeight: "800" as const, color: "#fff" },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.8, marginBottom: 10 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 6,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, fontSize: 15 },
});