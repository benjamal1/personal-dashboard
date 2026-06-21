"use client";

import { useCallback, useEffect, useState } from "react";

import type { RecentNote, TodayDigest } from "@/lib/digest";
import type { IntakeItem } from "@/lib/digest-shared";
import DigestSubmitBar from "./DigestSubmitBar";
import DigestIntakeSection from "./DigestIntakeSection";
import DigestTodaySection from "./DigestTodaySection";
import DigestRecentSection from "./DigestRecentSection";

const POLL_INTERVAL_MS = 60_000;
const INTAKE_POLL_MS = 15_000;
const TODAY_PAGE = 3;
const CURSOR_KEY = "reading-digest-cursor";
// obsidian:// links open in the Obsidian app on whatever machine clicks them —
// usually the Mac over Tailscale, where the vault is named "BJ's Obsidian Vault".
const VAULT_NAME = process.env.NEXT_PUBLIC_OBSIDIAN_VAULT ?? "BJ's Obsidian Vault";

type Vote = "up" | "down";

const EMPTY_TODAY: TodayDigest = { date: null, papers: [] };

export default function ReadingDigest() {
  const [today, setToday] = useState<TodayDigest>(EMPTY_TODAY);
  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [intake, setIntake] = useState<IntakeItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [error, setError] = useState<string | null>(null);

  const loadIntake = useCallback(async () => {
    try {
      const res = await fetch("/api/digest/intake");
      if (res.ok) {
        setIntake((await res.json()).items ?? []);
      }
    } catch {
      // non-fatal; keep last
    }
  }, []);

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
      setRecent((await recentResponse.json()).notes ?? []);
      setError(null);
    } catch {
      setError("Couldn't reach the digest service — showing the last loaded data.");
    }
    await loadIntake();
  }, [loadIntake]);

  useEffect(() => {
    void refresh();
    const slow = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    // Poll the intake queue more often so live status feels responsive.
    const fast = setInterval(() => void loadIntake(), INTAKE_POLL_MS);
    return () => {
      clearInterval(slow);
      clearInterval(fast);
    };
  }, [refresh, loadIntake]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CURSOR_KEY);
      const saved = raw ? (JSON.parse(raw) as { date: string | null; cursor: number }) : null;
      setCursor(saved && saved.date === today.date ? saved.cursor : 0);
    } catch {
      setCursor(0);
    }
  }, [today.date]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CURSOR_KEY, JSON.stringify({ date: today.date, cursor }));
  }, [cursor, today.date]);

  const handleClear = useCallback(
    (id: string) => {
      void fetch("/api/digest/intake/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).then(loadIntake);
    },
    [loadIntake]
  );

  const handleClearDone = useCallback(() => {
    void fetch("/api/digest/intake/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }).then(loadIntake);
  }, [loadIntake]);

  const handleRetry = useCallback(
    (input: string) => {
      void fetch("/api/digest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: [input] })
      }).then(loadIntake);
    },
    [loadIntake]
  );

  const handleNext = useCallback(() => {
    setCursor((prev) => {
      const next = prev + TODAY_PAGE;
      if (next >= today.papers.length) {
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
      <DigestSubmitBar onSubmitted={refresh} />
      {error ? <p className="text-xs font-light text-red-400">{error}</p> : null}
      <DigestIntakeSection
        items={intake}
        vaultName={VAULT_NAME}
        onClear={handleClear}
        onClearDone={handleClearDone}
        onRetry={handleRetry}
      />
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
