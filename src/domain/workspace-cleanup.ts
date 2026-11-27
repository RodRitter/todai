export type CleanupKind = "task" | "artifact" | "memory";
export type CleanupRecord = { kind: CleanupKind; id: string; title: string; reason: string };
export type CleanupConfirmation = { retentionDays: number; asOf: string; token: string };
export type CleanupPreview = CleanupConfirmation & {
  remove: CleanupRecord[];
  keep: CleanupRecord[];
  counts: Record<CleanupKind, number>;
  blocked: string | null;
};
