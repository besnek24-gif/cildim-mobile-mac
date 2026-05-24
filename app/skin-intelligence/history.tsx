/**
 * Skin Intelligence — History Screen
 * Layer 6: Result Memory Engine
 *
 * Geçmiş tarama kartları, skor trendleri, karşılaştırma.
 *
 * TODO: Supabase'e kayıt / okuma entegrasyonu eklenecek.
 */

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSkinIntelligence } from "@/lib/skinIntelligence/store";
import type { SavedScan } from "@/lib/skinIntelligence/types";

function ScanCard({ scan, colors }: { scan: SavedScan; colors: any }) {
  const date = new Date(scan.createdAt).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <TouchableOpacity
      style={[sc.card, { backgroundColor: colors.surfaceCard }]}
      activeOpacity={0.8}
      // TODO: Geçmiş tarama detay ekranına yönlendir
    >
      <View style={sc.scoreCircle}>
        <Text style={[sc.scoreNum, { color: colors.primary }]}>{scan.skinScore}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[sc.dateText, { color: colors.text }]}>{date}</Text>
        <Text style={[sc.skinType, { color: colors.textSecondary }]}>{scan.skinType}</Text>
        <View style={sc.signalRow}>
          {scan.topSignals.slice(0, 2).map((sig) => (
            <View key={sig} style={[sc.sigChip, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={[sc.sigText, { color: colors.primary }]} numberOfLines={1}>{sig}</Text>
            </View>
          ))}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const colors = useColors();
  const { savedScans } = useSkinIntelligence((s) => ({ savedScans: s.savedScans }));

  return (
    <View style={[s.wrapper, { backgroundColor: colors.background }]}>
      {/* Başlık */}
      <View style={[s.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Geçmiş Taramalar</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {savedScans.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: colors.surfaceCard }]}>
            <Feather name="inbox" size={36} color={colors.textMuted} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>Henüz tarama yok</Text>
            <Text style={[s.emptyBody, { color: colors.textMuted }]}>
              İlk analizini tamamladığında burada görünecek.
            </Text>
            <TouchableOpacity
              style={[s.startBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/skin-intelligence")}
            >
              <Text style={s.startBtnText}>İlk Taramayı Başlat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* TODO: Skor trend grafiği (Recharts / SVG sparkline) */}

            {savedScans.map((scan) => (
              <ScanCard key={scan.id} scan={scan} colors={colors} />
            ))}
          </>
        )}

        {/* TODO: Karşılaştırma modu — 2 tarama yan yana */}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  scroll: { paddingHorizontal: 16, gap: 12, paddingTop: 8 },
  emptyCard: { borderRadius: 16, padding: 28, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyBody: { fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  startBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

const sc = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, padding: 16 },
  scoreCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(122,143,107,0.12)", alignItems: "center", justifyContent: "center" },
  scoreNum: { fontSize: 18, fontWeight: "800" },
  dateText: { fontSize: 13.5, fontWeight: "600" },
  skinType: { fontSize: 12.5 },
  signalRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  sigChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sigText: { fontSize: 11, fontWeight: "500", maxWidth: 120 },
});