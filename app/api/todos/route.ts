import { NextResponse } from "next/server";

import { addTodo, getTodoList } from "@/lib/todos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const todos = await getTodoList();

  return NextResponse.json(todos);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: unknown };

  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Todo text is required" }, { status: 400 });
  }

  const todo = await addTodo(undefined, body.text);

  return NextResponse.json(todo, { status: 201 });
}
