import {
  accessSync,
  constants,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { TaskStore } from "./task-store.ts";

export class WorkspaceValidationError extends Error {}

function expandPath(path: string) {
  return path === "~"
    ? homedir()
    : path.startsWith("~/")
      ? join(homedir(), path.slice(2))
      : resolve(path);
}

export function validateWorkspace(input: unknown): string {
  if (typeof input !== "string" || !input.trim() || input.includes("\0")) {
    throw new WorkspaceValidationError("Enter an existing directory path.");
  }
  try {
    const path = realpathSync(expandPath(input.trim()));
    if (!statSync(path).isDirectory()) throw new Error("Not a directory");
    accessSync(path, constants.R_OK | constants.X_OK);
    return path;
  } catch {
    throw new WorkspaceValidationError(
      "Choose an existing directory that Todai can access.",
    );
  }
}

export function workspacePath(store: TaskStore) {
  return store.getWorkspacePath() ?? resolve("workspace");
}

export function executionWorkspace(store: TaskStore) {
  const path = workspacePath(store);
  // Preserve the default for installations that have not selected a directory yet.
  if (!store.getWorkspacePath()) mkdirSync(path, { recursive: true });
  return validateWorkspace(path);
}

export function suggestDirectories(query: string): string[] {
  if (query.includes("\0"))
    throw new WorkspaceValidationError("Enter a valid directory path.");
  const input = query || "~/";
  const expanded = expandPath(input);
  const browsing = input.endsWith(sep) || input === "~";
  const parent = browsing ? expanded : dirname(expanded);
  const prefix = browsing ? "" : basename(expanded);
  const displayParent = browsing
    ? input === "~"
      ? "~/"
      : input
    : input.slice(0, input.lastIndexOf(sep) + 1);
  try {
    return readdirSync(parent, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.name.startsWith(prefix) &&
          (entry.isDirectory() ||
            (entry.isSymbolicLink() &&
              (() => {
                try {
                  return statSync(join(parent, entry.name)).isDirectory();
                } catch {
                  return false;
                }
              })())),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50)
      .map((entry) => `${displayParent}${entry.name}/`);
  } catch {
    throw new WorkspaceValidationError(
      "Could not read this directory. Check the path and permissions.",
    );
  }
}
