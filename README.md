# Råstätbröd 2026 🍞🗺️

A private trip micro-site for a **secret destination** — countdown, schedule, an
interactive Google Map of every spot, a shared photo/video album, a guestbook,
and a built-in **expense splitter** ("Dela notan"). Built on the same proven,
database-free stack as the Johan35 sister site (Next.js + Vercel Blob + Mux).

## One file to rule them all

All content lives in **`src/lib/site.ts`**. When the secret lifts:

1. Set `destination`, `region`, `tripStartISO`, `tripEndISO`.
2. Set `map.center` (lat/lng), `map.zoom`, and a `map.mapId` (Google Cloud Map ID).
3. Fill `pins[]` (the map spots), `schedule[]`, `people[]`, `packing[]`, `faq[]`.
4. Flip `secret: false` to reveal the destination.

No component edits required.

## Stack

- **Next.js 16 / React 19 / TypeScript / Tailwind v4**
- **Vercel Blob** — images + JSON state (guestbook, photo comments, split expenses)
- **Mux** — video upload, transcoding, HLS streaming, MP4 download
- **@vis.gl/react-google-maps** — the interactive map (advanced markers, info windows, category filters)

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the keys
npm run dev                  # http://localhost:3000
```

The site degrades gracefully: no Maps key → spots render as a list; no Mux →
images still work; no Blob token → read-only.

## Deploy to Vercel (→ rostatbrod2026.vercel.app)

This app currently lives in the `rostatbrod2026/` subfolder of the `johan35`
repo. To host it:

1. **Vercel → Add New Project → Import** the GitHub repo.
2. Set **Root Directory** = `rostatbrod2026`.
3. Add the env vars from `.env.example` (create a **Blob store** in the project
   to auto-inject `BLOB_READ_WRITE_TOKEN`).
4. Deploy, then rename the project / domain to `rostatbrod2026`.

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/album` | List media (Blob images + Mux videos) + storage usage |
| `POST /api/album/upload` | Signed client-upload token for Vercel Blob |
| `POST /api/album/mux-upload` | Mux direct-upload URL for videos |
| `GET/POST /api/album/comments` | Per-photo comments |
| `GET/POST /api/wishes` | Guestbook entries |
| `GET/POST /api/split` | Expense splitter: members + expenses + actions |
