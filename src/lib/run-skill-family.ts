import type { SkillFamily } from "@/lib/suite-metadata";
import { skillFamilyForSkillType } from "@/lib/skills/catalog";

export function getSkillFamilyForRun(
  skillType: string,
  rawMetadata: unknown
): SkillFamily | null {
  if (rawMetadata && typeof rawMetadata === "object") {
    const sf = (rawMetadata as Record<string, unknown>).skillFamily;
    if (
      sf === "audit" ||
      sf === "browser" ||
      sf === "discovery" ||
      sf === "content" ||
      sf === "publish"
    ) {
      return sf;
    }
  }
  return skillFamilyForSkillType(skillType);
}
