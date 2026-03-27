import { WifiOff } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";

const OfflineBanner = () => {
  const { isOnline } = useOffline();

  if (isOnline) return null;

  return (
    <div className="bg-accent/15 border-b border-accent/30 px-4 py-2 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4 text-accent" />
      <span className="text-xs text-accent font-medium">
        You're offline. Data saves locally and syncs when you reconnect.
      </span>
    </div>
  );
};

export default OfflineBanner;
