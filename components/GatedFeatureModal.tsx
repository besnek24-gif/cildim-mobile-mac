/**
 * GatedFeatureModal.tsx
 * Paylaşılan premium kapı modalı — profil ve ana ekranda kullanılır.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export type GatedFeatureKey = "dermosistan" | "rutin" | "analiz" | "raporlar";

export const GATED_FEATURES: Record<GatedFeatureKey, {
  icon: string; color: string; bg: string;
  title: string; description: string; info: string; premium: boolean;
}> = {
  dermosistan: {
    icon: "message-circle", color: "#2563EB", bg: "#EFF6FF",
    title: "DermoAsistan (Seçkin)",
    description: "Cildine özel içerik analizi ve akıllı öneriler sunar.",
    info: "Bu özellik Seçkin üyelik ile kullanılabilir.",
    premium: true,
  },
  rutin: {
    icon: "list", color: "#7A8F6B", bg: "#EAF1EA",
    title: "Şahsi Rutin",
    description: "Cildine özel sabah ve akşam bakım planı oluşturur, günlük ilerlemeni takip eder.",
    info: "Bu özellik için giriş yapmalısın.",
    premium: false,
  },
  analiz: {
    icon: "aperture", color: "#7C3AED", bg: "#F5F3FF",
    title: "Cilt Bakım Profili",
    description: "5 farklı açıdan selfie ile cilt tipini ve sorunlarını analiz eder, şahsi rutin ve ürün önerileri sunar.",
    info: "Bu özellik için giriş yapman ve Seçkin üyelik gerekiyor.",
    premium: true,
  },
  raporlar: {
    icon: "bar-chart-2", color: "#C8A97E", bg: "#FFF7ED",
    title: "Bakım Profillerim",
    description: "Cilt analizlerinin geçmişini görüntüle, değişimleri ve gelişimini takip et.",
    info: "Bu özellik için giriş yapmalısın.",
    premium: false,
  },
};

export function GatedFeatureModal({
  featureKey, onClose,
}: {
  featureKey: GatedFeatureKey | null;
  onClose: () => void;
}) {
  if (!featureKey) return null;
  const f = GATED_FEATURES[featureKey];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={gm.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <View style={gm.sheet}>
          <View style={gm.handle} />

          <View style={[gm.iconCircle, { backgroundColor: f.bg }]}>
            <Feather name={f.icon as any} size={30} color={f.color} />
          </View>

          {f.premium && (
            <View style={gm.premiumBadge}>
              <Text style={gm.premiumBadgeTxt}>✦ Seçkin üyelik gerekiyor</Text>
            </View>
          )}

          <Text style={gm.title}>{f.title}</Text>
          <Text style={gm.desc}>{f.description}</Text>

          <View style={gm.infoBox}>
            <Feather name="lock" size={13} color="#64748B" />
            <Text style={gm.infoTxt}>{f.info}</Text>
          </View>

          {f.premium ? (
            <>
              <TouchableOpacity
                style={gm.primaryBtn}
                onPress={() => { onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/uyelik" as any); }}
                activeOpacity={0.85}
              >
                <Feather name="star" size={16} color="#fff" />
                <Text style={gm.primaryBtnTxt}>Seçkin Üyeliğe Geç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={gm.secondaryBtn}
                onPress={() => { onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/giris"); }}
                activeOpacity={0.82}
              >
                <Text style={gm.secondaryBtnTxt}>Giriş Yap</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={gm.primaryBtn}
                onPress={() => { onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/giris"); }}
                activeOpacity={0.85}
              >
                <Feather name="log-in" size={16} color="#fff" />
                <Text style={gm.primaryBtnTxt}>Giriş Yap</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={gm.secondaryBtn}
                onPress={() => { onClose(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/giris"); }}
                activeOpacity={0.82}
              >
                <Text style={gm.secondaryBtnTxt}>Kayıt Ol</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={gm.dismissBtn}>
            <Text style={gm.dismissTxt}>Daha Sonra</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const gm = StyleSheet.create({
  overlay:         { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:           {
    backgroundColor: "#FDFAF7", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, gap: 12,
    alignItems: "center",
  },
  handle:          { width: 40, height: 4, backgroundColor: "#DDD8D0", borderRadius: 2, marginBottom: 8 },
  iconCircle:      { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  premiumBadge:    { backgroundColor: "#FFF7ED", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "#F5D9A8" },
  premiumBadgeTxt: { fontSize: 11, fontWeight: "700" as const, color: "#B87333", letterSpacing: 0.4 },
  title:           { fontSize: 19, fontWeight: "800" as const, color: "#1A1208", textAlign: "center", letterSpacing: -0.3 },
  desc:            { fontSize: 14, color: "#5A5348", textAlign: "center", lineHeight: 21, maxWidth: 300 },
  infoBox:         {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#F5F0E8", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, alignSelf: "stretch",
  },
  infoTxt:         { flex: 1, fontSize: 12.5, color: "#64748B", lineHeight: 18 },
  primaryBtn:      {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#7A8F6B", borderRadius: 16,
    paddingVertical: 15, alignSelf: "stretch",
  },
  primaryBtnTxt:   { fontSize: 15, fontWeight: "700" as const, color: "#fff" },
  secondaryBtn:    {
    borderRadius: 16, borderWidth: 1.5, borderColor: "#DDD8D0",
    paddingVertical: 13, alignSelf: "stretch", alignItems: "center",
  },
  secondaryBtnTxt: { fontSize: 15, fontWeight: "600" as const, color: "#5A5348" },
  dismissBtn:      { paddingVertical: 6 },
  dismissTxt:      { fontSize: 13, color: "#94A3B8", fontWeight: "500" as const },
});
