# 08: Reference artifacts inside comment text

**What to build:** Add a workspace-scoped artifact picker to comment composition so people can cite artifacts naturally in prose. Saved references show the artifact title, open the cited revision, and form tracked comment associations.

**Blocked by:** 07 — Link artifacts to tasks and comments.

**Status:** complete

- [x] People can search and select workspace artifacts from the comment editor without interfering with existing agent, skill, or file references.
- [x] Selection captures an explicit revision identity. If a new revision appears while the comment is being composed, posting preserves the revision selected by the author.
- [x] Saved references render as titled, clickable artifact mentions and open the exact cited revision using the available viewer or download behavior.
- [x] Posting atomically validates references and records their comment associations; malformed or cross-workspace references cannot create unauthorized links.
- [x] References survive Markdown serialization and reload, and the same stable artifact/revision representation can be emitted by agents.
- [x] References remain readable after artifact archival. Subsequent artifact updates never silently change saved citations.
- [x] Checks cover editor round trips, revision changes during composition, repeated mentions, and association consistency.

