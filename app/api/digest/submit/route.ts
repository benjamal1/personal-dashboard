import { NextResponse } from "next/server";

import { addIntakeItems, applyStatus } from "@/lib/digest-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_URL =
  process.env.READING_DIGEST_WEBHOOK_URL ?? "http://localhost:5678/webhook/reading-digest-intake";
const MAX_INPUT_LENGTH = 10000;

function parseInputs(body: { input?: unknown; inputs?: unknown }): string[] {
  const raw = Array.isArray(body.inputs) ? body.inputs : [body.input];
  return raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0 && value.length <= MAX_INPUT_LENGTH);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: { input?: unknown; inputs?: unknown };
  try {
    body = (await request.json()) as { input?: unknown; inputs?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inputs = parseInputs(body);
  if (inputs.length === 0) {
    return NextResponse.json({ error: "Provide input or inputs[]" }, { status: 400 });
  }

  const items = await addIntakeItems(inputs);

  // Fire one pipeline run per paper; each responds instantly (queued) and reports
  // progress back via /api/digest/intake/status. A webhook failure marks the item failed.
  await Promise.all(
    items.map(async (item) => {
      try {
        const response = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intakeId: item.id, input: item.input })
        });
        if (!response.ok) {
          throw new Error(`webhook ${response.status}`);
        }
      } catch (error) {
        await applyStatus({
          id: item.id,
          stage: "queued",
          state: "failed",
          error: error instanceof Error ? error.message : "submit failed"
        });
      }
    })
  );

  return NextResponse.json({ status: "queued", items });
}
