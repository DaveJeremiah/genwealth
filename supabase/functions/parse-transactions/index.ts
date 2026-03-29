import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRYPTOS = ["BTC", "ETH", "SOL", "XRP", "USDT", "USDC", "BNB", "ADA", "DOGE", "DOT"];

async function fiatToUGX(amount: number, currency: string): Promise<number> {
  if (currency === "UGX") return amount;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${currency}&to=UGX`);
    if (!res.ok) throw new Error(`Frankfurter error: ${res.status}`);
    const data = await res.json();
    return data.rates?.UGX ?? amount;
  } catch (e) {
    console.error("Fiat conversion error:", e);
    // Fallback rates to UGX
    const fallback: Record<string, number> = { USD: 3750, EUR: 4050, GBP: 4700, KES: 29, CAD: 2750, AUD: 2450, JPY: 25, CHF: 4200, CNY: 520, INR: 45, BRL: 750, MXN: 220 };
    return amount * (fallback[currency] ?? 3750);
  }
}

async function cryptoToUGX(amount: number, coinId: string): Promise<number> {
  const idMap: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", USDT: "tether", USDC: "usd-coin", BNB: "binancecoin", ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot" };
  const id = idMap[coinId.toUpperCase()];
  if (!id) return amount;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const data = await res.json();
    const usdPrice = data[id]?.usd ?? 0;
    // Convert USD to UGX
    return await fiatToUGX(amount * usdPrice, "USD");
  } catch (e) {
    console.error("Crypto conversion error:", e);
    const fallbackUSD: Record<string, number> = { BTC: 67000, ETH: 3500, SOL: 145, XRP: 0.55, USDT: 1, USDC: 1, BNB: 600, ADA: 0.45, DOGE: 0.15, DOT: 7 };
    return amount * (fallbackUSD[coinId.toUpperCase()] ?? 1) * 3750;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { input } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];

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
            content: `You are a personal financial accountant based in Uganda. Parse the user's natural language input and return a JSON array of transactions. Each transaction must have: id (generate a random uuid string), date (use ${today} if not specified), description, amount (the original amount in the original currency — almost always positive; see LOANS AND DEBT below for the exception), currency (default to UGX if no currency is mentioned. Use standard 3-letter codes: UGX, USD, EUR, GBP, KES, etc. For crypto use: BTC, ETH, SOL, XRP, USDT, USDC, BNB, ADA, DOGE, DOT), type (income/expense/asset/liability/transfer-in/transfer-out), category (Housing/Food & Dining/Transport/Entertainment/Health/Shopping/Utilities/Investments/Crypto/Property/Salary/Freelance/Business/Savings/Transfer/Other — for new debt liabilities use exactly one of: Loan, Mortgage, Credit Card, Payday Loan, Other), account (Cash/Bank/Mobile Money/Investment/Crypto/Property/Other).

LOANS AND DEBT (DOUBLE ENTRY):
- When the user records receiving a loan, credit facility, borrowed money, or any debt instrument (money they must repay), return TWO entries from one input — same date, same currency, same numeric amount (positive) on both lines:
  Entry A — type: asset, account: the account the money landed in (default Bank if not specified), amount: loan amount, description: "Loan received — [lender or short description]", category: Savings
  Entry B — type: liability, account: Other, amount: same positive amount, description: "Loan payable — [lender or short description]", category: exactly one of Loan, Mortgage, Credit Card, Payday Loan, Other (pick the debt type that best matches: mortgage→Mortgage, credit card→Credit Card, payday→Payday Loan, generic loan→Loan, else Other)
- Net worth is unchanged (asset equals liability). The insight for this case MUST convey: "This loan added cash to your account and an equal debt to your liabilities. Your net worth is unchanged — but you now have liquidity to deploy. Every shilling you spend from it is a real expense. It only leaves your liabilities when you explicitly repay it." (You may tighten wording slightly but keep this meaning.)
- When the user records drawing on a revolving credit line or "using credit" (not a generic loan disbursement), use the same two-entry pattern but Entry A description must start with "Credit used — [description]" and Entry B remains liability with "Loan payable — ..." or appropriate credit liability wording; category for debt should be Credit Card when applicable.
- When the user records a LOAN REPAYMENT (signals: repaid, paid back, settled the loan, loan payment, cleared debt, paid down debt, installment on a loan, etc.), return TWO entries — same date, same currency:
  Entry A — type: transfer-out, account: Bank or Cash (whichever they paid from; default Bank), amount: repayment amount (positive), description: "Loan repayment — [description]", category: Transfer
  Entry B — type: liability, account: Other, amount: NEGATIVE number whose absolute value equals the repayment amount (this reduces the debt), description: "Loan balance reduced — [description]", category: same debt-type category as the original loan if inferable, else Other
- If they fully settle a non-revolving debt or emphasize debt closure, you may use description "Debt settled — [description]" on the transfer-out and "Debt balance reduced — [description]" on the negative liability instead of the loan repayment wording — still two entries, liability amount negative.
- Loan repayments must NEVER be coded as expense — they are balance-sheet and transfer movements only (cash down, liability down; net worth unchanged). The insight must NOT treat repayment as spending or P&L expense.
- Spending that happens to use borrowed funds is still normal expense (income/expense) when they describe a purchase — only the borrowing/repaying uses the rules above.

TRANSFER DETECTION RULES:
- "transfer" is a valid type alongside income/expense/asset/liability.
- A transfer is any movement of money between accounts the user owns — examples: mobile money withdrawal to cash, bank transfer to mobile money, moving funds between bank accounts, sending crypto between own wallets, withdrawing from an investment account to a bank account.
- Identify transfers using these signals: words like "withdrew", "moved", "transferred", "sent to my", "topped up", "loaded", "shifted", "pulled out" — especially when both source and destination belong to the user.
- For transfers, return TWO entries: one with type "transfer-out" (account = source) and one with type "transfer-in" (account = destination). Same amount, same date, opposite directions. Category should be "Transfer".
- The insight for a transfer should note the movement without treating it as spending or earning.
- Example: "withdrew 200,000 UGX from MoMo to cash" becomes two entries: {type: "transfer-out", account: "Mobile Money", amount: 200000} and {type: "transfer-in", account: "Cash", amount: 200000}.

Also return a single 'insight' string — one sharp, direct observation about what was just entered and its implications for wealth building. Return only valid JSON in this exact format: {"transactions": [...], "insight": "..."}`
          },
          { role: "user", content: input }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_transactions",
              description: "Parse financial transactions from natural language",
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
                        type: { type: "string", enum: ["income", "expense", "asset", "liability", "transfer-in", "transfer-out"] },
                        category: { type: "string" },
                        account: { type: "string" }
                      },
                      required: ["id", "date", "description", "amount", "currency", "type", "category", "account"]
                    }
                  },
                  insight: { type: "string" }
                },
                required: ["transactions", "insight"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_transactions" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    // Convert each transaction to UGX
    const enriched = await Promise.all(
      parsed.transactions.map(async (t: any) => {
        const cur = (t.currency || "UGX").toUpperCase();
        const rawAmt = Number(t.amount);
        const sign = rawAmt < 0 ? -1 : 1;
        const absAmt = Math.abs(rawAmt);
        let ugxAmount: number;
        if (cur === "UGX") {
          ugxAmount = absAmt;
        } else if (CRYPTOS.includes(cur)) {
          ugxAmount = await cryptoToUGX(absAmt, cur);
        } else {
          ugxAmount = await fiatToUGX(absAmt, cur);
        }
        return { ...t, amount: rawAmt, currency: cur, ugx_amount: sign * Math.round(ugxAmount) };
      })
    );

    return new Response(JSON.stringify({ transactions: enriched, insight: parsed.insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-transactions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
