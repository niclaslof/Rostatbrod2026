"use client";

import { useMemo, useState } from "react";
import { site, CATEGORY_META, type MapPin, type PinCategory } from "@/lib/site";

type Filter = PinCategory | "all";

export default function PlacesGuide() {
  const [filter, setFilter] = useState<Filter>("all");
  const [topRated, setTopRated] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(
    () => new Set(site.pins.filter((p) => p.fav).map((p) => p.id)),
  );

  // Only show category chips for categories that actually have pins.
  const usedCategories = useMemo(
    () =>
      (Object.keys(CATEGORY_META) as PinCategory[]).filter((c) =>
        site.pins.some((p) => p.category === c),
      ),
    [],
  );

  const places = useMemo(() => {
    let list = site.pins.filter((p) => filter === "all" || p.category === filter);
    if (topRated) {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return list;
  }, [filter, topRated]);

  const toggleFav = (id: string) =>
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openPlace = (p: MapPin) => {
    if (p.url) {
      window.open(p.url, "_blank", "noopener,noreferrer");
    } else {
      document.getElementById("karta")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="utforska" className="py-16 sm:py-24 px-5 max-w-3xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">Platsguiden</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold amber-text">
          Utforska Albanien
        </h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
        <p className="text-warm text-sm sm:text-base max-w-2xl mx-auto mt-4">
          Stränder, krogar, kaféer och sevärt – kuraterat och rankat. Filtrera på
          kategori eller sortera efter betyg.
        </p>
      </div>

      <div className="card mt-10 overflow-hidden reveal shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
        {/* Category chip bar — horizontally scrollable */}
        <div className="bg-panel border-b border-line-soft px-3 py-2.5">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            <Chip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="Alla"
              emoji="✨"
            />
            {usedCategories.map((c) => (
              <Chip
                key={c}
                active={filter === c}
                onClick={() => setFilter(c)}
                label={CATEGORY_META[c].label}
                emoji={CATEGORY_META[c].emoji}
              />
            ))}
          </div>
        </div>

        {/* Filter row: Topprankat + count */}
        <div className="bg-panel/60 border-b border-line-soft px-4 py-2 flex items-center justify-between gap-3">
          <button
            onClick={() => setTopRated((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-[0.65rem] font-semibold transition-colors cursor-pointer ${
              topRated ? "bg-amber text-white" : "bg-tag text-warm hover:text-ink"
            }`}
          >
            <span className="text-amber-bright">★</span> Topprankat
          </button>
          <span className="micro normal-case tracking-wide">
            {filter === "all" ? "Alla platser" : CATEGORY_META[filter].label} (
            <span className="font-mono text-ink">{places.length}</span>)
          </span>
        </div>

        {/* Place rows */}
        <ul>
          {places.map((p) => {
            const meta = CATEGORY_META[p.category];
            const isFav = favs.has(p.id);
            return (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <div
                  onClick={() => openPlace(p)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-tag transition-colors"
                >
                  {/* Category thumb */}
                  <span
                    className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center text-white text-base"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden
                  >
                    {meta.emoji}
                  </span>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">
                      {p.name}
                      {p.fav && (
                        <span className="ml-1 text-amber-bright" aria-label="Favorit">
                          ★
                        </span>
                      )}
                    </p>
                    {(p.area || p.description) && (
                      <p className="text-[0.65rem] text-warm truncate">
                        {[p.area, p.description].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="text-[0.65rem] text-warm flex items-center gap-2 mt-0.5">
                      {p.rating != null && (
                        <span className="font-mono">
                          <span className="text-amber-bright">★</span> {p.rating.toFixed(1)}
                        </span>
                      )}
                      {p.price != null && p.price > 0 && (
                        <span className="text-price font-mono">{"$".repeat(p.price)}</span>
                      )}
                    </p>
                  </div>

                  {/* Favourite toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(p.id);
                    }}
                    aria-pressed={isFav}
                    aria-label={isFav ? "Ta bort favorit" : "Lägg till favorit"}
                    className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-base transition-colors cursor-pointer hover:text-amber ${
                      isFav ? "text-amber" : "text-faint"
                    }`}
                  >
                    {isFav ? "♥" : "♡"}
                  </button>
                </div>
              </li>
            );
          })}
          {places.length === 0 && (
            <li className="px-4 py-8 text-center text-warm text-sm">
              Inga platser i den valda kategorin.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

function Chip({
  active,
  onClick,
  label,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[0.7rem] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
        active ? "bg-amber text-white" : "bg-tag text-warm hover:text-ink"
      }`}
    >
      {emoji} {label}
    </button>
  );
}
