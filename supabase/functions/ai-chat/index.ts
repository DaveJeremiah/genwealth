import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a personal financial advisor and accounting tutor embedded inside a wealth-building app called Jenwealthy. You have full access to the user's financial data which is injected into every conversation. You answer two types of questions: (1) specific questions about the user's own transactions, categories, statements, and financial health — always reference their actual numbers; (2) general accounting and wealth-building questions explained in plain, everyday language without jargon. You are direct, honest, and always tie answers back to the user's goal of building generational wealth and transitioning from Earner to Owner. Never be generic. Never pad responses. Format responses with markdown for readability.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, financialContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context block from user's financial data
    let contextBlock = "";
    if (financialContext) {
      const fc = financialContext;
      contextBlock = `\n\n--- USER'S FINANCIAL DATA (live snapshot) ---
Current Screen: ${fc.currentScreen || "Dashboard"}
Net Worth: UGX ${fc.netWorth?.toLocaleString() ?? "N/A"}
Total Income: UGX ${fc.totalIncome?.toLocaleString() ?? "0"}
Total Expenses: UGX ${fc.totalExpenses?.toLocaleString() ?? "0"}
Savings Rate: ${fc.savingsRate ?? "N/A"}%
Number of Transactions: ${fc.transactionCount ?? 0}

Recent Transactions (up to 50):
${fc.transactions?.map((t: any) => `- ${t.date} | ${t.description} | ${t.amount} ${t.currency} (UGX ${t.ugx_amount}) | ${t.type} | ${t.category} | ${t.account}`).join("\n") || "No transactions yet."}
--- END FINANCIAL DATA ---`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextBlock },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
