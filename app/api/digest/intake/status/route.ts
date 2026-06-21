import { NextResponse } from "next/server";

import { applyStatus, type IntakeStage, type IntakeState } from "@/lib/digest-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGES: IntakeStage[] = ["queued", "resolver", "note"];
const STATES: IntakeState[] = ["pending", "running", "done", "failed"];

// Called by the n8n pipeline after each stage to report progress.
export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const stage = body.stage as IntakeStage;
  const state = body.state as IntakeState;

  if (!id || !STAGES.includes(stage) || !STATES.includes(state)) {
    return NextResponse.json({ error: "Provide id, stage (resolver|note), state" }, { status: 400 });
  }

  const ok = await applyStatus({
    id,
    stage,
    state,
    noteFile: typeof body.noteFile === "string" ? body.noteFile : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    error: typeof body.error === "string" ? body.error : undefined
  });

  if (!ok) {
    return NextResponse.json({ error: "Unknown intake id" }, { status: 404 });
  }

  return NextResponse.json({ status: "ok" });
}
