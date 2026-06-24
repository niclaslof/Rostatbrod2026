"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark toggle. Light is the default; the choice is persisted to
 * localStorage and applied pre-paint by the inline script in layout.tsx,
 * so this only has to mirror + flip the `.dark` class on <html>.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Byt till ljust läge" : "Byt till mörkt läge"}
      title={dark ? "Ljust läge" : "Mörkt läge"}
      className={`w-9 h-9 rounded-full flex items-center justify-center text-base text-warm hover:text-amber hover:bg-tag transition-colors cursor-pointer ${className}`}
    >
      {/* Render a stable glyph until mounted to avoid hydration mismatch. */}
      <span suppressHydrationWarning>{mounted ? (dark ? "☀︎" : "☾") : "☾"}</span>
    </button>
  );
}
