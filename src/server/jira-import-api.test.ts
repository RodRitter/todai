import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskStore } from "./task-store.ts";
import { POST } from "../app/api/jira-import/route.ts";

test("Jira imports reject malformed links and agents from another workspace without creating tasks", async () => {
  const directory = mkdtempSync(join(tmpdir(), "todai-jira-api-"));
  const previous = process.env.TODAI_DB_PATH;
  process.env.TODAI_DB_PATH = join(directory, "tasks.sqlite");
  const first = new TaskStore(process.env.TODAI_DB_PATH);
  first.setWorkspacePath(directory);
  const workspace = first.createWorkspace("Other", directory);
  const other = new TaskStore(first.databasePath, workspace.id);
  other.saveAgent({ id: "foreign", name: "Foreign agent", tool: "codex", model: "test", effort: "low", permissions: "read-only", instructions: "" });
  const request = (body: unknown) => new Request("http://localhost/api/jira-import", { method: "POST", headers: { "Content-Type": "application/json", "X-Todai-Workspace": first.workspaceId }, body: JSON.stringify(body) });
  try {
    assert.equal((await POST(request({ url: "not a URL", agentId: "foreign" }))).status, 400);
    const response = await POST(request({ url: "https://team.atlassian.net/browse/PROJ-1", agentId: "foreign" }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Choose an agent in this workspace/);
    assert.deepEqual(first.list(), []);
    assert.deepEqual(other.list(), []);
  } finally {
    first.close(); other.close();
    if (previous === undefined) delete process.env.TODAI_DB_PATH; else process.env.TODAI_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
