import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import ReactMarkdown from "react-markdown";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface AIChatAssistantProps {
  currentScreen?: string;
}

const AIChatAssistant = ({ currentScreen = "home" }: AIChatAssistantProps) => {
  const { user } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || historyLoaded) return;
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .order("created_at", { ascending: true })
        .limit(200);
      if (data && data.length > 0) {
        setMessages(data.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      }
      setHistoryLoaded(true);
    };
    load();
  }, [user, historyLoaded]);

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  }, [messages, open]);

  const buildFinancialContext = useCallback(() => {
    const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + (t.ugx_amount || 0), 0);
    const expenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.ugx_amount || 0), 0);
    const assets = transactions.filter(t => t.type === "asset").reduce((s, t) => s + (t.ugx_amount || 0), 0);
    const liabilities = transactions.filter(t => t.type === "liability").reduce((s, t) => s + Math.abs(t.ugx_amount || 0), 0);
    const netWorth = assets - liabilities + income - expenses;
    const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
    const recent = transactions.slice(0, 50).map(t => ({
      date: t.date, description: t.description, amount: t.amount,
      currency: t.currency, ugx_amount: t.ugx_amount, type: t.type,
      category: t.category, account: t.account,
    }));
    return { currentScreen, netWorth, totalIncome: income, totalExpenses: expenses, savingsRate, transactionCount: transactions.length, transactions: recent };
  }, [transactions, currentScreen]);

  const persistMessage = async (role: "user" | "assistant", content: string) => {
    if (!user) return;
    const { data } = await supabase.from("chat_messages").insert({ user_id: user.id, role, content }).select("id").single();
    return data?.id;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    const userId = await persistMessage("user", text);
    if (userId) userMsg.id = userId;
    try {
      const conversationMessages = newMessages.slice(-20).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: conversationMessages, financialContext: buildFinancialContext() },
      });
      if (error) throw error;
      const assistantContent = data.content ?? data.error ?? "No response";
      const assistantMsg: Message = { role: "assistant", content: assistantContent };
      const aId = await persistMessage("assistant", assistantContent);
      if (aId) assistantMsg.id = aId;
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errContent = `Error: ${e.message}`;
      setMessages(prev => [...prev, { role: "assistant", content: errContent }]);
      await persistMessage("assistant", errContent);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setMessages([]);
  };

  return (
    <>
      {/* FAB - above tab bar */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-11 h-11 rounded-full bg-primary shadow-lg shadow-primary/25 flex items-center justify-center hover:bg-violet-hover transition-colors"
          aria-label="Open AI Assistant"
        >
          <MessageCircle className="w-5 h-5 text-primary-foreground" />
        </button>
      )}

      {/* Bottom sheet chat panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative z-10 bg-background rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up border-t border-border" style={{ borderTopWidth: '0.5px' }}>
            {/* Handle + header */}
            <div className="flex flex-col items-center pt-2 pb-3 px-4 border-b border-border" style={{ borderBottomWidth: '0.5px' }}>
              <div className="w-10 h-1 rounded-full bg-border mb-3" />
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-display font-semibold text-foreground">Wealth OS Assistant</span>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button onClick={clearChat} className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors" title="Clear chat">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-xs mt-8 space-y-3">
                  <p className="font-medium text-sm">I know your finances. Ask me anything.</p>
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground">"Which category is eating most of my money?"</p>
                    <p className="text-muted-foreground">"What's my savings rate this month?"</p>
                    <p className="text-muted-foreground">"What is generational wealth?"</p>
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground border border-border"
                  }`} style={m.role === "assistant" ? { borderWidth: '0.5px' } : {}}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-card rounded-2xl px-3.5 py-2.5 border border-border" style={{ borderWidth: '0.5px' }}>
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 items-center">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your finances..."
                  className="flex-1 bg-card border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                  style={{ borderWidth: '0.5px' }}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity hover:bg-violet-hover"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatAssistant;
