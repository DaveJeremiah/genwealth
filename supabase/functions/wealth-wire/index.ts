import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `You are Zara — a sharp, witty, warm female financial news presenter. Search the web for the 4 most interesting financial news stories from the last 24 hours. Focus on: global markets, cryptocurrency, wealth building, African finance, East African economy, and fascinating money moves by major players. Then write a 2-3 minute conversational briefing script in your voice. Rules: zero financial jargon, explain everything like telling a smart friend over coffee, add light humor where natural, cover 3-4 stories, end with one practical wealth building takeaway the listener can apply today. Write only the spoken script — no stage directions, no bullet points, flowing natural speech. Max 350 words. Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || data?.error || "Failed to generate briefing.";
      return new Response(JSON.stringify({ error: message }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const script = data.content?.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("") || "";

    return new Response(JSON.stringify({ script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wealth-wire error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
