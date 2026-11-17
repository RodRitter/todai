# 07: Link artifacts to tasks and comments

**What to build:** Let people attach existing artifacts to tasks and comments without copying them. Task-level links show the latest revision, while comment attachments preserve the specific revision cited.

**Blocked by:** 06 — Add artifact revisions and archival.

**Status:** complete

- [x] A single artifact can be linked to multiple tasks and comments in its workspace without duplicating its content.
- [x] Task details display explicit task links and artifacts referenced by that task's comments without duplicate cards or ambiguous provenance.
- [x] Explicit task links follow the latest revision; comment attachments store an exact revision identity and remain unchanged after subsequent revisions.
- [x] Comment attachments can be selected while composing a new comment; no general comment-editing feature is required.
- [x] Link creation verifies that artifact, revision, task, and comment belong to the same workspace and that the comment belongs to the referenced task.
- [x] Removing an explicit task link does not remove a historical comment reference. Deleting a task or comment does not delete its artifacts or revisions.
- [x] Archived artifacts remain readable from existing links. The library supports filtering by linked task.
- [x] Checks cover reuse, revision pinning, cross-workspace rejection, and artifact survival after task deletion.

