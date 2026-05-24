/**
 * PremiumLockCard — Yeniden kullanılabilir premium kilit kartı
 *
 * Kullanım:
 *   <PremiumLockCard
 *     title="Hamilelik Bilgileri"
 *     description="Bu bölüm Seçkin Üyelik ile kullanılabilir."
 *     onUpgrade={() => router.push("/uyelik")}
 *   />
 */

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  title: string;
  description?: string;
  features?: string[];
  onUpgrade?: () => void;
  compact?: boolean;
}

export function PremiumLockCard({ title, description, features, onUpgrade, compact }: Props) {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const handleUpgrade = onUpgrade ?? (() => router.push("/uyelik" as any));

  if (compact) {
    return (
      <View style={[s.compact, { backgroundColor: colors.premiumCardBg, borderColor: colors.premiumBorderColor }]}>
        <View style={[s.compactIcon, { backgroundColor: `${colors.premium}20` }]}>
          <Feather name="lock" size={14} color={colors.premium} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.compactTitle, { color: colors.premiumTextDeep }]}>{title}</Text>
          {!!description && (
            <Text style={[s.compactDesc, { color: isDark ? colors.textMuted : colors.textSecondary }]}>{description}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleUpgrade} style={[s.compactBtn, { backgroundColor: colors.premium }]} activeOpacity={0.82}>
          <Text style={s.compactBtnText}>Yükselt</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: colors.premiumCardBg, borderColor: colors.premiumBorderColor }]}>
      {/* Kilit ikonu */}
      <View style={[s.lockCircle, { backgroundColor: `${colors.premium}18` }]}>
        <Feather name="lock" size={22} color={colors.premium} />
      </View>

      {/* Başlık */}
      <Text style={[s.title, { color: colors.premiumTextDeep }]}>{title}</Text>

      {/* Açıklama */}
      {!!description && (
        <Text style={[s.desc, { color: isDark ? colors.textMuted : colors.textSecondary }]}>{description}</Text>
      )}

      {/* Özellik listesi */}
      {!!features && features.length > 0 && (
        <View style={s.featureList}>
          {features.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={[s.featureDot, { backgroundColor: colors.premium }]} />
              <Text style={[s.featureText, { color: colors.premiumTextDeep }]}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Yükselt butonu */}
      <TouchableOpacity onPress={handleUpgrade} style={[s.btn, { backgroundColor: colors.premium }]} activeOpacity={0.82}>
        <Feather name="award" size={15} color="#fff" />
        <Text style={s.btnText}>Seçkin üyeliğe yüksel</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    alignItems: "center",
  },
  lockCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  desc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  featureList: {
    width: "100%",
    gap: 6,
    marginVertical: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    fontSize: 13,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  compactIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  compactDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  compactBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  compactBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
