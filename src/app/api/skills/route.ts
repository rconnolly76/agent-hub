import { NextResponse } from "next/server";
import { SKILL_CATALOG } from "@/lib/skills/catalog";

/** Lists known suite skills (paths, artifact kinds) for clients and push tooling. */
export async function GET() {
  return NextResponse.json({ skills: SKILL_CATALOG });
}
