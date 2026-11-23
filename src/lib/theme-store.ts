import { parseTheme, themeStorageKey, type Theme } from "./theme.ts";

const changeEvent = "todai-theme-change";
let memoryTheme: Theme | undefined;
function preference(): Theme {
  if (memoryTheme) return memoryTheme;
  try { return parseTheme(localStorage.getItem(themeStorageKey)); } catch { return "system"; }
}
export function snapshot() {
  const theme = preference();
  const resolved = theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
  return `${theme}:${resolved}` as const;
}
export function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    document.documentElement.classList.toggle("dark", snapshot().endsWith(":dark"));
    onChange();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === themeStorageKey || event.key === null) { memoryTheme = undefined; update(); }
  };
  update();
  media.addEventListener("change", update);
  window.addEventListener("storage", storage);
  window.addEventListener(changeEvent, update);
  return () => {
    media.removeEventListener("change", update);
    window.removeEventListener("storage", storage);
    window.removeEventListener(changeEvent, update);
  };
}
export function setTheme(theme: Theme) {
  memoryTheme = theme;
  try { localStorage.setItem(themeStorageKey, theme); } catch {}
  window.dispatchEvent(new Event(changeEvent));
}
