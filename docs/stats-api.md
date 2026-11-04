# Weekly "people connected" count

The About page on homeservices.guru shows how many people Home Services Guru connected with a local pro this year, for example "4,300+ People connected with a local pro in 2026". The call system sends the number once a week, and the page updates at once without a redeploy.

## What to send

Every Sunday night, send:

```
POST https://homeservices.guru/api/stats/connected
Authorization: Bearer <STATS_TOKEN>
Content-Type: application/json

{"count": 4317, "year": 2026}
```

- `count`: unique callers put through to a provider so far in `year`, counting each phone number once. Send the exact number. The site rounds it down for display.
- `year`: the calendar year the count covers. A run that lands just after New Year's may still send last year's total. Once a new year's count is sent, the page switches to the new year.
- `STATS_TOKEN`: a shared secret. Keep it in the call system's config, not in code.

Until the site is live on homeservices.guru, use the preview address: `https://homeguru.solitary-wind-193d.workers.dev/api/stats/connected`.

Example:

```bash
curl -X POST https://homeservices.guru/api/stats/connected \
  -H "Authorization: Bearer $STATS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 4317, "year": 2026}'
```

## Responses

| Status | Meaning |
|---|---|
| `200` | Saved. Body: `{"ok": true, "stored": {...}, "shown": "4,300+"}`. `shown` is `null` under 100, and the page then keeps its "Since 2026" line. |
| `400` | Bad body: not JSON, `count` not a whole number, or `year` not this year (or last year). |
| `401` | Missing or wrong token. |
| `405` | Not a POST. |
| `409` | `count` is lower than the last one for the same year, or `year` is older than the one already shown. Usually a broken report. Nothing was saved. |
| `422` | `count` jumped more than 10× in one week. Nothing was saved. Check the report, then send again. |
| `503` | The site's storage or token isn't set up yet. |

Treat anything other than `200` as a failure worth alerting on. Error bodies include `stored`, the value currently shown.

## How the number is shown

| Count sent | Page shows |
|---|---|
| under 100 | "Since 2026 / Connecting people with local pros" (no number) |
| 100 to 9,999 | rounded down to the hundred: 4,317 becomes "4,300+" |
| 10,000 and up | rounded down to the thousand: 12,480 becomes "12,000+" |

## Setup (once)

1. Pick a long random token, for example from a password generator, and save it in the call system's config.
2. Give it to the site: `npx wrangler secret put STATS_TOKEN --name homeguru`, then paste the token when asked.
3. Send one count to check the setup. The response's `shown` field is what the About page will display.

The count is stored in the Cloudflare KV namespace `homeguru-stats` (binding `STATS`, key `connected`). Code: `worker/stats.ts`.
