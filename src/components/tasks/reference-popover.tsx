"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "radix-ui";

// The virtual anchor follows the caret without adding elements to editable content.
export function ReferencePopover({ editor, id, label, activeIndex, children, header, onDismiss }: {
  editor: Editor;
  id: string;
  label: string;
  activeIndex: number;
  children: ReactNode;
  header?: ReactNode;
  onDismiss: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const anchor = useMemo(() => ({ current: {
    contextElement: editor.view.dom,
    getBoundingClientRect: () => {
      const caret = editor.view.coordsAtPos(editor.state.selection.from);
      const bounds = editor.view.dom.getBoundingClientRect();
      const top = Math.max(bounds.top, Math.min(caret.top, bounds.bottom));
      const bottom = Math.max(top, Math.min(caret.bottom, bounds.bottom));
      return new DOMRect(caret.left, top, 0, bottom - top);
    },
  } }), [editor]);

  useEffect(() => {
    content.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, children]);

  useEffect(() => {
    const element = editor.view.dom;
    element.setAttribute("aria-controls", id);
    element.setAttribute("aria-autocomplete", "list");
    const selected = content.current?.querySelector('[aria-selected="true"]');
    if (selected) {
      element.setAttribute("aria-activedescendant", selected.id);
    } else {
      element.removeAttribute("aria-activedescendant");
    }
    return () => {
      element.removeAttribute("aria-controls");
      element.removeAttribute("aria-autocomplete");
      element.removeAttribute("aria-activedescendant");
    };
  }, [editor, id, activeIndex, children]);

  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Portal>
        <Popover.Content
          ref={content}
          data-reference-picker=""
          aria-label="Add a tag"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          updatePositionStrategy="always"
          className="z-50 flex max-h-[var(--radix-popover-content-available-height)] w-96 max-w-[calc(100vw-1.5rem)] flex-col rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
          onClick={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (event.target instanceof Node && editor.view.dom.contains(event.target)) event.preventDefault();
          }}
        >
          {header}
          <ScrollArea fade="bottom" className="max-h-80" viewportProps={{ tabIndex: -1 }}><div id={id} role="listbox" aria-label={label}>{children}</div></ScrollArea>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
