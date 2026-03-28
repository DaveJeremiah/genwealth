import { useMemo, useState } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import Charts from "@/components/Charts";
import WealthAnalysis from "@/components/WealthAnalysis";

interface PulseTabProps {
  transactions: Transaction[];
  stats: {
    income: number;
    expenses: number;
    netWorth: number;
    savingsRate: number;
    assets: number;
    liabilities: number;
  };
}

const PulseTab = ({ transactions, stats }: PulseTabProps) => {
  const { formatUGX } = useCurrency();

  const quickStats = [
    { label: "Total Assets", value: formatUGX(stats.assets) },
    { label: "Total Liabilities", value: formatUGX(stats.liabilities) },
    { label: "Total Income", value: formatUGX(stats.income) },
    { label: "Total Expenses", value: formatUGX(stats.expenses) },
  ];

  return (
    <div className="space-y-6 pt-2">
      {/* Net Worth Chart */}
      <Charts transactions={transactions} />

      {/* Quick Stats Row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {quickStats.map((s) => (
          <div
            key={s.label}
            className="flex-shrink-0 px-3 py-2 rounded-full bg-card border border-border"
          >
            <span className="text-[10px] text-muted-foreground mr-1.5">{s.label}</span>
            <span className="text-xs font-semibold text-violet-hover">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Spending & Asset Donuts */}
      <SpendingBreakdown transactions={transactions} />
      <AssetAllocation transactions={transactions} />

      {/* Wealth Analysis */}
      <WealthAnalysis />
    </div>
  );
};

// Donut components extracted for cleanliness
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";

const DONUT_COLORS = [
  "hsl(263, 83%, 58%)", "hsl(155, 52%, 55%)", "hsl(210, 52%, 55%)",
  "hsl(0, 52%, 55%)", "hsl(40, 60%, 55%)", "hsl(180, 45%, 50%)",
];

const SpendingBreakdown = ({ transactions }: { transactions: Transaction[] }) => {
  const { convertFromUGX, formatUGX } = useCurrency();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.ugx_amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name,
        value: convertFromUGX(value),
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [transactions, convertFromUGX]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spending</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-xs text-foreground flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AssetAllocation = ({ transactions }: { transactions: Transaction[] }) => {
  const { convertFromUGX } = useCurrency();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "asset").forEach((t) => {
      const bucket = t.account || t.category || "Other";
      map[bucket] = (map[bucket] || 0) + t.ugx_amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name,
        value: convertFromUGX(value),
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [transactions, convertFromUGX]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assets</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-xs text-foreground flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PulseTab;
