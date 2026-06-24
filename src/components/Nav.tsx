"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import ThemeToggle from "@/components/ThemeToggle";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: "#schema", label: "Schema" },
  { href: "#karta", label: "Karta" },
  { href: "#utforska", label: "Utforska" },
  { href: "#album", label: "Album" },
  { href: "#dela", label: "Dela" },
  { href: "#gastbok", label: "Gästbok" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed top-0 inset-x-0 z-[70] h-16 bg-paper/90 backdrop-blur-md border-b border-line">
      <nav className="h-full max-w-5xl mx-auto px-5 flex items-center justify-between">
        <a
          href="#top"
          onClick={() => setOpen(false)}
          className="flex items-baseline gap-1.5 group"
        >
          <span className="font-display text-lg sm:text-xl font-bold text-ink group-hover:text-amber transition-colors">
            {site.name}
          </span>
          <span className="micro text-amber">
            {site.badge}
          </span>
        </a>

        <div className="flex items-center gap-2">
          <ul className="hidden md:flex items-center gap-7">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-warm hover:text-amber transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <ThemeToggle />

          <button
            type="button"
            aria-label={open ? "Stäng meny" : "Öppna meny"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="md:hidden relative w-9 h-9 flex items-center justify-center text-warm hover:text-amber transition-colors"
          >
          <span className="sr-only">Meny</span>
          <span className="relative block w-5 h-4">
            <span
              className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition-all duration-300 ${
                open ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-5 bg-current transition-all duration-300 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-0.5 w-5 bg-current transition-all duration-300 ${
                open ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </span>
          </button>
        </div>
      </nav>

      <div
        className={`md:hidden overflow-hidden border-t border-line bg-paper/95 backdrop-blur-md transition-[max-height,opacity] duration-300 ease-out ${
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <ul className="px-5 py-3">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-3 text-base text-warm hover:text-amber transition-colors border-b border-line last:border-b-0"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
