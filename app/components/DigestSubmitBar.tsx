"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting"; input: string }
  | { status: "error"; input: string; message: string };

type DigestSubmitBarProps = {
  // Called once the webhook accepts the submission (async — the note lands
  // ~15 min later). The parent tracks it as a pending item until then.
  onQueued: (input: string) => void;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

export default function DigestSubmitBar({ onQueued }: DigestSubmitBarProps) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(input: string): Promise<void> {
    setState({ status: "submitting", input });

    try {
      const response = await fetch("/api/digest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`);
      }

      setValue("");
      setState({ status: "idle" });
      onQueued(input);
    } catch (error: unknown) {
      setState({ status: "error", input, message: getErrorMessage(error) });
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const trimmed = value.trim();

    if (trimmed.length === 0 || state.status === "submitting") {
      return;
    }

    void submit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://arxiv.org/abs/… or paper title"
          aria-label="Paper URL or title"
          disabled={state.status === "submitting"}
          className="w-full bg-transparent text-sm font-light text-zinc-100 placeholder:text-zinc-700 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={state.status === "submitting"}
          className="flex shrink-0 items-center gap-1 text-sm font-light text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 disabled:opacity-50"
        >
          {state.status === "submitting" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} aria-hidden="true" />
          ) : null}
          add →
        </button>
      </div>
      {state.status === "error" ? (
        <p className="text-xs font-light text-red-400">
          {state.message} ·{" "}
          <button
            type="button"
            onClick={() => void submit(state.input)}
            className="text-zinc-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
          >
            retry
          </button>
        </p>
      ) : (
        <p className="text-xs font-light text-zinc-700">arxiv · pmc · springer · wiley · acs · ieee · doi</p>
      )}
    </form>
  );
}
