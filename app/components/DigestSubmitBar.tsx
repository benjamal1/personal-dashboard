"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

type DigestSubmitBarProps = {
  // Called after the submission is accepted; parent refreshes the intake queue.
  onSubmitted: () => void;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function DigestSubmitBar({ onSubmitted }: DigestSubmitBarProps) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(): Promise<void> {
    const inputs = value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (inputs.length === 0 || state.status === "submitting") {
      return;
    }

    setState({ status: "submitting" });
    try {
      const response = await fetch("/api/digest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`);
      }
      setValue("");
      setState({ status: "idle" });
      onSubmitted();
    } catch (error: unknown) {
      setState({ status: "error", message: getErrorMessage(error) });
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Enter submits; Shift+Enter inserts a newline (for adding several at once).
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-start gap-3 border-b border-zinc-800 pb-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Paste a link or title — Shift+Enter for several at once"
          aria-label="Paper URL or title"
          disabled={state.status === "submitting"}
          className="w-full resize-none bg-transparent text-sm font-light text-zinc-100 placeholder:text-zinc-700 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={state.status === "submitting"}
          className="flex shrink-0 items-center gap-1 pt-0.5 text-sm font-light text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 disabled:opacity-50"
        >
          {state.status === "submitting" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} aria-hidden="true" />
          ) : null}
          add →
        </button>
      </div>
      {state.status === "error" ? (
        <p className="text-xs font-light text-red-400">{state.message}</p>
      ) : (
        <p className="text-xs font-light text-zinc-700">arxiv · pmc · springer · wiley · acs · ieee · doi</p>
      )}
    </div>
  );
}
