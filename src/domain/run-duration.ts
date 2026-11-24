export function runDuration(startedAt: string | null | undefined, finishedAt: string | null | undefined, now: number): number | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  const end = finishedAt ? Date.parse(finishedAt) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function formatRunDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remaining = seconds % 60;
  return hours ? `${hours}h ${minutes}m ${remaining}s` : minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}
