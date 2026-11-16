"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/ui/markdown";
import { Textarea } from "@/components/ui/textarea";

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
      <Label htmlFor="task-description">Description</Label>
      <input
        type="hidden"
        name="description"
        value={isEditing ? draft : description}
      />
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            id="task-description"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              onChange(event.target.value);
            }}
            autoFocus
            className="min-h-32 font-mono text-sm"
            aria-describedby="description-hint"
          />
          <div className="flex items-center justify-between gap-3">
            <p id="description-hint" className="text-muted-foreground text-xs">
              Markdown supported.
            </p>
            <div className="flex gap-1">
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
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Edit description"
          aria-disabled={disabled}
          className="min-h-24 cursor-text rounded-lg border p-3 outline-none transition-colors hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
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
          {description.trim() ? (
            <Markdown>{description}</Markdown>
          ) : (
            <p className="text-muted-foreground text-sm">
              Click to add a description…
            </p>
          )}
        </div>
      )}
    </>
  );
}
