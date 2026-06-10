import { NextResponse } from "next/server";

import { submitPaper } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_URL =
  process.env.READING_DIGEST_WEBHOOK_URL ?? "http://localhost:5678/webhook/reading-digest-intake";
const MAX_INPUT_LENGTH = 10000;

export async function POST(request: Request): Promise<NextResponse> {
  let body: { input?: unknown };
  try {
    body = (await request.json()) as { input?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return NextResponse.json({ error: "Missing 'input' field" }, { status: 400 });
  }

  if (input.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  try {
    const result = await submitPaper(WEBHOOK_URL, input);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Reading digest submit failed:", error);
    return NextResponse.json({ error: "Failed to reach reading digest service" }, { status: 502 });
  }
}
