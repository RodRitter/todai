"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { generalSettingsApi } from "@/lib/workspace-api";
import { EditableSetting } from "@/components/ui/editable-setting";
import { Label } from "@/components/ui/label";
import { FieldHelp } from "@/components/ui/field-help";

export function GeneralSettings() {
  const id = useId();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    generalSettingsApi.get().then((data) => {
      if (active) { setName(data.userName); setSaved(data.userName); setError(""); }
    }).catch(() => { if (active) { setError("Could not load your name."); toast.error("Could not load your name."); } });
    return () => { active = false; };
  }, [attempt]);
  return <section className="space-y-4" aria-label="Personal settings">
    <h2 className="text-lg font-semibold">Your identity</h2>
    <div className="space-y-2">
      <div className="flex items-center gap-2"><Label htmlFor={`${id}-name`}>Your name</Label>
        <FieldHelp id={`${id}-hint`} label="Your name">Agents use this name for you. New comments and messages use this author name in all workspaces.</FieldHelp></div>
      <EditableSetting id={`${id}-name`} label="Your name" value={name} disabled={saved === null} maxLength={100} describedBy={`${id}-hint`}
        onSave={async value => { const data = await generalSettingsApi.save(value); setName(data.userName); setSaved(data.userName); }} />
    </div>
    {error && saved === null && <Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Retry loading name</Button>}

  </section>;
}
