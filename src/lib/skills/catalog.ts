/**
 * Known agentic-suite skills (evaluative reports + generative bundles).
 * Used for discovery in the CLI and documentation; ingest accepts any skillType string.
 */
import type { SkillFamily } from "@/lib/suite-metadata";

export type SkillArtifactKind = "report" | "content-bundle";

export interface SkillCatalogEntry {
  skill: string;
  kind: SkillArtifactKind;
  /** UI + analytics grouping; persisted on ingest from catalog unless overridden. */
  skillFamily: SkillFamily;
  /** Primary markdown report path (evaluative), relative to repo root */
  reportFile?: string;
  /** Optional run detail contract sidecar for richer FE rendering. */
  runDetailContractFile?: string;
  /** Optional top recommendations sidecar consumed by ingest. */
  topRecommendationsFile?: string;
  screenshotDir?: string;
  configDir?: string;
  /** Generative: directory containing _manifest.json */
  contentDir?: string;
}

export const SKILL_CATALOG: SkillCatalogEntry[] = [
  {
    skill: "ux-journey-discovery",
    kind: "report",
    skillFamily: "discovery",
    reportFile: "ux-journeys.md",
    runDetailContractFile: "_run-detail-contract.json",
    topRecommendationsFile: "_top-5-recommendations.json",
    configDir: "ux-journey-configs",
  },
  {
    skill: "ux-design-system-audit",
    kind: "report",
    skillFamily: "audit",
    reportFile: "design-system-audit.md",
    runDetailContractFile: "_run-detail-contract.json",
    topRecommendationsFile: "_top-5-recommendations.json",
  },
  {
    skill: "ux-journey-reviewer",
    kind: "report",
    skillFamily: "browser",
    reportFile: "ux-journey-report.md",
    runDetailContractFile: "_run-detail-contract.json",
    topRecommendationsFile: "_top-5-recommendations.json",
    screenshotDir: "ux-journey-screenshots",
    configDir: "ux-journey-configs",
  },
  {
    skill: "ux-visual-design-review",
    kind: "report",
    skillFamily: "browser",
    reportFile: "visual-design-review.md",
    runDetailContractFile: "_run-detail-contract.json",
    topRecommendationsFile: "_top-5-recommendations.json",
    screenshotDir: "visual-review-screenshots",
  },
  {
    skill: "code-quality-audit",
    kind: "report",
    skillFamily: "audit",
    reportFile: "code-quality-audit.md",
    runDetailContractFile: "_run-detail-contract.json",
    topRecommendationsFile: "_top-5-recommendations.json",
  },
  {
    skill: "web-security-audit",
    kind: "report",
    skillFamily: "audit",
    reportFile: "web-security-audit.md",
    runDetailContractFile: "_run-detail-contract.json",
    topRecommendationsFile: "_top-5-recommendations.json",
  },
  {
    skill: "web-performance-audit",
    kind: "report",
    skillFamily: "audit",
    reportFile: "web-performance-audit.md",
    runDetailContractFile: "_run-detail-contract.json",
    topRecommendationsFile: "_top-5-recommendations.json",
  },
  {
    skill: "product-marketer",
    kind: "content-bundle",
    skillFamily: "content",
    contentDir: "product-marketing",
    runDetailContractFile: "product-marketing/_run-detail-contract.json",
    topRecommendationsFile: "product-marketing/_top-5-recommendations.json",
  },
  {
    skill: "product-docs-author",
    kind: "content-bundle",
    skillFamily: "content",
    contentDir: "docs",
    runDetailContractFile: "docs/_run-detail-contract.json",
    topRecommendationsFile: "docs/_top-5-recommendations.json",
  },
];

export function catalogEntryForSkill(skill: string): SkillCatalogEntry | undefined {
  return SKILL_CATALOG.find((e) => e.skill === skill);
}

/** Default skill family for Hub UI; unknown skill types → audit for evaluative-looking report skills. */
export function skillFamilyForSkillType(skillType: string): SkillFamily | null {
  const entry = catalogEntryForSkill(skillType.trim());
  if (entry) return entry.skillFamily;
  if (skillType.trim() === "agent-hub-push") return "publish";
  return null;
}
