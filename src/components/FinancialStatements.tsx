import { useMemo } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  transactions: Transaction[];
}

const FinancialStatements = ({ transactions }: Props) => {
  const fmt = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const balanceSheet = useMemo(() => {
    const assets = transactions.filter((t) => t.type === "asset");
    const liabilities = transactions.filter((t) => t.type === "liability");
    const totalAssets = assets.reduce((s, t) => s + t.amount, 0);
    const totalLiabilities = liabilities.reduce((s, t) => s + t.amount, 0);
    return { assets, liabilities, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
  }, [transactions]);

  const incomeStatement = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income");
    const expenses = transactions.filter((t) => t.type === "expense");
    const totalIncome = income.reduce((s, t) => s + t.amount, 0);
    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
    return { income, expenses, totalIncome, totalExpenses, profit: totalIncome - totalExpenses };
  }, [transactions]);

  const cashFlow = useMemo(() => {
    const byCategory: Record<string, { inflow: number; outflow: number }> = {};
    transactions.forEach((t) => {
      if (!byCategory[t.category]) byCategory[t.category] = { inflow: 0, outflow: 0 };
      if (t.type === "income") byCategory[t.category].inflow += t.amount;
      else if (t.type === "expense") byCategory[t.category].outflow += t.amount;
    });
    return byCategory;
  }, [transactions]);

  return (
    <Tabs defaultValue="balance" className="glass-card rounded-xl p-5">
      <TabsList className="bg-secondary border border-border mb-4">
        <TabsTrigger value="balance" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Balance Sheet</TabsTrigger>
        <TabsTrigger value="income" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Income Statement</TabsTrigger>
        <TabsTrigger value="cashflow" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Cash Flow</TabsTrigger>
      </TabsList>

      <TabsContent value="balance" className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Balance Sheet</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-primary">What You Own (Assets)</h4>
            {balanceSheet.assets.length === 0 && <p className="text-xs text-muted-foreground">No assets recorded yet</p>}
            {balanceSheet.assets.map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span className="text-foreground">{a.description}</span>
                <span className="text-foreground font-medium">{fmt(a.amount)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
              <span className="text-primary">Total Assets</span>
              <span className="text-primary">{fmt(balanceSheet.totalAssets)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-destructive">What You Owe (Liabilities)</h4>
            {balanceSheet.liabilities.length === 0 && <p className="text-xs text-muted-foreground">No liabilities recorded yet</p>}
            {balanceSheet.liabilities.map((l) => (
              <div key={l.id} className="flex justify-between text-sm">
                <span className="text-foreground">{l.description}</span>
                <span className="text-foreground font-medium">{fmt(l.amount)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
              <span className="text-destructive">Total Liabilities</span>
              <span className="text-destructive">{fmt(balanceSheet.totalLiabilities)}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-3 flex justify-between text-lg font-display font-bold">
          <span>Net Worth</span>
          <span className={balanceSheet.netWorth >= 0 ? "text-primary" : "text-destructive"}>{fmt(balanceSheet.netWorth)}</span>
        </div>
      </TabsContent>

      <TabsContent value="income" className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Income Statement (P&L)</h3>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-primary">Revenue</h4>
          {incomeStatement.income.map((i) => (
            <div key={i.id} className="flex justify-between text-sm">
              <span className="text-foreground">{i.description}</span>
              <span className="text-foreground">{fmt(i.amount)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-primary">
            <span>Total Income</span><span>{fmt(incomeStatement.totalIncome)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-destructive">Expenses</h4>
          {incomeStatement.expenses.map((e) => (
            <div key={e.id} className="flex justify-between text-sm">
              <span className="text-foreground">{e.description}</span>
              <span className="text-foreground">{fmt(e.amount)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-destructive">
            <span>Total Expenses</span><span>{fmt(incomeStatement.totalExpenses)}</span>
          </div>
        </div>
        <div className="border-t border-border pt-3 flex justify-between text-lg font-display font-bold">
          <span>{incomeStatement.profit >= 0 ? "Profit" : "Loss"}</span>
          <span className={incomeStatement.profit >= 0 ? "text-primary" : "text-destructive"}>{fmt(incomeStatement.profit)}</span>
        </div>
      </TabsContent>

      <TabsContent value="cashflow" className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Cash Flow Statement</h3>
        <div className="space-y-2">
          {Object.entries(cashFlow).map(([cat, vals]) => (
            <div key={cat} className="flex justify-between text-sm py-1 border-b border-border/50">
              <span className="text-foreground">{cat}</span>
              <div className="flex gap-4">
                {vals.inflow > 0 && <span className="text-primary">+{fmt(vals.inflow)}</span>}
                {vals.outflow > 0 && <span className="text-destructive">-{fmt(vals.outflow)}</span>}
              </div>
            </div>
          ))}
          {Object.keys(cashFlow).length === 0 && <p className="text-sm text-muted-foreground">No cash flow data yet</p>}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default FinancialStatements;
