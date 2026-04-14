"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownReportProps {
  content: string;
  screenshotUrls: Record<string, string>;
}

export function MarkdownReport({
  content,
  screenshotUrls,
}: MarkdownReportProps) {
  let processedContent = content;
  for (const [filename, url] of Object.entries(screenshotUrls)) {
    processedContent = processedContent.replaceAll(filename, url);
  }

  return (
    <article className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-p:text-muted-foreground prose-p:leading-relaxed prose-table:text-xs prose-th:text-left prose-th:font-medium prose-th:text-foreground prose-td:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-a:text-primary prose-hr:border-border">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {processedContent}
      </ReactMarkdown>
    </article>
  );
}
