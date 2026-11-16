"use client";

import { useRef, useState } from "react";
import { FlaskConical, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyOperation } from "@/components/ui/toast";
import { executorApi } from "@/lib/workspace-api";

export function ExecutorSettings({
  test = executorApi.test,
}: {
  test?: () => Promise<{ message: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  async function runTest() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await notifyOperation(test, {
        loading: "Testing Codex CLI availability, sign-in, and tool execution…",
        success: "Codex CLI passed: signed in, executed a command, and returned the correct result.",
        error: (error) =>
          error instanceof Error
            ? error.message
            : "Could not test the executor. Check the app server and retry.",
      });
    } catch {
      /* The persistent error toast includes diagnostic details and next steps. */
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="executor-heading">
      <div>
        <h2 id="executor-heading" className="text-lg font-semibold">
          Executor tools
        </h2>
        <p className="text-sm text-muted-foreground">
          Test Codex CLI installation, sign-in, and command execution in a temporary
          folder using its default model. This makes a small model request and may
          take up to three minutes.
        </p>
      </div>
      <Button variant="outline" disabled={busy} onClick={() => void runTest()}>
        {busy ? <LoaderCircle className="animate-spin" /> : <FlaskConical />}
        {busy ? "Testing executor…" : "Test executor tools"}
      </Button>
    </section>
  );
}
