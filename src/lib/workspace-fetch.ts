// A document owns one workspace for its entire lifetime. Switching opens a new
// document, so old drafts, timers and asynchronous callbacks cannot change owner.
let documentWorkspaceId: string | undefined;
export function selectedWorkspaceId() {
  if (typeof document === "undefined") return undefined;
  return documentWorkspaceId ??= new URL(window.location.href).searchParams.get("workspace")
    ?? document.documentElement.dataset.workspaceId;
}

let documentBoardId: string | undefined;
export function selectedBoardId() {
  if (typeof document === "undefined") return undefined;
  return documentBoardId ??= new URL(window.location.href).searchParams.get("board") ?? selectedWorkspaceId();
}

export function workspaceFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const workspaceId = selectedWorkspaceId();
  if (workspaceId) headers.set("X-Todai-Workspace", workspaceId);
  const boardId = selectedBoardId();
  if (boardId && !headers.has("X-Todai-Board")) headers.set("X-Todai-Board", boardId);
  return fetch(url, { ...options, headers });
}
