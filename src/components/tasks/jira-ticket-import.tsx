"use client";
import { useRef, useState } from "react";
import type { AgentProfile } from "@/domain/column-agent";
import { jiraTicketUrl, type JiraTicketDraft } from "@/domain/jira-import";
import { jiraImportApi } from "@/lib/workspace-api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { LoaderCircle } from "lucide-react";

export function JiraTicketImport({ agents = [], busy, hasDraft, onBusyChange, onImported, importTicket = jiraImportApi.import }: {
  agents?: AgentProfile[]; busy: boolean; hasDraft: boolean; onBusyChange: (busy: boolean) => void;
  onImported: (draft: JiraTicketDraft) => void;
  importTicket?: typeof jiraImportApi.import;
}) {
  const [url, setUrl] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function importTicketInfo() {
    if (pending.current || busy) return;
    setError("");
    let source: string;
    try { source = jiraTicketUrl(url); } catch (error) { setError((error as Error).message); return; }
    pending.current = true; onBusyChange(true);
    try { onImported(await importTicket(source, agentId)); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not import the ticket. Your draft has been preserved."); }
    finally { pending.current = false; onBusyChange(false); }
  }
  return <section className="space-y-4" aria-label="Import Jira ticket" aria-busy={busy}>
    <Alert title="Read ticket information only">The agent is explicitly instructed to read this ticket without editing fields, posting comments, changing status, or making any other Jira changes. Imported information fills your draft for review before creation. This instruction does not change your Jira permissions.</Alert>
    <div className="space-y-2"><Label htmlFor="jira-ticket-url">Jira ticket URL</Label><Input id="jira-ticket-url" type="text" inputMode="url" value={url} placeholder="https://team.atlassian.net/browse/PROJ-123" disabled={busy} onChange={(event) => setUrl(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "jira-import-error" : undefined} /></div>
    <div className="space-y-2"><Label htmlFor="jira-import-agent">Agent</Label><NativeSelect id="jira-import-agent" value={agentId} disabled={busy || !agents.length} onChange={(event) => setAgentId(event.target.value)}><option value="" disabled>Choose an agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</NativeSelect></div>
    {!agents.length && <Alert title="Add an agent first">Create an agent in Agents, then return here. The agent needs an existing browser or Jira connection that can access the ticket.</Alert>}
    {hasDraft && <Alert title="Replace draft details">Importing replaces the current draft title and description. Your draft is kept if the import fails.</Alert>}
    {error && <Alert id="jira-import-error" variant="error" title="Import failed">{error}</Alert>}
    {busy && <Alert title="Reading ticket…">This can take up to three minutes. Keep this dialog open.</Alert>}
    <Button type="button" disabled={busy || !url.trim() || !agents.some((agent) => agent.id === agentId)} onClick={() => void importTicketInfo()}>{busy && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{busy ? "Importing…" : "Import ticket details"}</Button>
  </section>;
}
