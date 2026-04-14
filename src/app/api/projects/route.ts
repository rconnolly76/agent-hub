import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import { parseSkillParserConfig } from "@/lib/parsers";

export async function GET() {
  const allProjects = await db.query.projects.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  const safe = allProjects.map(({ apiKey: _key, ...rest }) => rest);
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, repoUrl, skillParserConfig: rawParserConfig } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    let skillParserConfig: ReturnType<typeof parseSkillParserConfig> | null =
      null;
    if (rawParserConfig !== undefined && rawParserConfig !== null) {
      try {
        skillParserConfig = parseSkillParserConfig(rawParserConfig) ?? null;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const apiKey = `sk_${uuidv4().replace(/-/g, "")}`;

    const [project] = await db
      .insert(projects)
      .values({
        name,
        repoUrl: repoUrl ?? null,
        apiKey,
        skillParserConfig: skillParserConfig ?? null,
      })
      .returning();

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    console.error("[POST /api/projects]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
