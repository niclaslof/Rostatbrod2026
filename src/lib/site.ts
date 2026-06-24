/**
 * ════════════════════════════════════════════════════════════════════════
 *  RÅSTÄTBRÖD 2026 — single source of truth for ALL content.
 * ════════════════════════════════════════════════════════════════════════
 *
 *  The destination is a SURPRISE. Everything on the public site is driven by
 *  this one file, so when the secret lifts you only edit HERE — no component
 *  digging required.
 *
 *  TO GO LIVE WITH THE REAL TRIP:
 *    1. Set `destination` + `tripStartISO` / `tripEndISO`.
 *    2. Set `map.center` (lat/lng) and `map.zoom` to the real place.
 *    3. Fill `pins[]` with the spots you want on the map.
 *    4. Fill `schedule[]`, `people[]`, `packing[]`, `faq[]`.
 *    5. Flip `secret` to false to reveal the destination in the hero.
 *
 *  All times are ISO-8601 in local time (e.g. "2026-08-14T17:30").
 */

export interface MapPin {
  id: string;
  name: string;
  category: PinCategory;
  lat: number;
  lng: number;
  /** Short blurb shown in the info window + guide row. */
  description?: string;
  /** Optional external link (Google Maps, website, booking). */
  url?: string;
  /** Optional day grouping, e.g. "Dag 1". */
  day?: string;
  // ── Walli-style guide metadata (all optional) ──────────────────────────
  /** Neighbourhood / town shown before the description, e.g. "Sarandë". */
  area?: string;
  /** Rating 0–5, e.g. 4.7 (drives ★ + "Topprankat"). */
  rating?: number;
  /** Price tier 1–4 → "$"–"$$$$". 0/undefined hides it. */
  price?: number;
  /** Optional photo under /public, e.g. "/places/butrint.jpg". */
  photo?: string;
  /** Pre-selected as a favourite ♥ in the guide. */
  fav?: boolean;
}

export type PinCategory =
  | "stay"
  | "food"
  | "drink"
  | "cafe"
  | "beach"
  | "sight"
  | "activity"
  | "transport"
  | "meet";

export interface ScheduleItem {
  id: string;
  /** ISO datetime, local. */
  start: string;
  end?: string;
  title: string;
  description?: string;
  icon: ScheduleIcon;
  /** Optional pin id this item maps to on the map. */
  pinId?: string;
}

export type ScheduleIcon =
  | "plane"
  | "car"
  | "train"
  | "boat"
  | "bed"
  | "food"
  | "drink"
  | "party"
  | "sun"
  | "moon"
  | "camera"
  | "hike"
  | "gift"
  | "clock"
  | "sparkle"
  | "map";

export interface Person {
  id: string;
  name: string;
  /** Tailwind-friendly hex used for splitwise avatars. */
  color: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface CategoryMeta {
  label: string;
  emoji: string;
  /** hex color for the map marker + filter chip */
  color: string;
}

/** Visual + label metadata for each pin category. */
export const CATEGORY_META: Record<PinCategory, CategoryMeta> = {
  food: { label: "Mat", emoji: "🍽️", color: "#c96442" },
  drink: { label: "Barer", emoji: "🍸", color: "#9e4444" },
  cafe: { label: "Kaféer", emoji: "☕", color: "#b45309" },
  beach: { label: "Stränder", emoji: "🏖️", color: "#0d9488" },
  sight: { label: "Sevärt", emoji: "🏛️", color: "#4ea8de" },
  activity: { label: "Aktivitet", emoji: "🥾", color: "#48bf91" },
  stay: { label: "Boende", emoji: "🛏️", color: "#c9a227" },
  transport: { label: "Transport", emoji: "🚆", color: "#8a93a6" },
  meet: { label: "Mötesplats", emoji: "📍", color: "#f4d35e" },
};

interface SiteConfig {
  /** Marketing name shown in the hero / tab title. */
  name: string;
  /** Big stylized number/word in the hero (e.g. "2026"). */
  badge: string;
  tagline: string;
  /** Short one-liner under the hero headline. */
  intro: string;
  /** While true, the destination name is hidden behind "Hemlig destination". */
  secret: boolean;
  /** Real place — revealed once `secret` is false. */
  destination: string;
  /** Country/region subtitle. */
  region: string;
  /** Optional portrait shown in the About section. Leave `src` empty to hide it. */
  portrait: { src: string; alt: string; ribbon: string };
  /** ISO local datetime the trip starts (drives the countdown). */
  tripStartISO: string;
  /** ISO local datetime the trip ends. */
  tripEndISO: string;
  /** Google Maps configuration. */
  map: {
    center: { lat: number; lng: number };
    zoom: number;
    /** Optional Google Maps Map ID for cloud styling + Advanced Markers. */
    mapId: string;
  };
  pins: MapPin[];
  schedule: ScheduleItem[];
  people: Person[];
  packing: { title: string; items: string[] }[];
  faq: FaqItem[];
  /** localStorage / blob namespace — keep stable. */
  slug: string;
}

export const site: SiteConfig = {
  name: "Råstätbröd",
  badge: "2026",
  tagline: "Albanska rivieran väntar",
  intro:
    "Det är dags — vi drar till Albanien! Din guide till de bästa stränderna, krogarna och sevärdheterna, plus schema, karta, delat album och vem som är skyldig vem.",
  secret: false,
  destination: "Albanien",
  region: "Albanska rivieran · Sarandë",

  // ── Portrait shown in the About section. Set src "" to hide. ──────────
  portrait: {
    src: "/rostat.jpg",
    alt: "Råstätbröd 2026",
    ribbon: "Reseledaren",
  },

  // ── Placeholder dates — change to the real trip. ──────────────────────
  tripStartISO: "2026-08-14T17:30",
  tripEndISO: "2026-08-17T14:30",

  // ── Map: Albanska rivieran, centrerat kring Sarandë/Ksamil. ───────────
  map: {
    center: { lat: 39.95, lng: 19.98 },
    zoom: 9,
    // Create a Map ID in Google Cloud Console for custom styling +
    // Advanced Markers; leave "" to fall back to a default raster map.
    mapId: "",
  },

  // ── Platser (Albanien) — driver både kartan och Utforska-guiden. ──────
  pins: [
    // Stränder
    { id: "ksamil", name: "Ksamil & öarna", category: "beach", lat: 39.767, lng: 20.001, area: "Ksamil", rating: 4.6, fav: true, description: "Karibienvitt vatten och små öar du vadar ut till." },
    { id: "gjipe", name: "Gjipe Beach", category: "beach", lat: 40.139, lng: 19.645, area: "Himarë", rating: 4.7, description: "Dold vik mellan klipporna – kanjonvandring ner." },
    { id: "dhermi", name: "Dhërmi Beach", category: "beach", lat: 40.153, lng: 19.643, area: "Dhërmi", rating: 4.6, description: "Lång kiselstrand med kristallklart vatten och beach clubs." },
    { id: "pasqyra", name: "Pasqyra (Spegelstranden)", category: "beach", lat: 39.79, lng: 20.005, area: "Ksamil", rating: 4.5, description: "Liten vik med spegelblankt, turkost vatten." },
    // Sevärt
    { id: "butrint", name: "Butrint", category: "sight", lat: 39.7456, lng: 20.0206, area: "Sarandë", rating: 4.7, price: 1, fav: true, description: "Antik UNESCO-stad i en grön lagun." },
    { id: "blueeye", name: "Syri i Kaltër (Blå ögat)", category: "sight", lat: 39.923, lng: 20.19, area: "Muzinë", rating: 4.6, price: 1, description: "Bottenlös turkos källa mitt i skogen." },
    { id: "lekuresi", name: "Lëkurësi-borgen", category: "sight", lat: 39.866, lng: 20.009, area: "Sarandë", rating: 4.5, description: "Solnedgång över Sarandë och Korfu." },
    { id: "gjirokaster", name: "Gjirokastra slott", category: "sight", lat: 40.0758, lng: 20.1389, area: "Gjirokastër", rating: 4.7, price: 1, description: "Ottomansk stenstad, UNESCO-listad." },
    { id: "berat", name: "Berat – tusen fönsters stad", category: "sight", lat: 40.7058, lng: 19.9522, area: "Berat", rating: 4.7, description: "Vita osmanska hus staplade upp för berget." },
    // Mat
    { id: "marenostrum", name: "Mare Nostrum", category: "food", lat: 39.8745, lng: 20.0055, area: "Sarandë", rating: 4.6, price: 3, description: "Färsk fisk och skaldjur vid strandpromenaden." },
    { id: "guvaqoses", name: "Guva e Qoses", category: "food", lat: 39.876, lng: 20.006, area: "Sarandë", rating: 4.5, price: 2, description: "Grillat och traditionellt i en grottlik gård." },
    { id: "mullixhiu", name: "Mullixhiu", category: "food", lat: 41.319, lng: 19.81, area: "Tirana", rating: 4.6, price: 3, description: "Modern albansk gastronomi i en park." },
    { id: "kujtimi", name: "Kujtimi", category: "food", lat: 40.076, lng: 20.138, area: "Gjirokastër", rating: 4.6, price: 2, description: "Husmanskost på en terrass i gamla stan." },
    // Kafé & bar
    { id: "komiteti", name: "Komiteti – Kafe Muzeum", category: "cafe", lat: 41.327, lng: 19.823, area: "Tirana", rating: 4.6, price: 2, description: "Retrokafé fullt av prylar från kommunisttiden." },
    { id: "havana", name: "Havana Beach Club", category: "drink", lat: 39.77, lng: 20.003, area: "Ksamil", rating: 4.4, price: 3, description: "Cocktails med fötterna i sanden." },
    // Boende
    { id: "santaquaranta", name: "Santa Quaranta Resort", category: "stay", lat: 39.88, lng: 20.01, area: "Sarandë", rating: 4.5, price: 4, description: "Strandresort strax norr om Sarandë – vår bas." },
    { id: "mangalemi", name: "Hotel Mangalemi", category: "stay", lat: 40.703, lng: 19.951, area: "Berat", rating: 4.6, price: 2, description: "Charmigt osmanskt hus i Berat." },
    // Aktivitet
    { id: "llogara", name: "Llogara-passet", category: "activity", lat: 40.205, lng: 19.59, area: "Llogara", rating: 4.7, description: "Bergspass med vidöppen havsutsikt – paragliding." },
    { id: "karaburun", name: "Karaburun & Sazan båttur", category: "activity", lat: 40.46, lng: 19.48, area: "Vlorë", rating: 4.7, price: 3, description: "Båt till grottor och kristallklara vikar." },

    // ── Fler platser ──────────────────────────────────────────────────────
    // Stränder
    { id: "borsh", name: "Borsh Beach", category: "beach", lat: 40.046, lng: 19.853, area: "Borsh", rating: 4.4, description: "Albaniens längsta strand, kantad av olivlundar." },
    { id: "jale", name: "Jale Beach", category: "beach", lat: 40.121, lng: 19.658, area: "Vunë", rating: 4.5, description: "Ungdomlig vik med beach bars mellan Dhërmi och Himarë." },
    { id: "livadhi", name: "Livadhi Beach", category: "beach", lat: 40.085, lng: 19.733, area: "Himarë", rating: 4.4, description: "Bred kiselstrand strax söder om Himarë." },
    { id: "kakome", name: "Kakome Bay", category: "beach", lat: 39.835, lng: 19.985, area: "Sarandë", rating: 4.6, fav: true, description: "Avskild turkos vik som nås med båt eller stig." },

    // Sevärt
    { id: "rozafa", name: "Rozafa-fästningen", category: "sight", lat: 42.048, lng: 19.49, area: "Shkodër", rating: 4.5, price: 1, description: "Dramatisk borgruin med utsikt över tre floder." },
    { id: "kruja", name: "Krujas slott & basar", category: "sight", lat: 41.509, lng: 19.793, area: "Krujë", rating: 4.5, price: 1, description: "Skanderbegs fäste och en pittoresk gammal basar." },
    { id: "bunkart", name: "Bunk'Art 1", category: "sight", lat: 41.348, lng: 19.844, area: "Tirana", rating: 4.6, price: 2, description: "Kärnvapenbunker omgjord till museum om diktaturen." },
    { id: "skanderbeg", name: "Skanderbegtorget", category: "sight", lat: 41.328, lng: 19.819, area: "Tirana", rating: 4.4, description: "Tiranas pulserande hjärta med moské och museer." },
    { id: "onufri", name: "Onufri-museet", category: "sight", lat: 40.706, lng: 19.952, area: "Berat", rating: 4.5, price: 1, description: "Ikonsamling i Berats borgkyrka uppe på berget." },

    // Mat
    { id: "tradita", name: "Tradita G&T", category: "food", lat: 42.057, lng: 19.508, area: "Shkodër", rating: 4.6, price: 2, description: "Traditionell norralbansk mat i ett historiskt stenhus." },
    { id: "homemade", name: "Homemade Food Lili", category: "food", lat: 40.069, lng: 20.142, area: "Gjirokastër", rating: 4.7, price: 2, fav: true, description: "Hemlagat i en familjeträdgård – boka i förväg." },
    { id: "tymi", name: "Taverna Te Tymi", category: "food", lat: 40.102, lng: 19.744, area: "Himarë", rating: 4.5, price: 2, description: "Grillad fisk och meze vid hamnen i Himarë." },
    { id: "antigonea", name: "Restorant Antigonea", category: "food", lat: 39.876, lng: 20.007, area: "Sarandë", rating: 4.4, price: 2, description: "Generösa portioner och havsutsikt på promenaden." },

    // Kafé & bar
    { id: "sophie", name: "Sophie Caffe", category: "cafe", lat: 39.875, lng: 20.005, area: "Sarandë", rating: 4.5, price: 1, description: "Morgonkaffe och bakverk med utsikt mot Korfu." },
    { id: "radio", name: "Radio Bar", category: "drink", lat: 41.325, lng: 19.822, area: "Tirana", rating: 4.6, price: 2, description: "Mysig vintagebar i Blloku-kvarteren." },
    { id: "m8", name: "Mon Chéri", category: "cafe", lat: 40.075, lng: 20.139, area: "Gjirokastër", rating: 4.4, price: 1, description: "Litet kafé på kullerstensgatan i basaren." },

    // Boende
    { id: "rooms", name: "Stone City Hostel", category: "stay", lat: 40.074, lng: 20.14, area: "Gjirokastër", rating: 4.7, price: 1, description: "Charmigt boende i ett restaurerat osmanskt hus." },
    { id: "ksamilhotel", name: "Hotel Joni", category: "stay", lat: 39.769, lng: 20.0, area: "Ksamil", rating: 4.4, price: 2, description: "Familjehotell ett stenkast från Ksamils stränder." },

    // Aktivitet
    { id: "theth", name: "Theth & Blå ögat (norr)", category: "activity", lat: 42.39, lng: 19.77, area: "Theth", rating: 4.8, fav: true, description: "Alpdal i de albanska alperna – vandring till Blue Eye." },
    { id: "valbona", name: "Valbona–Theth-leden", category: "activity", lat: 42.42, lng: 19.88, area: "Theth", rating: 4.8, description: "Klassisk bergsvandring över Valbonapasset." },
    { id: "komani", name: "Komanisjön-färjan", category: "activity", lat: 42.094, lng: 19.83, area: "Shkodër", rating: 4.7, price: 2, description: "Spektakulär färjetur genom fjordlika bergskanjoner." },
  ],

  // ── Schema (Albanien). ────────────────────────────────────────────────
  schedule: [
    {
      id: "depart",
      start: "2026-08-14T17:30",
      title: "Avfärd från Arlanda",
      description: "Vi drar mot Albanien!",
      icon: "plane",
    },
    {
      id: "arrive",
      start: "2026-08-14T22:00",
      title: "Landning i Tirana & transfer söderut",
      icon: "car",
      pinId: "santaquaranta",
    },
    {
      id: "checkin",
      start: "2026-08-14T23:30",
      title: "Incheckning & första skålen",
      icon: "drink",
      pinId: "santaquaranta",
    },
    {
      id: "beach",
      start: "2026-08-15T11:00",
      title: "Stranddag i Ksamil",
      description: "Bada vid öarna och lata dagen bort.",
      icon: "sun",
      pinId: "ksamil",
    },
    {
      id: "butrint",
      start: "2026-08-15T16:30",
      title: "Butrint i eftermiddagsljus",
      icon: "camera",
      pinId: "butrint",
    },
    {
      id: "dinner",
      start: "2026-08-15T20:00",
      title: "Skaldjur på Mare Nostrum",
      icon: "food",
      pinId: "marenostrum",
    },
    {
      id: "blueeye",
      start: "2026-08-16T10:00",
      title: "Syri i Kaltër – Blå ögat",
      icon: "hike",
      pinId: "blueeye",
    },
    {
      id: "gjirokaster",
      start: "2026-08-16T15:00",
      title: "Gamla stan i Gjirokastër",
      icon: "map",
      pinId: "gjirokaster",
    },
    {
      id: "sunset",
      start: "2026-08-16T20:00",
      title: "Solnedgång på Lëkurësi-borgen",
      icon: "drink",
      pinId: "lekuresi",
    },
    {
      id: "return",
      start: "2026-08-17T14:30",
      title: "Hemfärd",
      icon: "plane",
    },
  ],

  // ── People — used as default members in the expense splitter. ─────────
  people: [
    { id: "p1", name: "Niclas", color: "#c9a227" },
    { id: "p2", name: "Resenär 2", color: "#e07a5f" },
    { id: "p3", name: "Resenär 3", color: "#9b7ede" },
    { id: "p4", name: "Resenär 4", color: "#4ea8de" },
  ],

  packing: [
    {
      title: "Måste-ha",
      items: ["ID / pass", "Laddare", "Bra humör", "Bekväma skor"],
    },
    {
      title: "Bra att ha",
      items: ["Solglasögon", "Powerbank", "Kontanter", "Värktabletter"],
    },
  ],

  faq: [
    {
      q: "Vart ska vi?",
      a: "Albanien! Vi baserar oss på Albanska rivieran kring Sarandë och Ksamil, med utflykter till Butrint, Blå ögat och Gjirokastër.",
    },
    {
      q: "Vilken valuta gäller?",
      a: "Albanska lek (ALL). Ta med lite kontanter för stränder och små krogar – kort funkar i städerna. Euro tas ibland men växelkursen blir sämre.",
    },
    {
      q: "Vad kostar det?",
      a: "Alla gemensamma utgifter loggas i Dela-fliken så vi enkelt kan göra upp efteråt.",
    },
    {
      q: "Hur hittar jag runt?",
      a: "Kolla Utforska-guiden och kartan – alla stränder, krogar och sevärdheter finns med, sorterbara efter betyg och kategori.",
    },
    {
      q: "Hur laddar jag upp bilder?",
      a: "Tryck på +-knappen nere till höger. Alla i sällskapet ser samma album.",
    },
  ],

  slug: "rostatbrod2026",
};

/** Convenience: the display name respecting the secret flag. */
export function displayDestination(): string {
  return site.secret ? "Hemlig destination" : site.destination;
}
