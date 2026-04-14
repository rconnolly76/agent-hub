"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-5xl mb-4">⚠</div>
      <h1 className="text-xl font-semibold tracking-tight mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-sm">
        An unexpected error occurred. This has been logged and we&apos;ll look
        into it.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Back to Projects
        </a>
      </div>
    </div>
  );
}
