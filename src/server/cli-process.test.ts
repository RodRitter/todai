import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "./cli-process.ts";

test("successful cleanup does not signal the stopped process group again", async (t) => {
  const kill = process.kill.bind(process);
  let stoppedPid: number | undefined;
  t.mock.method(process, "kill", (pid: number, signal?: NodeJS.Signals | number) => {
    if (signal === "SIGKILL" && pid === stoppedPid) {
      throw Object.assign(new Error("kill EPERM"), { code: "EPERM" });
    }
    const result = kill(pid, signal);
    if (signal === "SIGKILL") stoppedPid = pid;
    return result;
  });
  const output = await runCli({
    executable: process.execPath,
    label: "Cleanup test",
    args: ["-e", `
      require("node:child_process").spawn(process.execPath,
        ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }).unref();
      console.log("Complete");
    `],
    cwd: process.cwd(),
    stopChildren: true,
  });
  assert.ok(stoppedPid);
  assert.equal(output.trim(), "Complete");
});

test("cleanup waits when the process-group check temporarily returns EPERM", async (t) => {
  const kill = process.kill.bind(process);
  let denied = false;
  t.mock.method(process, "kill", (pid: number, signal?: NodeJS.Signals | number) => {
    if (signal === 0 && !denied) {
      denied = true;
      throw Object.assign(new Error("kill EPERM"), { code: "EPERM" });
    }
    return kill(pid, signal);
  });
  const output = await runCli({
    executable: process.execPath,
    label: "Cleanup test",
    args: ["-e", `
      require("node:child_process").spawn(process.execPath,
        ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }).unref();
      console.log("Complete");
    `],
    cwd: process.cwd(),
    stopChildren: true,
  });
  assert.equal(denied, true);
  assert.equal(output.trim(), "Complete");
});
