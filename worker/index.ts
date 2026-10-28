// Cloudflare Worker entry: POST /api/contact emails the contact form, and
// POST /api/chat answers visitor questions with Claude
// Haiku and points them to the right service's call button. Every other request
// is served from the static Astro build (dist/) via the ASSETS binding.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import services from "../src/data/services.json";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ANTHROPIC_API_KEY?: string;
  CHAT_LIMITER?: RateLimiter;
  CONTACT_LIMITER?: RateLimiter;
  EMAIL?: {
    send(message: {
      to: string;
      from: { email: string; name: string };
      replyTo?: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<{ messageId: string }>;
  };
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

const MODEL = "claude-haiku-5-5";
const MAX_TURNS = 10; // messages of history we accept from the browser
const MAX_CHARS = 500; // per message

const SLUGS = services.map((s) => s.slug) as [string, ...string[]];

const ChatReply = z.object({
  reply: z.string().describe("What to say to the visitor: 1-3 short sentences, plain text."),
  service: z
    .enum([...SLUGS, "none"])
    .describe("The service whose call button to show under the reply, or none."),
});

const catalog = services
  .map((s) => `- ${s.slug}: ${s.name}${s.phone ? "" : " (no phone line yet; offers a callback request)"}`)
  .join("\n");

const SYSTEM = `You are the Home Services Guru virtual assistant on homeservices.guru. Home Services Guru is a free referral service: a homeowner calls, and we connect them with an independent local service provider.

Your job: answer simple home-repair questions briefly, then guide the visitor to call about the right service. Keep every reply to 1-3 short sentences in plain, friendly language. End most replies by suggesting they tap the call button for that service.

Services (use these exact slugs for "service"):
${catalog}

Pick the single best service for the visitor's problem. Use "none" only when the question has nothing to do with home services, or you need one quick clarifying question first.

Rules you must always follow:
- Never say or imply that providers are vetted, screened, pre-screened, licensed, insured, bonded, certified, background-checked or guaranteed. Providers are independent local businesses. If asked about licensing or insurance, say to ask the pro directly before work begins.
- Never promise 24/7 or round-the-clock availability, response times, or same-day service.
- Never quote prices, estimates or costs. Say the pro can give a quote.
- Don't give step-by-step instructions for risky work (electrical, gas, roofs, structural, mold removal, tree felling). Basic safety tips are fine, like turning off the water main.
- If they mention a gas smell, fire, smoke, sparks or a medical emergency: tell them to leave the area and call 911 (or their gas utility for a gas smell) first. Set service to "none" for fires and medical emergencies.
- You can't book appointments, take payment or collect contact details. Don't ask for a phone number or address.
- Only discuss home services. Politely decline anything else.
- If you're asked who you are, say you're the Home Services Guru virtual assistant, an automated helper.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const FALLBACK = "Sorry, I can't answer that right now. Pick your service below to talk to a local pro.";

async function handleChat(request: Request, env: Env): Promise<Response> {
  if (env.CHAT_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.CHAT_LIMITER.limit({ key: ip });
    if (!success) return json({ reply: "You're sending messages quickly. Please wait a minute and try again.", service: "none" }, 429);
  }
  if (!env.ANTHROPIC_API_KEY) {
    console.error("chat: ANTHROPIC_API_KEY is not set");
    return json({ reply: FALLBACK, service: "none", unavailable: true }, 503);
  }

  let history: Anthropic.MessageParam[];
  try {
    const body = (await request.json()) as { messages?: { role?: string; content?: string }[] };
    history = (body.messages ?? [])
      .slice(-MAX_TURNS)
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content!.slice(0, MAX_CHARS) }));
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  // The API needs the conversation to start with the user and end with a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length || history[history.length - 1].role !== "user") return json({ error: "No question." }, 400);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 20_000 });
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: history,
      output_config: { effort: "low", format: zodOutputFormat(ChatReply) },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return json({ reply: FALLBACK, service: "none" });
    }
    return json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.error("chat: Anthropic rate limit", error.message);
    } else if (error instanceof Anthropic.APIError) {
      console.error(`chat: Anthropic API error ${error.status}`, error.message);
    } else {
      console.error("chat: unexpected error", error);
    }
    return json({ reply: FALLBACK, service: "none", unavailable: true }, 502);
  }
}

// POST /api/contact: emails the Contact page form through Cloudflare Email Sending.
// [form field, label, max length, required]
const CONTACT_FIELDS: [string, string, number, boolean][] = [
  ["name", "Name", 200, true],
  ["email", "Email", 254, true],
  ["phone", "Phone", 50, true],
  ["service", "Service", 100, false],
  ["date", "Preferred date", 20, false],
  ["time", "Preferred time", 20, false],
  ["message", "Message", 5000, false],
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function handleContact(request: Request, env: Env): Promise<Response> {
  // The page posts with fetch and wants JSON; without JavaScript the browser gets redirected back.
  const wantsJson = (request.headers.get("Accept") ?? "").includes("application/json");
  const reply = (status: number, body: Record<string, unknown>) =>
    wantsJson
      ? json(body, status)
      : Response.redirect(new URL(`/contact-us/?sent=${status === 200 ? 1 : 0}`, request.url).href, 303);

  if (env.CONTACT_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.CONTACT_LIMITER.limit({ key: ip });
    if (!success) return reply(429, { ok: false, error: "Too many messages. Please wait a minute and try again." });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, { ok: false, error: "Invalid form submission." });
  }
  // Honeypot: real visitors never see or fill this field.
  if (form.get("website")) return reply(200, { ok: true });

  const values: Record<string, string> = {};
  const invalid: string[] = [];
  for (const [name, , max, required] of CONTACT_FIELDS) {
    values[name] = String(form.get(name) ?? "").trim().slice(0, max);
    if (required && !values[name]) invalid.push(name);
  }
  if (values.email && !EMAIL_RE.test(values.email)) invalid.push("email");
  if (invalid.length) {
    return reply(422, { ok: false, invalid, error: "Please check the highlighted fields and try again." });
  }

  if (!env.EMAIL || !env.CONTACT_TO || !env.CONTACT_FROM) {
    console.error("contact: email binding or CONTACT_TO/CONTACT_FROM is not configured");
    return reply(500, { ok: false, error: "Sorry, the contact form isn't working right now. Please try again later." });
  }

  const rows = CONTACT_FIELDS.filter(([name]) => values[name] && name !== "message").map(([name, label]) => [
    label,
    values[name],
  ]);
  const message = values.message;
  const subject = `Website contact: ${values.service || values.name}`.replace(/[\r\n]+/g, " ");
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + (message ? `\n\nMessage:\n${message}\n` : "\n");
  const html =
    `<table cellpadding="4">${rows
      .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`)
      .join("")}</table>` +
    (message ? `<p><strong>Message</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : "");

  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO,
      from: { email: env.CONTACT_FROM, name: "Home Services Guru Website" },
      replyTo: values.email,
      subject,
      text,
      html,
    });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    console.error(`contact: send failed ${e.code ?? ""}`, e.message ?? error);
    return reply(502, { ok: false, error: "Sorry, your message couldn't be sent. Please try again later." });
  }
  return reply(200, { ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const api: Record<string, (request: Request, env: Env) => Promise<Response>> = {
      "/api/chat": handleChat,
      "/api/contact": handleContact,
    };
    const handler = api[url.pathname];
    if (handler) {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      return handler(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
