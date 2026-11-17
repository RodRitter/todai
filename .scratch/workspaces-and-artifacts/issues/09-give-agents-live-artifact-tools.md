# 09: Give agents live artifact tools

**What to build:** Give both supported agent executors a live, workspace-scoped capability to publish and reuse artifacts during a run. Agents can attach results to their task or nominate them for their final comment without waiting until execution finishes to preserve the work.

**Blocked by:** 07 — Link artifacts to tasks and comments.

**Status:** complete

- [x] Both executors can create text artifacts, upload files, register external links, publish revisions, search/read workspace artifacts, and link or unlink task associations during execution.
- [x] The capability derives workspace, task, and run provenance from trusted run context, not the current sidebar selection or caller-supplied ownership claims.
- [x] Current-task artifact metadata is included in starting context. Other workspace artifacts are searchable and their content is fetched on demand rather than loading the whole library into every prompt.
- [x] Publication copies source bytes into managed storage, returns stable artifact/revision identities, and makes the result visible before the run finishes.
- [x] Agents can emit canonical revision references in comment text. Rich mention rendering integrates with ticket 08 when available, but does not gate live publication.
- [x] Agents can nominate published revisions for their final comment. Pending associations resolve atomically when that comment is created, and completed agent comments retain run provenance.
- [x] Existing feedback-request behavior continues to work alongside artifact publication and associations.
- [x] Run-scoped access expires when execution ends. Agents cannot publish into another workspace or archive artifacts through these tools.
- [x] Already-published artifacts and their provenance survive failure or interruption; incomplete publication remains unpublished. No nonexistent final comment is fabricated to resolve pending links.
- [x] Checks cover both executors, live visibility, workspace isolation, final-comment linking, feedback requests, and interrupted execution.

