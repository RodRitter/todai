import { parseCommentReference } from "@/domain/comment-reference";
import { CommentReference } from "@/components/tasks/comment-reference";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseArtifactMention } from "@/domain/artifact-mentions";
import { ArtifactMention } from "@/components/artifacts/artifact-mention";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { richTextClassName } from "./rich-text-styles";

export function Markdown({
  children,
  compact = false,
}: {
  children: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "min-w-0 text-sm leading-5 wrap-anywhere" : richTextClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={compact ? compactComponents : fullComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// Stable component identities keep citation preview state during parent polling.
function markdownComponents(compact: boolean): Components {
  return {
    a: ({ href, children }) =>
      compact ? (
        <span>{children}</span>
      ) : href && parseCommentReference(href) ? (
        <CommentReference reference={parseCommentReference(href)!}>{children}</CommentReference>
      ) : href && parseArtifactMention(href) ? (
        <ArtifactMention reference={parseArtifactMention(href)!}>{children}</ArtifactMention>
      ) : typeof children === "string" && /^[$@/]/.test(children) && (href?.startsWith("/") || href?.startsWith("#agent/")) ? (
        <span title={href} className="rounded bg-accent px-1 py-0.5 font-medium text-accent-foreground">{children}</span>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      ),
    img: ({ src, alt }) =>
      compact ? (
        <span>{alt}</span>
      ) : (
        // Markdown images have arbitrary sources and sizes, unlike app-owned optimized images.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
        />
      ),
    pre: ({ children }) => <ScrollArea orientation="both" className="max-h-96" variant="code"><pre>{children}</pre></ScrollArea>,
    table: ({ children }) => (
      <ScrollArea orientation="horizontal" className="my-3" variant="table">
        <table>
          {children}
        </table>
      </ScrollArea>
    ),
    input: ({ checked }) => (
      <span
        role="img"
        aria-label={checked ? "Completed" : "Not completed"}
        className="mr-2"
      >
        {checked ? "☑" : "☐"}
      </span>
    ),
  };
}

const fullComponents = markdownComponents(false);
const compactComponents = markdownComponents(true);
