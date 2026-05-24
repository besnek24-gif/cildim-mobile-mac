/**
 * alerji-listesi.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Şahsî Alerji ve Kaçınma Listesi Yöneticisi
 *
 * - allergyIngredients: kullanıcıda reaksiyon yaratmış içerikler (yüksek uyarı)
 * - avoidedIngredients: tercihten kaçınılan içerikler (orta uyarı)
 *
 * Etiket/tag sistemi: ekle + sil + öneri olarak örnek içerikler
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useUserPreferences } from "@/context/UserPreferencesContext";

// ── Öneri etiketleri ───────────────────────────────────────────────────────

const ALLERGY_SUGGESTIONS = [
  "Fragrance", "Parfum", "Retinol", "Salicylic Acid",
  "Niacinamide", "Limonene", "Linalool", "Benzoyl Peroxide",
  "Glycolic Acid", "Kojic Acid", "Formaldehyde", "Lanolin",
];

const AVOIDED_SUGGESTIONS = [
  "Alcohol Denat", "Silicone", "Paraben", "Sodium Lauryl Sulfate",
  "Dimethicone", "Mineral Oil", "Oxybenzone", "Isopropyl Myristate",
  "Ceteareth-20", "PEG compounds",
];

// ── Alt bileşenler ─────────────────────────────────────────────────────────

function TagChip({
  label,
  level,
  onRemove,
}: {
  label: string;
  level: "allergy" | "avoided";
  onRemove: () => void;
}) {
  const bg     = level === "allergy" ? "#FEF2F2" : "#FFFBEB";
  const border = level === "allergy" ? "#FCA5A5" : "#FDE68A";
  const color  = level === "allergy" ? "#B91C1C" : "#92400E";

  return (
    <View style={[styles.tag, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Feather name="x" size={12} color={color} />
      </TouchableOpacity>
    </View>
  );
}

function SuggestionPill({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.suggestion, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Feather name="plus" size={11} color={colors.textMuted} />
      <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Ana bileşen ────────────────────────────────────────────────────────────

export default function AlerjiListesiScreen() {
  const colors = useColors();
  const { preferences, setAllergyIngredients, setAvoidedIngredients } = useUserPreferences();

  const [allergyInput, setAllergyInput] = useState("");
  const [avoidedInput, setAvoidedInput] = useState("");

  const allergyRef = useRef<TextInput>(null);
  const avoidedRef = useRef<TextInput>(null);

  const allergyList = preferences.allergyIngredients;
  const avoidedList = preferences.avoidedIngredients;

  // Apple/KVKK explicit consent: önceden liste varsa otomatik onaylı say (regresyon önleme)
  const [consent, setConsent] = useState(
    () => allergyList.length > 0 || avoidedList.length > 0,
  );

  // ── Ekleme ──────────────────────────────────────────────────────────────

  const addAllergy = (val: string) => {
    if (!consent) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    if (allergyList.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return;
    Haptics.selectionAsync();
    void setAllergyIngredients([...allergyList, trimmed]);
    setAllergyInput("");
  };

  const addAvoided = (val: string) => {
    if (!consent) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    if (avoidedList.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return;
    Haptics.selectionAsync();
    void setAvoidedIngredients([...avoidedList, trimmed]);
    setAvoidedInput("");
  };

  // ── Silme ───────────────────────────────────────────────────────────────

  const removeAllergy = (item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void setAllergyIngredients(allergyList.filter((i) => i !== item));
  };

  const removeAvoided = (item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void setAvoidedIngredients(avoidedList.filter((i) => i !== item));
  };

  // ── Öneri filtreleme ────────────────────────────────────────────────────

  const allergySuggestions = ALLERGY_SUGGESTIONS.filter(
    (s) => !allergyList.some((i) => i.toLowerCase() === s.toLowerCase())
  ).slice(0, 8);

  const avoidedSuggestions = AVOIDED_SUGGESTIONS.filter(
    (s) => !avoidedList.some((i) => i.toLowerCase() === s.toLowerCase())
  ).slice(0, 8);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>

      {/* Navbar */}
      <View style={[styles.navbar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Alerji & Kaçınma Listesi</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bilgi notu */}
        <View style={[styles.infoCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
          <Feather name="info" size={14} color="#2563EB" />
          <Text style={styles.infoText}>
            Buraya eklediğin içerikler ürün sayfalarında şahsına özel çakışma uyarısı olarak gösterilir. Veriler yalnızca cihazında saklanır.
          </Text>
        </View>

        {/* Açık rıza (Apple/KVKK) */}
        <TouchableOpacity
          style={[styles.consentCard, { backgroundColor: colors.surfaceCard, borderColor: consent ? "#4F46E5" : colors.border }]}
          onPress={() => { Haptics.selectionAsync(); setConsent((v) => !v); }}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
        >
          <View style={[styles.consentBox, { backgroundColor: consent ? "#4F46E5" : "transparent", borderColor: consent ? "#4F46E5" : colors.border }]}>
            {consent && <Feather name="check" size={13} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.consentTitle, { color: colors.text }]}>
              Alerji ve hassasiyet bilgilerimin ürün uyarıları oluşturmak için işlenmesini kabul ediyorum.
            </Text>
            <Text style={[styles.consentSub, { color: colors.textMuted }]}>
              Bu bilgiler tıbbi teşhis için değil, içerik bazlı güvenli kullanım uyarıları için kullanılır.{" "}
              <Text style={styles.consentLink} onPress={() => router.push("/sozlesme" as any)}>
                Gizlilik Politikası
              </Text>
              .
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── Alerji Listesi ── */}
        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: "#FCA5A5" }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#FEF2F2" }]}>
              <Feather name="alert-triangle" size={14} color="#B91C1C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Alerji Listem</Text>
              <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                Reaksiyon verdiğin içerikler — en yüksek uyarı seviyesi
              </Text>
            </View>
          </View>

          {/* Etiketler */}
          {allergyList.length > 0 && (
            <View style={styles.tagRow}>
              {allergyList.map((item) => (
                <TagChip
                  key={item}
                  label={item}
                  level="allergy"
                  onRemove={() => removeAllergy(item)}
                />
              ))}
            </View>
          )}

          {/* Giriş alanı */}
          <View style={[styles.inputRow, { borderColor: "#FCA5A5", backgroundColor: colors.background }]}>
            <TextInput
              ref={allergyRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="İçerik adı yaz (örn: Retinol)"
              placeholderTextColor={colors.textMuted}
              value={allergyInput}
              onChangeText={setAllergyInput}
              onSubmitEditing={() => addAllergy(allergyInput)}
              returnKeyType="done"
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: allergyInput.trim() && consent ? "#B91C1C" : colors.border }]}
              onPress={() => addAllergy(allergyInput)}
              disabled={!allergyInput.trim() || !consent}
            >
              <Feather name="plus" size={16} color={allergyInput.trim() && consent ? "#fff" : colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Öneriler */}
          {allergySuggestions.length > 0 && (
            <View>
              <Text style={[styles.suggestLabel, { color: colors.textMuted }]}>Hızlı ekle:</Text>
              <View style={styles.suggestionRow}>
                {allergySuggestions.map((s) => (
                  <SuggestionPill key={s} label={s} onPress={() => addAllergy(s)} />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── Kaçınma Listesi ── */}
        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: "#FDE68A" }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#FFFBEB" }]}>
              <Feather name="slash" size={14} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Kaçınma Listem</Text>
              <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                Tercihten kaçındığın içerikler — orta uyarı seviyesi
              </Text>
            </View>
          </View>

          {avoidedList.length > 0 && (
            <View style={styles.tagRow}>
              {avoidedList.map((item) => (
                <TagChip
                  key={item}
                  label={item}
                  level="avoided"
                  onRemove={() => removeAvoided(item)}
                />
              ))}
            </View>
          )}

          <View style={[styles.inputRow, { borderColor: "#FDE68A", backgroundColor: colors.background }]}>
            <TextInput
              ref={avoidedRef}
              style={[styles.input, { color: colors.text }]}
              placeholder="İçerik adı yaz (örn: Alcohol Denat)"
              placeholderTextColor={colors.textMuted}
              value={avoidedInput}
              onChangeText={setAvoidedInput}
              onSubmitEditing={() => addAvoided(avoidedInput)}
              returnKeyType="done"
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: avoidedInput.trim() && consent ? "#D97706" : colors.border }]}
              onPress={() => addAvoided(avoidedInput)}
              disabled={!avoidedInput.trim() || !consent}
            >
              <Feather name="plus" size={16} color={avoidedInput.trim() && consent ? "#fff" : colors.textMuted} />
            </TouchableOpacity>
          </View>

          {avoidedSuggestions.length > 0 && (
            <View>
              <Text style={[styles.suggestLabel, { color: colors.textMuted }]}>Hızlı ekle:</Text>
              <View style={styles.suggestionRow}>
                {avoidedSuggestions.map((s) => (
                  <SuggestionPill key={s} label={s} onPress={() => addAvoided(s)} />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Alias notu */}
        <View style={[styles.aliasNote, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Feather name="link" size={13} color={colors.textMuted} />
          <Text style={[styles.aliasText, { color: colors.textMuted }]}>
            Sistem alias eşleştirmesi yapar. "Fragrance" yazarsan "Parfum" ve "Aroma" da eşleşir.
            "Retinol" yazarsan "Retinyl Palmitate" gibi türevler de yakalanır.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stiller ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  navbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  navBtn:   { width: 36 },
  navTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700" },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    gap: 14,
  },

  infoCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12.5,
    color: "#1D4ED8",
    lineHeight: 18,
  },

  consentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
  },
  consentBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  consentTitle: { fontSize: 12.5, fontWeight: "700", lineHeight: 17 },
  consentSub:   { fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  consentLink:  { color: "#4F46E5", fontWeight: "700", textDecorationLine: "underline" },

  section: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700" },
  sectionSub:   { fontSize: 12, marginTop: 2 },

  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontSize: 12.5, fontWeight: "600" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  suggestLabel: { fontSize: 11, fontWeight: "600", marginBottom: 6, marginTop: 2 },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  suggestionText: { fontSize: 12 },

  aliasNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 2,
  },
  aliasText: { flex: 1, fontSize: 12, lineHeight: 17 },
});