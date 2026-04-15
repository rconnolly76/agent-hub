"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-4xl mb-4">⚠</div>
      <h1 className="text-base font-semibold tracking-tight mb-2">
        Something went wrong
      </h1>
      <p className="text-[13px] text-muted-foreground mb-8 max-w-sm leading-relaxed">
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
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Back to Projects
        </Link>
      </div>
    </div>
  );
}
