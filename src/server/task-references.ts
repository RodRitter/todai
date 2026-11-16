import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { TaskReference } from "../domain/reference.ts";
import { listSkills, scopeDirectory } from "./skill-store.ts";

const excluded = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", "storybook-static"]);

export function skillReferences(workspace: string, query: string, todai = process.cwd()): TaskReference[] {
  const references = new Map<string, TaskReference>();
  for (const scope of ["workspace", "todai", "root"] as const) {
    for (const skill of listSkills(scopeDirectory(scope, workspace, todai)).skills) {
      if (!skill.id.toLowerCase().includes(query.toLowerCase())) continue;
      if (!references.has(skill.path)) references.set(skill.path, {
        kind: "skill", label: `$${skill.id}`, path: skill.path, detail: `${scope} · ${skill.path}`,
      });
    }
  }
  return [...references.values()].slice(0, 40);
}

// Bound traversal and never follow symlinks outside the selected workspace.
export async function fileReferences(workspace: string, query: string): Promise<TaskReference[]> {
  const results: TaskReference[] = [];
  const pending = [{ path: workspace, relative: "", depth: 0 }];
  let visited = 0;
  while (pending.length && results.length < 40 && visited < 20000) {
    const directory = pending.shift()!;
    let entries;
    try { entries = await readdir(directory.path, { withFileTypes: true }); }
    catch (error) {
      if (directory.depth === 0) throw error;
      continue;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (++visited > 20000 || results.length >= 40) break;
      if (excluded.has(entry.name) || entry.name.startsWith(".")) continue;
      const relative = directory.relative + entry.name;
      const path = join(directory.path, entry.name);
      if (entry.isDirectory() && directory.depth < 20) {
        pending.push({ path, relative: `${relative}/`, depth: directory.depth + 1 });
      } else if (entry.isFile() && relative.toLowerCase().includes(query.toLowerCase())) {
        results.push({ kind: "file", label: `@${relative}`, path, detail: relative });
      }
    }
  }
  return results;
}
