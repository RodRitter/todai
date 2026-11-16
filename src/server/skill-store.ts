import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { homedir } from "node:os";
import type { LocalSkill, SkillScope, SkillsSnapshot } from "../domain/skill.ts";

export class SkillError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function skillsDirectory() { return join(homedir(), ".agents", "skills"); }

export function parseSkillScope(input: string | null): SkillScope {
  if (input === null) return "todai";
  if (input === "workspace" || input === "todai" || input === "root") return input;
  throw new SkillError("Choose Workspace, Todai, or Root skills.");
}

export function scopeDirectory(scope: SkillScope, workspace: string, todai = process.cwd()) {
  return scope === "root" ? skillsDirectory() : join(scope === "todai" ? todai : workspace, ".agents", "skills");
}

export function saveScopedSkill(scope: SkillScope, input: unknown, workspace: string, todai = process.cwd()) {
  if (scope === "root") throw new SkillError("Root skills are read-only.", 403);
  const directory = scopeDirectory(scope, workspace, todai);
  if (!input || typeof input !== "object" || (input as { directory?: unknown }).directory !== directory) {
    throw new SkillError("The skill directory changed. Reload skills before saving.", 409);
  }
  return saveSkill(input, directory);
}

function skillPath(directory: string, id: unknown) {
  if (typeof id !== "string" || !id || id === "." || id === ".." || /[/\\\0]/.test(id)) {
    throw new SkillError("Choose a valid skill folder.");
  }
  const root = realpathSync(directory);
  const path = realpathSync(join(root, id, "SKILL.md"));
  const location = relative(root, path);
  if (location.startsWith("..") || isAbsolute(location)) {
    throw new SkillError("This skill links outside the skills directory.");
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 1024 * 1024) {
    throw new SkillError("Skills must be text files smaller than 1 MB.");
  }
  return path;
}

function readSkill(directory: string, id: string): LocalSkill {
  const path = skillPath(directory, id);
  const content = readFileSync(path, "utf8");
  return { id, path, content, revision: createHash("sha256").update(content).digest("hex") };
}

export function listSkills(directory = skillsDirectory()): SkillsSnapshot {
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { directory, skills: [] };
    throw error;
  }
  const skills: LocalSkill[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    try { skills.push(readSkill(directory, entry.name)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
  return { directory, skills };
}

export function saveSkill(input: unknown, directory: string): LocalSkill {
  let rootDirectory: string | undefined;
  try { rootDirectory = realpathSync(skillsDirectory()); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (rootDirectory) {
    const location = relative(rootDirectory, realpathSync(directory));
    if (!location || (!location.startsWith("..") && !isAbsolute(location))) {
      throw new SkillError("Root skills are read-only. Edit a Workspace or Todai skill instead.", 403);
    }
  }
  if (!input || typeof input !== "object") throw new SkillError("Send a skill and its source text.");
  const { id, content, revision } = input as Record<string, unknown>;
  if (typeof content !== "string" || Buffer.byteLength(content) > 1024 * 1024 || typeof revision !== "string") {
    throw new SkillError("Send source text smaller than 1 MB and its saved revision.");
  }
  const path = skillPath(directory, id);
  const current = readSkill(directory, id as string);
  if (current.revision !== revision) throw new SkillError("This skill changed on disk. Copy your edits, then reload before saving.", 409);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, content, { flag: "wx", mode: lstatSync(path).mode & 0o777 });
    renameSync(temporary, path);
  } finally {
    try { unlinkSync(temporary); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return readSkill(directory, id as string);
}
