/**
 * useAuthGate.ts — Misafir kullanıcı erişim koruması
 *
 * Kart/buton onPress wrapper'ı: kayıtlı kullanıcı (free veya seckin) ise
 * onAuthed çalışır; misafir ise "Üyelik Gerekli" Alert'i ile /giris'e
 * yönlendirir. UI kart görünürlüğünü değiştirmez — sadece eylemi gate'ler.
 *
 * Kullanım:
 *   const { requireAuth } = useAuthGate();
 *   <TouchableOpacity onPress={() => requireAuth(() => router.push("/x"), "Akıllı Seçim")} />
 */

import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";

export function useAuthGate() {
  const { isRegistered } = useAuth();

  const requireAuth = (onAuthed: () => void, feature?: string): void => {
    if (isRegistered) {
      onAuthed();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      "Üyelik Gerekli",
      feature
        ? `${feature} özelliğini kullanmak için giriş yapmanız gerekiyor.`
        : "Bu özelliği kullanmak için giriş yapmanız gerekiyor.",
      [
        { text: "Giriş Yap", onPress: () => router.push("/giris" as any) },
        { text: "Vazgeç", style: "cancel" },
      ],
    );
  };

  return { requireAuth, isRegistered };
}
