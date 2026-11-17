"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { richTextClassName } from "@/components/ui/rich-text-styles";
import { agentMentionPath } from "@/domain/agent-mentions";
import type { AgentProfile } from "@/domain/column-agent";
import type { TaskReference } from "@/domain/reference";
import { Bold, Italic, Heading2, List, ListOrdered, Code } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Match = { from: number; to: number; kind: "skill" | "file"; query: string };
function referenceMatch(editor: Editor): Match | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.spec.code || editor.isActive("link")) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
  const match = /(?:^|\s)([$@])([^\s$@]*)$/.exec(before);
  if (!match) return null;
  return { from: $from.pos - match[2].length - 1, to: $from.pos, kind: match[1] === "$" ? "skill" : "file", query: match[2] };
}

export function DescriptionEditor({ value, onChange, disabled = false, autoFocus = false, agents, label = "Description", id = "task-description" }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; autoFocus?: boolean;
  agents?: AgentProfile[]; label?: string; id?: string;
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [response, setResponse] = useState<{ key: string; items: TaskReference[] }>({ key: "", items: [] });
  const matchKey = JSON.stringify(match);
  const agentMode = agents !== undefined && match?.kind === "file";
  const results: TaskReference[] = agentMode
    ? agents.filter((agent) => agent.name.toLowerCase().includes(match.query.toLowerCase())).map((agent) => ({ kind: "file", label: `@${agent.name}`, path: agentMentionPath(agent.id), detail: agent.instructions }))
    : response.key === matchKey ? response.items : [];
  const [status, setStatus] = useState("Loading references…");
  const [selected, setSelected] = useState(0);
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
        id, role: "textbox", "aria-label": label, "aria-multiline": "true",
        class: `${richTextClassName} min-h-32 max-h-96 overflow-y-auto p-3 outline-none [&_.tableWrapper]:my-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:rounded-lg [&_.tableWrapper]:border [&_ul[data-type=taskList]]:list-none [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]>label]:mt-1 [&_li[data-type=taskItem]>div]:min-w-0 [&_li[data-type=taskItem]>div]:flex-1 [&_li[data-type=taskItem]>div>p]:my-1`,
      },
      handleKeyDown: (_view, event) => keyboard.current(event),
    },
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    onTransaction: ({ editor }) => {
      const next = referenceMatch(editor);
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
        const response = await fetch(`/api/references?kind=${match.kind}&q=${encodeURIComponent(match.query)}`, { signal: abort.signal });
        if (!response.ok) throw new Error("References unavailable");
        const data = await response.json() as { references: TaskReference[] };
        if (abort.signal.aborted) return;
        setResponse({ key: JSON.stringify(match), items: data.references });
        setStatus(data.references.length ? "" : "No matching references.");
      } catch {
        if (!abort.signal.aborted) setStatus("Could not load references. Type again to retry.");
      }
    }, 150);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [match, disabled, agentMode]);

  function insert(reference: TaskReference) {
    if (!editor || !match || disabled) return;
    editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, [
      { type: "text", text: reference.label, marks: [{ type: "link", attrs: { href: reference.path } }] },
      { type: "text", text: " " },
    ]).run();
    setMatch(null);
  }
  useEffect(() => {
  keyboard.current = (event) => {
    if (!match || disabled || event.isComposing) return false;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMatch(null); return true; }
    if (results.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setSelected((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
      return true;
    }
    if (results.length && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault(); insert(results[selected] ?? results[0]); return true;
    }
    return false;
  };
  });

  return (
    <div className="space-y-2">
      <div className="rounded-lg border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50">
        <TooltipProvider>
          <div role="group" aria-label={`${label} formatting`} className="flex flex-wrap items-center gap-1 border-b p-1">
            {formatGroups.map((group, index) => (
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
          </div>
        </TooltipProvider>
        <EditorContent editor={editor} />
        {match && !disabled && (
          <div className="max-h-52 overflow-y-auto border-t p-1" role="listbox" aria-label={agentMode ? "Available agents" : match.kind === "skill" ? "Available skills" : "Workspace files"}>
            {agentMode && !results.length && <p role="status" className="p-2 text-xs text-muted-foreground">No matching agents.</p>}
            {!agentMode && (response.key !== matchKey || status) && <p role="status" className="p-2 text-xs text-muted-foreground">{response.key !== matchKey && !status.startsWith("Could not") ? "Loading references…" : status}</p>}
            {results.map((reference, index) => (
              <button key={reference.path} type="button" role="option" aria-selected={index === (selected < results.length ? selected : 0)} className={`block w-full rounded px-2 py-1.5 text-left text-sm ${index === selected ? "bg-accent" : "hover:bg-muted"}`} onMouseDown={(event) => event.preventDefault()} onClick={() => insert(reference)}>
                <span className="block font-medium">{reference.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{reference.detail}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
