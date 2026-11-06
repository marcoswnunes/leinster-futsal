# Leinster Futsal — Training Hub

A static video library (YouTube + Instagram) for the team. No build step.

## Adding a video
Add an entry to `videos.json` → `videos`:

```json
{
  "id": "001",
  "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
  "title": "Short descriptive title",
  "tags": ["Defending"],
  "note": "What players should watch for.",
  "added": "2026-11-06",
  "featured": false
}
```

- `id`: unique, never reused. It's used in share links (`/#v-001`) and in watched tracking.
- Supported URLs: YouTube `watch`, `youtu.be`, `shorts`, `embed` (a `t=` start time is honoured); Instagram `/p/`, `/reel/`, `/tv/`.
- `featured: true` pins the video to **Must-watch**.
- Videos are shown newest date first. Videos added on the same date keep their order from the file. A **NEW** badge appears for 7 days after `added`.
- New tags appear as filter chips automatically. Put them in `tags` to control the order.

## Run locally
`node serve.js`, then open http://localhost:8080.
Opening `index.html` directly won't work, because the browser blocks `fetch` on `file://`.

## Branding
Taken from the club's Instagram graphics: Leinster red `#e3141b`, black, white and silver lettering, Barlow Condensed
heavy italic headings, red brush slashes, and red/black kit stripes. Brand colours and fonts are the CSS variables at the
top of `styles.css`.
- `assets/logo.png`: crest cut out of an Instagram graphic (low-res). Replace it with the original logo file if you have one.
- `assets/og-image.png`: 1200×630 WhatsApp/social preview.

## Deploy
GitHub repo → Netlify (publish directory `.`). `netlify.toml` sets `noindex` headers.
