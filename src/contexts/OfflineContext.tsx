import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineSync, type SyncStatus } from "@/hooks/useOfflineSync";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface OfflineContextType {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  syncToRemote: () => Promise<void>;
  refreshPendingCount: () => Promise<number | undefined>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export const useOffline = () => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
};

export const OfflineProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { syncStatus, pendingCount, syncToRemote, refreshPendingCount } = useOfflineSync(user?.id);

  return (
    <OfflineContext.Provider value={{ isOnline, syncStatus, pendingCount, syncToRemote, refreshPendingCount }}>
      {children}
    </OfflineContext.Provider>
  );
};
