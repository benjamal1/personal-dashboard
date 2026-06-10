"use client";

import { useCallback, useEffect, useState } from "react";

import type { RecentNote, TodayDigest } from "@/lib/digest";
import DigestSubmitBar from "./DigestSubmitBar";
import DigestTodaySection from "./DigestTodaySection";
import DigestRecentSection from "./DigestRecentSection";

const POLL_INTERVAL_MS = 60_000;
const VAULT_NAME = "obsidian-vault";

const EMPTY_TODAY: TodayDigest = { date: null, papers: [] };

export default function ReadingDigest() {
  const [today, setToday] = useState<TodayDigest>(EMPTY_TODAY);
  const [recent, setRecent] = useState<RecentNote[]>([]);

  const refresh = useCallback(async () => {
    const [todayResponse, recentResponse] = await Promise.all([
      fetch("/api/digest/today"),
      fetch("/api/digest/recent")
    ]);

    if (todayResponse.ok) {
      setToday(await todayResponse.json());
    }

    if (recentResponse.ok) {
      const body = await recentResponse.json();
      setRecent(body.notes ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex w-full flex-col gap-12">
      <DigestSubmitBar onSubmitted={refresh} />
      <DigestTodaySection date={today.date} papers={today.papers} vaultName={VAULT_NAME} />
      <DigestRecentSection notes={recent} vaultName={VAULT_NAME} />
    </div>
  );
}
