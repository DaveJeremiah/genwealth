import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LAST_PROMPTED_SW_SCRIPT_URL_KEY = "wealthos_last_prompted_sw_script_url";

const UpdatePromptDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkForUpdate = async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator)) return;

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;

        // Ask the browser to check for a new service worker.
        await registration.update();

        const waiting = registration.waiting;
        const waitingScriptURL = waiting?.scriptURL;
        if (!waitingScriptURL) return;

        const lastPrompted = localStorage.getItem(LAST_PROMPTED_SW_SCRIPT_URL_KEY);
        if (lastPrompted === waitingScriptURL) return; // already prompted for this build

        // Store as soon as we decide to show the dialog so "Not now" won't reappear.
        localStorage.setItem(LAST_PROMPTED_SW_SCRIPT_URL_KEY, waitingScriptURL);

        if (isMounted) setOpen(true);
      } catch {
        // If SW isn't available or update fails, just don't show the prompt.
      }
    };

    checkForUpdate();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="bg-card border-border max-w-sm mx-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">New update available</AlertDialogTitle>
          <AlertDialogDescription>Refresh to get the latest features.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border">Not now</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground hover:bg-violet-hover"
          >
            Refresh
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UpdatePromptDialog;

