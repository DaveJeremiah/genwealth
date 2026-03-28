import { useMemo, useState } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";

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

  const fmt = (n: number) => formatUGX(Math.abs(n));

  const filterThisMonth = (txns: Transaction[]) => {
    const start = monthOptions[0]?.start;
    const end = monthOptions[0]?.end;
    if (!start || !end) return txns;
    return txns.filter((t) => t.date >= start && t.date <= end);
  };

  const filtered = filterThisMonth(transactions);

  const incomeStatement = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income");
    const expenses = filtered.filter((t) => t.type === "expense");
    const incByCat: Record<string, number> = {};
    const expByCat: Record<string, number> = {};
    income.forEach((t) => { incByCat[t.category] = (incByCat[t.category] || 0) + t.ugx_amount; });
    expenses.forEach((t) => { expByCat[t.category] = (expByCat[t.category] || 0) + t.ugx_amount; });
    const totalIncome = income.reduce((s, t) => s + t.ugx_amount, 0);
    const totalExpenses = expenses.reduce((s, t) => s + t.ugx_amount, 0);
    return { incByCat, expByCat, totalIncome, totalExpenses, profit: totalIncome - totalExpenses };
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

      {/* P&L */}
      {subTab === "pnl" && (
        <div className="space-y-3">
          <SectionLabel>Income</SectionLabel>
          {Object.entries(incomeStatement.incByCat).map(([cat, amt]) => (
            <StatRow key={cat} label={cat} amount={fmt(amt)} color="text-success" />
          ))}
          {Object.keys(incomeStatement.incByCat).length === 0 && <EmptyRow />}
          <TotalRow label="Total Income" amount={fmt(incomeStatement.totalIncome)} color="text-success" />

          <SectionLabel>Expenses</SectionLabel>
          {Object.entries(incomeStatement.expByCat).map(([cat, amt]) => (
            <StatRow key={cat} label={cat} amount={fmt(amt)} color="text-destructive" />
          ))}
          {Object.keys(incomeStatement.expByCat).length === 0 && <EmptyRow />}
          <TotalRow label="Total Expenses" amount={fmt(incomeStatement.totalExpenses)} color="text-destructive" />

          <Divider />
          <div className="flex justify-between items-center">
            <span className="text-base font-display font-bold text-foreground">
              {incomeStatement.profit >= 0 ? "Net Profit" : "Net Loss"}
            </span>
            <span className="text-base font-display font-bold text-violet-hover">
              {fmt(incomeStatement.profit)}
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
