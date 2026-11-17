import type { DatabaseSync } from "node:sqlite";

export function initializeArtifactSchema(db: DatabaseSync) {
  const fields = "id, workspaceId, title, description, type, creator, createdAt, updatedAt, filename, mediaType, byteSize, url";
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY, workspaceId TEXT NOT NULL REFERENCES workspaces(id),
      title TEXT NOT NULL, description TEXT NOT NULL, type TEXT NOT NULL,
      creator TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      filename TEXT, mediaType TEXT, byteSize INTEGER, url TEXT, content BLOB
    );
    CREATE INDEX IF NOT EXISTS artifacts_workspace ON artifacts(workspaceId);`);

  const columns = db.prepare("PRAGMA table_info(artifacts)").all();
  if (!columns.some((column) => column.name === "archived"))
    db.exec("ALTER TABLE artifacts ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  db.exec(`CREATE TABLE IF NOT EXISTS artifact_revisions (
      id TEXT NOT NULL REFERENCES artifacts(id), workspaceId TEXT NOT NULL REFERENCES workspaces(id),
      title TEXT NOT NULL, description TEXT NOT NULL, type TEXT NOT NULL,
      creator TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      filename TEXT, mediaType TEXT, byteSize INTEGER, url TEXT, content BLOB,
      revisionId TEXT PRIMARY KEY, revisionNumber INTEGER NOT NULL,
      UNIQUE(id, revisionNumber)
    );
    INSERT INTO artifact_revisions (${fields}, content, revisionId, revisionNumber)
      SELECT ${fields}, content, id, 1 FROM artifacts a
      WHERE NOT EXISTS (SELECT 1 FROM artifact_revisions r WHERE r.id = a.id);`);

  const revisionColumns = db.prepare("PRAGMA table_info(artifact_revisions)").all();
  if (!revisionColumns.some((column) => column.name === "runId")) {
    db.exec("ALTER TABLE artifact_revisions ADD COLUMN runId TEXT; ALTER TABLE artifact_revisions ADD COLUMN taskId TEXT");
  }

  db.exec(`CREATE TABLE IF NOT EXISTS task_artifacts (
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    artifactId TEXT NOT NULL REFERENCES artifacts(id),
    PRIMARY KEY(taskId, artifactId)
  );
  CREATE TABLE IF NOT EXISTS comment_artifacts (
    commentId TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    artifactId TEXT NOT NULL REFERENCES artifacts(id),
    revisionId TEXT NOT NULL REFERENCES artifact_revisions(revisionId),
    PRIMARY KEY(commentId, artifactId, revisionId)
  );`);
}
