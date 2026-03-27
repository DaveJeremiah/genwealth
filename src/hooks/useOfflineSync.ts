import { useState, useEffect, useCallback, useRef } from "react";
import { offlineDb, type LocalTransaction, type LocalChatMessage, type LocalMemo } from "@/lib/offlineDb";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "./useOnlineStatus";
import { useToast } from "./use-toast";

export type SyncStatus = "synced" | "syncing" | "offline";

export const useOfflineSync = (userId: string | undefined) => {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  // Count pending items
  const refreshPendingCount = useCallback(async () => {
    if (!userId) return;
    const txCount = await offlineDb.transactions.where({ synced: 0 }).count();
    const chatCount = await offlineDb.chatMessages.where({ synced: 0 }).count();
    const memoCount = await offlineDb.memos.where({ ai_processed: 0 }).count();
    // Dexie stores booleans as 0/1 in indexes
    const total = txCount + chatCount + memoCount;
    setPendingCount(total);
    return total;
  }, [userId]);

  // Cache all remote data locally on first load
  const cacheRemoteData = useCallback(async () => {
    if (!userId || !isOnline) return;
    try {
      // Cache transactions
      const { data: txs } = await supabase.from("transactions").select("*").order("date", { ascending: false });
      if (txs) {
        for (const t of txs) {
          await offlineDb.transactions.put({ ...t, synced: true } as LocalTransaction);
        }
      }
      // Cache chat messages
      const { data: msgs } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(500);
      if (msgs) {
        for (const m of msgs) {
          await offlineDb.chatMessages.put({ ...m, synced: true } as LocalChatMessage);
        }
      }
      // Cache net worth snapshots
      const { data: snaps } = await supabase.from("net_worth_snapshots").select("*");
      if (snaps) {
        for (const s of snaps) {
          await offlineDb.netWorthSnapshots.put({ ...s, synced: true });
        }
      }
    } catch (e) {
      console.warn("Failed to cache remote data:", e);
    }
  }, [userId, isOnline]);

  // Sync unsynced local records to Supabase
  const syncToRemote = useCallback(async () => {
    if (!userId || !isOnline || syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus("syncing");

    try {
      // Sync transactions
      const unsyncedTx = await offlineDb.transactions.filter(t => t.synced === false).toArray();
      for (const t of unsyncedTx) {
        const { synced, ...row } = t;
        const { error } = await supabase.from("transactions").upsert(row as any);
        if (!error) {
          await offlineDb.transactions.update(t.id, { synced: true });
        }
      }

      // Sync chat messages
      const unsyncedChat = await offlineDb.chatMessages.filter(m => m.synced === false).toArray();
      for (const m of unsyncedChat) {
        const { synced, ...row } = m;
        const { error } = await supabase.from("chat_messages").upsert(row as any);
        if (!error) {
          await offlineDb.chatMessages.update(m.id, { synced: true });
        }
      }

      // Process unprocessed memos via AI
      const unprocessedMemos = await offlineDb.memos.filter(m => m.ai_processed === false).toArray();
      let processedCount = 0;
      for (const memo of unprocessedMemos) {
        try {
          const { data, error } = await supabase.functions.invoke("parse-transactions", {
            body: { input: memo.raw_text },
          });
          if (!error && data?.transactions) {
            for (const tx of data.transactions) {
              const row: LocalTransaction = {
                id: tx.id || crypto.randomUUID(),
                user_id: userId,
                date: tx.date,
                description: tx.description,
                amount: tx.amount,
                currency: tx.currency || "UGX",
                ugx_amount: tx.ugx_amount || tx.amount,
                type: tx.type,
                category: tx.category,
                account: tx.account,
                created_at: new Date().toISOString(),
                synced: false,
              };
              await offlineDb.transactions.put(row);
              // Also sync to Supabase immediately
              const { synced: _, ...dbRow } = row;
              const { error: insertErr } = await supabase.from("transactions").upsert(dbRow as any);
              if (!insertErr) {
                await offlineDb.transactions.update(row.id, { synced: true });
              }
            }
            await offlineDb.memos.update(memo.id, { ai_processed: true });
            processedCount++;
          }
        } catch (e) {
          console.warn("Failed to process memo:", memo.id, e);
        }
      }

      if (processedCount > 0) {
        toast({
          title: `${processedCount} memo${processedCount > 1 ? "s" : ""} processed and added to your entries`,
        });
      }
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      syncingRef.current = false;
      const remaining = await refreshPendingCount();
      setSyncStatus(remaining && remaining > 0 ? "offline" : "synced");
    }
  }, [userId, isOnline, toast, refreshPendingCount]);

  // Initial cache + sync on mount and when coming back online
  useEffect(() => {
    if (!userId) return;
    if (isOnline) {
      cacheRemoteData().then(() => syncToRemote());
    } else {
      setSyncStatus("offline");
      refreshPendingCount();
    }
  }, [userId, isOnline, cacheRemoteData, syncToRemote, refreshPendingCount]);

  return { syncStatus, pendingCount, isOnline, syncToRemote, refreshPendingCount };
};
