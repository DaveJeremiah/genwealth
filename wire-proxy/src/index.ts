const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export interface Env {
  ELEVENLABS_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    try {
      const url = new URL(request.url);
      if (url.pathname === "/tts") {
        return withCors(await handleElevenLabsTts(request, env));
      }

      const { dateKey } = (await safeJson(request)) as { dateKey?: string };
      const dayKey = typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : isoDateKey();

      const cacheKey = new Request(`https://wire.local/rss-script?date=${encodeURIComponent(dayKey)}`, { method: "GET" });
      const cached = await caches.default.match(cacheKey);
      if (cached) return withCors(cached);

      const items = await fetchRssItems();
      const chosen = pickTopItems(items, 4);
      const script = buildZaraScript(chosen);

      const response = json({ script }, 200, { "Cache-Control": "public, max-age=1200" }); // 20 min
      await caches.default.put(cacheKey, response.clone());
      return withCors(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected proxy error.";
      return json({ error: message }, 500);
    }
  },
};

function withCors(res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

function json(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

async function handleElevenLabsTts(request: Request, env: Env): Promise<Response> {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) return json({ error: "ELEVENLABS_API_KEY is not configured on the Worker." }, 500);

  const body = (await safeJson(request)) as {
    text?: string;
    voice_id?: string;
    model_id?: string;
    voice_settings?: { stability?: number; similarity_boost?: number; style?: number; use_speaker_boost?: boolean; speed?: number };
    output_format?: string;
  };

  const text = typeof body.text === "string" ? body.text : "";
  const voiceId = typeof body.voice_id === "string" ? body.voice_id : "";
  if (!text.trim()) return json({ error: "Missing text" }, 400);
  if (!voiceId.trim()) return json({ error: "Missing voice_id" }, 400);

  const outputFormat = typeof body.output_format === "string" ? body.output_format : "mp3_44100_128";
  const modelId = typeof body.model_id === "string" ? body.model_id : "eleven_multilingual_v2";
  const voiceSettings = body.voice_settings ?? {
    stability: 0.35,
    similarity_boost: 0.8,
    style: 0.35,
    use_speaker_boost: true,
  };

  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${encodeURIComponent(outputFormat)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": key,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const err = data as { detail?: unknown; error?: unknown; message?: unknown } | null;
    const message = err?.detail || err?.error || err?.message || "ElevenLabs request failed.";
    return json({ error: message }, resp.status);
  }

  return json(data as Record<string, unknown>);
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

type RssItem = {
  source: string;
  title: string;
  link: string;
  publishedAt: string | null;
  description: string;
};

function isoDateKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nowMinusHours(hours: number) {
  return Date.now() - hours * 60 * 60 * 1000;
}

function stripHtml(input: string) {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function tag(text: string, name: string) {
  const m = text.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? decodeXml(m[1]) : "";
}

function parseRss(xml: string, source: string): RssItem[] {
  const items: RssItem[] = [];
  const chunks = xml.split(/<item>/i).slice(1);
  for (const chunk of chunks) {
    const title = stripHtml(tag(chunk, "title"));
    const link = stripHtml(tag(chunk, "link"));
    const pubDate = stripHtml(tag(chunk, "pubDate")) || stripHtml(tag(chunk, "published")) || null;
    const description = stripHtml(tag(chunk, "description") || tag(chunk, "summary") || "");
    if (!title || !link) continue;
    items.push({ source, title, link, publishedAt: pubDate, description });
  }
  return items;
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "WealthWireRSS/1.0" },
    cf: { cacheTtl: 600, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`RSS fetch failed (${res.status}) for ${url}`);
  return await res.text();
}

async function fetchRssItems(): Promise<RssItem[]> {
  const since = nowMinusHours(30); // cushion for timezone / feed delays

  const feeds: Array<{ source: string; url: string }> = [
    { source: "YahooFinance", url: "https://finance.yahoo.com/news/rssindex" },
    { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
    { source: "GoogleNews_GlobalMarkets", url: "https://news.google.com/rss/search?q=global+markets+stocks+futures&hl=en-US&gl=US&ceid=US:en" },
    { source: "GoogleNews_EastAfrica", url: "https://news.google.com/rss/search?q=East+Africa+economy+finance&hl=en-US&gl=US&ceid=US:en" },
    { source: "GoogleNews_AfricaFinance", url: "https://news.google.com/rss/search?q=Africa+finance+banking+markets&hl=en-US&gl=US&ceid=US:en" },
    { source: "GoogleNews_Crypto", url: "https://news.google.com/rss/search?q=bitcoin+crypto+markets&hl=en-US&gl=US&ceid=US:en" },
  ];

  const results = await Promise.allSettled(feeds.map(async (f) => parseRss(await fetchText(f.url), f.source)));
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // Filter by recency if available; otherwise keep and let picker decide.
  return all.filter((it) => {
    if (!it.publishedAt) return true;
    const t = Date.parse(it.publishedAt);
    if (Number.isNaN(t)) return true;
    return t >= since;
  });
}

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pickTopItems(items: RssItem[], max: number) {
  const seen = new Set<string>();
  const scored = items
    .map((it) => {
      const recency = it.publishedAt ? Date.parse(it.publishedAt) : 0;
      const ageScore = recency ? Math.max(0, 1 - (Date.now() - recency) / (30 * 60 * 60 * 1000)) : 0.2;
      const keywordBoost = /(bitcoin|crypto|inflation|rate|fed|oil|gold|uganda|kenya|tanzania|rwanda|nigeria|africa|bank|markets|stocks)/i.test(it.title)
        ? 0.2
        : 0;
      return { it, score: ageScore + keywordBoost };
    })
    .sort((a, b) => b.score - a.score);

  const picked: RssItem[] = [];
  for (const { it } of scored) {
    const key = normalizeTitle(it.title);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(it);
    if (picked.length >= max) break;
  }

  return picked.slice(0, max);
}

function clampWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").replace(/[,.!?;:]+$/, "") + ".";
}

function toAsciiPunctuation(input: string) {
  return input
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentences(text: string, maxSentences: number) {
  const cleaned = toAsciiPunctuation(stripHtml(text));
  if (!cleaned) return "";
  const matches = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [];
  return matches.slice(0, maxSentences).join(" ").trim();
}

function whyItMatters(title: string) {
  const t = title.toLowerCase();
  if (/(bitcoin|crypto|ether|etf)/i.test(t)) {
    return "Because crypto moves fast, and headlines can swing prices before lunch - which is exactly why you keep your position size sane.";
  }
  if (/(oil|gold|commodit)/i.test(t)) {
    return "Because when oil or gold jumps, it quietly changes prices everywhere - transport, food, even the mood of stock markets.";
  }
  if (/(rates|fed|inflation|central bank)/i.test(t)) {
    return "Because rate talk is basically the price of borrowing money - and it affects loans, mortgages, and what investors are willing to pay for companies.";
  }
  if (/(africa|kenya|uganda|tanzania|rwanda|nigeria)/i.test(t)) {
    return "Because shifts in African markets hit real life quickly - currency pressure, fuel, food, and opportunity for people building locally.";
  }
  return "Because big money follows the story - and when it moves, it nudges prices and opportunities for everyone else.";
}

function forYouTip(idx: number) {
  const tips = [
    "For you: if you invest, check your automatic contributions - small but consistent beats heroic once-a-month motivation.",
    "For you: if you're holding any crypto, write down your 'sell rule' now, not when your heart rate is doing cardio.",
    "For you: pick one bill to renegotiate this week. Wealth-building is also boring admin. Unfortunately.",
    "For you: keep an 'opportunity note' - one company, one sector, one country you're curious about - and learn one thing a day.",
  ];
  return tips[idx % tips.length];
}

function buildZaraScript(stories: RssItem[]) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const intro =
    `Good morning, love. It's Zara, and this is The Wealth Wire for ${today}. ` +
    `I pulled the freshest money stories from the last day and I'm translating them into human language - like we're catching up over coffee.`;

  const body = stories.slice(0, 4).map((s, idx) => {
    const cleanTitle = toAsciiPunctuation(s.title.replace(/\s+-\s+.*$/, "").trim());
    const happened = firstSentences(s.description, 2);
    const opener = idx === 0 ? "First up" : idx === 1 ? "Next" : idx === 2 ? "Third" : "And finally";
    const wit = idx === 1
      ? " Also, if your portfolio had feelings, it would be asking for a therapist and a snack."
      : idx === 2
        ? " This is one of those stories where people suddenly become finance professors on the internet."
        : "";

    const happenedLine = happened
      ? `What happened: ${clampWords(happened, 40)}`
      : "What happened: headlines moved, markets reacted, and everyone's group chat had an opinion.";

    const whyLine = `Why it matters: ${whyItMatters(cleanTitle)}`;
    const youLine = `${forYouTip(idx)}${wit}`;
    return `${opener}: ${cleanTitle}. ${happenedLine} ${whyLine} ${youLine}`;
  }).join(" ");

  const takeaway =
    `One practical takeaway you can do today: pick one number and make it automatic - savings, investing, debt payoff. ` +
    `Even a small amount. Automatic beats perfect.`;

  const full = toAsciiPunctuation(`${intro} ${body} ${takeaway}`);
  return clampWords(full, 450);
}
