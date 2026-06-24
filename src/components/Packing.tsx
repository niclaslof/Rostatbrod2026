"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";

const STORAGE_KEY = `${site.slug}:packed`;

function itemKey(listIndex: number, itemIndex: number): string {
  return `${listIndex}:${itemIndex}`;
}

export default function Packing() {
  const [packed, setPacked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setPacked(parsed as Record<string, boolean>);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  function toggle(key: string) {
    setPacked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore quota / privacy errors */
        }
      }
      return next;
    });
  }

  return (
    <section id="packlista" className="py-16 sm:py-24 px-5 max-w-5xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">
          Glöm inget
        </p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold amber-text">
          Packlista
        </h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
        <p className="mt-4 text-sm text-warm">
          Tryck på en sak för att bocka av den — det sparas på din enhet.
        </p>
      </div>

      <div className="mt-10 sm:mt-14 grid gap-5 sm:gap-6 sm:grid-cols-2">
        {site.packing.map((list, listIndex) => {
          const total = list.items.length;
          const done = list.items.reduce(
            (count, _item, itemIndex) =>
              packed[itemKey(listIndex, itemIndex)] ? count + 1 : count,
            0,
          );

          return (
            <div key={list.title} className="card reveal">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-ink">
                  {list.title}
                </h3>
                <span className="font-mono text-xs tabular-nums text-amber">
                  {hydrated ? `${done}/${total}` : `${total}`}
                </span>
              </div>

              <ul className="mt-4 space-y-1">
                {list.items.map((item, itemIndex) => {
                  const key = itemKey(listIndex, itemIndex);
                  const isPacked = hydrated && Boolean(packed[key]);
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-pressed={isPacked}
                        className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-tag focus:outline-none focus-visible:ring-1 focus-visible:ring-amber"
                      >
                        <span
                          className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors ${
                            isPacked
                              ? "border-teal bg-teal/15 text-teal"
                              : "border-line text-transparent group-hover:border-amber"
                          }`}
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3 w-3"
                            aria-hidden="true"
                          >
                            <path d="M4 10.5 8 14.5 16 5.5" />
                          </svg>
                        </span>
                        <span
                          className={`text-sm transition-colors ${
                            isPacked
                              ? "text-faint line-through"
                              : "text-ink"
                          }`}
                        >
                          {item}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
