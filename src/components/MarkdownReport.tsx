"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";

interface MarkdownReportProps {
  content: string;
  screenshotUrls: Record<string, string>;
  excludeSections?: string[];
}

interface Section {
  title: string;
  slug: string;
  body: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function splitIntoSections(markdown: string): { preamble: string; sections: Section[] } {
  const lines = markdown.split("\n");
  let preamble = "";
  const sections: Section[] = [];
  let current: { title: string; slug: string; lines: string[] } | null = null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (current) {
        sections.push({ title: current.title, slug: current.slug, body: current.lines.join("\n") });
      }
      const title = h2Match[1].replace(/[*_`~\[\]]/g, "").trim();
      current = { title, slug: slugify(title), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble += line + "\n";
    }
  }
  if (current) {
    sections.push({ title: current.title, slug: current.slug, body: current.lines.join("\n") });
  }
  return { preamble: preamble.trimEnd(), sections };
}

const proseClasses = "report-prose max-w-none";

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw, rehypeSlug];

type TableEl = React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
type THeadEl = React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
type TBodyEl = React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
type TrEl = React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
type ThEl = React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>;
type TdEl = React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>;

const markdownComponents = {
  table: ({ children, ...props }: TableEl) => (
    <div className="report-table my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: THeadEl) => (
    <thead className="bg-muted/60 border-b border-border" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: TBodyEl) => (
    <tbody className="divide-y divide-border/50" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: TrEl) => (
    <tr className="transition-colors hover:bg-muted/40 even:bg-muted/25" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: ThEl) => (
    <th className="report-table-th" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: TdEl) => (
    <td className="report-table-td" {...props}>
      {children}
    </td>
  ),
};

function CollapsibleSection({
  section,
  defaultOpen,
  isActive,
}: {
  section: Section;
  defaultOpen: boolean;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      id={section.slug}
      className={`rounded-lg border transition-colors duration-200 ${
        isActive ? "border-foreground/15 bg-card/30" : "border-border"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full text-left px-6 py-5 group"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="text-base font-semibold tracking-tight text-foreground group-hover:text-foreground/80 transition-colors">
          {section.title}
        </span>
        {!open && (
          <span className="ml-auto text-xs text-muted-foreground/50 uppercase tracking-wider">
            Expand
          </span>
        )}
      </button>
      {open && (
        <div className="px-6 pb-6 animate-fade-in">
          <article className={proseClasses}>
            <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={markdownComponents}>
              {section.body}
            </ReactMarkdown>
          </article>
        </div>
      )}
    </div>
  );
}

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (progress < 2) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-30 h-0.5 bg-border/30">
      <div
        className="h-full bg-foreground/40 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border shadow-lg hover:bg-muted transition-all duration-200 animate-fade-in-up"
      aria-label="Back to top"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}

function TableOfContents({
  sections,
  activeSlug,
  onJump,
}: {
  sections: Section[];
  activeSlug: string | null;
  onJump: (slug: string) => void;
}) {
  if (sections.length < 3) return null;

  return (
    <nav className="hidden xl:block shrink-0 w-44">
        <div className="sticky top-[calc(4rem+2.5rem+1px)]">
        <div className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider mb-3">
          Sections
        </div>
        <ul className="space-y-0.5 border-l border-border pl-0">
          {sections.map((s, i) => (
            <li key={`${s.slug}-${i}`}>
              <button
                onClick={() => onJump(s.slug)}
                className={`block w-full text-left text-xs leading-snug py-1.5 pl-3 -ml-px border-l-2 transition-colors ${
                  activeSlug === s.slug
                    ? "text-foreground border-foreground font-medium"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/40"
                }`}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export function MarkdownReport({
  content,
  screenshotUrls,
  excludeSections = [],
}: MarkdownReportProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  let processedContent = content;
  for (const [filename, url] of Object.entries(screenshotUrls)) {
    processedContent = processedContent.replaceAll(filename, url);
  }

  const { preamble, sections: allSections } = splitIntoSections(processedContent);
  const excludeNormalized = excludeSections.map((s) => s.toLowerCase());
  const sections = allSections.filter(
    (s) => !excludeNormalized.includes(s.title.toLowerCase()),
  );

  const handleJump = useCallback((slug: string) => {
    const el = document.getElementById(slug);
    if (el) {
      const headerOffset = 72;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (sections.length === 0) return;
    const ids = sections.map((s) => s.slug);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) {
    return (
      <article className={proseClasses}>
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={markdownComponents}>
          {processedContent}
        </ReactMarkdown>
      </article>
    );
  }

  return (
    <div ref={containerRef}>
      <ReadingProgress />
      <BackToTop />

      <div className="flex gap-6">
        <TableOfContents sections={sections} activeSlug={activeSlug} onJump={handleJump} />

        <div className="min-w-0 flex-1">
          {preamble && (
            <article className={`${proseClasses} mb-6`}>
              <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={markdownComponents}>
                {preamble}
              </ReactMarkdown>
            </article>
          )}

          <div className="space-y-4">
            {sections.map((section, i) => (
              <CollapsibleSection
                key={`${section.slug}-${i}`}
                section={section}
                defaultOpen={i < 2}
                isActive={activeSlug === section.slug}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
