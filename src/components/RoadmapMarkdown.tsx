"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function RoadmapMarkdown({ content }: { content: string }) {
  const trimmed = content?.trim();
  if (!trimmed) return null;

  return (
    <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0 prose-pre:my-2 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted/60 prose-code:text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={[
          "p",
          "br",
          "em",
          "strong",
          "del",
          "a",
          "ul",
          "ol",
          "li",
          "code",
          "pre",
          "blockquote",
        ]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            />
          ),
        }}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}

