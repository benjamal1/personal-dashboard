"use client";

import { useCallback, useEffect, useState } from "react";

import type { RecentNote, TodayDigest } from "@/lib/digest";
import { reconcilePending, type PendingItem } from "@/lib/digest-shared";
import DigestSubmitBar from "./DigestSubmitBar";
import DigestPendingSection from "./DigestPendingSection";
import DigestTodaySection from "./DigestTodaySection";
import DigestRecentSection from "./DigestRecentSection";

const POLL_INTERVAL_MS = 60_000;
const VAULT_NAME = "obsidian-vault";
const PENDING_KEY = "reading-digest-pending";

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

    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refresh]);

  // Reconcile pending against notes whenever the library updates (poll/submit).
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

  return (
    <div className="flex w-full flex-col gap-12">
      <DigestSubmitBar onQueued={handleQueued} />
      {error ? <p className="text-xs font-light text-red-400">{error}</p> : null}
      <DigestPendingSection items={pending} onDismiss={handleDismiss} />
      <DigestTodaySection date={today.date} papers={today.papers} vaultName={VAULT_NAME} />
      <DigestRecentSection notes={recent} vaultName={VAULT_NAME} />
    </div>
  );
}
