"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type DigestJobBlockProps = {
  label: string;
  error: string | null;
  onRetry: () => void;
};

const RESOLVING_STAGE_SECONDS = 90;

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function DigestJobBlock({ label, error, onRetry }: DigestJobBlockProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (error) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [error]);

  if (error) {
    return (
      <div className="flex w-full flex-col gap-2 text-sm font-light text-zinc-400">
        <p>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="self-start text-zinc-300 underline-offset-4 hover:underline"
        >
          retry
        </button>
      </div>
    );
  }

  const stage = elapsedSeconds < RESOLVING_STAGE_SECONDS ? "resolving full text" : "generating note";

  return (
    <div className="flex w-full items-center gap-3 text-sm font-light text-zinc-400">
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
      <span className="text-zinc-600">{stage}</span>
      <span className="ml-auto font-mono text-xs tabular-nums text-zinc-600">
        {formatElapsed(elapsedSeconds)}
      </span>
    </div>
  );
}
