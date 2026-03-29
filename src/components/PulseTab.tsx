import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Transaction, useTransactions } from "@/hooks/useTransactions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import Charts from "@/components/Charts";
import WealthAnalysis from "@/components/WealthAnalysis";
import {
  ChevronDown, ChevronRight, MoreVertical, Plus, CalendarIcon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
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

interface PulseTabProps {
  transactions: Transaction[];
  stats: {
    income: number;
    expenses: number;
    netWorth: number;
    savingsRate: number;
    assets: number;
    liabilities: number;
  };
}

const CURRENCY_OPTIONS = ["UGX", "USD", "EUR", "GBP", "KES"];
const ASSET_ACCOUNTS = ["Cash", "Bank", "Investments", "Crypto", "Property"];
const LIABILITY_TYPES = ["Loans", "Mortgages", "Credit Cards", "Payday Loans", "Other"];

const PulseTab = ({ transactions, stats }: PulseTabProps) => {
  const { formatUGX, convertToUSD } = useCurrency();

  const quickStats = [
    { label: "Total Assets", value: formatUGX(stats.assets) },
    { label: "Total Liabilities", value: formatUGX(stats.liabilities) },
    { label: "Total Income", value: formatUGX(stats.income) },
    { label: "Total Expenses", value: formatUGX(stats.expenses) },
  ];

  return (
    <div className="space-y-6 pt-2">
      {/* Net Worth Chart */}
      <Charts transactions={transactions} />

      {/* Quick Stats Row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {quickStats.map((s) => (
          <div key={s.label} className="flex-shrink-0 px-3 py-2 rounded-full bg-card border border-border">
            <span className="text-[10px] text-muted-foreground mr-1.5">{s.label}</span>
            <span className="text-xs font-semibold text-violet-hover">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Wealth Breakdown */}
      <WealthBreakdown transactions={transactions} />

      {/* Spending & Asset Donuts */}
      <SpendingBreakdown transactions={transactions} />
      <AssetAllocation transactions={transactions} />

      {/* Wealth Analysis */}
      <WealthAnalysis />
    </div>
  );
};

// ─── Wealth Breakdown ────────────────────────────────────────────

const WealthBreakdown = ({ transactions }: { transactions: Transaction[] }) => {
  const { formatUGX, convertToUSD } = useCurrency();
  const { user } = useAuth();
  const { addTransactions, updateTransaction, deleteTransaction } = useTransactions();

  const [wealthTab, setWealthTab] = useState<"assets" | "liabilities">("assets");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("UGX");
  const [formAccount, setFormAccount] = useState("Cash");
  const [formDate, setFormDate] = useState<Date | undefined>(new Date());

  const assetTxns = useMemo(() => transactions.filter((t) => t.type === "asset"), [transactions]);
  const liabilityTxns = useMemo(() => transactions.filter((t) => t.type === "liability"), [transactions]);

  const totalAssets = useMemo(() => assetTxns.reduce((s, t) => s + t.ugx_amount, 0), [assetTxns]);
  const totalLiabilities = useMemo(() => liabilityTxns.reduce((s, t) => s + t.ugx_amount, 0), [liabilityTxns]);
  const netWorth = totalAssets - totalLiabilities;

  const groupByKey = (txns: Transaction[], keyFn: (t: Transaction) => string) => {
    const map: Record<string, { total: number; items: Transaction[] }> = {};
    txns.forEach((t) => {
      const key = keyFn(t);
      if (!map[key]) map[key] = { total: 0, items: [] };
      map[key].total += t.ugx_amount;
      map[key].items.push(t);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  };

  const assetGroups = useMemo(() => groupByKey(assetTxns, (t) => t.account || "Other"), [assetTxns]);
  const liabilityGroups = useMemo(() => groupByKey(liabilityTxns, (t) => t.account || t.category || "Other"), [liabilityTxns]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetForm = () => {
    setFormDesc("");
    setFormAmount("");
    setFormCurrency("UGX");
    setFormAccount(wealthTab === "assets" ? "Cash" : "Loans");
    setFormDate(new Date());
  };

  const openAdd = () => {
    resetForm();
    setFormAccount(wealthTab === "assets" ? "Cash" : "Loans");
    setShowAddForm(true);
  };

  const handleAdd = () => {
    const amount = parseFloat(formAmount) || 0;
    if (!formDesc || amount <= 0) return;
    addTransactions.mutate([{
      id: crypto.randomUUID(),
      user_id: user!.id,
      description: formDesc,
      amount,
      currency: formCurrency,
      ugx_amount: formCurrency === "UGX" ? amount : amount * 3700,
      type: wealthTab === "assets" ? "asset" : "liability",
      category: wealthTab === "assets" ? "Investments" : "Other",
      account: formAccount,
      date: formDate ? format(formDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    }]);
    setShowAddForm(false);
  };

  const openEdit = (t: Transaction) => {
    setEditingTx(t);
    setFormDesc(t.description);
    setFormAmount(String(t.amount));
    setFormCurrency(t.currency);
    setFormAccount(t.account);
    setFormDate(new Date(t.date));
  };

  const handleSaveEdit = () => {
    if (!editingTx) return;
    updateTransaction.mutate({
      id: editingTx.id,
      description: formDesc,
      amount: parseFloat(formAmount) || 0,
      currency: formCurrency,
      ugx_amount: formCurrency === "UGX" ? parseFloat(formAmount) || 0 : (parseFloat(formAmount) || 0) * 3700,
      account: formAccount,
      date: formDate ? format(formDate, "yyyy-MM-dd") : editingTx.date,
    });
    setEditingTx(null);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteTransaction.mutate(deletingId);
    setDeletingId(null);
  };

  const currentGroups = wealthTab === "assets" ? assetGroups : liabilityGroups;
  const currentTotal = wealthTab === "assets" ? totalAssets : totalLiabilities;
  const accountOptions = wealthTab === "assets" ? ASSET_ACCOUNTS : LIABILITY_TYPES;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Wealth Breakdown</h3>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(["assets", "liabilities"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setWealthTab(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              wealthTab === tab
                ? "bg-primary/15 text-violet-hover border border-primary/30"
                : "text-muted-foreground border border-border hover:text-foreground"
            }`}
            style={{ borderWidth: "0.5px" }}
          >
            {tab === "assets" ? "Assets" : "Liabilities"}
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="space-y-1">
        {currentGroups.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No {wealthTab} yet. Add your first one below.
          </p>
        )}
        {currentGroups.map(([key, { total, items }]) => (
          <div key={key}>
            <button onClick={() => toggleGroup(key)} className="w-full flex justify-between items-center py-2 hover:bg-card/50 rounded transition-colors">
              <div className="flex items-center gap-1.5">
                {expandedGroups.has(key) ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">{key}</span>
              </div>
              <span className={`text-sm font-medium ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
                {formatUGX(total)}
              </span>
            </button>
            {expandedGroups.has(key) && (
              <div className="ml-5 space-y-0">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted-foreground truncate flex-1 mr-2">{t.description}</span>
                    <span className={`text-xs font-medium mr-2 ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
                      {formatUGX(t.ugx_amount)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-0.5 rounded hover:bg-card transition-colors">
                          <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem onClick={() => openEdit(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingId(t.id)} className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center py-2 border-t border-border" style={{ borderTopWidth: "0.5px" }}>
        <span className={`text-sm font-bold ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
          Total {wealthTab === "assets" ? "Assets" : "Liabilities"}
        </span>
        <span className={`text-sm font-bold ${wealthTab === "assets" ? "text-violet-hover" : "text-destructive"}`}>
          {formatUGX(currentTotal)}
        </span>
      </div>

      {/* Add button */}
      <button
        onClick={openAdd}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-primary/10 text-violet-hover text-xs font-medium hover:bg-primary/20 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add {wealthTab === "assets" ? "Asset" : "Liability"}
      </button>

      {/* Net Worth Summary — always visible */}
      <div className="border-t border-border pt-4" style={{ borderTopWidth: "0.5px" }}>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Worth</p>
          <p className="text-2xl font-display font-bold text-violet-hover">{formatUGX(netWorth)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">≈ ${convertToUSD(netWorth).toLocaleString()} USD</p>
        </div>
      </div>

      {/* Add Form Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="bg-card border-border max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Add {wealthTab === "assets" ? "Asset" : "Liability"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="e.g. Savings account" className="bg-background border-border mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="bg-background border-border mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{wealthTab === "assets" ? "Account" : "Type"}</label>
                <Select value={formAccount} onValueChange={setFormAccount}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {accountOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background border-border mt-1", !formDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formDate ? format(formDate, "PP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                    <Calendar mode="single" selected={formDate} onSelect={setFormDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddForm(false)} className="border-border">Cancel</Button>
            <Button onClick={handleAdd} className="bg-primary text-primary-foreground hover:bg-violet-hover">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
        <DialogContent className="bg-card border-border max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="bg-background border-border mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="bg-background border-border mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Account</label>
                <Select value={formAccount} onValueChange={setFormAccount}>
                  <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {accountOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background border-border mt-1", !formDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formDate ? format(formDate, "PP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                    <Calendar mode="single" selected={formDate} onSelect={setFormDate} initialFocus className="p-3 pointer-events-auto" />
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

// ─── Donut Charts ────────────────────────────────────────────────

const DONUT_COLORS = [
  "hsl(263, 83%, 58%)", "hsl(155, 52%, 55%)", "hsl(210, 52%, 55%)",
  "hsl(0, 52%, 55%)", "hsl(40, 60%, 55%)", "hsl(180, 45%, 50%)",
];

const SpendingBreakdown = ({ transactions }: { transactions: Transaction[] }) => {
  const { convertFromUGX } = useCurrency();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.ugx_amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name, value: convertFromUGX(value),
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [transactions, convertFromUGX]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spending</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-xs text-foreground flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AssetAllocation = ({ transactions }: { transactions: Transaction[] }) => {
  const { convertFromUGX } = useCurrency();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "asset").forEach((t) => {
      const bucket = t.account || t.category || "Other";
      map[bucket] = (map[bucket] || 0) + t.ugx_amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name, value: convertFromUGX(value),
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [transactions, convertFromUGX]);

  if (data.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assets</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-xs text-foreground flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PulseTab;
