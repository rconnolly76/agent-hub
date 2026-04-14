import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseSkillParserConfig } from "@/lib/parsers";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await req.json();
    const { name, repoUrl, skillParserConfig: rawParserConfig } = body;

    const updates: {
      name?: string;
      repoUrl?: string | null;
      skillParserConfig?: ReturnType<typeof parseSkillParserConfig> | null;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = name.trim();
    }
    if (repoUrl !== undefined) {
      updates.repoUrl =
        repoUrl === null || repoUrl === ""
          ? null
          : typeof repoUrl === "string"
            ? repoUrl
            : null;
    }
    if (rawParserConfig !== undefined) {
      if (rawParserConfig === null) {
        updates.skillParserConfig = null;
      } else {
        try {
          const parsed = parseSkillParserConfig(rawParserConfig);
          updates.skillParserConfig = parsed ?? null;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one of: name, repoUrl, skillParserConfig" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/projects/[id]]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
