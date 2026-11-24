import assert from "node:assert/strict";
import test from "node:test";
import { runDuration, formatRunDuration } from "../src/domain/run-duration.ts";

test("elapsed duration uses the run start and final duration stays fixed", () => {
  const start = "2026-11-24T10:00:00Z";
  const end = "2026-11-24T10:01:23Z";
  assert.equal(runDuration(start, null, Date.parse(end)), 83);
  assert.equal(runDuration(start, end, Date.parse(end) + 900000), 83);
  assert.equal(runDuration(null, null, Date.now()), null);
  assert.equal(runDuration("invalid", end, Date.now()), null);
  assert.equal(runDuration(start, "invalid", Date.now()), null);
  assert.equal(runDuration(start, null, Date.parse(start) - 1000), 0);
  assert.equal(formatRunDuration(0), "0s");
  assert.equal(formatRunDuration(83), "1m 23s");
  assert.equal(formatRunDuration(3661), "1h 1m 1s");
});
