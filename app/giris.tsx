import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ManolyaEmblem from "@/components/ManolyaEmblem";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useColors } from "@/hooks/useColors";
import { getTermsAccepted, setTermsAccepted } from "@/lib/termsStore";

type Mode = "giris" | "kayit";

const APPLE_VISIBLE = Platform.OS === "ios";

// ECZ4 / APPLE SIGN-IN PHASE A — geçici güvenli mod.
// Apple Developer onayı sonrası native Apple Sign-In tamamlanınca
// sosyal girişler (Google + Apple) yeniden açılacak. Auth altyapısı,
// handleSocial / loginWithProvider / signInWithProvider fonksiyonları
// dokunulmadan korundu; yalnız render katmanında butonlar gizlendi.
const SOCIAL_LOGIN_VISIBLE = false;

export default function GirisScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithPassword, signUpWithPassword, loginWithProvider } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [mode, setMode] = useState<Mode>("giris");

  // --- Giriş state ---
  const [girisEmail, setGirisEmail] = useState("");
  const [girisPass, setGirisPass] = useState("");
  const [girisPassVisible, setGirisPassVisible] = useState(false);

  // --- Kayıt state ---
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [kayitEmail, setKayitEmail] = useState("");
  const [kayitPass, setKayitPass] = useState("");
  const [kayitPassVisible, setKayitPassVisible] = useState(false);
  const [kayitPassConfirm, setKayitPassConfirm] = useState("");
  const [kayitPassConfirmVisible, setKayitPassConfirmVisible] = useState(false);
  const [kullanımOnay, setKullanımOnay] = useState(false);
  const [gizlilikOnay, setGizlilikOnay] = useState(false);

  // --- Shared state ---
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    getTermsAccepted().then((accepted) => {
      if (accepted) {
        setKullanımOnay(true);
        setGizlilikOnay(true);
      }
    });
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccessMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleGiris = async () => {
    if (!girisEmail.includes("@")) { setError("Geçerli bir e-posta adresi girin"); return; }
    if (girisPass.length < 6) { setError("Şifre en az 6 karakter olmalıdır"); return; }
    setLoading(true);
    setError(null);
    try {
      await loginWithPassword(girisEmail.trim(), girisPass);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/profil");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg: string = e.message ?? "";
      if (msg.includes("Invalid login")) setError("E-posta veya şifre hatalı");
      else if (msg.includes("Email not confirmed")) setError("E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin veya yeni hesap oluşturun.");
      else setError(msg || "Giriş yapılamadı");
    } finally {
      setLoading(false);
    }
  };

  const handleKayit = async () => {
    if (!ad.trim()) { setError("Adınızı girin"); return; }
    if (!soyad.trim()) { setError("Soyadınızı girin"); return; }
    if (!kayitEmail.includes("@")) { setError("Geçerli bir e-posta adresi girin"); return; }
    if (kayitPass.length < 6) { setError("Şifre en az 6 karakter olmalıdır"); return; }
    if (kayitPass !== kayitPassConfirm) { setError("Şifreler eşleşmiyor"); return; }
    if (!kullanımOnay) { setError("Kullanım Koşullarını kabul etmelisiniz"); return; }
    if (!gizlilikOnay) { setError("Gizlilik Politikasını kabul etmelisiniz"); return; }
    setLoading(true);
    setError(null);
    try {
      await signUpWithPassword(ad.trim(), soyad.trim(), kayitEmail.trim(), kayitPass);
      await setTermsAccepted();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate immediately — email verification is optional and done lazily at premium gates
      router.replace("/(tabs)/profil");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg: string = e.message ?? "";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        setError("Bu e-posta adresi zaten kayıtlı");
      } else if (msg.includes("password")) {
        setError("Şifre çok zayıf, daha güçlü bir şifre seçin");
      } else {
        setError(msg || "Kayıt olunamadı");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocial = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    setError(null);
    try {
      await loginWithProvider(provider);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/profil");
    } catch (e: any) {
      if (e.message !== "cancel") {
        setError(e.message || "Giriş yapılamadı");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const toggleCheck = (
    val: boolean,
    setter: (v: boolean) => void
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter(!val);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: topPad + 8, paddingBottom: botPad + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Kapat butonu */}
        <TouchableOpacity
          style={[s.closeBtn, { backgroundColor: colors.surfaceCard }]}
          onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={s.logoRow}>
          <View style={[s.logoBox, { backgroundColor: "#F5EDD6" }]}>
            <ManolyaEmblem size={44} />
          </View>
          <Text style={[s.appName, { color: "#A0522D" }]}>Cildim</Text>
          <Text style={[s.tagline, { color: colors.textSecondary }]}>
            Cilt bakımınızın akıllı rehberi
          </Text>
        </View>

        {/* Tab seçici */}
        <View style={[s.tabRow, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[s.tab, mode === "giris" && { backgroundColor: "#C5847A" }]}
            onPress={() => switchMode("giris")}
          >
            <Text style={[s.tabText, { color: mode === "giris" ? "#fff" : colors.textSecondary }]}>
              Giriş Yap
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, mode === "kayit" && { backgroundColor: "#C5847A" }]}
            onPress={() => switchMode("kayit")}
          >
            <Text style={[s.tabText, { color: mode === "kayit" ? "#fff" : colors.textSecondary }]}>
              Kayıt Ol
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hata / Başarı */}
        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : successMsg ? (
          <View style={s.successBox}>
            <Ionicons name="checkmark-circle" size={16} color="#7A8F6B" />
            <Text style={s.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* ─── GİRİŞ FORMU ─── */}
        {mode === "giris" && (
          <View style={s.form}>
            <LabeledInput
              label="E-posta"
              value={girisEmail}
              onChangeText={(t) => { setGirisEmail(t); setError(null); }}
              placeholder="ornek@mail.com"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              colors={colors}
            />
            <LabeledInput
              label="Şifre"
              value={girisPass}
              onChangeText={(t) => { setGirisPass(t); setError(null); }}
              placeholder="••••••••"
              secureTextEntry={!girisPassVisible}
              autoComplete="current-password"
              trailingIcon={
                <TouchableOpacity onPress={() => setGirisPassVisible(!girisPassVisible)}>
                  <Ionicons name={girisPassVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              }
              colors={colors}
            />

            <PrimaryButton
              label="Giriş Yap"
              onPress={handleGiris}
              loading={loading}
              color="#C5847A"
            />

            {SOCIAL_LOGIN_VISIBLE && (
              <>
                <Divider label="veya" />

                <SocialButton
                  label="Google ile Giriş"
                  onPress={() => handleSocial("google")}
                  loading={socialLoading === "google"}
                  icon="logo-google"
                  iconColor="#EA4335"
                  bgColor="#FFF3F2"
                  borderColor="#FECACA"
                  textColor="#B91C1C"
                />

                {APPLE_VISIBLE && (
                  <SocialButton
                    label="Apple ile Giriş"
                    onPress={() => handleSocial("apple")}
                    loading={socialLoading === "apple"}
                    icon="logo-apple"
                    iconColor="#000"
                    bgColor="#F8F8F8"
                    borderColor="#D1D5DB"
                    textColor="#111827"
                  />
                )}
              </>
            )}

            <TouchableOpacity style={s.forgotRow} onPress={() => switchMode("kayit")}>
              <Text style={[s.forgotText, { color: colors.primary }]}>Hesabınız yok mu? Kayıt olun →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── KAYIT FORMU ─── */}
        {mode === "kayit" && (
          <View style={s.form}>
            <View style={s.nameRow}>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  label="Ad"
                  value={ad}
                  onChangeText={(t) => { setAd(t); setError(null); }}
                  placeholder="Adınız"
                  autoCapitalize="words"
                  autoComplete="given-name"
                  autoFocus
                  colors={colors}
                />
              </View>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  label="Soyad"
                  value={soyad}
                  onChangeText={(t) => { setSoyad(t); setError(null); }}
                  placeholder="Soyadınız"
                  autoCapitalize="words"
                  autoComplete="family-name"
                  colors={colors}
                />
              </View>
            </View>

            <LabeledInput
              label="E-posta"
              value={kayitEmail}
              onChangeText={(t) => { setKayitEmail(t); setError(null); }}
              placeholder="ornek@mail.com"
              autoCapitalize="none"
              autoComplete="email"
              colors={colors}
            />

            <LabeledInput
              label="Şifre"
              value={kayitPass}
              onChangeText={(t) => { setKayitPass(t); setError(null); }}
              placeholder="En az 6 karakter"
              secureTextEntry={!kayitPassVisible}
              autoComplete="new-password"
              trailingIcon={
                <TouchableOpacity onPress={() => setKayitPassVisible(!kayitPassVisible)}>
                  <Ionicons name={kayitPassVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              }
              colors={colors}
            />

            <LabeledInput
              label="Şifre (Tekrar)"
              value={kayitPassConfirm}
              onChangeText={(t) => { setKayitPassConfirm(t); setError(null); }}
              placeholder="Şifrenizi tekrar girin"
              secureTextEntry={!kayitPassConfirmVisible}
              autoComplete="new-password"
              trailingIcon={
                <TouchableOpacity onPress={() => setKayitPassConfirmVisible(!kayitPassConfirmVisible)}>
                  <Ionicons name={kayitPassConfirmVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              }
              colors={colors}
            />

            {/* Onay kutuları */}
            <View style={[s.termsCard, { backgroundColor: "#FFF8F6", borderColor: "#F0D0C8" }]}>
              <CheckRow
                checked={kullanımOnay}
                onToggle={() => toggleCheck(kullanımOnay, setKullanımOnay)}
                label="Kullanım Koşullarını okudum ve kabul ediyorum"
                onLabelPress={() => router.push("/sozlesme")}
                colors={colors}
              />
              <View style={[s.termsDivider, { backgroundColor: "#F0D0C8" }]} />
              <CheckRow
                checked={gizlilikOnay}
                onToggle={() => toggleCheck(gizlilikOnay, setGizlilikOnay)}
                label="Gizlilik Politikasını okudum ve kabul ediyorum"
                onLabelPress={() => router.push("/sozlesme")}
                colors={colors}
              />
            </View>

            <PrimaryButton
              label="Kayıt Ol"
              onPress={handleKayit}
              loading={loading}
              color="#C5847A"
              disabled={!kullanımOnay || !gizlilikOnay}
            />

            {SOCIAL_LOGIN_VISIBLE && (
              <>
                <Divider label="veya" />

                <SocialButton
                  label="Google ile Kayıt"
                  onPress={() => handleSocial("google")}
                  loading={socialLoading === "google"}
                  icon="logo-google"
                  iconColor="#EA4335"
                  bgColor="#FFF3F2"
                  borderColor="#FECACA"
                  textColor="#B91C1C"
                />

                {APPLE_VISIBLE && (
                  <SocialButton
                    label="Apple ile Kayıt"
                    onPress={() => handleSocial("apple")}
                    loading={socialLoading === "apple"}
                    icon="logo-apple"
                    iconColor="#000"
                    bgColor="#F8F8F8"
                    borderColor="#D1D5DB"
                    textColor="#111827"
                  />
                )}
              </>
            )}

            <TouchableOpacity style={s.forgotRow} onPress={() => switchMode("giris")}>
              <Text style={[s.forgotText, { color: colors.primary }]}>Zaten hesabınız var mı? Giriş yapın →</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Misafir Girişi */}
        <View style={{ alignItems: "center", marginTop: 20, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E5E0DC" }} />
            <Text style={{ fontSize: 12, color: "#A89490", fontWeight: "600" }}>ya da</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#E5E0DC" }} />
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace("/(tabs)" as any);
            }}
            activeOpacity={0.75}
            style={{
              paddingVertical: 13,
              paddingHorizontal: 32,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: "#D1C9C3",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Feather name="user" size={16} color="#8A7060" />
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#8A7060" }}>
              Misafir Olarak Devam Et
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 11, color: "#B0A098", marginTop: 8, textAlign: "center" }}>
            Giriş yapmadan ürünlere göz atabilirsiniz
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ──

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  trailingIcon?: React.ReactNode;
  autoComplete?: any;
  colors: any;
}

function LabeledInput({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize,
  autoFocus, secureTextEntry, trailingIcon, autoComplete, colors,
}: LabeledInputProps) {
  const isEmail = autoComplete === "email";
  return (
    <View style={s.inputGroup}>
      <Text style={[s.inputLabel, { color: colors.text }]}>{label}</Text>
      <View style={[s.inputWrap, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
        <TextInput
          style={[s.input, { color: colors.text, flex: 1 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={
            isEmail
              ? (Platform.OS === "web" ? "default" : "email-address")
              : (keyboardType ?? "default")
          }
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={false}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          secureTextEntry={secureTextEntry}
          spellCheck={false}
          {...(Platform.OS === "web" && isEmail
            ? ({ inputMode: "text", lang: "tr" } as any)
            : {})}
        />
        {trailingIcon ? <View style={s.inputTrailing}>{trailingIcon}</View> : null}
      </View>
    </View>
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading: boolean;
  color: string;
  disabled?: boolean;
}

function PrimaryButton({ label, onPress, loading, color, disabled }: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[s.primaryBtn, { backgroundColor: color }, (loading || disabled) && s.btnDim]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={s.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

interface SocialButtonProps {
  label: string;
  onPress: () => void;
  loading: boolean;
  icon: any;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

function SocialButton({ label, onPress, loading, icon, iconColor, bgColor, borderColor, textColor }: SocialButtonProps) {
  return (
    <TouchableOpacity
      style={[s.socialBtn, { backgroundColor: bgColor, borderColor }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={iconColor} size="small" />
        : <Ionicons name={icon} size={20} color={iconColor} />}
      <Text style={[s.socialBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View style={s.divRow}>
      <View style={s.divLine} />
      <Text style={s.divLabel}>{label}</Text>
      <View style={s.divLine} />
    </View>
  );
}

interface CheckRowProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  onLabelPress: () => void;
  colors: any;
}

function CheckRow({ checked, onToggle, label, onLabelPress, colors }: CheckRowProps) {
  return (
    <Pressable style={s.checkRow} onPress={onToggle}>
      <View style={[s.checkbox, { borderColor: checked ? "#C5847A" : "#D1B9B1", backgroundColor: checked ? "#C5847A" : "#fff" }]}>
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <TouchableOpacity onPress={onLabelPress} style={{ flex: 1 }}>
        <Text style={[s.checkLabel, { color: colors.text }]}>
          {label}{" "}
          <Text style={{ color: "#C5847A", textDecorationLine: "underline" }}>görüntüle</Text>
        </Text>
      </TouchableOpacity>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end", marginBottom: 8,
  },
  logoRow: { alignItems: "center", gap: 8, marginBottom: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#C5847A", shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 26, fontWeight: "800" },
  tagline: { fontSize: 13, textAlign: "center" },
  tabRow: {
    flexDirection: "row", borderRadius: 14, borderWidth: 1,
    padding: 4, marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabText: { fontSize: 15, fontWeight: "700" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#FECACA",
  },
  errorText: { flex: 1, color: "#DC2626", fontSize: 13 },
  successBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EAF1EA", borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#C8D8C8",
  },
  successText: { flex: 1, color: "#5C7050", fontSize: 13, lineHeight: 18 },
  form: { gap: 14 },
  nameRow: { flexDirection: "row", gap: 10 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600" },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
    minHeight: 50,
  },
  input: { fontSize: 15, paddingVertical: 12 },
  inputTrailing: { paddingLeft: 8 },
  primaryBtn: {
    paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 2,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDim: { opacity: 0.55 },
  divRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: "#E5E0DC" },
  divLabel: { fontSize: 12, color: "#A89490", fontWeight: "600" },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  socialBtnText: { fontSize: 15, fontWeight: "600" },
  termsCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", gap: 0 },
  termsDivider: { height: 1, marginHorizontal: 14 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  checkLabel: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  forgotRow: { alignItems: "center", paddingVertical: 4 },
  forgotText: { fontSize: 13, fontWeight: "600" },
});