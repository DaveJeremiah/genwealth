import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Brain, Loader2, Target, TrendingUp, AlertTriangle } from "lucide-react";

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

      // Save net worth snapshot using ugx_amount
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

  const scoreColor = (score: number) => {
    if (score >= 70) return "text-primary";
    if (score >= 40) return "text-yellow-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">AI Wealth Analysis</h3>
        <Button
          onClick={runAnalysis}
          disabled={loading || transactions.length === 0}
          className="gold-gradient text-primary-foreground font-semibold gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {loading ? "Analyzing..." : "Analyze"}
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Wealth Score</p>
            <p className={`text-6xl font-display font-bold ${scoreColor(result.wealthScore)}`}>
              {result.wealthScore}
            </p>
            <p className="text-sm text-muted-foreground">out of 100</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h4 className="font-display font-semibold text-sm">Status</h4>
              </div>
              <p className={`text-xl font-display font-bold ${
                result.earnerOrOwner === "Owner" ? "text-primary" :
                result.earnerOrOwner === "Transitioning" ? "text-yellow-500" : "text-muted-foreground"
              }`}>
                {result.earnerOrOwner}
              </p>
            </div>
            <div className="glass-card rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h4 className="font-display font-semibold text-sm">Lifestyle or Legacy?</h4>
              </div>
              <p className="text-sm text-foreground">{result.lifestyleOrLegacy}</p>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <h4 className="font-display font-semibold text-sm">Insights</h4>
            </div>
            <ul className="space-y-2">
              {result.insights.map((insight, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card rounded-xl p-5">
            <p className="text-sm text-foreground italic">{result.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WealthAnalysis;
