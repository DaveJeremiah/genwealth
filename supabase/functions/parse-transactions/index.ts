const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { input: rawInput, image } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const messages: any[] = [
      {
        role: "system",
        content: `Extract financial transactions from user input. Today is ${new Date().toISOString().split("T")[0]}.

RULES:

DATE: Must be YYYY-MM-DD. Use today if not specified.

TYPE: Must be one of: income, expense, asset, liability, transfer-in, transfer-out

TRANSFERS — when money moves between accounts the user owns:
Triggered by: withdrew, moved, transferred, sent to my, topped up, loaded, shifted, pulled out, deposited into.
Always create TWO entries:
- Entry 1: type "transfer-out", account: source (MoMo, Bank, Cash etc)
- Entry 2: type "transfer-in", account: destination
Same amount, same date. Never create a single transfer entry alone.

LOANS RECEIVED — when the user borrows money:
Triggered by: received a loan, got a loan, borrowed, took credit, loan from, credit from.
Always create TWO entries:
- Entry 1: type "asset", account: Bank (or as specified), description: "Loan received — [lender]", category: "Savings"
- Entry 2: type "liability", account: Other, description: "Loan payable — [lender]", category: "Loans"
Same amount, same date. Net worth stays unchanged. NEVER create only a liability entry for a loan received.

LOAN REPAYMENTS — when the user repays borrowed money:
Triggered by: repaid, paid back, settled, loan payment, cleared debt, paid off.
Always create TWO entries:
- Entry 1: type "transfer-out", account: Bank or Cash, description: "Loan repayment — [description]", category: "Loans"
- Entry 2: type "liability", amount: NEGATIVE value (reduces debt), description: "Loan balance reduced — [description]", category: "Loans"
Never record loan repayments as expenses.

LOANS GIVEN OUT — money lent to others:
Type "asset", category: "Loans" — someone owes you.

CATEGORY: Must be one of: Housing, Food & Dining, Transport, Entertainment, Health, Shopping, Utilities, Investments, Crypto, Property, Salary, Freelance, Business, Savings, Transfer, Loans, Other

CURRENCY: Use exactly what user says. Default UGX.

UGX_AMOUNT: If UGX, same as amount. Otherwise convert to UGX equivalent.

ACCOUNT: Cash, Bank, Mobile Money, or as specified.

INSIGHT: One sharp observation about this transaction and its wealth building implications. Max 15 words. Never generic.

If no transactions are found, return an empty array and a helpful insight message.`
      }
    ];

    const userContent: any[] = [];

    if (image) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${image}` }
      });
      userContent.push({
        type: "text",
        text: "Scan this receipt or document and extract the transactions."
      });
    }

    if (rawInput) {
      userContent.push({
        type: "text",
        text: image ? `Also process this additional text: ${rawInput}` : rawInput
      });
    }

    if (!rawInput && !image) {
      return new Response(JSON.stringify({ error: "No input provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    messages.push({ role: "user", content: userContent });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "parse",
            parameters: {
              type: "object",
              properties: {
                transactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      date: { type: "string" },
                      description: { type: "string" },
                      amount: { type: "number" },
                      currency: { type: "string" },
                      ugx_amount: { type: "number" },
                      type: { type: "string" },
                      category: { type: "string" },
                      account: { type: "string" }
                    },
                    required: ["id", "date", "description", "amount", "currency", "ugx_amount", "type", "category", "account"]
                  }
                },
                insight: { type: "string" }
              },
              required: ["transactions", "insight"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "parse" } }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI Gateway Error (${response.status}):`, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error(`AI Gateway error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    let parsed: any;

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      parsed = JSON.parse(toolCall.function.arguments);
    } else {
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse transaction data from AI response.");
      }
    }

    // Normalization logic from HEAD (good for robustness)
    const today = new Date().toISOString().split("T")[0];
    const validTypes = ["income", "expense", "asset", "liability", "transfer-in", "transfer-out"];
    const categoryMap: Record<string, string> = {
      "food": "Food & Dining", "dining": "Food & Dining", "food & dining": "Food & Dining",
      "transport": "Transport", "transportation": "Transport",
      "housing": "Housing", "health": "Health", "shopping": "Shopping",
      "utilities": "Utilities", "investments": "Investments", "crypto": "Crypto",
      "property": "Property", "salary": "Salary", "freelance": "Freelance",
      "business": "Business", "savings": "Savings", "transfer": "Transfer",
      "entertainment": "Entertainment", "loans": "Loans", "loan": "Loans", "other": "Other",
    };

    const normalizedTransactions = (parsed.transactions || []).map((t: any) => {
      let date = t.date;
      if (!date || date === "today" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        date = today;
      }
      const type = validTypes.includes(t.type?.toLowerCase()) ? t.type.toLowerCase() : "expense";
      const cat = categoryMap[t.category?.toLowerCase()] || t.category || "Other";
      const account = t.account ? t.account.charAt(0).toUpperCase() + t.account.slice(1) : "Cash";
      
      return {
        ...t,
        date,
        type,
        category: cat,
        account,
        ugx_amount: (t.ugx_amount !== undefined && t.ugx_amount !== null && t.ugx_amount !== 0)
          ? Number(t.ugx_amount)
          : (t.currency === "UGX" ? t.amount : t.amount),
      };
    });

    return new Response(JSON.stringify({
      transactions: normalizedTransactions,
      insight: parsed.insight || "Transactions processed."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("parse-transactions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal Server Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});