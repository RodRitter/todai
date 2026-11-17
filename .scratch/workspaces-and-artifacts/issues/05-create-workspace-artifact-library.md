# 05: Create the workspace artifact library

**What to build:** Add an Artifacts page where people create text or Markdown content, upload files, and register external links. Artifacts are independent workspace-owned objects rather than attachments owned by a task.

**Blocked by:** 01 — Introduce workspace ownership for existing data.

**Status:** ready-for-agent

- [ ] People can create text/Markdown artifacts, upload files of supported storage sizes regardless of preview support, and register external URLs with descriptive metadata.
- [ ] Every artifact has a stable identity, workspace ownership, title, type, creator information, and creation/update timestamps. File records retain filename, media type, and byte size.
- [ ] The workspace-scoped Artifacts page supports search and filters for type and creator; task filtering becomes available with task links.
- [ ] Uploaded bytes are copied into managed storage associated with the application data location. Modifying or deleting the source file does not change the artifact.
- [ ] Stored artifacts can be downloaded through artifact identifiers, without exposing arbitrary filesystem paths. External links are visibly distinguished from stored content.
- [ ] Reads, uploads, downloads, and search enforce workspace ownership; switching workspace changes the artifact collection.
- [ ] Failed publication does not expose partial content or broken metadata. Upload limits and errors are clear to users.
- [ ] Checks demonstrate creation, persistence across restart, workspace isolation, source-file independence, and download behavior.

