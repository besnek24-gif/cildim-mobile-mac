import React from "react";
import { Text, View } from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
  textColor: string;
  textSecondary: string;
  textMuted: string;
}

export function ProductExtraInfoSection({ product, isDark, textColor, textSecondary, textMuted }: Props) {
  const extra = product.extraInfo;
  const disclaimer = product.disclaimer;

  if (!extra && !disclaimer) return null;

  const accentColor = isDark ? "#6366F1" : "#A5B4FC";

  return (
    <>
      {extra ? (
        <View style={{
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
          paddingLeft: PD.spacing.md - 2,
          paddingVertical: PD.spacing.sm,
          paddingRight: PD.spacing.sm,
          borderRadius: PD.radius.sm,
          gap: PD.spacing.xs,
        }}>
          <Text style={[PD.font.sectionTitle, { color: textColor }]}>Ek Bilgi</Text>
          <Text style={[PD.font.body, { color: textSecondary }]}>{extra}</Text>
        </View>
      ) : null}

      {disclaimer ? (
        <Text style={{ fontSize: 11, color: textMuted, lineHeight: 16, paddingHorizontal: 4 }}>
          * {disclaimer}
        </Text>
      ) : null}
    </>
  );
}
