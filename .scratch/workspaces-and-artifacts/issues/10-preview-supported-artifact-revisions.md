# 10: Preview supported artifact revisions

**What to build:** Let people read text/Markdown, view images and screenshots, and inspect PDFs inside Todai. Keep all other file types downloadable and clearly distinguish external links.

**Blocked by:** 05 — Create the workspace artifact library.

**Status:** ready-for-agent

- [ ] The library opens in-app previews for text/Markdown, images/screenshots, and PDFs only.
- [ ] The viewer accepts an exact revision when revision history is available; task/comment references can reuse it without redirecting pinned citations to the latest content.
- [ ] Unsupported formats provide metadata and download actions without attempting Office editing, executable HTML rendering, or additional preview types.
- [ ] External links show descriptive metadata and an explicit external navigation action; they are not presented as preserved remote-content snapshots.
- [ ] Preview and download access enforce the owning workspace and never resolve arbitrary filesystem paths.
- [ ] Untrusted Markdown, filenames, and uploaded content cannot execute as application-origin code.
- [ ] Loading, missing-content, and unsupported-preview states are usable, with a download fallback where content exists.
- [ ] Checks cover the three supported preview categories, unsupported downloads, workspace isolation, and exact-revision viewing once revision support is present.
