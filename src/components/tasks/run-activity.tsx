"use client";

import { Fragment, useEffect, useState } from "react";
import { CircleCheck, CircleX, Clock, List, LoaderCircle } from "lucide-react";
import type { RunActivity as Activity } from "@/domain/execution";
import { runDuration } from "@/domain/run-duration";
import { activityLabel } from "@/domain/activity-summary";
import { Trace, TraceCollapsible, TraceCollapsibleContent, TraceCollapsibleTrigger, TraceIcon, TraceLine, TraceTitle, TraceCode, TraceDuration } from "@/components/ui/trace";

export function RunActivity({ activity, running, agentName, queued = false, startedAt, finishedAt, active = true }: { activity: Activity[]; running: boolean; agentName?: string; queued?: boolean; startedAt?: string | null; finishedAt?: string | null; active?: boolean }) {
  const hiddenCount = running ? Math.max(0, activity.length - 5) : 0;
  const visibleActivity = activity.slice(hiddenCount);
  const [open, setOpen] = useState<boolean>();
  const status = running ? "running" : queued ? "pending" : "complete";
  const Icon = running ? LoaderCircle : queued ? Clock : List;
  const count = `${activity.length} ${activity.length === 1 ? "step" : "steps"}`;
  const summary = queued ? `${agentName ?? "Agent"} is queued` : running ? `${agentName ?? "Agent"} is working` : count;
  return <Trace>
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen} scrollBehavior={running ? "follow-expansion" : "preserve"}>
      <TraceCollapsibleTrigger>
        <TraceLine status={status}>
          <TraceIcon motion={running ? "spin" : "none"}><Icon /></TraceIcon>
          <TraceTitle>{summary}</TraceTitle>
          <RunDuration startedAt={startedAt} finishedAt={finishedAt} running={running} active={active} />
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent keepMounted>
        <Trace role="list" aria-label="Agent activity">
          {hiddenCount > 0 && <TraceLine role="listitem" status="pending"><TraceTitle>{hiddenCount}+ more</TraceTitle></TraceLine>}
          {visibleActivity.map(step => {
            const label = activityLabel(step);
            const StepIcon = step.status === "running" ? LoaderCircle : step.status === "error" ? CircleX : step.status === "interrupted" ? Clock : CircleCheck;
            return <TraceLine role="listitem" key={step.id} status={step.status === "interrupted" ? "pending" : step.status}>
              <TraceIcon motion={step.status === "running" ? "spin" : "none"}><StepIcon /></TraceIcon>
              <TraceTitle>{label.before}{label.names?.map((name, index) => <Fragment key={`${index}:${name}`}>
                {index > 0 && ", "}<TraceCode>{name}</TraceCode>
              </Fragment>)}{label.after}</TraceTitle>
            </TraceLine>;
          })}
          {!activity.length && <TraceLine status="pending"><TraceTitle>{running ? "Waiting for activity…" : "No steps were recorded."}</TraceTitle></TraceLine>}
        </Trace>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  </Trace>;
}

function RunDuration({ startedAt, finishedAt, running, active }: {
  startedAt?: string | null; finishedAt?: string | null; running: boolean; active: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !running || !startedAt || finishedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, running, startedAt, finishedAt]);
  if (!running && !finishedAt) return null;
  const seconds = runDuration(startedAt, finishedAt, now);
  return seconds === null ? null : <TraceDuration seconds={seconds} running={running && !finishedAt} />;
}
