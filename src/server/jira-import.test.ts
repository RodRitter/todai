import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jiraImportPrompt, jiraTicketUrl, parseJiraDraft } from "../domain/jira-import.ts";
import { importJiraTicket } from "./jira-import.ts";
import type { AgentProfile } from "../domain/column-agent.ts";

test("Jira URLs accept ticket links and exclude credentials, non-ticket paths and queries", () => {
  assert.equal(jiraTicketUrl(" https://team.atlassian.net/browse/PROJ-123?token=private#comment "), "https://team.atlassian.net/browse/PROJ-123");
  for (const url of ["javascript:alert(1)", "https://team.atlassian.net/", "https://user:password@team.atlassian.net/browse/PROJ-1", "http://team.atlassian.net/browse/PROJ-1", "PROJ-1"]) assert.throws(() => jiraTicketUrl(url));
});

test("import output must contain real title and description or an explicit failure", () => {
  assert.deepEqual(parseJiraDraft('{"title":"PROJ-1: Fix","description":"Requirements"}', "https://team.atlassian.net/browse/PROJ-1"), { title: "PROJ-1: Fix", description: "Source: [Jira ticket](https://team.atlassian.net/browse/PROJ-1)\n\nRequirements" });
  assert.throws(() => parseJiraDraft('{"error":"Sign in required"}', "source"), /Sign in required/);
  for (const output of ["done", "{}", '{"title":"Ticket","description":""}']) assert.throws(() => parseJiraDraft(output, "source"));
});

for (const tool of ["codex", "claude"] as const) test(`${tool} import uses dedicated read-only instructions and returns a draft`, async () => {
  const directory = await mkdtemp(join(tmpdir(), "todai-jira-test-"));
  const executable = join(directory, "executor");
  await writeFile(executable, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
 fs.writeFileSync('received.json', JSON.stringify({args,prompt}));
 const result = JSON.stringify({title:'PROJ-1: Imported ticket',description:'Acceptance criteria'});
 if (args[0] === 'exec') fs.writeFileSync(args[args.indexOf('--output-last-message')+1], result);
 else console.log(JSON.stringify({type:'result',subtype:'success',result}));
});`, { mode: 0o755 });
  const agent: AgentProfile = { id: "agent", name: "Builder", tool, model: "test", effort: "low", permissions: tool === "codex" ? "danger-full-access" : "bypassPermissions", instructions: "Implement all changes and post to Jira" };
  try {
    const draft = await importJiraTicket({ url: "https://team.atlassian.net/browse/PROJ-1", agent, workspace: directory }, executable);
    assert.equal(draft.title, "PROJ-1: Imported ticket");
    const received = JSON.parse(await readFile(join(directory, "received.json"), "utf8"));
    assert.equal(received.prompt, jiraImportPrompt("https://team.atlassian.net/browse/PROJ-1"));
    assert.ok(!received.prompt.includes(agent.instructions));
    assert.ok(received.prompt.includes("DO NOT edit any field, comment, reply, transition status"));
    assert.ok(received.prompt.includes("untrusted source data"));
    assert.ok(received.args.includes(tool === "codex" ? "read-only" : "dontAsk"));
    assert.ok(!received.args.includes(agent.permissions));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
