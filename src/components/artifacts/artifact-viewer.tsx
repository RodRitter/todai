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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted-foreground"><span className="font-medium text-foreground">Revision {artifact.revisionNumber}</span><span className="mx-2" aria-hidden="true">·</span>{new Date(artifact.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}{artifact.archived ? " · Archived" : ""}</p>
          {kind !== "link" && <Button size="sm" variant="ghost" disabled={downloading} onClick={() => void download()}><Download aria-hidden="true" />{downloading ? "Downloading…" : "Download"}</Button>}
        </div>
        <details className="group text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Document details</summary>
          <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
            {artifact.description && <p className="whitespace-pre-wrap break-words text-sm text-foreground">{artifact.description}</p>}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 [&_dd]:break-words">
              <dt>Creator</dt><dd>{artifact.creator}</dd>
              <dt>Published</dt><dd>{new Date(artifact.updatedAt).toLocaleString()}</dd>
              {artifact.filename && <><dt>File</dt><dd>{artifact.filename}</dd><dt>Format</dt><dd>{artifact.mediaType}</dd><dt>Size</dt><dd>{artifact.byteSize?.toLocaleString()} bytes</dd></>}
            </dl>
          </div>
        </details>
        {downloadError && <p role="alert" className="text-sm text-destructive">{downloadError}</p>}
      </div>
      {kind === "link" ? <div className="space-y-3">
        <p>This external link stores only its URL and metadata. Remote content may change; it is not a preserved snapshot.</p>
        <p className="break-all text-sm">{artifact.url}</p>
        <Button asChild variant="outline"><a href={artifact.url!} target="_blank" rel="noopener noreferrer">Open external link ↗</a></Button>
      </div> : <>
        {kind === "unsupported" && <p>No preview is available for this file type. Download the stored file to open it.</p>}
        {supported && !content && !error && <p role="status">Loading preview…</p>}
        {error && <div role="alert" className="space-y-2"><p>{error} You can try downloading the stored file.</p><Button variant="outline" onClick={() => { setError(""); setContent(null); setAttempt((value) => value + 1); }}>Retry preview</Button></div>}
        {!error && content && <div className="min-w-0 overflow-auto">
          {kind === "text" && <pre className="whitespace-pre-wrap break-words text-sm">{content.text || "This revision is empty."}</pre>}
          {kind === "markdown" && <div className="rounded-xl bg-muted/50 p-3 sm:p-5"><article aria-label="Markdown document" className={cn(richTextClassName,
            "min-h-96 rounded-sm border bg-background px-5 py-8 font-serif text-base leading-[1.8] shadow-sm sm:px-10 sm:py-12",
            "[&_h1]:mb-7 [&_h1]:mt-10 [&_h1]:font-sans [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:tracking-tight [&_h2]:mb-4 [&_h2]:mt-9 [&_h2]:font-sans [&_h2]:text-xl [&_h2]:leading-snug [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:font-sans [&_h3]:text-lg [&_h4]:font-sans [&_h5]:font-sans [&_h6]:font-sans",
            "[&_p]:my-5 [&_ul]:my-5 [&_ol]:my-5 [&_li]:my-2 [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:italic [&_pre]:my-6 [&_pre]:p-4 [&_pre]:text-sm [&_hr]:my-8 [&_table]:font-sans [&_table]:text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          )}><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
            img: ({ alt }) => <span>[Image: {alt || "external image"}]</span>,
            table: ({ children }) => <div className="my-6 overflow-x-auto"><table>{children}</table></div>,
          }}>{content.text || "This revision is empty."}</ReactMarkdown></article></div>}
          {/* Uploaded images use an inert image context, never an embedded document. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {kind === "image" && <img src={content.url} alt={artifact.title} className="mx-auto max-h-[60vh] object-contain" onError={() => setError("This image could not be displayed.")} />}
          {kind === "pdf" && <PdfPreview url={content.url!} />}
        </div>}
      </>}
    </DialogContent>
  </Dialog>;
}
