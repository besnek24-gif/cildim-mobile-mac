/**
 * GunlukSinyalCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium kullanıcılar için günlük cilt sinyal girişi.
 * Kullanıcı bugün ne hissettiklerini 4 chip arasından seçer.
 * Seçim, adaptif sistem mesajını tetikler.
 *
 * Tasarım prensibi: eczacı danışman dili — hüküm verme, bilgilendirme yap.
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type SkinSignalKey = "breakout" | "irritation" | "good" | "dry" | null;

interface SkinSignalDef {
  key: Exclude<SkinSignalKey, null>;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  adaptiveMsg: string;
}

const SIGNALS: SkinSignalDef[] = [
  {
    key: "good",
    label: "Cilt iyi",
    icon: "sun",
    color: "#15803D",
    adaptiveMsg: "Rutin devam ediyor. Devamlılık bu noktada en önemli faktördür.",
  },
  {
    key: "breakout",
    label: "Sivilce arttı",
    icon: "alert-circle",
    color: "#DC2626",
    adaptiveMsg: "Aktif içerik yoğunluğu geçici olarak azaltıldı. Bu süreçte tahriş edici ürünlerden kaçınmak cildin toparlanmasını hızlandırır.",
  },
  {
    key: "irritation",
    label: "Tahriş var",
    icon: "wind",
    color: "#D97706",
    adaptiveMsg: "Rutin sadeleştirildi, bariyer onarımı önceliğe alındı. Yeni ürün eklemek için birkaç gün beklemek daha doğru olur.",
  },
  {
    key: "dry",
    label: "Çok kuru",
    icon: "droplet",
    color: "#2563EB",
    adaptiveMsg: "Nem katmanı artırıldı. Serum + krem katmanlı uygulaması tek başına kreme göre daha etkilidir.",
  },
];

interface GunlukSinyalCardProps {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  cardBg: string;
  accent: string;
  /** Opsiyonel — seçim değiştiğinde üst bileşene bildir */
  onSignalChange?: (signal: SkinSignalKey) => void;
}

export function GunlukSinyalCard({
  isDark,
  textPrimary,
  textSecondary,
  borderColor,
  cardBg,
  accent,
  onSignalChange,
}: GunlukSinyalCardProps) {
  const [selected, setSelected] = useState<SkinSignalKey>(null);

  const activeDef = SIGNALS.find(s => s.key === selected) ?? null;

  function select(key: Exclude<SkinSignalKey, null>) {
    const next = selected === key ? null : key;
    setSelected(next);
    onSignalChange?.(next);
  }

  return (
    <View style={[gs.card, { backgroundColor: cardBg, borderColor }]}>
      {/* Başlık */}
      <View style={gs.header}>
        <View style={[gs.iconWrap, { backgroundColor: `${accent}18` }]}>
          <Feather name="activity" size={14} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[gs.title, { color: textPrimary }]}>Bugün nasıl hissettiriyor?</Text>
          <Text style={[gs.sub, { color: textSecondary }]}>
            Seçimin rutini gerekirse uyarlar.
          </Text>
        </View>
      </View>

      {/* Sinyal chip'leri */}
      <View style={gs.chips}>
        {SIGNALS.map(sig => {
          const isActive = selected === sig.key;
          return (
            <Pressable
              key={sig.key}
              onPress={() => select(sig.key)}
              style={({ pressed }) => [
                gs.chip,
                {
                  backgroundColor: isActive
                    ? `${sig.color}18`
                    : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
                  borderColor: isActive ? `${sig.color}45` : borderColor,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name={sig.icon} size={12} color={isActive ? sig.color : textSecondary} />
              <Text
                style={[
                  gs.chipLabel,
                  { color: isActive ? sig.color : textSecondary, fontWeight: isActive ? "700" : "500" },
                ]}
              >
                {sig.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Adaptif mesaj */}
      {activeDef && (
        <View
          style={[
            gs.msgBox,
            {
              backgroundColor: `${activeDef.color}10`,
              borderColor: `${activeDef.color}28`,
            },
          ]}
        >
          <Feather name="info" size={12} color={activeDef.color} style={{ flexShrink: 0, marginTop: 1 }} />
          <Text style={[gs.msgText, { color: isDark ? `${activeDef.color}DD` : activeDef.color }]}>
            {activeDef.adaptiveMsg}
          </Text>
        </View>
      )}
    </View>
  );
}

const gs = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontSize: 13.5,
    fontWeight: "700",
    lineHeight: 18,
  },
  sub: {
    fontSize: 11.5,
    fontWeight: "400",
    marginTop: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipLabel: {
    fontSize: 12.5,
  },
  msgBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginTop: 10,
  },
  msgText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "400",
    lineHeight: 18,
  },
});
