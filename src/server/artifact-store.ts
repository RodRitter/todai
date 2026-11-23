import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { TaskStore, WorkspaceOwnershipError } from "./task-store.ts";
import { MAX_ARTIFACT_BYTES, type Artifact, type ArtifactInput, type ArtifactFilters, type TaskArtifact } from "../domain/artifact.ts";

export type ChatArtifactScope = { sessionId: string; lease: string; taskId: string; creator: string };

export class ArtifactError extends Error {}
export class ArtifactTooLargeError extends ArtifactError {}

const fields = "id, workspaceId, title, description, type, creator, createdAt, updatedAt, filename, mediaType, byteSize, url";

export class ArtifactStore {
  private db: DatabaseSync;
  private workspaceId: string;

  private runId?: string;
  private chat?: ChatArtifactScope;

  constructor(path: string, workspaceId: string, runId?: string, chat?: ChatArtifactScope) {
    this.runId = runId;
    this.chat = chat;
    if (!workspaceId) throw new WorkspaceOwnershipError("A workspace ID is required.");
    const tasks = new TaskStore(path, workspaceId);
    tasks.close();
    this.workspaceId = workspaceId;
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  }

  private assertActive() {
    if (this.chat && !this.db.prepare("SELECT id FROM chat_sessions WHERE id = ? AND workspaceId = ? AND taskId = ? AND lease = ? AND lease > ?")
      .get(this.chat.sessionId, this.workspaceId, this.chat.taskId, this.chat.lease, new Date().toISOString()))
      throw new ArtifactError("Artifact access has expired.");
    if (!this.db.prepare("SELECT id FROM workspaces WHERE id = ? AND archived = 0").get(this.workspaceId))
      throw new WorkspaceOwnershipError("This workspace is unavailable. Restore it first.");
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = operation(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  create(input: ArtifactInput): Artifact {
    return this.publish(input);
  }

  revise(id: string, input: ArtifactInput): Artifact {
    return this.publish(input, id);
  }

  private publish(input: ArtifactInput, id?: string): Artifact {
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
    return this.transaction(() => {
      this.assertActive();
      if (this.chat && creator !== this.chat.creator) throw new ArtifactError("Creator must match the chat agent.");
      const run = this.runId ? this.db.prepare("SELECT taskId, profile FROM runs WHERE id = ? AND workspaceId = ? AND status = 'Running' AND stopRequested IS NULL AND interruptionColumn IS NULL").get(this.runId, this.workspaceId) : undefined;
      if (this.runId && !run) throw new ArtifactError("Artifact access has expired.");
      if (run && JSON.parse(run.profile as string).name !== creator) throw new ArtifactError("Creator must match the running agent.");
      const previous = id ? this.read(id) : undefined;
      const now = new Date().toISOString();
      const artifact: Artifact = {
        id: id ?? randomUUID(), revisionId: randomUUID(), revisionNumber: (previous?.revisionNumber ?? 0) + 1, archived: previous?.archived ?? false, workspaceId: this.workspaceId, title, description,
        type: input.type, creator, createdAt: previous?.createdAt ?? now, updatedAt: now,
        filename, mediaType, byteSize: bytes?.length ?? null, url,
      };
      // The latest snapshot and immutable revision publish in one transaction.
      this.db.prepare(`INSERT INTO artifacts (${fields}, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description,
        type=excluded.type, creator=excluded.creator, updatedAt=excluded.updatedAt, filename=excluded.filename,
        mediaType=excluded.mediaType, byteSize=excluded.byteSize, url=excluded.url, content=excluded.content`).run(
        artifact.id, artifact.workspaceId, title, description, artifact.type, creator,
        artifact.createdAt, now, filename, mediaType, artifact.byteSize, url, bytes,
      );
      this.db.prepare(`INSERT INTO artifact_revisions (${fields}, content, revisionId, revisionNumber)
        SELECT ${fields}, content, ?, ? FROM artifacts WHERE id = ?`).run(artifact.revisionId, artifact.revisionNumber, artifact.id);
      if (run) this.db.prepare("UPDATE artifact_revisions SET runId = ?, taskId = ? WHERE revisionId = ?").run(this.runId!, run.taskId, artifact.revisionId);
      if (this.chat) this.db.prepare("UPDATE artifact_revisions SET taskId = ? WHERE revisionId = ?").run(this.chat.taskId, artifact.revisionId);
      return this.read(artifact.id, artifact.revisionId);
    });
  }

  private assertTask(taskId: string) {
    this.assertActive();
    if (typeof taskId !== "string" || !this.db.prepare("SELECT id FROM tasks WHERE id = ? AND workspaceId = ?").get(taskId, this.workspaceId))
      throw new ArtifactError("Task not found in this workspace.");
  }

  linkTask(taskId: string, artifactId: string) {
    return this.transaction(() => {
      this.assertTask(taskId);
      this.read(artifactId);
      this.db.prepare("INSERT OR IGNORE INTO task_artifacts (taskId, artifactId) VALUES (?, ?)").run(taskId, artifactId);
    });
  }

  unlinkTask(taskId: string, artifactId: string) {
    this.assertTask(taskId);
    this.db.prepare("DELETE FROM task_artifacts WHERE taskId = ? AND artifactId = ?").run(taskId, artifactId);
  }

  forTask(taskId: string): TaskArtifact[] {
    this.assertTask(taskId);
    const links = this.db.prepare("SELECT artifactId FROM task_artifacts WHERE taskId = ? ORDER BY artifactId").all(taskId);
    const citations = this.db.prepare(`SELECT ca.artifactId, ca.revisionId, ca.commentId FROM comment_artifacts ca
      JOIN comments c ON c.id = ca.commentId WHERE c.taskId = ? AND c.workspaceId = ? ORDER BY c.createdAt, c.id, ca.revisionId`).all(taskId, this.workspaceId);
    const ids = new Set([...links, ...citations].map((row) => row.artifactId as string));
    return [...ids].map((id) => ({
      artifact: this.read(id), explicit: links.some((row) => row.artifactId === id),
      comments: citations.filter((row) => row.artifactId === id).map((row) => ({
        commentId: row.commentId as string, artifact: this.read(id, row.revisionId as string),
      })),
    }));
  }

  list(filters: ArtifactFilters = {}): Artifact[] {
    this.assertActive();
    if (filters.taskId) this.assertTask(filters.taskId);
    return this.db.prepare(`SELECT ${fields} FROM artifacts WHERE workspaceId = ? AND archived = ?
      AND (? = '' OR instr(lower(title || ' ' || description || ' ' || coalesce(filename, '') || ' ' || coalesce(url, '')), lower(?)) > 0)
      AND (? = '' OR type = ?) AND (? = '' OR creator = ?)
      AND (? = '' OR id IN (SELECT artifactId FROM task_artifacts WHERE taskId = ?
        UNION SELECT ca.artifactId FROM comment_artifacts ca JOIN comments c ON c.id = ca.commentId WHERE c.taskId = ? AND c.workspaceId = ?)) ORDER BY createdAt DESC, id`).all(
      this.workspaceId, filters.archived ? 1 : 0, filters.search ?? "", filters.search ?? "", filters.type ?? "", filters.type ?? "", filters.creator ?? "", filters.creator ?? "", filters.taskId ?? "", filters.taskId ?? "", filters.taskId ?? "", this.workspaceId,
    ).map((row) => this.read(row.id as string));
  }

  read(id: string, revisionId?: string): Artifact {
    this.assertActive();
    const artifact = this.db.prepare(`SELECT ${fields}, revisionId, revisionNumber, runId, taskId FROM artifact_revisions
      WHERE workspaceId = ? AND id = ? AND (? IS NULL OR revisionId = ?)
      ORDER BY revisionNumber DESC LIMIT 1`).get(this.workspaceId, id, revisionId ?? null, revisionId ?? null);
    if (!artifact) throw new ArtifactError("Artifact not found in this workspace.");
    const current = this.db.prepare("SELECT archived FROM artifacts WHERE id = ? AND workspaceId = ?").get(id, this.workspaceId)!;
    return { ...artifact, archived: Boolean(current.archived) } as Artifact;
  }

  archive(id: string): Artifact {
    this.read(id);
    this.db.prepare("UPDATE artifacts SET archived = 1 WHERE id = ? AND workspaceId = ?").run(id, this.workspaceId);
    return this.read(id);
  }

  history(id: string): Artifact[] {
    this.read(id);
    return this.db.prepare("SELECT revisionId FROM artifact_revisions WHERE workspaceId = ? AND id = ? ORDER BY revisionNumber DESC")
      .all(this.workspaceId, id).map((row) => this.read(id, row.revisionId as string));
  }

  download(id: string, revisionId?: string) {
    const artifact = this.read(id, revisionId);
    if (artifact.type === "link") throw new ArtifactError("External links have no stored content.");
    const row = this.db.prepare("SELECT content FROM artifact_revisions WHERE workspaceId = ? AND id = ? AND revisionId = ?").get(this.workspaceId, id, artifact.revisionId)!;
    return { artifact, bytes: Buffer.from(row.content as Uint8Array) };
  }

  close() { this.db.close(); }
}

function required(value: string, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new ArtifactError(`${label} is required and must be at most ${maximum} characters.`);
  return value.trim();
}
