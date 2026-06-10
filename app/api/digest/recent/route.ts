import { homedir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { getRecentNotes } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_DIGEST_DIR =
  process.env.READING_DIGEST_VAULT_DIR ??
  join(homedir(), "obsidian-vault", "Articles and Papers", "Reading Digest");

const RECENT_NOTES_LIMIT = 10;

export async function GET() {
  const notes = await getRecentNotes(VAULT_DIGEST_DIR, RECENT_NOTES_LIMIT);

  return NextResponse.json({ notes });
}
