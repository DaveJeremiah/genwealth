import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  category: string;
  account: string;
  created_at: string;
}

export const useTransactions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const addTransactions = useMutation({
    mutationFn: async (transactions: Omit<Transaction, "created_at">[]) => {
      const rows = transactions.map((t) => ({
        user_id: user!.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        type: t.type,
        category: t.category,
        account: t.account,
      }));
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: any) => {
      toast({ title: "Error saving transactions", description: error.message, variant: "destructive" });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async (updates: { id: string } & Partial<Omit<Transaction, "id" | "user_id" | "created_at">>) => {
      const { id, ...fields } = updates;
      const { error } = await supabase.from("transactions").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transaction updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transaction deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return { ...query, addTransactions, updateTransaction, deleteTransaction };
};
