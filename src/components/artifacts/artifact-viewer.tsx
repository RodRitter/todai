"use client";

import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { PdfPreview } from "./pdf-preview";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { artifactPreviewKind, type Artifact } from "@/domain/artifact";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { richTextClassName } from "@/components/ui/rich-text-styles";

async function fetchContent(artifact: Artifact, preview: boolean, signal?: AbortSignal) {
  const response = await workspaceFetch(`/api/artifacts/download?${new URLSearchParams({ id: artifact.id, revision: artifact.revisionId, preview: String(preview) })}`, { signal });
  if (!response.ok) throw new Error((await response.json()).error ?? "Content unavailable.");
  return response;
}

export function ArtifactViewer({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
  const kind = artifactPreviewKind(artifact);
  const supported = kind !== "link" && kind !== "unsupported";
  const [content, setContent] = useState<{ text?: string; url?: string } | null>(null);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const response = await fetchContent(artifact, true, controller.signal);
        if (kind === "text" || kind === "markdown") {
          const text = await response.text();
          if (!controller.signal.aborted) setContent({ text });
        } else {
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          setContent({ url: objectUrl });
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load preview.");
      }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [artifact, kind, supported, attempt]);

  async function download() {
    setDownloading(true); setDownloadError("");
    try {
      const response = await fetchContent(artifact, false);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = artifact.filename ?? "artifact";
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setDownloadError(error instanceof Error ? error.message : "Could not download artifact."); }
    finally { setDownloading(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent size="large">
      <DialogHeader>
        <DialogTitle>{artifact.title}</DialogTitle>
        <DialogDescription className="sr-only">Preview of revision {artifact.revisionNumber} by {artifact.creator}.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-xs text-muted-foreground">{artifact.creator}<span className="mx-2" aria-hidden="true">·</span><span>Revision {artifact.revisionNumber}</span><span className="mx-2" aria-hidden="true">·</span><time dateTime={artifact.updatedAt} title={new Date(artifact.updatedAt).toLocaleString()}>{new Date(artifact.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time>{artifact.archived ? " · Archived" : ""}</p>
        {kind !== "link" && <Button size="icon-xs" variant="ghost-muted" className="shrink-0" disabled={downloading} aria-label={downloading ? "Downloading…" : "Download"} title="Download this revision" onClick={() => void download()}><Download aria-hidden="true" className="size-4" /></Button>}
        {downloadError && <p role="alert" className="w-full text-sm text-destructive">{downloadError}</p>}
      </div>
      {kind === "link" ? <div className="space-y-3">
        <p>This external link stores only its URL and metadata. Remote content may change; it is not a preserved snapshot.</p>
        <p className="break-all text-sm">{artifact.url}</p>
        <Button asChild variant="outline"><a href={artifact.url!} target="_blank" rel="noopener noreferrer">Open external link ↗</a></Button>
      </div> : <>
        {kind === "unsupported" && <p>No preview is available for this file type. Download the stored file to open it.</p>}
        {supported && !content && !error && <p role="status">Loading preview…</p>}
        {error && <div role="alert" className="space-y-2"><p>{error} You can try downloading the stored file.</p><Button variant="outline" onClick={() => { setError(""); setContent(null); setAttempt((value) => value + 1); }}>Retry preview</Button></div>}
        {!error && content && <div className="min-w-0">
          {kind === "text" && <pre className="whitespace-pre-wrap break-words text-sm">{content.text || "This revision is empty."}</pre>}
          {kind === "markdown" && <article aria-label="Markdown document" className={cn(richTextClassName,
            "min-h-96 pb-4 text-base leading-7",
            "[&_h1]:mb-5 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:tracking-tight [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:leading-snug [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-xl [&_h4]:text-lg [&_h5]:text-base [&_h6]:text-sm [&_h6]:text-muted-foreground",
            "[&_p]:my-4 [&_ul]:my-4 [&_ol]:my-4 [&_li]:my-1 [&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_pre]:my-5 [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-6 [&_hr]:my-8 [&_table]:text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          )}><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
            img: ({ alt }) => <span>[Image: {alt || "external image"}]</span>,
            table: ({ children }) => <div className="my-6 overflow-x-auto"><table>{children}</table></div>,
          }}>{content.text || "This revision is empty."}</ReactMarkdown></article>}
          {/* Uploaded images use an inert image context, never an embedded document. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {kind === "image" && <img src={content.url} alt={artifact.title} className="mx-auto max-h-[60vh] object-contain" onError={() => setError("This image could not be displayed.")} />}
          {kind === "pdf" && <PdfPreview url={content.url!} />}
        </div>}
      </>}
      {(artifact.description || artifact.filename) && <footer className="space-y-1 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
        {artifact.description && <p className="whitespace-pre-wrap break-words">{artifact.description}</p>}
        {artifact.filename && <p className="break-words">{artifact.filename} · {artifact.mediaType} · {artifact.byteSize?.toLocaleString()} bytes</p>}
      </footer>}
    </DialogContent>
  </Dialog>;
}
