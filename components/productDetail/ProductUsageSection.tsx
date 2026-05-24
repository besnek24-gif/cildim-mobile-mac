import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

function toTrUpper(s: string): string {
  return s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

// Android için LayoutAnimation'ı etkinleştir
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface UsageStep {
  icon: string;
  label: string;
  text: string;
}

/**
 * Kullanım paragrafını yapısal adımlara böler.
 * Numaralı liste → cümle ayrımı → tek blok sıralamasıyla çalışır.
 */
function parseUsageInstructions(raw: string): UsageStep[] {
  const numbered = raw.match(/\d+\.\s+[^.!?]+[.!?]?/g);
  if (numbered && numbered.length >= 2) {
    return numbered.slice(0, 4).map((step, i) => ({
      icon: (["droplet", "repeat", "clock", "sun"] as const)[i] ?? "circle",
      label: (["Uygulama", "Miktar", "Zamanlama", "Yenileme"] as const)[i] ?? `Adım ${i + 1}`,
      text: step.replace(/^\d+\.\s*/, "").trim(),
    }));
  }

  const sentences = raw.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  if (sentences.length >= 2) {
    return sentences.slice(0, 4).map((s, i) => ({
      icon: (["droplet", "repeat", "clock", "sun"] as const)[i] ?? "circle",
      label: (["Uygulama", "Miktar", "Zamanlama", "Yenileme"] as const)[i] ?? `Adım ${i + 1}`,
      text: s,
    }));
  }

  return [{ icon: "clock", label: "Kullanım", text: raw }];
}

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  textColor: string;
  textSecondary: string;
  textMuted: string;
}

export function ProductUsageSection({
  product,
  isDark,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
  textMuted,
}: Props) {
  const raw = product.usageInstructions;

  const [expanded, setExpanded] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;

  // Kullanım bilgisi yoksa hiç render etme
  if (!raw) return null;

  function toggle() {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "easeInEaseOut" },
      delete: { type: "easeInEaseOut", property: "opacity" },
    });

    const toValue = expanded ? 0 : 1;
    Animated.spring(chevronAnim, {
      toValue,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();

    setExpanded(v => !v);
  }

  const steps     = parseUsageInstructions(raw);
  const isSingle  = steps.length === 1;

  const greenColor   = isDark ? "#9DB88D" : "#7A8F6B";
  const greenBg      = isDark ? "#2A3820" : "#EAF1EA";
  const greenBorder  = isDark ? "#3A4D30" : "#C8D8C8";
  const stepDivider  = isDark ? "#3A4D30" : "#C8D8C8";
  const iconBubbleBg = isDark ? "#3A4D30" : "#EAF1EA";

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View
      style={{
        borderRadius: PD.radius.lg,
        borderWidth: PD.card.borderWidth,
        backgroundColor: greenBg,
        borderColor: greenBorder,
        overflow: "hidden",
      }}
    >
      {/* ── Accordion başlık (her zaman görünür) ── */}
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: PD.card.padding,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="list" size={14} color={greenColor} />
          <Text style={[PD.font.sectionTitle, { color: greenColor }]}>
            Nasıl Kullanılır?
          </Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Feather name="chevron-down" size={16} color={greenColor} />
        </Animated.View>
      </TouchableOpacity>

      {/* ── Accordion içeriği — lazy: sadece açıkken mount edilir ── */}
      {expanded && (
        <View
          style={{
            paddingHorizontal: PD.card.padding,
            paddingBottom: PD.card.padding,
            gap: PD.spacing.sm,
          }}
        >
          {/* Ayırıcı */}
          <View
            style={{
              height: 1,
              backgroundColor: greenBorder,
              marginBottom: PD.spacing.xs,
            }}
          />

          {isSingle ? (
            <Text style={[PD.font.body, { color: textSecondary }]}>{raw}</Text>
          ) : (
            steps.map((step, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: PD.spacing.sm,
                  paddingVertical: PD.spacing.xs,
                  borderBottomWidth: i < steps.length - 1 ? 1 : 0,
                  borderBottomColor: stepDivider,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: iconBubbleBg,
                  }}
                >
                  <Feather name={step.icon as any} size={13} color={greenColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: greenColor,
                      marginBottom: 2,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                    }}
                  >
                    {toTrUpper(step.label)}
                  </Text>
                  <Text style={[PD.font.body, { color: textSecondary }]}>
                    {step.text}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}
