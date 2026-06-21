import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fires the recommender (only) to regenerate the queue in the background.
const REFILL_URL =
  process.env.READING_DIGEST_REFILL_URL ?? "http://localhost:5678/webhook/reading-digest-refill";

export async function POST(): Promise<NextResponse> {
  try {
    const response = await fetch(REFILL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Refill webhook failed" }, { status: 502 });
    }

    return NextResponse.json({ status: "queued" });
  } catch {
    return NextResponse.json({ error: "Failed to reach refill service" }, { status: 502 });
  }
}
