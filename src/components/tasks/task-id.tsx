import type { ComponentProps } from "react";

export function TaskMetadataText(props: Omit<ComponentProps<"span">, "className">) {
  return <span className="block text-xs font-medium text-muted-foreground tabular-nums" {...props} />;
}

export function TaskId({ number }: { number?: number }) {
  if (number === undefined) return null;
  return <TaskMetadataText>TASK-{number}</TaskMetadataText>;
}
