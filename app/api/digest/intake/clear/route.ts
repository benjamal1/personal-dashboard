import { NextResponse } from "next/server";

import { clearIntake } from "@/lib/digest-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST {id} clears one item; POST {} clears all completed items.
export async function POST(request: Request): Promise<NextResponse> {
  let body: { id?: unknown };
  try {
    body = (await request.json().catch(() => ({}))) as { id?: unknown };
  } catch {
    body = {};
  }

  const id = typeof body.id === "string" ? body.id : undefined;
  const removed = await clearIntake(id);
  return NextResponse.json({ status: "ok", removed });
}
