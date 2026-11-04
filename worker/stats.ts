// Weekly "people connected" count for the About page.
//
// The call system POSTs {"count": 4317, "year": 2026} to /api/stats/connected every
// Sunday night with `Authorization: Bearer <STATS_TOKEN>`. count is the number of unique
// callers (each phone number once) put through to a provider so far that year. We keep the
// latest value in KV and insert a rounded-down figure into the About page as it's served.
// Until a count arrives, the page keeps its built-in "Since 2026" line.

interface KV {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

// HTMLRewriter is a Workers runtime global.
declare const HTMLRewriter: {
  new (): {
    on(selector: string, handlers: { element(el: { setInnerContent(text: string): void }): void }): any;
    transform(response: Response): Response;
  };
};

export interface StatsEnv {
  STATS?: KV;
  STATS_TOKEN?: string;
}

interface Connected {
  count: number;
  year: number;
  updatedAt: string;
}

const KEY = "connected";
const FIRST_YEAR = 2026;
const MAX_COUNT = 10_000_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** 4,317 -> "4,300+", 23,480 -> "23,000+". Under 100 shows nothing (keeps the "Since" line). */
export function displayCount(count: number): string | null {
  if (count < 100) return null;
  const step = count < 10_000 ? 100 : 1_000;
  return `${(Math.floor(count / step) * step).toLocaleString("en-US")}+`;
}

async function sameSecret(given: string, expected: string): Promise<boolean> {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return (crypto.subtle as unknown as { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }).timingSafeEqual(a, b);
}

async function readConnected(env: StatsEnv): Promise<Connected | null> {
  try {
    return ((await env.STATS?.get(KEY, "json")) as Connected | null) ?? null;
  } catch {
    return null;
  }
}

/** POST /api/stats/connected from the call system. */
export async function handleConnected(request: Request, env: StatsEnv): Promise<Response> {
  if (!env.STATS || !env.STATS_TOKEN) return json({ error: "Stats are not set up yet." }, 503);
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !(await sameSecret(auth.slice(7), env.STATS_TOKEN))) {
    return json({ error: "Unauthorized." }, 401);
  }

  let body: { count?: unknown; year?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Send JSON like {"count": 4317, "year": 2026}.' }, 400);
  }
  const { count, year } = body;
  const thisYear = new Date().getUTCFullYear();
  if (!Number.isInteger(count) || (count as number) < 0 || (count as number) > MAX_COUNT) {
    return json({ error: "count must be a whole number of unique callers connected." }, 400);
  }
  // Sunday-night runs can land just after New Year's (UTC), so last year is accepted too.
  const minYear = Math.max(FIRST_YEAR, thisYear - 1);
  if (!Number.isInteger(year) || (year as number) < minYear || (year as number) > thisYear) {
    return json({ error: minYear === thisYear ? `year must be ${thisYear}.` : `year must be ${minYear} or ${thisYear}.` }, 400);
  }

  // A count that goes down, or jumps more than 10x in a week, is almost always a broken report.
  const prev = await readConnected(env);
  if (prev && (year as number) < prev.year) {
    return json({ error: `Already showing ${prev.year}; refusing an older year.`, stored: prev }, 409);
  }
  if (prev && prev.year === year) {
    if ((count as number) < prev.count) {
      return json({ error: `count is lower than the last one for ${year} (${prev.count}).`, stored: prev }, 409);
    }
    if (prev.count >= 100 && (count as number) > prev.count * 10) {
      return json({ error: `count jumped more than 10x from ${prev.count}; check the report.`, stored: prev }, 422);
    }
  }

  const stored: Connected = { count: count as number, year: year as number, updatedAt: new Date().toISOString() };
  await env.STATS.put(KEY, JSON.stringify(stored));
  return json({ ok: true, stored, shown: displayCount(stored.count) });
}

/** Insert the latest count into the About page's stat (data-stat="connected"). */
export async function aboutWithCount(response: Response, env: StatsEnv): Promise<Response> {
  if (!response.ok || !(response.headers.get("Content-Type") ?? "").includes("text/html")) return response;
  const stat = await readConnected(env);
  const shown = stat && displayCount(stat.count);
  if (!stat || !shown) return response;
  return new HTMLRewriter()
    .on('[data-stat="connected"] dt', { element: (el) => el.setInnerContent(shown) })
    .on('[data-stat="connected"] dd', {
      element: (el) => el.setInnerContent(`People connected with a local pro in ${stat.year}`),
    })
    .transform(response);
}
