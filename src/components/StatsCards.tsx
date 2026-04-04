import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface StatsCardsProps {
  stats: {
    income: number;
    expenses: number;
    netWorth: number;
    savingsRate: number;
    assets: number;
    liabilities: number;
  };
  showWealthScore: boolean;
  fourthStatCard: string;
}

const StatsCards = ({ stats, showWealthScore, fourthStatCard }: StatsCardsProps) => {
  const { netWorth, income: totalIncome, expenses: monthlyExpenses, savingsRate, assets: totalAssets, liabilities: totalLiabilities } = stats;
  const cashFlow = totalIncome - monthlyExpenses;
  const { formatUGX, displayCurrency } = useCurrency();
  const [showBalances, setShowBalances] = useState(true);

  const toggleEye = () => setShowBalances(!showBalances);

  const usdEquiv = displayCurrency === "UGX"
    ? `≈ $${Math.round(netWorth / 3750).toLocaleString()} USD`
    : "";

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Net Worth */}
      <div className="glass-card rounded-2xl p-4 space-y-1 relative">
        <div className="flex justify-between items-center w-full">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Net Worth</p>
          <button onClick={toggleEye} className="text-muted-foreground hover:text-foreground transition-colors">
            {showBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-xl font-display font-bold text-violet-hover animate-count-up">
          {showBalances ? formatUGX(netWorth) : "********"}
        </p>
        {usdEquiv && showBalances && <p className="text-[10px] text-muted-foreground">{usdEquiv}</p>}
      </div>

      {/* Cash Flow */}
      <div className="glass-card rounded-2xl p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cash Flow</p>
        <p className={`text-xl font-display font-bold animate-count-up ${cashFlow >= 0 ? "text-success" : "text-destructive"}`}>
          {showBalances ? <>{cashFlow >= 0 ? "+" : ""}{formatUGX(cashFlow)}</> : "********"}
        </p>
        <p className="text-[10px] text-muted-foreground">this month</p>
      </div>

      {/* Savings Rate */}
      <div className="glass-card rounded-2xl p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Savings Rate</p>
        <p className="text-xl font-display font-bold text-foreground animate-count-up">
          {showBalances ? `${savingsRate}%` : "**%"}
        </p>
        <p className="text-[10px] text-muted-foreground">of income</p>
      </div>

      {/* Total Income */}
      {showWealthScore ? (
        <div className="glass-card rounded-2xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Wealth Score</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-xl font-display font-bold text-violet-hover">85</div>
            <div className="text-[10px] text-success">Elite</div>
          </div>
          <p className="text-[10px] text-muted-foreground">top 15%</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {fourthStatCard}
          </p>
          <p className="text-xl font-display font-bold text-violet-hover animate-count-up">
            {showBalances ? (
              fourthStatCard === "Total Assets" ? formatUGX(totalAssets) :
              fourthStatCard === "Total Liabilities" ? formatUGX(totalLiabilities) :
              fourthStatCard === "Monthly Expenses" ? formatUGX(monthlyExpenses) :
              fourthStatCard === "Largest Expense Category" ? "TBD" : formatUGX(totalIncome)
            ) : "********"}
          </p>
          <p className="text-[10px] text-muted-foreground">indicator</p>
        </div>
      )}
    </div>
  );
};

export default StatsCards;
