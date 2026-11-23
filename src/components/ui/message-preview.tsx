"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";
import { preserveScroll } from "./preserve-scroll";
import { cn } from "@/lib/utils";

// Measure rendered content so wrapped lines, Markdown, and narrow layouts share the same limit.
export function MessagePreview({ children, kind = "reply" }: { children: ReactNode; kind?: "message" | "reply" }) {
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ height: number; limit: number }>();
  const long = !!size && size.height > size.limit + 1;
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => {
      // A collapsed thread has no layout. Keep its preview state until it is visible again.
      if (!node.getClientRects().length) return;
      const height = node.getBoundingClientRect().height;
      const limit = parseFloat(getComputedStyle(node).lineHeight) * 10;
      setSize((previous) => previous?.height === height && previous.limit === limit ? previous : { height, limit });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  return <div data-slot="message-preview" className="min-w-0 text-sm leading-relaxed">
    <div id={id} style={size ? { height: long && !expanded ? size.limit : size.height } : undefined}
      className={cn("min-w-0 overflow-hidden transition-[height] duration-200 ease-out motion-reduce:transition-none", long && !expanded && "scroll-fade-b scroll-fade-12")}
      onFocusCapture={(event) => { if (long && !expanded) { preserveScroll(event.currentTarget); setExpanded(true); } }}>
      <div ref={content} className="flow-root">{children}</div>
    </div>
    {long && <Button type="button" variant="ghost-muted" size="xs" aria-expanded={expanded} aria-controls={id}
      onClick={(event) => { preserveScroll(event.currentTarget); setExpanded((value) => !value); }}>{expanded ? "Show less" : `Show full ${kind}`}</Button>}
  </div>;
}
