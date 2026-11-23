"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputActionRow } from "@/components/ui/input-action-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generalSettingsApi } from "@/lib/workspace-api";
import { workspaceFetch } from "@/lib/workspace-fetch";

export function CreditSettings() {
  const id = useId();
  const [limit, setLimit] = useState("0");
  const [credits, setCredits] = useState("0");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([generalSettingsApi.get(), workspaceFetch("/api/usage", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load credits.");
      return response.json();
    })]).then(([settings, usage]) => {
      if (active) { setLimit(String(settings.creditLimit ?? 0)); setCredits(String(usage.trackedCredits ?? usage.credits)); setReady(true); }
    }).catch(() => { if (active) setError("Could not load credit settings."); });
    return () => { active = false; };
  }, [attempt]);
  async function save(action: "limit" | "credits" | "reset") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (action === "limit") {
        const data = await generalSettingsApi.setCreditLimit(Number(limit));
        setLimit(String(data.creditLimit));
      } else {
        const response = await workspaceFetch("/api/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credits: action === "reset" ? 0 : Number(credits) }) });
        if (!response.ok) throw new Error("Could not set tracked credits.");
        const data = await response.json();
        setCredits(String(data.trackedCredits));
      }
      setMessage(action === "reset" ? "Tracking reset to zero." : "Credit settings saved.");
    } catch { setError("Could not save credit settings."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4" aria-label="Credit settings">
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save("limit"); }}>
      <div className="space-y-2">
        <Label htmlFor={`${id}-limit`}>Maximum credits</Label>
        <InputActionRow actions={<Button aria-label="Save credit limit" disabled={!ready || busy}>Save</Button>}>
        <Input id={`${id}-limit`} type="number" min="0" step="any" required value={limit} onChange={event => setLimit(event.target.value)} disabled={!ready || busy} aria-describedby={`${id}-limit-hint`} />
        </InputActionRow>
        <Label asChild variant="metadata"><p id={`${id}-limit-hint`}>This limit applies across all workspaces. Each header compares its workspace total with this limit. Zero disables alerts. Usage above 80% shows red.</p></Label>
      </div>
    </form>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save("credits"); }}>
      <div className="space-y-2">
        <Label htmlFor={`${id}-credits`}>Current tracked credits</Label>
        <InputActionRow actions={<>
          <Button aria-label="Set tracked credits" disabled={!ready || busy}>Set</Button>
          <Button type="button" aria-label="Reset tracking" variant="outline" disabled={!ready || busy} onClick={() => void save("reset")}>Reset</Button>
        </>}>
        <Input id={`${id}-credits`} type="number" min="0" step="any" required value={credits} onChange={event => setCredits(event.target.value)} disabled={!ready || busy} aria-describedby={`${id}-credits-hint`} />
        </InputActionRow>
        <Label asChild variant="metadata"><p id={`${id}-credits-hint`}>Set the current workspace total manually, or reset it to zero. New usage adds to this value. Task usage history stays available.</p></Label>
      </div>
    </form>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {error && !ready && <Button onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry loading credits</Button>}
  </section>;
}
