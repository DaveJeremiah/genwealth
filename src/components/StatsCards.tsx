import { useCurrency } from "@/contexts/CurrencyContext";

interface StatsCardsProps {
  netWorth: number;
  cashFlow: number;
  savingsRate: number;
  wealthScore: number;
  wealthLabel: string;
}

const StatsCards = ({ netWorth, cashFlow, savingsRate, wealthScore, wealthLabel }: StatsCardsProps) => {
  const { formatUGX, displayCurrency, convertFromUGX } = useCurrency();

  const usdEquiv = displayCurrency === "UGX"
    ? `≈ $${Math.round(netWorth / 3750).toLocaleString()} USD`
    : "";

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Net Worth */}
      <div className="glass-card rounded-2xl p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Net Worth</p>
        <p className="text-xl font-display font-bold text-violet-hover animate-count-up">
          {formatUGX(netWorth)}
        </p>
        {usdEquiv && <p className="text-[10px] text-muted-foreground">{usdEquiv}</p>}
      </div>

      {/* Cash Flow */}
      <div className="glass-card rounded-2xl p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cash Flow</p>
        <p className={`text-xl font-display font-bold animate-count-up ${cashFlow >= 0 ? "text-success" : "text-destructive"}`}>
          {cashFlow >= 0 ? "+" : ""}{formatUGX(cashFlow)}
        </p>
        <p className="text-[10px] text-muted-foreground">this month</p>
      </div>

      {/* Savings Rate */}
      <div className="glass-card rounded-2xl p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Savings Rate</p>
        <p className="text-xl font-display font-bold text-foreground animate-count-up">
          {savingsRate}%
        </p>
        <p className="text-[10px] text-muted-foreground">of income</p>
      </div>

      {/* Wealth Score */}
      <div className="glass-card rounded-2xl p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Wealth Score</p>
        <p className="text-xl font-display font-bold text-violet-hover animate-count-up">
          {wealthScore}
        </p>
        <p className="text-[10px] text-muted-foreground">{wealthLabel}</p>
      </div>
    </div>
  );
};

export default StatsCards;
