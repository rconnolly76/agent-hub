import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const allProjects = await db.query.projects.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  const safe = allProjects.map(({ apiKey: _key, ...rest }) => rest);
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, repoUrl } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const apiKey = `sk_${uuidv4().replace(/-/g, "")}`;

  const [project] = await db
    .insert(projects)
    .values({ name, repoUrl: repoUrl ?? null, apiKey })
    .returning();

  return NextResponse.json(project, { status: 201 });
}
