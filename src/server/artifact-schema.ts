import type { DatabaseSync } from "node:sqlite";

export function initializeArtifactSchema(db: DatabaseSync) {
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
  // The schema initializer owns the migration transaction.
  for (const name of ["runId", "taskId"]) {
    if (!db.prepare("PRAGMA table_info(artifacts)").all().some((column) => column.name === name))
      db.exec(`ALTER TABLE artifacts ADD COLUMN ${name} TEXT`);
  }
  if (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifact_revisions'").get()) {
    const columns = db.prepare("PRAGMA table_info(artifact_revisions)").all();
    if (columns.some((column) => column.name === "runId")) {
      db.exec(`UPDATE artifacts SET
        runId = (SELECT runId FROM artifact_revisions r WHERE r.id = artifacts.id ORDER BY revisionNumber DESC LIMIT 1),
        taskId = (SELECT taskId FROM artifact_revisions r WHERE r.id = artifacts.id ORDER BY revisionNumber DESC LIMIT 1)`);
    }
  }
  if (db.prepare("PRAGMA table_info(comment_artifacts)").all().some((column) => column.name === "revisionId")) {
    db.exec(`CREATE TABLE comment_artifacts_documents (
      commentId TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      artifactId TEXT NOT NULL REFERENCES artifacts(id),
      PRIMARY KEY(commentId, artifactId)
    );
    INSERT OR IGNORE INTO comment_artifacts_documents SELECT commentId, artifactId FROM comment_artifacts;
    DROP TABLE comment_artifacts;
    ALTER TABLE comment_artifacts_documents RENAME TO comment_artifacts;`);
  }
  db.exec("DROP TABLE IF EXISTS artifact_revisions");

  db.exec(`CREATE TABLE IF NOT EXISTS task_artifacts (
    taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    artifactId TEXT NOT NULL REFERENCES artifacts(id),
    PRIMARY KEY(taskId, artifactId)
  );
  CREATE TABLE IF NOT EXISTS comment_artifacts (
    commentId TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    artifactId TEXT NOT NULL REFERENCES artifacts(id),
    PRIMARY KEY(commentId, artifactId)
  );`);
}
