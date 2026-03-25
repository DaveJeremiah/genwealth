import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// Approximate exchange rates to USD (static fallback)
const RATES_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.74, AUD: 0.65, JPY: 0.0067,
  CHF: 1.13, CNY: 0.14, INR: 0.012, BRL: 0.20, MXN: 0.059,
  BTC: 67000, ETH: 3500, SOL: 145, XRP: 0.55, USDT: 1, USDC: 1,
};

interface CurrencyContextType {
  showUSD: boolean;
  toggleUSD: () => void;
  convert: (amount: number, currency: string) => number;
  format: (amount: number, currency: string, opts?: { sign?: boolean }) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [showUSD, setShowUSD] = useState(false);

  const convert = useCallback(
    (amount: number, currency: string) => {
      if (!showUSD || currency === "USD") return amount;
      const rate = RATES_TO_USD[currency.toUpperCase()] ?? 1;
      return amount * rate;
    },
    [showUSD]
  );

  const format = useCallback(
    (amount: number, currency: string, opts?: { sign?: boolean }) => {
      const displayCurrency = showUSD ? "USD" : currency;
      const displayAmount = convert(amount, currency);
      const abs = Math.abs(displayAmount);
      const prefix = opts?.sign ? (displayAmount >= 0 ? "+" : "-") : displayAmount < 0 ? "-" : "";

      // Crypto formatting
      const cryptos = ["BTC", "ETH", "SOL", "XRP", "USDT", "USDC"];
      if (!showUSD && cryptos.includes(currency.toUpperCase())) {
        return `${prefix}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${currency}`;
      }

      const symbol = displayCurrency === "EUR" ? "€" : displayCurrency === "GBP" ? "£" : displayCurrency === "JPY" ? "¥" : "$";
      return `${prefix}${symbol}${abs.toLocaleString("en-US", { minimumFractionDigits: 2 })}${!showUSD && currency !== "USD" ? ` ${currency}` : ""}`;
    },
    [showUSD, convert]
  );

  return (
    <CurrencyContext.Provider value={{ showUSD, toggleUSD: () => setShowUSD((v) => !v), convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
};
