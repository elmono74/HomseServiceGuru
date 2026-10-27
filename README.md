# homeservices.guru, modern prototype (Astro)

A local-only prototype of a redesigned homeservices.guru: a call-first homepage, plus one service page template that generates all 16 service pages from data.

Source: https://github.com/elmono74/HomseServiceGuru

```bash
npm install
```

```bash
npm run dev
```

## Making changes

1. Edit the files (see below), then check them with `npm run dev`.
2. Commit and push to `main`. If Cloudflare Pages is connected to this repo, each push to `main` deploys the site automatically, and pushes to other branches get their own preview URLs.

## Cloudflare Pages build settings

When connecting this repo in Cloudflare (**Workers & Pages → Create → Pages → Connect to Git**):

- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: read from `.node-version` (Astro 7 needs Node 22.12 or newer)

## Where things live

- `src/pages/index.astro`: the homepage
- `src/pages/services/[slug].astro`: the service page template, which renders `/services/<slug>/` for every service
- `src/data/services.json`: service content, extracted from the old WordPress pages by `../homeservices-build/extract_services.py`. **Phone numbers live here.** Set `phone`/`phoneDisplay` on a service and every call button, the header, the sticky mobile bar and the homepage picker update.
- `src/data/services.ts`: card blurbs and image wiring
- `src/data/guides.ts`: three sample guides; the full build would move all posts into a Markdown content collection
- `src/components/`: header, sticky mobile call bar, footer, service picker, cards, FAQ and "How it works"
- `src/styles/global.css`: brand tokens (orange `#ff6b00`, navy, cream), type and buttons

## Not in the prototype

- Guides, About, Contact, Privacy and Terms pages. Their links point at the old URLs.
- Redirects from old URLs, such as `/plumbing-services/` to `/services/plumbing/`
- A content pass on services whose extracted lists came out mixed, such as HVAC and Water Damage
- Tracking numbers for the 9 services that don't have one (they show "Request a callback")
