import { WifiOff } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";

const OfflineBanner = () => {
  const { isOnline } = useOffline();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500/10 px-4 py-2 flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5 text-amber-500" />
      <span className="text-xs text-amber-500 font-medium">
        You're offline. Entries save locally and sync when you reconnect.
      </span>
    </div>
  );
};

export default OfflineBanner;
