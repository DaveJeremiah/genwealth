/** Client-side conversion to UGX for wish list estimates and purchase transactions (mirrors parse-transactions fallbacks). */

async function fiatToUGX(amount: number, currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === "UGX") return amount;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${cur}&to=UGX`);
    if (!res.ok) throw new Error(`Frankfurter error: ${res.status}`);
    const data = await res.json();
    return data.rates?.UGX ?? amount;
  } catch {
    const fallback: Record<string, number> = {
      USD: 3750,
      EUR: 4050,
      GBP: 4700,
      KES: 29,
    };
    return amount * (fallback[cur] ?? 3750);
  }
}

async function cryptoToUGX(amount: number, coinId: string): Promise<number> {
  const idMap: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum" };
  const id = idMap[coinId.toUpperCase()];
  if (!id) return amount;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const data = await res.json();
    const usdPrice = data[id]?.usd ?? 0;
    return await fiatToUGX(amount * usdPrice, "USD");
  } catch {
    const fallbackUSD: Record<string, number> = { BTC: 67000, ETH: 3500 };
    return amount * (fallbackUSD[coinId.toUpperCase()] ?? 1) * 3750;
  }
}

export async function convertAmountToUgx(amount: number, currency: string): Promise<number> {
  const cur = (currency || "UGX").toUpperCase();
  if (cur === "BTC" || cur === "ETH") {
    return Math.round(await cryptoToUGX(amount, cur));
  }
  return Math.round(await fiatToUGX(amount, cur));
}
