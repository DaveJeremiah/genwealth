import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AnalysisResult {
  wealthScore: number;
  insights: string[];
  lifestyleOrLegacy: string;
  earnerOrOwner: string;
  summary: string;
}

const WealthAnalysis = () => {
  const { data: transactions = [] } = useTransactions();
  const { user } = useAuth();
  const { toast } = useToast();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    if (transactions.length === 0) {
      toast({ title: "No data", description: "Add transactions first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wealth-analysis", {
        body: { transactions },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data);

      const assets = transactions.filter((t) => t.type === "asset").reduce((s, t) => s + t.ugx_amount, 0);
      const liabilities = transactions.filter((t) => t.type === "liability").reduce((s, t) => s + t.ugx_amount, 0);
      await supabase.from("net_worth_snapshots").insert({
        user_id: user!.id,
        net_worth: assets - liabilities,
        total_assets: assets,
        total_liabilities: liabilities,
        wealth_score: data.wealthScore,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-primary/20 text-center space-y-4" style={{ borderWidth: '0.5px' }}>
        <p className="text-sm text-muted-foreground">
          {transactions.length === 0
            ? "Add transactions to unlock your wealth analysis."
            : "Ready to see the full picture?"}
        </p>
        <button
          onClick={runAnalysis}
          disabled={loading || transactions.length === 0}
          className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 transition-all hover:bg-violet-hover inline-flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Analyzing..." : "Run wealth analysis"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-6 text-center space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wealth Score</p>
        <p className="text-5xl font-display font-bold text-violet-hover">{result.wealthScore}</p>
        <p className="text-sm font-medium text-foreground">{result.earnerOrOwner}</p>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-3">
        {result.insights.map((insight, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: '#999', lineHeight: 1.7 }}>
            {i + 1}. {insight}
          </p>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <p className="text-sm italic leading-relaxed" style={{ color: '#999', lineHeight: 1.7 }}>
          {result.summary}
        </p>
      </div>

      <div className="text-center">
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {loading ? "Analyzing..." : "Re-analyze"}
        </button>
      </div>
    </div>
  );
};

export default WealthAnalysis;
