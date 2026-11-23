"use client";

import { useEffect, useId, useState } from "react";
import { notifyOperation, toast } from "@/components/ui/toast";
import { ResetCreditTrackingDialog } from "@/components/reset-credit-tracking-dialog";
import { Button } from "@/components/ui/button";
import { InputActionRow } from "@/components/ui/input-action-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generalSettingsApi } from "@/lib/workspace-api";
import { formatCredits } from "@/lib/usage-format";
import { workspaceFetch } from "@/lib/workspace-fetch";

export function CreditSettings() {
  const id = useId();
  const [confirmReset, setConfirmReset] = useState(false);
  const [savedLimit, setSavedLimit] = useState<number | null>(null);
  const [savedCredits, setSavedCredits] = useState<number | null>(null);
  const [limit, setLimit] = useState("0");
  const [credits, setCredits] = useState("0");
  const [taskCredits, setTaskCredits] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void workspaceFetch("/api/usage", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load credits.");
      return response.json();
    }).then(usage => {
      if (active) { setSavedLimit(usage.creditLimit ?? 0); setSavedCredits(usage.trackedCredits ?? usage.credits); setTaskCredits(usage.credits); setLimit(String(usage.creditLimit ?? 0)); setCredits(String(usage.trackedCredits ?? usage.credits)); setReady(true); }
    }).catch(() => { if (active) { setError("Could not load credit settings."); toast.error("Could not load credit settings."); } });
    return () => { active = false; };
  }, [attempt]);
  async function save(action: "limit" | "credits" | "reset" | "sync") {
    if (busy || (action === "sync" && taskCredits === null)) return;
    setBusy(true); setError("");
    try {
      await notifyOperation(async () => {
      if (action === "limit") {
        const data = await generalSettingsApi.setCreditLimit(Number(limit));
        setLimit(String(data.creditLimit));
        setSavedLimit(data.creditLimit);
      } else {
        const response = await workspaceFetch("/api/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credits: action === "reset" ? 0 : action === "sync" ? taskCredits : Number(credits) }) });
        if (!response.ok) throw new Error("Could not set tracked credits.");
        const data = await response.json();
        setCredits(String(data.trackedCredits));
        setSavedCredits(data.trackedCredits);
        setTaskCredits(data.credits);
      }
      }, { loading: "Saving credit settings…", success: action === "reset" ? "Tracking reset to zero." : action === "sync" ? "Tracked credits synced with task total." : "Credit settings saved.", error: "Could not save credit settings." });
      if (action === "reset") setConfirmReset(false);
    } catch { /* The toast reports the error. */ }
    finally { setBusy(false); }
  }
  return <section className="space-y-4" aria-label="Credit settings">
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save("limit"); }}>
      <div className="space-y-2">
        <Label htmlFor={`${id}-limit`}>Maximum credits</Label>
        <InputActionRow actions={<Button aria-label="Save credit limit" disabled={!ready || busy || !limit.trim() || Number(limit) === savedLimit}>Save</Button>}>
        <Input id={`${id}-limit`} type="number" min="0" step="any" required value={limit} onChange={event => setLimit(event.target.value)} disabled={!ready || busy} aria-describedby={`${id}-limit-hint`} />
        </InputActionRow>
        <Label asChild variant="metadata"><p id={`${id}-limit-hint`}>This limit applies only to this workspace. The header compares its workspace total with this limit. Zero disables alerts. Usage above 80% shows red.</p></Label>
      </div>
    </form>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save("credits"); }}>
      <div className="space-y-2">
        <Label htmlFor={`${id}-credits`}>Current tracked credits</Label>
        <InputActionRow actions={<>
          <Button aria-label="Set tracked credits" disabled={!ready || busy || !credits.trim() || Number(credits) === savedCredits}>Set</Button>
          <Button type="button" aria-label="Reset tracking" variant="outline" disabled={!ready || busy} onClick={() => setConfirmReset(true)}>Reset</Button>
        </>}>
        <Input id={`${id}-credits`} type="number" min="0" step="any" required value={credits} onChange={event => setCredits(event.target.value)} disabled={!ready || busy} aria-describedby={`${id}-credits-hint`} />
        </InputActionRow>
        {taskCredits !== null && <Button type="button" variant="ghost-muted" size="xs" disabled={!ready || busy} onClick={() => void save("sync")}>
          Use task total: {formatCredits(taskCredits)} credits
        </Button>}
        <Label asChild variant="metadata"><p id={`${id}-credits-hint`}>Set the current workspace total manually, or reset it to zero. New usage adds to this value. Task usage history stays available.</p></Label>
      </div>
    </form>
    {error && !ready && <Button onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry loading credits</Button>}
    <ResetCreditTrackingDialog open={confirmReset} busy={busy} onOpenChange={setConfirmReset} onConfirm={() => void save("reset")} />
  </section>;
}
