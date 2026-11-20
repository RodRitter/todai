"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ReferencePopover } from "./reference-popover";
import { referenceMatch, type Match } from "./description-references";
import { ArtifactCreateDialog } from "@/components/artifacts/artifact-create-dialog";
import { Button } from "@/components/ui/button";
import { workspaceFetch } from "@/lib/workspace-fetch";

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
import { agentMentionPath } from "@/domain/agent-mentions";
import type { AgentProfile } from "@/domain/column-agent";
import type { TaskReference } from "@/domain/reference";
import { Bold, Italic, Heading2, List, ListOrdered, Code } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function DescriptionEditor({ value, onChange, disabled = false, autoFocus = false, agents, artifacts = false, onArtifactSelect, label = "Description", id = "task-description", actions, footer, toolbarActions, controlsOnFocus = false, compact = false, variant = "default", onSubmit }: {
  variant?: "default" | "prompt" | "compact" | "reply"; onSubmit?: () => void;
  value: string; onChange: (value: string) => void; disabled?: boolean; autoFocus?: boolean;
  agents?: AgentProfile[]; artifacts?: boolean; onArtifactSelect?: (artifact: Artifact) => void; label?: string; id?: string; actions?: ReactNode; footer?: ReactNode; toolbarActions?: ReactNode; controlsOnFocus?: boolean; compact?: boolean;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(autoFocus || !!value.trim());
  const collapsed = variant === "reply" && !expanded;
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
  const [response, setResponse] = useState<{ key: string; items: TaskReference[]; artifacts?: Artifact[] }>({ key: "", items: [] });
  const matchKey = JSON.stringify(match);
  const agentMode = agents !== undefined && match?.kind === "agent";
  const results: TaskReference[] = agentMode
    ? agents.filter((agent) => agent.name.toLowerCase().includes(match.query.toLowerCase())).map((agent) => ({ kind: "file", label: `@${agent.name}`, path: agentMentionPath(agent.id), detail: agent.instructions }))
    : response.key === matchKey ? response.items : [];
  const canCreate = match?.kind === "artifact" && response.key === matchKey;
  const optionCount = results.length + (canCreate ? 1 : 0);
  const [status, setStatus] = useState("Loading references…");
  const [selected, setSelected] = useState(0);
  const activeIndex = selected < optionCount ? selected : 0;
  const keyboard = useRef<(event: KeyboardEvent) => boolean>(() => false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Markdown, TableKit, TaskList, TaskItem.configure({ nested: true }), Image],
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editable: !disabled,
    editorProps: {
      attributes: {
        id, role: "textbox", "aria-label": label, "aria-multiline": "true", "aria-disabled": String(disabled),
        "data-placeholder": variant === "reply" ? "Send a reply" : variant !== "default" ? "Send a message… Use @ to mention an agent" : "",
        class: `${variant !== "default" ? "[&:has(>p:only-child>br:only-child)]:before:content-[attr(data-placeholder)] [&:has(>p:only-child>br:only-child)]:before:text-muted-foreground [&:has(>p:only-child>br:only-child)]:before:pointer-events-none [&:has(>p:only-child>br:only-child)]:before:float-left [&:has(>p:only-child>br:only-child)]:before:h-0" : ""} ${richTextClassName} p-3 outline-none [&_.tableWrapper]:my-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:rounded-lg [&_.tableWrapper]:border [&_ul[data-type=taskList]]:list-none [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]>label]:mt-1 [&_li[data-type=taskItem]>div]:min-w-0 [&_li[data-type=taskItem]>div]:flex-1 [&_li[data-type=taskItem]>div>p]:my-1`,
      },
      handleKeyDown: (_view, event) => keyboard.current(event),
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onTransaction: ({ editor }) => {
      const next = referenceMatch(editor, agents !== undefined, artifacts);
      setMatch((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    },
    onBlur: () => setMatch(null),
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
  useEffect(() => {
    if (!match || disabled || agentMode) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setResponse({ key: "", items: [] });
      setSelected(0);
      setStatus("Loading references…");
      try {
        const response = await workspaceFetch(match.kind === "artifact" ? `/api/artifacts?search=${encodeURIComponent(match.query)}` : `/api/references?kind=${match.kind}&q=${encodeURIComponent(match.query)}`, { signal: abort.signal });
        if (!response.ok) throw new Error("References unavailable");
        const payload = await response.json();
        const data: { references: TaskReference[] } = match.kind === "artifact"
          ? { references: (payload as Artifact[]).map((artifact) => ({ kind: "artifact", label: artifact.title, path: artifactMentionPath({ artifactId: artifact.id, revisionId: artifact.revisionId }), detail: `Revision ${artifact.revisionNumber} · ${artifact.type}` })) }
          : payload;
        if (abort.signal.aborted) return;
        setResponse({ key: JSON.stringify(match), items: data.references, artifacts: match.kind === "artifact" ? payload : undefined });
        setStatus(data.references.length ? "" : "No matching references.");
      } catch {
        if (!abort.signal.aborted) setStatus("Could not load references. Type again to retry.");
      }
    }, 150);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [match, disabled, agentMode]);

  function insert(reference: TaskReference, range = match) {
    if (!editor || !range || disabled) return;
    editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, [
      { type: "text", text: reference.label, marks: [{ type: "link", attrs: { href: reference.path } }] },
      { type: "text", text: " " },
    ]).run();
    setMatch(null);
    const artifact = response.artifacts?.find((item) => artifactMentionPath({ artifactId: item.id, revisionId: item.revisionId }) === reference.path);
    if (artifact) onArtifactSelect?.(artifact);
  }
  function create() {
    if (!match || disabled) return;
    setCreating(match);
    setMatch(null);
  }
  useEffect(() => {
  keyboard.current = (event) => {
    if (disabled || event.isComposing) return false;
    if (!match) {
      if (variant !== "default" && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit?.(); return true; }
      return false;
    }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMatch(null); return true; }
    if (optionCount && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setSelected((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + optionCount) % optionCount);
      return true;
    }
    if (optionCount && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      if (activeIndex === results.length) create();
      else insert(results[activeIndex]);
      return true;
    }
    if (match.kind === "artifact" && event.key === "Enter") { event.preventDefault(); return true; }
    return false;
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
        if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
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
              {toolbarActions}
            </div>
          </TooltipProvider>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
        <ScrollArea className="max-h-96" viewportProps={{ tabIndex: -1 }}><EditorContent editor={editor} className="min-w-0 max-w-full" /></ScrollArea>
        {match && !disabled && editor && (
          <ReferencePopover editor={editor} id={`${id}-references`} activeIndex={activeIndex} onDismiss={() => setMatch(null)} label={agentMode ? "Available agents" : match.kind === "artifact" ? "Workspace artifacts" : match.kind === "skill" ? "Available skills" : "Workspace files"}>
            {agentMode && !results.length && <p role="status" className="p-2 text-xs text-muted-foreground">No matching agents.</p>}
            {!agentMode && (response.key !== matchKey || status) && <p role="status" className="p-2 text-xs text-muted-foreground">{response.key !== matchKey && !status.startsWith("Could not") ? "Loading references…" : status}</p>}
            {results.map((reference, index) => (
              <button key={reference.path} id={`${id}-references-${index}`} type="button" role="option" aria-selected={index === activeIndex} className={`block w-full rounded px-2 py-1.5 text-left text-sm ${index === activeIndex ? "bg-accent" : "hover:bg-muted"}`} onMouseDown={(event) => event.preventDefault()} onClick={() => insert(reference)}>
                <span className="block break-words font-medium">{reference.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{reference.detail}</span>
              </button>
            ))}
            {canCreate && <Button type="button" variant={activeIndex === results.length ? "secondary" : "ghost"} align="start" className="w-full" id={`${id}-references-${results.length}`} role="option" aria-selected={activeIndex === results.length} onMouseDown={(event) => event.preventDefault()} onClick={create}>
              {match.query ? `Create artifact “${match.query}”` : "Create new artifact"}
            </Button>}
          </ReferencePopover>
        )}
      </div>
      {footer && <div aria-hidden={collapsed || undefined} inert={collapsed || undefined} className={`space-y-2 [&:not(:empty)]:mt-3 ${collapsed ? "invisible" : ""}`}>{footer}</div>}
    </EditorSurface>
    {creating && <ArtifactCreateDialog title={creating.query} onCancel={() => setCreating(null)} onRestoreFocus={() => { editor?.commands.focus(); setMatch(null); }} onSave={(artifact) => {
      insert({ kind: "artifact", label: artifact.title, path: artifactMentionPath({ artifactId: artifact.id, revisionId: artifact.revisionId }), detail: "" }, creating);
      onArtifactSelect?.(artifact);
      setCreating(null);
    }} />}
    </>
  );
}
