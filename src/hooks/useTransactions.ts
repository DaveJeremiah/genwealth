import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { offlineDb, type LocalTransaction } from "@/lib/offlineDb";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  ugx_amount: number;
  type: string;
  category: string;
  account: string;
  created_at: string;
}

export const useTransactions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const query = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (isOnline) {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false });
        if (error) throw error;
        return data as unknown as Transaction[];
      }
      // Offline: read from IndexedDB
      const local = await offlineDb.transactions
        .where("user_id")
        .equals(user!.id)
        .toArray();
      local.sort((a, b) => b.date.localeCompare(a.date));
      return local as unknown as Transaction[];
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
        currency: t.currency || "UGX",
        ugx_amount: t.ugx_amount || t.amount,
        type: t.type,
        category: t.category,
        account: t.account,
      }));

      if (isOnline) {
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) throw error;
        // Also save to IndexedDB
        for (const r of rows) {
          await offlineDb.transactions.put({
            id: crypto.randomUUID(),
            ...r,
            created_at: new Date().toISOString(),
            synced: true,
          } as LocalTransaction);
        }
      } else {
        // Offline: save to IndexedDB only
        for (const r of rows) {
          await offlineDb.transactions.put({
            id: crypto.randomUUID(),
            ...r,
            created_at: new Date().toISOString(),
            synced: false,
          } as LocalTransaction);
        }
      }
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
      if (isOnline) {
        const { error } = await supabase.from("transactions").update(fields).eq("id", id);
        if (error) throw error;
      }
      // Always update local
      await offlineDb.transactions.update(id, { ...fields, synced: isOnline });
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
      if (isOnline) {
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) throw error;
      }
      await offlineDb.transactions.delete(id);
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
