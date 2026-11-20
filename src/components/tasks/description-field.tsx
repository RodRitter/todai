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
  agents = [],
}: {
  agents?: AgentProfile[];
  value: string;
  disabled: boolean;
  onChange: (description: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function startEditing() {
    if (disabled) return;
    setIsEditing(true);
  }

  return (
    <>
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
            if (!(event.target as HTMLElement).closest("a")) startEditing();
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
    </>
  );
}
