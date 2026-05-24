import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// ECZ4 Step 7 — Multi-routine create/edit mode handling. Mevcut adapter
// (routineStore primary üzerinden çalışır) AYNEN korunur; mode=create
// yeni RoutineRecord oluşturup primary yapar, mode=edit hedef rutini
// geçici olarak primary yapar ve unmount'ta orijinal primary'yi restore
// eder. Legacy davranış (param yoksa) korunur.
import { getMaxRoutineCount } from "@/lib/accessControl";
import {
  getRoutineCount,
  getRoutineById,
  getPrimaryRoutine as getCollectionPrimary,
  saveRoutineAsNew,
  setPrimaryRoutine,
  hydrateRoutineCollection,
} from "@/lib/routineCollection";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { getLatestRoutineProfile } from "@/lib/concernRoutineBridgeStore";
import { generateFreeRoutineStructure } from "@/lib/concernRoutineBridge";
import { supabase } from "@/local_demo_data/safe_runtime_shims_v74";
import {
  addStep,
  applySkeletonToSlot,
  CATEGORY_LABELS,
  clearSlot,
  getManualRoutine,
  removeStep,
  type ManualStep,
  type RoutineSlot,
  type StepCategory,
} from "@/lib/routineStore";
import { routineProgramStore } from "@/local_demo_data/safe_runtime_shims_v74";
// ECZ4 — Ürün detayından gelen "Rutinime Ekle" intent'i
import {
  consumeRoutineAddIntent,
  clearRoutineAddIntent,
} from "@/lib/routineAddIntentStore";
import { classifyBucket, type ProductBucket } from "@/lib/concernFlows";

const GREEN  = "#7A8F6B";
const PURPLE = "#7C3AED";
const AMBER  = "#D97706";
const TEAL   = "#0891B2";

const CATEGORIES: StepCategory[] = [
  "cleanser", "serum", "moisturizer", "sunscreen", "treatment", "other",
];

const SLOT_TABS: { slot: RoutineSlot; label: string; icon: string; color: string }[] = [
  { slot: "morning",  label: "Sabah",    icon: "sun",        color: GREEN },
  { slot: "evening",  label: "Akşam",    icon: "moon",       color: PURPLE },
  { slot: "weekly",   label: "Haftalık", icon: "calendar",   color: AMBER },
  { slot: "monthly",  label: "Aylık",    icon: "refresh-cw", color: TEAL },
];

const STEP_SUGGESTIONS: Record<StepCategory, string[]> = {
  cleanser:    ["Nazik temizleyici", "Köpük temizleyici", "Jel temizleyici", "Yağ temizleyici"],
  serum:       ["Hyalüronik asit serumu", "Niasinamid serumu", "C vitamini serumu", "Retinol serumu"],
  moisturizer: ["Hafif nemlendirici", "Yoğun nemlendirici", "Jel nemlendirici", "Bariyer kremi"],
  sunscreen:   ["SPF 50+ güneş koruyucu", "SPF 50+ günlük güneş koruyucu", "Mineral SPF 50+ güneş koruyucu"],
  treatment:   ["Akne bakım jeli", "Leke bakım serumu", "Gece bakım kremi", "AHA/BHA tonik"],
  other:       ["Göz kremi", "Dudak bakımı", "Yüz yağı", "Tonik", "Kil maskesi", "Asit peeling"],
};

function toTrUpper(s: string) {
  return s.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

// ─── Ürün arama (Supabase) ────────────────────────────────────────────────────

interface DBProduct { id: string; name: string; brand?: string; short_benefit?: string; }

async function searchProducts(query: string): Promise<DBProduct[]> {
  if (!query.trim() || query.trim().length < 2) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, short_benefit")
    .or(`name.ilike.%${query}%,brand.ilike.%${query}%,short_benefit.ilike.%${query}%`)
    .limit(12);
  if (error || !data) return [];
  return data as DBProduct[];
}

// ─── Ürün Seçici Modalı ───────────────────────────────────────────────────────

function ProductPickerModal({
  onSelect, onClose, isDark, textPrimary, textSecondary, cardBg, borderColor, accent,
}: {
  onSelect: (p: DBProduct) => void;
  onClose: () => void;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  borderColor: string;
  accent: string;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<DBProduct[]>([]);
  const [loading, setLoading]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const res = await searchProducts(query);
      setResults(res);
      setLoading(false);
    }, 350);
  }, [query]);

  const inputBg = isDark ? "#222D3A" : "#F4F4F4";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={pp.kavRoot}
      >
        <Pressable style={pp.backdrop} onPress={onClose} />
        <View style={[pp.sheet, { backgroundColor: cardBg, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
          <View style={[pp.handle, { backgroundColor: isDark ? "#374151" : "#D1D5DB" }]} />
          <Text style={[pp.title, { color: textPrimary }]}>Ürün Seç</Text>

        <View style={[pp.searchRow, { backgroundColor: inputBg, borderColor }]}>
          <Feather name="search" size={15} color={textSecondary} />
          <TextInput
            style={[pp.searchInput, { color: textPrimary }]}
            placeholder="Ürün adı veya marka ara..."
            placeholderTextColor={textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={14} color={textSecondary} />
            </Pressable>
          )}
        </View>

        {loading && (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator color={accent} />
          </View>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <Text style={[pp.empty, { color: textSecondary }]}>Ürün bulunamadı. Farklı bir arama dene.</Text>
        )}

        {!loading && results.length > 0 && (
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {results.map((p, idx) => (
              <Pressable
                key={p.id}
                onPress={() => { Haptics.selectionAsync(); onSelect(p); }}
                style={({ pressed }) => [
                  pp.resultRow,
                  {
                    borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderColor,
                    backgroundColor: pressed ? (isDark ? "rgba(255,255,255,0.05)" : "#F9F9F9") : "transparent",
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[pp.resultName, { color: textPrimary }]} numberOfLines={1}>{p.name}</Text>
                  {p.brand && (
                    <Text style={[pp.resultBrand, { color: textSecondary }]} numberOfLines={1}>{p.brand}</Text>
                  )}
                  {p.short_benefit && (
                    <Text style={[pp.resultBenefit, { color: textSecondary }]} numberOfLines={1}>{p.short_benefit}</Text>
                  )}
                </View>
                <Feather name="plus-circle" size={18} color={accent} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {query.length < 2 && !loading && (
          <Text style={[pp.hint, { color: textSecondary }]}>
            En az 2 karakter yaz — ürün adı veya markaya göre arar.
          </Text>
        )}

        <Pressable onPress={onClose} style={({ pressed }) => [pp.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[pp.cancelText, { color: textSecondary }]}>İptal</Text>
        </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const pp = StyleSheet.create({
  // Modal portal kökü — RN <Modal> zaten ayrı bir window/portal yarattığı için
  // tab bar'ın (position: absolute) ÜZERİNDE render edilir. Sadece flex layout:
  kavRoot:      { flex: 1, justifyContent: "flex-end" },
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet:        {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 0,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16 },
      android: { elevation: 24 },
    }),
  },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title:        { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  searchRow:    { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput:  { flex: 1, fontSize: 14, padding: 0 },
  empty:        { textAlign: "center", fontSize: 13, paddingVertical: 20 },
  hint:         { textAlign: "center", fontSize: 12.5, lineHeight: 18, paddingVertical: 16 },
  resultRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 2 },
  resultName:   { fontSize: 13.5, fontWeight: "600" },
  resultBrand:  { fontSize: 11.5, fontWeight: "500" },
  resultBenefit:{ fontSize: 11, fontWeight: "400" },
  cancelBtn:    { alignItems: "center", marginTop: 14 },
  cancelText:   { fontSize: 13, fontWeight: "600" },
});

// ─── Adım ekleme modalı ───────────────────────────────────────────────────────

function AddStepModal({
  slot, onClose, isDark, textPrimary, textSecondary, cardBg, borderColor,
  initialCategory, initialLinkedProduct,
}: {
  slot: RoutineSlot;
  onClose: () => void;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  borderColor: string;
  initialCategory?: StepCategory;
  initialLinkedProduct?: DBProduct | null;
}) {
  const tab = SLOT_TABS.find(t => t.slot === slot)!;
  const accent = tab.color;
  const insets = useSafeAreaInsets();

  const [selectedCat, setSelectedCat]     = useState<StepCategory>(initialCategory ?? "cleanser");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  // ECZ4 — Eğer linked product prefilled geldiyse label olarak ürün adını
  // göster (aksi halde finalLabel suggestion default'una düşerdi).
  const [customLabel, setCustomLabel]     = useState<string>(initialLinkedProduct?.name ?? "");
  const [linkedProduct, setLinkedProduct] = useState<DBProduct | null>(initialLinkedProduct ?? null);
  const [showPicker, setShowPicker]       = useState(false);

  const finalLabel = customLabel.trim() || selectedLabel || STEP_SUGGESTIONS[selectedCat][0];

  function handleAdd() {
    if (!finalLabel) return;
    addStep({
      category: selectedCat,
      label: finalLabel,
      slot,
      ...(linkedProduct ? {
        productId:    linkedProduct.id,
        productName:  linkedProduct.name,
        productBrand: linkedProduct.brand,
      } : {}),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  const inputBg = isDark ? "#222D3A" : "#F4F4F4";

  if (showPicker) {
    return (
      <ProductPickerModal
        onSelect={(p) => { setLinkedProduct(p); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
        isDark={isDark}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        cardBg={cardBg}
        borderColor={borderColor}
        accent={accent}
      />
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={am.kavRoot}
      >
        <Pressable style={am.backdrop} onPress={onClose} />
        <View style={[am.sheet, {
          backgroundColor: isDark ? "#1C2535" : "#FFFFFF",
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 4 }}
        >
        <View style={[am.handle, { backgroundColor: isDark ? "#374151" : "#D1D5DB" }]} />
        <Text style={[am.title, { color: textPrimary }]}>
          Adım Ekle — {tab.label}
        </Text>

        {/* Kategori */}
        <Text style={[am.label, { color: textSecondary }]}>Kategori</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -4 }}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 4, paddingBottom: 2 }}
        >
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              onPress={() => { setSelectedCat(cat); setSelectedLabel(""); setCustomLabel(""); }}
              style={[am.catChip, {
                backgroundColor: selectedCat === cat ? `${accent}18` : "transparent",
                borderColor:     selectedCat === cat ? `${accent}60` : borderColor,
              }]}
            >
              <Text style={[am.catText, { color: selectedCat === cat ? accent : textSecondary }]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Öneri */}
        <Text style={[am.label, { color: textSecondary, marginTop: 14 }]}>Hazır adım seç</Text>
        <View style={{ gap: 6 }}>
          {STEP_SUGGESTIONS[selectedCat].map(label => (
            <Pressable
              key={label}
              onPress={() => { setSelectedLabel(label); setCustomLabel(""); }}
              style={[am.suggestion, {
                backgroundColor: selectedLabel === label && !customLabel ? `${accent}14` : "transparent",
                borderColor:     selectedLabel === label && !customLabel ? `${accent}50` : borderColor,
              }]}
            >
              <Text style={[am.suggestionText, { color: selectedLabel === label && !customLabel ? accent : textPrimary }]}>
                {label}
              </Text>
              {selectedLabel === label && !customLabel && (
                <Feather name="check" size={14} color={accent} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Özel isim */}
        <Text style={[am.label, { color: textSecondary, marginTop: 14 }]}>Ya da özel isim yaz</Text>
        <View style={[am.customRow, { backgroundColor: inputBg, borderColor }]}>
          <Feather name="edit-3" size={14} color={textSecondary} />
          <TextInput
            style={[am.customInput, { color: textPrimary }]}
            placeholder="Örn: Peptit serumu, Göz kremi..."
            placeholderTextColor={textSecondary}
            value={customLabel}
            onChangeText={(t) => { setCustomLabel(t); if (t) setSelectedLabel(""); }}
            returnKeyType="done"
          />
          {customLabel.length > 0 && (
            <Pressable onPress={() => setCustomLabel("")} hitSlop={8}>
              <Feather name="x" size={13} color={textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Ürün bağla */}
        <Text style={[am.label, { color: textSecondary, marginTop: 14 }]}>Ürün bağla (isteğe bağlı)</Text>
        {linkedProduct ? (
          <View style={[am.linkedProduct, { borderColor: `${accent}40`, backgroundColor: `${accent}0C` }]}>
            <Feather name="package" size={14} color={accent} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[am.linkedName, { color: textPrimary }]} numberOfLines={1}>{linkedProduct.name}</Text>
              {linkedProduct.brand && (
                <Text style={[am.linkedBrand, { color: textSecondary }]}>{linkedProduct.brand}</Text>
              )}
            </View>
            <Pressable onPress={() => setLinkedProduct(null)} hitSlop={8}>
              <Feather name="x" size={15} color={textSecondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowPicker(true)}
            style={({ pressed }) => [am.productBtn, { borderColor, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="search" size={13} color={textSecondary} />
            <Text style={[am.productBtnText, { color: textSecondary }]}>Ürün ara ve seç</Text>
          </Pressable>
        )}

        {/* Ekle */}
        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => [am.addBtn, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="plus" size={15} color="#fff" />
          <Text style={am.addBtnText}>Adımı Ekle</Text>
        </Pressable>
        </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const am = StyleSheet.create({
  // Modal portal kökü — RN <Modal> tab bar üstünde render edildiği için
  // overlay/zIndex yerine sade flex layout yeterli:
  kavRoot:    { flex: 1, justifyContent: "flex-end" },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:      {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16 },
      android: { elevation: 24 },
    }),
  },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title:      { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  label:      { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.4, marginBottom: 8 },
  catChip:    { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  catText:    { fontSize: 12.5, fontWeight: "600" },
  suggestion: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  suggestionText: { fontSize: 13, fontWeight: "500" },
  customRow:  {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  customInput: { flex: 1, fontSize: 13.5, padding: 0 },
  productBtn:  {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, borderStyle: "dashed",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  productBtnText: { fontSize: 13, fontWeight: "500" },
  linkedProduct:  {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  linkedName:  { fontSize: 13, fontWeight: "600" },
  linkedBrand: { fontSize: 11.5, fontWeight: "400" },
  addBtn:     {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, borderRadius: 14, paddingVertical: 13, marginTop: 16,
  },
  addBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

// ─── Slot adım listesi ────────────────────────────────────────────────────────

function SlotSection({
  slot, steps, onAdd, onRemove, isDark, textPrimary, textSecondary, cardBg, borderColor,
}: {
  slot: RoutineSlot; steps: ManualStep[]; onAdd: () => void; onRemove: (id: string) => void;
  isDark: boolean; textPrimary: string; textSecondary: string; cardBg: string; borderColor: string;
}) {
  const tab    = SLOT_TABS.find(t => t.slot === slot)!;
  const accent = tab.color;

  return (
    <View style={[ss.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={ss.header}>
        <View style={[ss.badge, { backgroundColor: `${accent}15`, borderColor: `${accent}28` }]}>
          <Feather name={tab.icon as any} size={12} color={accent} />
          <Text style={[ss.badgeText, { color: accent }]}>{toTrUpper(tab.label)}</Text>
        </View>
        {steps.length > 0 && (
          <Pressable onPress={() => { Haptics.selectionAsync(); clearSlot(slot); onAdd(); }} hitSlop={8}>
            <Text style={[ss.clearText, { color: textSecondary }]}>Temizle</Text>
          </Pressable>
        )}
      </View>

      {steps.length === 0 && (
        <View style={[ss.empty, { borderColor }]}>
          <Text style={[ss.emptyText, { color: textSecondary }]}>Henüz adım eklenmedi</Text>
        </View>
      )}

      {steps.map((step, idx) => (
        <View key={step.id} style={[ss.row, { borderColor, borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth }]}>
          <View style={[ss.num, { backgroundColor: `${accent}15` }]}>
            <Text style={[ss.numText, { color: accent }]}>{step.order}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[ss.cat, { color: textSecondary }]}>{CATEGORY_LABELS[step.category]}</Text>
            <Text style={[ss.name, { color: textPrimary }]}>{step.label}</Text>
            {step.productName && (
              <Text style={[ss.product, { color: accent }]} numberOfLines={1}>
                {step.productName}{step.productBrand ? ` · ${step.productBrand}` : ""}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => onRemove(step.id)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="x" size={16} color={textSecondary} />
          </Pressable>
        </View>
      ))}

      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [ss.addBtn, { borderColor: `${accent}35`, opacity: pressed ? 0.75 : 1 }]}
      >
        <Feather name="plus" size={14} color={accent} />
        <Text style={[ss.addText, { color: accent }]}>Adım ekle</Text>
      </Pressable>
    </View>
  );
}

const ss = StyleSheet.create({
  card:    {
    borderRadius: 18, borderWidth: 1, padding: 14,
    ...Platform.select({
      ios:  { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  header:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  badge:   { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  clearText: { fontSize: 12, fontWeight: "600" },
  empty:   { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, alignItems: "center", paddingVertical: 14, marginBottom: 10 },
  emptyText: { fontSize: 13 },
  row:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  num:     { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  numText: { fontSize: 11.5, fontWeight: "800" },
  cat:     { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.3 },
  name:    { fontSize: 13, fontWeight: "600" },
  product: { fontSize: 11.5, fontWeight: "500" },
  addBtn:  {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 10, borderWidth: 1, borderStyle: "dashed",
    paddingVertical: 10, marginTop: 4,
  },
  addText: { fontSize: 13, fontWeight: "600" },
});

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function RutinDuzenleScreen() {
  const { colorScheme } = useTheme();
  const isDark    = colorScheme === "dark";
  const insets    = useSafeAreaInsets();
  const { scrollPaddingBottom } = useTabBarInset();

  // ECZ4 GLOBAL — Defense-in-Depth: Misafir manuel rutin oluşturamaz.
  // Manuel rutin kişisel routineStore verisini kalıcılaştırır; bu kayıtlı
  // kullanıcı (free) yetkisi gerektirir. Çağıran tüm CTA'lar (Rutinim
  // EmptyState, Home modal, ECZ4 Step A diğer noktaları) zaten misafir için
  // /giris'e yönlendiriyor; bu guard yine de doğrudan rota / deep-link /
  // gelecek call site'ları için savunma derinliği. Free + Seçkin için
  // davranış değişmedi.
  const { user } = useAuth();
  useEffect(() => {
    if (!user) {
      router.replace("/giris" as any);
    }
  }, [user]);

  // ── ECZ4 Step 7 — Multi-routine create/edit mode bootstrap ──
  // Mevcut editör tüm yazıları routineStore adapter'ı üzerinden PRIMARY
  // routine'e gönderir. Multi-routine desteği için en küçük güvenli yol:
  // hedef routine'i geçici olarak primary yapıp adapter'ı AYNEN kullanmak.
  // - mode=create: limit kontrolü → saveRoutineAsNew(boş) → setPrimaryRoutine
  // - mode=edit&routineId: orijinal primary'yi sakla → setPrimaryRoutine(target)
  //   → unmount'ta orijinali restore et (non-primary'i kalıcı promote etmemek
  //   için). originalPrimaryId === routineId ise no-op.
  // - param yoksa (legacy): hiçbir şey yapma → eski davranış aynen.
  const params = useLocalSearchParams<{ mode?: string; routineId?: string }>();
  const editorMode: "create" | "edit" | "legacy" =
    params.mode === "create" ? "create" :
    params.mode === "edit"   ? "edit"   : "legacy";
  const routineIdParam = typeof params.routineId === "string" ? params.routineId : null;
  const [bootstrapped, setBootstrapped] = useState(editorMode === "legacy");
  const originalPrimaryIdRef = useRef<string | null>(null);
  const restoreOnUnmountRef  = useRef<boolean>(false);

  useEffect(() => {
    if (!user) return;                  // misafir guard yukarıda /giris'e yönlendirir
    if (editorMode === "legacy") return; // eski davranış — no-op
    let cancelled = false;
    (async () => {
      try {
        await hydrateRoutineCollection();
        if (cancelled) return;

        if (editorMode === "create") {
          const max   = getMaxRoutineCount(user);
          const count = getRoutineCount();
          if (count >= max) {
            const isSeck = max >= 4;
            Alert.alert(
              "Rutin sınırına ulaştın",
              isSeck
                ? "En fazla 4 rutin oluşturabilirsin. Yeni manuel rutin için mevcut rutinlerinden birini düzenleyebilirsin."
                : "Ücretsiz üyelikte 1 rutin oluşturabilirsin. Yeni manuel rutin için mevcut rutini düzenleyebilir veya Seçkin üyeliğe geçebilirsin.",
              [
                { text: "Vazgeç", style: "cancel", onPress: () => { if (router.canGoBack()) router.back(); else router.replace("/rutin" as any); } },
                isSeck
                  ? { text: "Rutinlerime dön", onPress: () => { if (router.canGoBack()) router.back(); else router.replace("/rutin" as any); } }
                  : { text: "Mevcut rutini düzenle", onPress: () => {
                      // Free fallback: legacy primary edit akışına geç.
                      if (!cancelled) { setBootstrapped(true); refresh(); }
                    } },
              ],
            );
            return;
          }
          const result = saveRoutineAsNew(
            { title: "Manuel Rutinim", domain: "skin", source: "manual",
              morning: [], evening: [], weekly: [], monthly: [] },
            max,
          );
          if (!result.ok) {
            Alert.alert("Hata", "Yeni rutin oluşturulamadı. Lütfen tekrar dene.");
            if (router.canGoBack()) router.back(); else router.replace("/rutin" as any);
            return;
          }
          setPrimaryRoutine(result.id);
          if (cancelled) return;
          setBootstrapped(true);
          refresh();
        } else {
          // mode === "edit"
          if (!routineIdParam || !getRoutineById(routineIdParam)) {
            Alert.alert("Rutin bulunamadı", "Bu rutin artık mevcut değil.");
            if (router.canGoBack()) router.back(); else router.replace("/rutin" as any);
            return;
          }
          const currentPrimary = getCollectionPrimary();
          originalPrimaryIdRef.current = currentPrimary?.id ?? null;
          if (currentPrimary?.id !== routineIdParam) {
            setPrimaryRoutine(routineIdParam);
            // Sadece gerçekten swap yaptığımızda unmount'ta restore et.
            restoreOnUnmountRef.current = true;
          }
          if (cancelled) return;
          setBootstrapped(true);
          refresh();
        }
      } catch {
        if (!cancelled) {
          // Hidrate / store hatası: legacy davranışa düş, kullanıcıyı sıkıştırma.
          setBootstrapped(true);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode, routineIdParam, user]);

  // Edit modunda unmount'ta orijinal primary'yi restore et — non-primary
  // bir rutini düzenlemek için yapılan geçici promote'u geri al.
  useEffect(() => {
    return () => {
      if (!restoreOnUnmountRef.current) return;
      const originalId = originalPrimaryIdRef.current;
      if (!originalId) return;
      if (!getRoutineById(originalId)) return; // bu sırada silindiyse no-op
      setPrimaryRoutine(originalId);
    };
  }, []);

  const bg            = isDark ? "#141414" : "#FAFAF8";
  const cardBg        = isDark ? "#1C2535" : "#FFFFFF";
  const textPrimary   = isDark ? "#F0F4F8" : "#111827";
  const textSecondary = isDark ? "#94A3B8" : "#6B7280";
  const borderColor   = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const tabBg         = isDark ? "#1A1A1A" : "#F0EDE8";

  const [routine, setRoutine]   = useState(() => getManualRoutine());
  const [activeSlot, setActiveSlot] = useState<RoutineSlot>("morning");
  const [addModal, setAddModal] = useState(false);
  // ECZ4 — Ürün detayından gelen prefill (intent consume → AddStepModal'a aktarılır).
  const [pendingInitialCategory, setPendingInitialCategory] = useState<StepCategory | null>(null);
  const [pendingLinkedProduct,   setPendingLinkedProduct]   = useState<DBProduct | null>(null);
  const [skeletonApplied, setSkeletonApplied] = useState(false);
  // tri-state: null = henüz çözülmedi, false = v2 yok, true = v2 var
  const [hasV2, setHasV2] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    routineProgramStore.loadActive().then((r) => {
      if (mounted) setHasV2(!!r);
    });
    return () => { mounted = false; };
  }, []);

  // ── ECZ4 — "Rutinime Ekle" intent consume (additive) ─────────────────────
  // Bootstrapped (legacy/create/edit hepsi) sonrası tek sefer çalışır.
  // Bucket → kategori/slot eşlemesi, AddStepModal'ı prefilled açar.
  // Mevcut quota/free/premium ve mode mantığı dokunulmadı.
  const intentConsumedRef = useRef(false);
  useEffect(() => {
    if (!bootstrapped) return;
    if (intentConsumedRef.current) return;
    intentConsumedRef.current = true;

    const intent = consumeRoutineAddIntent();
    if (!intent) return;

    const bucket: ProductBucket = classifyBucket({
      name:     intent.productName ?? "",
      isim:     intent.productName ?? "",
      category: intent.productCategory ?? "",
      kategori: intent.productCategory ?? "",
    });

    // ECZ4 — Intent katmanı ek kuralı: toner/tonik için kategori "other"
    // (kullanıcı modal içinde manuel kategori seçer; auto-bind yok).
    const nameLow = `${intent.productName ?? ""} ${intent.productCategory ?? ""}`.toLowerCase();
    const isToner = /\btonik\b|\btoner\b/.test(nameLow);

    const cat: StepCategory = isToner ? "other" :
      bucket === "cleanser"    ? "cleanser"    :
      bucket === "serum"       ? "serum"       :
      bucket === "moisturizer" ? "moisturizer" :
      bucket === "sunscreen"   ? "sunscreen"   :
      "other";
    // ECZ4 default period fix: ürün detayı → Rutinime Ekle → "Düzenle'yi aç"
    // fallback yolundan gelen intent için deterministik default = "morning"
    // (Sabah). Önceki davranış cleanser/toner/other dahil her şeyi Akşam'a
    // kilitliyordu; bu yanlıştı. Sunscreen zaten morning. Serum/moisturizer
    // başarılı auto-add'e takılır (bu kod yoluna düşmez); v2-yönlendirme
    // veya unsupported bucket için Sabah daha güvenli ilk slot. Kullanıcı
    // AddStepModal içinde slot'u istediği zaman değiştirebilir.
    const slot: RoutineSlot = "morning";

    const linked: DBProduct = {
      id:    intent.productId,
      name:  intent.productName ?? "Ürün",
      brand: intent.productBrand,
    };

    setActiveSlot(slot);
    setPendingInitialCategory(cat);
    setPendingLinkedProduct(linked);
    setAddModal(true);
    // Drain'den sonra clear (defensive — consume zaten null'lar; double-safety).
    clearRoutineAddIntent();
  }, [bootstrapped]);

  const bridgeRecord  = getLatestRoutineProfile();
  const freeStructure = bridgeRecord ? generateFreeRoutineStructure(bridgeRecord.routineProfile) : null;

  function refresh() { setRoutine({ ...getManualRoutine() }); }

  function handleRemove(id: string) {
    Haptics.selectionAsync();
    removeStep(id, activeSlot);
    refresh();
  }

  function handleApplySkeleton() {
    if (!freeStructure) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const toCategory = (label: string): StepCategory => {
      const l = label.toLowerCase();
      if (/temizley/.test(l))          return "cleanser";
      if (/serum/.test(l))             return "serum";
      if (/nemlendirici|krem/.test(l)) return "moisturizer";
      if (/güneş|spf/.test(l))         return "sunscreen";
      if (/tedavi|aktif/.test(l))      return "treatment";
      return "other";
    };
    applySkeletonToSlot("morning", freeStructure.morning.map(s => ({ category: toCategory(s.category), label: s.suggestion })));
    applySkeletonToSlot("evening", freeStructure.evening.map(s => ({ category: toCategory(s.category), label: s.suggestion })));
    setSkeletonApplied(true);
    refresh();
  }

  const activeSteps: ManualStep[] =
    activeSlot === "morning" ? routine.morning :
    activeSlot === "evening" ? routine.evening :
    activeSlot === "weekly"  ? (routine.weekly  ?? []) :
                               (routine.monthly ?? []);

  const FLOW_TITLE_MAP: Record<string, string> = {
    akne: "Akne", hassasiyet: "Hassasiyet", leke: "Leke",
    kuruluk: "Kuruluk", gunes: "Güneş", sac: "Saç Dökülmesi",
  };

  // ECZ4 Step 7 — Bootstrap tamamlanana kadar adapter henüz doğru routine'i
  // hedeflemiyor olabilir; bu yüzden create/edit modunda kısa bir loading
  // splash gösteriyoruz. Legacy modda bootstrapped initial=true → flicker yok.
  if (!bootstrapped) {
    return (
      <View style={[b.root, { backgroundColor: bg, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="small" color={GREEN} />
      </View>
    );
  }

  return (
    <View style={[b.root, { backgroundColor: bg, paddingTop: insets.top }]}>

      {/* Header */}
      <View style={[b.header, { borderBottomColor: borderColor }]}>
        <Pressable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/rutin"); } }} hitSlop={12} style={b.backBtn}>
          <Feather name="arrow-left" size={20} color={textPrimary} />
        </Pressable>
        <Text style={[b.headerTitle, { color: textPrimary }]}>Rutinimi Düzenle</Text>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/rutin");
            }
          }}
          hitSlop={8}
        >
          <Text style={[b.saveText, { color: GREEN }]}>Bitti</Text>
        </Pressable>
      </View>

      {/* Slot sekmeleri */}
      <View style={[b.tabBar, { backgroundColor: tabBg }]}>
        {SLOT_TABS.map(tab => {
          const active = activeSlot === tab.slot;
          return (
            <Pressable
              key={tab.slot}
              onPress={() => { Haptics.selectionAsync(); setActiveSlot(tab.slot); }}
              style={[b.tabItem, active && { backgroundColor: isDark ? "#2A3245" : "#FFFFFF" }]}
            >
              <Feather name={tab.icon as any} size={13} color={active ? tab.color : textSecondary} />
              <Text style={[b.tabLabel, { color: active ? tab.color : textSecondary, fontWeight: active ? "700" : "500" }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[b.scroll, { paddingBottom: scrollPaddingBottom() }]}
      >
        {/* V2 aktifken sabah/akşam uyarısı (yalnızca v2 detection çözüldükten sonra) */}
        {hasV2 === true && (activeSlot === "morning" || activeSlot === "evening") && (
          <View style={[b.v2Banner, {
            backgroundColor: isDark ? "rgba(217,119,6,0.10)" : "#FFFBEB",
            borderColor: "rgba(217,119,6,0.35)",
          }]}>
            <Feather name="alert-triangle" size={15} color={AMBER} />
            <Text style={[b.v2BannerText, { color: isDark ? "#F59E0B" : "#92400E" }]}>
              Analiz rutinin aktif. Sabah ve akşam adımları analiz programından gelir; buradan eklediklerin şu an görünmez kalır.
            </Text>
          </View>
        )}

        {/* V2 aktifken haftalık/aylık ek bakım onayı (yalnızca v2 detection çözüldükten sonra) */}
        {hasV2 === true && (activeSlot === "weekly" || activeSlot === "monthly") && (
          <View style={[b.v2Banner, {
            backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "#F4F7F0",
            borderColor: `${GREEN}55`,
          }]}>
            <Feather name="check-circle" size={15} color={GREEN} />
            <Text style={[b.v2BannerText, { color: isDark ? "#A8C49B" : "#4A6741" }]}>
              Bu adımlar analiz rutinin yanında ek bakım olarak görünür.
            </Text>
          </View>
        )}

        {/* Skeleton öneri (sadece Sabah/Akşam boşken) */}
        {freeStructure && !skeletonApplied
          && routine.morning.length === 0 && routine.evening.length === 0
          && (activeSlot === "morning" || activeSlot === "evening") && (
          <Pressable
            onPress={handleApplySkeleton}
            style={({ pressed }) => [b.skeletonCard, {
              backgroundColor: cardBg, borderColor: `${GREEN}35`, opacity: pressed ? 0.85 : 1,
            }]}
          >
            <View style={[b.skeletonIcon, { backgroundColor: `${GREEN}18` }]}>
              <Feather name="layers" size={15} color={GREEN} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[b.skeletonTitle, { color: textPrimary }]}>
                {bridgeRecord
                  ? `${FLOW_TITLE_MAP[bridgeRecord.flowId] ?? "Sonuç"} sonucuna göre iskelet uygula`
                  : "Önerilen rutin iskeletini uygula"}
              </Text>
              <Text style={[b.skeletonSub, { color: textSecondary }]}>
                Adımlar önerilir; ürünleri kendin seçersin.
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={textSecondary} />
          </Pressable>
        )}

        {/* Aktif slot */}
        <SlotSection
          slot={activeSlot}
          steps={activeSteps}
          onAdd={() => setAddModal(true)}
          onRemove={handleRemove}
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          cardBg={cardBg}
          borderColor={borderColor}
        />

        {/* Bilgi notu */}
        {(activeSlot === "weekly" || activeSlot === "monthly") && (
          <View style={[b.tip, { borderColor }]}>
            <Feather name="info" size={13} color={textSecondary} />
            <Text style={[b.tipText, { color: textSecondary }]}>
              {activeSlot === "weekly"
                ? "Haftalık adımlar her hafta hatırlatılır. Maske, peeling, özel bakım için idealdir."
                : "Aylık adımlar her ay tekrarlanacak bakım anımsatıcılarıdır."}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add modal */}
      {addModal && (
        <AddStepModal
          slot={activeSlot}
          onClose={() => {
            setAddModal(false);
            setPendingInitialCategory(null);
            setPendingLinkedProduct(null);
            refresh();
          }}
          isDark={isDark}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          cardBg={cardBg}
          borderColor={borderColor}
          initialCategory={pendingInitialCategory ?? undefined}
          initialLinkedProduct={pendingLinkedProduct}
        />
      )}
    </View>
  );
}

const b = StyleSheet.create({
  root:        { flex: 1 },
  header:      {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  saveText:    { fontSize: 14, fontWeight: "700" },
  tabBar:      {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  tabItem:     {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, borderRadius: 10, paddingVertical: 7,
  },
  tabLabel:    { fontSize: 12 },
  scroll:      { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  skeletonCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 16, borderWidth: 1.5, padding: 14,
  },
  skeletonIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  skeletonTitle: { fontSize: 13.5, fontWeight: "700" },
  skeletonSub:   { fontSize: 12, lineHeight: 17 },
  tip:  {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  tipText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  v2Banner: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  v2BannerText: { flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
});