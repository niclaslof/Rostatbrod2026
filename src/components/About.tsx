import Image from "next/image";
import { site } from "@/lib/site";

const features = [
  {
    emoji: "🗺️",
    title: "Karta",
    text: "Alla spots samlade — boende, mat och barer på ett ställe.",
  },
  {
    emoji: "📸",
    title: "Delat album",
    text: "Ladda upp helgens bilder — alla ser samma flöde.",
  },
  {
    emoji: "💸",
    title: "Dela notan",
    text: "Logga utgifterna så gör vi upp enkelt efteråt.",
  },
];

export default function About() {
  return (
    <section id="om" className="py-16 sm:py-24 px-5 max-w-5xl mx-auto">
      {site.portrait.src && (
        <div className="reveal flex justify-center mb-10">
          <div className="relative">
            <div
              className="absolute -inset-3 rounded-full bg-gradient-to-br from-amber/30 via-amber/10 to-transparent blur-xl"
              aria-hidden
            />
            <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-full overflow-hidden ring-4 ring-amber/40 border border-line-soft shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
              <Image
                src={site.portrait.src}
                alt={site.portrait.alt}
                width={448}
                height={448}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            {site.portrait.ribbon && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-1 rounded-full bg-amber text-white text-[0.65rem] uppercase tracking-[0.25em] font-bold shadow-lg">
                {site.portrait.ribbon}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-center reveal">
        <p className="micro text-amber mb-2">
          Vad är detta?
        </p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink">
          Råstätbröd 2026
        </h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
      </div>

      <p className="reveal mt-8 max-w-2xl mx-auto text-center text-base sm:text-lg leading-relaxed text-warm">
        Välkommen, gänget — {site.tagline.toLowerCase()}, och det här är vårt
        högkvarter fram till avfärd. Schema, karta, bilder och utgifter bor allt
        på ett och samma ställe, så ingen behöver leta i trådar och gruppchattar.
        Vart vi bär av? <span className="text-amber font-semibold">{site.region}.</span>
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card reveal text-center">
            <div className="text-3xl" aria-hidden>
              {f.emoji}
            </div>
            <h3 className="mt-3 font-display text-xl font-bold text-ink">
              {f.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-warm">{f.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
