/**
 * Known agentic-suite skills (evaluative reports + generative bundles).
 * Used for discovery in the CLI and documentation; ingest accepts any skillType string.
 */
export type SkillArtifactKind = "report" | "content-bundle";

export interface SkillCatalogEntry {
  skill: string;
  kind: SkillArtifactKind;
  /** Primary markdown report path (evaluative), relative to repo root */
  reportFile?: string;
  screenshotDir?: string;
  configDir?: string;
  /** Generative: directory containing _manifest.json */
  contentDir?: string;
}

export const SKILL_CATALOG: SkillCatalogEntry[] = [
  {
    skill: "ux-journey-discovery",
    kind: "report",
    reportFile: "ux-journeys.md",
    configDir: "ux-journey-configs",
  },
  {
    skill: "ux-design-system-audit",
    kind: "report",
    reportFile: "design-system-audit.md",
  },
  {
    skill: "ux-journey-reviewer",
    kind: "report",
    reportFile: "ux-journey-report.md",
    screenshotDir: "ux-journey-screenshots",
    configDir: "ux-journey-configs",
  },
  {
    skill: "ux-visual-design-review",
    kind: "report",
    reportFile: "visual-design-review.md",
    screenshotDir: "visual-review-screenshots",
  },
  {
    skill: "code-quality-audit",
    kind: "report",
    reportFile: "code-quality-audit.md",
  },
  {
    skill: "web-security-audit",
    kind: "report",
    reportFile: "web-security-audit.md",
  },
  {
    skill: "web-performance-audit",
    kind: "report",
    reportFile: "web-performance-audit.md",
  },
  {
    skill: "product-marketer",
    kind: "content-bundle",
    contentDir: "product-marketing",
  },
  {
    skill: "product-docs-author",
    kind: "content-bundle",
    contentDir: "docs",
  },
];

export function catalogEntryForSkill(skill: string): SkillCatalogEntry | undefined {
  return SKILL_CATALOG.find((e) => e.skill === skill);
}
