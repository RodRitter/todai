"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorSurface, editorLabelClassName } from "@/components/ui/editor-surface";
import { Markdown } from "@/components/ui/markdown";
import { DescriptionEditor } from "./description-editor";

export function DescriptionField({
  initialValue,
  disabled,
  onChange,
  onSave,
}: {
  initialValue: string;
  disabled: boolean;
  onChange: (description: string) => void;
  onSave: (description: string) => Promise<void>;
}) {
  const [description, setDescription] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  async function saveDescription() {
    const value = draft.trim();
    if (disabled || value === description.trim()) return;
    try {
      await onSave(value);
      setDescription(value);
      setIsEditing(false);
    } catch {
      /* Keep the draft open; the persistence boundary reports the failure. */
    }
  }

  function startEditing() {
    if (disabled) return;
    setDraft(description);
    setIsEditing(true);
  }

  return (
    <>
      <input
        type="hidden"
        name="description"
        value={isEditing ? draft : description}
      />
      {isEditing ? (
          <DescriptionEditor
            value={draft}
            disabled={disabled}
            onChange={(value) => {
              setDraft(value);
              onChange(value);
            }}
            autoFocus
            actions={<>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Cancel description edit"
                onClick={() => {
                  setIsEditing(false);
                  onChange(description);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                aria-label="Save description"
                disabled={disabled || draft.trim() === description.trim()}
                onClick={() => {
                  void saveDescription();
                }}
              >
                Save
              </Button>
            </>}
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
          {description.trim() ? (
            <Markdown>{description}</Markdown>
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
