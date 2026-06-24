"use client";

import { useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { site, CATEGORY_META, type MapPin, type PinCategory } from "@/lib/site";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function MapExplorer() {
  return (
    <section id="karta" className="py-16 sm:py-24 px-5 max-w-5xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">Var håller vi hus</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink">Karta</h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
        <p className="text-warm text-sm sm:text-base max-w-2xl mx-auto mt-4">
          Alla platser för resan – boende, mat, barer och sevärt – samlade på en karta.
          Tryck på en nål eller en plats i listan.
        </p>
      </div>

      <div className="mt-10 reveal">
        {API_KEY ? (
          <APIProvider apiKey={API_KEY} libraries={["marker"]}>
            <MapInner />
          </APIProvider>
        ) : (
          <NoKeyFallback />
        )}
      </div>
    </section>
  );
}

function MapInner() {
  const map = useMap();
  const [active, setActive] = useState<Set<PinCategory>>(
    () => new Set(Object.keys(CATEGORY_META) as PinCategory[]),
  );
  const [selected, setSelected] = useState<MapPin | null>(null);

  const usedCategories = useMemo(
    () => Array.from(new Set(site.pins.map((p) => p.category))),
    [],
  );

  const visiblePins = site.pins.filter((p) => active.has(p.category));

  const toggle = (c: PinCategory) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const focusPin = (p: MapPin) => {
    setSelected(p);
    if (map) {
      map.panTo({ lat: p.lat, lng: p.lng });
      if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
    }
  };

  const mapId = site.map.mapId || "DEMO_MAP_ID";

  return (
    <div>
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {usedCategories.map((c) => {
          const meta = CATEGORY_META[c];
          const on = active.has(c);
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`px-3 py-1.5 rounded-full text-[0.7rem] font-semibold transition-colors cursor-pointer ${
                on
                  ? "bg-amber text-white"
                  : "bg-panel text-warm hover:bg-tag"
              }`}
            >
              {meta.emoji} {meta.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl overflow-hidden border border-line-soft shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
        <Map
          mapId={mapId}
          defaultCenter={site.map.center}
          defaultZoom={site.map.zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          style={{ width: "100%", height: "min(70vh, 520px)" }}
        >
          {visiblePins.map((p) => (
            <AdvancedMarker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              onClick={() => setSelected(p)}
              title={p.name}
            >
              <Pin
                background={CATEGORY_META[p.category].color}
                borderColor="#ffffff"
                glyphColor="#ffffff"
              />
            </AdvancedMarker>
          ))}

          {selected && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelected(null)}
              headerDisabled
            >
              <div className="bg-card text-ink p-3 max-w-[220px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{CATEGORY_META[selected.category].emoji}</span>
                  <span className="micro text-amber">
                    {CATEGORY_META[selected.category].label}
                  </span>
                </div>
                <p className="font-semibold text-sm text-ink leading-tight">{selected.name}</p>
                {selected.description && (
                  <p className="text-[0.74rem] text-warm mt-1 leading-snug">{selected.description}</p>
                )}
                {(selected.area || selected.rating != null) && (
                  <p className="text-[0.65rem] text-warm flex items-center gap-2 mt-1">
                    {selected.area && <span>{selected.area}</span>}
                    {selected.rating != null && (
                      <span className="flex items-center gap-0.5">
                        <span className="text-amber-bright">★</span>
                        <span className="font-mono">{selected.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </p>
                )}
                <a
                  href={
                    selected.url ||
                    `https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-[0.72rem] font-semibold text-amber hover:underline"
                >
                  Vägbeskrivning →
                </a>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>

      {/* Pin list */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {visiblePins.map((p) => (
          <button
            key={p.id}
            onClick={() => focusPin(p)}
            className="card text-left p-3 flex items-start gap-3 hover:bg-tag transition-colors cursor-pointer"
          >
            <span
              className="w-11 h-11 rounded-lg flex items-center justify-center text-base text-white shrink-0"
              style={{ backgroundColor: CATEGORY_META[p.category].color }}
            >
              {CATEGORY_META[p.category].emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 min-w-0">
                <span className="block text-sm font-semibold text-ink truncate">{p.name}</span>
                {p.rating != null && (
                  <span className="ml-auto shrink-0 flex items-center gap-0.5 text-[0.7rem]">
                    <span className="text-amber-bright">★</span>
                    <span className="font-mono text-warm">{p.rating.toFixed(1)}</span>
                  </span>
                )}
              </span>
              {p.description && <span className="block text-[0.72rem] text-warm truncate">{p.description}</span>}
              <span className="flex items-center gap-2 mt-0.5">
                {p.area && <span className="text-[0.65rem] text-warm truncate">{p.area}</span>}
                {p.price != null && (
                  <span className="text-[0.65rem] font-mono text-price">{"$".repeat(p.price)}</span>
                )}
                {p.day && <span className="micro text-amber">{p.day}</span>}
              </span>
            </span>
          </button>
        ))}
        {visiblePins.length === 0 && (
          <p className="text-warm text-sm text-center py-6 sm:col-span-2">Inga platser i den valda kategorin.</p>
        )}
      </div>
    </div>
  );
}

/** Shown when no Google Maps key is configured — the spots still list nicely. */
function NoKeyFallback() {
  return (
    <div className="card p-5">
      <div className="rounded-lg bg-panel border border-line-soft p-3 text-[0.78rem] text-warm mb-4">
        Kartan aktiveras när <code className="text-amber font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> är
        satt i Vercel. Platserna visas i listan så länge.
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {site.pins.map((p) => (
          <a
            key={p.id}
            href={p.url || `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 rounded-xl bg-card border border-line-soft hover:bg-tag transition-colors"
          >
            <span
              className="w-11 h-11 rounded-lg flex items-center justify-center text-base text-white shrink-0"
              style={{ backgroundColor: CATEGORY_META[p.category].color }}
            >
              {CATEGORY_META[p.category].emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 min-w-0">
                <span className="block text-sm font-semibold text-ink truncate">{p.name}</span>
                {p.rating != null && (
                  <span className="ml-auto shrink-0 flex items-center gap-0.5 text-[0.7rem]">
                    <span className="text-amber-bright">★</span>
                    <span className="font-mono text-warm">{p.rating.toFixed(1)}</span>
                  </span>
                )}
              </span>
              {p.description && <span className="block text-[0.72rem] text-warm truncate">{p.description}</span>}
              {p.area && <span className="block text-[0.65rem] text-warm truncate mt-0.5">{p.area}</span>}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
