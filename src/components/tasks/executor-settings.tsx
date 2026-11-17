"use client";

import { useEffect, useRef, useState } from "react";
import { FlaskConical, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { notifyOperation, toast } from "@/components/ui/toast";
import { executorApi } from "@/lib/workspace-api";
import { executionTools, type ExecutionTool, type ExecutorSettingsData } from "@/domain/column-agent";

export function ExecutorSettings({ test = executorApi.test, load = executorApi.get, save = executorApi.save }: {
  test?: (tool: ExecutionTool) => Promise<{ message: string }>;
  load?: (status: boolean) => Promise<ExecutorSettingsData>;
  save?: (tool: ExecutionTool) => Promise<ExecutorSettingsData>;
}) {
  const [data, setData] = useState<ExecutorSettingsData | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ExecutionTool | "save" | null>(null);
  const [results, setResults] = useState<Partial<Record<ExecutionTool, {
    variant: "info" | "success" | "error";
    title: string;
    message: string;
  }>>>({});
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    load(true).then((value) => { if (active) setData(value); }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : "Could not load executor settings.", { duration: Infinity });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, attempt]);

  async function changeDefault(tool: ExecutionTool) {
    if (pending.current) return;
    pending.current = true;
    setBusy("save");
    try {
      const saved = await notifyOperation(() => save(tool), {
        loading: "Saving default executor…", success: "Default executor saved.", error: "Could not save the default executor.",
      });
      setData((current) => ({ ...current, defaultExecutor: saved.defaultExecutor }));
    } catch { /* Preserve the saved selection. */ }
    finally { pending.current = false; setBusy(null); }
  }

  async function runTest(tool: ExecutionTool) {
    if (pending.current) return;
    pending.current = true;
    setBusy(tool);
    setResults((current) => ({ ...current, [tool]: {
      variant: "info", title: "Testing connection…",
      message: "Checking installation, sign-in, and tool access. This may take up to three minutes.",
    } }));
    try {
      const result = await notifyOperation(() => test(tool), {
        loading: "Testing installation, sign-in, and tool access…",
        success: "Executor connection test passed.",
        error: (error) => error instanceof Error ? error.message : "Could not test the executor.",
      });
      setResults((current) => ({ ...current, [tool]: {
        variant: "success", title: "Connection test passed", message: result.message,
      } }));
      setData((current) => current && ({ ...current, statuses: current.statuses?.map((status) => status.tool === tool ? { ...status, installed: true, signedIn: true, message: result.message } : status) }));
    } catch (error) {
      setResults((current) => ({ ...current, [tool]: {
        variant: "error", title: "Connection test failed",
        message: error instanceof Error ? error.message : "Could not test the executor. Please try again.",
      } }));
    }
    finally { pending.current = false; setBusy(null); }
  }

  return (
    <section className="space-y-6" aria-labelledby="executor-heading" aria-busy={loading}>
      <div>
        <h2 id="executor-heading" className="text-lg font-semibold">Executors</h2>
        <p className="text-sm text-muted-foreground">Connect coding tools and choose which one new agents start with.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="default-executor">Default executor</Label>
        <NativeSelect id="default-executor" value={data?.defaultExecutor ?? "codex"} disabled={!data || loading || busy !== null}
          onChange={(event) => void changeDefault(event.target.value as ExecutionTool)} aria-describedby="default-executor-hint">
          {executionTools.map((tool) => <option key={tool.value} value={tool.value}>{tool.label}</option>)}
        </NativeSelect>
        <p id="default-executor-hint" className="text-xs text-muted-foreground">Used for new agents only. Existing agents, assignments, and queued runs keep their selected executor.</p>
      </div>
      <Button variant="outline" disabled={loading || busy !== null} onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Refresh status</Button>
      <div className="space-y-4">
        {executionTools.map((tool) => {
          const status = data?.statuses?.find((entry) => entry.tool === tool.value);
          const result = results[tool.value];
          return <section key={tool.value} aria-label={tool.label} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{tool.label}</h3>
              <span className="text-xs text-muted-foreground">{loading ? "Checking…" : !status ? "Status unavailable" : !status.installed ? "Unavailable" : status.signedIn ? "Signed in" : "Sign-in required"}</span>
            </div>
            <p className="text-sm text-muted-foreground">{status?.message ?? "Install and sign in to this CLI on the machine running Todai."}</p>
            {tool.value === "claude" && <p className="text-xs text-muted-foreground">Requires Claude Code 2.1.259 or newer for unattended permission handling. Model and effort availability depend on your account.</p>}
            <Button variant="outline" disabled={busy !== null || loading} onClick={() => void runTest(tool.value)}>
              {busy === tool.value ? <LoaderCircle className="animate-spin" /> : <FlaskConical />}
              {busy === tool.value ? "Testing…" : `Test ${tool.label}`}
            </Button>
            {result && <Alert variant={result.variant} title={result.title}>{result.message}</Alert>}
          </section>;
        })}
      </div>
      <p className="text-xs text-muted-foreground">Connection tests make a small model request in a temporary folder and may take up to three minutes. Status checks do not make model requests.</p>
    </section>
  );
}
