"use client";

import { FieldHelp } from "@/components/ui/field-help";

import { useEffect, useId, useState } from "react";
import { notifyOperation, toast } from "@/components/ui/toast";
import { ResetCreditTrackingDialog } from "@/components/reset-credit-tracking-dialog";
import { Button } from "@/components/ui/button";
import { InputActionRow } from "@/components/ui/input-action-row";
import { EditableSetting } from "@/components/ui/editable-setting";
import { Label } from "@/components/ui/label";
import { generalSettingsApi } from "@/lib/workspace-api";
import { formatCredits } from "@/lib/usage-format";
import { workspaceFetch } from "@/lib/workspace-fetch";

export function CreditSettings() {
  const id = useId();
  const [confirmReset, setConfirmReset] = useState(false);
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
      if (active) { setTaskCredits(usage.credits); setLimit(String(usage.creditLimit ?? 0)); setCredits(String(usage.trackedCredits ?? usage.credits)); setReady(true); }
    }).catch(() => { if (active) { setError("Could not load credit settings."); toast.error("Could not load credit settings."); } });
    return () => { active = false; };
  }, [attempt]);
  async function save(action: "reset" | "sync") {
    if (busy || (action === "sync" && taskCredits === null)) return;
    setBusy(true); setError("");
    try {
      await notifyOperation(async () => {
        const response = await workspaceFetch("/api/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credits: action === "reset" ? 0 : taskCredits }) });
        if (!response.ok) throw new Error("Could not set tracked credits.");
        const data = await response.json();
        setCredits(String(data.trackedCredits));
        setTaskCredits(data.credits);
      }, { loading: "Saving credit settings…", success: action === "reset" ? "Tracking reset to zero." : action === "sync" ? "Tracked credits synced with task total." : "Credit settings saved.", error: "Could not save credit settings." });
      if (action === "reset") setConfirmReset(false);
    } catch { /* The toast reports the error. */ }
    finally { setBusy(false); }
  }
  return <section className="space-y-4" aria-label="Credit settings">
    <h2 className="text-lg font-semibold">Credits</h2>
    <div className="space-y-2">
      <div className="flex items-center gap-2"><Label htmlFor={`${id}-limit`}>Maximum credits</Label><FieldHelp id={`${id}-limit-hint`} label="Maximum credits">Zero disables alerts. Usage above 80% of this workspace limit appears in red.</FieldHelp></div>
      <EditableSetting id={`${id}-limit`} label="Maximum credits" type="number" min={0} value={limit} disabled={!ready || busy} describedBy={`${id}-limit-hint`}
        onSave={async value => { const data = await generalSettingsApi.setCreditLimit(Number(value)); setLimit(String(data.creditLimit)); }} />
    </div>
    <div className="space-y-2">
      <div className="flex items-center gap-2"><Label htmlFor={`${id}-credits`}>Current tracked credits</Label><FieldHelp id={`${id}-credits-hint`} label="Current tracked credits">New usage adds to this workspace total. Reset sets the total to zero and keeps task history.</FieldHelp></div>
      <InputActionRow actions={<Button type="button" aria-label="Reset tracking" variant="outline" disabled={!ready || busy} onClick={() => setConfirmReset(true)}>Reset</Button>}>
        <EditableSetting id={`${id}-credits`} label="Current tracked credits" type="number" min={0} value={credits} disabled={!ready || busy} describedBy={`${id}-credits-hint`}
          onSave={async value => {
            setBusy(true);
            try {
              const response = await workspaceFetch("/api/usage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credits: Number(value) }) });
              if (!response.ok) throw new Error("Could not set tracked credits.");
              const data = await response.json(); setCredits(String(data.trackedCredits)); setTaskCredits(data.credits);
            } finally { setBusy(false); }
          }} />
      </InputActionRow>
      {taskCredits !== null && <Button type="button" variant="ghost-muted" size="xs" disabled={!ready || busy} onClick={() => void save("sync")}>Use task total: {formatCredits(taskCredits)} credits</Button>}
    </div>
    {error && !ready && <Button onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry loading credits</Button>}
    <ResetCreditTrackingDialog open={confirmReset} busy={busy} onOpenChange={setConfirmReset} onConfirm={() => void save("reset")} />
  </section>;
}
