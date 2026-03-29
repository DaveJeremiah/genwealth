import { useMemo, useState } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    const netOperating = totalIncome - totalExpenses;

    const financingLoanAsset = filtered.filter(
      (t) =>
        t.type === "asset" &&
        (/Loan received/i.test(t.description) || /Credit used/i.test(t.description))
    );
    const financingLiabilityRepay = filtered.filter((t) => t.type === "liability" && t.ugx_amount < 0);
    const financingRows = [...financingLoanAsset, ...financingLiabilityRepay].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.id.localeCompare(b.id);
    });

    const netFinancing = financingRows.reduce((s, t) => s + t.ugx_amount, 0);
    const netCashPosition = netOperating + netFinancing;

    return {
      incomeGroups,
      expenseGroups,
      totalIncome,
      totalExpenses,
      netOperating,
      financingRows,
      netFinancing,
      netCashPosition,
    };
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
          <SectionLabel>Operating — Money In</SectionLabel>
          {cashFlow.incomeGroups.length === 0 && <EmptyRow />}
          {cashFlow.incomeGroups.map(([cat, { total, items }]) => (
            <CollapsibleCategory
              key={cat}
              category={cat}
              total={fmt(total)}
              color="text-success"
              items={items}
              expanded={expandedCats.has(`cf-inc-${cat}`)}
              onToggle={() => toggleCat(`cf-inc-${cat}`)}
              formatAmount={fmt}
            />
          ))}
          <TotalRow label="Total Income" amount={fmt(cashFlow.totalIncome)} color="text-success" />

          <SectionLabel>Operating — Money Out</SectionLabel>
          {cashFlow.expenseGroups.length === 0 && <EmptyRow />}
          {cashFlow.expenseGroups.map(([cat, { total, items }]) => (
            <CollapsibleCategory
              key={cat}
              category={cat}
              total={fmt(total)}
              color="text-destructive"
              items={items}
              expanded={expandedCats.has(`cf-exp-${cat}`)}
              onToggle={() => toggleCat(`cf-exp-${cat}`)}
              formatAmount={fmt}
            />
          ))}
          <TotalRow label="Total Expenses" amount={fmt(cashFlow.totalExpenses)} color="text-destructive" />

          <div className="flex items-center gap-1.5 pt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Financing</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label="About financing cash flow"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                This section shows money from borrowing and repayments. It&apos;s separate from your income and expenses because borrowed money isn&apos;t earned — it&apos;s owed.
              </TooltipContent>
            </Tooltip>
          </div>
          {cashFlow.financingRows.length === 0 && <EmptyRow />}
          {cashFlow.financingRows.map((t) => {
            const signed = t.ugx_amount;
            const positive = signed > 0;
            return (
              <div key={t.id} className="flex justify-between items-center py-1.5 gap-2">
                <span className="text-sm text-foreground truncate flex-1">{formatFinancingRowLabel(t)}</span>
                <span className={`text-sm font-medium shrink-0 ${positive ? "text-success" : "text-destructive"}`}>
                  {formatUGX(signed)}
                </span>
              </div>
            );
          })}
          {cashFlow.financingRows.length > 0 && (
            <div className="flex justify-between items-center py-1.5 border-t border-border" style={{ borderTopWidth: "0.5px" }}>
              <span className={`text-sm font-bold ${cashFlow.netFinancing >= 0 ? "text-success" : "text-destructive"}`}>
                Net Financing
              </span>
              <span className={`text-sm font-bold ${cashFlow.netFinancing >= 0 ? "text-success" : "text-destructive"}`}>
                {formatUGX(cashFlow.netFinancing)}
              </span>
            </div>
          )}

          <Divider />
          <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3" style={{ borderWidth: "0.5px" }}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-base font-display font-bold text-foreground">Net Operating Cash</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Income minus expenses</p>
              </div>
              <span
                className={`text-base font-display font-bold shrink-0 ${cashFlow.netOperating >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatUGX(cashFlow.netOperating)}
              </span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-base font-display font-bold text-foreground">Net Financing</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Loans received minus repayments</p>
              </div>
              <span
                className={`text-base font-display font-bold shrink-0 ${cashFlow.netFinancing >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatUGX(cashFlow.netFinancing)}
              </span>
            </div>
            <Divider />
            <div className="flex justify-between items-center">
              <span className="text-lg font-display font-bold text-foreground">Net Cash Position</span>
              <span
                className={`text-lg font-display font-bold ${cashFlow.netCashPosition >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatUGX(cashFlow.netCashPosition)}
              </span>
            </div>
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

/** Maps stored liability repayment descriptions to Cash Flow financing labels. */
function formatFinancingRowLabel(t: Transaction): string {
  const d = t.description;
  if (t.type === "liability" && t.ugx_amount < 0) {
    if (/^Loan balance reduced\s*—\s*/i.test(d)) {
      return d.replace(/^Loan balance reduced\s*—\s*/i, "Loan repayment — ");
    }
    if (/^Debt balance reduced\s*—\s*/i.test(d)) {
      return d.replace(/^Debt balance reduced\s*—\s*/i, "Debt settled — ");
    }
  }
  return d;
}

export default FinancialStatements;
