import { homedir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { setItemPriority, type Priority } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_DIGEST_DIR =
  process.env.READING_DIGEST_VAULT_DIR ??
  join(homedir(), "obsidian-vault", "Articles and Papers", "Reading Digest");

const VOTE_TO_PRIORITY: Record<string, Priority> = {
  up: "high",
  down: "low",
  clear: "normal"
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: { itemId?: unknown; vote?: unknown };
  try {
    body = (await request.json()) as { itemId?: unknown; vote?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const priority = typeof body.vote === "string" ? VOTE_TO_PRIORITY[body.vote] : undefined;

  if (!itemId || !priority) {
    return NextResponse.json({ error: "Provide itemId and vote (up|down|clear)" }, { status: 400 });
  }

  const ok = await setItemPriority(VAULT_DIGEST_DIR, itemId, priority);
  if (!ok) {
    return NextResponse.json({ error: "Unknown item" }, { status: 404 });
  }

  return NextResponse.json({ status: "ok", priority });
}
