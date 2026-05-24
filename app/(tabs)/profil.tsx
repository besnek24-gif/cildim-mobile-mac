import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getLocalHistory } from "@/lib/localHistory";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { isAdminUser } from "@/lib/admin/isAdminUser";
import { useUserPreferences } from "@/context/UserPreferencesContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { PC, getPremiumHeroColors } from "@/local_demo_data/safe_runtime_shims_v74";
import {
  ALLERGY_LABELS,
  SPECIAL_CONDITION_LABELS,
  type AllergyKey,
  type SpecialConditionKey,
} from "@/lib/userPreferences";
import {
  canUseAllergyFilter,
  canUsePremiumModules,
  getMembershipInfo,
} from "@/lib/accessControl";
import { PremiumLockCard } from "@/local_demo_data/safe_runtime_shims_v74";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

interface ScanHistory {
  id: string | number;
  urunId?: string;
  productId?: string;
  urunAdi?: string;
  productName?: string;
  marka?: string;
  brand?: string;
  createdAt?: string;
  tarih?: string;
  scannedAt?: string;
}

const TIER_LABELS: Record<string, string> = {
  ucretsiz: "Ücretsiz",
  ekonomik: "Ekonomik",
  orta: "Orta",
  seckin: "Seçkin",
  free: "Ücretsiz",
  guest: "Misafir",
};

const TIER_COLORS: Record<string, string> = {
  ucretsiz: "#94A3B8",
  ekonomik: "#6BA3A0",
  orta: "#C5847A",
  seckin: "#B87333",
  free: "#94A3B8",
  guest: "#CBD5E1",
};

// ── Gated özellik bileşenleri — paylaşılan dosyadan ──────────────────────
import { GatedFeatureModal, type GatedFeatureKey } from "@/components/GatedFeatureModal";

// ── Tek bir menü satırı ────────────────────────────────────────────────────

function MenuRow({
  icon,
  label,
  onPress,
  iconColor,
  iconBg,
  danger,
  badge,
  last,
  isDark,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  iconColor: string;
  iconBg: string;
  danger?: boolean;
  badge?: string | number;
  last?: boolean;
  isDark: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const textColor = danger ? "#DC2626" : colors.text;
  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.72}
      style={[
        s.menuRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#EDE8E0" },
      ]}
    >
      <View style={[s.menuRowIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon as any} size={17} color={iconColor} />
      </View>
      <Text style={[s.menuRowLabel, { color: textColor }]}>{label}</Text>
      {badge != null && (
        <View style={s.menuRowBadge}>
          <Text style={s.menuRowBadgeText}>{badge}</Text>
        </View>
      )}
      <Feather name="chevron-right" size={16} color={danger ? "#FCA5A5" : (isDark ? "#374151" : "#C4B9AA")} />
    </TouchableOpacity>
  );
}

// ── Bölüm sarmalayıcısı ────────────────────────────────────────────────────

function MenuSection({
  children,
  isDark,
  colors,
}: {
  children: React.ReactNode;
  isDark: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[s.section, {
      backgroundColor: isDark ? "#1A1612" : "#FFFCF8",
      borderColor: isDark ? "rgba(184,115,51,0.18)" : "rgba(184,115,51,0.16)",
    }]}>
      {children}
    </View>
  );
}

// ── DisclaimerCard (küçük versiyon) ──────────────────────────────────────

function DisclaimerRow({ onPress, isDark, colors }: { onPress: () => void; isDark: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.72}
      style={[s.menuRow, { borderBottomWidth: 0 }]}
    >
      <View style={[s.menuRowIcon, { backgroundColor: isDark ? "#1C1208" : "#FFF7ED" }]}>
        <Feather name="file-text" size={17} color="#EA580C" />
      </View>
      <Text style={[s.menuRowLabel, { color: isDark ? "#FED7AA" : "#9A3412" }]}>
        Kullanım Koşulları & Gizlilik
      </Text>
      <Feather name="chevron-right" size={16} color={isDark ? "#92400E" : "#FDBA74"} />
    </TouchableOpacity>
  );
}

// ── Ana ekran ─────────────────────────────────────────────────────────────

export default function ProfilScreen() {
  const colors = useColors();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const ph = getPremiumHeroColors(isDark);
  const insets = useSafeAreaInsets();
  const { user, logout, loading: authLoading, getAuthHeaders, effectiveRole } = useAuth();
  const { preferences, setAllergies, setSpecialConditions } = useUserPreferences();
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [histLoading, setHistLoading] = useState<boolean>(false);
  const [gatedModal, setGatedModal] = useState<GatedFeatureKey | null>(null);

  const canAllergyFilter  = canUseAllergyFilter(user ?? undefined);
  const canPremiumModules = canUsePremiumModules(user ?? undefined);
  const _memberInfo        = getMembershipInfo(effectiveRole);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : 0;

  // ── İnceleme Geçmişi sayacı — TEK KAYNAK: AsyncStorage local history ──
  // Bug: önceden /api/me/history endpoint'inden okunuyordu; ancak gerçek
  // "İnceleme Geçmişim" sayfası (app/(tabs)/gecmis/index.tsx) cihaz-yerel
  // AsyncStorage'tan (lib/localHistory.ts) okuyor. İki ayrı kaynak →
  // Profile sayacı her zaman 0 (endpoint boş ya da auth başarısız).
  // Fix: aynı kaynağı kullan; useFocusEffect ile odak geri geldiğinde
  // (kullanıcı geçmişe gidip dönerse, ya da yeni ürün incelerse) tazele.
  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const items = await getLocalHistory();
      setHistoryCount(items.length);
    } catch {
      setHistoryCount(0);
    } finally {
      setHistLoading(false);
    }
  }, []);

  // PERF — Phase A fix pack: çift fetch path'i kaldırıldı.
  // Önceki: useEffect (mount'ta) + useFocusEffect (focus'ta) İKİSİ DE
  // fetchHistory tetikliyordu → ilk açılışta `getLocalHistory()` 2 kez
  // çağrılıyordu (mount sonrası anında focus). useFocusEffect mount'tan
  // hemen sonra ZATEN tetiklendiği için tek başına yeterli.
  // Geri alma: aşağıdaki useFocusEffect'in üstüne `useEffect(() => { fetchHistory(); }, [fetchHistory]);` ekle.
  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  // ── PERF — Profil tap latency fix (Mayıs 2026) ───────────────────────────
  // Sebep: useUserPreferences() consumer'ları (Home/(tabs)/(home)/index.tsx,
  //   components/ProductCard.tsx, components/ProductHeroCard.tsx) tab
  //   navigator tarafından mount tutuluyor. Profilde bir chip/toggle basışı
  //   context preferences'ı değiştirince, gizli Home sekmesindeki yüzlerce
  //   ProductCard reconcile oluyor → JS thread 3-4 sn bloke → tap görsel
  //   feedback'i geç algılanıyor.
  // Çözüm (additive, Home'a hiç dokunmadan):
  //   1) Profil ekranında local mirror state tut → tap anında SADECE bu
  //      ekran re-render olur (~milisaniye). Visual selected/deselected
  //      anında değişir.
  //   2) Gerçek context güncellemesini InteractionManager.runAfterInteractions
  //      içinde + 250 ms debounce ile arka plana at → ardışık tap'ler tek
  //      save'e indirilir; Home reconcile'i ancak press lifecycle bittikten
  //      sonra olur (kullanıcı algılamaz).
  //   3) Dış kanaldan (alerji-listesi, profil-kur, hydration) preferences
  //      değişirse useEffect ile local state senkronlanır.
  //   4) Haptics tap'in EN BAŞINA alındı (öncesinde await sonrası vardı).
  const [localAllergies, setLocalAllergies] = useState<AllergyKey[]>(preferences.allergies);
  const [localConditions, setLocalConditions] = useState<SpecialConditionKey[]>(preferences.specialConditions);

  // Debounce timerları + son hedef snapshot — ardışık tap'leri tek context
  // yazımına çevirir. Ekran unmount olursa pending save flush edilir.
  const allergiesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conditionsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAllergiesRef = useRef<AllergyKey[] | null>(null);
  const pendingConditionsRef = useRef<SpecialConditionKey[] | null>(null);

  // ── In-flight koruma (architect feedback c) ──────────────────────────────
  // Sebep: context save başarısız olursa UserPreferencesProvider içeriği eski
  // snapshot'a rollback eder. Eğer bu rollback'i koşulsuz olarak local
  // mirror'a yansıtırsak, kullanıcının son tap intent'i ekranda kaybolur
  // (chip seçimi geri "atılmış" gibi görünür). Bu yüzden:
  //   - inFlight*Ref: ilk tap anında true → save settle olana kadar local
  //     state context'ten BAĞIMSIZ (kullanıcı intent'i source of truth).
  //   - settle (success/fail) sonrasında 50ms grace → sonra sync yeniden
  //     açılır → dış kanaldan (alerji-listesi, profil-kur, hydration) gelen
  //     değişiklikler local'e yansır.
  const inFlightAllergiesRef = useRef(false);
  const inFlightConditionsRef = useRef(false);

  // ── Op-id race guard (architect feedback round 2) ────────────────────────
  // Eski tap'in setTimeout(release) callback'i yeni tap'in in-flight
  // window'unda flag'i prematür false yapabiliyordu. Çözüm: her tap kendi
  // monoton op-id'sini alır; finally içinde release ANCAK bu op-id hâlâ
  // en güncelse uygulanır. Aksi halde yeni tap kendi finally'sinde release
  // edecek. Pending release timer'ları da temizlenir.
  const allergiesOpIdRef = useRef(0);
  const conditionsOpIdRef = useRef(0);
  const allergiesReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conditionsReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Context → local sync (yalnızca in-flight değilken; dış kanaldan gelen
  // gerçek değişiklikleri yansıtır, fail-rollback'leri filtreler).
  useEffect(() => {
    if (inFlightAllergiesRef.current) return;
    setLocalAllergies(preferences.allergies);
  }, [preferences.allergies]);
  useEffect(() => {
    if (inFlightConditionsRef.current) return;
    setLocalConditions(preferences.specialConditions);
  }, [preferences.specialConditions]);

  const flushAllergies = useCallback(() => {
    if (allergiesSaveTimerRef.current) {
      clearTimeout(allergiesSaveTimerRef.current);
      allergiesSaveTimerRef.current = null;
    }
    const target = pendingAllergiesRef.current;
    pendingAllergiesRef.current = null;
    if (target) {
      const myOp = allergiesOpIdRef.current; // bu flush'a bağlı son tap'in id'si
      // setAllergies optimistic — başarısız olursa provider context'i rollback
      // eder; in-flight guard sayesinde rollback local UI'ı clobber etmez,
      // kullanıcı intent'i ekranda korunur.
      setAllergies(target)
        .catch(() => {})
        .finally(() => {
          // Stale completion: yeni tap bizi superseded etti — hiçbir şey
          // yapma. Yeni op'un finally'si release'i kendisi yönetecek. Bu
          // kontrol stale'in newer release timer'ını clear etme yarışını
          // tamamen elimine eder.
          if (allergiesOpIdRef.current !== myOp) return;
          if (allergiesReleaseTimerRef.current) {
            clearTimeout(allergiesReleaseTimerRef.current);
            allergiesReleaseTimerRef.current = null;
          }
          allergiesReleaseTimerRef.current = setTimeout(() => {
            allergiesReleaseTimerRef.current = null;
            if (allergiesOpIdRef.current === myOp) {
              inFlightAllergiesRef.current = false;
            }
          }, 50);
        });
    } else if (allergiesOpIdRef.current === 0 || pendingAllergiesRef.current === null) {
      // Hiç pending yoksa ve flush boş çağrıldıysa flag güvenle false
      inFlightAllergiesRef.current = false;
    }
  }, [setAllergies]);

  const flushConditions = useCallback(() => {
    if (conditionsSaveTimerRef.current) {
      clearTimeout(conditionsSaveTimerRef.current);
      conditionsSaveTimerRef.current = null;
    }
    const target = pendingConditionsRef.current;
    pendingConditionsRef.current = null;
    if (target) {
      const myOp = conditionsOpIdRef.current;
      setSpecialConditions(target)
        .catch(() => {})
        .finally(() => {
          if (conditionsOpIdRef.current !== myOp) return;
          if (conditionsReleaseTimerRef.current) {
            clearTimeout(conditionsReleaseTimerRef.current);
            conditionsReleaseTimerRef.current = null;
          }
          conditionsReleaseTimerRef.current = setTimeout(() => {
            conditionsReleaseTimerRef.current = null;
            if (conditionsOpIdRef.current === myOp) {
              inFlightConditionsRef.current = false;
            }
          }, 50);
        });
    } else if (conditionsOpIdRef.current === 0 || pendingConditionsRef.current === null) {
      inFlightConditionsRef.current = false;
    }
  }, [setSpecialConditions]);

  // Unmount / blur → bekleyen yazımı flush et
  useEffect(() => {
    return () => {
      flushAllergies();
      flushConditions();
    };
  }, [flushAllergies, flushConditions]);

  const toggleAllergy = useCallback((key: AllergyKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inFlightAllergiesRef.current = true;
    // Yeni tap → op-id ilerle; eski release timer'ları iptal et
    allergiesOpIdRef.current += 1;
    if (allergiesReleaseTimerRef.current) {
      clearTimeout(allergiesReleaseTimerRef.current);
      allergiesReleaseTimerRef.current = null;
    }
    setLocalAllergies((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      pendingAllergiesRef.current = next;
      if (allergiesSaveTimerRef.current) clearTimeout(allergiesSaveTimerRef.current);
      // Touch animasyonu bitsin → sonra Home reconcile'ini başlat
      allergiesSaveTimerRef.current = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          flushAllergies();
        });
      }, 250);
      return next;
    });
  }, [flushAllergies]);

  const toggleCondition = useCallback((key: SpecialConditionKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    inFlightConditionsRef.current = true;
    conditionsOpIdRef.current += 1;
    if (conditionsReleaseTimerRef.current) {
      clearTimeout(conditionsReleaseTimerRef.current);
      conditionsReleaseTimerRef.current = null;
    }
    setLocalConditions((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      pendingConditionsRef.current = next;
      if (conditionsSaveTimerRef.current) clearTimeout(conditionsSaveTimerRef.current);
      conditionsSaveTimerRef.current = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          flushConditions();
        });
      }, 250);
      return next;
    });
  }, [flushConditions]);

  const handleLogout = () => {
    Alert.alert("Çıkış Yap", "Hesabınızdan çıkmak istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
        },
      },
    ]);
  };

  if (authLoading) {
    return (
      <View style={[s.container, s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const effectiveRoleForDisplay = user
    ? (user.role === "seckin" && user.subscriptionStatus === "active" ? "seckin" : user.role)
    : "guest";
  const tierColor = user
    ? (TIER_COLORS[effectiveRoleForDisplay] ?? TIER_COLORS[user.tier ?? ""] ?? colors.textMuted)
    : colors.textMuted;
  const tierLabel = user
    ? (TIER_LABELS[effectiveRoleForDisplay] ?? TIER_LABELS[user.tier ?? ""] ?? user.role)
    : "";

  const avatarLetter = user
    ? (user.ad ?? user.email ?? user.username ?? "?").charAt(0).toLocaleUpperCase("tr-TR")
    : "?";

  // ── Misafir görünümü ─────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: botPad + 100 }]}
          {...({ delaysContentTouches: false } as any)}
        >
          <LinearGradient
            colors={ph.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.heroBand, { paddingTop: topPad + 20 }]}
          >
            <View style={s.decoCircle1} />
            <View style={s.decoCircle2} />
            <View style={s.heroGuest}>
              <View style={s.avatarRing}>
                <Feather name="user" size={36} color={PC.badgeBg} />
              </View>
              <Text style={[s.heroGuestTitle, { color: ph.heroText }]}>Cildim</Text>
              <Text style={[s.heroGuestSub, { color: ph.heroMuted }]}>Şahsi cilt bakım asistanınız</Text>
              <TouchableOpacity
                style={s.heroLoginBtn}
                onPress={() => router.push("/giris")}
              >
                <Feather name="log-in" size={16} color={PC.badgeBg} />
                <Text style={[s.heroLoginBtnText, { color: PC.badgeBg }]}>Giriş Yap / Kayıt Ol</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={s.content}>

            {/* ── Açık erişim ── */}
            <Text style={[s.sectionLabel, { color: colors.textMuted }]}>ÜCRETSİZ ERİŞİM</Text>
            <MenuSection isDark={isDark} colors={colors}>
              <MenuRow
                icon="heart" label="Ürünleri favorilere ekle"
                onPress={() => router.push("/favoriler")}
                iconColor="#DC2626" iconBg={isDark ? "#2D1212" : "#FFF0F0"}
                isDark={isDark} colors={colors}
              />
              <MenuRow
                icon="file-text" label="Kullanım Koşulları & Gizlilik"
                onPress={() => router.push("/sozlesme")}
                iconColor="#EA580C" iconBg={isDark ? "#1C1208" : "#FFF7ED"}
                last isDark={isDark} colors={colors}
              />
            </MenuSection>

            {/* ── Giriş gerektiren özellikler ── */}
            <Text style={[s.sectionLabel, { color: colors.textMuted }]}>GİRİŞ GEREKTİREN ÖZELLİKLER</Text>
            <View style={[s.section, {
              backgroundColor: isDark ? "#1A1612" : "#FFFCF8",
              borderColor: isDark ? "rgba(184,115,51,0.18)" : "rgba(184,115,51,0.16)",
            }]}>
              {([
                { key: "rutin",       icon: "list",          label: "Şahsi Cilt Rutini",            color: "#7A8F6B", bg: isDark ? "#1E2D18" : "#EAF1EA" },
                { key: "raporlar",    icon: "bar-chart-2",   label: "Bakım Profillerim",            color: "#C8A97E", bg: isDark ? "#1E1408" : "#FFF7ED" },
                { key: "dermosistan", icon: "message-circle",label: "DermoAsistan (Seçkin)",         color: "#2563EB", bg: isDark ? "#0F1A2E" : "#EFF6FF", premium: true },
                { key: "analiz",      icon: "aperture",      label: "Cilt Bakım Profili (Seçkin)",   color: "#7C3AED", bg: isDark ? "#1A0F2E" : "#F5F3FF", premium: true },
              ] as { key: GatedFeatureKey; icon: string; label: string; color: string; bg: string; premium?: boolean }[]).map((f, i, arr) => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setGatedModal(f.key); }}
                  activeOpacity={0.72}
                  style={[
                    s.menuRow,
                    i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#EDE8E0" },
                  ]}
                >
                  <View style={[s.menuRowIcon, { backgroundColor: f.bg }]}>
                    <Feather name={f.icon as any} size={17} color={f.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.menuRowLabel, { color: colors.text }]}>{f.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                      {f.premium ? "Seçkin · Giriş gerekli" : "Giriş gerekli"}
                    </Text>
                  </View>
                  <Feather name="lock" size={13} color={isDark ? "#374151" : "#C4B9AA"} style={{ marginRight: 2 }} />
                  <Feather name="chevron-right" size={16} color={isDark ? "#374151" : "#C4B9AA"} />
                </TouchableOpacity>
              ))}
            </View>

          </View>
        </ScrollView>

        {/* ── Gated modal ── */}
        <GatedFeatureModal featureKey={gatedModal} onClose={() => setGatedModal(null)} />

      </View>
    );
  }

  // ── Üye görünümü ──────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: botPad + 100 }]}
        {...({ delaysContentTouches: false } as any)}
      >

        {/* ── Premium Hero ── */}
        <LinearGradient
          colors={ph.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.heroBand, { paddingTop: topPad + 20 }]}
        >
          <View style={s.decoCircle1} />
          <View style={s.decoCircle2} />

          <View style={s.heroUser}>
            {/* Avatar */}
            <View style={s.avatarRing}>
              <Text style={[s.avatarLetter, { color: PC.badgeBg }]}>{avatarLetter}</Text>
            </View>

            {/* İsim + üyelik rozeti */}
            <View style={s.heroInfo}>
              <Text style={[s.heroName, { color: ph.heroText }]}>
                {user.ad ?? user.email ?? user.username ?? "Kullanıcı"}
              </Text>
              <View style={[s.tierPill, { backgroundColor: `${tierColor}22`, borderColor: ph.borderPill }]}>
                <View style={[s.tierDot, { backgroundColor: tierColor }]} />
                <Text style={[s.tierPillText, { color: ph.heroText }]}>{tierLabel}</Text>
              </View>
            </View>

            {/* İstatistik satırı — her ikisi de tıklanabilir */}
            <View style={[s.heroStats, { backgroundColor: ph.statsGlass }]}>
              <TouchableOpacity
                style={s.heroStat}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/gecmis"); }}
                activeOpacity={0.75}
              >
                {histLoading
                  ? <ActivityIndicator size="small" color={ph.heroText} />
                  : <Text style={[s.heroStatNum, { color: ph.heroText }]}>{historyCount}</Text>
                }
                <Text style={[s.heroStatLabel, { color: ph.heroMuted }]}>İnceleme Geçmişim</Text>
              </TouchableOpacity>

              <View style={[s.heroStatDiv, { backgroundColor: ph.divider }]} />

              <TouchableOpacity
                style={s.heroStat}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/favoriler"); }}
                activeOpacity={0.75}
              >
                <Feather name="heart" size={22} color={PC.accent} />
                <Text style={[s.heroStatLabel, { color: ph.heroMuted }]}>Favoriler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <View style={s.content}>

          {/* Seçkin yükseltme bandı */}
          {(user.role === "free" || user.tier === "ucretsiz") && (
            <TouchableOpacity
              style={[s.upgradeBanner, {
                backgroundColor: isDark ? "#1C1208" : "#FFF8F0",
                borderColor: PC.accent,
              }]}
              onPress={() => router.push("/uyelik")}
              activeOpacity={0.85}
            >
              <Feather name="star" size={20} color={PC.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.upgradeTitle, { color: isDark ? "#F5D9A8" : "#92400E" }]}>
                  Seçkin üyeliğe yüksel
                </Text>
                <Text style={[s.upgradeDesc, { color: PC.accent }]}>Cilt bakım profili & tam rutin — ₺125/ay</Text>
              </View>
              <Feather name="chevron-right" size={16} color={PC.accent} />
            </TouchableOpacity>
          )}

          {/* ── Şahsi Cilt Merkezi ──
              Profile menu cleanup: Şahsi Rutinim removed (bottom tab Rutin),
              DermoAsistan / Cilt Anketi / Favoriler list-row removed (kept
              accessible via Home shortcuts / questionnaire flow / bottom tab).
              Cilt Analizi + İnceleme Geçmişim moved up into bu bölüme. */}
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>ŞAHSİ CİLT MERKEZİ</Text>
          <MenuSection isDark={isDark} colors={colors}>
            <MenuRow
              icon="aperture" label="Cilt Bakım Profili"
              onPress={() => router.push("/premium-skin-scan-v2" as any)}
              iconColor="#7C3AED" iconBg={isDark ? "#1A0F2E" : "#F5F3FF"}
              isDark={isDark} colors={colors}
            />
            <MenuRow
              icon="bar-chart-2" label="Bakım Profillerim"
              onPress={() => router.push("/cilt-raporlari" as any)}
              iconColor="#C8A97E" iconBg={isDark ? "#1E1408" : "#FFF7ED"}
              isDark={isDark} colors={colors}
            />
            <MenuRow
              icon="clock" label="İnceleme Geçmişim"
              onPress={() => router.push("/gecmis")}
              iconColor="#0891B2" iconBg={isDark ? "#061620" : "#ECFEFF"}
              badge={historyCount > 0 ? historyCount : undefined}
              last isDark={isDark} colors={colors}
            />
          </MenuSection>

          {/* ── Şahsi Bilgiler ── */}
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>ŞAHSİ BİLGİLER</Text>

          {/* Alerji Filtreleri */}
          {!canAllergyFilter ? (
            <View style={[s.section, {
              backgroundColor: isDark ? "#1A1612" : "#FFFCF8",
              borderColor: isDark ? "rgba(184,115,51,0.18)" : "rgba(184,115,51,0.16)",
            }]}>
              <View style={s.menuRow}>
                <View style={[s.menuRowIcon, { backgroundColor: isDark ? "#1E2D18" : "#EAF1EA" }]}>
                  <Feather name="shield" size={17} color="#7A8F6B" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[s.menuRowLabel, { color: colors.text }]}>Alerji Filtreleri</Text>
                  <Text style={[s.menuRowSub, { color: colors.textMuted }]}>
                    Üye olun, alerjilerinizi kaydedin
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/giris")}
                  style={[s.inlineBtn, { backgroundColor: "#6B7F5D" }]}
                >
                  <Text style={s.inlineBtnText}>Üye Ol</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[s.section, {
              backgroundColor: isDark ? "#1A1612" : "#FFFCF8",
              borderColor: isDark ? "rgba(184,115,51,0.18)" : "rgba(184,115,51,0.16)",
            }]}>
              <View style={[s.filterHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#EDE8E0" }]}>
                <View style={[s.menuRowIcon, { backgroundColor: isDark ? "#1E1408" : "#FFF7ED" }]}>
                  <Feather name="shield" size={17} color={PC.accent} />
                </View>
                <Text style={[s.menuRowLabel, { color: colors.text }]}>Alerji Etiketlerim</Text>
              </View>
              <View style={s.allergyTagGrid}>
                {(Object.entries(ALLERGY_LABELS) as [AllergyKey, string][]).map(([key, label]) => {
                  const active = localAllergies.includes(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => toggleAllergy(key)}
                      activeOpacity={0.75}
                      style={[
                        s.allergyTag,
                        active
                          ? { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }
                          : { backgroundColor: isDark ? "#1A1612" : "#F5F0E8", borderColor: isDark ? "rgba(184,115,51,0.2)" : "#E2D9CC" },
                      ]}
                    >
                      {active && <Feather name="x-circle" size={11} color="#B91C1C" />}
                      <Text style={[
                        s.allergyTagText,
                        { color: active ? "#B91C1C" : colors.textSecondary },
                      ]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[s.linkRow, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "#EDE8E0" }]}
                onPress={() => router.push("/alerji-listesi")}
                activeOpacity={0.8}
              >
                <Feather name="edit-3" size={14} color={PC.accent} />
                <Text style={[s.linkRowText, { color: PC.accent }]}>Özel İçerik Listemi Düzenle</Text>
                <Feather name="chevron-right" size={14} color={PC.accent} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sağlık Halim */}
          {!canPremiumModules ? (
            <PremiumLockCard
              title="Sağlık Bilgilerim"
              description="Hamilelik ve emzirme bilginizi ekleyerek ürün güvenliğini şahsileştirin."
              features={[
                "Hamilelik uyumsuzluğu uyarısı",
                "Emzirme döneminde güvenli ürün tespiti",
                "DermoAsistan derin analizi",
              ]}
            />
          ) : (
            <View style={[s.section, {
              backgroundColor: isDark ? "#1A1612" : "#FFFCF8",
              borderColor: isDark ? "rgba(184,115,51,0.18)" : "rgba(184,115,51,0.16)",
            }]}>
              <View style={[s.filterHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#EDE8E0" }]}>
                <View style={[s.menuRowIcon, { backgroundColor: isDark ? "#1E1408" : "#FFF7ED" }]}>
                  <Feather name="activity" size={17} color={PC.accent} />
                </View>
                <Text style={[s.menuRowLabel, { color: colors.text }]}>Sağlık Halim</Text>
              </View>
              {(["pregnancy", "breastfeeding"] as SpecialConditionKey[]).map((key, i, arr) => {
                const active = localConditions.includes(key);
                const label  = SPECIAL_CONDITION_LABELS[key];
                const icon: any   = key === "pregnancy" ? "heart" : "sun";
                const activeColor = key === "pregnancy" ? "#7C3AED" : "#0891B2";
                const activeBg    = key === "pregnancy" ? "#F5F3FF" : "#ECFEFF";
                const activeBorder = key === "pregnancy" ? "#C4B5FD" : "#A5F3FC";
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => toggleCondition(key)}
                    activeOpacity={0.8}
                    style={[
                      s.healthRow,
                      i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "#EDE8E0" },
                      {
                        backgroundColor: active ? activeBg : "transparent",
                        borderColor: active ? activeBorder : "transparent",
                      },
                    ]}
                  >
                    <View style={[s.menuRowIcon, { backgroundColor: active ? `${activeColor}20` : (isDark ? "#1F1A12" : "#F5F0E8") }]}>
                      <Feather name={icon} size={17} color={active ? activeColor : colors.textMuted} />
                    </View>
                    <Text style={[s.menuRowLabel, { color: active ? activeColor : colors.text }]}>{label}</Text>
                    <View style={[s.toggle, { backgroundColor: active ? activeColor : (isDark ? "#374151" : "#D1C9BC") }]}>
                      <View style={[s.toggleThumb, { transform: [{ translateX: active ? 14 : 0 }] }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={[s.healthDisclaimer, { color: colors.textMuted }]}>
                Bu seçimler tıbbi tavsiye değildir. Bir uzmana danışmanızı öneririz.
              </Text>
            </View>
          )}

          {/* ── HESAP ── (Ayarlar profile menu cleanup sonrası buraya taşındı) */}
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>HESAP</Text>
          <MenuSection isDark={isDark} colors={colors}>
            <MenuRow
              icon="settings" label="Ayarlar"
              onPress={() => router.push("/ayarlar")}
              iconColor="#64748B" iconBg={isDark ? "#131A22" : "#F1F5F9"}
              last isDark={isDark} colors={colors}
            />
          </MenuSection>

          {/* ── ADMİN: Sadece admin email görür ── */}
          {isAdminUser(user) && (
            <>
              <Text style={[s.sectionLabel, { color: colors.textMuted }]}>ADMİN</Text>
              <MenuSection isDark={isDark} colors={colors}>
                <MenuRow
                  icon="inbox" label="Ürün Önerileri"
                  onPress={() => router.push("/admin/product-suggestions" as any)}
                  iconColor="#B87333" iconBg={isDark ? "#1E1408" : "#FFF7ED"}
                  last isDark={isDark} colors={colors}
                />
              </MenuSection>
            </>
          )}

          {/* ── Yasal & Çıkış ── */}
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>YASAL</Text>
          <MenuSection isDark={isDark} colors={colors}>
            <DisclaimerRow onPress={() => router.push("/sozlesme")} isDark={isDark} colors={colors} />
          </MenuSection>

          <TouchableOpacity
            style={[s.logoutBtn, {
              backgroundColor: isDark ? "rgba(220,38,38,0.08)" : "#FFF0F0",
              borderColor: isDark ? "rgba(220,38,38,0.2)" : "#FECACA",
            }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={18} color="#DC2626" />
            <Text style={[s.logoutText, { color: "#DC2626" }]}>Çıkış Yap</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", flex: 1 },
  scroll: {},

  // Hero
  heroBand: { paddingHorizontal: 24, paddingBottom: 36, overflow: "hidden" },
  decoCircle1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.07)", top: -60, right: -40,
  },
  decoCircle2: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -30, left: -20,
  },

  heroGuest: { alignItems: "center", gap: 10 },
  heroGuestTitle: { fontSize: 22, fontWeight: "800" as const, marginTop: 4 },
  heroGuestSub: { fontSize: 14, textAlign: "center" },
  heroLoginBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 20, marginTop: 6,
  },
  heroLoginBtnText: { fontSize: 15, fontWeight: "700" as const },

  heroUser: { gap: 14 },
  avatarRing: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center", alignSelf: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  avatarLetter: { fontSize: 32, fontWeight: "800" as const },
  heroInfo: { alignItems: "center", gap: 8 },
  heroName: { fontSize: 20, fontWeight: "800" as const, textAlign: "center" },
  tierPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierPillText: { fontSize: 12, fontWeight: "700" as const },

  heroStats: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 24,
    gap: 24, marginTop: 4,
  },
  heroStat: { alignItems: "center", gap: 4 },
  heroStatNum: { fontSize: 24, fontWeight: "800" as const },
  heroStatLabel: { fontSize: 11, fontWeight: "600" as const, textAlign: "center" },
  heroStatDiv: { width: 1, height: 36 },

  // Content
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionLabel: {
    fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8,
    marginTop: 6, marginBottom: 6, marginLeft: 4,
  },

  // Section wrapper
  section: {
    borderRadius: 18, borderWidth: 1, overflow: "hidden",
  },

  // Menu row
  menuRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  menuRowIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  menuRowLabel: { flex: 1, fontSize: 15, fontWeight: "600" as const },
  menuRowSub: { fontSize: 12, marginTop: 1 },
  menuRowBadge: {
    backgroundColor: "#B87333",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginRight: 4,
  },
  menuRowBadgeText: { fontSize: 11, fontWeight: "700" as const, color: "#fff" },

  // Upgrade banner
  upgradeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 18, borderWidth: 1.5, padding: 14,
  },
  upgradeTitle: { fontSize: 14, fontWeight: "700" as const },
  upgradeDesc: { fontSize: 12, marginTop: 1 },

  // Filter
  filterHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  allergyTagGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  allergyTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1,
  },
  allergyTagText: { fontSize: 12, fontWeight: "600" as const },
  linkRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkRowText: { flex: 1, fontSize: 13, fontWeight: "600" as const },

  // Health
  healthRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 0, borderWidth: 0,
  },
  toggle: { width: 36, height: 22, borderRadius: 11, justifyContent: "center", padding: 2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  healthDisclaimer: {
    fontSize: 11, paddingHorizontal: 14, paddingBottom: 12, lineHeight: 15,
  },

  // Inline btn
  inlineBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
  },
  inlineBtnText: { fontSize: 12, fontWeight: "700" as const, color: "#fff" },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 18, borderWidth: 1, padding: 14, gap: 10,
    marginTop: 4, marginBottom: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "600" as const },
});