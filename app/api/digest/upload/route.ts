import { homedir } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { addIntakeItems, applyStatus } from "@/lib/digest-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_DIGEST_DIR =
  process.env.READING_DIGEST_VAULT_DIR ??
  join(homedir(), "obsidian-vault", "Articles and Papers", "Reading Digest");
const WEBHOOK_URL =
  process.env.READING_DIGEST_WEBHOOK_URL ?? "http://localhost:5678/webhook/reading-digest-intake";
const MAX_BYTES = 50 * 1024 * 1024;

// Upload a PDF (e.g. for a paywalled paper). Saved into the vault PDFS/ folder on
// this box; the resolver agent runs here too, so it reads that on-box path
// directly — the user never deals with a filesystem path.
export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Provide a 'file'" }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is empty or larger than 50MB" }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  const fileName = `upload-${Date.now()}-${safeName}`;
  const dir = join(VAULT_DIGEST_DIR, "PDFS");
  const absPath = join(dir, fileName);

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(absPath, Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "Could not save the upload" }, { status: 500 });
  }

  // input = the on-box path the resolver will read.
  const [item] = await addIntakeItems([absPath]);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeId: item.id, input: absPath })
    });
    if (!response.ok) {
      throw new Error(`webhook ${response.status}`);
    }
  } catch (error) {
    await applyStatus({
      id: item.id,
      stage: "queued",
      state: "failed",
      error: error instanceof Error ? error.message : "upload submit failed"
    });
  }

  return NextResponse.json({ status: "queued", item });
}
