/**
 * Shared shape for `FindingInspector` and ingest-derived roadmap rows
 * (avoids server → client component type imports).
 */
export type FindingInspectorData = {
  id: string;
  severity: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  recommendation: unknown;
};
