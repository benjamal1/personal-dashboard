import { NextResponse } from "next/server";

import { deleteTodo, toggleTodo } from "@/lib/todos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PATCH(_request: Request, { params }: RouteContext) {
  const todo = await toggleTodo(undefined, params.id);

  if (!todo) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  return NextResponse.json(todo);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const deleted = await deleteTodo(undefined, params.id);

  if (!deleted) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
