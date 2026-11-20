"use client";

import type { AgentProfile } from "@/domain/column-agent";
import { useState } from "react";
import { EditorSurface, editorLabelClassName } from "@/components/ui/editor-surface";
import { Markdown } from "@/components/ui/markdown";
import { DescriptionEditor } from "./description-editor";

export function DescriptionField({
  value,
  disabled,
  onChange,
  onBlur,
  agents = [],
}: {
  agents?: AgentProfile[];
  value: string;
  disabled: boolean;
  onChange: (description: string) => void;
  onBlur?: () => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function startEditing() {
    if (disabled) return;
    setIsEditing(true);
  }

  return (
    <div onBlur={(event) => {
      if (!event.currentTarget.contains(event.target as Node) || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      // Keep the editor mounted so toolbar and artifact dialogs retain their state.
      void onBlur?.();
    }}>
      <input
        type="hidden"
        name="description"
        value={value}
      />
      {isEditing ? (
          <DescriptionEditor
            agents={agents}
            artifacts
            controlsOnFocus
            value={value}
            disabled={disabled}
            onChange={onChange}
            autoFocus
          />
      ) : (
        <EditorSurface
          disabled={disabled}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Edit description"
          aria-disabled={disabled}
          className="min-h-40 text-muted-foreground"
          onClick={(event) => {
            const target = event.target as Element;
            // Citations own their clicks; portal events can also bubble through this surface.
            if (event.currentTarget.contains(target) && !target.closest("a, button")) startEditing();
          }}
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              startEditing();
            }
          }}
        >
          <span className={editorLabelClassName}>Description</span>
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-muted-foreground text-sm">
              Click to add a description…
            </p>
          )}
        </EditorSurface>
      )}
    </div>
  );
}
