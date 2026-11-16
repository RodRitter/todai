"use client";

import { ChevronRight, FileText, Folder, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { LocalSkill, SkillsSnapshot } from "@/domain/skill";

export function SkillTree({ label, data, readOnly, search, selectedId, disabled, onSelect }: {
  label: string;
  data: SkillsSnapshot | null;
  readOnly?: boolean;
  search: string;
  selectedId?: string;
  disabled: boolean;
  onSelect: (skill: LocalSkill) => void;
}) {
  const skills = data?.skills.filter((skill) => skill.id.toLowerCase().includes(search.toLowerCase())) ?? [];
  return (
    <Collapsible defaultOpen={Boolean(selectedId)} className="space-y-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group w-full justify-start text-xs">
          <ChevronRight className="size-3.5 transition-transform group-aria-expanded:rotate-90" />
          <span>{label}</span>
          <span className="text-muted-foreground">{data?.skills.length ?? 0}</span>
          {readOnly && <Lock className="ml-auto size-3 text-muted-foreground" aria-label="Read-only" />}
        </Button>
            </CollapsibleTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm break-all font-mono">{data?.directory}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <CollapsibleContent>
        <ul aria-label={`${label} skills`} className="ml-4 space-y-0.5 border-l pl-2">
          {skills.map((skill) => (
            <li key={skill.id}>
              <Collapsible defaultOpen={selectedId === skill.id}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="group w-full justify-start font-normal" title={skill.id}>
                    <ChevronRight className="size-3 transition-transform group-aria-expanded:rotate-90" />
                    <Folder className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{skill.id}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-5 border-l pl-2">
                  <Button variant={selectedId === skill.id ? "secondary" : "ghost"} size="sm" className="w-full justify-start text-xs font-normal" disabled={disabled} aria-pressed={selectedId === skill.id} aria-label={`${label}: ${skill.id}/SKILL.md`} onClick={() => onSelect(skill)}>
                    <FileText className="size-3.5 text-muted-foreground" /> SKILL.md
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </li>
          ))}
        </ul>
        {!skills.length && <p className="px-8 py-3 text-xs text-muted-foreground">{search ? "No matching skills." : "No skills yet."}</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}
