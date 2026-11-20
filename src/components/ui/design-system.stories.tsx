import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bot, Search, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Card, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { NativeSelect } from "./native-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { AgentStatus } from "../tasks/agent-status";

function VariantGallery() {
  return <div className="space-y-6 bg-background p-4 text-foreground">
    <div className="flex flex-wrap items-center gap-2">
      <Button>Primary</Button><Button variant="outline">Secondary</Button>
      <Button variant="ghost-muted" size="xs">Copy</Button>
      <Button variant="ghost-destructive" size="icon-xs" aria-label="Delete"><Trash2 /></Button>
      <Button disabled>Saving…</Button>
    </div>
    <div className="space-y-2"><Label htmlFor="gallery-title" variant="metadata">Title</Label><Input id="gallery-title" variant="title" defaultValue="A task with a longer title" /></div>
    <div className="relative"><Search aria-hidden="true" className="absolute top-2.5 left-3 size-4" /><Input variant="search" aria-label="Search" placeholder="Search…" /></div>
    <NativeSelect variant="status" aria-label="Status"><option>In progress</option><option>Done</option></NativeSelect>
    <Select defaultValue="reviewer"><SelectTrigger variant="badge" size="sm" aria-label="Agent"><Bot /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reviewer">Reviewer</SelectItem></SelectContent></Select>
    <div className="flex flex-wrap gap-2">{(["Not started", "Running", "Waiting", "Failed", "Complete"] as const).map((status) => <AgentStatus key={status} status={status} variant="badge" />)}</div>
    <Card variant="task" interactive attention role="button" tabIndex={0}><CardHeader><CardTitle>Task needing attention</CardTitle></CardHeader></Card>
    <Card variant="flush" elevation="flat"><div className="p-4">Flush content surface</div></Card>
  </div>;
}
const meta = { title: "Foundations/Design variants", component: VariantGallery, parameters: { layout: "padded" } } satisfies Meta<typeof VariantGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { decorators: [(Story) => <div className="dark"><Story /></div>] };
export const Narrow: Story = { decorators: [(Story) => <div className="max-w-72"><Story /></div>] };
