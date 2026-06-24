"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";

interface Wish {
  author: string;
  message: string;
  createdAt: string;
}

const NAME_KEY = site.slug + "-name";

export default function Guestbook() {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(NAME_KEY) || "" : ""
  );
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWishes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wishes");
      if (res.ok) {
        const data = (await res.json()) as { wishes?: Wish[] };
        setWishes(data.wishes ?? []);
      }
    } catch {
      /* tyst – behåller befintliga hälsningar */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishes();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending) return;

    setSending(true);
    setError(null);

    const trimmedAuthor = author.trim();
    if (trimmedAuthor) localStorage.setItem(NAME_KEY, trimmedAuthor);

    try {
      const res = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: trimmedAuthor || "Anonym",
          message: trimmedMessage,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { wish?: Wish };
        if (data.wish) {
          setWishes((prev) => [data.wish as Wish, ...prev]);
        } else {
          await fetchWishes();
        }
        setMessage("");
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Något gick fel – försök igen.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel – försök igen.");
    } finally {
      setSending(false);
    }
  };

  const canSubmit = message.trim().length > 0 && !sending;

  return (
    <section id="gastbok" className="py-16 sm:py-24 px-5 max-w-5xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">
          Lämna en hälsning
        </p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink">
          Gästbok
        </h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
      </div>

      <form onSubmit={submit} className="card-warm p-5 sm:p-7 mt-10 reveal max-w-2xl mx-auto">
        <div className="grid sm:grid-cols-[160px_1fr] gap-3">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Ditt namn"
            className="px-4 py-2.5 rounded-xl bg-card text-ink text-sm border border-line-soft outline-none focus:border-amber placeholder:text-faint transition-colors"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Skriv din hälsning…"
            rows={3}
            className="px-4 py-2.5 rounded-xl bg-card text-ink text-sm border border-line-soft outline-none focus:border-amber placeholder:text-faint resize-none transition-colors"
          />
        </div>

        <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
          <p className="text-[0.7rem] text-warm font-mono">{message.length} / 600 tecken</p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2 rounded-full bg-amber text-white text-sm font-bold hover:bg-amber-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending ? "Skickar…" : "Skicka"}
          </button>
        </div>

        {error && <p className="text-wine text-xs mt-3">{error}</p>}
      </form>

      <div className="mt-10 space-y-3 max-w-2xl mx-auto">
        {loading && wishes.length === 0 && (
          <div className="flex items-center gap-3 py-6 text-warm text-sm justify-center">
            <div className="w-4 h-4 border-2 border-line-soft border-t-amber rounded-full animate-spin" />
            Laddar hälsningar…
          </div>
        )}

        {!loading && wishes.length === 0 && (
          <p className="text-warm text-center py-6 text-sm italic">
            Inga hälsningar än – skriv första!
          </p>
        )}

        {wishes.map((w, i) => (
          <article
            key={`${w.createdAt}-${i}`}
            className="card p-4 sm:p-5 reveal"
            style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <p className="text-ink font-semibold text-base sm:text-lg">{w.author}</p>
              <p className="text-[0.65rem] text-warm font-mono">
                {new Date(w.createdAt).toLocaleString("sv-SE", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <p className="text-warm text-sm leading-relaxed whitespace-pre-wrap">{w.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
