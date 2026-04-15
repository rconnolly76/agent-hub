"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";

interface ManifestFile {
  path: string;
  title: string;
  category?: string;
  description?: string;
}

interface ContentBundleManifest {
  skillType?: string;
  mode?: string;
  generatedAt?: string;
  summary: string;
  files: ManifestFile[];
  auditReport?: string;
}

interface ContentFileData {
  filename: string;
  blobUrl: string;
  content: string;
}

interface ContentBundleViewerProps {
  manifest: ContentBundleManifest;
  contentFiles: ContentFileData[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\//, "");
}

type TableEl = React.DetailedHTMLProps<
  React.TableHTMLAttributes<HTMLTableElement>,
  HTMLTableElement
>;
type THeadEl = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLTableSectionElement>,
  HTMLTableSectionElement
>;
type TBodyEl = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLTableSectionElement>,
  HTMLTableSectionElement
>;
type TrEl = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLTableRowElement>,
  HTMLTableRowElement
>;
type ThEl = React.DetailedHTMLProps<
  React.ThHTMLAttributes<HTMLTableCellElement>,
  HTMLTableCellElement
>;
type TdEl = React.DetailedHTMLProps<
  React.TdHTMLAttributes<HTMLTableCellElement>,
  HTMLTableCellElement
>;

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
    <tr
      className="transition-colors hover:bg-muted/40 even:bg-muted/25"
      {...props}
    >
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

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw, rehypeSlug];

function FileIcon() {
  return (
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
      className="shrink-0"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function CategoryIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function groupByCategory(
  files: ManifestFile[]
): { category: string; files: ManifestFile[] }[] {
  const groups = new Map<string, ManifestFile[]>();
  for (const f of files) {
    const cat = f.category || "General";
    const existing = groups.get(cat);
    if (existing) {
      existing.push(f);
    } else {
      groups.set(cat, [f]);
    }
  }
  return Array.from(groups.entries()).map(([category, files]) => ({
    category,
    files,
  }));
}

export function ContentBundleViewer({
  manifest,
  contentFiles,
}: ContentBundleViewerProps) {
  const contentByPath = new Map<string, ContentFileData>();
  const basenameCounts = new Map<string, number>();

  for (const file of contentFiles) {
    const normalized = normalizePath(file.filename);
    contentByPath.set(file.filename, file);
    contentByPath.set(normalized, file);

    const basename = normalized.split("/").pop();
    if (basename) {
      basenameCounts.set(basename, (basenameCounts.get(basename) ?? 0) + 1);
    }
  }

  for (const file of contentFiles) {
    const normalized = normalizePath(file.filename);
    const basename = normalized.split("/").pop();
    if (basename && basenameCounts.get(basename) === 1) {
      contentByPath.set(basename, file);
    }
  }

  const firstFile = manifest.files[0]?.path ?? null;
  const [selectedPath, setSelectedPath] = useState<string | null>(firstFile);

  const categories = groupByCategory(manifest.files);
  const hasCategories =
    categories.length > 1 || categories[0]?.category !== "General";

  const selectedFile = selectedPath
    ? manifest.files.find((f) => f.path === selectedPath)
    : null;
  const selectedContent = selectedPath
    ? (contentByPath.get(selectedPath) ?? contentByPath.get(normalizePath(selectedPath)) ?? null)
    : null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Content Bundle
        </h2>
        {manifest.mode && (
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {manifest.mode}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card/30 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-[400px]">
          {/* File sidebar */}
          <nav className="border-b md:border-b-0 md:border-r border-border bg-muted/20 overflow-y-auto max-h-[70vh]">
            <div className="p-3">
              <div className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-2 mb-2">
                {manifest.files.length} file{manifest.files.length !== 1 && "s"}
              </div>

              {hasCategories
                ? categories.map((group) => (
                    <div key={group.category} className="mb-3 last:mb-0">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                        <CategoryIcon />
                        {group.category}
                      </div>
                      <ul className="space-y-0.5">
                        {group.files.map((f) => (
                          <li key={f.path}>
                            <button
                              onClick={() => setSelectedPath(f.path)}
                              className={`flex items-center gap-2 w-full text-left text-xs leading-snug py-2 px-2 rounded-md transition-colors ${
                                selectedPath === f.path
                                  ? "bg-foreground/[0.06] text-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                              }`}
                            >
                              <FileIcon />
                              <span className="truncate">{f.title}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                : (
                  <ul className="space-y-0.5">
                    {manifest.files.map((f) => (
                      <li key={f.path}>
                        <button
                          onClick={() => setSelectedPath(f.path)}
                          className={`flex items-center gap-2 w-full text-left text-xs leading-snug py-2 px-2 rounded-md transition-colors ${
                            selectedPath === f.path
                              ? "bg-foreground/[0.06] text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                          }`}
                        >
                          <FileIcon />
                          <span className="truncate">{f.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </nav>

          {/* Content area */}
          <div className="min-w-0 overflow-y-auto max-h-[70vh]">
            {selectedFile && selectedContent ? (
              <div className="animate-fade-in">
                <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm border-b border-border px-6 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {selectedFile.title}
                      </h3>
                      {selectedFile.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {selectedFile.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground/50">
                        {selectedFile.path}
                      </span>
                      <a
                        href={selectedContent.blobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Open raw file"
                      >
                        <ExternalLinkIcon />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <article className="report-prose max-w-[75ch]">
                    <ReactMarkdown
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={rehypePlugins}
                      components={markdownComponents}
                    >
                      {selectedContent.content}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            ) : selectedFile && !selectedContent ? (
              <div className="flex items-center justify-center h-full p-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Content unavailable for this file.
                  </p>
                  {contentByPath.has(selectedPath ?? "") && (
                    <a
                      href={contentByPath.get(selectedPath ?? "")?.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline"
                    >
                      Open raw file <ExternalLinkIcon />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6">
                <p className="text-sm text-muted-foreground">
                  Select a file to view its contents.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
