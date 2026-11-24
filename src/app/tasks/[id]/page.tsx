import { notFound } from "next/navigation";
import { resolveTaskReference } from "@/server/database";
import { TaskReferenceView } from "@/components/tasks/task-reference-view";

export default async function TaskReferencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reference = resolveTaskReference(id);
  if (!reference) notFound();
  return <TaskReferenceView task={reference.task} workspaceName={reference.workspace.name} />;
}
