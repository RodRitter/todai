"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SettingsSections({ label, sections, selector, actions, initialSection, value, onValueChange, disabled = false }: {
  label: string;
  sections: { id: string; label: string; content: ReactNode }[];
  selector?: ReactNode;
  actions?: ReactNode;
  initialSection?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [section, setSection] = useState(initialSection ?? sections[0].id);
  return <Tabs orientation="vertical" value={value ?? section} onValueChange={next => { setSection(next); onValueChange?.(next); }} className="grid min-w-0 gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
    <aside className="min-w-0 space-y-4">
      {selector}
      <TabsList layout="sidebar" aria-label={label}>
        {sections.map(item => <TabsTrigger key={item.id} value={item.id} layout="sidebar" disabled={disabled}>{item.label}</TabsTrigger>)}
      </TabsList>
      {actions}
    </aside>
    <div className="min-w-0 border-t border-border pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
      {sections.map(item => <TabsContent key={item.id} value={item.id} className="space-y-6">
        <h2 className="text-lg font-medium">{item.label}</h2>
        {item.content}
      </TabsContent>)}
    </div>
  </Tabs>;
}
