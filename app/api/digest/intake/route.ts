import { NextResponse } from "next/server";

import { listIntake } from "@/lib/digest-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const items = await listIntake();
  return NextResponse.json({ items });
}
