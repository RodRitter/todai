export type Theme = "light" | "dark" | "system";
export const themeStorageKey = "todai-theme";

export function parseTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

// This self-contained function also runs before the first page paint.
export function initializeTheme() {
  let theme = "system";
  try { theme = localStorage.getItem("todai-theme") ?? "system"; } catch {}
  const dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export const themeScript = `(${initializeTheme.toString()})()`;
