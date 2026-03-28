import { useMemo, useState } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

interface Props {
  transactions: Transaction[];
}

const Charts = ({ transactions }: Props) => {
  const { convertFromUGX, formatUGX, displayCurrency } = useCurrency();
  const [range, setRange] = useState<"1W" | "1M" | "3M" | "All">("3M");

  const netWorthOverTime = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let netWorth = 0;
    const points: { date: string; netWorth: number }[] = [];
    sorted.forEach((t) => {
      if (t.type === "asset" || t.type === "income" || t.type === "transfer-in") netWorth += t.ugx_amount;
      else if (t.type !== "transfer-out") netWorth -= t.ugx_amount;
      else netWorth -= t.ugx_amount;
      points.push({ date: t.date, netWorth: convertFromUGX(netWorth) });
    });
    return points;
  }, [transactions, convertFromUGX]);

  const filteredData = useMemo(() => {
    if (range === "All" || netWorthOverTime.length === 0) return netWorthOverTime;
    const now = new Date();
    const cutoff = new Date();
    if (range === "1W") cutoff.setDate(now.getDate() - 7);
    else if (range === "1M") cutoff.setMonth(now.getMonth() - 1);
    else if (range === "3M") cutoff.setMonth(now.getMonth() - 3);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return netWorthOverTime.filter((p) => p.date >= cutoffStr);
  }, [netWorthOverTime, range]);

  const currentNetWorth = filteredData.length > 0 ? filteredData[filteredData.length - 1].netWorth : 0;

  if (transactions.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Add transactions to see your net worth chart</p>
      </div>
    );
  }

  const ranges: ("1W" | "1M" | "3M" | "All")[] = ["1W", "1M", "3M", "All"];

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Worth Over Time</h3>
        <span className="text-sm font-display font-bold text-foreground">
          {formatUGX(currentNetWorth / (convertFromUGX(1) || 1))}
        </span>
      </div>

      {/* Range pills */}
      <div className="flex gap-2">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              range === r
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border hover:text-foreground"
            }`}
            style={range !== r ? { borderWidth: '0.5px' } : {}}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={filteredData}>
          <defs>
            <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(263, 83%, 58%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(263, 83%, 58%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: '#555', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => {
              const d = new Date(v);
              return d.toLocaleDateString("en-US", { month: "short" });
            }}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: "hsl(0, 0%, 9%)",
              border: "0.5px solid hsl(0, 0%, 12%)",
              borderRadius: 12,
              color: "hsl(40, 24%, 92%)",
              fontSize: 12,
            }}
            formatter={(v: number) => [formatUGX(v / (convertFromUGX(1) || 1)), "Net Worth"]}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="hsl(263, 83%, 58%)"
            strokeWidth={2}
            fill="url(#violetGradient)"
            dot={false}
            activeDot={{ fill: "white", stroke: "hsl(263, 83%, 58%)", strokeWidth: 2, r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Charts;
