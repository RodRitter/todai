"use client";

import { useEffect, useId, useRef, useState } from "react";
import { notifyOperation } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { generalSettingsApi } from "@/lib/workspace-api";
import { CreditSettings } from "./credit-settings";
import { UserNameField } from "./user-name-field";

export function GeneralSettings() {
  const id = useId();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    generalSettingsApi.get().then((data) => {
      if (active) { setName(data.userName); setSaved(data.userName); setError(""); }
    }).catch(() => { if (active) setError("Could not load your name."); });
    return () => { active = false; };
  }, [attempt]);
  return <section className="space-y-4" aria-label="Personal settings">
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (saving.current || saved === null) return;
      saving.current = true;
      setBusy(true); setError("");
      try {
        const data = await notifyOperation(() => generalSettingsApi.save(name), { loading: "Saving name…", success: "Name saved.", error: (error) => error instanceof Error ? error.message : "Could not save your name." });
        setName(data.userName); setSaved(data.userName);
      } catch { /* The toast reports the save error. Keep the name for retry. */ }
      finally { saving.current = false; setBusy(false); }
    }}>
      <UserNameField id={`${id}-name`} value={name} onChange={(value) => { setName(value); }} disabled={busy || saved === null} actions={<Button type="submit" aria-label="Save name" disabled={busy || saved === null || !name.trim() || name.trim() === saved}>{busy ? "Saving…" : "Save"}</Button>} />
    </form>
    {error && <p role="alert">{error}</p>}
    {error && saved === null && <Button onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Retry loading name</Button>}
    <CreditSettings />
  </section>;
}
