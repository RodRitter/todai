"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Artifact } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { DescriptionEditor } from "@/components/tasks/description-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ArtifactCreateDialog({ title, onSave, onCancel, onRestoreFocus }: {
  title: string;
  onSave: (artifact: Artifact) => void;
  onCancel: () => void;
  onRestoreFocus: () => void;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    data.set("type", "markdown");
    data.set("creator", "You");
    data.set("content", content);
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await workspaceFetch("/api/artifacts", { method: "POST", body: data });
      if (!response.ok) throw new Error((await response.json()).error ?? "Could not save artifact.");
      onSave(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save artifact.");
    } finally { submitting.current = false; setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !submitting.current) onCancel(); }}>
    <DialogContent size="large" closeDisabled={saving} onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
      <DialogHeader>
        <DialogTitle>Create artifact</DialogTitle>
        <DialogDescription>Save a document and insert its reference into your draft.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="min-w-0 space-y-4">
        <div className="space-y-2"><Label htmlFor="quick-artifact-title">Title</Label><Input id="quick-artifact-title" name="title" defaultValue={title} required maxLength={300} disabled={saving} /></div>
        <DescriptionEditor id="quick-artifact-content" label="Document content" value={content} onChange={setContent} disabled={saving} />
        {error && <p role="alert">{error}</p>}
        <DialogFooter>
          <Button size="sm" type="button" variant="ghost" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button size="sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Save and attach"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
