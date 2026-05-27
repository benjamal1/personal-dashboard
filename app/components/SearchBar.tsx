"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

/** Navigate to a Google search or directly to a URL */
function resolveQuery(raw: string): string {
  const q = raw.trim();
  if (!q) return "";

  // If it already has a protocol, treat as URL
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(q)) {
    try { new URL(q); return q; } catch { /* fall through */ }
  }

  // If it looks like a hostname (contains a dot, no spaces), prepend https://
  if (!q.includes(" ") && /^[^\s/$.?#].[^\s]*\.[^\s]+$/.test(q)) {
    try { new URL(`https://${q}`); return `https://${q}`; } catch { /* fall through */ }
  }

  // Otherwise: Google search
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

export default function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  // Focus when home view re-renders (view switch, etc.)
  // On initial page load, the `autoFocus` prop below handles it natively —
  // programmatic focus() is blocked by browsers until first user interaction.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const url = resolveQuery(query);
    if (url) window.location.href = url;
  };

  return (
    <div className="flex w-full items-center gap-3 border-b border-zinc-800/50 pb-3">
      <Search
        className="h-3.5 w-3.5 shrink-0 text-zinc-700"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setQuery(""); inputRef.current?.blur(); }
        }}
        placeholder="search or go to url"
        className="flex-1 bg-transparent text-sm font-light text-zinc-200 outline-none placeholder:text-zinc-700"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Search or navigate"
      />
    </div>
  );
}
