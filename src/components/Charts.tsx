import { useMemo } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

interface Props {
  transactions: Transaction[];
}

const COLORS = [
  "hsl(43, 60%, 53%)", "hsl(43, 40%, 35%)", "hsl(200, 50%, 45%)",
  "hsl(160, 45%, 40%)", "hsl(280, 40%, 50%)", "hsl(0, 50%, 50%)",
  "hsl(30, 55%, 50%)", "hsl(210, 45%, 55%)", "hsl(120, 35%, 45%)",
];

const Charts = ({ transactions }: Props) => {
  const { convertFromUGX, formatUGX, displayCurrency } = useCurrency();

  const spendingByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.ugx_amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: convertFromUGX(value) }));
  }, [transactions, convertFromUGX]);

  const incomeVsExpensesByMonth = useMemo(() => {
    const map: Record<string, { income: number; expenses: number }> = {};
    transactions.forEach((t) => {
      const month = t.date.substring(0, 7);
      if (!map[month]) map[month] = { income: 0, expenses: 0 };
      if (t.type === "income") map[month].income += t.ugx_amount;
      else if (t.type === "expense") map[month].expenses += t.ugx_amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        income: convertFromUGX(data.income),
        expenses: convertFromUGX(data.expenses),
      }));
  }, [transactions, convertFromUGX]);

  const assetAllocation = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "asset").forEach((t) => {
      map[t.account] = (map[t.account] || 0) + t.ugx_amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: convertFromUGX(value) }));
  }, [transactions, convertFromUGX]);

  const netWorthOverTime = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let netWorth = 0;
    const points: { date: string; netWorth: number }[] = [];
    sorted.forEach((t) => {
      if (t.type === "asset" || t.type === "income") netWorth += t.ugx_amount;
      else netWorth -= t.ugx_amount;
      points.push({ date: t.date, netWorth: convertFromUGX(netWorth) });
    });
    return points;
  }, [transactions, convertFromUGX]);

  const fmtValue = (v: number) => formatUGX(v);

  const tooltipStyle = {
    contentStyle: { background: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 15%, 18%)", borderRadius: 8, color: "hsl(40, 20%, 90%)" },
    labelStyle: { color: "hsl(40, 20%, 90%)" },
  };

  if (transactions.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
        <p className="font-display text-lg">No data yet</p>
        <p className="text-sm mt-1">Add transactions to see charts</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {spendingByCategory.length > 0 && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-semibold">Spending Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={spendingByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} strokeWidth={0}>
                {spendingByCategory.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: number) => fmtValue(v)} />
              <Legend wrapperStyle={{ fontSize: 11, color: "hsl(220, 10%, 50%)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {incomeVsExpensesByMonth.length > 0 && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-semibold">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={incomeVsExpensesByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => fmtValue(v)} />
              <Bar dataKey="income" fill="hsl(43, 60%, 53%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(0, 50%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {assetAllocation.length > 0 && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-semibold">Asset Allocation</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={assetAllocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} strokeWidth={0}>
                {assetAllocation.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: number) => fmtValue(v)} />
              <Legend wrapperStyle={{ fontSize: 11, color: "hsl(220, 10%, 50%)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {netWorthOverTime.length > 1 && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-semibold">Net Worth Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={netWorthOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => fmtValue(v)} />
              <Line type="monotone" dataKey="netWorth" stroke="hsl(43, 60%, 53%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default Charts;
