import { useState } from "react";
import { Transaction, useTransactions } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const TransactionLog = () => {
  const { data: transactions = [], deleteTransaction } = useTransactions();
  const { format: fmtCurrency } = useCurrency();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = [...new Set(transactions.map((t) => t.category))].sort();
  const filtered = transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">Transaction Log</h3>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] bg-secondary border-border text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="liability">Liability</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] bg-secondary border-border text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No transactions found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-left py-2 font-medium">Description</th>
                <th className="text-left py-2 font-medium">Amount</th>
                <th className="text-left py-2 font-medium hidden sm:table-cell">Type</th>
                <th className="text-left py-2 font-medium hidden md:table-cell">Category</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 text-muted-foreground">{t.date}</td>
                  <td className="py-2.5 text-foreground">{t.description}</td>
                  <td className={`py-2.5 font-medium ${t.type === "income" || t.type === "asset" ? "text-primary" : "text-destructive"}`}>
                    {fmtCurrency(t.amount, t.currency, { sign: t.type === "income" || t.type === "asset" })}
                  </td>
                  <td className="py-2.5 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.type === "income" || t.type === "asset" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="py-2.5 text-muted-foreground hidden md:table-cell">{t.category}</td>
                  <td className="py-2.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTransaction.mutate(t.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransactionLog;
