/**
 * ScanBottomNav — v2 modülünde her ekranda görünen alt navigasyon.
 * 5 tab: Ana Sayfa / Tara / Rutinim / Favoriler / Profil
 *
 * position: "absolute", bottom: 0 — ekran içeriği SCAN_NAV_HEIGHT kadar boşluk bırakmalı.
 */

import { Feather } from "@expo/vector-icons";
import { router }   from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets }  from "react-native-safe-area-context";

const MUTED   = "#6B6B6B";
const WHITE   = "#FFFFFF";
const BORDER  = "#E5E7EB";

export const SCAN_NAV_HEIGHT = 52; // safeArea hariç

const TABS: { route: string; icon: string; label: string }[] = [
  { route: "/(tabs)/(home)", icon: "home",       label: "Ana Sayfa" },
  { route: "/(tabs)/scan",   icon: "camera",     label: "Tara"      },
  { route: "/(tabs)/rutin",  icon: "list",        label: "Rutinim"   },
  { route: "/(tabs)/favoriler", icon: "heart",   label: "Favoriler" },
  { route: "/(tabs)/profil", icon: "user",        label: "Profil"    },
];

export function ScanBottomNav() {
  const { bottom } = useSafeAreaInsets();
  const barH = SCAN_NAV_HEIGHT + (bottom || 0);

  return (
    <View style={[s.bar, { height: barH, paddingBottom: bottom || 0 }]}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.route}
          style={s.item}
          onPress={() => router.push(tab.route as any)}
          activeOpacity={0.65}
          hitSlop={8}
        >
          <Feather name={tab.icon as any} size={20} color={MUTED} />
          <Text style={s.label}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: WHITE,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  item:  { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6, gap: 3 },
  label: { fontSize: 9, color: MUTED, fontWeight: "500" },
});
