export function exportFilename(kind: "board" | "workspace", title: string): string {
  const name = title.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return `todai-${kind}-${name || "untitled"}.json`;
}
