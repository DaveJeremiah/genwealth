const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export interface Env {
  ELEVENLABS_API_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  AZURE_VISION_KEY?: string;
  AZURE_VISION_ENDPOINT?: string;
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
      if (url.pathname === "/azure-tts") {
        return withCors(await handleAzureTts(request, env));
      }
      if (url.pathname === "/ocr") {
        return withCors(await handleAzureOcr(request, env));
      }

      const body = (await safeJson(request)) as {
        dateKey?: string;
        topics?: string[];
        region?: string;
      };
      const dateKey = body.dateKey;
      const dayKey = typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : isoDateKey();
      const topics: string[] = Array.isArray(body.topics) && body.topics.length > 0 ? body.topics : ["finance"];
      const region: string = typeof body.region === "string" ? body.region : "global";

      // Cache per unique topic+region combo
      const cacheSlug = `${dayKey}-${topics.sort().join("-")}-${region}`;
      const cacheKey = new Request(`https://wire.local/rss-script?slug=${encodeURIComponent(cacheSlug)}`, { method: "GET" });
      const cached = await (caches as any).default.match(cacheKey);
      if (cached) return withCors(cached);

      const items = await fetchRssItems(topics, region);
      const chosen = pickTopItems(items, 4);
      const script = buildZaraScript(chosen, topics, region);

      const response = json({ script }, 200, { "Cache-Control": "public, max-age=1200" });
      await (caches as any).default.put(cacheKey, response.clone());
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

async function handleAzureTts(request: Request, env: Env): Promise<Response> {
  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION;
  if (!key) return json({ error: "AZURE_SPEECH_KEY is not configured on the Worker." }, 500);
  if (!region) return json({ error: "AZURE_SPEECH_REGION is not configured on the Worker." }, 500);

  const body = (await safeJson(request)) as {
    text?: string;
    voice_name?: string;
    rate?: string;
  };

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "Missing text" }, 400);

  const voiceName = typeof body.voice_name === "string" ? body.voice_name : "en-US-AriaNeural";
  const rate = typeof body.rate === "string" ? body.rate : "0%";

  const ssml = `<speak version='1.0' xml:lang='en-US'>
  <voice name='${voiceName}'>
    <prosody rate='${rate}'>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</prosody>
  </voice>
</speak>`;

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "WealthWire/1.0",
    },
    body: ssml,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    return json({ error: `Azure TTS failed (${resp.status}): ${errText}` }, resp.status);
  }

  const audioBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(audioBuffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const audio_base64 = btoa(binary);

  return json({ audio_base64 });
}

async function handleAzureOcr(request: Request, env: Env): Promise<Response> {
  const key = env.AZURE_VISION_KEY;
  const endpoint = env.AZURE_VISION_ENDPOINT; // e.g. https://your-resource.cognitiveservices.azure.com/

  if (!key) return json({ error: "AZURE_VISION_KEY is not configured on the Worker." }, 500);
  if (!endpoint) return json({ error: "AZURE_VISION_ENDPOINT is not configured on the Worker." }, 500);

  const body = (await safeJson(request)) as { image?: string };
  const imageBase64 = body.image;
  if (!imageBase64) return json({ error: "Missing image data" }, 400);

  try {
    const rawImage = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    
    // 1. Submit to Azure Read API
    // Ensure endpoint doesn't have trailing slash
    const cleanEndpoint = endpoint.replace(/\/$/, "");
    const analyzeUrl = `${cleanEndpoint}/vision/v3.2/read/analyze`;

    const analyzeResponse = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/octet-stream",
      },
      body: rawImage,
    });

    if (!analyzeResponse.ok) {
      const err = await analyzeResponse.text();
      return json({ error: `Azure OCR Submit failed: ${err}` }, analyzeResponse.status);
    }

    const operationUrl = analyzeResponse.headers.get("Operation-Location");
    if (!operationUrl) return json({ error: "Azure did not return operation location" }, 500);

    // 2. Poll for results (Max 10 seconds)
    let status = "running";
    let attempts = 0;
    let resultData: any = null;

    while ((status === "running" || status === "notStarted") && attempts < 20) {
      await new Promise(r => setTimeout(r, 500)); // Poll every 500ms
      const pollResponse = await fetch(operationUrl, {
        headers: { "Ocp-Apim-Subscription-Key": key },
      });
      resultData = await pollResponse.json();
      status = resultData.status;
      attempts++;
    }

    if (status !== "succeeded") {
      return json({ error: `Azure OCR failed with status: ${status}` }, 500);
    }

    // 3. Extract text from results
    const lines = resultData.analyzeResult.readResults.flatMap((page: any) => 
      page.lines.map((line: any) => line.text)
    );
    const joinedText = lines.join(" ");

    return json({ text: joinedText });
  } catch (error: any) {
    return json({ error: `OCR error: ${error.message}` }, 500);
  }
}

async function handleElevenLabsTts(request: Request, env: Env): Promise<Response> {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) return json({ error: "ELEVENLABS_API_KEY is not configured on the Worker." }, 500);

  const body = (await safeJson(request)) as {
    text?: string;
    voice_id?: string;
    model_id?: string;
    voice_settings?: { stability?: number; similarity_boost?: number; style?: number; use_speaker_boost?: boolean };
    output_format?: string;
  };

  const text = typeof body.text === "string" ? body.text : "";
  const voiceId = typeof body.voice_id === "string" ? body.voice_id : "";
  if (!text.trim()) return json({ error: "Missing text" }, 400);
  if (!voiceId.trim()) return json({ error: "Missing voice_id" }, 400);

  const outputFormat = typeof body.output_format === "string" ? body.output_format : "mp3_44100_128";
  const modelId = typeof body.model_id === "string" ? body.model_id : "eleven_multilingual_v2";
  const voiceSettings = body.voice_settings ?? { stability: 0.35, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true };

  const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${encodeURIComponent(outputFormat)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": key },
    body: JSON.stringify({ text, model_id: modelId, voice_settings: voiceSettings }),
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
  try { return await req.json(); } catch { return {}; }
}

// ─── RSS SOURCE MAP ───────────────────────────────────────────────

type FeedDef = { source: string; url: string };

function buildFeedList(topics: string[], region: string): FeedDef[] {
  const feeds: FeedDef[] = [];

  // ── Topic feeds ──
  for (const topic of topics) {
    switch (topic.toLowerCase()) {
      case "finance":
        feeds.push(
          { source: "YahooFinance", url: "https://finance.yahoo.com/news/rssindex" },
          { source: "PersonalFinance", url: "https://news.google.com/rss/search?q=personal+finance+savings+money+tips+side+hustle&hl=en-US&gl=US&ceid=US:en" },
          { source: "Entrepreneurship", url: "https://news.google.com/rss/search?q=entrepreneurship+startups+funding+small+business&hl=en-US&gl=US&ceid=US:en" },
          { source: "CryptoMoney", url: "https://news.google.com/rss/search?q=crypto+bitcoin+ethereum+defi+everyday+money&hl=en-US&gl=US&ceid=US:en" },
          { source: "CostOfLiving", url: "https://news.google.com/rss/search?q=cost+of+living+rent+inflation+wages+jobs&hl=en-US&gl=US&ceid=US:en" },
        );
        break;
      case "tech":
        feeds.push(
          { source: "TechCrunch", url: "https://techcrunch.com/feed/" },
          { source: "TheVerge", url: "https://www.theverge.com/rss/index.xml" },
          { source: "TechGoogle", url: "https://news.google.com/rss/search?q=AI+technology+innovation+apps+gadgets&hl=en-US&gl=US&ceid=US:en" },
        );
        break;
      case "environment":
        feeds.push(
          { source: "BBCEnvironment", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
          { source: "EnvGoogle", url: "https://news.google.com/rss/search?q=climate+change+sustainability+green+energy&hl=en-US&gl=US&ceid=US:en" },
          { source: "CleanEnergy", url: "https://news.google.com/rss/search?q=solar+wind+electric+vehicles+clean+energy+africa&hl=en-US&gl=US&ceid=US:en" },
        );
        break;
      case "business":
        feeds.push(
          { source: "FastCompany", url: "https://www.fastcompany.com/latest/rss" },
          { source: "BusinessGoogle", url: "https://news.google.com/rss/search?q=business+strategy+leadership+management+growth&hl=en-US&gl=US&ceid=US:en" },
          { source: "Startups", url: "https://news.google.com/rss/search?q=startup+venture+capital+founder+product&hl=en-US&gl=US&ceid=US:en" },
        );
        break;
      case "world":
        feeds.push(
          { source: "BBCWorld", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
          { source: "WorldGoogle", url: "https://news.google.com/rss/search?q=world+news+geopolitics+international&hl=en-US&gl=US&ceid=US:en" },
        );
        break;
    }
  }

  // ── Region overlay feeds ──
  switch (region.toLowerCase()) {
    case "africa":
      feeds.push(
        { source: "AfricaBusiness", url: "https://news.google.com/rss/search?q=africa+business+economy+finance+tech&hl=en-US&gl=US&ceid=US:en" },
        { source: "EastAfrica", url: "https://news.google.com/rss/search?q=east+africa+kenya+uganda+tanzania+rwanda+economy&hl=en-US&gl=US&ceid=US:en" },
        { source: "NigeriaGhana", url: "https://news.google.com/rss/search?q=nigeria+ghana+south+africa+economy+startup&hl=en-US&gl=US&ceid=US:en" },
      );
      break;
    case "europe":
      feeds.push(
        { source: "BBCEurope", url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml" },
        { source: "EuropeEconomy", url: "https://news.google.com/rss/search?q=europe+economy+euro+ECB+business&hl=en-US&gl=US&ceid=US:en" },
      );
      break;
    case "americas":
      feeds.push(
        { source: "USEconomy", url: "https://news.google.com/rss/search?q=US+economy+jobs+housing+federal+reserve&hl=en-US&gl=US&ceid=US:en" },
        { source: "LatAm", url: "https://news.google.com/rss/search?q=latin+america+brazil+mexico+economy&hl=en-US&gl=US&ceid=US:en" },
      );
      break;
    case "asia":
      feeds.push(
        { source: "AsiaBusiness", url: "https://news.google.com/rss/search?q=asia+china+india+japan+economy+tech&hl=en-US&gl=US&ceid=US:en" },
        { source: "SEAsia", url: "https://news.google.com/rss/search?q=southeast+asia+singapore+indonesia+malaysia+business&hl=en-US&gl=US&ceid=US:en" },
      );
      break;
    default: // global — sprinkle in a mix
      feeds.push(
        { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
        { source: "GlobalMarkets", url: "https://news.google.com/rss/search?q=global+markets+economy+business&hl=en-US&gl=US&ceid=US:en" },
      );
  }

  return feeds;
}

// ─── RSS PARSING ─────────────────────────────────────────────────

type RssItem = { source: string; title: string; link: string; publishedAt: string | null; description: string };

function isoDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowMinusHours(hours: number) { return Date.now() - hours * 60 * 60 * 1000; }

function stripHtml(input: string) {
  return input.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(input: string) {
  return input.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
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
  const res = await fetch(url, { headers: { "User-Agent": "WealthWireRSS/1.0" }, cf: { cacheTtl: 600, cacheEverything: true } } as RequestInit);
  if (!res.ok) throw new Error(`RSS fetch failed (${res.status}) for ${url}`);
  return await res.text();
}

async function fetchRssItems(topics: string[], region: string): Promise<RssItem[]> {
  const since = nowMinusHours(36);
  const feeds = buildFeedList(topics, region);
  const results = await Promise.allSettled(feeds.map(async (f) => parseRss(await fetchText(f.url), f.source)));
  const all = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  return all.filter((it) => {
    if (!it.publishedAt) return true;
    const t = Date.parse(it.publishedAt);
    if (Number.isNaN(t)) return true;
    return t >= since;
  });
}

function normalizeTitle(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function pickTopItems(items: RssItem[], max: number) {
  const seen = new Set<string>();
  const scored = items.map((it) => {
    const recency = it.publishedAt ? Date.parse(it.publishedAt) : 0;
    const ageScore = recency ? Math.max(0, 1 - (Date.now() - recency) / (36 * 60 * 60 * 1000)) : 0.2;
    const boost = /(bitcoin|crypto|inflation|rent|salary|startup|AI|jobs|africa|climate|viral|scandal|bank|loan|hustle|invest)/i.test(it.title) ? 0.25 : 0;
    return { it, score: ageScore + boost };
  }).sort((a, b) => b.score - a.score);

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

// ─── SCRIPT BUILDER ──────────────────────────────────────────────

function clampWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").replace(/[,.!?;:]+$/, "") + ".";
}

function toAsciiPunctuation(input: string) {
  return input.replace(/[""]/g, '"').replace(/['']/g, "'").replace(/[—–]/g, "-").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function firstSentences(text: string, maxSentences: number) {
  const cleaned = toAsciiPunctuation(stripHtml(text));
  if (!cleaned) return "";
  const matches = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [];
  return matches.slice(0, maxSentences).join(" ").trim();
}

function pickIntro(topics: string[], region: string): string {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const hour = new Date().getUTCHours() + 3; // EAT
  const timestring = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const topicLabel = topics.includes("tech") ? "the tech world" : topics.includes("environment") ? "the state of the planet" : topics.includes("business") ? "the business world" : "your money and the world";
  const regionLabel = region === "africa" ? "across Africa" : region === "europe" ? "in Europe" : region === "americas" ? "in the Americas" : region === "asia" ? "across Asia" : "globally";

  const intros = [
    `Hey. Zara here. It's ${timestring} on ${day} and I've already done the reading so you don't have to. Here's what's happening with ${topicLabel} ${regionLabel}.`,
    `Good ${timestring}. Before you scroll into the chaos, let me give you the version that actually matters. I'm Zara, and here's your briefing.`,
    `Right, so here's the thing about ${day} — it came with receipts. I'm Zara. Let's get into it.`,
    `You caught me in a good mood on this ${timestring}. I've been going through the headlines ${regionLabel} and I have things to say. Let's go.`,
    `Zara here. ${day} energy. Buckle up — there's a lot going on with ${topicLabel} and I'm giving you the version your group chat won't.`,
    `Listen. While everyone else was sleeping, ${topicLabel} ${regionLabel} kept moving. I was watching. Here's your briefing.`,
    `It's your girl Zara. ${day} briefing, fresh off the wire. No corporate speak, no fluff — just what you actually need to know.`,
    `${day} is giving main character energy and so are the headlines. I'm Zara. Here's what's going on ${regionLabel} right now.`,
    `Let me guess — you need coffee and context. I can only help with one of those. I'm Zara, and here's what happened with ${topicLabel}.`,
    `Okay so ${topicLabel} had a moment this week and we need to talk about it. Zara here — your briefing starts now.`,
  ];

  // Pick based on mixing day-of-week + hour to be semi-predictable but varied
  const dayIndex = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(day);
  return intros[(dayIndex + Math.floor(hour / 4)) % intros.length];
}

function whyItMatters(title: string, topics: string[]): string {
  const t = title.toLowerCase();
  if (/(bitcoin|crypto|ether|token|nft|defi)/i.test(t)) return "Because crypto doesn't care what time you go to bed - a 20% swing can happen while you're watching Netflix, and knowing the story behind it keeps you from panic-selling at the worst moment.";
  if (/(rent|housing|mortgage|property)/i.test(t)) return "Because where you live and what you pay for it is probably your biggest monthly expense - and shifts in this market ripple into everything from your savings rate to your stress levels.";
  if (/(jobs|unemployment|layoff|hiring|salary|wage)/i.test(t)) return "Because the job market is basically a weather forecast for the economy - when it shifts, it changes people's confidence, spending, and investment decisions.";
  if (/(ai|artificial intelligence|openai|chatgpt|machine learning)/i.test(t)) return "Because AI isn't just a tech story anymore - it's touching salaries, business models, and the skills that will matter in 5 years. Worth knowing where it's heading.";
  if (/(oil|energy|fuel|electricity|power)/i.test(t)) return "Because energy costs are the quiet multiplier on everything - transport, food, manufacturing. When energy moves, your wallet eventually feels it.";
  if (/(climate|environment|flood|drought|carbon)/i.test(t)) return "Because climate isn't just an environmental story - it's a financial one too. From insurance costs to where businesses invest, it's reshaping where money flows.";
  if (/(africa|kenya|uganda|tanzania|nigeria|ghana|rwanda)/i.test(t)) return "Because African markets are moving faster than the narrative gives them credit for. There's real money, real opportunity, and real risk - and staying informed puts you ahead of people who aren't paying attention.";
  if (/(startup|funding|ipo|venture|series)/i.test(t)) return "Because where smart money goes today often shapes what's mainstream in 3 years - and spotting the pattern early is how people build conviction and, sometimes, wealth.";
  if (/(inflation|interest rate|central bank|fed|ecb)/i.test(t)) return "Because interest rates are basically the price of money - and they quietly affect your mortgage, your savings account, your business costs, and the stock market all at once.";
  return "Because the stories that seem far from you have a habit of showing up at your door eventually - through prices, job markets, or just the mood of the economy around you.";
}

function forYouTip(idx: number, topics: string[]): string {
  const financeTips = [
    "For you: one small move this week - automate one thing. A savings transfer, a bill payment, a subscription cancel. Automation beats willpower every time.",
    "For you: if you have any debt, write down the interest rate next to each one. Knowing your enemy is step one.",
    "For you: check your last three months of spending. Not to judge yourself - just to see. Awareness alone changes behavior.",
    "For you: pick one person in your life who's good with money. Have one real conversation with them this month.",
  ];
  const techTips = [
    "For you: if you haven't tried using AI for any part of your work this week, that's this week's experiment.",
    "For you: check what subscriptions you're paying for that you haven't opened in 3 months. Cancel one.",
    "For you: learn one thing about how the tech you use every day actually makes money. The business model tells you a lot.",
  ];
  const envTips = [
    "For you: one practical switch this week - less single-use plastic, or try buying one thing secondhand instead of new.",
    "For you: look at your energy bill. Not to worry - just to understand. Knowledge is the first step to changing it.",
  ];
  const tips = topics.includes("tech") ? techTips : topics.includes("environment") ? envTips : financeTips;
  return tips[idx % tips.length];
}

function buildOutro(): string {
  const outros = [
    "That's your briefing. Go make moves - the informed ones.",
    "That's the wire for today. You now know more than most people who just doom-scrolled for an hour.",
    "There it is. Now close this, do one thing differently today, and check back tomorrow.",
    "That's a wrap from Zara. Stay curious, stay liquid, and stay two steps ahead.",
    "And that's a cut. Use this information well - or at least annoy someone in your group chat with it.",
  ];
  const hour = new Date().getUTCHours() + 3;
  return outros[Math.floor(hour / 5) % outros.length];
}

function buildZaraScript(stories: RssItem[], topics: string[], region: string) {
  const intro = pickIntro(topics, region);

  const openers = ["First up", "Next", "Third story", "And finally"];
  const wits = [
    "",
    " Also - your group chat will be talking about something completely different. That's fine. You'll be two steps ahead.",
    " This is the kind of story people form very strong opinions about online without actually reading past the headline. Now you have.",
    "",
  ];

  const body = stories.slice(0, 4).map((s, idx) => {
    const cleanTitle = toAsciiPunctuation(s.title.replace(/\s+-\s+.*$/, "").trim());
    const happened = firstSentences(s.description, 2);
    const happenedLine = happened ? `What happened: ${clampWords(happened, 45)}` : "What happened: it moved, people reacted, and the internet had thoughts.";
    const whyLine = `Why it matters to you: ${whyItMatters(cleanTitle, topics)}`;
    const youLine = forYouTip(idx, topics) + (wits[idx] || "");
    return `${openers[idx]}: ${cleanTitle}. ${happenedLine} ${whyLine} ${youLine}`;
  }).join(" ");

  const outro = buildOutro();
  const full = toAsciiPunctuation(`${intro} ${body} ${outro}`);
  return clampWords(full, 500);
}
