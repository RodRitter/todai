"use client";

import { useLayoutEffect, useRef } from "react";

// Capture positions before a task update so cards can animate across columns,
// even though React remounts cards when their parent column changes.
export function useBoardMotion(items: readonly unknown[]) {
  const boardRef = useRef<HTMLDivElement>(null);
  const previousRects = useRef<Map<string, DOMRect> | null>(null);
  const animations = useRef<Animation[]>([]);

  function capturePositions() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      previousRects.current = null;
      return;
    }

    const rects = new Map<string, DOMRect>();
    boardRef.current
      ?.querySelectorAll<HTMLElement>("[data-task-id]")
      .forEach((card) => {
        rects.set(card.dataset.taskId!, card.getBoundingClientRect());
      });
    previousRects.current = rects;
  }

  useLayoutEffect(() => {
    const rects = previousRects.current;
    previousRects.current = null;
    if (!rects) return;

    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    boardRef.current
      ?.querySelectorAll<HTMLElement>("[data-task-id]")
      .forEach((card) => {
        const previous = rects.get(card.dataset.taskId!);
        const current = card.getBoundingClientRect();
        const x = previous ? previous.left - current.left : 0;
        const y = previous ? previous.top - current.top : 6;
        if (previous && Math.abs(x) < 1 && Math.abs(y) < 1) return;

        animations.current.push(
          card.animate(
            [
              {
                transform: `translate(${x}px, ${y}px)`,
                opacity: previous ? 1 : 0,
              },
              { transform: "translate(0, 0)", opacity: 1 },
            ],
            { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
          ),
        );
      });
  }, [items]);

  useLayoutEffect(
    () => () => {
      animations.current.forEach((animation) => animation.cancel());
    },
    [],
  );

  return { boardRef, capturePositions };
}
