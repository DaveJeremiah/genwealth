import { useMemo, useState, useEffect } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { startOfMonth, endOfMonth, format, subMonths, addMonths } from "date-fns";
import { ChevronDown, ChevronRight, ChevronLeft, Info } from "lucide-react";
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

const isLoanReceived = (t: Transaction) =>
  t.type === "asset" && /loan received/i.test(t.description);

const isLoanRepayment = (t: Transaction) =>
  t.type === "transfer-out" && /loan repayment/i.test(t.description);

const getCashImpact = (t: Transaction): number => {
  const amt = Math.abs(Number(t.ugx_amount) || 0);
  if (t.type === "income") return amt;
  if (t.type === "expense") return -amt;
  if (isLoanReceived(t)) return amt;
  if (isLoanRepayment(t)) return -amt;
  // All other types (asset, liability, transfer-in, transfer-out not matching above) are ignored
  return 0;
};

const calculateOpeningBalance = (txns: Transaction[], upToDate: string) => {
  return txns
    .filter(t => t.date < upToDate)
    .reduce((bal, t) => bal + getCashImpact(t), 0);
};

const FinancialStatements = ({ transactions }: Props) => {
  const { formatUGX } = useCurrency();
  const [subTab, setSubTab] = useState<"pnl" | "balance" | "cashflow">("pnl");
  const monthOptions = useMemo(getMonthOptions, []);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const fmt = (n: number) => formatUGX(Math.abs(n));

  const filterSelectedMonth = (txns: Transaction[]) => {
    const start = monthOptions[selectedMonthIndex]?.start;
    const end = monthOptions[selectedMonthIndex]?.end;
    if (!start || !end) return txns;
    return txns.filter((t) => t.date >= start && t.date <= end);
  };

  const filtered = filterSelectedMonth(transactions);
  const monthStart = monthOptions[selectedMonthIndex]?.start;
  const monthEnd = monthOptions[selectedMonthIndex]?.end;

  const sumByAccount = (txns: Transaction[]) => {
    const map: Record<string, number> = {};
    txns.forEach((t) => {
      const key = (t.account || t.category || "Other").trim();
      map[key] = (map[key] || 0) + t.ugx_amount;
    });
    return map;
  };

  const mergeKeys = (a: Record<string, number>, b: Record<string, number>) =>
    Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort((x, y) => x.localeCompare(y));

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
    const start = monthStart;
    const end = monthEnd;
    if (!start || !end) {
      return {
        openingAssetsByAccount: {},
        openingLiabilitiesByAccount: {},
        closingAssetsByAccount: {},
        closingLiabilitiesByAccount: {},
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
      };
    }

    const assetsBefore = transactions.filter((t) => t.type === "asset" && t.date < start);
    const liabilitiesBefore = transactions.filter((t) => t.type === "liability" && t.date < start);
    const assetsInMonth = transactions.filter((t) => t.type === "asset" && t.date >= start && t.date <= end);
    const liabilitiesInMonth = transactions.filter((t) => t.type === "liability" && t.date >= start && t.date <= end);

    const openingAssetsByAccount = sumByAccount(assetsBefore);
    const openingLiabilitiesByAccount = sumByAccount(liabilitiesBefore);
    const deltaAssetsByAccount = sumByAccount(assetsInMonth);
    const deltaLiabilitiesByAccount = sumByAccount(liabilitiesInMonth);

    const closingAssetsByAccount: Record<string, number> = {};
    const closingLiabilitiesByAccount: Record<string, number> = {};
    mergeKeys(openingAssetsByAccount, deltaAssetsByAccount).forEach((k) => {
      closingAssetsByAccount[k] = (openingAssetsByAccount[k] || 0) + (deltaAssetsByAccount[k] || 0);
    });
    mergeKeys(openingLiabilitiesByAccount, deltaLiabilitiesByAccount).forEach((k) => {
      closingLiabilitiesByAccount[k] = (openingLiabilitiesByAccount[k] || 0) + (deltaLiabilitiesByAccount[k] || 0);
    });

    const totalAssets = Object.values(closingAssetsByAccount).reduce((s, n) => s + n, 0);
    const totalLiabilities = Object.values(closingLiabilitiesByAccount).reduce((s, n) => s + n, 0);

    return {
      openingAssetsByAccount,
      openingLiabilitiesByAccount,
      closingAssetsByAccount,
      closingLiabilitiesByAccount,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    };
  }, [transactions, monthStart, monthEnd]);

  const cashFlow = useMemo(() => {
    // Money In: strictly income only
    const moneyIn = filtered.filter(t =>
      t.type === "income" &&
      !isLoanReceived(t) &&
      !/loan received/i.test(t.description)
    );
    // Money Out: strictly expense only
    const moneyOut = filtered.filter(t =>
      t.type === "expense" &&
      !isLoanRepayment(t) &&
      !/loan repayment/i.test(t.description)
    );
    // Loans & Repayments
    const loansReceived = filtered.filter(isLoanReceived);
    const loanRepayments = filtered.filter(isLoanRepayment);

    const groupByCategory = (txns: Transaction[]) => {
      const map: Record<string, { total: number; items: Transaction[] }> = {};
      txns.forEach((t) => {
        if (!map[t.category]) map[t.category] = { total: 0, items: [] };
        map[t.category].total += t.ugx_amount;
        map[t.category].items.push(t);
      });
      return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    };

    const incomeGroups = groupByCategory(moneyIn);
    const expenseGroups = groupByCategory(moneyOut);
    const totalIncome = moneyIn.reduce((s, t) => s + t.ugx_amount, 0);
    const totalExpenses = moneyOut.reduce((s, t) => s + t.ugx_amount, 0);
    const netCashPosition = totalIncome - totalExpenses;

    const totalLoansReceived = loansReceived.reduce((s, t) => s + Math.abs(t.ugx_amount), 0);
    const totalLoanRepayments = loanRepayments.reduce((s, t) => s + Math.abs(t.ugx_amount), 0);
    const netLoans = totalLoansReceived - totalLoanRepayments;

    const financingRows = [...loansReceived.map(t => ({ ...t, ugx_amount: Math.abs(t.ugx_amount) })),
      ...loanRepayments.map(t => ({ ...t, ugx_amount: -Math.abs(t.ugx_amount) }))
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    return {
      incomeGroups,
      expenseGroups,
      totalIncome,
      totalExpenses,
      netCashPosition,
      financingRows,
      totalLoansReceived,
      totalLoanRepayments,
      netLoans,
    };
  }, [filtered]);

  const ytdPnl = useMemo(() => {
    if (!monthStart || !monthEnd) return { income: 0, expense: 0, net: 0, savingsRate: 0 };
    const yearStart = `${monthStart.slice(0, 4)}-01-01`;
    const ytdTxns = transactions.filter(t => t.date >= yearStart && t.date <= monthEnd);
    const ytdIncome = ytdTxns.filter(t => t.type === "income").reduce((s, t) => s + t.ugx_amount, 0);
    const ytdExpense = ytdTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.ugx_amount, 0);
    const ytdNet = ytdIncome - ytdExpense;
    const savingsRate = ytdIncome > 0 ? ((ytdIncome - ytdExpense) / ytdIncome) * 100 : 0;
    return { income: ytdIncome, expense: ytdExpense, net: ytdNet, savingsRate };
  }, [transactions, monthStart, monthEnd]);

  const cfOpeningBalance = useMemo(() => {
    if (!monthStart) return 0;
    return calculateOpeningBalance(transactions, monthStart);
  }, [transactions, monthStart]);

  useEffect(() => {
    if (!transactions || transactions.length === 0) return;
    
    console.log("--- Cash Flow Continuity Validation ---");
    const chronologicalMonths = [...monthOptions].reverse();
    
    for (let i = 1; i < chronologicalMonths.length; i++) {
        const prevMonth = chronologicalMonths[i-1];
        const currMonth = chronologicalMonths[i];
        
        const prevOpen = calculateOpeningBalance(transactions, prevMonth.start);
        const prevClose = calculateClosingBalance(transactions, prevMonth.start, prevMonth.end, prevOpen);
        const currOpen = calculateOpeningBalance(transactions, currMonth.start);
        
        if (Math.abs(prevClose - currOpen) > 0.01) {
            console.error(`Discrepancy found! Prev Month (${prevMonth.label}) Closing: ${prevClose} | Curr Month (${currMonth.label}) Opening: ${currOpen}. Diff: ${currOpen - prevClose}`);
        } else {
            console.log(`Verified continuity from ${prevMonth.label} to ${currMonth.label}`);
        }
    }
    console.log("--- Validation Complete ---");
  }, [transactions, monthOptions]);

  const nextMonthName = useMemo(() => {
    if (!monthStart) return "";
    const [y, m, d] = monthStart.split('-');
    return format(addMonths(new Date(Number(y), Number(m) - 1, Number(d)), 1), "MMMM");
  }, [monthStart]);

  const subTabs = [
    { key: "pnl" as const, label: "P&L" },
    { key: "balance" as const, label: "Balance Sheet" },
    { key: "cashflow" as const, label: "Cash Flow" },
  ];

  return (
    <div className="space-y-4">
      {/* Month selector (similar to Entries) */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedMonthIndex((i) => Math.min(monthOptions.length - 1, i + 1))}
          className="p-2 rounded-full hover:bg-card transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium text-foreground">
          {monthOptions[selectedMonthIndex]?.label || "This month"}
        </span>
        <button
          onClick={() => setSelectedMonthIndex((i) => Math.max(0, i - 1))}
          className="p-2 rounded-full hover:bg-card transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

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

          <Divider />
          <div className="pt-1 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Year to Date</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Cumulative Net (YTD)</span>
              <span className={`text-sm font-medium ${ytdPnl.net >= 0 ? "text-success" : "text-destructive"}`}>
                {formatUGX(ytdPnl.net)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Savings Rate (YTD)</span>
              <span className="text-sm font-medium text-muted-foreground">
                {Math.round(ytdPnl.savingsRate)}% of income saved this year.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet */}
      {subTab === "balance" && (
        <div className="space-y-3">
          <SectionLabel>What You Own</SectionLabel>
          {Object.entries(balanceSheet.closingAssetsByAccount).map(([cat, closing]) => (
            <div key={cat} className="space-y-0.5">
              <StatRow label={cat} amount={fmt(closing)} color="text-violet-hover" />
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Opening</span>
                <span>{fmt(balanceSheet.openingAssetsByAccount[cat] || 0)}</span>
              </div>
            </div>
          ))}
          {Object.keys(balanceSheet.closingAssetsByAccount).length === 0 && <EmptyRow />}
          <TotalRow label="Total Assets" amount={fmt(balanceSheet.totalAssets)} color="text-violet-hover" />

          <SectionLabel>What You Owe</SectionLabel>
          {Object.entries(balanceSheet.closingLiabilitiesByAccount).map(([cat, closing]) => (
            <div key={cat} className="space-y-0.5">
              <StatRow label={cat} amount={fmt(closing)} color="text-destructive" />
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Opening</span>
                <span>{fmt(balanceSheet.openingLiabilitiesByAccount[cat] || 0)}</span>
              </div>
            </div>
          ))}
          {Object.keys(balanceSheet.closingLiabilitiesByAccount).length === 0 && <EmptyRow />}
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
          <div className="flex items-center justify-between pb-2 border-b border-border mb-1 mt-1" style={{ borderBottomWidth: "0.5px" }}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[#F0EDE6]">Opening Balance</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="About opening balance"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                  This is what you started the month with. Your P&L shows how you performed this month. Your closing balance shows what you&apos;re carrying forward.
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-medium text-[#F0EDE6]">{formatUGX(cfOpeningBalance)}</span>
          </div>

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

          <div className="py-2">
            <div className="flex justify-between items-center">
              <span className="text-[20px] font-display font-bold text-[#9D5FF0]">Closing Balance</span>
              <span className="text-[20px] font-display font-bold text-[#9D5FF0]">
                {formatUGX(cfOpeningBalance + cashFlow.netCashPosition)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">
              This carries into {nextMonthName}.
            </p>
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
