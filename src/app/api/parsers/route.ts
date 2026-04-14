import { NextResponse } from "next/server";
import { getRegisteredParserIds } from "@/lib/parsers";

/**
 * Lists built-in parser ids for use in `skillParserConfig` / `skillParserOverride`.
 */
export async function GET() {
  return NextResponse.json({
    registeredParserIds: getRegisteredParserIds(),
    specialParserIds: ["generic", "default", "content-bundle"],
  });
}
