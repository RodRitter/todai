export function TaskId({ number }: { number?: number }) {
  if (number === undefined) return null;
  return <span className="block text-xs font-medium text-muted-foreground tabular-nums">TASK-{number}</span>;
}
