"use client";

import { Loader2, AlertTriangle, X } from "lucide-react";

import type { PendingItem } from "@/lib/digest-shared";

type DigestPendingSectionProps = {
  items: PendingItem[];
  onDismiss: (id: string) => void;
};

export default function DigestPendingSection({ items, onDismiss }: DigestPendingSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-3">
      <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">
        Processing · {items.length}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            {item.failed ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500/70" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-600" strokeWidth={1.5} aria-hidden="true" />
            )}
            <span className="min-w-0 truncate text-sm font-light text-zinc-400">{item.input}</span>
            <span className="ml-auto shrink-0 text-xs font-light text-zinc-600">
              {item.failed ? "may have failed — re-submit" : "resolving…"}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss"
              className="shrink-0 text-zinc-700 hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
