import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
// ECZ4 Step B — Cilt Anketi → lokal RoutineProfile köprüsü.
// Backend POST davranışı korunur; ek olarak deterministik bir mapper ile
// formData → RoutineProfile üretilip rehber/akıllı seçim ile aynı persist
// katmanına ("anket" namespace'i) yazılır ve rutin oluşturma ekranına
// yönlendirilir. Hiçbir mevcut akış (Rehber, Akıllı Seçim, Cilt Analizi,
// manuel rutin) etkilenmez.
import { anketToRoutineProfile } from "@/lib/anketToRoutineProfile";
import { saveConcernRoutineProfile } from "@/lib/concernRoutineBridgeStore";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

const STEPS = [
  { id: "age_range", title: "Yaş Aralığınız", subtitle: "Cilt bakım ihtiyaçları yaşa göre değişir" },
  { id: "skin_type", title: "Cilt Tipiniz", subtitle: "Cilt tipinizi en iyi siz bilirsiniz" },
  { id: "primary_concerns", title: "Ana Sorunlarınız", subtitle: "Birden fazla seçebilirsiniz" },
  { id: "current_actives", title: "Kullandığınız Aktifler", subtitle: "Halihazırda kullandığınız aktifler" },
  { id: "lifestyle", title: "Yaşam Tarzı", subtitle: "Günlük alışkanlıklarınız" },
];

const STEP_OPTIONS: Record<string, { id: string; label: string; icon: string }[]> = {
  age_range: [
    { id: "18-24", label: "18–24", icon: "🌱" },
    { id: "25-34", label: "25–34", icon: "✨" },
    { id: "35-44", label: "35–44", icon: "🌸" },
    { id: "45-54", label: "45–54", icon: "🌺" },
    { id: "55+", label: "55+", icon: "🌟" },
  ],
  skin_type: [
    { id: "normal", label: "Normal", icon: "😊" },
    { id: "kuru", label: "Kuru", icon: "🏜️" },
    { id: "yağlı", label: "Yağlı", icon: "💧" },
    { id: "karma", label: "Karma", icon: "⚖️" },
    { id: "hassas", label: "Hassas", icon: "🌷" },
  ],
  primary_concerns: [
    { id: "akne", label: "Akne / Sivilce", icon: "⚡" },
    { id: "kırışıklık", label: "Kırışıklık", icon: "🔍" },
    { id: "leke", label: "Leke / Ton Eşitsizliği", icon: "🌤️" },
    { id: "gözenek", label: "Büyük Gözenekler", icon: "🔬" },
    { id: "kuruluğu", label: "Kuruluk / Gerginlik", icon: "🏔️" },
    { id: "hassasiyet", label: "Hassasiyet / Kızarıklık", icon: "🌹" },
    { id: "halkalar", label: "Göz Altı Halkalar", icon: "👁️" },
    { id: "parlaklık", label: "Donuk / Mat Görünüm", icon: "💫" },
    // ECZ4 Step B — "Hiçbirisi" nötr seçeneği. Mapper bu id'yi gördüğünde
    // skin_type tabanlı genel günlük bakım profiline düşer (acne/dryness/
    // sensitivity arasından oilBalance'a göre).
    { id: "daily_care", label: "Hiçbirisi / Sadece günlük bakım", icon: "🤍" },
  ],
  current_actives: [
    { id: "retinol", label: "Retinol / A Vitamini", icon: "🔴" },
    { id: "vitamin-c", label: "C Vitamini", icon: "🍋" },
    { id: "niacinamide", label: "Niasinamid", icon: "🔵" },
    { id: "aha-bha", label: "AHA / BHA Asitler", icon: "⚗️" },
    { id: "hyaluronic", label: "Hyaluronik Asit", icon: "💦" },
    { id: "peptides", label: "Peptidler", icon: "🧬" },
    { id: "hic-biri", label: "Hiçbiri", icon: "✋" },
  ],
  lifestyle: [
    { id: "güneş-koruması", label: "SPF Kullanıyorum", icon: "☀️" },
    { id: "az-uyku", label: "Az Uyku (< 6 saat)", icon: "😴" },
    { id: "stresli", label: "Yoğun Stres", icon: "🌪️" },
    { id: "sigara", label: "Sigara Kullanıyorum", icon: "🚬" },
    { id: "sağlıklı-beslenme", label: "Sağlıklı Besleniyorum", icon: "🥗" },
    { id: "egzersiz", label: "Düzenli Egzersiz", icon: "🏃" },
    { id: "gebe", label: "Hamile / Emziriyorum", icon: "🤱" },
    // ECZ4 Step B — Belirtmek istemeyenler için nötr çıkış. Mapper sadece
    // diğer lifestyle bayraklarını okur; "none" tek başına seçilirse hiçbir
    // not üretilmez.
    { id: "none", label: "Hiçbiri / Belirtmek istemiyorum", icon: "✋" },
  ],
};

// ECZ4 Step B — Adım başına eksklüziv ("none"-benzeri) id'ler. Bu id seçilirse
// aynı adımdaki diğer seçimler temizlenir; başka bir id seçilirse bu id
// otomatik kaldırılır. Sadece çoklu-seçim adımlarında uygulanır.
const EXCLUSIVE_IDS: Record<string, string> = {
  primary_concerns: "daily_care",
  current_actives:  "hic-biri",
  lifestyle:        "none",
};

const STEP_COLORS = [
  "#6BA3A0",
  "#C5847A",
  "#B07838",
  "#6278A6",
  "#6B9E77",
];

type FormData = {
  age_range?: string;
  skin_type?: string;
  primary_concerns: string[];
  current_actives: string[];
  lifestyle: string[];
};

// ECZ4 — BUG 2 fix. Anket her yeni girişte sıfırdan başlamalı. Tab ekranı
// olduğu için Expo Router screen mount'u koruyabilir; useState'in initial
// değeri yalnızca ilk mount'ta uygulanır. Stable bir initial constant ile
// useFocusEffect, her yeniden odaklanmada step + formData'yı temizler.
// Step değişiminde focus aynı kaldığı için reset tetiklenmez (kullanıcı
// aktif cevaplama sırasında kaybetmez).
const INITIAL_FORM_DATA: FormData = {
  primary_concerns: [],
  current_actives: [],
  lifestyle: [],
};

// ECZ4 Step G — Source-aware back resolver. Anketi açan ekrana geri dön.
// Truth: ?from query param. Bilinmeyen / yoksa profil fallback (mevcut davranış).
function resolveQuestionnaireBack(from: string | undefined): any {
  switch (from) {
    case "rutin":        return "/(tabs)/rutin";
    case "homeRoutine":  return "/(tabs)/(home)";
    case "profile":      return "/(tabs)/profil";
    default:             return "/(tabs)/profil";
  }
}

export default function QuestionnaireScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backFallback = resolveQuestionnaireBack(from);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getAuthHeaders } = useAuth();

  // ECZ4 GLOBAL — Defense-in-Depth: Misafir kullanıcı anketi açamaz.
  // Daha önce yalnızca submit anında engelleniyordu; deep-link / push /
  // doğrudan rota ile gelen misafir tüm formu doldurup son adımda blocked
  // oluyordu. Şimdi mount anında /giris'e replace ediyoruz. Mevcut handleNext
  // submit guard yerinde kalır (savunma derinliği). Free + Seçkin için
  // davranış değişmedi. Erken-return JSX bloğu öncesinde — rules of hooks
  // ihlal edilmez (tüm hook'lar her render'da çalışır).
  React.useEffect(() => {
    if (!user) {
      router.replace("/giris" as any);
    }
  }, [user]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);

  // ECZ4 — BUG 2 fix. Yeni giriş = taze form. Ekran her odaklandığında
  // (Rutinim/Home/Profile'dan açılış, ya da rutin-olustur'dan geri dönüş
  // sonrası tekrar açılış) state sıfırlanır. Aktif adım değişimleri focus'u
  // değiştirmediği için kullanıcı cevap verirken bu effect tetiklenmez.
  useFocusEffect(
    useCallback(() => {
      setStep(0);
      setFormData(INITIAL_FORM_DATA);
      setLoading(false);
    }, []),
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { scrollPaddingBottom, ctaBarBottom } = useTabBarInset();

  const currentStep = STEPS[step];
  const stepColor = STEP_COLORS[step];
  const isMulti = ["primary_concerns", "current_actives", "lifestyle"].includes(currentStep.id);

  const isSelected = (optId: string) => {
    const key = currentStep.id as keyof FormData;
    const val = formData[key];
    if (Array.isArray(val)) return val.includes(optId);
    return val === optId;
  };

  const toggle = (optId: string) => {
    Haptics.selectionAsync();
    const key = currentStep.id as keyof FormData;
    if (isMulti) {
      const exclusiveId = EXCLUSIVE_IDS[currentStep.id];
      setFormData(prev => {
        const arr = (prev[key] as string[]) ?? [];
        const already = arr.includes(optId);
        // ECZ4 Step B — eksklüziv id davranışı.
        // 1) "none"-benzeri seçilirse aynı adımdaki diğer tüm seçimler silinir.
        // 2) Başka bir id seçilirse "none"-benzeri id varsa kaldırılır.
        if (exclusiveId && optId === exclusiveId) {
          return { ...prev, [key]: already ? [] : [exclusiveId] };
        }
        const next = already ? arr.filter(x => x !== optId) : [...arr, optId];
        const cleaned = exclusiveId ? next.filter(x => x !== exclusiveId) : next;
        return { ...prev, [key]: cleaned };
      });
    } else {
      setFormData(prev => ({ ...prev, [key]: optId }));
    }
  };

  const canNext = () => {
    const key = currentStep.id as keyof FormData;
    const val = formData[key];
    if (Array.isArray(val)) return val.length > 0;
    return !!val;
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }
    if (!user) {
      router.push("/giris");
      return;
    }
    setLoading(true);

    // ECZ4 Step B — Backend POST'u "best effort" çalıştırılır; başarısızlık
    // kullanıcıyı engellemez. Asıl source-of-truth lokal RoutineProfile'dır.
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/auth/questionnaire`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...formData,
          budget_preference: "orta",
          is_pregnant: formData.lifestyle.includes("gebe"),
        }),
      });
      if (!res.ok && __DEV__) {
        const errPayload = await res.json().catch(() => null);
        console.warn("[questionnaire] backend POST non-ok:", res.status, errPayload);
      }
    } catch (e) {
      if (__DEV__) console.warn("[questionnaire] backend POST failed:", e);
    }

    // ECZ4 Step B — Lokal RoutineProfile üret + persist + rutin ekranına git.
    try {
      const profile = anketToRoutineProfile({
        age_range:        formData.age_range,
        skin_type:        formData.skin_type,
        primary_concerns: formData.primary_concerns,
        current_actives:  formData.current_actives,
        lifestyle:        formData.lifestyle,
      });
      saveConcernRoutineProfile("anket", profile, false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLoading(false);
      // ECZ4 GLOBAL — `from` param submit redirect'inde korunur. Böylece
      // sonuç ekranındaki (rutin-olustur) geri tuşu doğru kaynak ekrana
      // dönebilir. `from` yoksa "rutin" güvenli varsayılan (rutin oluşturma
      // ana giriş noktası); profile yalnız Profile'dan başlatıldıysa kullanılır.
      const submitFrom = from ?? "rutin";
      router.replace(`/(tabs)/(home)/rutin-olustur?flow=anket&premium=0&from=${encodeURIComponent(submitFrom)}` as any);
      return;
    } catch (e) {
      if (__DEV__) console.warn("[questionnaire] local profile build failed:", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLoading(false);
      Alert.alert(
        "Rutin oluşturulamadı",
        "Anket sonucu işlenirken bir sorun oluştu. Lütfen tekrar deneyin.",
      );
    }
  };

  // ECZ4 GLOBAL — Defense-in-Depth (cont.): Misafir için JSX render edilmez.
  // useEffect mount sonrası /giris replace eder; bu erken-return aradaki
  // bir frame'lik flash'i de engeller. Tüm hook'lar üstte çalıştığı için
  // rules of hooks ihlali yok.
  if (!user) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.surfaceCard }]}
          onPress={() => step > 0 ? setStep(s => s - 1) : safeBack(router, backFallback)}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: i <= step ? stepColor : colors.border },
                i === step && { width: 24 },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={[styles.stepNum, { color: stepColor }]}>
            {step + 1} / {STEPS.length}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>{currentStep.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{currentStep.subtitle}</Text>
          {isMulti && (
            <Text style={[styles.multiHint, { color: colors.textMuted }]}>
              Birden fazla seçebilirsiniz
            </Text>
          )}
        </View>

        <View style={styles.options}>
          {STEP_OPTIONS[currentStep.id].map(opt => {
            const sel = isSelected(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.option,
                  {
                    backgroundColor: sel ? `${stepColor}15` : colors.surfaceCard,
                    borderColor: sel ? stepColor : colors.border,
                    borderWidth: sel ? 2 : 1,
                  },
                ]}
                onPress={() => toggle(opt.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionIcon}>{opt.icon}</Text>
                <Text style={[styles.optionLabel, { color: sel ? stepColor : colors.text }]}>
                  {opt.label}
                </Text>
                {sel && <Feather name="check" size={16} color={stepColor} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: ctaBarBottom + 8, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.nextBtn,
            { backgroundColor: canNext() ? stepColor : colors.border },
          ]}
          onPress={handleNext}
          disabled={!canNext() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextText}>
                {step === STEPS.length - 1 ? "Rutin Oluştur" : "İleri"}
              </Text>
              <Feather name={step === STEPS.length - 1 ? "check" : "arrow-right"} size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  progressRow: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center" },
  progressDot: { height: 6, width: 6, borderRadius: 3 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  titleSection: { gap: 6, marginBottom: 28 },
  stepNum: { fontSize: 13, fontWeight: "700" as const },
  title: { fontSize: 26, fontWeight: "800" as const, lineHeight: 32 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  multiHint: { fontSize: 12, marginTop: 2 },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  optionIcon: { fontSize: 22 },
  optionLabel: { flex: 1, fontSize: 16, fontWeight: "500" as const },
  footer: { paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 17,
    gap: 10,
  },
  nextText: { color: "#fff", fontSize: 17, fontWeight: "700" as const },
});