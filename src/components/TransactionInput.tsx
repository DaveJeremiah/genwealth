import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";

interface TransactionInputProps {
  onInsight: (insight: string) => void;
}

const TransactionInput = ({ onInsight }: TransactionInputProps) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { addTransactions } = useTransactions();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-transactions", {
        body: { input: input.trim() },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const { transactions, insight } = data;
      await addTransactions.mutateAsync(transactions);
      onInsight(insight);
      setInput("");
      toast({ title: `${transactions.length} transaction(s) added`, description: insight });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 space-y-3">
      <h3 className="font-display text-lg font-semibold text-foreground">Log Transactions</h3>
      <p className="text-xs text-muted-foreground">
        Describe your financial activity in plain language
      </p>
      <Textarea
        placeholder={`"Paid $1,200 rent, got $3,500 salary, spent $45 groceries"`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground min-h-[80px] resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="gold-gradient text-primary-foreground font-semibold gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? "Parsing..." : "Process"}
        </Button>
      </div>
    </div>
  );
};

export default TransactionInput;
