"use client";

import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Archive, FileText, History, Link2, MoreHorizontal, Upload } from "lucide-react";
import { artifactCategory, type Artifact } from "@/domain/artifact";
import { Button } from "@/components/ui/button";
import { ArtifactViewer } from "./artifact-viewer";

const typeLabels = { document: "Document", image: "Image", file: "File", link: "External link" };
const menuItemClass = "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4";

export function ArtifactTable({ artifacts, label = "Artifacts", busy = false, onEdit, onHistory, onArchive }: {
  artifacts: Artifact[];
  label?: string;
  busy?: boolean;
  onEdit?: (artifact: Artifact) => void;
  onHistory?: (artifact: Artifact) => void;
  onArchive?: (artifact: Artifact) => void;
}) {
  const [selected, setSelected] = useState<Artifact | null>(null);
  const hasActions = Boolean(onEdit || onHistory || onArchive);
  return <>
    <div className="overflow-hidden rounded-lg border">
      <table aria-label={label} className="w-full table-fixed text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Name</th>
            <th scope="col" className="hidden w-28 px-3 py-2 font-medium sm:table-cell">Type</th>
            <th scope="col" className="hidden w-36 px-3 py-2 font-medium lg:table-cell">Creator</th>
            <th scope="col" className="hidden w-20 px-3 py-2 font-medium md:table-cell">Revision</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Updated</th>
            {hasActions && <th scope="col" className="w-11"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {artifacts.map((artifact) => <tr key={artifact.revisionId} className="transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
            <td className="px-3 py-2">
              <button type="button" onClick={() => setSelected(artifact)} title={artifact.title} className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${artifact.title}, revision ${artifact.revisionNumber}`}>
                {artifact.type === "link" ? <Link2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
                <span className="truncate">{artifact.title}</span>
              </button>
            </td>
            <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{typeLabels[artifactCategory(artifact)]}</td>
            <td className="hidden truncate px-3 py-2 text-muted-foreground lg:table-cell" title={artifact.creator}>{artifact.creator}</td>
            <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">r{artifact.revisionNumber}</td>
            <td className="px-3 py-2 text-xs text-muted-foreground"><time dateTime={artifact.updatedAt} title={new Date(artifact.updatedAt).toLocaleString()}>{new Date(artifact.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></td>
            {hasActions && <td className="pr-2 text-right">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild><Button type="button" variant="ghost" size="icon" className="size-7" disabled={busy} aria-label={`Actions for ${artifact.title}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenu.Trigger>
                <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                  {onEdit && <DropdownMenu.Item className={menuItemClass} onSelect={() => onEdit(artifact)}><Upload aria-hidden="true" />Publish revision</DropdownMenu.Item>}
                  {onHistory && <DropdownMenu.Item className={menuItemClass} onSelect={() => onHistory(artifact)}><History aria-hidden="true" />Revision history</DropdownMenu.Item>}
                  {onArchive && !artifact.archived && <DropdownMenu.Item className={menuItemClass} onSelect={() => onArchive(artifact)}><Archive aria-hidden="true" />Archive</DropdownMenu.Item>}
                </DropdownMenu.Content></DropdownMenu.Portal>
              </DropdownMenu.Root>
            </td>}
          </tr>)}
        </tbody>
      </table>
    </div>
    {selected && <ArtifactViewer key={selected.revisionId} artifact={selected} onClose={() => setSelected(null)} />}
  </>;
}
