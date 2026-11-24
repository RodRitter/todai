"use client";

import { useState, type ReactNode } from "react";
import { DropdownMenu } from "radix-ui";
import { Archive, FileText, Link2, MoreHorizontal, Pencil } from "lucide-react";
import { artifactCategory, type Artifact } from "@/domain/artifact";
import { Button } from "@/components/ui/button";
import { ArtifactViewer } from "./artifact-viewer";

const typeLabels = { document: "Document", image: "Image", file: "File", link: "External link" };
const menuItemClass = "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4";

export function ArtifactTable({ artifacts, label = "Artifacts", busy = false, onEdit, onArchive, renderActions }: {
  artifacts: Artifact[];
  label?: string;
  busy?: boolean;
  onEdit?: (artifact: Artifact) => void;
  onArchive?: (artifact: Artifact) => void;
  renderActions?: (artifact: Artifact) => ReactNode;
}) {
  const [selected, setSelected] = useState<Artifact | null>(null);
  const hasActions = Boolean(onEdit || onArchive || renderActions);
  return <>
    <div className="@container overflow-hidden rounded-lg border">
      <table aria-label={label} className="w-full table-fixed text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Name</th>
            <th scope="col" className="hidden w-28 px-3 py-2 font-medium @lg:table-cell">Type</th>
            <th scope="col" className="hidden w-36 px-3 py-2 font-medium @3xl:table-cell">Creator</th>
            <th scope="col" className="w-28 px-3 py-2 font-medium">Updated</th>
            {hasActions && <th scope="col" className={renderActions ? "w-16" : "w-11"}><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {artifacts.map((artifact) => <tr key={artifact.id} className="transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
            <td className="px-3 py-2">
              <button type="button" onClick={() => setSelected(artifact)} title={artifact.title} className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${artifact.title}`}>
                {artifact.type === "link" ? <Link2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
                <span className="truncate">{artifact.title}</span>
              </button>
            </td>
            <td className="hidden px-3 py-2 text-muted-foreground @lg:table-cell">{typeLabels[artifactCategory(artifact)]}</td>
            <td className="hidden truncate px-3 py-2 text-muted-foreground @3xl:table-cell" title={artifact.creator}>{artifact.creator}</td>
            <td className="px-3 py-2 text-xs text-muted-foreground"><time dateTime={artifact.updatedAt} title={new Date(artifact.updatedAt).toLocaleString()}>{new Date(artifact.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></td>
            {hasActions && <td className="pr-2 text-right">
              {renderActions ? <div className="flex items-center justify-end gap-0.5">{renderActions(artifact)}</div> : <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild><Button type="button" variant="ghost" size="icon-xs"  disabled={busy} aria-label={`Actions for ${artifact.title}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenu.Trigger>
                <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                  {onEdit && <DropdownMenu.Item className={menuItemClass} onSelect={() => onEdit(artifact)}><Pencil aria-hidden="true" />Edit</DropdownMenu.Item>}
                  {onArchive && !artifact.archived && <DropdownMenu.Item className={menuItemClass} onSelect={() => onArchive(artifact)}><Archive aria-hidden="true" />Archive</DropdownMenu.Item>}
                </DropdownMenu.Content></DropdownMenu.Portal>
              </DropdownMenu.Root>}
            </td>}
          </tr>)}
        </tbody>
      </table>
    </div>
    {selected && <ArtifactViewer key={selected.id} artifact={selected} onClose={() => setSelected(null)} />}
  </>;
}
