---
name: todai-diagnosing-bugs
description: Diagnose bugs through Todai’s Diagnose and approval-gated Fix stages. Use for bug diagnosis board tasks or requests to follow the Todai diagnosis workflow.
---

# Todai bug diagnosis

Follow your assigned role below, consuming the task description and previous comments. Final responses become task comments automatically. Without an assigned role, diagnose and report; repair requires explicit human approval.

Read workspace AGENTS.md, CONTEXT.md if present, and relevant ADRs. Redact secrets as `<REDACTED>` and reference credentials through environment variables. Preserve unrelated work. Publish substantial evidence through available artifact tools and cite exact revisions in handovers.

## Diagnose — Diagnostician

1. Establish the exact symptom and expected behavior. Build a tight feedback loop before causal theories: prefer a failing test, HTTP/CLI replay, browser assertion, or minimal harness exercising the actual path. Run it and record the command, redacted output, and environment assumptions. Assert the specific symptom, not simply absence of a crash.
2. Reproduce repeatedly and minimise inputs and steps while retaining failure. For intermittent bugs, record attempts and failure rate, pin randomness where possible, and raise reproduction frequency. For performance bugs, establish a measured baseline first.
3. State 3–5 ranked hypotheses with falsifiable predictions before testing; use fewer when evidence supports fewer. Expose the ranking in a progress update or evidence artifact. Test one variable at a time, preferring debugger inspection or targeted probes. Tag temporary logs with a unique `[DEBUG-...]` prefix.
4. Record supported, contradicted, and untested predictions. Reproducing a symptom does not itself prove its cause. Reversible diagnostic experiments are permitted; permanent production repairs belong to the fixer.
5. Remove your temporary instrumentation and experiments without reverting others’ changes. Retain useful reproduction tests or clearly identified diagnostic harnesses and document expected failures and invocation commands.

Handover: begin with **Issue summary**, a paragraph of 2–3 short sentences (60 words maximum) that states your understanding of the issue. Summarize the reported symptom, expected behavior, and relevant trigger or affected scope when known. Identify material uncertainty and distinguish reported behavior from verified observations. Keep causal findings and experiment details in the supporting report.

Then give the reproduction command and result; minimal scenario; ranked hypotheses and experiment outcomes; evidence locations; retained diagnostic files; limitations and next action. Link detailed evidence instead of repeating logs.

### Unavailable reproduction

Document attempts and missing evidence or access. Inspect code and report only evidence-backed leads explicitly marked **unconfirmed**, each with a falsifying check. This intentionally relaxes the original diagnosing-bugs skill’s reproduction gate, but never licenses a confirmed causal claim. Request human feedback when no useful independent work remains. Never fabricate successful commands or reproduction.

## Fix — Bug fixer

The Bug fixer profile enables **Require approval before edits** in agent setup. Follow that injected policy and use the diagnosis to prepare the repair proposal. When running this role outside Todai, obtain explicit human approval of the repair proposal before editing.

### Approved repair

1. Confirm the selected issue with the reproduction. Report any gap rather than repairing an untested lead as though proven.
2. Add a regression test before the fix at a seam exercising the real bug pattern, and watch it fail. If no correct seam exists, document that limitation rather than adding a shallow test that gives false confidence.
3. Apply the smallest supported fix within the approved scope.
4. Run the regression test, original un-minimised reproduction, and relevant existing checks. Report actual failures and incomplete verification.
5. Remove your temporary instrumentation and experiments while preserving unrelated work and useful regression tests.

Finish with a concise repair report: cause, change, verification, and unresolved issues. Clearly state when verification fails or the bug remains unresolved. Commits, deployments, and external publication require separate authorization.

## Human feedback

Stop and make the entire final response valid JSON with exactly these fields, without Markdown fences:

{"type":"feedback_request","question":"Specific question with sufficient context","recommendation":"Recommended answer and reasoning"}

Todai pauses the task and resumes the same agent with the Human answer. Do no further work in the run after requesting feedback.

## Configuration

[assets/board-configuration.json](assets/board-configuration.json) defines five columns and three profiles. Resolve `{{SKILL_PATH}}` to this skill’s absolute installed path before import. Select the target workspace and board explicitly. Column replacement resets task statuses: use it only on an empty board; preserve populated boards through deliberate column updates. Reuse installed profile IDs on updates to prevent duplicates. Task Auto-run and Auto-workflow remain existing opt-in controls.
