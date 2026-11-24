export function taskReference(id: string): string {
  return `[Task ${id.replace(/[\[\]\\]/g, "") }](#task/${encodeURIComponent(id)})`;
}

export function parseTaskReference(href: string): string | null {
  const match = /^#task\/([^/]+)$/.exec(href);
  if (match) {
    try { return decodeURIComponent(match[1]); } catch { return null; }
  }
  // Keep previously saved local task links working.
  if (href.startsWith("/?")) return new URL(href, "http://todai.local").searchParams.get("task");
  return null;
}

export function normalizeTaskReferences(text: string): string {
  const direct = parseTaskReference(text.trim());
  if (direct) return taskReference(direct);
  return text.replace(/\[[^\]\n]*\]\((\/\?[^)\s]+)\)/g, (original, href: string) => {
    const id = parseTaskReference(href);
    return id ? taskReference(id) : original;
  });
}
