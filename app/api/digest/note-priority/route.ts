import { homedir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { setNotePriority } from "@/lib/digest";
import type { Priority } from "@/lib/digest-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_DIGEST_DIR =
  process.env.READING_DIGEST_VAULT_DIR ??
  join(homedir(), "obsidian-vault", "Articles and Papers", "Reading Digest");

const PRIORITIES: Priority[] = ["high", "normal", "low"];

// Set a Library note's priority (caret controls on each row). Writes the note's
// frontmatter + mirrors into the registry.
export async function POST(request: Request): Promise<NextResponse> {
  let body: { fileName?: unknown; priority?: unknown };
  try {
    body = (await request.json()) as { fileName?: unknown; priority?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const priority = body.priority as Priority;

  if (!fileName || !PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: "Provide fileName and priority (high|normal|low)" }, { status: 400 });
  }

  const ok = await setNotePriority(VAULT_DIGEST_DIR, fileName, priority);
  if (!ok) {
    return NextResponse.json({ error: "Unknown note" }, { status: 404 });
  }

  return NextResponse.json({ status: "ok", priority });
}
