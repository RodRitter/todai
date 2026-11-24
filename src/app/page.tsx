import { PersistentWorkspace } from "@/components/tasks/persistent-workspace";
import { resolveTaskReference } from "@/server/database";
import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const { task } = await searchParams;
  if (typeof task === "string" && resolveTaskReference(task)?.task.archivedAt)
    redirect(`/tasks/${encodeURIComponent(task)}`);
  return <PersistentWorkspace />;
}
