import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const excluded = new Set([".git", "node_modules", ".next", "storybook-static", ".aws", ".ssh", ".todai"]);
function allowed(path: string) {
  return !path.split(/[\\/]/).some(part => excluded.has(part) || /^\.env(?:\.|$)/.test(part) || /\.(?:sqlite|db|pem|key)(?:-|$)/i.test(part));
}
function projectPath(root: string, path: string) {
  if (!root) throw new Error("This workspace has no project directory.");
  const base = realpathSync(root), candidate = resolve(base, path);
  const within = (value: string) => { const local = relative(base, value); return local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local) && allowed(local); };
  if (!within(candidate)) throw new Error("Choose a project path in this workspace.");
  const actual = realpathSync(candidate);
  if (!within(actual)) throw new Error("Choose a project path in this workspace.");
  return actual;
}
export function pageNumber(value: unknown, fallback: number, maximum = 1000000) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error(`Enter a whole number from 0 to ${maximum}.`);
  return value;
}
export function textPage(text: string, offset: number, limit: number) {
  return { content: text.slice(offset, offset + limit), total: text.length, nextOffset: offset + limit < text.length ? offset + limit : null };
}
function readText(path: string) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("Choose a text file no larger than 1 MiB.");
  const bytes = readFileSync(path);
  if (bytes.includes(0)) throw new Error("Choose a text file.");
  return bytes.toString("utf8");
}
export function readProjectFile(root: string, path: string, offset: number, limit: number) {
  return { path, ...textPage(readText(projectPath(root, path)), offset, limit) };
}
export function listProjectFiles(root: string, path: string, offset: number, limit: number) {
  const entries = readdirSync(projectPath(root, path), { withFileTypes: true })
    .filter(entry => allowed(entry.name) && !entry.isSymbolicLink() && (entry.isFile() || entry.isDirectory()))
    .map(entry => ({ name: entry.name, type: entry.isDirectory() ? "directory" : "file" })).sort((a, b) => a.name.localeCompare(b.name));
  return { path, entries: entries.slice(offset, offset + limit), total: entries.length, nextOffset: offset + limit < entries.length ? offset + limit : null };
}
export function searchProjectFiles(root: string, path: string, query: string) {
  if (!query.trim() || query.length > 500) throw new Error("Enter search text between 1 and 500 characters.");
  const base = projectPath(root, path), matches: { path: string; line: number; text: string }[] = [];
  let scanned = 0, skipped = 0, bytesRead = 0, truncated = false;
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!allowed(entry.name) || entry.isSymbolicLink()) continue;
      if (++scanned > 2000 || matches.length >= 100) { truncated = true; return; }
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        let text: string;
        try { text = readText(file); } catch { skipped++; continue; }
        bytesRead += Buffer.byteLength(text);
        if (bytesRead > 8 * 1024 * 1024) { truncated = true; return; }
        for (const [index, line] of text.split("\n").entries()) {
          if (line.toLowerCase().includes(query.toLowerCase())) matches.push({ path: relative(realpathSync(root), file), line: index + 1, text: line.slice(0, 1000) });
          if (matches.length >= 100) { truncated = true; return; }
        }
      }
      if (truncated) return;
    }
  };
  visit(base);
  return { matches, truncated, skipped, guidance: "Search a narrower directory if results are truncated. Binary files, large files, generated directories, and credential files are excluded." };
}
