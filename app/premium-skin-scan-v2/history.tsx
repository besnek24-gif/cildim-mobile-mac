/**
 * premium-skin-scan-v2 — HistoryScreen
 * "Geçmiş Analizlerim" ekranı.
 * Hook'lar koşullu return'lardan ÖNCE.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScanBottomNav, SCAN_NAV_HEIGHT } from "@/components/ScanBottomNav";
import { historyStore }      from "@/local_demo_data/safe_runtime_shims_v74";
import type { AnalysisResult } from "@/local_demo_data/safe_runtime_shims_v74";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#E8ECE4";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";
const DANGER = "#E05555";
const WHITE  = "#FFFFFF";

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Oca","Şub","Mar","Nis","May","Haz",
    "Tem","Ağu","Eyl","Eki","Kas","Ara",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function scoreBand(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "İyi",    color: SAGE   };
  if (score >= 60) return { label: "Orta",   color: COPPER };
  return               { label: "Düşük",  color: "#E07070" };
}

// ─── Silme Onay Modalı ────────────────────────────────────────────────────────

function DeleteModal({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={dm.backdrop} />
      </TouchableWithoutFeedback>
      <View style={dm.sheet}>
        <View style={dm.iconBox}>
          <Feather name="trash-2" size={22} color={DANGER} />
        </View>
        <Text style={dm.title}>Bu analizi silmek istiyor musun?</Text>
        <Text style={dm.sub}>Bu işlem geri alınamaz.</Text>
        <View style={dm.btnRow}>
          <TouchableOpacity style={dm.cancelBtn} onPress={onCancel} activeOpacity={0.78}>
            <Text style={dm.cancelTxt}>Vazgeç</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dm.deleteBtn} onPress={onConfirm} activeOpacity={0.78}>
            <Feather name="trash-2" size={14} color={WHITE} />
            <Text style={dm.deleteTxt}>Sil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${DANGER}12`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: "700", color: INK, textAlign: "center" },
  sub:   { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: `${MUTED}12`,
    alignItems: "center",
  },
  cancelTxt: { fontSize: 15, fontWeight: "600", color: INK },
  deleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: DANGER,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  deleteTxt: { fontSize: 15, fontWeight: "700", color: WHITE },
});

// ─── Liste öğesi ──────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  idx,
  totalEntries,
  onPress,
  onCompare,
  onDeleteRequest,
}: {
  entry:           AnalysisResult;
  idx:             number;
  totalEntries:    number;
  onPress:         () => void;
  onCompare:       () => void;
  onDeleteRequest: (id: string) => void;
}) {
  const band      = scoreBand(entry.score);
  const isNewest  = idx === 0;
  const canCompare = !isNewest && totalEntries >= 2;
  const swipeRef  = useRef<InstanceType<typeof ReanimatedSwipeable>>(null);

  const renderRightActions = useCallback(() => (
    <TouchableOpacity
      style={ec.swipeDelete}
      onPress={() => {
        swipeRef.current?.close();
        onDeleteRequest(entry.id);
      }}
      activeOpacity={0.82}
    >
      <Feather name="trash-2" size={18} color={WHITE} />
      <Text style={ec.swipeDeleteTxt}>Sil</Text>
    </TouchableOpacity>
  ), [entry.id, onDeleteRequest]);

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      friction={2}
      overshootRight={false}
    >
      <TouchableOpacity style={ec.card} onPress={onPress} activeOpacity={0.82}>
        {/* Tarih + yeni etiketi + çöp ikonu */}
        <View style={ec.topRow}>
          <Text style={ec.date}>{formatDate(entry.timestamp)}</Text>
          <View style={ec.topRight}>
            {isNewest && (
              <View style={ec.newBadge}>
                <Text style={ec.newBadgeTxt}>Son analiz</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); onDeleteRequest(entry.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={ec.trashBtn}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={13} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Skor + cilt tipi + özet */}
        <View style={ec.midRow}>
          <View style={[ec.scoreBubble, { borderColor: band.color }]}>
            <Text style={[ec.scoreNum, { color: band.color }]}>{entry.score}</Text>
            <Text style={ec.scoreSub}>/100</Text>
          </View>
          <View style={ec.info}>
            <Text style={ec.skinType}>{entry.skinType} Cilt</Text>
            {entry.concerns[0] ? (
              <Text style={ec.concern} numberOfLines={1}>{entry.concerns[0]}</Text>
            ) : null}
          </View>
        </View>

        {/* Karşılaştır butonu */}
        {canCompare && (
          <TouchableOpacity
            style={ec.compareBtn}
            onPress={(e) => { e.stopPropagation?.(); onCompare(); }}
            activeOpacity={0.8}
          >
            <Text style={ec.compareTxt}>Son analizle karşılaştır →</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

const ec = StyleSheet.create({
  card:          { backgroundColor: WHITE, borderRadius: 18, padding: 16, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  topRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topRight:      { flexDirection: "row", alignItems: "center", gap: 8 },
  date:          { fontSize: 13, color: MUTED, fontWeight: "500" },
  newBadge:      { backgroundColor: `${SAGE}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  newBadgeTxt:   { fontSize: 11, color: SAGE, fontWeight: "700" },
  trashBtn:      { width: 28, height: 28, borderRadius: 8, backgroundColor: `${MUTED}0E`, alignItems: "center", justifyContent: "center" },
  midRow:        { flexDirection: "row", alignItems: "center", gap: 16 },
  scoreBubble:   { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  scoreNum:      { fontSize: 22, fontWeight: "800", lineHeight: 26 },
  scoreSub:      { fontSize: 10, color: MUTED },
  info:          { flex: 1, gap: 4 },
  skinType:      { fontSize: 16, fontWeight: "700", color: INK },
  concern:       { fontSize: 13, color: MUTED },
  compareBtn:    { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, backgroundColor: `${COPPER}12`, borderRadius: 10 },
  compareTxt:    { fontSize: 13, color: COPPER, fontWeight: "600" },
  swipeDelete:   { backgroundColor: DANGER, justifyContent: "center", alignItems: "center", width: 80, borderRadius: 18, gap: 4, marginLeft: 8 },
  swipeDeleteTxt:{ fontSize: 12, fontWeight: "700", color: WHITE },
});

// ─── Boş durum ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={em.wrap}>
      <View style={em.iconBox}>
        <Feather name="clock" size={32} color={`${SAGE}80`} />
      </View>
      <Text style={em.title}>Henüz bir bakım profili oluşturulmadı.</Text>
      <Text style={em.sub}>Bakım profilini oluşturarak ilk kaydını başlat.</Text>
      <TouchableOpacity
        style={em.btn}
        onPress={() => router.replace("/premium-skin-scan-v2" as any)}
        activeOpacity={0.82}
      >
        <Feather name="camera" size={15} color={WHITE} />
        <Text style={em.btnTxt}>Profili Oluştur</Text>
      </TouchableOpacity>
    </View>
  );
}
const em = StyleSheet.create({
  wrap:    { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 },
  iconBox: { width: 72, height: 72, borderRadius: 24, backgroundColor: `${SAGE}12`, alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 18, fontWeight: "700", color: INK, textAlign: "center" },
  sub:     { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 },
  btn:     { marginTop: 8, backgroundColor: SAGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  btnTxt:  { color: WHITE, fontSize: 15, fontWeight: "700" },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [history, setHistory]           = useState<AnalysisResult[]>([]);
  const [loading, setLoading]           = useState(true);
  const [pendingId, setPendingId]       = useState<string | null>(null);

  useEffect(() => {
    historyStore.load().then((list) => {
      setHistory(list);
      setLoading(false);
    });
  }, []);

  function goToDetail(idx: number) {
    router.push(`/premium-skin-scan-v2/history-detail?idx=${idx}` as any);
  }

  function handleDeleteRequest(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingId(id);
  }

  function handleCancelDelete() {
    setPendingId(null);
  }

  async function handleConfirmDelete() {
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    setHistory(prev => prev.filter(e => e.id !== id));
    await historyStore.remove(id);
  }

  return (
    <View style={[s.root, { paddingTop: top }]}>

      {/* Üst çubuk */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }} hitSlop={12}>
          <Text style={s.back}>← Geri</Text>
        </TouchableOpacity>
        <Text style={s.title}>Bakım Profili Geçmişi</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* İçerik */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={SAGE} />
        </View>
      ) : history.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <EntryCard
              entry={item}
              idx={index}
              totalEntries={history.length}
              onPress={() => goToDetail(index)}
              onCompare={() => goToDetail(index)}
              onDeleteRequest={handleDeleteRequest}
            />
          )}
          contentContainerStyle={[s.list, { paddingBottom: bottom + SCAN_NAV_HEIGHT + 32 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      <ScanBottomNav />

      {/* Silme onay modalı */}
      <DeleteModal
        visible={pendingId !== null}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: CREAM },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  back:   { color: MUTED, fontSize: 15 },
  title:  { fontSize: 16, fontWeight: "700", color: INK },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list:   { paddingHorizontal: 16, paddingTop: 8 },
});