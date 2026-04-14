"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownSummaryProps {
  content: string;
}

export function MarkdownSummary({ content }: MarkdownSummaryProps) {
  return (
    <article className="report-prose max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
