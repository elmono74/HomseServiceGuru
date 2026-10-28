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
2. Commit and push to `main`. Cloudflare rebuilds and deploys the site automatically.

## Cloudflare deployment

The repo is connected to the Cloudflare Worker `homeguru` (Workers Builds). Each push to `main` runs `npm run build`, then `npx wrangler deploy`, which reads `wrangler.jsonc` and uploads `dist/` as static assets.

- Preview URL: https://homeguru.solitary-wind-193d.workers.dev
- `worker/index.ts`: the Worker. It answers `POST /api/chat` with Claude Haiku (structured output: a reply plus the service whose call button to show) and serves everything else from `dist/`. Its system prompt holds the copy rules: no vetted/licensed/insured claims, no 24/7, no prices.
- Chat needs one secret, set once: `npx wrangler secret put ANTHROPIC_API_KEY --name homeguru`. Without it, typed questions fall back to the service list; the guided buttons always work.
- Contact form: `/contact-us/` posts to `POST /api/contact` in the same Worker, which emails it through the `EMAIL` (send_email) binding from no-reply@homeservices.guru to `CONTACT_TO` in `wrangler.jsonc`. No secret needed. `CONTACT_TO` is info@joinpaypercall.com until the info@homeservices.guru forward is verified.
- `public/_redirects`: old WordPress addresses that have no page here.
- `src/components/ChatWidget.astro`: the chat bubble. The guided-button flow (`FLOW`) is at the top of its script.
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
