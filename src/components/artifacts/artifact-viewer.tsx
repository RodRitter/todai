"use client";

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
        <DialogTitle>{artifact.title} · Revision {artifact.revisionNumber}</DialogTitle>
        <DialogDescription className="whitespace-pre-wrap break-words">{artifact.description || "Artifact preview"}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2 break-words text-sm text-muted-foreground">
        <p>By {artifact.creator} · Published {new Date(artifact.updatedAt).toLocaleString()}{artifact.archived ? " · Archived" : ""}</p>
        {artifact.filename && <p>{artifact.filename} · {artifact.mediaType} · {artifact.byteSize?.toLocaleString()} bytes</p>}
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
          {kind === "markdown" && <div className={richTextClassName}><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
            img: ({ alt }) => <span>[Image: {alt || "external image"}]</span>,
          }}>{content.text || "This revision is empty."}</ReactMarkdown></div>}
          {/* Uploaded images use an inert image context, never an embedded document. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {kind === "image" && <img src={content.url} alt={artifact.title} className="mx-auto max-h-[60vh] object-contain" onError={() => setError("This image could not be displayed.")} />}
          {kind === "pdf" && <PdfPreview url={content.url!} />}
        </div>}
        <Button variant="outline" disabled={downloading} onClick={() => void download()}>{downloading ? "Downloading…" : `Download · r${artifact.revisionNumber}`}</Button>
        {downloadError && <p role="alert">{downloadError}</p>}
      </>}
    </DialogContent>
  </Dialog>;
}
