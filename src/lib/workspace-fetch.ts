// Each page receives a stable workspace identity from the server. Capture it when
// the request starts so a later view change cannot redirect an in-flight write.
export function workspaceFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const workspaceId = typeof document === "undefined"
    ? undefined
    : document.documentElement.dataset.workspaceId;
  if (workspaceId) headers.set("X-Todai-Workspace", workspaceId);
  return fetch(url, { ...options, headers });
}
