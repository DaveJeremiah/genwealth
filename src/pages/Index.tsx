import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, LogOut, Sparkles } from "lucide-react";
import TransactionInput from "@/components/TransactionInput";
import StatsCards from "@/components/StatsCards";
import FinancialStatements from "@/components/FinancialStatements";
import Charts from "@/components/Charts";
import TransactionLog from "@/components/TransactionLog";
import WealthAnalysis from "@/components/WealthAnalysis";
import NetWorthTracker from "@/components/NetWorthTracker";

const Index = () => {
  const { signOut } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const [latestInsight, setLatestInsight] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-bold gold-text">Wealth OS</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground gap-1.5">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="container px-4 py-6 space-y-6 max-w-6xl">
        {/* AI Insight Banner */}
        {latestInsight && (
          <div className="rounded-xl p-4 border border-primary/30 bg-primary/5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-primary font-semibold mb-1">Latest AI Insight</p>
              <p className="text-sm text-foreground">{latestInsight}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <StatsCards transactions={transactions} />

        {/* Input */}
        <TransactionInput onInsight={setLatestInsight} />

        {/* Tabs */}
        <Tabs defaultValue="statements" className="space-y-4">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="networth" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Net Worth</TabsTrigger>
            <TabsTrigger value="statements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Statements</TabsTrigger>
            <TabsTrigger value="charts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Charts</TabsTrigger>
            <TabsTrigger value="analysis" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Analysis</TabsTrigger>
            <TabsTrigger value="log" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">Log</TabsTrigger>
          </TabsList>
          <TabsContent value="networth">
            <NetWorthTracker />
          </TabsContent>
          <TabsContent value="statements">
            <FinancialStatements transactions={transactions} />
          </TabsContent>
          <TabsContent value="charts">
            <Charts transactions={transactions} />
          </TabsContent>
          <TabsContent value="analysis">
            <WealthAnalysis />
          </TabsContent>
          <TabsContent value="log">
            <TransactionLog />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
