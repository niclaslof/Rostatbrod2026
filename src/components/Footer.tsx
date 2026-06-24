import { site, displayDestination } from "@/lib/site";

export default function Footer() {
  return (
    <footer
      className="px-5 pt-12 text-center"
      style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-5xl mx-auto reveal">
        <p className="font-display text-2xl sm:text-3xl font-bold amber-text">
          {site.name} {site.badge}
        </p>
        <div className="fancy-rule w-24 mx-auto my-5" />
        <p className="text-xs sm:text-sm text-warm">
          Hemlig resa · {displayDestination()}
        </p>
        <p className="mt-2 text-xs sm:text-sm text-warm">{site.tagline}</p>
      </div>
    </footer>
  );
}
