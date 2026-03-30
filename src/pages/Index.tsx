import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useOffline } from "@/contexts/OfflineContext";
import { Home, Activity, LogOut } from "lucide-react";
import OfflineBanner from "@/components/OfflineBanner";
import SyncIndicator from "@/components/SyncIndicator";
import HomeTab from "@/components/HomeTab";
import PulseTab from "@/components/PulseTab";
import AIChatAssistant from "@/components/AIChatAssistant";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const { signOut, user } = useAuth();
  const { displayCurrency, setDisplayCurrency } = useCurrency();
  const { data: transactions = [] } = useTransactions();
  const { isOnline, syncStatus, pendingCount } = useOffline();
  const [activeTab, setActiveTab] = useState<"home" | "pulse">("home");
  const [latestInsight, setLatestInsight] = useState<string | null>(null);

  const firstName = user?.email?.split("@")[0] || "there";
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const stats = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.ugx_amount, 0);
    const expenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.ugx_amount, 0);
    const assets = transactions.filter((t) => t.type === "asset").reduce((s, t) => s + t.ugx_amount, 0);
    const liabilities = transactions.filter((t) => t.type === "liability").reduce((s, t) => s + t.ugx_amount, 0);
    const netWorth = assets - liabilities + income - expenses;
    const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
    return { income, expenses, netWorth, savingsRate, assets, liabilities };
  }, [transactions]);

  // Sync indicator dot color
  const dotColor = !isOnline ? "bg-muted-foreground" : pendingCount > 0 ? "bg-amber-500" : "bg-success";

  const currencyOptions = ["UGX", "USD", "EUR", "GBP", "KES"] as const;
  type CurrencyOption = (typeof currencyOptions)[number];
  const LAST_NON_UGX_KEY = "wealthos_last_non_ugx_currency";

  const [lastNonUgxCurrency, setLastNonUgxCurrency] = useState<CurrencyOption>(() => {
    const saved = localStorage.getItem(LAST_NON_UGX_KEY);
    if (saved && currencyOptions.includes(saved as CurrencyOption)) return saved as CurrencyOption;
    return "USD";
  });

  useEffect(() => {
    if (displayCurrency !== "UGX") {
      setLastNonUgxCurrency(displayCurrency);
      localStorage.setItem(LAST_NON_UGX_KEY, displayCurrency);
    }
  }, [displayCurrency]);

  const rightLabel = displayCurrency === "UGX" ? lastNonUgxCurrency : displayCurrency;
  const rightSelected = displayCurrency !== "UGX";

  return (
    <div className="min-h-svh bg-background font-body">
      <OfflineBanner />

      {/* Minimal top header — with safe area for notch */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl px-4 flex items-center justify-between py-[35px] pb-[12px] mb-0 pt-[50px] mt-[10px] my-[5px]" style={{ paddingTop: "max(env(safe-area-inset-top, 12px), 12px)" }}>
        <div className="flex items-center gap-3">
          <HamburgerMenu />
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        </div>
        <div className="flex items-center gap-2">
          {/* Currency toggle pill */}
          <div className="flex items-center bg-card rounded-full border border-border p-0.5">
            <button
              onClick={() => setDisplayCurrency("UGX")}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                displayCurrency === "UGX"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              UGX
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                    rightSelected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Select currency"
                >
                  {rightLabel}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                {currencyOptions.map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => {
                      setDisplayCurrency(c);
                      if (c !== "UGX") {
                        setLastNonUgxCurrency(c);
                        localStorage.setItem(LAST_NON_UGX_KEY, c);
                      }
                    }}
                    className={displayCurrency === c ? "bg-accent text-accent-foreground" : undefined}
                  >
                    {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pb-28 max-w-lg mx-auto px-4">
        {activeTab === "home" ? (
          <HomeTab
            transactions={transactions}
            stats={stats}
            displayName={displayName}
            latestInsight={latestInsight}
            onInsight={setLatestInsight}
          />
        ) : (
          <PulseTab transactions={transactions} stats={stats} />
        )}
      </main>

      {/* AI Chat FAB */}
      <AIChatAssistant currentScreen={activeTab} />

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border" style={{ borderTopWidth: "0.5px" }}>
        <div className="max-w-lg mx-auto flex items-center justify-around pt-2 pb-[calc(1rem+max(env(safe-area-inset-bottom),14px))] py-[5px] mb-[3px]">
          <button
            onClick={() => setActiveTab("home")}
            className="flex flex-col items-center gap-1 py-1 px-6 transition-colors"
          >
            <div className={`p-1.5 rounded-full transition-all ${activeTab === "home" ? "bg-primary/20" : ""}`}>
              <Home className={`w-5 h-5 ${activeTab === "home" ? "text-violet-hover" : "text-muted-foreground"}`} />
            </div>
            <span className={`text-[10px] font-medium ${activeTab === "home" ? "text-violet-hover" : "text-muted-foreground"}`}>
              Home
            </span>
          </button>
          <button
            onClick={() => setActiveTab("pulse")}
            className="flex flex-col items-center gap-1 py-1 px-6 transition-colors"
          >
            <div className={`p-1.5 rounded-full transition-all ${activeTab === "pulse" ? "bg-primary/20" : ""}`}>
              <Activity className={`w-5 h-5 ${activeTab === "pulse" ? "text-violet-hover" : "text-muted-foreground"}`} />
            </div>
            <span className={`text-[10px] font-medium ${activeTab === "pulse" ? "text-violet-hover" : "text-muted-foreground"}`}>
              Pulse
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Index;
