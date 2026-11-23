const active = new WeakMap<HTMLElement, () => void>();

// Local layout changes must not trigger the conversation's new-message scrolling.
export function preserveScroll(element: HTMLElement | null) {
  if (!element) return;
  const viewport = element.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    ?? element.ownerDocument.scrollingElement as HTMLElement | null;
  if (!viewport) return;
  active.get(viewport)?.();
  const top = viewport.scrollTop;
  const left = viewport.scrollLeft;
  const anchor = viewport.style.overflowAnchor;
  viewport.style.overflowAnchor = "none";
  viewport.dataset.scrollPreserving = "true";
  let frame = 0;
  const started = performance.now();
  function stop() {
    cancelAnimationFrame(frame);
    viewport!.style.overflowAnchor = anchor;
    delete viewport!.dataset.scrollPreserving;
    viewport!.removeEventListener("wheel", stop);
    viewport!.removeEventListener("touchmove", stop);
    viewport!.removeEventListener("pointerdown", stop);
    viewport!.removeEventListener("keydown", keyboard);
    active.delete(viewport!);
  }
  function keyboard(event: KeyboardEvent) {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) stop();
  }
  function restore() {
    viewport!.scrollTop = Math.min(top, Math.max(0, viewport!.scrollHeight - viewport!.clientHeight));
    viewport!.scrollLeft = left;
    if (performance.now() - started < 300) frame = requestAnimationFrame(restore);
    else stop();
  }
  active.set(viewport, stop);
  viewport.addEventListener("wheel", stop, { passive: true });
  viewport.addEventListener("touchmove", stop, { passive: true });
  viewport.addEventListener("pointerdown", stop);
  viewport.addEventListener("keydown", keyboard);
  frame = requestAnimationFrame(restore);
}
