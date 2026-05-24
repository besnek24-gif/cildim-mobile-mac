/**
 * Şahsi Cilt Raporlarım
 *
 * Sections:
 * A) Aktif Rutin Özeti
 * B) Haftalık Uyum (% + durum)
 * C) Son Analiz Özeti
 * D) Karşılaştırma (varsa)
 * E) Beklenen İlerleme
 * F) Rutin Notu
 */

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { useActiveRoutine } from "@/hooks/useActiveRoutine";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import {
  routineProgramStore,
  type SavedRoutine,
} from "@/lib/premium-skin-scan-v2/routineProgramStore";

// ─── Util ─────────────────────────────────────────────────────────────────────

function weekStabilityLabel(streak: number): { label: string; color: string } {
  if (streak >= 5) return { label: "İyi", color: "#7A8F6B" };
  if (streak >= 2) return { label: "Orta", color: "#C8A97E" };
  return { label: "Düşük", color: "#94A3B8" };
}

function adherencePct(streak: number): number {
  return Math.min(100, Math.round((streak / 7) * 100));
}

function expectedProgressNote(streak: number, totalSteps: number): string {
  if (totalSteps === 0) return "Aktif rutin olmadığı için beklenen ilerleme hesaplanamıyor.";
  if (streak >= 7) return "7+ gün seri: cilt bariyer onarımı tamamlanıyor, ton eşitlenmeye başlıyor.";
  if (streak >= 5) return "5-6 gün seri: nemlenme kalıcılaşıyor, ince çizgiler hafifliyor.";
  if (streak >= 3) return "3-4 gün seri: cilt rutine alışıyor. Tutarlılık artıkça etki belirginleşir.";
  if (streak >= 1) return "İlk adımlar atıldı. Her gün tekrarlanan rutin, 2 hafta içinde fark yaratır.";
  return "Rutin başlatılmadı. Sabah veya akşam adımlarını tamamlayarak seriyi başlat.";
}

// ─── Kart bileşenleri ─────────────────────────────────────────────────────────

interface ReportCardProps {
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  isDark: boolean;
  children: React.ReactNode;
}

function ReportCard({ title, icon, iconColor, iconBg, isDark, children }: ReportCardProps) {
  return (
    <View style={[
      rc.card,
      { backgroundColor: isDark ? "#1A1D20" : "#FFFFFF",
        borderColor: isDark ? "rgba(255,255,255,0.07)" : "#EDE8E0" },
    ]}>
      <View style={rc.cardHeader}>
        <View style={[rc.iconBox, { backgroundColor: iconBg }]}>
          <Feather name={icon as any} size={14} color={iconColor} />
        </View>
        <Text style={[rc.cardTitle, { color: isDark ? "#E2E8F0" : "#1A202C" }]}>{title}</Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, valueColor, isDark }: { label: string; value: string; valueColor?: string; isDark: boolean }) {
  const labelColor = isDark ? "#64748B" : "#94A3B8";
  const valColor   = valueColor ?? (isDark ? "#CBD5E1" : "#374151");
  if (value.length > 38) {
    return (
      <View style={rc.infoRowStack}>
        <Text style={[rc.infoLabel, { color: labelColor }]}>{label}</Text>
        <Text style={[rc.infoValueFull, { color: valColor }]}>{value}</Text>
      </View>
    );
  }
  return (
    <View style={rc.infoRow}>
      <Text style={[rc.infoLabel, { color: labelColor }]} numberOfLines={2}>{label}</Text>
      <Text style={[rc.infoValue, { color: valColor }]} numberOfLines={3}>{value}</Text>
    </View>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={rc.barTrack}>
      <View style={[rc.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function CiltRaporlariScreen() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const colors = useColors();
  const insets     = useSafeAreaInsets();

  const { scrollPaddingBottom } = useTabBarInset();

  const {
    v2Routine,
    morning,
    evening,
    completedIds,
    hasRoutine,
    streak,
    loading,
  } = useActiveRoutine();

  const [history, setHistory] = useState<SavedRoutine[]>([]);

  useEffect(() => {
    routineProgramStore.loadHistory().then(setHistory);
  }, []);

  const totalSteps  = morning.length + evening.length;
  const doneToday   = completedIds.length;
  const todayPct    = totalSteps > 0 ? Math.round((doneToday / totalSteps) * 100) : 0;
  const adPct       = adherencePct(streak);
  const stability   = weekStabilityLabel(streak);
  const hasHistory  = history.length > 1;
  const latestTwo   = history.slice(0, 2);

  const bg          = isDark ? "#111318" : "#F5F1EB";
  const headerBg    = isDark ? "#1A1D20" : "#FFFFFF";

  return (
    <View style={[rc.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[rc.header, { backgroundColor: headerBg, paddingTop: insets.top + 8,
        borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#EDE8E0" }]}>
        <TouchableOpacity
          onPress={() => safeBack(router, "/(tabs)/profil")}
          hitSlop={12}
          style={rc.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={isDark ? "#CBD5E1" : "#374151"} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[rc.headerTitle, { color: isDark ? "#E2E8F0" : "#1A202C" }]}>
            Bakım Profillerim
          </Text>
          <Text style={[rc.headerSub, { color: isDark ? "#64748B" : "#94A3B8" }]}>
            Rutin uyumun ve ilerleme özeti
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: scrollPaddingBottom(32), gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* A) Aktif Rutin Özeti */}
        <ReportCard
          title="Aktif Rutin Özeti"
          icon="list"
          iconColor="#7A8F6B"
          iconBg={isDark ? "#1E2D18" : "#EAF1EA"}
          isDark={isDark}
        >
          {!hasRoutine ? (
            <View style={rc.emptyBox}>
              <Text style={[rc.emptyText, { color: isDark ? "#475569" : "#94A3B8" }]}>
                Aktif rutin bulunamadı. Bakım profili ile kendi rutinini oluştur.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/premium-skin-scan-v2" as any)}
                activeOpacity={0.85}
                style={[rc.ctaBtn, { backgroundColor: "#7A8F6B" }]}
              >
                <Text style={rc.ctaBtnText}>Bakım Profili ile Başla</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <InfoRow
                label="Sabah adımları"
                value={`${morning.length} adım`}
                isDark={isDark}
              />
              <InfoRow
                label="Akşam adımları"
                value={`${evening.length} adım`}
                isDark={isDark}
              />
              <InfoRow
                label="Toplam adım"
                value={`${totalSteps} adım`}
                isDark={isDark}
              />
              {v2Routine && (
                <InfoRow
                  label="Analiz tarihi"
                  value={new Date(v2Routine.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                  isDark={isDark}
                />
              )}
              <InfoRow
                label="Bugün tamamlanan"
                value={`${doneToday} / ${totalSteps} adım (%${todayPct})`}
                valueColor="#7A8F6B"
                isDark={isDark}
              />
              <ProgressBar pct={todayPct} color="#7A8F6B" />
            </>
          )}
        </ReportCard>

        {/* B) Haftalık Uyum */}
        <ReportCard
          title="Haftalık Uyum"
          icon="calendar"
          iconColor="#C8A97E"
          iconBg={isDark ? "#1E1408" : "#FFF7ED"}
          isDark={isDark}
        >
          <InfoRow
            label="Bu haftaki seri"
            value={`${streak} gün`}
            valueColor={stability.color}
            isDark={isDark}
          />
          <View style={rc.stabilityRow}>
            <View style={[rc.stabilityDot, { backgroundColor: stability.color }]} />
            <Text style={[rc.stabilityLabel, { color: stability.color }]}>
              {stability.label} istikrar
            </Text>
          </View>
          <ProgressBar pct={adPct} color={stability.color} />
          <Text style={[rc.noteText, { color: isDark ? "#475569" : "#9CA3AF" }]}>
            7 günlük rutin uyum tahmini: %{adPct}
          </Text>
        </ReportCard>

        {/* C) Son Analiz Özeti */}
        <ReportCard
          title="Son Analiz Özeti"
          icon="aperture"
          iconColor="#7C3AED"
          iconBg={isDark ? "#1A0F2E" : "#F5F3FF"}
          isDark={isDark}
        >
          {!v2Routine ? (
            <Text style={[rc.emptyText, { color: isDark ? "#475569" : "#94A3B8" }]}>
              Henüz tamamlanmış analiz yok.
            </Text>
          ) : (
            <>
              <InfoRow
                label="Analiz tarihi"
                value={new Date(v2Routine.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                isDark={isDark}
              />
              {v2Routine.skinType && (
                <InfoRow label="Cilt tipi" value={v2Routine.skinType} isDark={isDark} />
              )}
              {v2Routine.concerns?.length > 0 && (
                <InfoRow
                  label="Sorunlar"
                  value={v2Routine.concerns.join(", ")}
                  isDark={isDark}
                />
              )}
              <TouchableOpacity
                onPress={() => router.push("/premium-skin-scan-v2/analysis-history" as any)}
                activeOpacity={0.75}
                style={rc.linkRow}
              >
                <Text style={[rc.linkText, { color: "#7C3AED" }]}>Tüm analizlere git →</Text>
              </TouchableOpacity>
            </>
          )}
        </ReportCard>

        {/* D) Karşılaştırma */}
        {hasHistory && (
          <ReportCard
            title="Karşılaştırma"
            icon="git-compare"
            iconColor="#0891B2"
            iconBg={isDark ? "#061620" : "#ECFEFF"}
            isDark={isDark}
          >
            {latestTwo.map((r, i) => (
              <View key={r.id} style={rc.compareRow}>
                <View style={[rc.compareBadge, { backgroundColor: i === 0 ? "#7A8F6B" : isDark ? "#2D2D35" : "#F1F5F9" }]}>
                  <Text style={[rc.compareBadgeText, { color: i === 0 ? "#fff" : isDark ? "#94A3B8" : "#64748B" }]}>
                    {i === 0 ? "Son" : "Önceki"}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[rc.compareDate, { color: isDark ? "#CBD5E1" : "#374151" }]}>
                    {new Date(r.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                  </Text>
                  {r.skinType && (
                    <Text style={[rc.compareDetail, { color: isDark ? "#64748B" : "#94A3B8" }]}>
                      {r.skinType}{r.concerns?.length > 0 ? ` · ${r.concerns.slice(0,2).join(", ")}` : ""}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </ReportCard>
        )}

        {/* E) Beklenen İlerleme */}
        <ReportCard
          title="Beklenen İlerleme"
          icon="trending-up"
          iconColor="#10B981"
          iconBg={isDark ? "#0A1F17" : "#ECFDF5"}
          isDark={isDark}
        >
          <Text style={[rc.progressNote, { color: isDark ? "#94A3B8" : "#4A5568" }]}>
            {expectedProgressNote(streak, totalSteps)}
          </Text>
          {streak >= 3 && (
            <View style={rc.progressMilestone}>
              <Feather name="check" size={12} color="#10B981" />
              <Text style={[rc.milestoneText, { color: isDark ? "#6EE7B7" : "#10B981" }]}>
                {streak >= 7 ? "Harika gidiyorsun! Rutinin kalıcı etki yaratıyor."
                  : streak >= 5 ? "Çok iyi! 7 güne ulaşırsan cilt bariyer onarımı tamamlanır."
                  : "İyi başladın! 5 güne ulaşırsan nemlenme kalıcılaşır."}
              </Text>
            </View>
          )}
        </ReportCard>

        {/* F) Rutin Notu */}
        <ReportCard
          title="Rutin Notu"
          icon="edit-3"
          iconColor="#C8A97E"
          iconBg={isDark ? "#1E1408" : "#FFFBEB"}
          isDark={isDark}
        >
          {v2Routine ? (
            <Text style={[rc.noteBody, { color: isDark ? "#CBD5E1" : "#374151" }]}>
              {v2Routine.skinType} cilt tipin ve{" "}
              {v2Routine.concerns?.length > 0
                ? v2Routine.concerns.join(", ")
                : "belirlenen sorunların"}
              {" "}için oluşturulmuş {v2Routine.morning.length} sabah + {v2Routine.evening.length} akşam adımlı şahsi rutin aktif.
            </Text>
          ) : (
            <Text style={[rc.emptyText, { color: isDark ? "#475569" : "#94A3B8" }]}>
              Aktif rutin bulunmuyor. Bakım profili oluşturulduktan sonra şahsi rutin hazırlanacak.
            </Text>
          )}
          <TouchableOpacity
            onPress={() => router.push("/premium-skin-scan-v2/routine-program" as any)}
            activeOpacity={0.75}
            style={rc.linkRow}
          >
            <Text style={[rc.linkText, { color: "#C8A97E" }]}>Rutine git →</Text>
          </TouchableOpacity>
        </ReportCard>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const rc = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web:     {},
    }),
  },
  backBtn:    { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800" as const, letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, marginTop: 1 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 1 },
      web:     {},
    }),
  },
  cardHeader:  { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox:     { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  cardTitle:   { fontSize: 14, fontWeight: "700" as const, letterSpacing: -0.2 },

  infoRow:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  infoRowStack: { flexDirection: "column", gap: 3 },
  infoLabel:    { fontSize: 12.5, flexShrink: 0, maxWidth: "50%" },
  infoValue:    { fontSize: 13, fontWeight: "600" as const, flex: 1, textAlign: "right", flexShrink: 1 },
  infoValueFull:{ fontSize: 13, fontWeight: "600" as const, lineHeight: 19 },

  barTrack:    { height: 7, backgroundColor: "rgba(0,0,0,0.07)", borderRadius: 4, overflow: "hidden" },
  barFill:     { height: 7, borderRadius: 4 },

  stabilityRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  stabilityDot: { width: 8, height: 8, borderRadius: 4 },
  stabilityLabel: { fontSize: 13.5, fontWeight: "700" as const },

  noteText:    { fontSize: 11.5 },
  progressNote: { fontSize: 13.5, lineHeight: 20 },

  progressMilestone: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingTop: 4 },
  milestoneText: { fontSize: 12.5, fontWeight: "600" as const, flex: 1, lineHeight: 18 },

  compareRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  compareBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  compareBadgeText: { fontSize: 10.5, fontWeight: "700" as const },
  compareDate: { fontSize: 13, fontWeight: "600" as const },
  compareDetail: { fontSize: 11.5 },

  emptyBox:    { gap: 12, alignItems: "center", paddingVertical: 8 },
  emptyText:   { fontSize: 13, lineHeight: 19, textAlign: "center" },
  ctaBtn:      { borderRadius: 11, paddingHorizontal: 18, paddingVertical: 9 },
  ctaBtnText:  { fontSize: 13, fontWeight: "700" as const, color: "#fff" },

  linkRow:     { paddingTop: 4 },
  linkText:    { fontSize: 13, fontWeight: "600" as const },

  noteBody:    { fontSize: 13.5, lineHeight: 21 },
});