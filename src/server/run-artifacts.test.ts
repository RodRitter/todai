import { DatabaseSync } from "node:sqlite";
import { ChatStore } from "./chat-store.ts";
import { sendChat } from "./chat-service.ts";
import { agentPrompt } from "./agent-prompt.ts";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "./task-store.ts";
import { ArtifactStore } from "./artifact-store.ts";
import { createExecutorRunner } from "./executor-runner.ts";
import { createCodexRunner } from "./codex-runner.ts";
import { createClaudeRunner } from "./claude-runner.ts";
import { ExecutionService } from "./execution-service.ts";

test("running agents publish visible artifacts with trusted provenance and pin their final comment", async () => {
  const f = fixture();
  const { store, library } = f;
  try {
    let endpoint!: { url: string; token: string };
    const service = new ExecutionService(store, async ({ artifacts, run }) => {
      assert.ok(artifacts);
      endpoint = artifacts;
      const artifact = await rpc(artifacts, "publish_artifact", { title: "Report", type: "text", content: "Saved during execution" });
      assert.equal(library.download(artifact.id).bytes.toString(), "Saved during execution");
      assert.equal(library.read(artifact.id).runId, run.id);
      assert.equal(library.read(artifact.id).taskId, "task");
      assert.equal(library.read(artifact.id).creator, "Builder");
      await rpc(artifacts, "nominate_artifact", { artifactId: artifact.id });
      return `[Report](#artifact/${artifact.id}) is ready`;
    });
    await service.drain();
    assert.equal(store.history()[0].status, "Complete", store.history()[0].summary!);
    const comment = store.list()[0].comments![0];
    assert.equal(comment.runId, store.history()[0].id);
    assert.equal(comment.artifacts?.length, 1);
    assert.equal(library.forTask("task")[0].comments[0].commentId, comment.id);
    await assert.rejects(fetch(endpoint.url));
  } finally { f.close(); }
});

async function rpc(connection: { url: string; token: string }, name: string, args: Record<string, unknown> = {}) {
  const response = await fetch(connection.url, { method: "POST", headers: { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
  const message = await response.json();
  if (message.result?.isError || message.error) throw new Error(message.result?.content[0].text ?? message.error.message);
  return JSON.parse(message.result.content[0].text);
}

function fixture(tool: "codex" | "claude" = "codex") {
  const directory = mkdtempSync(join(tmpdir(), "todai-live-tools-"));
  const path = join(directory, "tasks.sqlite");
  const store = new TaskStore(path);
  const library = new ArtifactStore(path, store.workspaceId);
  store.setWorkspacePath(directory);
  store.saveAgent({ id: "builder", name: "Builder", tool, model: "test", effort: "high", instructions: "", permissions: tool === "codex" ? "read-only" : "dontAsk" });
  store.assignColumnAgent({ column: "In progress", agentId: "builder" });
  store.save({ id: "task", title: "Build", description: "", status: "In progress", autoRun: true });
  return { directory, path, store, library, close() { library.close(); store.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("live tools isolate workspaces, reject ownership claims and expose no archival capability", async () => {
  const f = fixture();
  const other = f.store.createWorkspace("Other", f.directory);
  const foreign = new ArtifactStore(f.path, other.id);
  try {
    const hidden = foreign.create({ title: "Secret", type: "text", content: "Foreign", creator: "Human" });
    await new ExecutionService(f.store, async ({ artifacts }) => {
      assert.ok(artifacts);
      assert.deepEqual(await rpc(artifacts, "search_artifacts"), []);
      for (const name of ["read_artifact", "link_artifact", "nominate_artifact", "publish_artifact"]) {
        const args = name === "publish_artifact" ? { artifactId: hidden.id, title: "Changed", type: "text", content: "overwrite" } : name === "nominate_artifact" ? { artifactId: hidden.id } : { artifactId: hidden.id };
        await assert.rejects(rpc(artifacts, name, args), /workspace/);
      }
      for (const key of ["workspaceId", "taskId", "runId", "creator"]) await assert.rejects(rpc(artifacts, "publish_artifact", { title: "Invalid", type: "text", content: "No", [key]: "spoofed" }), /Invalid argument/);
      await assert.rejects(rpc(artifacts, "archive_artifact", { artifactId: hidden.id }), /Unknown/);
      const denied = await fetch(artifacts.url, { method: "POST", headers: { Authorization: "Bearer wrong" }, body: "{}" });
      assert.equal(denied.status, 403);
      assert.deepEqual(f.library.list(), []);
      return "Isolation verified";
    }).drain();
    assert.equal(f.store.history()[0].status, "Complete", f.store.history()[0].summary!);
    assert.equal(foreign.download(hidden.id).bytes.toString(), "Foreign");
  } finally { foreign.close(); f.close(); }
});

test("live tools publish files, links and document edits, reuse task context, and preserve feedback attachments", async () => {
  const f = fixture();
  try {
    const prior = f.library.create({ title: "Prior", type: "markdown", content: "# Prior", creator: "Human" });
    f.library.linkTask("task", prior.id);
    await new ExecutionService(f.store, async ({ artifacts }) => {
      assert.ok(artifacts);
      assert.equal(artifacts.context[0].artifact.id, prior.id);
      assert.equal("content" in artifacts.context[0].artifact, false);
      assert.equal((await rpc(artifacts, "read_artifact", { artifactId: prior.id })).content, "# Prior");
      const file = await rpc(artifacts, "publish_artifact", { title: "Binary", type: "file", filename: "sample.bin", base64: "AP9B" });
      assert.equal((await rpc(artifacts, "read_artifact", { artifactId: file.id })).base64, "AP9B");
      const link = await rpc(artifacts, "publish_artifact", { title: "Reference", type: "link", url: "https://example.com/report" });
      assert.equal((await rpc(artifacts, "read_artifact", { artifactId: link.id })).url, "https://example.com/report");
      await rpc(artifacts, "link_artifact", { artifactId: file.id });
      assert.ok(f.library.forTask("task").some((item) => item.artifact.id === file.id && item.explicit));
      await rpc(artifacts, "unlink_artifact", { artifactId: file.id });
      assert.equal(f.library.forTask("task").some((item) => item.artifact.id === file.id), false);
      await rpc(artifacts, "nominate_artifact", { artifactId: prior.id });
      await rpc(artifacts, "nominate_artifact", { artifactId: prior.id });
      const revised = await rpc(artifacts, "publish_artifact", { artifactId: prior.id, title: "Updated", type: "markdown", content: "# Updated" });
      assert.equal(revised.id, prior.id);
      assert.equal((await rpc(artifacts, "read_artifact", { artifactId: prior.id })).content, "# Updated");
      assert.equal((await rpc(artifacts, "search_artifacts", { search: "Updated" }))[0].id, prior.id);
      return JSON.stringify({ type: "feedback_request", question: `Approve the [report](#artifact/${prior.id})?`, recommendation: "Use the original" });
    }).drain();
    assert.equal(f.store.history()[0].status, "Waiting", f.store.history()[0].summary!);
    const comment = f.store.list()[0].comments![0];
    assert.equal(comment.feedbackStatus, "pending");
    assert.deepEqual(comment.artifacts, [{ artifactId: prior.id }]);
    assert.equal(comment.runId, f.store.history()[0].id);
  } finally { f.close(); }
});

for (const ending of ["failure", "stop", "move"] as const) {
  test(`published results survive ${ending} without attaching nominations to system notices`, async () => {
    const f = fixture();
    let published!: { id: string };
    try {
      await new ExecutionService(f.store, async ({ artifacts, run }) => {
        assert.ok(artifacts);
        published = await rpc(artifacts, "publish_artifact", { title: "Saved", type: "text", content: "Keep me" });
        await rpc(artifacts, "nominate_artifact", { artifactId: published.id });
        if (ending === "failure") throw new Error("Executor crashed");
        if (ending === "stop") f.store.stopExecution(run.id);
        else f.store.save({ ...f.store.list()[0], status: "To do" });
        await assert.rejects(rpc(artifacts, "publish_artifact", { title: "Too late", type: "text", content: "No" }));
        return "Must not become a handover";
      }).drain();
      assert.equal(f.store.history()[0].status, ending === "failure" ? "Failed" : ending === "stop" ? "Stopped" : "Interrupted");
      assert.equal(f.library.download(published.id).bytes.toString(), "Keep me");
      assert.equal(f.library.read(published.id).runId, f.store.history()[0].id);
      assert.deepEqual(f.library.forTask("task"), []);
      assert.ok(f.store.list()[0].comments?.every((comment) => !comment.artifacts?.length));
    } finally { f.close(); }
  });
}

for (const tool of ["codex", "claude"] as const) {
  test(`${tool} executor discovers and uses live MCP tools before returning a cited handover`, async () => {
    const f = fixture(tool);
    try {
      const executable = join(f.directory, `fake-${tool}`);
      writeFileSync(executable, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
process.stdin.resume();
process.stdin.on('end', async () => {
  try {
    let url, authorization;
    if (${JSON.stringify(tool)} === 'claude') {
      const config = JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.todai_artifacts;
      url = config.url; authorization = config.headers.Authorization;
    } else {
      url = JSON.parse(args.find(arg => arg.startsWith('mcp_servers.todai_artifacts.url=')).split('=').slice(1).join('='));
      authorization = args.find(arg => arg.startsWith('mcp_servers.todai_artifacts.http_headers=')).match(/Bearer [a-f0-9]+/)[0];
    }
    async function rpc(method, params) {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const body = await response.json();
      if (body.error || body.result?.isError) throw Error(JSON.stringify(body));
      return body.result;
    }
    const initialized = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    if (!initialized.capabilities.tools) throw Error('No tools');
    const listed = await rpc('tools/list');
    if (!listed.tools.some(tool => tool.name === 'publish_artifact')) throw Error('Publication missing');
    const result = await rpc('tools/call', { name: 'publish_artifact', arguments: { title: 'Executor result', type: 'markdown', content: '# Live result' } });
    const artifact = JSON.parse(result.content[0].text);
    await rpc('tools/call', { name: 'nominate_artifact', arguments: { artifactId: artifact.id } });
    const summary = '[Executor result](#artifact/' + artifact.id + ')';
    if (${JSON.stringify(tool)} === 'codex') fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], summary);
    else process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', result: summary }));
  } catch (error) { process.stderr.write(String(error)); process.exitCode = 1; }
});
`, { mode: 0o755 });
      await new ExecutionService(f.store, createExecutorRunner({ codex: createCodexRunner(executable), claude: createClaudeRunner(executable) })).drain();
      assert.equal(f.store.history()[0].status, "Complete", f.store.history()[0].summary!);
      const comment = f.store.list()[0].comments![0];
      assert.equal(comment.artifacts?.length, 1);
      assert.equal(comment.runId, f.store.history()[0].id);
      assert.equal(f.library.download(comment.artifacts![0].artifactId).bytes.toString(), "# Live result");
    } finally { f.close(); }
  });
}

test("file publication accepts the size limit and leaves invalid or oversized publications unpublished", async () => {
  const f = fixture();
  try {
    await new ExecutionService(f.store, async ({ artifacts }) => {
      assert.ok(artifacts);
      await assert.rejects(rpc(artifacts, "publish_artifact", { title: "Invalid", type: "file", filename: "bad.bin", base64: "invalid!" }), /base64/);
      await assert.rejects(rpc(artifacts, "publish_artifact", { title: "Oversized", type: "text", content: "x".repeat(20 * 1024 * 1024 + 1) }), /20 MiB/);
      assert.deepEqual(f.library.list(), []);
      const file = await rpc(artifacts, "publish_artifact", { title: "Maximum", type: "file", filename: "max.bin", base64: Buffer.alloc(20 * 1024 * 1024, 65).toString("base64") });
      assert.equal(file.byteSize, 20 * 1024 * 1024);
      assert.equal(f.library.list().length, 1);
      return "Validated";
    }).drain();
    assert.equal(f.store.history()[0].status, "Complete", f.store.history()[0].summary!);
  } finally { f.close(); }
});

test("stopping during artifact server startup prevents the executor from launching", async () => {
  const f = fixture();
  let launched = false;
  try {
    const draining = new ExecutionService(f.store, async () => { launched = true; return "Too late"; }).drain();
    f.store.stopTask("task");
    await draining;
    assert.equal(launched, false);
    assert.equal(f.store.history()[0].status, "Stopped");
    assert.deepEqual(f.store.list()[0].comments, []);
  } finally { f.close(); }
});

test("generic chat can publish, read, revise and link artifacts without task comments", async () => {
  const f = fixture();
  const chats = new ChatStore(f.store);
  try {
    let endpoint!: { url: string; token: string };
    const before = f.store.list()[0].comments;
    const result = await sendChat(f.store, chats, "task", "Create a report artifact", async (request) => {
      assert.equal(request.privateChat?.toolsEnabled, true);
      assert.equal(request.run.profile.instructions, "");
      assert.ok(request.artifacts);
      endpoint = request.artifacts;
      assert.match(agentPrompt(request), /todai_artifacts/);
      assert.doesNotMatch(agentPrompt(request), /Do not edit files|Do not.*publish artifacts|discussion only/);
      const created = await rpc(endpoint, "publish_artifact", { title: "Chat report", type: "markdown", content: "Report content" });
      assert.equal(created.taskId, "task");
      assert.equal(created.creator, "Agent");
      assert.equal((await rpc(endpoint, "read_artifact", { artifactId: created.id })).content, "Report content");
      assert.ok((await rpc(endpoint, "search_artifacts")).some((item: { id: string }) => item.id === created.id));
      await rpc(endpoint, "publish_artifact", { artifactId: created.id, title: "Chat report", type: "markdown", content: "Revised report" });
      await rpc(endpoint, "nominate_artifact", { artifactId: created.id });
      assert.equal(f.library.forTask("task").length, 1);
      return `Saved [Chat report](#artifact/${created.id}).`;
    });
    assert.equal(result.error, null);
    assert.equal(result.messages.length, 2);
    assert.deepEqual(f.store.list()[0].comments, before);
    await assert.rejects(fetch(endpoint.url));
    await sendChat(f.store, chats, "task", "Read the report", async ({ artifacts }) => {
      assert.equal(artifacts?.context.length, 1);
      const db = new DatabaseSync(f.path);
      db.prepare("UPDATE chat_sessions SET lease = NULL WHERE id = ?").run(result.id);
      db.close();
      await assert.rejects(rpc(artifacts!, "read_artifact", { artifactId: f.library.list()[0].id }), /expired/);
      return "Expired";
    });
  } finally { chats.close(); f.close(); }
});

for (const answer of ["Approved", "Rejected"]) {
  test(`MCP approval feedback persists and resumes with ${answer}`, async () => {
    const f = fixture();
    let resumed = false;
    try {
      const service = new ExecutionService(f.store, async ({ artifacts, task }) => {
        const reply = task.comments?.find((comment) => comment.authorRole === "human");
        if (reply) {
          assert.equal(reply.body, answer);
          resumed = true;
          return "Decision received.";
        }
        assert.ok(artifacts);
        await assert.rejects(rpc(artifacts, "request_feedback", { question: "Proceed?", recommendation: "Proceed.", responseType: "invalid" }), /responseType/);
        await assert.rejects(rpc(artifacts, "request_feedback", { question: " ", recommendation: "Proceed.", responseType: "approval" }), /question/);
        await rpc(artifacts, "request_feedback", { question: "Approve the change?", recommendation: "Approve the change to fix the error.", responseType: "approval" });
        await assert.rejects(rpc(artifacts, "publish_artifact", { title: "Late", type: "text", content: "No" }), /Stop work/);
        return "Waiting for your decision.";
      });
      await service.drain();
      assert.equal(f.store.list()[0].agentStatus, "Waiting");
      const reopened = new TaskStore(f.path);
      try {
        const request = reopened.list()[0].comments![0];
        assert.equal(request.responseType, "approval");
        assert.equal(request.body, "Approve the change?");
        assert.throws(() => reopened.answerFeedback("task", request.id, "Maybe"), /Approve or Reject/);
        reopened.answerFeedback("task", request.id, answer);
        assert.throws(() => reopened.answerFeedback("task", request.id, answer), /no longer pending/);
      } finally { reopened.close(); }
      await service.drain();
      assert.equal(resumed, true);
    } finally { f.close(); }
  });
}

test("MCP text feedback accepts a written answer", async () => {
  const f = fixture();
  try {
    await new ExecutionService(f.store, async ({ artifacts }) => {
      assert.ok(artifacts);
      await rpc(artifacts, "request_feedback", { question: "Which file?", recommendation: "Use the newest file.", responseType: "text" });
      return "Waiting for feedback.";
    }).drain();
    const request = f.store.list()[0].comments![0];
    assert.equal(request.responseType, "text");
    const task = f.store.answerFeedback("task", request.id, "Use report.md");
    assert.equal(task.agentStatus, "Queued");
    assert.ok(task.comments?.some((comment) => comment.body === "Use report.md"));
  } finally { f.close(); }
});

test("memory reviewers receive only read-only memory tools and bounded context", async () => {
  const f = fixture();
  try {
    await new ExecutionService(f.store, async () => "Complete").drain();
    f.store.renameColumn("Done", "Done", undefined, true);
    f.store.save({ ...f.store.list()[0], status: "Done" });
    let checked = false;
    await new ExecutionService(f.store, async (request) => {
      const connection = request.artifacts!;
      assert.ok(connection);
      const response = await fetch(connection.url, { method: "POST", headers: { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
      const message = await response.json();
      assert.deepEqual(message.result.tools.map((tool: { name: string }) => tool.name), ["search_memory", "read_memory"]);
      assert.deepEqual(await rpc(connection, "search_memory", { query: "settings" }), { entries: [], total: 0, hasMore: false });
      await assert.rejects(rpc(connection, "read_memory", { ids: "one" }), /Invalid argument/);
      await assert.rejects(rpc(connection, "read_memory", { ids: ["missing"] }), /unavailable/);
      await assert.rejects(rpc(connection, "search_memory", { query: "settings", workspaceId: "other" }), /Invalid argument/);
      await assert.rejects(rpc(connection, "publish_artifact", { title: "No", type: "text" }), /Unknown/);
      await assert.rejects(rpc(connection, "request_feedback", { question: "No", recommendation: "No", responseType: "approval" }), /Unknown/);
      assert.ok(JSON.stringify(request.workspaceMemory).length <= 4000);
      checked = true;
      return JSON.stringify({ changes: [] });
    }).drain();
    assert.ok(checked);
    assert.equal(f.store.history().at(-1)!.status, "Complete");
  } finally { f.close(); }
});

for (const feedback of [false, true]) {
  test(`agent ${feedback ? "feedback" : "completion"} omits nominated artifacts without tags`, async () => {
    const f = fixture();
    try {
      await new ExecutionService(f.store, async ({ artifacts }) => {
        assert.ok(artifacts);
        const artifact = await rpc(artifacts, "publish_artifact", { title: "Saved", type: "text", content: "Keep in library" });
        await rpc(artifacts, "nominate_artifact", { artifactId: artifact.id });
        return feedback
          ? JSON.stringify({ type: "feedback_request", question: "Continue?", recommendation: "Continue." })
          : "Work is complete.";
      }).drain();
      assert.equal(f.store.history()[0].status, feedback ? "Waiting" : "Complete");
      assert.equal(f.store.list()[0].comments![0].artifacts, undefined);
      assert.deepEqual(f.library.forTask("task"), []);
      assert.equal(f.library.list().length, 1);
    } finally { f.close(); }
  });
}
