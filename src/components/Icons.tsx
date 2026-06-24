import type { ScheduleIcon } from "@/lib/site";

/** Inline stroke icons keyed by name. 24x24 viewBox, currentColor stroke. */
export function Icon({
  name,
  className = "",
  size = 22,
}: {
  name: ScheduleIcon;
  className?: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "plane":
      return (<svg {...common}><path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2 3 8l6 3.5L7 14l-2.5-.5L3 15l3 2 2 3 1.5-1.5L9 16l2.5-2 3.5 6 1.8-1.8Z" /></svg>);
    case "car":
      return (<svg {...common}><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" /><path d="M5 13h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" /><circle cx="7.5" cy="14.5" r="1" /><circle cx="16.5" cy="14.5" r="1" /></svg>);
    case "train":
      return (<svg {...common}><rect x="6" y="3" width="12" height="14" rx="2" /><path d="M6 10h12M9 17l-2 4M15 17l2 4" /><circle cx="9" cy="13.5" r=".6" /><circle cx="15" cy="13.5" r=".6" /></svg>);
    case "boat":
      return (<svg {...common}><path d="M3 16h18l-2 4H5l-2-4Z" /><path d="M5 16V9l7-3 7 3v7" /><path d="M12 3v3" /></svg>);
    case "bed":
      return (<svg {...common}><path d="M3 18v-7a2 2 0 0 1 2-2h9a3 3 0 0 1 3 3v6M3 14h18M3 18v2M21 14v6" /></svg>);
    case "food":
      return (<svg {...common}><path d="M7 3v8M5 3v4a2 2 0 0 0 2 2M9 3v4a2 2 0 0 1-2 2M7 11v10M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9" /></svg>);
    case "drink":
      return (<svg {...common}><path d="M6 4h12l-5 7v6M13 17h-2M9 21h6M6 4l6 7" /></svg>);
    case "party":
      return (<svg {...common}><path d="M3 21l5-13 8 8-13 5ZM14 4l1 1M18 2l.5 1.5M20 7l1.5.5M17 9l1 1" /></svg>);
    case "sun":
      return (<svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>);
    case "moon":
      return (<svg {...common}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /></svg>);
    case "camera":
      return (<svg {...common}><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><circle cx="12" cy="12.5" r="3" /></svg>);
    case "hike":
      return (<svg {...common}><circle cx="13" cy="5" r="1.5" /><path d="M11 9l2-1 2 2 2 1M11 9l-1 5 3 1 1 6M10 14l-3 6M13 8v3" /></svg>);
    case "gift":
      return (<svg {...common}><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M4 13h16M12 9v11M12 9S10 4 7.5 5.5 9.5 9 12 9ZM12 9s2-5 4.5-3.5S14.5 9 12 9Z" /></svg>);
    case "clock":
      return (<svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>);
    case "sparkle":
      return (<svg {...common}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" /></svg>);
    case "map":
      return (<svg {...common}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14" /></svg>);
    default:
      return (<svg {...common}><circle cx="12" cy="12" r="8" /></svg>);
  }
}
