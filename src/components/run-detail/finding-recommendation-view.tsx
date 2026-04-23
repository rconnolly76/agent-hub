import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

const KNOWN: { key: string; label: string }[] = [
  { key: "userOutcome", label: "User outcome" },
  { key: "userStory", label: "User story" },
  { key: "what", label: "What" },
  { key: "why", label: "Why" },
  { key: "type", label: "Type" },
  { key: "owner", label: "Owner" },
  { key: "theme", label: "Theme" },
  { key: "epic", label: "Epic" },
  { key: "effort", label: "Effort" },
  { key: "doneWhen", label: "Done when" },
  { key: "rationale", label: "Rationale" },
  { key: "action", label: "Action" },
];

function labelize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

function formatValue(v: unknown, depth: number): ReactNode {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (depth > 2)
      return (
        <pre className="text-[10px] font-mono text-zinc-500 m-0 whitespace-pre-wrap break-all">
          {JSON.stringify(v, null, 2)}
        </pre>
      );
    return (
      <ul className="m-0 list-inside list-disc space-y-1 pl-0 text-sm text-zinc-300/90">
        {v.map((x, i) => (
          <li key={i} className="pl-0.5">
            {formatValue(x, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object") {
    if (depth > 2) {
      return (
        <pre className="text-[10px] font-mono text-zinc-500 m-0 whitespace-pre-wrap break-all max-h-40 overflow-auto">
          {JSON.stringify(v, null, 2)}
        </pre>
      );
    }
    const o = v as Record<string, unknown>;
    return (
      <div className="mt-1 space-y-1.5 rounded border border-white/[0.08] bg-black/20 p-2.5">
        {Object.entries(o).map(([k, val]) => (
          <div key={k}>
            <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500/90 m-0 mb-0.5">
              {labelize(k)}
            </p>
            <div className="text-sm text-zinc-300/90">
              {formatValue(val, depth + 1)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return String(v);
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object")
    return Object.keys(v as object).length === 0;
  return false;
}

export function FindingRecommendationView({
  recommendation,
  className,
}: {
  recommendation: unknown;
  className?: string;
}) {
  if (recommendation == null || isEmpty(recommendation)) return null;

  if (typeof recommendation === "string" || typeof recommendation === "number") {
    return (
      <div className={className}>
        <p className="text-[10px] font-medium tracking-[0.05em] uppercase text-zinc-500/90 mb-1.5">
          Recommendation
        </p>
        <p className="m-0 text-sm leading-relaxed text-zinc-300/90">
          {String(recommendation)}
        </p>
      </div>
    );
  }

  if (typeof recommendation !== "object" || Array.isArray(recommendation)) {
    return (
      <div className={className}>
        <p className="text-[10px] font-medium tracking-[0.05em] uppercase text-zinc-500/90 mb-1.5">
          Recommendation
        </p>
        <div className="text-sm text-zinc-300/90">{formatValue(recommendation, 0)}</div>
      </div>
    );
  }

  const o = recommendation as Record<string, unknown>;
  const seen = new Set<string>();
  const knownRows: { key: string; label: string; value: unknown }[] = [];
  for (const { key, label } of KNOWN) {
    if (key in o && !isEmpty(o[key])) {
      knownRows.push({ key, label, value: o[key] });
      seen.add(key);
    }
  }
  const extraKeys = Object.keys(o)
    .filter((k) => !seen.has(k) && !isEmpty(o[k]))
    .sort();

  if (knownRows.length === 0 && extraKeys.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-[10px] font-medium tracking-[0.05em] uppercase text-zinc-500/90 m-0">
        Recommendation
      </p>
      {knownRows.length > 0 && (
        <dl className="m-0 space-y-2.5">
          {knownRows.map(({ key, label, value }) => (
            <div key={key} className="min-w-0">
              <dt className="text-[9.5px] font-medium uppercase tracking-wider text-zinc-500/80 m-0 mb-0.5">
                {label}
              </dt>
              <dd className="m-0 text-[13px] leading-snug text-zinc-200/90 break-words">
                {formatValue(value, 0)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {extraKeys.length > 0 && (
        <div className="pt-0.5 space-y-2">
          {knownRows.length > 0 && (
            <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-600/90 m-0">
              More detail
            </p>
          )}
          <dl className="m-0 space-y-2">
            {extraKeys.map((k) => (
              <div key={k} className="min-w-0">
                <dt className="text-[9.5px] font-medium text-zinc-500/80 m-0 mb-0.5">
                  {labelize(k)}
                </dt>
                <dd className="m-0 text-sm text-zinc-300/85 break-words">
                  {formatValue(o[k], 0)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
