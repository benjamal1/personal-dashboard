"use client";

import { useEffect, useState } from "react";

import DigestJobBlock from "./DigestJobBlock";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting"; input: string }
  | { status: "queued"; input: string }
  | { status: "error"; input: string; message: string };

// Submission is async: the webhook returns "queued" immediately and the
// resolver/note pipeline runs in the background (~15 min). The note appears in
// the Library section below on the next poll. This banner auto-clears.
const QUEUED_NOTICE_MS = 8000;

type DigestSubmitBarProps = {
  onSubmitted: () => void;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

export default function DigestSubmitBar({ onSubmitted }: DigestSubmitBarProps) {
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

      setState({ status: "queued", input });
      setValue("");
      onSubmitted();
    } catch (error: unknown) {
      setState({ status: "error", input, message: getErrorMessage(error) });
    }
  }

  useEffect(() => {
    if (state.status !== "queued") {
      return;
    }

    const timeout = setTimeout(() => setState({ status: "idle" }), QUEUED_NOTICE_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const trimmed = value.trim();

    if (trimmed.length === 0 || state.status === "submitting") {
      return;
    }

    void submit(trimmed);
  }

  if (state.status === "submitting") {
    return <DigestJobBlock label={state.input} error={null} onRetry={() => undefined} />;
  }

  if (state.status === "error") {
    return (
      <DigestJobBlock
        label={state.input}
        error={state.message}
        onRetry={() => setState({ status: "idle" })}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      {state.status === "queued" ? (
        <p className="text-xs font-light text-zinc-500">
          queued — <span className="text-zinc-400">{state.input}</span> appears in Library when ready
        </p>
      ) : null}
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://arxiv.org/abs/… or paper title"
          className="w-full bg-transparent text-sm font-light text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 text-sm font-light text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
        >
          add →
        </button>
      </div>
      <p className="text-xs font-light text-zinc-700">arxiv · pmc · springer · wiley · acs · ieee · doi</p>
    </form>
  );
}
