import { useMemo, useState } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  transactions: Transaction[];
}

const getMonthOptions = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    months.push({
      label: format(d, "MMMM yyyy"),
      start: format(startOfMonth(d), "yyyy-MM-dd"),
      end: format(endOfMonth(d), "yyyy-MM-dd"),
    });
  }
  return months;
};

const FinancialStatements = ({ transactions }: Props) => {
  const { formatUGX } = useCurrency();
  const [subTab, setSubTab] = useState<"pnl" | "balance" | "cashflow">("pnl");
  const monthOptions = useMemo(getMonthOptions, []);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const fmt = (n: number) => formatUGX(Math.abs(n));

  const filterThisMonth = (txns: Transaction[]) => {
    const start = monthOptions[0]?.start;
    const end = monthOptions[0]?.end;
    if (!start || !end) return txns;
    return txns.filter((t) => t.date >= start && t.date <= end);
  };

  const filtered = filterThisMonth(transactions);

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // P&L data with individual transactions grouped by category
  const pnlData = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income");
    const expenses = filtered.filter((t) => t.type === "expense");

    const groupByCategory = (txns: Transaction[]) => {
      const map: Record<string, { total: number; items: Transaction[] }> = {};
      txns.forEach((t) => {
        if (!map[t.category]) map[t.category] = { total: 0, items: [] };
        map[t.category].total += t.ugx_amount;
        map[t.category].items.push(t);
      });
      return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    };

    const incomeGroups = groupByCategory(income);
    const expenseGroups = groupByCategory(expenses);
    const totalIncome = income.reduce((s, t) => s + t.ugx_amount, 0);
    const totalExpenses = expenses.reduce((s, t) => s + t.ugx_amount, 0);

    return { incomeGroups, expenseGroups, totalIncome, totalExpenses, profit: totalIncome - totalExpenses };
  }, [filtered]);

  const balanceSheet = useMemo(() => {
    const assets = transactions.filter((t) => t.type === "asset");
    const liabilities = transactions.filter((t) => t.type === "liability");
    const assByCat: Record<string, number> = {};
    const liaByCat: Record<string, number> = {};
    assets.forEach((t) => { assByCat[t.account || t.category] = (assByCat[t.account || t.category] || 0) + t.ugx_amount; });
    liabilities.forEach((t) => { liaByCat[t.account || t.category] = (liaByCat[t.account || t.category] || 0) + t.ugx_amount; });
    const totalAssets = assets.reduce((s, t) => s + t.ugx_amount, 0);
    const totalLiabilities = liabilities.reduce((s, t) => s + t.ugx_amount, 0);
    return { assByCat, liaByCat, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
  }, [transactions]);

  const cashFlow = useMemo(() => {
    const incByCat: Record<string, number> = {};
    const expByCat: Record<string, number> = {};
    const transfers: Record<string, number> = {};
    filtered.forEach((t) => {
      if (t.type === "income") incByCat[t.category] = (incByCat[t.category] || 0) + t.ugx_amount;
      else if (t.type === "expense") expByCat[t.category] = (expByCat[t.category] || 0) + t.ugx_amount;
      else if (t.type.startsWith("transfer")) transfers[t.description] = (transfers[t.description] || 0) + t.ugx_amount;
    });
    const totalIn = Object.values(incByCat).reduce((s, v) => s + v, 0);
    const totalOut = Object.values(expByCat).reduce((s, v) => s + v, 0);
    return { incByCat, expByCat, transfers, netCashFlow: totalIn - totalOut };
  }, [filtered]);

  const subTabs = [
    { key: "pnl" as const, label: "P&L" },
    { key: "balance" as const, label: "Balance Sheet" },
    { key: "cashflow" as const, label: "Cash Flow" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex gap-2">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              subTab === t.key
                ? "bg-primary/15 text-violet-hover border border-primary/30"
                : "text-muted-foreground border border-border hover:text-foreground"
            }`}
            style={{ borderWidth: '0.5px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* P&L with collapsible categories */}
      {subTab === "pnl" && (
        <div className="space-y-3">
          <SectionLabel>Income</SectionLabel>
          {pnlData.incomeGroups.length === 0 && <EmptyRow />}
          {pnlData.incomeGroups.map(([cat, { total, items }]) => (
            <CollapsibleCategory
              key={cat}
              category={cat}
              total={fmt(total)}
              color="text-success"
              items={items}
              expanded={expandedCats.has(`inc-${cat}`)}
              onToggle={() => toggleCat(`inc-${cat}`)}
              formatAmount={fmt}
            />
          ))}
          <TotalRow label="Total Income" amount={fmt(pnlData.totalIncome)} color="text-success" />

          <SectionLabel>Expenses</SectionLabel>
          {pnlData.expenseGroups.length === 0 && <EmptyRow />}
          {pnlData.expenseGroups.map(([cat, { total, items }]) => (
            <CollapsibleCategory
              key={cat}
              category={cat}
              total={fmt(total)}
              color="text-destructive"
              items={items}
              expanded={expandedCats.has(`exp-${cat}`)}
              onToggle={() => toggleCat(`exp-${cat}`)}
              formatAmount={fmt}
            />
          ))}
          <TotalRow label="Total Expenses" amount={fmt(pnlData.totalExpenses)} color="text-destructive" />

          <Divider />
          <div className="flex justify-between items-center">
            <span className="text-base font-display font-bold text-foreground">
              {pnlData.profit >= 0 ? "Net Profit" : "Net Loss"}
            </span>
            <span className="text-base font-display font-bold text-violet-hover">
              {fmt(pnlData.profit)}
            </span>
          </div>
        </div>
      )}

      {/* Balance Sheet */}
      {subTab === "balance" && (
        <div className="space-y-3">
          <SectionLabel>What You Own</SectionLabel>
          {Object.entries(balanceSheet.assByCat).map(([cat, amt]) => (
            <StatRow key={cat} label={cat} amount={fmt(amt)} color="text-violet-hover" />
          ))}
          {Object.keys(balanceSheet.assByCat).length === 0 && <EmptyRow />}
          <TotalRow label="Total Assets" amount={fmt(balanceSheet.totalAssets)} color="text-violet-hover" />

          <SectionLabel>What You Owe</SectionLabel>
          {Object.entries(balanceSheet.liaByCat).map(([cat, amt]) => (
            <StatRow key={cat} label={cat} amount={fmt(amt)} color="text-destructive" />
          ))}
          {Object.keys(balanceSheet.liaByCat).length === 0 && <EmptyRow />}
          <TotalRow label="Total Liabilities" amount={fmt(balanceSheet.totalLiabilities)} color="text-destructive" />

          <Divider />
          <div className="flex justify-between items-center">
            <span className="text-lg font-display font-bold text-foreground">Net Worth</span>
            <span className="text-lg font-display font-bold text-violet-hover">
              {fmt(balanceSheet.netWorth)}
            </span>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {subTab === "cashflow" && (
        <div className="space-y-3">
          <SectionLabel>Money In</SectionLabel>
          {Object.entries(cashFlow.incByCat).map(([cat, amt]) => (
            <StatRow key={cat} label={cat} amount={fmt(amt)} color="text-success" />
          ))}
          {Object.keys(cashFlow.incByCat).length === 0 && <EmptyRow />}

          <SectionLabel>Money Out</SectionLabel>
          {Object.entries(cashFlow.expByCat).map(([cat, amt]) => (
            <StatRow key={cat} label={cat} amount={fmt(amt)} color="text-destructive" />
          ))}
          {Object.keys(cashFlow.expByCat).length === 0 && <EmptyRow />}

          {Object.keys(cashFlow.transfers).length > 0 && (
            <>
              <SectionLabel>Transfers <span className="font-normal">(moved between accounts)</span></SectionLabel>
              {Object.entries(cashFlow.transfers).map(([desc, amt]) => (
                <StatRow key={desc} label={desc} amount={fmt(amt)} color="text-transfer" />
              ))}
            </>
          )}

          <Divider />
          <div className="flex justify-between items-center">
            <span className="text-base font-display font-bold text-foreground">Net Cash Flow</span>
            <span className={`text-base font-display font-bold ${cashFlow.netCashFlow >= 0 ? "text-success" : "text-destructive"}`}>
              {fmt(cashFlow.netCashFlow)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Collapsible category component for P&L
const CollapsibleCategory = ({
  category, total, color, items, expanded, onToggle, formatAmount,
}: {
  category: string; total: string; color: string;
  items: Transaction[]; expanded: boolean;
  onToggle: () => void; formatAmount: (n: number) => string;
}) => (
  <div>
    <button onClick={onToggle} className="w-full flex justify-between items-center py-1.5 hover:bg-card/50 rounded transition-colors -mx-1 px-1">
      <div className="flex items-center gap-1.5">
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span className="text-sm text-foreground">{category}</span>
      </div>
      <span className={`text-sm font-medium ${color}`}>{total}</span>
    </button>
    {expanded && (
      <div className="ml-5 space-y-0.5 pb-1">
        {items.map((t) => (
          <div key={t.id} className="flex justify-between items-center py-1">
            <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{t.description}</span>
            <span className={`text-xs ${color} opacity-80`}>{formatAmount(t.ugx_amount)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pt-2">{children}</p>
);

const StatRow = ({ label, amount, color }: { label: string; amount: string; color: string }) => (
  <div className="flex justify-between items-center py-1.5">
    <span className="text-sm text-foreground">{label}</span>
    <span className={`text-sm font-medium ${color}`}>{amount}</span>
  </div>
);

const TotalRow = ({ label, amount, color }: { label: string; amount: string; color: string }) => (
  <div className="flex justify-between items-center py-1.5 border-t border-border" style={{ borderTopWidth: '0.5px' }}>
    <span className={`text-sm font-bold ${color}`}>{label}</span>
    <span className={`text-sm font-bold ${color}`}>{amount}</span>
  </div>
);

const EmptyRow = () => (
  <p className="text-xs text-muted-foreground py-1">No entries yet</p>
);

const Divider = () => (
  <div className="border-t border-border" style={{ borderTopWidth: '0.5px' }} />
);

export default FinancialStatements;
