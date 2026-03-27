import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";

const SyncIndicator = () => {
  const { syncStatus, pendingCount, isOnline } = useOffline();

  if (syncStatus === "syncing") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span>Syncing…</span>
      </div>
    );
  }

  if (!isOnline || pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-accent">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Offline — {pendingCount} pending</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Cloud className="w-3.5 h-3.5 text-primary" />
      <span>Synced</span>
    </div>
  );
};

export default SyncIndicator;
