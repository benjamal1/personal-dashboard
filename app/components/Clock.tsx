"use client";

import { useEffect, useState } from "react";

import { formatDate, formatTime } from "@/lib/dateTime";

type ClockProps = {
  initialTimestamp: string;
};

export default function Clock({ initialTimestamp }: ClockProps) {
  const [now, setNow] = useState(() => new Date(initialTimestamp));

  useEffect(() => {
    setNow(new Date());

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="flex w-full max-w-4xl flex-col items-center justify-center text-center">
      <p className="text-balance text-4xl font-light tracking-tight text-zinc-100 sm:text-5xl md:text-6xl">
        {formatDate(now)}
      </p>
      <p className="mt-4 text-xl font-light tracking-[0.3em] text-zinc-500 sm:text-2xl md:text-3xl">
        {formatTime(now)}
      </p>
    </section>
  );
}
