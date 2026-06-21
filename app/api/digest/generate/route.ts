import { NextResponse } from "next/server";

import { addIntakeItems, applyStatus } from "@/lib/digest-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_URL =
  process.env.READING_DIGEST_WEBHOOK_URL ?? "http://localhost:5678/webhook/reading-digest-intake";

// Generate a summary/note for an existing queue candidate (Today). Runs the same
// resolve→note pipeline but passes the registry item_id so the note-generator
// UPDATES that item (note_relpath, status) instead of appending a duplicate.
export async function POST(request: Request): Promise<NextResponse> {
  let body: { itemId?: unknown; input?: unknown };
  try {
    body = (await request.json()) as { itemId?: unknown; input?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";

  if (!input) {
    return NextResponse.json({ error: "Provide input (the paper's source or title)" }, { status: 400 });
  }

  const [item] = await addIntakeItems([input]);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeId: item.id, input, itemId })
    });
    if (!response.ok) {
      throw new Error(`webhook ${response.status}`);
    }
  } catch (error) {
    await applyStatus({
      id: item.id,
      stage: "queued",
      state: "failed",
      error: error instanceof Error ? error.message : "generate failed"
    });
  }

  return NextResponse.json({ status: "queued", item });
}
