import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transactions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a wealth strategist. Analyze the user's complete financial transaction history. The core philosophy: income is not wealth, ownership is. Being an Earner means trading time for money. Being an Owner means owning assets that generate returns.

Provide:
1. A Wealth Score (0-100) based on: savings rate (30%), asset diversity (25%), debt ratio (20%), positive cash flow consistency (25%)
2. 3-5 specific, brutally honest insights about spending patterns and wealth-building progress
3. A direct answer to: "Am I building a lifestyle or a legacy?"
4. Whether the user is primarily an "Earner" or moving toward being an "Owner"

Be direct, specific, and actionable. No generic advice.`
          },
          {
            role: "user",
            content: `Here are all my transactions: ${JSON.stringify(transactions)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "wealth_analysis",
              description: "Provide wealth analysis results",
              parameters: {
                type: "object",
                properties: {
                  wealthScore: { type: "number", description: "Score from 0-100" },
                  insights: { type: "array", items: { type: "string" }, description: "3-5 specific insights" },
                  lifestyleOrLegacy: { type: "string", description: "Direct answer about lifestyle vs legacy" },
                  earnerOrOwner: { type: "string", enum: ["Earner", "Transitioning", "Owner"], description: "Current status" },
                  summary: { type: "string", description: "One paragraph executive summary" }
                },
                required: ["wealthScore", "insights", "lifestyleOrLegacy", "earnerOrOwner", "summary"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "wealth_analysis" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wealth-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
