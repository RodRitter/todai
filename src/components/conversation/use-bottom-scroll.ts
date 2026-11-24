"use client";

import { useEffect, useRef } from "react";
import { isReplyInputActive } from "@/components/ui/message";

export function useBottomScroll(active: boolean) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = viewport.current;
    const body = content.current;
    if (!active || !node || !body) return;
    let frame: number | undefined;
    const follow = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (!node.dataset.scrollPreserving && !isReplyInputActive(node.ownerDocument)) {
          node.scrollTo({
            top: node.scrollHeight,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          });
        }
      });
    };
    const resize = new ResizeObserver(follow);
    resize.observe(body);
    resize.observe(node);
    const mutations = new MutationObserver(records => {
      const contentChanged = records.some(record => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        return !element?.closest('[data-slot="trace-duration"]');
      });
      if (contentChanged) follow();
    });
    mutations.observe(body, { childList: true, characterData: true, subtree: true });
    const resume = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-slot="message-reply-composer"]')) follow();
    };
    node.ownerDocument.addEventListener("focusout", resume);
    follow();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      node.ownerDocument.removeEventListener("focusout", resume);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [active]);

  return { viewport, content };
}
