export type RunSectionHealthLevel = "healthy" | "watch" | "critical" | "info";

export interface RunSectionHealth {
  id: string;
  title: string;
  level: RunSectionHealthLevel;
  summary?: string;
  criticalCount?: number;
  warningCount?: number;
  findingCount?: number;
}

export interface RunDetailContractV1 {
  version: "1.0";
  artifactKind: "report" | "content-bundle";
  sections: RunSectionHealth[];
}

interface FindingLike {
  severity: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
}

const slugPattern = /[^\w\s-]/g;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(slugPattern, "")
    .trim()
    .replace(/\s+/g, "-");
}

function toLevel(value: string): RunSectionHealthLevel {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "healthy" ||
    normalized === "watch" ||
    normalized === "critical" ||
    normalized === "info"
  ) {
    return normalized;
  }
  return "info";
}

function splitByH2(markdown: string): { title: string; body: string }[] {
  const lines = markdown.split("\n");
  const sections: { title: string; body: string }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (current) {
        sections.push({
          title: current.title,
          body: current.lines.join("\n"),
        });
      }
      const title = h2Match[1].replace(/[*_`~\[\]]/g, "").trim();
      current = { title, lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    sections.push({
      title: current.title,
      body: current.lines.join("\n"),
    });
  }

  return sections;
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

export function parseRunDetailContract(value: unknown): RunDetailContractV1 | null {
  if (!value || typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  const version = obj.version;
  const artifactKind = obj.artifactKind;
  const sections = obj.sections;

  if (version !== "1.0") return null;
  if (artifactKind !== "report" && artifactKind !== "content-bundle") return null;
  if (!Array.isArray(sections)) return null;

  const normalizedSections: RunSectionHealth[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const s = section as Record<string, unknown>;
    const title = typeof s.title === "string" ? s.title.trim() : "";
    if (!title) continue;

    const id =
      typeof s.id === "string" && s.id.trim() ? s.id.trim() : slugify(title);
    normalizedSections.push({
      id,
      title,
      level: toLevel(typeof s.level === "string" ? s.level : "info"),
      summary: typeof s.summary === "string" ? s.summary : undefined,
      criticalCount: safeNumber(s.criticalCount),
      warningCount: safeNumber(s.warningCount),
      findingCount: safeNumber(s.findingCount),
    });
  }

  if (normalizedSections.length === 0) return null;
  return {
    version: "1.0",
    artifactKind,
    sections: normalizedSections,
  };
}

function findingMatchesSection(
  finding: FindingLike,
  sectionTitle: string,
  sectionBody: string,
): boolean {
  const title = sectionTitle.toLowerCase();
  const bag = `${finding.category ?? ""} ${finding.title ?? ""} ${
    finding.description ?? ""
  }`.toLowerCase();

  const titleTokens = title
    .split(/[\s/:-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);

  if (titleTokens.length === 0) return false;
  const tokenMatch = titleTokens.some((token) => bag.includes(token));
  if (tokenMatch) return true;

  // Small fallback for sections with unique terminology not present in finding category.
  return titleTokens.some((token) => sectionBody.toLowerCase().includes(token));
}

export function buildRunDetailContractFromReport(params: {
  markdown: string;
  artifactKind: "report" | "content-bundle";
  findings?: FindingLike[];
}): RunDetailContractV1 | null {
  const sections = splitByH2(params.markdown);
  if (sections.length === 0) return null;

  const findingList = params.findings ?? [];
  const contractSections: RunSectionHealth[] = sections.map((section) => {
    const body = section.body.toLowerCase();
    const bodyCritical = (body.match(/\bcritical\b|🔴|\bc\d+\./g) || []).length;
    const bodyWarning = (body.match(/\bwarning\b|🟡|\bw\d+\./g) || []).length;
    const bodyHealthy =
      (body.match(/\bpassing\b|\bhealthy\b|🟢|\bg\d+\./g) || []).length;

    let criticalCount = bodyCritical;
    let warningCount = bodyWarning;
    let findingCount = 0;

    for (const finding of findingList) {
      if (!findingMatchesSection(finding, section.title, section.body)) continue;
      findingCount += 1;
      const severity = finding.severity.toLowerCase();
      if (severity === "critical") criticalCount += 1;
      if (severity === "warning") warningCount += 1;
    }

    const level: RunSectionHealthLevel =
      criticalCount > 0
        ? "critical"
        : warningCount > 0
          ? "watch"
          : bodyHealthy > 0
            ? "healthy"
            : "info";

    const summary =
      level === "critical"
        ? `${criticalCount} critical issue${criticalCount === 1 ? "" : "s"}`
        : level === "watch"
          ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
          : level === "healthy"
            ? "No critical or warning indicators"
            : "Informational section";

    return {
      id: slugify(section.title),
      title: section.title,
      level,
      summary,
      criticalCount,
      warningCount,
      findingCount,
    };
  });

  return {
    version: "1.0",
    artifactKind: params.artifactKind,
    sections: contractSections,
  };
}

export function buildRunDetailContractFromBundleManifest(manifest: {
  files: { path: string; title: string; category?: string }[];
}): RunDetailContractV1 {
  const sections = new Map<string, RunSectionHealth>();
  for (const file of manifest.files) {
    const category = file.category?.trim() || "Content";
    const id = slugify(category);
    const current = sections.get(id);
    if (current) {
      current.findingCount = (current.findingCount ?? 0) + 1;
    } else {
      sections.set(id, {
        id,
        title: category,
        level: "healthy",
        summary: "Generated content bundle section",
        findingCount: 1,
      });
    }
  }

  return {
    version: "1.0",
    artifactKind: "content-bundle",
    sections: Array.from(sections.values()),
  };
}
