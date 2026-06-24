import { site, type ScheduleItem } from "@/lib/site";
import { Icon } from "@/components/Icons";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string): string {
  const label = new Date(iso).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function Schedule() {
  const items: ScheduleItem[] = [...site.schedule].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <section id="schema" className="py-16 sm:py-24 px-5 max-w-5xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">Tidslinje</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink">
          Schema
        </h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
      </div>

      <ol className="relative mt-12 pl-12 sm:pl-16">
        {/* Vertical connecting rail */}
        <span
          aria-hidden
          className="absolute left-[1.4rem] sm:left-[1.9rem] top-3 bottom-3 w-px"
          style={{
            background:
              "linear-gradient(to bottom, rgba(180,83,9,0) 0%, rgba(180,83,9,0.45) 7%, rgba(180,83,9,0.45) 93%, rgba(180,83,9,0) 100%)",
          }}
        />

        {items.map((item, i) => {
          const prev = items[i - 1];
          const showDayDivider = !prev || dayKey(prev.start) !== dayKey(item.start);

          return (
            <li
              key={item.id}
              className="relative reveal"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {showDayDivider && (
                <div className="relative -ml-12 sm:-ml-16 mb-4 mt-2 first:mt-0">
                  <span className="inline-block micro text-warm bg-panel border border-line-soft rounded-full px-3 py-1">
                    {formatDay(item.start)}
                  </span>
                </div>
              )}

              <div className="relative pb-6">
                {/* Icon dot on the rail */}
                <span
                  aria-hidden
                  className="absolute -left-12 sm:-left-16 top-1 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-card border border-line-soft shadow-sm flex items-center justify-center"
                >
                  <Icon name={item.icon} className="text-amber" size={20} />
                </span>

                <div className="card px-4 sm:px-5 py-3 sm:py-4">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <time className="font-mono text-lg sm:text-xl font-bold text-amber tabular-nums leading-none">
                      {formatTime(item.start)}
                    </time>
                    {item.end && (
                      <span className="font-mono text-[0.7rem] sm:text-xs text-warm tabular-nums">
                        – {formatTime(item.end)}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-ink mt-1.5 leading-snug">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-warm text-sm mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
