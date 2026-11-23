import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { parseTheme, themeScript, themeStorageKey } from "../src/lib/theme.ts";

test("startup applies saved preferences and system fallback before hydration", () => {
  for (const stored of [null, "system", "invalid", "light", "dark"]) {
    for (const systemDark of [false, true]) {
      let dark;
      runInNewContext(themeScript, {
        localStorage: { getItem: (key: string) => { assert.equal(key, themeStorageKey); return stored; } },
        matchMedia: () => ({ matches: systemDark }),
        document: { documentElement: { classList: { toggle: (_: string, value: boolean) => { dark = value; } } } },
      });
      assert.equal(dark, stored === "dark" || (stored !== "light" && systemDark));
    }
  }
});

test("blocked storage preserves the system fallback", () => {
  let dark;
  runInNewContext(themeScript, {
    localStorage: { getItem: () => { throw new Error("Storage blocked"); } },
    matchMedia: () => ({ matches: true }),
    document: { documentElement: { classList: { toggle: (_: string, value: boolean) => { dark = value; } } } },
  });
  assert.equal(dark, true);
  assert.equal(parseTheme("invalid"), "system");
});

test("light and dark themes define the same semantic tokens", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const tokens = (selector: string) => [...css.match(new RegExp(`${selector} \\{([^}]+)\\}`))![1].matchAll(/(--[\w-]+):/g)].map((match) => match[1]).filter((name) => name !== "--radius").sort();
  assert.deepEqual(tokens(":root"), tokens("\\.dark"));
});

test("live changes persist, follow the system, synchronize tabs, and clean up", async () => {
  const { snapshot, subscribe, setTheme } = await import("../src/lib/theme-store.ts");
  const windowTarget = new EventTarget();
  const media = Object.assign(new EventTarget(), { matches: false });
  const saved = new Map<string, string>();
  let dark = false;
  let notifications = 0;
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const globals = {
    window: windowTarget,
    matchMedia: () => media,
    localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) },
    document: { documentElement: { classList: { toggle: (_: string, value: boolean) => { dark = value; } } } },
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  try {
    const unsubscribe = subscribe(() => notifications++);
    assert.equal(snapshot(), "system:light");
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    assert.equal(dark, true);
    setTheme("light");
    assert.equal(dark, false);
    assert.equal(saved.get(themeStorageKey), "light");
    media.dispatchEvent(new Event("change"));
    assert.equal(dark, false);
    saved.set(themeStorageKey, "dark");
    windowTarget.dispatchEvent(Object.assign(new Event("storage"), { key: themeStorageKey }));
    assert.equal(snapshot(), "dark:dark");
    assert.equal(dark, true);
    globals.localStorage.setItem = () => { throw new Error("Storage blocked"); };
    setTheme("light");
    assert.equal(snapshot(), "light:light");
    assert.equal(dark, false);
    unsubscribe();
    const previous = notifications;
    media.dispatchEvent(new Event("change"));
    windowTarget.dispatchEvent(new Event("todai-theme-change"));
    assert.equal(notifications, previous);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
