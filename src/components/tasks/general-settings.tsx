"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { generalSettingsApi } from "@/lib/workspace-api";
import { EditableSetting } from "@/components/ui/editable-setting";
import { SettingField } from "@/components/ui/setting-field";

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
    <SettingField htmlFor={`${id}-name`} label="Your name">
      <EditableSetting id={`${id}-name`} label="Your name" value={name} disabled={saved === null} maxLength={100}
        onSave={async value => { const data = await generalSettingsApi.save(value); setName(data.userName); setSaved(data.userName); }} />
    </SettingField>
    {error && saved === null && <Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Retry loading name</Button>}

  </section>;
}
