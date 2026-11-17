# 09: Give agents live artifact tools

**What to build:** Give both supported agent executors a live, workspace-scoped capability to publish and reuse artifacts during a run. Agents can attach results to their task or nominate them for their final comment without waiting until execution finishes to preserve the work.

**Blocked by:** 07 — Link artifacts to tasks and comments.

**Status:** ready-for-agent

- [ ] Both executors can create text artifacts, upload files, register external links, publish revisions, search/read workspace artifacts, and link or unlink task associations during execution.
- [ ] The capability derives workspace, task, and run provenance from trusted run context, not the current sidebar selection or caller-supplied ownership claims.
- [ ] Current-task artifact metadata is included in starting context. Other workspace artifacts are searchable and their content is fetched on demand rather than loading the whole library into every prompt.
- [ ] Publication copies source bytes into managed storage, returns stable artifact/revision identities, and makes the result visible before the run finishes.
- [ ] Agents can emit canonical revision references in comment text. Rich mention rendering integrates with ticket 08 when available, but does not gate live publication.
- [ ] Agents can nominate published revisions for their final comment. Pending associations resolve atomically when that comment is created, and completed agent comments retain run provenance.
- [ ] Existing feedback-request behavior continues to work alongside artifact publication and associations.
- [ ] Run-scoped access expires when execution ends. Agents cannot publish into another workspace or archive artifacts through these tools.
- [ ] Already-published artifacts and their provenance survive failure or interruption; incomplete publication remains unpublished. No nonexistent final comment is fabricated to resolve pending links.
- [ ] Checks cover both executors, live visibility, workspace isolation, final-comment linking, feedback requests, and interrupted execution.

