import { useMemo } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank } from "lucide-react";

interface StatsCardsProps {
  transactions: Transaction[];
}

const StatsCards = ({ transactions }: StatsCardsProps) => {
  const stats = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const assets = transactions.filter((t) => t.type === "asset").reduce((s, t) => s + t.amount, 0);
    const liabilities = transactions.filter((t) => t.type === "liability").reduce((s, t) => s + t.amount, 0);
    const netWorth = assets - liabilities;
    const cashFlow = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return { income, expenses, assets, liabilities, netWorth, cashFlow, savingsRate };
  }, [transactions]);

  const cards = [
    { label: "Net Worth", value: stats.netWorth, icon: DollarSign, highlight: true },
    { label: "Total Income", value: stats.income, icon: TrendingUp },
    { label: "Total Expenses", value: stats.expenses, icon: TrendingDown },
    { label: "Savings Rate", value: stats.savingsRate, icon: PiggyBank, suffix: "%" },
  ];

  const fmt = (n: number, suffix?: string) =>
    suffix ? `${n.toFixed(1)}${suffix}` : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl p-5 space-y-2 ${
            c.highlight ? "gold-gradient" : "glass-card"
          }`}
        >
          <div className="flex items-center gap-2">
            <c.icon className={`w-4 h-4 ${c.highlight ? "text-primary-foreground" : "text-primary"}`} />
            <span className={`text-xs font-body font-medium ${c.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {c.label}
            </span>
          </div>
          <p className={`text-2xl font-display font-bold ${c.highlight ? "text-primary-foreground" : "text-foreground"}`}>
            {fmt(c.value, c.suffix)}
          </p>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
