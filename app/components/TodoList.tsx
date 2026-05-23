"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckSquare, Plus, Square } from "lucide-react";

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

type TodoResponse = {
  currentWeek: string;
  weekLabel: string;
  todos: TodoItem[];
};

type TodoState =
  | {
      status: "loading";
      currentWeek: string;
      weekLabel: string;
      todos: TodoItem[];
    }
  | {
      status: "ready";
      currentWeek: string;
      weekLabel: string;
      todos: TodoItem[];
    }
  | {
      status: "error";
      currentWeek: string;
      weekLabel: string;
      todos: TodoItem[];
    };

const EMPTY_STATE: TodoState = {
  status: "loading",
  currentWeek: "",
  weekLabel: "",
  todos: []
};

export default function TodoList() {
  const [state, setState] = useState<TodoState>(EMPTY_STATE);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTodos = async () => {
      try {
        const response = await fetch("/api/todos", {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load todos");
        }

        const payload = (await response.json()) as TodoResponse;

        if (!cancelled) {
          setState({
            status: "ready",
            ...payload
          });
        }
      } catch {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            status: "error"
          }));
        }
      }
    };

    void loadTodos();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = draft.trim();

    if (!text || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error("Failed to add todo");
      }

      const todo = (await response.json()) as TodoItem;

      setState((current) => ({
        status: "ready",
        currentWeek: current.currentWeek,
        weekLabel: current.weekLabel,
        todos: [...current.todos, todo]
      }));
      setDraft("");
    } catch {
      setState((current) => ({
        ...current,
        status: "error"
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error("Failed to toggle todo");
      }

      const todo = (await response.json()) as TodoItem;

      setState((current) => ({
        status: "ready",
        currentWeek: current.currentWeek,
        weekLabel: current.weekLabel,
        todos: current.todos.map((item) => (item.id === todo.id ? todo : item))
      }));
    } catch {
      setState((current) => ({
        ...current,
        status: "error"
      }));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete todo");
      }

      setState((current) => ({
        status: "ready",
        currentWeek: current.currentWeek,
        weekLabel: current.weekLabel,
        todos: current.todos.filter((item) => item.id !== id)
      }));
    } catch {
      setState((current) => ({
        ...current,
        status: "error"
      }));
    }
  };

  return (
    <section className="mt-16 flex w-full flex-col items-center text-center">
      <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-600">this week</p>
      {state.status === "loading" ? (
        <div className="mt-4 flex w-full max-w-sm flex-col items-center gap-2">
          <div className="h-4 w-32 animate-pulse bg-zinc-900" />
          <div className="mt-6 h-4 w-48 animate-pulse bg-zinc-900" />
          <div className="h-4 w-40 animate-pulse bg-zinc-900" />
          <div className="h-4 w-44 animate-pulse bg-zinc-900" />
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs font-light text-zinc-700">{state.weekLabel}</p>
          <ul className="mx-auto mt-6 flex w-full max-w-sm flex-col items-start gap-2 text-left text-sm font-light text-zinc-300">
            {state.todos.map((todo) => (
              <li
                key={todo.id}
                className="group flex w-full items-center gap-3 text-left transition-opacity duration-200"
              >
                <button
                  type="button"
                  onClick={() => void handleToggle(todo.id)}
                  className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-zinc-700 opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                  aria-label={todo.done ? `Mark ${todo.text} incomplete` : `Mark ${todo.text} complete`}
                >
                  {todo.done ? (
                    <CheckSquare
                      className="h-[14px] w-[14px] fill-zinc-400 text-zinc-400"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Square className="h-[14px] w-[14px] text-zinc-700" strokeWidth={1.5} />
                  )}
                </button>
                <span
                  className={`flex-1 transition-opacity duration-200 ${
                    todo.done ? "text-zinc-600 line-through opacity-60" : "opacity-100"
                  }`}
                >
                  {todo.text}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(todo.id)}
                  className="text-base font-light text-zinc-700 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
                  aria-label={`Delete ${todo.text}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {state.todos.length === 0 ? (
            <p className="mt-6 text-center text-xs font-light italic text-zinc-800">nothing yet</p>
          ) : null}
          <form onSubmit={handleSubmit} className="mt-4 flex w-full max-w-sm items-center gap-2 py-4">
            <Plus className="h-3 w-3 shrink-0 text-zinc-700" strokeWidth={1.5} aria-hidden="true" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="add a task"
              className="w-full border-0 border-b border-zinc-800 bg-transparent px-0 py-2 text-left text-sm font-light text-zinc-300 opacity-85 outline-none transition-opacity placeholder:italic placeholder:text-zinc-700 focus:opacity-100 disabled:opacity-50"
              autoComplete="off"
              disabled={submitting}
            />
          </form>
          {state.status === "error" ? (
            <p className="text-xs font-light text-zinc-700">todo list unavailable</p>
          ) : null}
        </>
      )}
    </section>
  );
}
