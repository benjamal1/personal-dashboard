import { NextResponse } from "next/server";

import { setIntakeSource } from "@/lib/digest-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Update the source link of an in-flight intake item (e.g. paste a better link
// when the resolver couldn't find full text). Re-submitting is handled by the
// submit route; this just records the corrected source on the item.
export async function POST(request: Request): Promise<NextResponse> {
  let body: { id?: unknown; source?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; source?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";

  if (!id || !source) {
    return NextResponse.json({ error: "Provide id and source" }, { status: 400 });
  }

  const ok = await setIntakeSource(id, source);
  if (!ok) {
    return NextResponse.json({ error: "Unknown intake id" }, { status: 404 });
  }

  return NextResponse.json({ status: "ok" });
}
