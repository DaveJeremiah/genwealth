import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Transaction, useTransactions } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Trash2, Pencil, Check, X, CalendarIcon, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const TransactionLog = () => {
  const { data: transactions = [], deleteTransaction, updateTransaction } = useTransactions();
  const { format: fmtCurrency } = useCurrency();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Transaction>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);

  const categories = [...new Set(transactions.map((t) => t.category))].sort();
  const filtered = transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  // Apply manual ordering if set
  const displayList = orderedIds
    ? orderedIds.map((id) => filtered.find((t) => t.id === id)).filter(Boolean) as Transaction[]
    : filtered;

  const startEdit = (t: Transaction) => {
    setEditId(t.id);
    setEditFields({ description: t.description, amount: t.amount, date: t.date, category: t.category, type: t.type });
  };

  const cancelEdit = () => { setEditId(null); setEditFields({}); };

  const saveEdit = () => {
    if (!editId) return;
    updateTransaction.mutate({ id: editId, ...editFields });
    setEditId(null);
    setEditFields({});
  };

  // Drag and drop reorder
  const handleDragStart = (id: string) => {
    setDragId(id);
    if (!orderedIds) setOrderedIds(displayList.map((t) => t.id));
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId || !orderedIds) return;
    const ids = [...orderedIds];
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    setOrderedIds(ids);
  };

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-semibold font-mono">Transaction Log</h3>
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
                <th className="w-8"></th>
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-left py-2 font-medium">Description</th>
                <th className="text-left py-2 font-medium">Amount</th>
                <th className="text-left py-2 font-medium hidden sm:table-cell">Type</th>
                <th className="text-left py-2 font-medium hidden md:table-cell">Category</th>
                <th className="py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((t) => (
                <tr
                  key={t.id}
                  draggable
                  onDragStart={() => handleDragStart(t.id)}
                  onDragOver={(e) => handleDragOver(e, t.id)}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    "border-b border-border/50 hover:bg-secondary/50 transition-colors",
                    dragId === t.id && "opacity-50"
                  )}
                >
                  <td className="py-2.5">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab" />
                  </td>

                  {editId === t.id ? (
                    <>
                      <td className="py-2.5">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 bg-secondary border-border">
                              <CalendarIcon className="w-3 h-3" />
                              {editFields.date ? format(parseISO(editFields.date), "MMM d, yyyy") : "Pick date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={editFields.date ? parseISO(editFields.date) : undefined}
                              onSelect={(d) => d && setEditFields({ ...editFields, date: format(d, "yyyy-MM-dd") })}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="py-2.5">
                        <Input
                          value={editFields.description ?? ""}
                          onChange={(e) => setEditFields({ ...editFields, description: e.target.value })}
                          className="h-8 text-xs bg-secondary border-border"
                        />
                      </td>
                      <td className="py-2.5">
                        <Input
                          type="number"
                          value={editFields.amount ?? ""}
                          onChange={(e) => setEditFields({ ...editFields, amount: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs w-24 bg-secondary border-border"
                        />
                      </td>
                      <td className="py-2.5 hidden sm:table-cell">
                        <Select value={editFields.type ?? t.type} onValueChange={(v) => setEditFields({ ...editFields, type: v })}>
                          <SelectTrigger className="h-8 text-xs bg-secondary border-border w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="asset">Asset</SelectItem>
                            <SelectItem value="liability">Liability</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2.5 hidden md:table-cell">
                        <Input
                          value={editFields.category ?? ""}
                          onChange={(e) => setEditFields({ ...editFields, category: e.target.value })}
                          className="h-8 text-xs w-24 bg-secondary border-border"
                        />
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={saveEdit}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
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
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(t)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTransaction.mutate(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
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
