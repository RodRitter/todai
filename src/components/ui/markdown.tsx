import ReactMarkdown from "react-markdown";
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
    <div className={richTextClassName}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) =>
            compact ? (
              <span>{children}</span>
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
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border">
              <table>
                {children}
              </table>
            </div>
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
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
