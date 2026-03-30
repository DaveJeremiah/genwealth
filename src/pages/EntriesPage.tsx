import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight, MoreVertical, CalendarIcon } from "lucide-react";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HamburgerMenu } from "@/components/HamburgerMenu";

const CATEGORY_EMOJIS: Record<string, string> = {
  Housing: "🏠", "Food & Dining": "🍽️", Transport: "🚗", Entertainment: "🎬",
  Health: "💊", Shopping: "🛍️", Utilities: "⚡", Investments: "📈",
  Crypto: "₿", Property: "🏗️", Salary: "💰", Freelance: "💻",
  Business: "🏢", Savings: "🐷", Transfer: "↔️", Other: "📌",
};

const TYPE_FILTERS = ["All", "Income", "Expense", "Transfer", "Asset", "Liability"] as const;
const CATEGORIES = [
  "All", "Housing", "Food & Dining", "Transport", "Health", "Entertainment",
  "Shopping", "Investments", "Crypto", "Property", "Salary", "Freelance",
  "Business", "Savings", "Other",
];
const CURRENCY_OPTIONS = ["UGX", "USD", "EUR", "GBP", "KES"];
const TYPE_OPTIONS = ["income", "expense", "transfer-in", "transfer-out", "asset", "liability"];
const ACCOUNT_OPTIONS = ["Cash", "Bank", "Mobile Money", "Investments", "Crypto", "Property", "Other"];

const EntriesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: transactions = [], updateTransaction, deleteTransaction } = useTransactions();
  const { formatUGX, convertFromUGX } = useCurrency();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set(["All"]));

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit form state
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("UGX");
  const [editType, setEditType] = useState("expense");
  const [editCategory, setEditCategory] = useState("Other");
  const [editAccount, setEditAccount] = useState("Cash");
  const [editDate, setEditDate] = useState<Date | undefined>(new Date());

  const openEdit = (t: Transaction) => {
    setEditingTx(t);
    setEditDesc(t.description);
    setEditAmount(String(t.amount));
    setEditCurrency(t.currency);
    setEditType(t.type);
    setEditCategory(t.category);
    setEditAccount(t.account);
    setEditDate(new Date(t.date));
  };

  const handleSaveEdit = () => {
    if (!editingTx) return;
    updateTransaction.mutate({
      id: editingTx.id,
      description: editDesc,
      amount: parseFloat(editAmount) || 0,
      currency: editCurrency,
      ugx_amount: editCurrency === "UGX" ? parseFloat(editAmount) || 0 : (parseFloat(editAmount) || 0) * 3700,
      type: editType,
      category: editCategory,
      account: editAccount,
      date: editDate ? format(editDate, "yyyy-MM-dd") : editingTx.date,
    });
    setEditingTx(null);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteTransaction.mutate(deletingId);
    setDeletingId(null);
  };

  const toggleCategory = (cat: string) => {
    if (cat === "All") {
      setCategoryFilters(new Set(["All"]));
      return;
    }
    const next = new Set(categoryFilters);
    next.delete("All");
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    if (next.size === 0) next.add("All");
    setCategoryFilters(next);
  };

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (t.date < monthStart || t.date > monthEnd) return false;
      if (typeFilter !== "All" && !t.type.toLowerCase().startsWith(typeFilter.toLowerCase())) return false;
      if (!categoryFilters.has("All") && !categoryFilters.has(t.category)) return false;
      return true;
    });
  }, [transactions, monthStart, monthEnd, typeFilter, categoryFilters]);

  const summary = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.ugx_amount, 0);
    const expenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.ugx_amount, 0);
    return { income, expenses, net: income - expenses };
  }, [filtered]);

  const getAmountColor = (type: string) => {
    if (type === "income") return "text-success";
    if (type === "expense") return "text-destructive";
    if (type.startsWith("transfer")) return "text-transfer";
    return "text-violet-hover";
  };

  return (
    <div className="min-h-svh bg-background font-body">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <HamburgerMenu />
        <button onClick={() => navigate("/")} className="p-1.5 rounded-full hover:bg-card transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Entries</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-8 space-y-4">
        {/* Month selector */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-card transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium text-foreground">{format(currentMonth, "MMMM yyyy")}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-card transition-colors">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Type filter pills */}
        <div className="flex gap-2 flex-wrap">
          {TYPE_FILTERS.map((tf) => (
            <button
              key={tf}
              onClick={() => setTypeFilter(tf)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                typeFilter === tf
                  ? "bg-primary/15 text-violet-hover border border-primary/30"
                  : "text-muted-foreground border border-border hover:text-foreground"
              }`}
              style={{ borderWidth: "0.5px" }}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                categoryFilters.has(cat)
                  ? "bg-primary/15 text-violet-hover border border-primary/30"
                  : "text-muted-foreground border border-border hover:text-foreground"
              }`}
              style={{ borderWidth: "0.5px" }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Transaction list */}
        <div className="space-y-0">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No entries for this month.</p>
          )}
          {filtered.map((t, i) => (
            <div key={t.id}>
              <div className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-lg bg-card flex items-center justify-center text-base border border-border">
                  {CATEGORY_EMOJIS[t.category] || "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.date} · {t.category}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${getAmountColor(t.type)}`}>
                    {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}
                    {t.amount.toLocaleString()} {t.currency}
                  </p>
                  {t.currency !== "UGX" && (
                    <p className="text-[10px] text-muted-foreground">≈ {formatUGX(t.ugx_amount)}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded hover:bg-card transition-colors">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border">
                    <DropdownMenuItem onClick={() => openEdit(t)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeletingId(t.id)} className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {i < filtered.length - 1 && <div className="border-b border-border" style={{ borderBottomWidth: "0.5px" }} />}
            </div>
          ))}
        </div>

        {/* Summary */}
        {filtered.length > 0 && (
          <div className="glass-card rounded-2xl p-4 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Income</span>
              <span className="text-success font-medium">{formatUGX(summary.income)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Expenses</span>
              <span className="text-destructive font-medium">{formatUGX(summary.expenses)}</span>
            </div>
            <div className="border-t border-border pt-1" style={{ borderTopWidth: "0.5px" }}>
              <div className="flex justify-between text-xs">
                <span className="text-foreground font-semibold">Net</span>
                <span className={`font-semibold ${summary.net >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatUGX(summary.net)}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent className="bg-card border-border max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="bg-background border-border mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="bg-background border-border mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <Select value={editCurrency} onValueChange={setEditCurrency}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CATEGORIES.filter((c) => c !== "All").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Account</label>
                <Select value={editAccount} onValueChange={setEditAccount}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {ACCOUNT_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background border-border mt-1", !editDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDate ? format(editDate, "PP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                    <Calendar mode="single" selected={editDate} onSelect={setEditDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingTx(null)} className="border-border">Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-primary text-primary-foreground hover:bg-violet-hover">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EntriesPage;
