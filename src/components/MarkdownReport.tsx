"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";

interface MarkdownReportProps {
  content: string;
  screenshotUrls: Record<string, string>;
}

interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

function extractToc(markdown: string): TocEntry[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const entries: TocEntry[] = [];
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const text = match[2].replace(/[*_`~\[\]]/g, "").trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    entries.push({ level: match[1].length, text, slug });
  }
  return entries;
}

export function MarkdownReport({
  content,
  screenshotUrls,
}: MarkdownReportProps) {
  const [tocOpen, setTocOpen] = useState(false);

  let processedContent = content;
  for (const [filename, url] of Object.entries(screenshotUrls)) {
    processedContent = processedContent.replaceAll(filename, url);
  }

  const toc = extractToc(processedContent);

  return (
    <div>
      {toc.length > 3 && (
        <nav className="mb-6 rounded-lg border border-border bg-card p-4">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="flex items-center gap-2 text-sm font-medium text-foreground w-full text-left"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${tocOpen ? "rotate-90" : ""}`}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            Table of Contents
            <span className="text-xs text-muted-foreground font-normal">
              ({toc.length} sections)
            </span>
          </button>
          {tocOpen && (
            <ul className="mt-3 space-y-1 border-t border-border pt-3">
              {toc.map((entry, i) => (
                <li key={`${entry.slug}-${i}`}>
                  <a
                    href={`#${entry.slug}`}
                    className={`block text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5 ${
                      entry.level === 3 ? "pl-4" : ""
                    }`}
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )}
      <article className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-p:text-muted-foreground prose-p:leading-relaxed prose-table:text-xs prose-th:text-left prose-th:font-medium prose-th:text-foreground prose-td:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-a:text-primary prose-hr:border-border">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSlug]}
        >
          {processedContent}
        </ReactMarkdown>
      </article>
    </div>
  );
}
