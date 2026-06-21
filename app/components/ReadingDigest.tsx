"use client";

import { useCallback, useEffect, useState } from "react";

import type { RecentNote, TodayDigest } from "@/lib/digest";
import { reconcilePending, type PendingItem } from "@/lib/digest-shared";
import DigestSubmitBar from "./DigestSubmitBar";
import DigestPendingSection from "./DigestPendingSection";
import DigestTodaySection from "./DigestTodaySection";
import DigestRecentSection from "./DigestRecentSection";

const POLL_INTERVAL_MS = 60_000;
const TODAY_PAGE = 3;
const CURSOR_KEY = "reading-digest-cursor";
const PENDING_KEY = "reading-digest-pending";
// obsidian:// links open in the Obsidian app on whatever machine clicks them —
// usually the Mac over Tailscale, where the vault is named "BJ's Obsidian Vault".
const VAULT_NAME = process.env.NEXT_PUBLIC_OBSIDIAN_VAULT ?? "BJ's Obsidian Vault";

type Vote = "up" | "down";

const EMPTY_TODAY: TodayDigest = { date: null, papers: [] };

function loadPending(): PendingItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingItem[]) : [];
  } catch {
    return [];
  }
}

export default function ReadingDigest() {
  const [today, setToday] = useState<TodayDigest>(EMPTY_TODAY);
  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [pending, setPending] = useState<PendingItem[]>(loadPending);
  const [cursor, setCursor] = useState(0);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [todayResponse, recentResponse] = await Promise.all([
        fetch("/api/digest/today"),
        fetch("/api/digest/recent")
      ]);

      if (!todayResponse.ok || !recentResponse.ok) {
        throw new Error("bad response");
      }

      setToday(await todayResponse.json());
      const body = await recentResponse.json();
      setRecent(body.notes ?? []);
      setError(null);
    } catch {
      setError("Couldn't reach the digest service — showing the last loaded data.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Restore the cursor for the current queue (reset when a new queue is generated).
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(CURSOR_KEY);
      const saved = raw ? (JSON.parse(raw) as { date: string | null; cursor: number }) : null;
      setCursor(saved && saved.date === today.date ? saved.cursor : 0);
    } catch {
      setCursor(0);
    }
  }, [today.date]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(CURSOR_KEY, JSON.stringify({ date: today.date, cursor }));
  }, [cursor, today.date]);

  // Reconcile pending submissions against the library whenever it updates.
  useEffect(() => {
    setPending((prev) => reconcilePending(prev, recent));
  }, [recent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }, [pending]);

  const handleQueued = useCallback((input: string) => {
    setPending((prev) => [
      { id: crypto.randomUUID(), input, submittedAt: Date.now(), failed: false },
      ...prev
    ]);
    void refresh();
  }, [refresh]);

  const handleDismiss = useCallback((id: string) => {
    setPending((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleNext = useCallback(() => {
    setCursor((prev) => {
      const next = prev + TODAY_PAGE;
      if (next >= today.papers.length) {
        // Cycled through the queue — ask the recommender to refill in the background.
        void fetch("/api/digest/refill", { method: "POST" }).catch(() => undefined);
        return 0;
      }
      return next;
    });
  }, [today.papers.length]);

  const handleFeedback = useCallback((itemId: string, vote: Vote) => {
    let sent: Vote | "clear" = vote;
    setVotes((prev) => {
      const next = { ...prev };
      if (next[itemId] === vote) {
        delete next[itemId];
        sent = "clear";
      } else {
        next[itemId] = vote;
      }
      return next;
    });
    void fetch("/api/digest/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, vote: sent })
    }).catch(() => undefined);
  }, []);

  const visible = today.papers.slice(cursor, cursor + TODAY_PAGE);

  return (
    <div className="flex w-full flex-col gap-12">
      <DigestSubmitBar onQueued={handleQueued} />
      {error ? <p className="text-xs font-light text-red-400">{error}</p> : null}
      <DigestPendingSection items={pending} onDismiss={handleDismiss} />
      <DigestTodaySection
        date={today.date}
        papers={visible}
        total={today.papers.length}
        vaultName={VAULT_NAME}
        onNext={handleNext}
        onFeedback={handleFeedback}
        votes={votes}
      />
      <DigestRecentSection notes={recent} vaultName={VAULT_NAME} />
    </div>
  );
}
