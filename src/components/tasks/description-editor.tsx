"use client";

import { preserveScroll } from "@/components/ui/preserve-scroll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityPicker, type EntityReference } from "./entity-picker";
import { referenceMatch, type Match } from "./description-references";
import { ArtifactCreateDialog } from "@/components/artifacts/artifact-create-dialog";
import { Button } from "@/components/ui/button";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { EditorSurface, editorLabelClassName } from "@/components/ui/editor-surface";
import { richTextClassName } from "@/components/ui/rich-text-styles";
import { artifactMentionPath } from "@/domain/artifact-mentions";
import type { Artifact } from "@/domain/artifact";
import type { AgentProfile } from "@/domain/column-agent";
import { Bold, Italic, Heading2, List, ListOrdered, Code, AtSign } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function DescriptionEditor({ value, onChange, disabled = false, autoFocus = false, agents, artifacts = false, onArtifactSelect, label = "Description", id = "task-description", actions, footer, toolbarActions, controlsOnFocus = false, compact = false, variant = "default", placeholder, onSubmit }: {
  placeholder?: string;
  variant?: "default" | "prompt" | "compact" | "reply"; onSubmit?: () => void;
  value: string; onChange: (value: string) => void; disabled?: boolean; autoFocus?: boolean;
  agents?: AgentProfile[]; artifacts?: boolean; onArtifactSelect?: (artifact: Artifact) => void; label?: string; id?: string; actions?: ReactNode; footer?: ReactNode; toolbarActions?: ReactNode; controlsOnFocus?: boolean; compact?: boolean;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(autoFocus || !!value.trim());
  const collapsed = (variant === "reply" || variant === "prompt") && (!expanded || disabled);
  const compactVariant = variant === "compact" || variant === "reply";
  const revealReply = useCallback(() => {
    const node = surface.current;
    if (variant !== "reply" || !node?.contains(node.ownerDocument.activeElement)) return;
    const viewport = node.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) { node.scrollIntoView({ block: "nearest", behavior: "instant" }); return; }
    const bounds = node.getBoundingClientRect();
    const visible = viewport.getBoundingClientRect();
    if (bounds.bottom > visible.bottom) viewport.scrollTop += bounds.bottom - visible.bottom;
    else if (bounds.top < visible.top) viewport.scrollTop -= visible.top - bounds.top;
  }, [variant]);
  useEffect(() => {
    const node = surface.current;
    if (variant !== "reply" || !node) return;
    // Resize notifications run during expansion, before the next paint.
    const resize = new ResizeObserver(revealReply);
    resize.observe(node);
    return () => resize.disconnect();
  }, [variant, revealReply]);

  const [creating, setCreating] = useState<Match | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const pickerKeyboard = useRef<(event: KeyboardEvent) => boolean>(() => false);
  const keyboard = useRef<(event: KeyboardEvent) => boolean>(() => false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, markdownLinks: true } }), Markdown, TableKit, TaskList, TaskItem.configure({ nested: true }), Image],
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editable: !disabled,
    editorProps: {
      attributes: {
        id, role: "textbox", "aria-label": label, "aria-multiline": "true", "aria-disabled": String(disabled),
        "data-placeholder": placeholder ?? (variant === "reply" ? "Reply" : variant !== "default" ? "Send a message… Use @ to add a tag" : ""),
        class: `${variant !== "default" ? "[&:has(>p:only-child>br:only-child)]:before:content-[attr(data-placeholder)] [&:has(>p:only-child>br:only-child)]:before:text-muted-foreground [&:has(>p:only-child>br:only-child)]:before:pointer-events-none [&:has(>p:only-child>br:only-child)]:before:float-left [&:has(>p:only-child>br:only-child)]:before:h-0" : ""} ${richTextClassName} p-3 outline-none [&_.tableWrapper]:my-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:rounded-lg [&_.tableWrapper]:border [&_ul[data-type=taskList]]:list-none [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]>label]:mt-1 [&_li[data-type=taskItem]>div]:min-w-0 [&_li[data-type=taskItem]>div]:flex-1 [&_li[data-type=taskItem]>div>p]:my-1`,
      },
      handleKeyDown: (_view, event) => keyboard.current(event),
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onTransaction: ({ editor, transaction }) => {
      if (!transaction.docChanged && !transaction.selectionSet) return;
      const next = referenceMatch(editor, artifacts);
      setMatch((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    },
    onBlur: ({ event }) => {
      if (!(event.relatedTarget instanceof Element) || !event.relatedTarget.closest("[data-reference-picker]")) setMatch(null);
    },
  });

  const activeFormats = useEditorState({
    editor,
    selector: ({ editor }) => editor ? [
      editor.isActive("bold") && "bold",
      editor.isActive("italic") && "italic",
      editor.isActive("code") && "code",
      editor.isActive("heading", { level: 2 }) && "heading",
      editor.isActive("bulletList") && "bulletList",
      editor.isActive("orderedList") && "orderedList",
    ].filter((value): value is string => Boolean(value)) : [],
  });

  const formatGroups = [
    {
      label: "Text formatting",
      items: [
        { value: "bold", label: "Bold", icon: Bold, action: () => editor?.chain().focus().toggleBold().run() },
        { value: "italic", label: "Italic", icon: Italic, action: () => editor?.chain().focus().toggleItalic().run() },
        { value: "code", label: "Code", icon: Code, action: () => editor?.chain().focus().toggleCode().run() },
      ],
    },
    {
      label: "Paragraph formatting",
      items: [
        { value: "heading", label: "Heading", icon: Heading2, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
        { value: "bulletList", label: "Bullet list", icon: List, action: () => editor?.chain().focus().toggleBulletList().run() },
        { value: "orderedList", label: "Numbered list", icon: ListOrdered, action: () => editor?.chain().focus().toggleOrderedList().run() },
      ],
    },
  ];

  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  function insert(reference: EntityReference, range = match) {
    if (!editor || !range || disabled) return;
    editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, [
      { type: "text", text: reference.label, marks: [{ type: "link", attrs: { href: reference.path } }] },
      { type: "text", text: " " },
    ]).run();
    setMatch(null);
    if (reference.artifact) onArtifactSelect?.(reference.artifact);
  }
  function openTags() {
    if (!editor || disabled) return;
    const { $from } = editor.state.selection;
    const before = $from.parent.textBetween(0, $from.parentOffset);
    editor.chain().focus().insertContent(before && !/\s$/.test(before) ? " @" : "@").run();
  }
  useEffect(() => {
  keyboard.current = (event) => {
    if (disabled || event.isComposing) return false;
    if (!match) {
      if (variant !== "default" && onSubmit && event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.shiftKey) { event.preventDefault(); onSubmit(); return true; }
      return false;
    }
    return pickerKeyboard.current(event);
  };
  });

  return (
    <>
    <EditorSurface
      ref={surface}
      className="group/editor"
      variant={variant}
      collapsed={collapsed}
      onFocusCapture={() => {
        if (disabled) return;
        setExpanded(true);
        requestAnimationFrame(revealReply);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !(event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-reference-picker]"))) {
          if (expanded && !disabled && (variant === "reply" || variant === "prompt")) {
            const node = event.currentTarget;
            const viewport = node.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
              ?? node.closest('[data-slot="conversation-composer"]')?.parentElement?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
            preserveScroll(viewport ?? node);
          }
          setExpanded(false);
        }
      }}
      disabled={disabled}
      onClick={(event) => {
        if (
          !disabled &&
          event.target instanceof Element &&
          !event.target.closest("button, a, input, [role=button], [role=option], [contenteditable]")
        ) editor?.chain().focus().run();
      }}
    >
      <label htmlFor={id} className={variant !== "default" ? "sr-only" : editorLabelClassName}>{label}</label>
      <div className={`min-w-0 flex flex-col [&_.tiptap]:px-0 [&_.tiptap]:pt-0 ${compactVariant ? "[&_.tiptap]:min-h-8" : compact ? "[&_.tiptap]:min-h-12" : "[&_.tiptap]:min-h-24"}`}>
        <div aria-hidden={collapsed || undefined} inert={collapsed || undefined} className={`order-last flex-wrap items-center justify-between ${compactVariant ? "mt-1 gap-2" : "mt-2 gap-3"} ${variant !== "default" ? "" : "border-t pt-3"} ${collapsed ? "invisible flex" : controlsOnFocus ? "hidden group-focus-within/editor:flex group-has-[[data-state=open]]/editor:flex" : "flex"}`}>
          <TooltipProvider>
            <div role="group" aria-label={`${label} formatting`} className="flex flex-wrap items-center gap-1">
              {variant === "default" && formatGroups.map((group, index) => (
                <ToggleGroup
                  key={group.label}
                  type="multiple"
                  value={activeFormats ?? []}
                  aria-label={group.label}
                  disabled={disabled || !editor}
                  className={index ? "border-l pl-1" : undefined}
                >
                  {group.items.map(({ value, label, icon: Icon, action }) => (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <ToggleGroupItem
                          value={value}
                          aria-label={label}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={action}
                        >
                          <Icon aria-hidden="true" />
                        </ToggleGroupItem>
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  ))}
                </ToggleGroup>
              ))}
              <Button type="button" variant="ghost-muted" size={compactVariant ? "icon-xs" : "icon-sm"} disabled={disabled || !editor} aria-label="Add tag" title="Add tag" onMouseDown={(event) => event.preventDefault()} onClick={openTags}><AtSign aria-hidden="true" /></Button>
              {toolbarActions}
            </div>
          </TooltipProvider>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
        <ScrollArea className="max-h-96" viewportProps={{ tabIndex: -1 }}><EditorContent editor={editor} className="min-w-0 max-w-full" /></ScrollArea>
        {match && !disabled && editor && (
          <EntityPicker key={`${match.from}:${match.kind}`} editor={editor} id={`${id}-references`} match={match} agents={agents} artifacts={artifacts}
            keyboardRef={pickerKeyboard} onDismiss={() => setMatch(null)} onSelect={insert}
            onCreate={(query) => { setCreating({ ...match, query }); setMatch(null); }} />
        )}
      </div>
      {footer && <div aria-hidden={collapsed || undefined} inert={collapsed || undefined} className={`space-y-2 [&:not(:empty)]:mt-3 ${collapsed ? "invisible" : ""}`}>{footer}</div>}
    </EditorSurface>
    {creating && <ArtifactCreateDialog title={creating.query} onCancel={() => setCreating(null)} onRestoreFocus={() => { editor?.commands.focus(); setMatch(null); }} onSave={(artifact) => {
      insert({ kind: "artifact", label: artifact.title, path: artifactMentionPath({ artifactId: artifact.id }), detail: "" }, creating);
      onArtifactSelect?.(artifact);
      setCreating(null);
    }} />}
    </>
  );
}
