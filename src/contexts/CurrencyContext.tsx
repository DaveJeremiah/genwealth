import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

type DisplayCurrency = "UGX" | "USD" | "KES" | "EUR";

const CURRENCY_SYMBOLS: Record<string, string> = {
  UGX: "UGX ", USD: "$", KES: "KES ", EUR: "€", GBP: "£", JPY: "¥",
};

const CRYPTOS = ["BTC", "ETH", "SOL", "XRP", "USDT", "USDC", "BNB", "ADA", "DOGE", "DOT"];

interface CurrencyContextType {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
  /** Convert a UGX amount to the current display currency */
  convertFromUGX: (ugxAmount: number) => number;
  /** Format a UGX amount in the current display currency */
  formatUGX: (ugxAmount: number, opts?: { sign?: boolean }) => string;
  /** Format original amount with its currency label */
  formatOriginal: (amount: number, currency: string) => string;
  ratesReady: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};

// Fallback rates: 1 UGX = X display currency
const FALLBACK_RATES: Record<string, number> = {
  UGX: 1,
  USD: 1 / 3750,
  KES: 29 / 3750, // ~0.00773
  EUR: 1 / 4050,
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(() => {
    return (localStorage.getItem("wealthos_currency") as DisplayCurrency) || "UGX";
  });
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [ratesReady, setRatesReady] = useState(false);

  const setDisplayCurrency = useCallback((c: DisplayCurrency) => {
    setDisplayCurrencyState(c);
    localStorage.setItem("wealthos_currency", c);
  }, []);

  // Fetch live rates from frankfurter.app: UGX -> USD, KES, EUR
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch("https://api.frankfurter.app/latest?from=UGX&to=USD,KES,EUR");
        if (!res.ok) throw new Error("Rate fetch failed");
        const data = await res.json();
        setRates({
          UGX: 1,
          USD: data.rates.USD ?? FALLBACK_RATES.USD,
          KES: data.rates.KES ?? FALLBACK_RATES.KES,
          EUR: data.rates.EUR ?? FALLBACK_RATES.EUR,
        });
      } catch (e) {
        console.warn("Using fallback exchange rates:", e);
      } finally {
        setRatesReady(true);
      }
    };
    fetchRates();
    const interval = setInterval(fetchRates, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  const convertFromUGX = useCallback(
    (ugxAmount: number) => {
      if (displayCurrency === "UGX") return ugxAmount;
      const rate = rates[displayCurrency] ?? FALLBACK_RATES[displayCurrency] ?? (1 / 3750);
      return ugxAmount * rate;
    },
    [displayCurrency, rates]
  );

  const formatUGX = useCallback(
    (ugxAmount: number, opts?: { sign?: boolean }) => {
      const converted = convertFromUGX(ugxAmount);
      const abs = Math.abs(converted);
      const prefix = opts?.sign
        ? converted >= 0 ? "+" : "-"
        : converted < 0 ? "-" : "";

      const symbol = CURRENCY_SYMBOLS[displayCurrency] || displayCurrency + " ";

      if (displayCurrency === "UGX") {
        return `${prefix}${symbol}${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }
      return `${prefix}${symbol}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    [displayCurrency, convertFromUGX]
  );

  const formatOriginal = useCallback((amount: number, currency: string) => {
    const cur = currency.toUpperCase();
    if (CRYPTOS.includes(cur)) {
      return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${cur}`;
    }
    const symbol = CURRENCY_SYMBOLS[cur] || cur + " ";
    return `${symbol}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }, []);

  return (
    <CurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency, convertFromUGX, formatUGX, formatOriginal, ratesReady }}>
      {children}
    </CurrencyContext.Provider>
  );
};
