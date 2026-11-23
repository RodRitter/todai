"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { initializeTheme, type Theme } from "@/lib/theme";

import { snapshot, subscribe, setTheme } from "@/lib/theme-store";

const ThemeContext = createContext({ theme: "system" as Theme, resolvedTheme: "light" as "light" | "dark", setTheme });

function LiveThemeProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => "system:light");
  const [theme, resolvedTheme] = state.split(":") as [Theme, "light" | "dark"];
  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

function PreviewThemeProvider({ children, theme }: { children: ReactNode; theme: "light" | "dark" }) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    return initializeTheme;
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme: () => {} }}>{children}</ThemeContext.Provider>;
}

export function ThemeProvider({ children, forcedTheme }: { children?: ReactNode; forcedTheme?: "light" | "dark" }) {
  return forcedTheme
    ? <PreviewThemeProvider theme={forcedTheme}>{children}</PreviewThemeProvider>
    : <LiveThemeProvider>{children}</LiveThemeProvider>;
}

export function useTheme() { return useContext(ThemeContext); }
