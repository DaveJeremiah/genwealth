import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";

interface TransactionInputProps {
  onInsight: (insight: string) => void;
}

const TransactionInput = ({ onInsight }: TransactionInputProps) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { addTransactions } = useTransactions();
  const { toast } = useToast();

  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not supported", description: "Speech recognition is not available in this browser.", variant: "destructive" });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    let finalTranscript = input;

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + transcript;
        } else {
          interim = transcript;
        }
      }
      setInput(finalTranscript + (interim ? " " + interim : ""));
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
    setListening(true);
  }, [listening, input, toast]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-transactions", {
        body: { input: input.trim() }
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
      <h3 className="text-lg font-semibold text-foreground font-mono">Log Transactions</h3>
      <p className="text-xs text-muted-foreground">
        Describe your financial activity in plain language — type or use the mic
      </p>
      <div className="relative">
        <Textarea
          placeholder={`"Paid $1,200 rent, got $3,500 salary, spent $45 groceries"`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="bg-secondary border-border text-foreground placeholder:text-muted-foreground min-h-[80px] resize-none pr-12"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }} />
        
        <button
          type="button"
          onClick={toggleListening}
          className={`absolute right-3 top-3 p-1.5 rounded-full transition-colors ${
          listening ?
          "bg-destructive/20 text-destructive animate-pulse" :
          "text-muted-foreground hover:text-primary hover:bg-primary/10"}`
          }
          title={listening ? "Stop listening" : "Voice input"}>
          
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
      <div className="flex items-center justify-between">
        {listening &&
        <span className="text-xs text-destructive flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            Listening…
          </span>
        }
        <div className="flex-1" />
        <Button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="gold-gradient text-primary-foreground font-semibold gap-2">
          
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {loading ? "Parsing..." : "Process"}
        </Button>
      </div>
    </div>);

};

export default TransactionInput;