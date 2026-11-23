import type { Task } from "@/domain/task";
import { formatCredits } from "@/lib/usage-format";
import { TaskId, TaskMetadataText } from "./task-id";

export function TaskCardMetadata({ task }: { task: Task }) {
  const usage = task.creditUsage;
  const value = !usage || (usage.calls > 0 && !usage.priced)
    ? null
    : formatCredits(usage.credits);
  const partial = usage && usage.priced > 0 && usage.priced < usage.calls;
  return <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
    <TaskId number={task.taskNumber} />
    {value !== null && <div className="ml-auto">
      <TaskMetadataText title={partial ? "Partial credit estimate. Some calls have no credit total." : "Estimated credit usage"}>
        {value} credits
      </TaskMetadataText>
    </div>}
  </div>;
}
