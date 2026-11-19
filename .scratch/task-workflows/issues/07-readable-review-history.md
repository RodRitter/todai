# 07: Make review history readable for substantial tasks

**What to build:** Let users understand long-running development work without reading an unstructured stream: group iterations, track findings, and navigate from current actions to exact supporting evidence.

**Blocked by:** 06: Run an implement–review–revise loop

**Status:** complete

- [x] Activity groups review findings, revision work, and outcomes by workflow execution, step, and iteration; older rounds are collapsed by default.
- [x] Findings retain durable identities and explicit outstanding/resolved state. A revision agent claiming a fix does not by itself mark a finding resolved; reviewer dispositions record verification.
- [x] New review findings and dispositions connect to the previous round without inferring resolution from prose or omission.
- [x] Each review identifies its reviewed attempt and any exact artifact revisions; subsequent publication cannot silently change the evidence shown.
- [x] Overview links to outstanding findings and relevant artifacts directly. Summaries expose full original content on demand, while unrelated discussion remains accessible.
- [x] Large histories remain readable with bounded initial rendering and incremental access to older content; navigation and expansion preserve reading position.
- [x] Tests cover finding lifecycle, exact revision navigation, historical evidence, and cross-tab selection. Dense Storybook examples cover multiple rounds, many findings, long content, and many artifacts.


Verification: 202 server tests passed; typecheck, lint, and Storybook build passed (one pre-existing character-counter lint warning). Standards and spec reviews: zero remaining findings. Chrome confirmed the dense-history interaction from Overview through an older round to its pinned artifact revision. The expanded pagination-retention story compiles; its final browser rerun could not be observed because native browser input stopped responding.
