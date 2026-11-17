import assert from "node:assert/strict";
import test from "node:test";
import { isWithinWorkspace, parseListeners, serverIdentity, stopWorkspaceServer } from "./workspace-servers.ts";

test("server termination protects Todai and its parent process", async () => {
  for (const pid of [process.pid, process.ppid]) {
    assert.equal(serverIdentity(pid), undefined);
    await assert.rejects(stopWorkspaceServer(process.cwd(), pid, "identity"), /cannot stop its own server/);
  }
});

test("server termination rejects an unverified process identity", async () => {
  await assert.rejects(stopWorkspaceServer(process.cwd(), 2147483647, "stale identity"), /changed or exited/);
});

test("workspace matching includes descendants but excludes siblings with a shared prefix", () => {
  assert.equal(isWithinWorkspace("/projects/app", "/projects/app"), true);
  assert.equal(isWithinWorkspace("/projects/app", "/projects/app/packages/web"), true);
  assert.equal(isWithinWorkspace("/projects/app", "/projects/app-other"), false);
  assert.equal(isWithinWorkspace("/projects/app", "/projects"), false);
  assert.equal(isWithinWorkspace("/projects/app", "/elsewhere/app"), false);
});

test("listeners group ports by process and deduplicate IPv4/IPv6 wildcard entries", () => {
  assert.deepEqual(parseListeners("p123\ncnode\nf1\nn*:3000\nf2\nn*:3000\nf3\nn[::1]:3001\np456\ncOther server\nf4\nn127.0.0.1:4000\n"), [
    { pid: 123, command: "node", addresses: ["*:3000", "[::1]:3001"] },
    { pid: 456, command: "Other server", addresses: ["127.0.0.1:4000"] },
  ]);
  assert.deepEqual(parseListeners(""), []);
});
