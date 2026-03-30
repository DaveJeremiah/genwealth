import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
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
  const [memoText, setMemoText] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not supported", description: "Speech recognition is not available.", variant: "destructive" });
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

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset so the scrollHeight shrinks when text is deleted.
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 140);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    resizeTextarea();
  }, [input, isOnline, resizeTextarea]);

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
      ugx_amount: offCurrency === "UGX" ? amt : amt,
      type: offType,
      category: offCategory,
      account: "Cash",
      created_at: new Date().toISOString(),
      synced: false,
    };
    await offlineDb.transactions.put(tx);
    await refreshPendingCount();
    toast({ title: "Saved locally", description: "Will sync when you're back online." });
    setOffDesc(""); setOffAmount(""); setOffType("expense"); setOffCategory("Other");
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

  // ONLINE MODE — hero pill input
  if (isOnline) {
    return (
      <div className="relative">
        <div
          className="flex items-start rounded-full bg-card border transition-all duration-200 focus-within:border-primary/60 shadow-md"
          style={{ borderWidth: '0.5px', borderColor: 'hsl(263, 83%, 58%, 0.27)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What happened financially today?"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none font-body resize-none overflow-hidden min-h-[44px] px-[20px] py-[20px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleOnlineSubmit();
              }
            }}
          />
          {loading ? (
            <div className="mr-2 p-2 mt-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <button
              onClick={input.trim() ? handleOnlineSubmit : toggleListening}
              className={`mr-1.5 w-10 h-10 rounded-full flex items-center justify-center mt-2 transition-all ${
                listening
                  ? "bg-destructive/20 text-destructive animate-pulse"
                  : "bg-primary text-primary-foreground hover:bg-violet-hover"
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : input.trim() ? <Send className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  // OFFLINE MODE
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Quick Entry (Offline)</h3>
        <p className="text-xs text-muted-foreground">Add transactions manually — they'll sync when you reconnect.</p>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Description" value={offDesc} onChange={(e) => setOffDesc(e.target.value)} className="col-span-2 bg-card border-border rounded-xl" />
          <Input type="number" placeholder="Amount" value={offAmount} onChange={(e) => setOffAmount(e.target.value)} className="bg-card border-border rounded-xl" />
          <Select value={offCurrency} onValueChange={setOffCurrency}>
            <SelectTrigger className="bg-card border-border rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={offType} onValueChange={setOffType}>
            <SelectTrigger className="bg-card border-border rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={offCategory} onValueChange={setOffCategory}>
            <SelectTrigger className="bg-card border-border rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} className="bg-card border-border rounded-xl" />
        </div>
        <button
          onClick={handleOfflineQuickSubmit}
          disabled={!offDesc.trim() || !offAmount}
          className="w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 transition-opacity"
        >
          Save Locally
        </button>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Or save a voice/text memo to process later</h3>
        </div>
        <div className="relative">
          <textarea
            placeholder="Describe transactions naturally — AI will parse them when you reconnect."
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            className="w-full bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground min-h-[60px] resize-none p-3 text-sm pr-12 focus:outline-none focus:border-primary/40"
            style={{ borderWidth: '0.5px' }}
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-3 top-3 p-1.5 rounded-full transition-colors ${listening ? "bg-destructive/20 text-destructive animate-pulse" : "text-muted-foreground hover:text-primary"}`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={handleMemoSubmit}
          disabled={!memoText.trim()}
          className="w-full py-2.5 rounded-full border border-border text-foreground text-sm font-medium disabled:opacity-40 transition-opacity hover:bg-card"
          style={{ borderWidth: '0.5px' }}
        >
          Save Memo
        </button>
      </div>
    </div>
  );
};

export default TransactionInput;
