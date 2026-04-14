import type { ContentBundleManifest } from "@/lib/parsers/content-bundle";

interface ContentArtifact {
  filename: string;
  blobUrl: string;
}

export function ContentBundleSection({
  manifest,
  contentArtifacts,
}: {
  manifest: ContentBundleManifest;
  contentArtifacts: ContentArtifact[];
}) {
  const byPath = new Map(contentArtifacts.map((a) => [a.filename, a.blobUrl]));

  return (
    <div className="mt-8 rounded-lg border border-border bg-card/30 px-6 py-5">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        Content bundle
      </h2>
      {manifest.mode && (
        <p className="text-xs text-muted-foreground mb-3">
          Mode: <span className="text-foreground font-medium">{manifest.mode}</span>
        </p>
      )}
      <ul className="space-y-2">
        {manifest.files.map((f) => {
          const href = byPath.get(f.path);
          return (
            <li key={f.path} className="text-sm">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  {f.title}
                </a>
              ) : (
                <span className="text-foreground font-medium">{f.title}</span>
              )}
              <span className="text-muted-foreground font-mono text-xs ml-2">
                {f.path}
              </span>
              {f.description && (
                <p className="text-xs text-muted-foreground mt-0.5 pl-0">{f.description}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
