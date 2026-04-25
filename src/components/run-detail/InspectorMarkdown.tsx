"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders GFM-style markdown in the run / project inspector rails (dark zinc surfaces).
 * Safe: no rehype-raw — only markdown syntax is interpreted.
 */
const components: Components = {
  p: ({ children, ...p }) => (
    <p
      className="mb-2 last:mb-0 text-[12.5px] leading-[1.65] text-zinc-200/90"
      {...p}
    >
      {children}
    </p>
  ),
  h1: ({ children, ...p }) => (
    <h1
      className="m-0 mb-1.5 mt-3 first:mt-0 text-sm font-semibold text-zinc-100"
      {...p}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...p }) => (
    <h2
      className="m-0 mb-1.5 mt-2.5 first:mt-0 text-[0.8125rem] font-semibold text-zinc-100"
      {...p}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...p }) => (
    <h3
      className="m-0 mb-1 mt-2 first:mt-0 text-xs font-semibold text-zinc-200"
      {...p}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...p }) => (
    <h4
      className="m-0 mb-0.5 mt-1.5 first:mt-0 text-[12px] font-medium text-zinc-300"
      {...p}
    >
      {children}
    </h4>
  ),
  strong: ({ children, ...p }) => (
    <strong className="font-semibold text-zinc-100" {...p}>
      {children}
    </strong>
  ),
  em: ({ children, ...p }) => (
    <em className="not-italic text-violet-200/95" {...p}>
      {children}
    </em>
  ),
  a: ({ href, children, ...p }) => (
    <a
      href={href}
      className="text-violet-400 underline decoration-violet-500/30 underline-offset-[3px] transition-colors hover:text-violet-300"
      target="_blank"
      rel="noreferrer noopener"
      {...p}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...p }) => (
    <ul
      className="mb-2 last:mb-0 list-outside list-disc pl-4 text-[12.5px] text-zinc-200/90 marker:text-zinc-500"
      {...p}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...p }) => (
    <ol
      className="mb-2 last:mb-0 list-outside list-decimal pl-4 text-[12.5px] text-zinc-200/90 marker:text-zinc-500"
      {...p}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...p }) => (
    <li className="mb-0.5 pl-0.5 leading-[1.65] [&>p]:mb-0" {...p}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...p }) => (
    <blockquote
      className="my-2 border-l-[3px] border-white/15 pl-3 text-zinc-300/90 [&_p]:text-inherit"
      {...p}
    >
      {children}
    </blockquote>
  ),
  hr: (p) => <hr className="my-3 border-white/10" {...p} />,
  code: ({ className, children, ...p }) => {
    const block = String(className ?? "").includes("language-");
    if (block) {
      return (
        <code
          className={cn(
            "font-mono text-[11.5px] text-zinc-200",
            className
          )}
          {...p}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="font-mono text-[0.7rem] break-words rounded border border-white/10 bg-zinc-900/80 px-1 py-px text-zinc-200"
        {...p}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...p }) => (
    <pre
      className="mb-2 max-h-[min(32rem,55vh)] overflow-x-auto overflow-y-auto rounded-md border border-white/10 bg-black/35 p-3 [scrollbar-gutter:stable] last:mb-0"
      {...p}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...p }) => (
    <div className="my-2 w-full min-w-0 max-w-full overflow-x-auto last:mb-0">
      <table
        className="w-full min-w-[min(100%,18rem)] border-collapse text-left text-[11.5px] text-zinc-200/90"
        {...p}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...p }) => (
    <thead
      className="border-b border-white/10 bg-white/[0.04] text-[10.5px] text-zinc-400"
      {...p}
    >
      {children}
    </thead>
  ),
  th: ({ children, ...p }) => (
    <th className="px-2.5 py-1.5 font-medium first:pl-0 last:pr-0" {...p}>
      {children}
    </th>
  ),
  td: ({ children, ...p }) => (
    <td
      className="align-top border-b border-white/[0.06] px-2.5 py-1.5 text-zinc-200/80 first:pl-0 last:pr-0"
      {...p}
    >
      {children}
    </td>
  ),
  tr: ({ children, ...p }) => <tr {...p}>{children}</tr>,
  tbody: (p) => <tbody {...p} />,
  /** Preserve single line breaks in paragraphs (common in hand-written findings) */
  br: (p) => <br className="block" {...p} />,
};

const remarkPlugins = [remarkGfm];

export function InspectorMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content?.trim()) return null;
  return (
    <div className={cn("inspector-markdown min-w-0", className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
