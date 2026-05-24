/**
 * WarningCard.tsx
 * Yeniden kullanılabilir akıllı uyarı kartı — sakin, premium, non-alarmist
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SmartWarning } from "@/lib/smartWarningEngine";

// ─── Renk ve ikon eşlemeleri ──────────────────────────────────────────────────

const SEVERITY_PALETTE = {
  low:    { light: { bg: "rgba(59,130,246,0.07)", border: "rgba(59,130,246,0.18)", icon: "#3B82F6", text: "#1D4ED8" },
             dark:  { bg: "rgba(59,130,246,0.09)", border: "rgba(59,130,246,0.22)", icon: "#60A5FA", text: "#93C5FD" } },
  medium: { light: { bg: "rgba(234,179,8,0.07)",  border: "rgba(234,179,8,0.20)",  icon: "#CA8A04", text: "#A16207" },
             dark:  { bg: "rgba(234,179,8,0.09)",  border: "rgba(234,179,8,0.24)",  icon: "#FACC15", text: "#FDE047" } },
  high:   { light: { bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.18)",  icon: "#DC2626", text: "#B91C1C" },
             dark:  { bg: "rgba(239,68,68,0.09)",  border: "rgba(239,68,68,0.22)",  icon: "#F87171", text: "#FCA5A5" } },
};

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  sensitivity:    "wind",
  barrier:        "shield",
  active_overload:"zap",
  combination:    "layers",
  beginner:       "compass",
  pregnancy:      "heart",
  allergy:        "alert-circle",
};

// ─── Bileşen ──────────────────────────────────────────────────────────────────

interface WarningCardProps {
  warning:             SmartWarning;
  isDark?:             boolean;
  isPremium?:          boolean;
  compact?:            boolean;
  /** Free kullanıcı premiumDetail'li bir uyarıya / "Daha derin bak" rozetine
   *  dokunduğunda çağrılır (Seçkin paywall modalı açmak için). */
  onPremiumLockPress?: () => void;
}

export function WarningCard({ warning, isDark = false, isPremium = false, compact = false, onPremiumLockPress }: WarningCardProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = isDark ? "dark" : "light";
  const palette = SEVERITY_PALETTE[warning.severity][theme];
  const iconName = TYPE_ICONS[warning.type] ?? "info";
  const hasPremiumDetail = !!warning.premiumDetail && isPremium;
  const hasSoftLock      = !!warning.premiumDetail && !isPremium;

  // onPress kararı:
  //  • Premium + premiumDetail → akordiyonu aç/kapa
  //  • Free + premiumDetail + onPremiumLockPress → Seçkin modalı aç
  //  • Aksi → tıklanmaz
  const handlePress = hasPremiumDetail
    ? () => setExpanded(v => !v)
    : (hasSoftLock && onPremiumLockPress ? onPremiumLockPress : undefined);

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.card,
        { backgroundColor: palette.bg, borderColor: palette.border },
        compact && styles.compact,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${palette.icon}20` }]}>
          <Feather name={iconName} size={13} color={palette.icon} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: isDark ? palette.text : palette.text }]}>
            {warning.title}
          </Text>
          <Text style={[styles.message, { color: isDark ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.58)" }]}>
            {warning.message}
          </Text>
        </View>
        {hasPremiumDetail && (
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={palette.icon} />
        )}
      </View>

      {/* Premium detay — açık */}
      {hasPremiumDetail && expanded && (
        <View style={[styles.premiumDetail, { borderTopColor: palette.border }]}>
          <Feather name="star" size={11} color={palette.icon} />
          <Text style={[styles.premiumText, { color: isDark ? palette.text : palette.text }]}>
            {warning.premiumDetail}
          </Text>
        </View>
      )}

      {/* Soft lock — free kullanıcı için merak uyandırıcı ipucu */}
      {!isPremium && !!warning.premiumDetail && (
        <View
          style={[
            styles.softLock,
            { borderTopColor: palette.border },
            // Karşılaştırma ekranı gibi DAR sütunlarda (compact=true) yan yana
            // text + badge layout'u patlıyor: badge'in flexShrink:0 + intrinsic
            // genişliği ~125px ≥ kullanılabilir ~134px → text wrapper 0px'e
            // çöküyor ve "Nasıl düzenlenmeli?" harfleri dik diziliyor.
            // Çözüm: compact modda softLock'u column'a çevir, badge alt satıra düşsün.
            compact && styles.softLockCompact,
          ]}
        >
          <View
            style={[
              { flex: 1, gap: 2 },
              compact && { width: "100%", flexShrink: 1 },
            ]}
          >
            <Text style={[styles.softLockLabel, { color: isDark ? "#A8A29E" : "#78716C" }]}>
              Nasıl düzenlenmeli?
            </Text>
            <Text style={[styles.softLockHint, { color: isDark ? "#57534E" : "#A8A29E" }]}>
              Bu cilt yapısında bu uyarının pratikte ne anlama geldiği ve alternatif yaklaşım — Seçkin üyelere açık.
            </Text>
          </View>
          <View
            style={[
              styles.softLockBadge,
              { borderColor: "rgba(184,115,51,0.35)", backgroundColor: "rgba(184,115,51,0.07)" },
              compact && styles.softLockBadgeCompact,
            ]}
          >
            <Feather name="lock" size={9} color="#B87333" />
            <Text style={styles.softLockBadgeText}>Daha derin bak</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ─── Liste sarmalayıcı ─────────────────────────────────────────────────────────

interface WarningListProps {
  warnings:            SmartWarning[];
  isDark?:             boolean;
  isPremium?:          boolean;
  max?:                number;
  compact?:            boolean;
  onPremiumLockPress?: () => void;
}

export function WarningList({ warnings, isDark, isPremium, max = 99, compact = false, onPremiumLockPress }: WarningListProps) {
  if (!warnings.length) return null;
  const shown = warnings.slice(0, max);
  return (
    <View style={styles.list}>
      {shown.map(w => (
        <WarningCard
          key={w.id}
          warning={w}
          isDark={isDark}
          isPremium={isPremium}
          compact={compact}
          onPremiumLockPress={onPremiumLockPress}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list:        { gap: 8 },
  card:        { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  compact:     { paddingVertical: 8, paddingHorizontal: 10 },
  row:         { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  iconWrap:    { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  title:       { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  message:     { fontSize: 12.5, fontWeight: "400", lineHeight: 18 },
  premiumDetail:{ flexDirection: "row", alignItems: "flex-start", gap: 7, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, marginTop: 8 },
  premiumText: { flex: 1, fontSize: 12, fontWeight: "500", lineHeight: 17 },
  softLock: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9, marginTop: 8 },
  // Compact (dar sütun) override — column layout, text üstte tam genişlik, badge altta sola yaslı
  softLockCompact: { flexDirection: "column", alignItems: "stretch", gap: 8, width: "100%" },
  softLockLabel: { fontSize: 11, fontWeight: "700" },
  softLockHint: { fontSize: 11, lineHeight: 15 },
  softLockBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, flexShrink: 0 },
  softLockBadgeCompact: { alignSelf: "flex-start", marginTop: 2 },
  softLockBadgeText: { fontSize: 10, fontWeight: "700", color: "#B87333" },
});
