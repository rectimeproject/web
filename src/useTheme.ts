import {useEffect, useState} from "react";

export interface ThemeColors {
  background: number; // PixiJS hex color
  barColor: number; // PixiJS hex color
  bookmarkColor: number; // PixiJS hex color
}

export type ThemeMode = "light" | "dark";

const lightTheme: ThemeColors = {
  background: 0xe9ecef, // Bootstrap gray-200
  barColor: 0x495057, // Bootstrap gray-700
  bookmarkColor: 0xfd7e14 // Bootstrap orange - subtle but visible
};

const darkTheme: ThemeColors = {
  background: 0x212529, // Bootstrap gray-900
  barColor: 0xadb5bd, // Bootstrap gray-500
  bookmarkColor: 0xfd7e14 // Bootstrap orange - works well on dark
};

export default function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setMode(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Apply theme class to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    // Also set Bootstrap's theme attribute for navbar and other Bootstrap components
    document.documentElement.setAttribute("data-bs-theme", mode);
  }, [mode]);

  const colors = mode === "dark" ? darkTheme : lightTheme;

  return {mode, colors};
}
