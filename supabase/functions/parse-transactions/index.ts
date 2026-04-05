// Follow this setup for a modern Supabase Edge Function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { input: rawInput, image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    // Check if the key is missing or is accidentally the Supabase key
    if (!LOVABLE_API_KEY || LOVABLE_API_KEY.startsWith("sb_")) {
      return new Response(JSON.stringify({ 
        error: "INVALID_KEY: Your LOVABLE_API_KEY looks like a Supabase Publishable Key. You need a real AI API key for this to work." 
      }), {
        status: 200, // Returning 200 so the UI can show this specific error
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let input = rawInput;

    if (image) {
      console.log("Image received, size:", image.length);
      const visionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Extract ALL financial details from this receipt/document. Today is ${new Date().toISOString().split("T")[0]}.
Return a detailed description including:
- Each item/service with its price
- Total amount paid
- Currency (default UGX if not shown)
- Date (use today if not visible)
- Vendor/store name if visible
- Payment method if visible

Format as a natural sentence like: "Paid 45,000 UGX at Café Javas on 2026-04-05 for coffee (12,000), sandwich (18,000), juice (15,000) via Mobile Money"
If this is not a receipt or financial document, say 'Invalid scan: not a financial document'.` },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${image}` }
                }
              ]
            }
          ]
        })
      });

      if (!visionResponse.ok) {
        const errText = await visionResponse.text();
        return new Response(JSON.stringify({ error: `Vision Error (${visionResponse.status}): ${errText.substring(0, 50)}...` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const visionData = await visionResponse.json();
      input = visionData.choices?.[0]?.message?.content || "Unclear scan";
      
      if (!rawInput) {
        return new Response(JSON.stringify({ text: input }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Standard Parser Logic
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Extract financial transactions from user input. Today is ${new Date().toISOString().split("T")[0]}.
Rules:
- date MUST be YYYY-MM-DD format. Use today's date if not specified.
- type MUST be one of: income, expense, asset, liability, transfer-in, transfer-out
- category MUST be one of: Housing, Food & Dining, Transport, Entertainment, Health, Shopping, Utilities, Investments, Crypto, Property, Salary, Freelance, Business, Savings, Transfer, Other
- currency: use exactly what user says (UGX, USD, EUR, GBP, KES, BTC, ETH, SOL). Default UGX.
- ugx_amount: if currency is UGX, same as amount. Otherwise estimate UGX equivalent.
- account: Cash, Bank, Mobile Money, or as specified.
- insight: one-sentence summary.` },
          { role: "user", content: input }
        ],
        tools: [{
          type: "function",
          function: {
            name: "parse",
            parameters: {
              type: "object",
              properties: {
                transactions: { type: "array", items: { type: "object", properties: { id: {type:"string"}, date: {type:"string"}, description: {type:"string"}, amount: {type:"number"}, currency: {type:"string"}, ugx_amount: {type:"number"}, type: {type:"string"}, category: {type:"string"}, account: {type:"string"} }, required: ["id", "date", "description", "amount", "currency", "ugx_amount", "type", "category", "account"] } },
                insight: { type: "string" }
              },
              required: ["transactions", "insight"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "parse" } }
      })
    });

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0].function.arguments);

    const today = new Date().toISOString().split("T")[0];
    const validTypes = ["income", "expense", "asset", "liability", "transfer-in", "transfer-out"];
    const categoryMap: Record<string, string> = {
      "food": "Food & Dining", "dining": "Food & Dining", "food & dining": "Food & Dining",
      "transport": "Transport", "transportation": "Transport",
      "housing": "Housing", "health": "Health", "shopping": "Shopping",
      "utilities": "Utilities", "investments": "Investments", "crypto": "Crypto",
      "property": "Property", "salary": "Salary", "freelance": "Freelance",
      "business": "Business", "savings": "Savings", "transfer": "Transfer",
      "entertainment": "Entertainment", "other": "Other",
    };

    const normalized = parsed.transactions.map((t: any) => {
      // Fix date
      let date = t.date;
      if (!date || date === "today" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        date = today;
      }
      // Fix type
      const type = validTypes.includes(t.type?.toLowerCase()) ? t.type.toLowerCase() : "expense";
      // Fix category
      const cat = categoryMap[t.category?.toLowerCase()] || t.category || "Other";
      // Fix account
      const account = t.account ? t.account.charAt(0).toUpperCase() + t.account.slice(1) : "Cash";
      
      return {
        ...t,
        date,
        type,
        category: cat,
        account,
        ugx_amount: t.ugx_amount || (t.currency === "UGX" ? t.amount : t.amount),
      };
    });

    return new Response(JSON.stringify({ transactions: normalized, insight: parsed.insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Critical Function Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal Server Error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
