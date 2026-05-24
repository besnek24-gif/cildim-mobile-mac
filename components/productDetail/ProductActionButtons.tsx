import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { PD } from "@/constants/productDetailTokens";
import type { NormalizedProduct } from "@/lib/normalizeProduct";

interface Props {
  product: NormalizedProduct;
  isDark: boolean;
  cardBg: string;
  cardBorder: string;
  primary: string;
  textMuted: string;
  textSecondary: string;
  favorited: boolean;
  favLoading: boolean;
  hasMuadil: boolean;
  onFavorite: () => void;
  onIngredients: () => void;
  onMuadil: () => void;
  onCompare: () => void;
}

interface ActionBtnProps {
  bg: string;
  border: string;
  icon: string;
  iconColor: string;
  label: string;
  labelColor: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function ActionBtn({ bg, border, icon, iconColor, label, labelColor, onPress, loading, disabled }: ActionBtnProps) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: PD.radius.md,
        borderWidth: PD.card.borderWidth,
        minWidth: "22%" as any,
        backgroundColor: bg,
        borderColor: border,
      }}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      disabled={disabled}
      activeOpacity={0.75}
      hitSlop={{ top: 4, bottom: 4 }}
    >
      {loading
        ? <ActivityIndicator size="small" color={iconColor} />
        : <Feather name={icon as any} size={16} color={iconColor} />
      }
      <Text style={{ fontSize: 13, fontWeight: "600", color: labelColor }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ProductActionButtons({
  product, isDark, cardBg, cardBorder, primary, textMuted, textSecondary,
  favorited, favLoading, hasMuadil, onFavorite, onIngredients, onMuadil, onCompare,
}: Props) {
  return (
    <View style={{ flexDirection: "row", gap: PD.spacing.sm, flexWrap: "wrap" }}>
      {/* Favori */}
      <ActionBtn
        bg={favorited ? (isDark ? "#3B0A14" : "#FEF2F2") : cardBg}
        border={favorited ? "#FCA5A5" : cardBorder}
        icon="heart"
        iconColor={favorited ? "#E11D48" : textMuted}
        label={favorited ? "Favoride" : "Favori"}
        labelColor={favorited ? "#E11D48" : textSecondary}
        onPress={onFavorite}
        loading={favLoading}
        disabled={favLoading}
      />
      {/* İçerikler */}
      <ActionBtn
        bg={cardBg}
        border={cardBorder}
        icon="list"
        iconColor={primary}
        label="İçerikler"
        labelColor={primary}
        onPress={onIngredients}
      />
      {/* Muadil — always visible, behavior depends on hasMuadil */}
      <ActionBtn
        bg={isDark ? "#2A3820" : "#EAF1EA"}
        border={isDark ? "#3A4D30" : "#B8CEB8"}
        icon="refresh-cw"
        iconColor="#7A8F6B"
        label="Muadil"
        labelColor="#7A8F6B"
        onPress={onMuadil}
      />
    </View>
  );
}
