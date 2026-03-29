import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { convertAmountToUgx } from "@/lib/convertToUgx";
import type { Tables } from "@/integrations/supabase/types";

export type WishListItem = Tables<"wish_list_items">;

export type WishPriority = "nice_to_have" | "want_it" | "need_it";

export function useWishList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const query = useQuery({
    queryKey: ["wish-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wish_list_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WishListItem[];
    },
    enabled: !!user && isOnline,
  });

  const insertItem = useMutation({
    mutationFn: async (payload: {
      item_name: string;
      description: string;
      estimated_price: number;
      currency: string;
      category: string;
      priority: WishPriority;
      target_date: string | null;
    }) => {
      const estimated_ugx_amount = await convertAmountToUgx(payload.estimated_price, payload.currency);
      const { error } = await supabase.from("wish_list_items").insert({
        user_id: user!.id,
        item_name: payload.item_name,
        description: payload.description || null,
        estimated_price: payload.estimated_price,
        currency: payload.currency,
        estimated_ugx_amount,
        category: payload.category,
        priority: payload.priority,
        target_date: payload.target_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wish-list", user?.id] });
      toast({ title: "Added to wish list" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      item_name: string;
      description: string;
      estimated_price: number;
      currency: string;
      category: string;
      priority: WishPriority;
      target_date: string | null;
    }) => {
      const estimated_ugx_amount = await convertAmountToUgx(payload.estimated_price, payload.currency);
      const { error } = await supabase
        .from("wish_list_items")
        .update({
          item_name: payload.item_name,
          description: payload.description || null,
          estimated_price: payload.estimated_price,
          currency: payload.currency,
          estimated_ugx_amount,
          category: payload.category,
          priority: payload.priority,
          target_date: payload.target_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wish-list", user?.id] });
      toast({ title: "Wish list updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wish_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wish-list", user?.id] });
      toast({ title: "Removed from wish list" });
    },
    onError: (e: Error) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const markPurchased = useMutation({
    mutationFn: async ({
      id,
      item_name,
      category,
      actual_amount_paid,
      actual_currency,
      purchase_date,
    }: {
      id: string;
      item_name: string;
      category: string;
      actual_amount_paid: number;
      actual_currency: string;
      purchase_date: string;
    }) => {
      const actual_ugx_amount = await convertAmountToUgx(actual_amount_paid, actual_currency);
      const { error: tError } = await supabase.from("transactions").insert({
        user_id: user!.id,
        date: purchase_date,
        description: `Purchased — ${item_name}`,
        amount: actual_amount_paid,
        currency: actual_currency,
        ugx_amount: actual_ugx_amount,
        type: "expense",
        category,
        account: "Cash",
      });
      if (tError) throw tError;

      const { error: wError } = await supabase
        .from("wish_list_items")
        .update({
          purchased: true,
          actual_amount_paid,
          actual_currency,
          purchase_date,
          actual_ugx_amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (wError) throw wError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wish-list", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      toast({ title: "Purchase recorded" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not complete purchase", description: e.message, variant: "destructive" });
    },
  });

  return {
    ...query,
    insertItem,
    updateItem,
    deleteItem,
    markPurchased,
    isOnline,
  };
}
