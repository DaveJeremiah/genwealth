import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const AIChatAssistant = ({ currentScreen = "Dashboard" }: AIChatAssistantProps) => {
  const { user } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history from DB
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
      date: t.date,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      ugx_amount: t.ugx_amount,
      type: t.type,
      category: t.category,
      account: t.account,
    }));

    return {
      currentScreen,
      netWorth,
      totalIncome: income,
      totalExpenses: expenses,
      savingsRate,
      transactionCount: transactions.length,
      transactions: recent,
    };
  }, [transactions, currentScreen]);

  const persistMessage = async (role: "user" | "assistant", content: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, role, content })
      .select("id")
      .single();
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

    // Persist user message
    const userId = await persistMessage("user", text);
    if (userId) userMsg.id = userId;

    try {
      // Only send last 20 messages as conversation context to stay within limits
      const conversationMessages = newMessages.slice(-20).map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: conversationMessages,
          financialContext: buildFinancialContext(),
        },
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
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gold-gradient shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Open AI Assistant"
        >
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-display font-semibold">Wealth OS Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={clearChat}
                  title="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-xs mt-8 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-primary/50" />
                <p className="font-medium">I know your finances. Ask me anything.</p>
                <div className="space-y-1 text-[11px]">
                  <p>"Which category is eating most of my money?"</p>
                  <p>"What's my savings rate this month?"</p>
                  <p>"Explain generational wealth to me"</p>
                  <p>"What is a balance sheet?"</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your finances..."
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()} className="gold-gradient h-9 w-9">
                <Send className="w-4 h-4 text-primary-foreground" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatAssistant;
