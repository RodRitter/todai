"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

export function PdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let loading: PDFDocumentLoadingTask | undefined;
    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        loading = pdfjs.getDocument({ url, enableXfa: false });
        const pdf = await loading.promise;
        if (!disposed) setDocument(pdf);
      } catch {
        if (!disposed) setError("This PDF could not be displayed. It may be damaged or password-protected. Use Download to open it elsewhere.");
      }
    }
    void load();
    return () => { disposed = true; void loading?.destroy(); };
  }, [url]);

  useEffect(() => {
    if (!document) return;
    let disposed = false;
    let rendering: RenderTask | undefined;
    async function render() {
      try {
        const page = await document!.getPage(pageNumber);
        if (disposed || !canvas.current) return;
        const original = page.getViewport({ scale: 1 });
        // Bound canvas memory even for unusually large PDF page dimensions.
        const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(original.width, original.height)) });
        canvas.current.width = Math.ceil(viewport.width);
        canvas.current.height = Math.ceil(viewport.height);
        rendering = page.render({ canvas: canvas.current, viewport });
        await rendering.promise;
        if (!disposed) setRenderedPage(pageNumber);
      } catch {
        if (!disposed) setError("This PDF page could not be displayed. Use Download to open it elsewhere.");
      }
    }
    void render();
    return () => { disposed = true; rendering?.cancel(); };
  }, [document, pageNumber]);

  return <div className="space-y-3">
    {error ? <p role="alert">{error}</p> : <>
      {renderedPage !== pageNumber && <p role="status">Rendering PDF page…</p>}
      <canvas ref={canvas} role="img" aria-label={`PDF page ${pageNumber}`} className="mx-auto h-auto max-w-full border" hidden={renderedPage !== pageNumber} />
      {document && <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" disabled={pageNumber === 1} onClick={() => setPageNumber((page) => page - 1)}>Previous page</Button>
        <span className="text-sm">Page {pageNumber} of {document.numPages}</span>
        <Button variant="outline" disabled={pageNumber === document.numPages} onClick={() => setPageNumber((page) => page + 1)}>Next page</Button>
      </div>}
    </>}
  </div>;
}
