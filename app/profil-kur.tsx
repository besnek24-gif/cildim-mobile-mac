/**
 * profil-kur.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Cilt Profili Sihirbazı — 1 ekran = 1 soru, ilerleme çubuğu
 * Veriler UserPreferencesContext üzerinden AsyncStorage'a kaydedilir.
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import type { SpecialConditionKey, SkinType, AllergyKey } from "@/lib/userPreferences";

// ── Soru tanımları ─────────────────────────────────────────────────────────

type StepType = "single" | "yesno";

interface StepOption {
  label: string;
  value: string;
  icon: string;
  sub?: string;
}

interface Step {
  id: string;
  question: string;
  subtitle: string;
  type: StepType;
  options?: StepOption[];
}

const STEPS: Step[] = [
  {
    id: "skinType",
    question: "Cilt tipin nedir?",
    subtitle: "Sana en uygun ürünleri önerebilmek için bilmemiz gerekiyor.",
    type: "single",
    options: [
      { label: "Normal",  value: "normal",      icon: "sun",      sub: "Ne kuru ne yağlı" },
      { label: "Kuru",    value: "dry",          icon: "droplet",  sub: "Gerginlik ve pullanma hisseder" },
      { label: "Yağlı",  value: "oily",         icon: "activity", sub: "Gün içinde parlıyor" },
      { label: "Karma",  value: "combination",  icon: "sliders",  sub: "Alın-burun yağlı, yanaklar kuru" },
      { label: "Hassas", value: "sensitive",    icon: "shield",   sub: "Kolayca kızarır ve tahriş olur" },
    ],
  },
  {
    id: "sensitive",
    question: "Cildin hassas mı?",
    subtitle: "Hassas ciltler için parfüm ve tahriş edici uyarılarını öne çıkarırız.",
    type: "yesno",
  },
  {
    id: "acneProne",
    question: "Sivilceye eğilimin var mı?",
    subtitle: "Gözenek tıkayan ve komedojenik bileşenleri vurgulamaya önem veririz.",
    type: "yesno",
  },
  {
    id: "rosacea",
    question: "Rozasea hassasiyetin var mı?",
    subtitle: "Tahriş edici bileşenlere karşı daha dikkatli uyarılar sunarız.",
    type: "yesno",
  },
  {
    id: "fragranceSensitive",
    question: "Parfüm seni rahatsız eder mi?",
    subtitle: "Koku içeren ürünleri sana özellikle belirtiriz ve uyarı seviyesini yükseltiriz.",
    type: "yesno",
  },
  {
    id: "alcoholSensitive",
    question: "Alkol hassasiyetin var mı?",
    subtitle: "Sert alkol türevleri içeren ürünlerde sana özel uyarı gösteririz.",
    type: "yesno",
  },
  {
    id: "essentialOilSensitive",
    question: "Esansiyel yağlar cildi rahatsız eder mi?",
    subtitle: "Lavanta, çay ağacı, turunçgil yağı gibi esansiyel yağlara hassasiyetin varsa belirt.",
    type: "yesno",
  },
  {
    id: "pregnant",
    question: "Hamile misin?",
    subtitle: "Hamilelik döneminde tavsiye edilmeyen bileşenler için üst düzey uyarı gösteririz.",
    type: "yesno",
  },
  {
    id: "breastfeeding",
    question: "Emziriyor musun?",
    subtitle: "Emzirme döneminde temkinli yaklaşılması gereken bileşenler için ayrıca bilgilendiririz.",
    type: "yesno",
  },
  {
    id: "forChild",
    question: "Ürünü bir çocuk için mi arıyorsun?",
    subtitle: "Çocuk cildine uygun olmayan bileşenler için özel notlar ekleriz.",
    type: "yesno",
  },
];

const TOTAL_STEPS = STEPS.length;

// ── Bileşen ────────────────────────────────────────────────────────────────

export default function ProfilKurScreen() {
  const colors = useColors();
  const { preferences, update } = useUserPreferences();

  const [step, setStep]             = useState(0);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [saving, setSaving]         = useState(false);
  const [consent, setConsent]       = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Mevcut tercihlerden ön-doldurum
  useEffect(() => {
    const sc = preferences.specialConditions;
    const al = preferences.allergies;
    setSelections({
      skinType:             preferences.skinType ?? null,
      sensitive:            sc.includes("sensitive_skin"),
      acneProne:            sc.includes("acne_prone"),
      rosacea:              sc.includes("rosacea"),
      fragranceSensitive:   al.includes("fragrance"),
      alcoholSensitive:     al.includes("alcohol"),
      essentialOilSensitive:al.includes("essential_oil"),
      pregnant:             sc.includes("pregnancy"),
      breastfeeding:        sc.includes("breastfeeding"),
      forChild:             sc.includes("for_child"),
    });
  }, []);

  // İlerleme çubuğu animasyonu
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: (step + 1) / TOTAL_STEPS,
      damping: 20,
      stiffness: 200,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const current    = STEPS[step];
  const isLastStep = step === TOTAL_STEPS - 1;
  const hasValue   =
    selections[current.id] !== undefined &&
    selections[current.id] !== null;

  const select = useCallback(
    (value: any) => {
      Haptics.selectionAsync();
      setSelections((prev) => ({ ...prev, [current.id]: value }));
    },
    [current.id],
  );

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      if (!consent) return;
      void handleSave();
    }
  };

  const handleSave = async () => {
    if (!consent) return;
    setSaving(true);
    const sc = new Set<SpecialConditionKey>(preferences.specialConditions);
    const al = new Set<AllergyKey>(preferences.allergies);

    // SpecialConditions
    if (selections.sensitive)    sc.add("sensitive_skin"); else sc.delete("sensitive_skin");
    if (selections.acneProne)    sc.add("acne_prone");     else sc.delete("acne_prone");
    if (selections.rosacea)      sc.add("rosacea");         else sc.delete("rosacea");
    if (selections.pregnant)     sc.add("pregnancy");       else sc.delete("pregnancy");
    if (selections.breastfeeding)sc.add("breastfeeding");   else sc.delete("breastfeeding");
    if (selections.forChild)     sc.add("for_child");       else sc.delete("for_child");

    // Allergies
    if (selections.fragranceSensitive)    al.add("fragrance");     else al.delete("fragrance");
    if (selections.alcoholSensitive)      al.add("alcohol");        else al.delete("alcohol");
    if (selections.essentialOilSensitive) al.add("essential_oil");  else al.delete("essential_oil");

    await update({
      skinType: (selections.skinType as SkinType) ?? null,
      specialConditions: Array.from(sc),
      allergies: Array.from(al),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  // ── Seçenek render ─────────────────────────────────────────────────────

  const renderOptions = () => {
    if (current.type === "yesno") {
      const val = selections[current.id];
      return (
        <View style={styles.yesnoRow}>
          <TouchableOpacity
            style={[
              styles.yesnoBtn,
              val === true
                ? { backgroundColor: "#4F46E520", borderColor: "#4F46E5", borderWidth: 2 }
                : { backgroundColor: colors.surfaceCard, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => select(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.yesnoIcon, { backgroundColor: val === true ? "#4F46E515" : colors.background }]}>
              <Feather name="check" size={22} color={val === true ? "#4F46E5" : colors.textSecondary} />
            </View>
            <Text style={[styles.yesnoText, { color: val === true ? "#4F46E5" : colors.text }]}>
              Evet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.yesnoBtn,
              val === false
                ? { backgroundColor: "#6B728020", borderColor: "#6B7280", borderWidth: 2 }
                : { backgroundColor: colors.surfaceCard, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => select(false)}
            activeOpacity={0.75}
          >
            <View style={[styles.yesnoIcon, { backgroundColor: val === false ? "#6B728015" : colors.background }]}>
              <Feather name="x" size={22} color={val === false ? "#6B7280" : colors.textSecondary} />
            </View>
            <Text style={[styles.yesnoText, { color: val === false ? "#6B7280" : colors.text }]}>
              Hayır
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.optionList}>
        {(current.options ?? []).map((opt) => {
          const selected = selections[current.id] === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionCard,
                selected
                  ? { backgroundColor: "#4F46E510", borderColor: "#4F46E5", borderWidth: 2 }
                  : { backgroundColor: colors.surfaceCard, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => select(opt.value)}
              activeOpacity={0.75}
            >
              <View style={[
                styles.optionIconBox,
                { backgroundColor: selected ? "#4F46E515" : colors.background },
              ]}>
                <Feather name={opt.icon as any} size={18} color={selected ? "#4F46E5" : colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: selected ? "#4F46E5" : colors.text }]}>
                  {opt.label}
                </Text>
                {opt.sub && (
                  <Text style={[styles.optionSub, { color: selected ? "#6366F1" : colors.textSecondary }]}>
                    {opt.sub}
                  </Text>
                )}
              </View>
              {selected && (
                <View style={styles.optionCheck}>
                  <Feather name="check" size={11} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Başlık ── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (step > 0) {
              setStep((s) => s - 1);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name={step > 0 ? "arrow-left" : "x"} size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Cilt Profili</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {step + 1} / {TOTAL_STEPS}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (isLastStep) {
              if (!consent) return;
              void handleSave();
            } else {
              setStep((s) => s + 1);
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isLastStep && !consent}
        >
          <Text style={[styles.skipText, { color: (isLastStep && !consent) ? "transparent" : colors.textMuted }]}>
            {isLastStep ? "Geç" : "Atla"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── İlerleme çubuğu ── */}
      <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      {/* ── İçerik ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.questionArea}>
          <Text style={[styles.stepPill, { color: colors.textMuted, backgroundColor: colors.surfaceCard }]}>
            {step + 1} / {TOTAL_STEPS}
          </Text>
          <Text style={[styles.question, { color: colors.text }]}>
            {current.question}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {current.subtitle}
          </Text>
        </View>

        {renderOptions()}

        {/* Hamilelik / emzirme adımı için ek açık rıza notu */}
        {(current.id === "pregnant" || current.id === "breastfeeding") && (
          <View style={[styles.privacyNote, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", marginTop: 12 }]}>
            <Feather name="info" size={13} color="#92400E" />
            <Text style={[styles.privacyText, { color: "#92400E" }]}>
              Hamilelik veya emzirme bilgimin içerik güvenliği uyarıları oluşturmak için işlenmesini kabul ediyorum. Bu uyarılar tıbbi tavsiye yerine geçmez; gerekli durumlarda hekim veya eczacı görüşü alınmalıdır.
            </Text>
          </View>
        )}

        {/* Çocuk için ürün adımında veli/vasi notu */}
        {current.id === "forChild" && (
          <View style={[styles.privacyNote, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", marginTop: 12 }]}>
            <Feather name="info" size={13} color="#2563EB" />
            <Text style={[styles.privacyText, { color: "#1D4ED8" }]}>
              18 yaş altı kullanıcılar için bu uygulama yalnızca veli veya vasi onayıyla kullanılmalıdır.
            </Text>
          </View>
        )}

        {/* Kaçınma listesi hatırlatıcısı — son adımda */}
        {isLastStep && (
          <>
            <View style={[styles.privacyNote, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <Feather name="lock" size={13} color={colors.textMuted} />
              <Text style={[styles.privacyText, { color: colors.textMuted }]}>
                Bu bilgiler bakım önerilerini kişiselleştirmek için kullanılır. Gizlilik politikamız kapsamında korunur ve iznin olmadan pazarlama amacıyla üçüncü kişilerle paylaşılmaz.
              </Text>
            </View>

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
                  Cilt profili cevaplarımın bakım önerilerini kişiselleştirmek için işlenmesini kabul ediyorum.
                </Text>
                <Text style={[styles.consentSub, { color: colors.textMuted }]}>
                  Bu bilgiler tıbbi teşhis veya tedavi amacı taşımaz.{" "}
                  <Text style={styles.consentLink} onPress={() => router.push("/sozlesme" as any)}>
                    Gizlilik Politikası ve Kullanım Koşulları
                  </Text>
                  .
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.listHint, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              onPress={() => router.push("/alerji-listesi" as any)}
              activeOpacity={0.8}
            >
              <Feather name="list" size={14} color="#4F46E5" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#4F46E5" }}>
                  Şahsî Alerji / Kaçınma Listesi
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Belirli içeriklerden kaçınmak istiyorsan buradan ekleyebilirsin.
                </Text>
              </View>
              <Feather name="arrow-right" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ── Alt CTA ── */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {(() => {
          const ctaEnabled = isLastStep ? (hasValue && consent) : hasValue;
          return (
            <TouchableOpacity
              style={[
                styles.cta,
                { backgroundColor: ctaEnabled ? "#4F46E5" : colors.border },
              ]}
              onPress={handleNext}
              disabled={saving || (isLastStep && !consent)}
              activeOpacity={0.85}
            >
              {isLastStep
                ? <Text style={[styles.ctaText, { color: ctaEnabled ? "#fff" : colors.textMuted }]}>
                    {saving ? "Kaydediliyor…" : (consent ? "Profili Kaydet" : "Onayla ve Kaydet")}
                  </Text>
                : <>
                    <Text style={[styles.ctaText, { color: ctaEnabled ? "#fff" : colors.textMuted }]}>
                      İleri
                    </Text>
                    <Feather name="arrow-right" size={18} color={ctaEnabled ? "#fff" : colors.textMuted} />
                  </>
              }
            </TouchableOpacity>
          );
        })()}
      </View>

    </SafeAreaView>
  );
}

// ── Stiller ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn:    { width: 40 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { fontSize: 15, fontWeight: "700" },
  headerSub:    { fontSize: 12, marginTop: 1 },
  skipText:     { fontSize: 14 },

  progressBg: {
    height: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: "#4F46E5",
    borderRadius: 2,
  },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },

  questionArea: { marginBottom: 32 },
  stepPill: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
  },
  question: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },

  yesnoRow: { flexDirection: "row", gap: 12 },
  yesnoBtn: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: "center",
    gap: 12,
  },
  yesnoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  yesnoText: { fontSize: 17, fontWeight: "700" },

  optionList: { gap: 10 },
  optionCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  optionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontSize: 16, fontWeight: "700" },
  optionSub:   { fontSize: 12, marginTop: 2 },
  optionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },

  privacyNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 32,
  },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18 },

  consentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginTop: 10,
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
  consentTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  consentSub:   { fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  consentLink:  { color: "#4F46E5", fontWeight: "700", textDecorationLine: "underline" },

  listHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    marginTop: 10,
  },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 20 : 16,
  },
  cta: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontSize: 17, fontWeight: "700" },
});