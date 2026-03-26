import { useState, useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Car, Home, Landmark, PiggyBank, Wallet, CreditCard,
  TrendingUp, Plus, X, DollarSign, Shield, Briefcase, ChevronDown, ChevronUp,
  LineChart, Save, Loader2,
} from "lucide-react";
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useQuery } from "@tanstack/react-query";

interface NetWorthItem {
  label: string;
  amount: number;
  id: string;
}

interface AssetCategory {
  name: string;
  icon: React.ElementType;
  suggestions: string[];
  items: NetWorthItem[];
}

interface LiabilityCategory {
  name: string;
  icon: React.ElementType;
  suggestions: string[];
  items: NetWorthItem[];
}

const defaultAssetCategories = (): AssetCategory[] => [
  { name: "Bank Accounts", icon: Landmark, suggestions: ["Stanbic Bank", "Centenary Bank", "dfcu Bank", "Absa Bank", "Equity Bank", "Mobile Money"], items: [] },
  { name: "Investment Accounts", icon: TrendingUp, suggestions: ["Stock Portfolio", "Treasury Bills", "Mutual Funds", "NSSF", "Unit Trust", "Business Equity"], items: [] },
  { name: "Retirement Accounts", icon: PiggyBank, suggestions: ["NSSF", "Pension Fund", "Retirement Savings", "Provident Fund"], items: [] },
  { name: "Real Estate", icon: Home, suggestions: ["Primary Residence", "Rental Property", "Land", "Commercial Property", "Plot"], items: [] },
  { name: "Vehicles & Assets", icon: Car, suggestions: ["Car", "Motorcycle (Boda)", "Truck", "Equipment"], items: [] },
  { name: "Insurance & Other", icon: Shield, suggestions: ["Life Insurance", "Jewelry", "Crypto Wallet", "Collectibles", "Livestock"], items: [] },
];

const defaultLiabilityCategories = (): LiabilityCategory[] => [
  { name: "Mortgages", icon: Home, suggestions: ["Home Loan", "Property Loan", "Construction Loan"], items: [] },
  { name: "Auto Loans", icon: Car, suggestions: ["Car Loan", "Boda Boda Loan", "Asset Finance"], items: [] },
  { name: "Credit Cards", icon: CreditCard, suggestions: ["Visa", "Mastercard", "Store Credit"], items: [] },
  { name: "Personal Loans", icon: Wallet, suggestions: ["Bank Loan", "Microfinance Loan", "Mobile Money Loan", "SACCO Loan", "Family Loan"], items: [] },
  { name: "Student & Other Debt", icon: Briefcase, suggestions: ["Student Loan", "Medical Debt", "Tax Debt", "Business Loan", "Supplier Credit"], items: [] },
];

const genId = () => crypto.randomUUID();

const NetWorthTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatUGX, convertFromUGX } = useCurrency();
  const { addTransactions } = useTransactions();
  const [assets, setAssets] = useState<AssetCategory[]>(defaultAssetCategories);
  const [liabilities, setLiabilities] = useState<LiabilityCategory[]>(defaultLiabilityCategories);
  const [expandedAsset, setExpandedAsset] = useState<number | null>(0);
  const [expandedLiability, setExpandedLiability] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);

  const { data: snapshots = [] } = useQuery({
    queryKey: ["net_worth_snapshots", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("net_worth_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addItem = (type: "asset" | "liability", catIdx: number, label: string) => {
    const setter = type === "asset" ? setAssets : setLiabilities;
    setter((prev) => {
      const copy = [...prev];
      const cat = { ...copy[catIdx], items: [...copy[catIdx].items, { label, amount: 0, id: genId() }] };
      copy[catIdx] = cat;
      return copy;
    });
  };

  const updateAmount = (type: "asset" | "liability", catIdx: number, itemId: string, amount: number) => {
    const setter = type === "asset" ? setAssets : setLiabilities;
    setter((prev) => {
      const copy = [...prev];
      copy[catIdx] = {
        ...copy[catIdx],
        items: copy[catIdx].items.map((i) => (i.id === itemId ? { ...i, amount } : i)),
      };
      return copy;
    });
  };

  const removeItem = (type: "asset" | "liability", catIdx: number, itemId: string) => {
    const setter = type === "asset" ? setAssets : setLiabilities;
    setter((prev) => {
      const copy = [...prev];
      copy[catIdx] = { ...copy[catIdx], items: copy[catIdx].items.filter((i) => i.id !== itemId) };
      return copy;
    });
  };

  const totals = useMemo(() => {
    const totalAssets = assets.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.amount, 0), 0);
    const totalLiabilities = liabilities.reduce((s, c) => s + c.items.reduce((ss, i) => ss + i.amount, 0), 0);
    return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
  }, [assets, liabilities]);

  const fmt = (n: number) => formatUGX(n);

  const handleSaveSnapshot = async () => {
    if (totals.totalAssets === 0 && totals.totalLiabilities === 0) {
      toast({ title: "Nothing to save", description: "Add some assets or liabilities first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await supabase.from("net_worth_snapshots").insert({
        user_id: user!.id,
        net_worth: totals.netWorth,
        total_assets: totals.totalAssets,
        total_liabilities: totals.totalLiabilities,
      });

      const txns: any[] = [];
      assets.forEach((cat) =>
        cat.items.filter((i) => i.amount > 0).forEach((i) =>
          txns.push({ id: genId(), date: new Date().toISOString().split("T")[0], description: `${i.label} (${cat.name})`, amount: i.amount, currency: "UGX", ugx_amount: i.amount, type: "asset", category: cat.name, account: cat.name })
        )
      );
      liabilities.forEach((cat) =>
        cat.items.filter((i) => i.amount > 0).forEach((i) =>
          txns.push({ id: genId(), date: new Date().toISOString().split("T")[0], description: `${i.label} (${cat.name})`, amount: i.amount, currency: "UGX", ugx_amount: i.amount, type: "liability", category: cat.name, account: cat.name })
        )
      );
      if (txns.length > 0) await addTransactions.mutateAsync(txns);

      toast({ title: "Snapshot saved!", description: `Net worth: ${fmt(totals.netWorth)}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const chartData = snapshots.map((s: any) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    netWorth: convertFromUGX(Number(s.net_worth)),
    assets: convertFromUGX(Number(s.total_assets)),
    liabilities: convertFromUGX(Number(s.total_liabilities)),
  }));

  const tooltipStyle = {
    contentStyle: { background: "hsl(220, 18%, 12%)", border: "1px solid hsl(220, 15%, 18%)", borderRadius: 8, color: "hsl(40, 20%, 90%)" },
    labelStyle: { color: "hsl(40, 20%, 90%)" },
  };

  const renderCategory = (
    type: "asset" | "liability",
    categories: (AssetCategory | LiabilityCategory)[],
    expanded: number | null,
    setExpanded: (v: number | null) => void,
  ) =>
    categories.map((cat, catIdx) => {
      const isOpen = expanded === catIdx;
      const catTotal = cat.items.reduce((s, i) => s + i.amount, 0);
      const Icon = cat.icon;
      const usedLabels = new Set(cat.items.map((i) => i.label));
      const availableSuggestions = cat.suggestions.filter((s) => !usedLabels.has(s));

      return (
        <div key={cat.name} className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(isOpen ? null : catIdx)}
            className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`w-4 h-4 ${type === "asset" ? "text-primary" : "text-destructive"}`} />
              <span className="text-sm font-medium text-foreground">{cat.name}</span>
              {cat.items.length > 0 && (
                <span className="text-xs text-muted-foreground">({cat.items.length})</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {catTotal > 0 && (
                <span className={`text-sm font-semibold ${type === "asset" ? "text-primary" : "text-destructive"}`}>
                  {fmt(catTotal)}
                </span>
              )}
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {isOpen && (
            <div className="border-t border-border p-3 space-y-3">
              {cat.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-sm text-foreground flex-1 min-w-0 truncate">{item.label}</span>
                  <div className="relative w-36">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">UGX</span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={item.amount || ""}
                      onChange={(e) => updateAmount(type, catIdx, item.id, parseFloat(e.target.value) || 0)}
                      className="pl-10 h-8 bg-secondary border-border text-sm"
                      placeholder="0"
                    />
                  </div>
                  <button onClick={() => removeItem(type, catIdx, item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {availableSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {availableSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => addItem(type, catIdx, s)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <AddCustomItem onAdd={(label) => addItem(type, catIdx, label)} />
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Assets</p>
            <p className="text-lg font-display font-bold text-primary">{fmt(totals.totalAssets)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Liabilities</p>
            <p className="text-lg font-display font-bold text-destructive">{fmt(totals.totalLiabilities)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Net Worth</p>
            <p className={`text-lg font-display font-bold ${totals.netWorth >= 0 ? "text-primary" : "text-destructive"}`}>
              {fmt(totals.netWorth)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Assets — What You Own
          </h3>
          {renderCategory("asset", assets, expandedAsset, setExpandedAsset)}
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-destructive" />
            Liabilities — What You Owe
          </h3>
          {renderCategory("liability", liabilities, expandedLiability, setExpandedLiability)}
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSaveSnapshot}
          disabled={saving}
          className="gold-gradient text-primary-foreground font-semibold gap-2 px-8"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Net Worth Snapshot"}
        </Button>
      </div>

      {chartData.length > 0 && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Net Worth History</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <ReLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(220, 10%, 50%)", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => formatUGX(v)} />
              <Line type="monotone" dataKey="netWorth" stroke="hsl(43, 60%, 53%)" strokeWidth={2} dot={{ fill: "hsl(43, 60%, 53%)", r: 3 }} name="Net Worth" />
              <Line type="monotone" dataKey="assets" stroke="hsl(160, 45%, 40%)" strokeWidth={1.5} dot={false} name="Assets" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="liabilities" stroke="hsl(0, 50%, 50%)" strokeWidth={1.5} dot={false} name="Liabilities" strokeDasharray="4 2" />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const AddCustomItem = ({ onAdd }: { onAdd: (label: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
        <Plus className="w-3 h-3" /> Add custom
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && label.trim()) { onAdd(label.trim()); setLabel(""); setOpen(false); }
          if (e.key === "Escape") { setOpen(false); setLabel(""); }
        }}
        placeholder="Custom item name…"
        className="h-8 bg-secondary border-border text-sm flex-1"
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs text-primary"
        onClick={() => { if (label.trim()) { onAdd(label.trim()); setLabel(""); setOpen(false); } }}
      >
        Add
      </Button>
      <button onClick={() => { setOpen(false); setLabel(""); }} className="text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default NetWorthTracker;
