"use client";

import { useState } from "react";
import { Loader2, Check, AlertTriangle, X } from "lucide-react";

import type { IntakeItem } from "@/lib/digest-shared";

const VAULT_NOTES_PATH = "Articles and Papers/Reading Digest/Notes";

type DigestIntakeSectionProps = {
  items: IntakeItem[];
  vaultName: string;
  onClear: (id: string) => void;
  onClearDone: () => void;
  onRetry: (input: string) => void;
};

type Visual = { label: string; tone: "muted" | "done" | "failed"; icon: "spin" | "done" | "fail" };

function visualFor(item: IntakeItem): Visual {
  if (item.state === "failed") {
    const what = item.stage === "note" ? "Note failed" : "Couldn't resolve";
    return { label: item.error ? `${what} — ${item.error}` : what, tone: "failed", icon: "fail" };
  }
  if (item.stage === "note" && item.state === "done") {
    return { label: "Note created", tone: "done", icon: "done" };
  }
  if (item.stage === "resolver" && item.state === "done") {
    return { label: "Paper found · writing note…", tone: "muted", icon: "spin" };
  }
  return { label: "Resolving paper…", tone: "muted", icon: "spin" };
}

function obsidianLink(vaultName: string, noteFile: string): string {
  const seg = noteFile.split("/").filter((s) => s !== "" && s !== "..").join("/");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(`${VAULT_NOTES_PATH}/${seg}`)}`;
}

export default function DigestIntakeSection({ items, vaultName, onClear, onClearDone, onRetry }: DigestIntakeSectionProps) {
  if (items.length === 0) {
    return null;
  }

  const hasDone = items.some((item) => item.state === "done");

  return (
    <section className="flex w-full flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">Incoming · {items.length}</p>
        {hasDone ? (
          <button
            type="button"
            onClick={onClearDone}
            className="text-xs font-light text-zinc-600 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
          >
            clear done
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <IntakeRow key={item.id} item={item} vaultName={vaultName} onClear={onClear} onRetry={onRetry} />
        ))}
      </ul>
    </section>
  );
}

function IntakeRow({
  item,
  vaultName,
  onClear,
  onRetry
}: {
  item: IntakeItem;
  vaultName: string;
  onClear: (id: string) => void;
  onRetry: (input: string) => void;
}) {
  const v = visualFor(item);
  const [link, setLink] = useState("");
  const toneClass = v.tone === "failed" ? "text-amber-500/80" : v.tone === "done" ? "text-zinc-400" : "text-zinc-600";

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        {v.icon === "spin" ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-600" strokeWidth={1.5} aria-hidden="true" />
        ) : v.icon === "done" ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-zinc-400" strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500/70" strokeWidth={1.5} aria-hidden="true" />
        )}
        {item.noteFile ? (
          <a
            href={obsidianLink(vaultName, item.noteFile)}
            className="min-w-0 truncate text-sm font-light text-zinc-200 hover:text-zinc-300"
          >
            {item.summary ?? item.input}
          </a>
        ) : (
          <span className="min-w-0 truncate text-sm font-light text-zinc-300">{item.input}</span>
        )}
        <span className={`ml-auto shrink-0 text-xs font-light ${toneClass}`}>{v.label}</span>
        <button
          type="button"
          onClick={() => onClear(item.id)}
          aria-label="Clear"
          className="shrink-0 text-zinc-700 hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      {item.state === "failed" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = link.trim();
            if (trimmed) {
              onRetry(trimmed);
              onClear(item.id);
              setLink("");
            }
          }}
          className="ml-6 flex items-center gap-2"
        >
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="paste a working link or PDF path to retry"
            aria-label="Retry with link"
            className="w-full bg-transparent text-xs font-light text-zinc-300 placeholder:text-zinc-700 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 text-xs font-light text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
          >
            retry →
          </button>
        </form>
      ) : null}
    </li>
  );
}
