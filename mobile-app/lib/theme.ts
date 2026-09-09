import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { colorScheme as nwColorScheme } from "nativewind";

export type ThemeMode = "system" | "light" | "dark";

export const THEME_COLORS = {
  primary: "#007AFF",
  primaryLight: "#3395FF",
  primaryDark: "#0055B3",
  primarySoft: "#E5F2FF",
  light: {
    background: "#F8FAFC",
    card: "#FFFFFF",
    surfaceLight: "#E2E8F0",
    foreground: "#0F172A",
    muted: "#64748B",
    subtle: "#94A3B8",
    incomingBubble: "#E9E9EB",
    incomingText: "#000000",
    border: "#E2E8F0",
  },
  dark: {
    background: "#0D0D0F",
    card: "#1C1C1E",
    surfaceLight: "#2C2C2E",
    foreground: "#FFFFFF",
    muted: "#A0A0A5",
    subtle: "#8E8E93",
    incomingBubble: "#262628",
    incomingText: "#FFFFFF",
    border: "#2C2C2E",
  },
};

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  initTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: "system",
  isDark: Appearance.getColorScheme() === "dark",

  initTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem("app_theme_mode");
      const mode = (stored as ThemeMode) || "system";
      const systemScheme = Appearance.getColorScheme();
      const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");

      if (nwColorScheme?.set) {
        nwColorScheme.set(mode);
      }
      set({ themeMode: mode, isDark });
    } catch (e) {
      console.warn("Failed to load theme preference:", e);
    }
  },

  setThemeMode: async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem("app_theme_mode", mode);
      const systemScheme = Appearance.getColorScheme();
      const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");

      if (nwColorScheme?.set) {
        nwColorScheme.set(mode);
      }
      set({ themeMode: mode, isDark });
    } catch (e) {
      console.warn("Failed to save theme preference:", e);
    }
  },
}));

// Listen to OS system appearance updates
Appearance.addChangeListener(({ colorScheme }) => {
  const currentMode = useThemeStore.getState().themeMode;
  if (currentMode === "system") {
    const isDark = colorScheme === "dark";
    useThemeStore.setState({ isDark });
  }
});
