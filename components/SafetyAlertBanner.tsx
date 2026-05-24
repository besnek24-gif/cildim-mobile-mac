/**
 * SafetyAlertBanner.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Ürün sayfasında açıklama bölümünün üzerinde gösterilen güvenlik uyarı kartları.
 *
 * Renk kodlaması:
 *   danger  → kırmızı   (alerji çakışması, hamilelik yüksek risk)
 *   warning → sarı/amber (hassas cilt tetikleyicisi, hamilelik dikkat)
 *   info    → mavi       (eksik veri bilgisi)
 *   safe    → yeşil      (opsiyonel — hiç uyarı yokken profil doldurulmuşsa)
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  alertSeverityBg,
  alertSeverityBorder,
  alertSeverityColor,
  alertSeverityIcon,
  type SafetyAlert,
  type SafetyAlertResult,
} from "@/lib/safetyAlertEngine";

// ─── Tekli uyarı kartı ────────────────────────────────────────────────────────

interface AlertCardProps {
  alert: SafetyAlert;
  isDark: boolean;
}

function AlertCard({ alert, isDark }: AlertCardProps) {
  const color  = alertSeverityColor(alert.severity);
  const bg     = alertSeverityBg(alert.severity, isDark);
  const border = alertSeverityBorder(alert.severity, isDark);
  const icon   = alertSeverityIcon(alert.severity) as any;

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}20` }]}>
          <Feather name={icon} size={13} color={color} />
        </View>
        <Text style={[styles.cardTitle, { color }]}>{alert.title}</Text>
      </View>
      <Text style={[styles.cardMsg, { color: isDark ? `${color}CC` : color }]}>
        {alert.message}
      </Text>
    </View>
  );
}

// ─── Safe badge (profil dolu ama uyarı yok) ──────────────────────────────────

function SafeBadge({ isDark }: { isDark: boolean }) {
  const color  = alertSeverityColor("safe");
  const bg     = alertSeverityBg("safe", isDark);
  const border = alertSeverityBorder("safe", isDark);

  return (
    <View style={[styles.safeBadge, { backgroundColor: bg, borderColor: border }]}>
      <Feather name="check-circle" size={13} color={color} />
      <Text style={[styles.safeText, { color }]}>
        Profilinize göre belirgin bir uyarı saptanmadı.
      </Text>
    </View>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

interface SafetyAlertBannerProps {
  result: SafetyAlertResult;
  isDark: boolean;
  /** Yeşil "güvenli" rozeti gösterilsin mi? (varsayılan: false) */
  showSafeBadge?: boolean;
}

export function SafetyAlertBanner({ result, isDark, showSafeBadge = false }: SafetyAlertBannerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { alerts, isProfiled } = result;

  // Hiç uyarı yoksa
  if (!isProfiled) return null;
  if (alerts.length === 0) {
    if (!showSafeBadge) return null;
    return (
      <View style={styles.wrapper}>
        <SafeBadge isDark={isDark} />
      </View>
    );
  }

  // danger veya warning uyarıları vs sadece info olanlar
  const highPriority = alerts.filter(a => a.severity === "danger" || a.severity === "warning");
  const infoOnly     = alerts.filter(a => a.severity === "info");

  return (
    <View style={styles.wrapper}>
      {/* Başlık + collapse toggle */}
      <Pressable
        onPress={() => setCollapsed(v => !v)}
        style={styles.header}
        hitSlop={8}
      >
        <View style={styles.headerLeft}>
          <Feather
            name={result.maxSeverity === "danger" ? "alert-triangle" : result.maxSeverity === "warning" ? "alert-circle" : "info"}
            size={14}
            color={alertSeverityColor(result.maxSeverity ?? "info")}
          />
          <Text style={[styles.headerTitle, { color: alertSeverityColor(result.maxSeverity ?? "info") }]}>
            {highPriority.length > 0
              ? `${highPriority.length} güvenlik uyarısı`
              : `${infoOnly.length} bilgi notu`}
          </Text>
        </View>
        <Feather
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={14}
          color={alertSeverityColor(result.maxSeverity ?? "info")}
        />
      </Pressable>

      {/* Uyarı kartları */}
      {!collapsed && (
        <View style={styles.cards}>
          {highPriority.map(a => (
            <AlertCard key={a.id} alert={a} isDark={isDark} />
          ))}
          {infoOnly.map(a => (
            <AlertCard key={a.id} alert={a} isDark={isDark} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  cards: {
    gap: 6,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  cardMsg: {
    fontSize: 12.5,
    fontWeight: "400",
    lineHeight: 18,
    paddingLeft: 31,
  },
  safeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  safeText: {
    fontSize: 12.5,
    fontWeight: "500",
    flex: 1,
    lineHeight: 17,
  },
});
