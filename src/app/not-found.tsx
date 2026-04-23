import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-5xl font-semibold text-muted-foreground/20 mb-4 tabular-nums tracking-tight">404</div>
      <h1 className="text-base font-semibold tracking-tight mb-2">
        Page not found
      </h1>
      <p className="text-[13px] text-muted-foreground mb-8 max-w-sm leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
      >
        &larr; Back to Projects
      </Link>
    </div>
    </div>
  );
}
