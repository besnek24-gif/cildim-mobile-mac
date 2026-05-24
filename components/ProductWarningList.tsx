/**
 * ProductWarningList.tsx
 *
 * Ürüne özel uyarı listesi — her uyarı altında isteğe bağlı yönlendirici öneri.
 * Mevcut WarningCard'ı sarmalar; onu değiştirmez.
 *
 * Özellikler:
 *  - WarningCard (mevcut bileşen) → uyarı kartını render eder
 *  - SuggestionChip → uyarı altında nazik bir yönlendirme
 *    • "alternative" → "Benzerleri gör →" butonu
 *    • "category"    → kategori ipucu rozeti
 *    • "none"        → hiçbir şey gösterilmez
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WarningCard } from "@/components/WarningCard";
import type { SmartWarningWithSuggestion } from "@/lib/productWarnings";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductWarningListProps {
  warnings:            SmartWarningWithSuggestion[];
  isDark?:             boolean;
  isPremium?:          boolean;
  compact?:            boolean;
  /** Çağrıldığında benzerleri sayfasına yönlendirir (ürün bağlamına göre bağlanmalı) */
  onAlternativesPress?: () => void;
  /** Free kullanıcı premiumDetail'li bir uyarıya / "Daha derin bak" rozetine
   *  dokunduğunda çağrılır (Seçkin paywall modalı açmak için). */
  onPremiumLockPress?:  () => void;
}

// ─── Renk paleti (suggestion chip) ───────────────────────────────────────────

const CHIP_LIGHT = {
  bg:     "rgba(122,143,107,0.06)",
  border: "rgba(122,143,107,0.18)",
  icon:   "#7A8F6B",
  text:   "#4B5E3F",
  muted:  "#6B7280",
  pill:   { bg: "rgba(122,143,107,0.10)", border: "rgba(122,143,107,0.25)", text: "#4B5E3F" },
  btn:    { text: "#7A8F6B" },
};
const CHIP_DARK  = {
  bg:     "rgba(157,184,141,0.07)",
  border: "rgba(157,184,141,0.18)",
  icon:   "#9DB88D",
  text:   "#BDD5AC",
  muted:  "#9CA3AF",
  pill:   { bg: "rgba(157,184,141,0.10)", border: "rgba(157,184,141,0.22)", text: "#BDD5AC" },
  btn:    { text: "#9DB88D" },
};

// ─── Öneri Chip ───────────────────────────────────────────────────────────────

interface SuggestionChipProps {
  message:             string;
  suggestionType:      "alternative" | "category" | "none";
  categoryHint?:       string;
  isDark:              boolean;
  onAlternativesPress?: () => void;
}

function SuggestionChip({
  message,
  suggestionType,
  categoryHint,
  isDark,
  onAlternativesPress,
}: SuggestionChipProps) {
  if (suggestionType === "none" || !message) return null;

  const palette = isDark ? CHIP_DARK : CHIP_LIGHT;

  return (
    <View style={[
      styles.chip,
      { backgroundColor: palette.bg, borderColor: palette.border },
    ]}>
      {/* Mesaj satırı */}
      <View style={styles.chipRow}>
        <View style={[styles.chipIconWrap, { backgroundColor: `${palette.icon}14` }]}>
          <Feather name="compass" size={11} color={palette.icon} />
        </View>
        <Text style={[styles.chipMessage, { color: palette.text }]}>
          {message}
        </Text>
      </View>

      {/* Kategori rozeti */}
      {suggestionType === "category" && !!categoryHint && (
        <View style={styles.chipBottom}>
          <View style={[
            styles.categoryPill,
            { backgroundColor: palette.pill.bg, borderColor: palette.pill.border },
          ]}>
            <Feather name="search" size={9} color={palette.icon} />
            <Text style={[styles.categoryPillText, { color: palette.pill.text }]}>
              {categoryHint}
            </Text>
          </View>
        </View>
      )}

      {/* Benzerleri gör butonu */}
      {suggestionType === "alternative" && !!onAlternativesPress && (
        <View style={styles.chipBottom}>
          <TouchableOpacity
            style={styles.altBtn}
            onPress={onAlternativesPress}
            activeOpacity={0.7}
          >
            <Text style={[styles.altBtnText, { color: palette.btn.text }]}>
              Benzer ürünlere bak
            </Text>
            <Feather name="arrow-right" size={11} color={palette.btn.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Alternatif butonu yok ama tip "alternative" — sessiz gösterim */}
      {suggestionType === "alternative" && !onAlternativesPress && (
        <View style={styles.chipBottom}>
          <View style={[
            styles.categoryPill,
            { backgroundColor: palette.pill.bg, borderColor: palette.pill.border },
          ]}>
            <Feather name="layers" size={9} color={palette.icon} />
            <Text style={[styles.categoryPillText, { color: palette.pill.text }]}>
              Alternatifler mevcut
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Ana liste bileşeni ───────────────────────────────────────────────────────

export function ProductWarningList({
  warnings,
  isDark = false,
  isPremium = false,
  compact = false,
  onAlternativesPress,
  onPremiumLockPress,
}: ProductWarningListProps) {
  if (!warnings.length) return null;

  return (
    <View>
      {warnings.map((w, index) => (
        <View
          key={w.id}
          style={index < warnings.length - 1 ? styles.itemWrap : undefined}
        >
          <WarningCard
            warning={w}
            isDark={isDark}
            isPremium={isPremium}
            compact={compact}
            onPremiumLockPress={onPremiumLockPress}
          />
          {w.suggestion && w.suggestion.suggestionType !== "none" && (
            <SuggestionChip
              message={w.suggestion.message}
              suggestionType={w.suggestion.suggestionType}
              categoryHint={w.suggestion.categoryHint}
              isDark={isDark}
              onAlternativesPress={
                w.suggestion.suggestionType === "alternative"
                  ? onAlternativesPress
                  : undefined
              }
            />
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  itemWrap:        { marginBottom: 10 },

  chip:            {
    borderRadius: 11,
    borderWidth:  1,
    paddingHorizontal: 11,
    paddingVertical:   9,
    marginTop:    5,
  },
  chipRow:         { flexDirection: "row", alignItems: "flex-start" },
  chipIconWrap:    {
    width: 22, height: 22, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginRight: 8, marginTop: 1,
  },
  chipMessage:     { flex: 1, fontSize: 12, fontWeight: "400", lineHeight: 17 },

  chipBottom:      { marginTop: 8, paddingLeft: 30 },

  categoryPill:    {
    flexDirection: "row", alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  categoryPillText: { fontSize: 11, fontWeight: "600", marginLeft: 5 },

  altBtn:          { flexDirection: "row", alignItems: "center" },
  altBtnText:      { fontSize: 12, fontWeight: "600", marginRight: 4 },
});
