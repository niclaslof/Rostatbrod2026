"use client";

import { useState } from "react";
import { site } from "@/lib/site";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section id="faq" className="py-16 sm:py-24 px-5 max-w-5xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">
          Bra att veta
        </p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold amber-text">
          Vanliga frågor
        </h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
      </div>

      <div className="card mt-10 sm:mt-14 reveal divide-y divide-line">
        {site.faq.map((item, index) => {
          const isOpen = openIndex === index;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;
          return (
            <div key={item.q}>
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                >
                  <span
                    className={`text-base sm:text-lg font-medium transition-colors ${
                      isOpen ? "text-amber" : "text-ink group-hover:text-amber"
                    }`}
                  >
                    {item.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex-none flex h-7 w-7 items-center justify-center rounded-full border border-line-soft text-amber text-lg leading-none transition-transform duration-300 ${
                      isOpen ? "rotate-45 bg-tag" : "rotate-0"
                    }`}
                  >
                    +
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <p className="text-sm sm:text-base leading-relaxed text-warm pb-5 pr-10">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
