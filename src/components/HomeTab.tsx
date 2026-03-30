import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import TransactionInput from "@/components/TransactionInput";
import StatsCards from "@/components/StatsCards";
import FinancialStatements from "@/components/FinancialStatements";
import TransactionLog from "@/components/TransactionLog";
import WishListPanel from "@/components/WishListPanel";

const CASUAL_GREETINGS: ((name: string) => string)[] = [
  (n) => `Sap, ${n} 👊`,
  (n) => `Hi ${n}, let's get it 💪`,
  (n) => `What's good, ${n}?`,
  () => `Holla, fellow rich 🤑`,
  () => `Bro, check your bag 💰`,
  (n) => `Grandmaster ${n} is in 👑`,
  (n) => `Mr. ${n}, welcome back 🏦`,
  () => `Fam, the numbers await 📊`,
  (n) => `Bigman ${n}, what's the move? 💼`,
  () => `Ssebo, webale okujja 🙌`,
  () => `Boss, your empire awaits 🏰`,
  (n) => `Ey ${n}, let's build today 🔨`,
];

interface HomeTabProps {
  transactions: Transaction[];
  stats: {
    income: number;
    expenses: number;
    netWorth: number;
    savingsRate: number;
    assets: number;
    liabilities: number;
  };
  displayName: string;
  latestInsight: string | null;
  onInsight: (insight: string) => void;
}

const HomeTab = ({ transactions, stats, displayName, latestInsight, onInsight }: HomeTabProps) => {
  const { formatUGX } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sectionTab, setSectionTab] = useState<"recent" | "statements" | "wishlist">("recent");

  const nickMeta = user?.user_metadata?.nickname;
  const nickname =
    nickMeta != null && String(nickMeta).trim() !== "" ? String(nickMeta).trim() : "";
  const greetingName = nickname || displayName;

  const casualGreeting = useMemo(() => {
    const uid = user?.id ?? "guest";
    const key = `jenwealthy_greet_${uid}_${greetingName}`;
    try {
      const hit = sessionStorage.getItem(key);
      if (hit) return hit;
    } catch {
      /* private mode */
    }
    const pick = CASUAL_GREETINGS[Math.floor(Math.random() * CASUAL_GREETINGS.length)];
    const g = pick(greetingName);
    try {
      sessionStorage.setItem(key, g);
    } catch {
      /* ignore */
    }
    return g;
  }, [greetingName, user?.id]);


  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="space-y-6 pt-2 pb-[2px]">
      {/* Greeting */}
      <div>
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="text-2xl font-display font-bold text-foreground mt-1">
          {casualGreeting}
        </h1>
      </div>

      {/* Pill Input */}
      <TransactionInput onInsight={onInsight} />

      {/* 2x2 Stats Grid */}
      <StatsCards
        netWorth={stats.netWorth}
        cashFlow={stats.income - stats.expenses}
        savingsRate={stats.savingsRate}
        totalIncome={stats.income}
      />

      {/* AI Insight Card */}
      <div className="glass-card rounded-2xl p-4 border-l-2 border-l-primary" style={{ borderLeftWidth: '2px', borderLeftColor: 'hsl(263, 83%, 58%)' }}>
        <p className="text-sm italic leading-relaxed" style={{ color: '#999', lineHeight: 1.7 }}>
          {latestInsight || "Tell me about your day financially. I'll make sense of it."}
        </p>
      </div>

      {/* Section Tabs */}
      <div>
        <div className="flex gap-6 relative flex-wrap">
          <button
            onClick={() => setSectionTab("recent")}
            className={`pb-2 text-sm font-medium transition-colors ${
              sectionTab === "recent" ? "text-violet-hover border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            Entries
          </button>
          <button
            onClick={() => setSectionTab("statements")}
            className={`pb-2 text-sm font-medium transition-colors ${
              sectionTab === "statements" ? "text-violet-hover border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            Statements
          </button>
          <button
            onClick={() => setSectionTab("wishlist")}
            className={`pb-2 text-sm font-medium transition-colors ${
              sectionTab === "wishlist" ? "text-violet-hover border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            Wish List
          </button>
        </div>
        <div className="border-b border-border" style={{ borderBottomWidth: '0.5px' }} />
      </div>

      {/* Section Content */}
      {sectionTab === "recent" ? (
        <>
          <RecentEntries transactions={transactions} />
          <div className="pt-2 text-center py-0">
            <button onClick={() => navigate("/entries")} className="text-xs font-medium text-violet-hover hover:underline transition-colors">
              See all →
            </button>
          </div>
        </>
      ) : sectionTab === "statements" ? (
        <FinancialStatements transactions={transactions} />
      ) : (
        <WishListPanel />
      )}
    </div>
  );
};

const CATEGORY_EMOJIS: Record<string, string> = {
  "Housing": "🏠",
  "Food & Dining": "🍽️",
  "Transport": "🚗",
  "Entertainment": "🎬",
  "Health": "💊",
  "Shopping": "🛍️",
  "Utilities": "⚡",
  "Investments": "📈",
  "Crypto": "₿",
  "Property": "🏗️",
  "Salary": "💰",
  "Freelance": "💻",
  "Business": "🏢",
  "Savings": "🐷",
  "Transfer": "↔️",
  "Other": "📌",
};

const RecentEntries = ({ transactions }: { transactions: Transaction[] }) => {
  const { formatUGX } = useCurrency();
  const recent = transactions.slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No entries yet. Tell me what happened financially today.</p>
      </div>
    );
  }

  const getAmountColor = (type: string) => {
    if (type === "income") return "text-success";
    if (type === "expense") return "text-destructive";
    if (type.startsWith("transfer")) return "text-transfer";
    return "text-violet-hover";
  };

  const formatAmount = (t: Transaction) => {
    const prefix = t.type === "income" ? "+" : t.type === "expense" ? "-" : "";
    return prefix + formatUGX(Math.abs(t.ugx_amount));
  };

  return (
    <div className="space-y-0">
      {recent.map((t, i) => (
        <div key={t.id}>
          <div className="flex items-center gap-3 py-3">
            <div className="w-9 h-9 rounded-lg bg-card flex items-center justify-center text-base border border-border">
              {CATEGORY_EMOJIS[t.category] || "📌"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
              <p className="text-xs text-muted-foreground">
                {t.date} · {t.category}
              </p>
            </div>
            <span className={`text-sm font-semibold font-display ${getAmountColor(t.type)}`}>
              {formatAmount(t)}
            </span>
          </div>
          {i < recent.length - 1 && (
            <div className="border-b border-border" style={{ borderBottomWidth: '0.5px' }} />
          )}
        </div>
      ))}
    </div>
  );
};

export default HomeTab;
