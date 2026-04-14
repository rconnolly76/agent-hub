import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-6xl font-bold text-muted-foreground/30 mb-4">404</div>
      <h1 className="text-xl font-semibold tracking-tight mb-2">
        Page not found
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-sm">
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
  );
}
