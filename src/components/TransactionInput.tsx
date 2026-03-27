import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, Mic, MicOff, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useOffline } from "@/contexts/OfflineContext";
import { offlineDb, type LocalTransaction, type LocalMemo } from "@/lib/offlineDb";

interface TransactionInputProps {
  onInsight: (insight: string) => void;
}

const CATEGORIES = [
  "Housing", "Food & Dining", "Transport", "Entertainment", "Health",
  "Shopping", "Utilities", "Investments", "Crypto", "Property",
  "Salary", "Freelance", "Business", "Savings", "Transfer", "Other",
];

const CURRENCIES = ["UGX", "USD", "EUR", "GBP", "KES", "BTC", "ETH", "SOL"];

const TYPES = ["income", "expense", "asset", "liability", "transfer-in", "transfer-out"];

const TransactionInput = ({ onInsight }: TransactionInputProps) => {
  const { user } = useAuth();
  const { isOnline, refreshPendingCount } = useOffline();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { addTransactions } = useTransactions();
  const { toast } = useToast();

  // Offline quick form state
  const [offDesc, setOffDesc] = useState("");
  const [offAmount, setOffAmount] = useState("");
  const [offCurrency, setOffCurrency] = useState("UGX");
  const [offType, setOffType] = useState("expense");
  const [offCategory, setOffCategory] = useState("Other");
  const [offDate, setOffDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Memo state
  const [memoText, setMemoText] = useState("");

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
    const target = isOnline ? input : memoText;
    let finalTranscript = target;
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
      const combined = finalTranscript + (interim ? " " + interim : "");
      if (isOnline) setInput(combined);
      else setMemoText(combined);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }, [listening, input, memoText, toast, isOnline]);

  const handleOnlineSubmit = async () => {
    if (!input.trim() || loading) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
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

  const handleOfflineQuickSubmit = async () => {
    if (!offDesc.trim() || !offAmount || !user) return;
    const amt = parseFloat(offAmount);
    if (isNaN(amt) || amt <= 0) return;

    const tx: LocalTransaction = {
      id: crypto.randomUUID(),
      user_id: user.id,
      date: offDate,
      description: offDesc.trim(),
      amount: amt,
      currency: offCurrency,
      ugx_amount: offCurrency === "UGX" ? amt : amt, // best effort offline
      type: offType,
      category: offCategory,
      account: "Cash",
      created_at: new Date().toISOString(),
      synced: false,
    };
    await offlineDb.transactions.put(tx);
    await refreshPendingCount();
    toast({ title: "Saved locally", description: "Will sync when you're back online." });
    setOffDesc("");
    setOffAmount("");
    setOffType("expense");
    setOffCategory("Other");
    setOffDate(new Date().toISOString().split("T")[0]);
  };

  const handleMemoSubmit = async () => {
    if (!memoText.trim() || !user) return;
    const memo: LocalMemo = {
      id: crypto.randomUUID(),
      user_id: user.id,
      raw_text: memoText.trim(),
      ai_processed: false,
      created_at: new Date().toISOString(),
    };
    await offlineDb.memos.put(memo);
    await refreshPendingCount();
    toast({ title: "Memo saved", description: "Will be AI-processed when you reconnect." });
    setMemoText("");
  };

  // ONLINE MODE
  if (isOnline) {
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
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleOnlineSubmit(); }}
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-3 top-3 p-1.5 rounded-full transition-colors ${listening ? "bg-destructive/20 text-destructive animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
            title={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          {listening && (
            <span className="text-xs text-destructive flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              Listening…
            </span>
          )}
          <div className="flex-1" />
          <Button onClick={handleOnlineSubmit} disabled={loading || !input.trim()} className="gold-gradient text-primary-foreground font-semibold gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Parsing..." : "Process"}
          </Button>
        </div>
      </div>
    );
  }

  // OFFLINE MODE
  return (
    <div className="space-y-4">
      {/* Quick form */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <h3 className="text-lg font-semibold text-foreground font-mono">Quick Entry (Offline)</h3>
        <p className="text-xs text-muted-foreground">Add transactions manually — they'll sync when you reconnect.</p>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Description" value={offDesc} onChange={(e) => setOffDesc(e.target.value)} className="col-span-2 bg-secondary border-border" />
          <Input type="number" placeholder="Amount" value={offAmount} onChange={(e) => setOffAmount(e.target.value)} className="bg-secondary border-border" />
          <Select value={offCurrency} onValueChange={setOffCurrency}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={offType} onValueChange={setOffType}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={offCategory} onValueChange={setOffCategory}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} className="bg-secondary border-border" />
        </div>
        <Button onClick={handleOfflineQuickSubmit} disabled={!offDesc.trim() || !offAmount} className="gold-gradient text-primary-foreground font-semibold gap-2 w-full">
          <Send className="w-4 h-4" /> Save Locally
        </Button>
      </div>

      {/* Memo queue */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground font-mono">Or save a voice/text memo to process later</h3>
        </div>
        <div className="relative">
          <Textarea
            placeholder="Describe transactions naturally — AI will parse them when you reconnect."
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground min-h-[60px] resize-none pr-12"
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-3 top-3 p-1.5 rounded-full transition-colors ${listening ? "bg-destructive/20 text-destructive animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
        <Button onClick={handleMemoSubmit} disabled={!memoText.trim()} variant="outline" className="w-full gap-2 border-border">
          <FileText className="w-4 h-4" /> Save Memo
        </Button>
      </div>
    </div>
  );
};

export default TransactionInput;
