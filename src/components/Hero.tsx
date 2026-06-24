"use client";

import { useEffect, useState } from "react";
import { site, displayDestination } from "@/lib/site";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type Phase = "before" | "during" | "after";

const tripStart = new Date(site.tripStartISO);
const tripEnd = new Date(site.tripEndISO);

function formatRange(): string {
  const startDay = tripStart.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
  });
  const endDay = tripEnd.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
  });
  return `${startDay}–${endDay}`;
}

function diff(target: Date, now: Date): TimeLeft {
  let ms = target.getTime() - now.getTime();
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function Hero() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  let phase: Phase = "before";
  let left: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

  if (now) {
    if (now < tripStart) {
      phase = "before";
      left = diff(tripStart, now);
    } else if (now < tripEnd) {
      phase = "during";
      left = diff(tripEnd, now);
    } else {
      phase = "after";
    }
  }

  const cells: { label: string; value: number; isSeconds?: boolean }[] = [
    { label: "Dagar", value: left.days },
    { label: "Timmar", value: left.hours },
    { label: "Min", value: left.minutes },
    { label: "Sek", value: left.seconds, isSeconds: true },
  ];

  const countdownLabel =
    phase === "during" ? "Hemresan om" : "Vi drar om";

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-paper py-20 sm:py-28 px-5 max-w-5xl mx-auto"
    >
      <div className="text-center reveal">
        <p className="micro text-amber mb-4">
          {formatRange()} · {site.region}
        </p>

        <h1 className="font-display text-5xl sm:text-7xl font-bold text-ink leading-tight">
          {site.name}
        </h1>
        <p className="font-display text-7xl sm:text-9xl font-black text-amber leading-none mt-1">
          {site.badge}
        </p>

        <p className="font-display text-2xl sm:text-3xl font-bold text-clay mt-4">
          {displayDestination()}
        </p>

        <p className="text-warm max-w-xl mx-auto mt-6 text-sm sm:text-base leading-relaxed">
          {site.intro}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-7">
          <span className="rounded-full bg-tag text-xs text-warm px-3 py-1.5">
            📍 {site.region}
          </span>
          <span className="rounded-full bg-tag text-xs text-warm px-3 py-1.5">
            <span className="font-mono">{formatRange()}</span>
          </span>
          <span className="rounded-full bg-tag text-xs text-warm px-3 py-1.5">
            🍞 Råstätbröd
          </span>
        </div>
      </div>

      <div className="reveal mt-12">
        {phase === "after" ? (
          <div className="card-warm text-center py-10 max-w-md mx-auto">
            <p className="text-4xl mb-2">🏡</p>
            <p className="font-display text-2xl sm:text-3xl font-bold text-ink">
              Vi är hemma igen!
            </p>
            <p className="text-warm text-sm mt-2">
              Tack för en oförglömlig resa.
            </p>
          </div>
        ) : (
          <>
            <p className="text-center micro text-amber mb-4">
              {countdownLabel}
            </p>
            <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto">
              {cells.map((cell) => (
                <div
                  key={cell.label}
                  className={`card-warm text-center py-4 sm:py-6 ${
                    cell.isSeconds ? "pulse-ring" : ""
                  }`}
                >
                  <div className="font-mono tabular-nums font-black text-3xl sm:text-5xl text-amber leading-none">
                    {now ? pad(cell.value) : "--"}
                  </div>
                  <div className="mt-2 text-[0.6rem] sm:text-xs uppercase tracking-[0.2em] text-warm">
                    {cell.label}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="text-center mt-12 reveal">
        <a
          href="#schema"
          className="inline-block text-sm text-amber hover:text-amber-deep transition-colors tracking-wide"
        >
          Bläddra till schemat ↓
        </a>
      </div>
    </section>
  );
}
