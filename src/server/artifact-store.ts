import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { TaskStore, WorkspaceOwnershipError } from "./task-store.ts";
import { MAX_ARTIFACT_BYTES, type Artifact, type ArtifactInput, type ArtifactFilters } from "../domain/artifact.ts";

export class ArtifactError extends Error {}
export class ArtifactTooLargeError extends ArtifactError {}

const fields = "id, workspaceId, title, description, type, creator, createdAt, updatedAt, filename, mediaType, byteSize, url";

export class ArtifactStore {
  private db: DatabaseSync;
  private workspaceId: string;

  constructor(path: string, workspaceId: string) {
    if (!workspaceId) throw new WorkspaceOwnershipError("A workspace ID is required.");
    const tasks = new TaskStore(path, workspaceId);
    tasks.close();
    this.workspaceId = workspaceId;
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id),
        title TEXT NOT NULL, description TEXT NOT NULL, type TEXT NOT NULL,
        creator TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
        filename TEXT, mediaType TEXT, byteSize INTEGER, url TEXT, content BLOB
      );
      CREATE INDEX IF NOT EXISTS artifacts_workspace ON artifacts(workspaceId);`);
  }

  private assertActive() {
    if (!this.db.prepare("SELECT id FROM workspaces WHERE id = ? AND archived = 0").get(this.workspaceId))
      throw new WorkspaceOwnershipError("This workspace is unavailable. Restore it first.");
  }

  create(input: ArtifactInput): Artifact {
    this.assertActive();
    const title = required(input.title, "Title", 300);
    const creator = required(input.creator, "Creator", 200);
    const description = input.description ?? "";
    if (typeof description !== "string" || description.length > 10000) throw new ArtifactError("Description must be at most 10,000 characters.");
    let bytes: Buffer | null = null;
    let filename: string | null = null;
    let mediaType: string | null = null;
    let url: string | null = null;
    if (input.type === "link") {
      try {
        const parsed = new URL(required(input.url!, "URL", 8000));
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        url = parsed.href;
      } catch { throw new ArtifactError("Enter a valid HTTP or HTTPS URL."); }
    } else if (input.type === "file") {
      if (!(input.bytes instanceof Uint8Array)) throw new ArtifactError("Choose a file to upload.");
      bytes = Buffer.from(input.bytes);
      filename = required(input.filename!, "Filename", 255).replace(/[\x00-\x1f\x7f/\\]/g, "_");
      mediaType = input.mediaType || "application/octet-stream";
      if (!/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(mediaType))
        throw new ArtifactError("Enter a valid file media type.");
    } else if (input.type === "text" || input.type === "markdown") {
      if (typeof input.content !== "string") throw new ArtifactError("Enter artifact content.");
      bytes = Buffer.from(input.content);
      filename = input.type === "markdown" ? "artifact.md" : "artifact.txt";
      mediaType = input.type === "markdown" ? "text/markdown" : "text/plain";
    } else { throw new ArtifactError("Choose a supported artifact type."); }
    if (bytes && bytes.length > MAX_ARTIFACT_BYTES) throw new ArtifactTooLargeError("Artifacts must be 20 MiB or smaller.");
    const now = new Date().toISOString();
    const artifact: Artifact = {
      id: randomUUID(), workspaceId: this.workspaceId, title, description,
      type: input.type, creator, createdAt: now, updatedAt: now,
      filename, mediaType, byteSize: bytes?.length ?? null, url,
    };
    // Content and metadata publish together in one atomic SQLite statement.
    this.db.prepare(`INSERT INTO artifacts (${fields}, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      artifact.id, artifact.workspaceId, title, description, artifact.type, creator,
      now, now, filename, mediaType, artifact.byteSize, url, bytes,
    );
    return artifact;
  }

  list(filters: ArtifactFilters = {}): Artifact[] {
    this.assertActive();
    return this.db.prepare(`SELECT ${fields} FROM artifacts WHERE workspaceId = ?
      AND (? = '' OR instr(lower(title || ' ' || description || ' ' || coalesce(filename, '') || ' ' || coalesce(url, '')), lower(?)) > 0)
      AND (? = '' OR type = ?) AND (? = '' OR creator = ?) ORDER BY createdAt DESC, id`).all(
      this.workspaceId, filters.search ?? "", filters.search ?? "", filters.type ?? "", filters.type ?? "", filters.creator ?? "", filters.creator ?? "",
    ).map((row) => ({ ...row })) as Artifact[];
  }

  read(id: string): Artifact {
    this.assertActive();
    const artifact = this.db.prepare(`SELECT ${fields} FROM artifacts WHERE workspaceId = ? AND id = ?`).get(this.workspaceId, id) as Artifact | undefined;
    if (!artifact) throw new ArtifactError("Artifact not found in this workspace.");
    return { ...artifact };
  }

  download(id: string) {
    const artifact = this.read(id);
    if (artifact.type === "link") throw new ArtifactError("External links have no stored content.");
    const row = this.db.prepare("SELECT content FROM artifacts WHERE workspaceId = ? AND id = ?").get(this.workspaceId, id)!;
    return { artifact, bytes: Buffer.from(row.content as Uint8Array) };
  }

  close() { this.db.close(); }
}

function required(value: string, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new ArtifactError(`${label} is required and must be at most ${maximum} characters.`);
  return value.trim();
}
