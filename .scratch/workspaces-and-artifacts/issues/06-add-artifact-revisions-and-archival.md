# 06: Add artifact revisions and archival

**What to build:** Let artifacts evolve without changing previously published evidence. Updates create immutable revisions under one artifact identity, and people can archive artifacts while keeping historical references readable.

**Blocked by:** 05 — Create the workspace artifact library.

**Status:** ready-for-agent

- [ ] Updating text, replacing a stored file, or changing an external link creates a new immutable revision with author and timestamp provenance.
- [ ] People can inspect revision history and retrieve the exact contents and metadata of an earlier revision.
- [ ] Concurrent updates preserve every successfully published revision without overwriting historical bytes or producing ambiguous revision identities.
- [ ] External-link revisions preserve URL and metadata only. The interface makes clear that remote content may change; publishing a stored copy is required to preserve its contents.
- [ ] People can archive artifacts. Archived artifacts are omitted from normal discovery but remain accessible through existing references and an explicit archived view.
- [ ] Archival preserves all revisions and stored content. Permanent deletion is outside this feature's scope.
- [ ] Agent-facing publication permissions do not include artifact archival; agents may publish revisions and unlink associations when those capabilities are introduced.
- [ ] Checks verify immutable historical content, concurrent revision creation, and retained access after archival.

