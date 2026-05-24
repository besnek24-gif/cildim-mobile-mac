import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ProductStatus } from "@/lib/admin/adminProductStatusService";

export interface AdminListRowProps {
  name:         string;
  brand:        string;
  category?:    string;
  subcategory?: string;
  createdAt?:   string;
  status?:      ProductStatus | null;
}

const STATUS_CONFIG: Record<ProductStatus, { label: string; bg: string; color: string }> = {
  approved: { label: "Onaylı",    bg: "#DCFCE7", color: "#15803D" },
  pending:  { label: "Bekliyor",  bg: "#FEF9C3", color: "#A16207" },
  rejected: { label: "Reddedildi", bg: "#FEE2E2", color: "#DC2626" },
};

export function AdminListRow({ name, brand, category, subcategory, createdAt, status }: AdminListRowProps) {
  const resolvedStatus = status ?? null;
  const badge = resolvedStatus ? STATUS_CONFIG[resolvedStatus] : null;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: "#F3F4F6" }]}>
            <Text style={[styles.badgeText, { color: "#9CA3AF" }]}>Onaylı (varsayılan)</Text>
          </View>
        )}
      </View>
      <Text style={styles.brand} numberOfLines={1}>{brand}</Text>
      {(category || subcategory) ? (
        <Text style={styles.meta} numberOfLines={1}>
          {[category, subcategory].filter(Boolean).join(" › ")}
        </Text>
      ) : null}
      {createdAt ? (
        <Text style={styles.date}>{new Date(createdAt).toLocaleDateString("tr-TR")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  brand: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  date: {
    fontSize: 10,
    color: "#D1D5DB",
    marginTop: 2,
  },
});
