import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children, compact = false }: { children: string; compact?: boolean }) {
  return <div className="min-w-0 text-sm leading-relaxed wrap-anywhere [&_p]:my-3 [&_h1]:my-4 [&_h1]:text-xl [&_h2]:my-3 [&_h2]:text-lg [&_h3]:my-3 [&_h3]:text-base [&_h4]:my-3 [&_h5]:my-3 [&_h6]:my-3 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li>p]:my-1 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_hr]:my-4 [&_hr]:border-border [&_input]:mr-2 [&_.contains-task-list]:list-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
        a: ({ href, children }) => compact ? <span>{children}</span> : <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 hover:opacity-80">{children}</a>,
        img: ({ src, alt }) => compact ? <span>{alt}</span> : (
          // Markdown images have arbitrary sources and sizes, unlike app-owned optimized images.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ''} loading="lazy" className="my-3 max-h-96 max-w-full rounded-lg object-contain" />
        ),
        table: ({ children }) => <div className="my-3 overflow-x-auto rounded-lg border"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
        th: ({ children }) => <th className="border-b bg-muted px-3 py-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-b px-3 py-2">{children}</td>,
        input: ({ checked }) => <span role="img" aria-label={checked ? 'Completed' : 'Not completed'} className="mr-2">{checked ? '☑' : '☐'}</span>,
      }}>{children}</ReactMarkdown>
  </div>;
}
