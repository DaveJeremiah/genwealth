import { useMemo, useState } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO, subWeeks, subMonths } from "date-fns";

interface Props {
  transactions: Transaction[];
}

const getWeekOptions = () => {
  const weeks = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subWeeks(now, i);
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    weeks.push({
      label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    });
  }
  return weeks;
};

const getMonthOptions = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    months.push({
      label: format(d, "MMMM yyyy"),
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    });
  }
  return months;
};

const FinancialStatements = ({ transactions }: Props) => {
  const fmt = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const weekOptions = useMemo(getWeekOptions, []);
  const monthOptions = useMemo(getMonthOptions, []);

  const [balanceWeek, setBalanceWeek] = useState(weekOptions[0]?.start + "|" + weekOptions[0]?.end || "");
  const [cashFlowWeek, setCashFlowWeek] = useState(weekOptions[0]?.start + "|" + weekOptions[0]?.end || "");
  const [incomeMonth, setIncomeMonth] = useState(monthOptions[0]?.start + "|" + monthOptions[0]?.end || "");

  const filterByRange = (txns: Transaction[], range: string) => {
    if (!range) return txns;
    const [start, end] = range.split("|");
    return txns.filter((t) => t.date >= start && t.date <= end);
  };

  const balanceSheet = useMemo(() => {
    const filtered = filterByRange(transactions, balanceWeek);
    const assets = filtered.filter((t) => t.type === "asset");
    const liabilities = filtered.filter((t) => t.type === "liability");
    const totalAssets = assets.reduce((s, t) => s + t.amount, 0);
    const totalLiabilities = liabilities.reduce((s, t) => s + t.amount, 0);
    return { assets, liabilities, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
  }, [transactions, balanceWeek]);

  const incomeStatement = useMemo(() => {
    const filtered = filterByRange(transactions, incomeMonth);
    const income = filtered.filter((t) => t.type === "income");
    const expenses = filtered.filter((t) => t.type === "expense");
    const totalIncome = income.reduce((s, t) => s + t.amount, 0);
    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
    return { income, expenses, totalIncome, totalExpenses, profit: totalIncome - totalExpenses };
  }, [transactions, incomeMonth]);

  const cashFlow = useMemo(() => {
    const filtered = filterByRange(transactions, cashFlowWeek);
    const byCategory: Record<string, { inflow: number; outflow: number }> = {};
    filtered.forEach((t) => {
      if (!byCategory[t.category]) byCategory[t.category] = { inflow: 0, outflow: 0 };
      if (t.type === "income") byCategory[t.category].inflow += t.amount;
      else if (t.type === "expense") byCategory[t.category].outflow += t.amount;
    });
    return byCategory;
  }, [transactions, cashFlowWeek]);

  const PeriodSelector = ({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { label: string; start: string; end: string }[]; label: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] bg-secondary border-border text-xs h-8">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {options.map((o) => (
          <SelectItem key={o.start + o.end} value={o.start + "|" + o.end} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Tabs defaultValue="balance" className="glass-card rounded-xl p-5">
      <TabsList className="bg-secondary border border-border mb-4">
        <TabsTrigger value="balance" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Balance Sheet</TabsTrigger>
        <TabsTrigger value="income" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">P&L</TabsTrigger>
        <TabsTrigger value="cashflow" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Cash Flow</TabsTrigger>
      </TabsList>

      <TabsContent value="balance" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display text-lg font-semibold">Balance Sheet</h3>
          <PeriodSelector value={balanceWeek} onChange={setBalanceWeek} options={weekOptions} label="Select week" />
        </div>
        <p className="text-xs text-muted-foreground">Weekly snapshot</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-primary">What You Own (Assets)</h4>
            {balanceSheet.assets.length === 0 && <p className="text-xs text-muted-foreground">No assets this week</p>}
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
            {balanceSheet.liabilities.length === 0 && <p className="text-xs text-muted-foreground">No liabilities this week</p>}
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display text-lg font-semibold">Income Statement (P&L)</h3>
          <PeriodSelector value={incomeMonth} onChange={setIncomeMonth} options={monthOptions} label="Select month" />
        </div>
        <p className="text-xs text-muted-foreground">Monthly calculation</p>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-primary">Revenue</h4>
          {incomeStatement.income.length === 0 && <p className="text-xs text-muted-foreground">No income this month</p>}
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
          {incomeStatement.expenses.length === 0 && <p className="text-xs text-muted-foreground">No expenses this month</p>}
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display text-lg font-semibold">Cash Flow Statement</h3>
          <PeriodSelector value={cashFlowWeek} onChange={setCashFlowWeek} options={weekOptions} label="Select week" />
        </div>
        <p className="text-xs text-muted-foreground">Weekly calculation</p>
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
          {Object.keys(cashFlow).length === 0 && <p className="text-sm text-muted-foreground">No cash flow data this week</p>}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default FinancialStatements;
