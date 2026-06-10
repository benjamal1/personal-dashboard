import { NextResponse } from "next/server";

import { submitPaper } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_URL =
  process.env.READING_DIGEST_WEBHOOK_URL ?? "http://localhost:5678/webhook/reading-digest-intake";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export async function POST(request: Request) {
  const body = (await request.json()) as { input?: unknown };
  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return NextResponse.json({ error: "Missing 'input' field" }, { status: 400 });
  }

  try {
    const result = await submitPaper(WEBHOOK_URL, input);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 502 });
  }
}
