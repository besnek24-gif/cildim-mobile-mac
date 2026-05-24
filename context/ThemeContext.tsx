import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

type ThemePref = "light" | "dark" | "system";

interface ThemeContextType {
  pref: ThemePref;
  colorScheme: "light" | "dark";
  setPref: (p: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  pref: "system",
  colorScheme: "light",
  setPref: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "theme_pref";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? "light";
  const [pref, setPrefState] = useState<ThemePref>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "light" || val === "dark") setPrefState(val);
    });
  }, []);

  const setPref = useCallback(async (p: ThemePref) => {
    setPrefState(p);
    if (p === "system") {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, p);
    }
  }, []);

  const toggle = useCallback(() => {
    const current = pref === "system" ? systemScheme : pref;
    setPref(current === "dark" ? "light" : "dark");
  }, [pref, systemScheme, setPref]);

  const colorScheme: "light" | "dark" =
    pref === "system" ? systemScheme : pref;

  return (
    <ThemeContext.Provider value={{ pref, colorScheme, setPref, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
