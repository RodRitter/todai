# 05: Add human checkpoints and actionable feedback

**What to build:** Add explicit human approval checkpoints to workflows and present both checkpoints and agent questions as current actions in task details, with durable answers and correct resumption.

**Blocked by:** 04: Compose and execute ordered workflows visually

**Status:** complete

- [x] The editor can insert a human approval checkpoint with instructions describing what the human must review.
- [x] Reaching a checkpoint durably waits without starting subsequent steps. Overview shows its question or decision, recommendation when supplied, and relevant results or pinned artifact revisions.
- [x] Approval advances exactly once; a request for changes records feedback and keeps the checkpoint waiting for explicit recovery or revision rather than silently approving or inventing a backward path.
- [x] Agent questions retain freeform replies and resume the originating step, distinct from human approval of completed work.
- [x] Activity records the request, author, response, and originating execution. Overview and Activity render the same records rather than independent copies.
- [x] Stale or duplicate answers cannot advance a newer execution. Waiting state and answers survive restarts.
- [x] Tests cover approval, continued waiting after changes requested, agent question/resume, stale answers, duplicate submissions, and evidence navigation. Storybook includes lengthy questions and substantial review evidence.


Verification: 180 server integration tests passed; typecheck, lint (one existing workspace warning), and Storybook build passed. Standards and spec reviews have no remaining findings. Browser interaction and visual verification remain pending because the browser access host was unavailable.
