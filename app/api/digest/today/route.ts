import { homedir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { getTodayDigest } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_DIGEST_DIR =
  process.env.READING_DIGEST_VAULT_DIR ??
  join(homedir(), "obsidian-vault", "Articles and Papers", "Reading Digest");

export async function GET() {
  const digest = await getTodayDigest(VAULT_DIGEST_DIR);

  return NextResponse.json(digest);
}
