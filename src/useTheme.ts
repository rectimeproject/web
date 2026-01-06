import {useEffect, useState} from "react";

export interface ThemeColors {
  background: number; // PixiJS hex color
  barColor: number; // PixiJS hex color
  bookmarkColor: number; // PixiJS hex color
}

export type ThemeMode = "light" | "dark";

const lightTheme: ThemeColors = {
  background: 0xf5f5f7, // Apple gray-50
  barColor: 0x1d1d1f, // Apple gray-900
  bookmarkColor: 0xff9500 // Apple orange
};

const darkTheme: ThemeColors = {
  background: 0x1c1c1e, // Apple gray-900 (dark mode)
  barColor: 0xf5f5f7, // Apple gray-50 (inverted for dark)
  bookmarkColor: 0xff9f0a // Apple orange (dark mode variant)
};

export default function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setMode(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const colors = mode === "dark" ? darkTheme : lightTheme;

  return {mode, colors};
}
