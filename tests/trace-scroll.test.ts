import assert from "node:assert/strict";
import test from "node:test";
import { preserveScroll } from "../src/components/ui/preserve-scroll.ts";

function fixture() {
  const originals = ["requestAnimationFrame", "cancelAnimationFrame"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; } });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: (key: number) => frames.delete(key) });
  const viewport = Object.assign(new EventTarget(), { scrollTop: 120, scrollLeft: 10, scrollHeight: 1000, clientHeight: 400, style: { overflowAnchor: "auto" }, dataset: {} as Record<string, string> });
  let height = 30;
  const node = { closest: () => viewport, getBoundingClientRect: () => ({ height }) } as unknown as HTMLElement;
  return { node, viewport, grow: (value: number) => { height = value; }, frame: () => {
    const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0));
  }, cleanup: () => {
    viewport.dispatchEvent(new Event("wheel"));
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  } };
}

test("opening a live trace scrolls by its added height and respects user scrolling", () => {
  const f = fixture();
  try {
    preserveScroll(f.node, "follow-expansion");
    f.grow(180); f.frame();
    assert.equal(f.viewport.scrollTop, 270);
    f.grow(230); f.frame();
    assert.equal(f.viewport.scrollTop, 320);
    assert.equal(f.viewport.scrollLeft, 10);
    f.viewport.dispatchEvent(new Event("wheel"));
    f.viewport.scrollTop = 80; f.grow(300); f.frame();
    assert.equal(f.viewport.scrollTop, 80);
    assert.equal(f.viewport.style.overflowAnchor, "auto");
    assert.equal(f.viewport.dataset.scrollPreserving, undefined);
  } finally { f.cleanup(); }
});

test("ordinary comment expansion preserves scroll and live expansion clamps at the end", () => {
  const f = fixture();
  try {
    preserveScroll(f.node);
    f.grow(180); f.frame();
    assert.equal(f.viewport.scrollTop, 120);
    preserveScroll(f.node, "follow-expansion");
    f.grow(2000); f.frame();
    assert.equal(f.viewport.scrollTop, 600);
  } finally { f.cleanup(); }
});
