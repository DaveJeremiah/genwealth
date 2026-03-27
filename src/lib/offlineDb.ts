import Dexie, { type Table } from "dexie";

export interface LocalTransaction {
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
  synced: boolean;
}

export interface LocalChatMessage {
  id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
  synced: boolean;
}

export interface LocalNetWorthSnapshot {
  id: string;
  user_id: string;
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  wealth_score: number | null;
  snapshot_date: string;
  synced: boolean;
}

export interface LocalMemo {
  id: string;
  user_id: string;
  raw_text: string;
  ai_processed: boolean;
  created_at: string;
}

class WealthOSDatabase extends Dexie {
  transactions!: Table<LocalTransaction, string>;
  chatMessages!: Table<LocalChatMessage, string>;
  netWorthSnapshots!: Table<LocalNetWorthSnapshot, string>;
  memos!: Table<LocalMemo, string>;

  constructor() {
    super("WealthOSOffline");
    this.version(1).stores({
      transactions: "id, user_id, synced, date",
      chatMessages: "id, user_id, synced, created_at",
      netWorthSnapshots: "id, user_id, synced",
      memos: "id, user_id, ai_processed",
    });
  }
}

export const offlineDb = new WealthOSDatabase();
